/**
 * vec-search.js — семантический поиск похожих задач через sqlite-vec.
 *
 * Архитектура (см. lemma_vector_search_idea.md, Option B+):
 *   - векторы лежат в отдельной vec.db (vec0, distance_metric=cosine);
 *   - поисковое соединение: main = data.db (READONLY) + ATTACH vec.db;
 *   - JOIN vec_tasks ⋈ tasks одним запросом (~4мс на ~11k).
 *
 * data.db открыт строго readonly → нулевой риск записи в боевую БД.
 * cos_sim = 1 - distance (косинусная метрика vec0).
 */

import fs from 'node:fs';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const DATA_DB = process.env.PB_DATA_DB || '/opt/pocketbase/pb_data/data.db';
const VEC_DB = process.env.VEC_DB || '/opt/pocketbase/pdf-service/vec.db';
const CLUSTERS_FILE = process.env.DEDUP_CLUSTERS || '/opt/pocketbase/pdf-service/dedup-clusters.json';

// Калибровка процента для UI (Этап 0): несвязанные ≈ 0.55 → 0%, почти-дубль 0.95 → 100%.
const CAL_FLOOR = 0.55;
const CAL_CEIL = 0.95;
const toPct = (cos) => Math.max(0, Math.min(100, ((cos - CAL_FLOOR) / (CAL_CEIL - CAL_FLOOR)) * 100));

const DIM = 1024;
let db = null;
let openError = null;

// Сбросить поисковое соединение (release attach на vec.db) — чтобы после
// записи новых векторов следующий /similar переоткрыл и увидел свежие данные.
function invalidateDb() {
  if (db) { try { db.close(); } catch { /* ignore */ } }
  db = null; openError = null;
}

function getDb() {
  if (db) return db;
  if (openError) throw openError;
  try {
    // main = data.db READONLY (PB пишет в неё параллельно, WAL допускает читателей)
    db = new Database(DATA_DB, { readonly: true, fileMustExist: true });
    sqliteVec.load(db);
    db.exec(`ATTACH DATABASE '${VEC_DB.replace(/'/g, "''")}' AS vdb;`);
    // sanity
    db.prepare('SELECT count(*) c FROM vdb.vec_tasks').get();
    console.log('[vec-search] соединение открыто: data.db (ro) + vec.db');
    return db;
  } catch (e) {
    openError = new Error(`vec-search init: ${e.message}`);
    throw openError;
  }
}

/**
 * Найти задачи, похожие на заданную.
 * @param {object} o
 * @param {string} o.taskId        - id исходной задачи
 * @param {number} [o.limit=8]     - сколько вернуть
 * @param {boolean} [o.sameTopicOnly=true] - фильтр по той же теме (тема = надёжный признак типа)
 * @param {number} [o.minCos=0]    - отсечка по косинусу
 * @returns {Array<{task_id,cos,pct,code,topic}>}
 */
export function findSimilar({ taskId, limit = 8, sameTopicOnly = true, minCos = 0 }) {
  const d = getDb();

  // 1) вектор исходной задачи
  const row = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?').get(taskId);
  if (!row) return { error: 'not_indexed', items: [] };
  const qvec = row.embedding; // Buffer

  // 2) тема исходной задачи (для фильтра)
  const src = d.prepare('SELECT topic FROM main.tasks WHERE id = ?').get(taskId);
  const srcTopic = src?.topic || '';

  // 3) KNN + JOIN. Берём с запасом (k), потом фильтруем тему и режем до limit.
  const k = Math.max(limit * 8, 60);
  const rows = d.prepare(`
    SELECT v.task_id AS task_id, v.distance AS distance,
           t.code AS code, t.topic AS topic, t.statement_md AS statement_md
    FROM vdb.vec_tasks v
    JOIN main.tasks t ON t.id = v.task_id
    WHERE v.embedding MATCH ? AND v.k = ?
    ORDER BY v.distance
  `).all(qvec, k);

  const out = [];
  for (const r of rows) {
    if (r.task_id === taskId) continue; // исключить саму себя
    if (sameTopicOnly && srcTopic && r.topic !== srcTopic) continue;
    const cos = 1 - r.distance;
    if (cos < minCos) continue;
    const stmt = (r.statement_md || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    out.push({ task_id: r.task_id, cos: Number(cos.toFixed(4)), pct: Math.round(toPct(cos)), code: r.code, topic: r.topic, statement: stmt });
    if (out.length >= limit) break;
  }
  return { error: null, source_topic: srcTopic, items: out };
}

// --- Дедуп-кластеры (B2): предвычисленный файл + живой JOIN к data.db ---
let _clusters = null;
function loadClusters() {
  if (_clusters) return _clusters;
  if (!fs.existsSync(CLUSTERS_FILE)) { _clusters = []; return _clusters; }
  _clusters = JSON.parse(fs.readFileSync(CLUSTERS_FILE, 'utf8'));
  return _clusters;
}

/**
 * Вернуть дедуп-кластеры на ревью с пагинацией.
 * Уже размеченные (члены состоят в dedup_cluster-семействе) скрываются.
 * @param {object} o
 * @param {string} [o.type='exact_dup']  - 'exact_dup' | 'param_family'
 * @param {number} [o.page=1]
 * @param {number} [o.perPage=20]
 */
export function getDuplicateClusters({ type = 'exact_dup', page = 1, perPage = 20 } = {}) {
  const d = getDb();
  const all = loadClusters().filter((c) => c.type === type);

  // task_id уже размеченных (дубли ИЛИ помечены «не дубли») — скрываем из очереди
  const reviewed = new Set(
    d.prepare(`SELECT DISTINCT m.task AS t FROM main.task_family_members m
               JOIN main.task_families f ON f.id = m.family
               WHERE f.type IN ('dedup_cluster', 'reviewed_not_dup')`).all().map((r) => r.t)
  );

  // Существующие задачи (для живого скрытия удалённых из кластеров без пересчёта).
  const existing = new Set(d.prepare('SELECT id FROM main.tasks').all().map((r) => r.id));

  // Кластер актуален, если НЕ размечен и в нём осталось ≥2 ещё существующих задач.
  const pending = all
    .map((c) => ({ ...c, ids: c.ids.filter((id) => existing.has(id)) }))
    .filter((c) => c.ids.length >= 2 && !c.ids.some((id) => reviewed.has(id)));
  const total = pending.length;
  const start = (page - 1) * perPage;
  const slice = pending.slice(start, start + perPage);

  const info = d.prepare('SELECT id, code, answer, statement_md, topic FROM main.tasks WHERE id = ?');

  // Работы по задаче: ОДИН проход по variants и построение карты task_id → работы,
  // только для членов текущей страницы. Раньше был `WHERE v.tasks LIKE '%"id"%'`
  // на КАЖДОГО члена — полный скан variants ×N. Для крупных param-семейств
  // (десятки членов на странице) это давало ~25с и таймаут фронта.
  const pageIds = new Set();
  for (const c of slice) for (const id of c.ids) pageIds.add(id);
  const worksByTask = new Map();
  if (pageIds.size) {
    const variantRows = d.prepare(
      `SELECT v.tasks AS tasks, w.id AS id, w.title AS title, v.number AS variant
       FROM main.variants v JOIN main.works w ON w.id = v.work`
    ).all();
    for (const row of variantRows) {
      let ids;
      try { ids = JSON.parse(row.tasks || '[]'); } catch { ids = []; }
      if (!Array.isArray(ids)) continue;
      for (const tid of ids) {
        if (!pageIds.has(tid)) continue;
        let arr = worksByTask.get(tid);
        if (!arr) { arr = []; worksByTask.set(tid, arr); }
        if (arr.length < 8) arr.push({ id: row.id, title: row.title, variant: row.variant });
      }
    }
  }
  const worksOf = (id) => worksByTask.get(id) || [];
  const items = slice.map((c) => ({
    type: c.type,
    size: c.ids.length, // уже только существующие
    members: c.ids.map((id) => {
      const r = info.get(id);
      if (!r) return { id, missing: true }; // не должно случаться (отфильтровали), но на всякий
      const works = worksOf(id);
      return { id: r.id, code: r.code, answer: r.answer, topic: r.topic,
        ref_count: works.length,
        works: works.map((w) => ({ id: w.id, title: w.title, variant: w.variant })),
        statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 240) };
    }),
  }));
  return { total, page, perPage, totalPages: Math.ceil(total / perPage), reviewed_count: reviewed.size, items };
}

// --- Похожие ПАРЫ внутри набора задач (A2: предупреждение о повторах в варианте) ---
function cosineBuf(a, b) {
  // a,b — Buffer с Float32. Длина одинаковая.
  const fa = new Float32Array(a.buffer, a.byteOffset, a.length / 4);
  const fb = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < fa.length; i++) { dot += fa[i] * fb[i]; na += fa[i] * fa[i]; nb += fb[i] * fb[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Найти похожие пары среди набора задач (для одного варианта).
 * @param {string[]} taskIds
 * @param {number} [minCos=0.7]
 * @returns {{pairs: Array<{a,b,cos,pct}>, missing: string[]}}
 */
export function findPairs(taskIds, minCos = 0.7) {
  const d = getDb();
  const get = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?');
  const vecs = new Map();
  const missing = [];
  for (const id of taskIds) {
    const r = get.get(id);
    if (r) vecs.set(id, r.embedding); else missing.push(id);
  }
  const ids = [...vecs.keys()];
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const cos = cosineBuf(vecs.get(ids[i]), vecs.get(ids[j]));
      if (cos >= minCos) pairs.push({ a: ids[i], b: ids[j], cos: Number(cos.toFixed(4)), pct: Math.round(toPct(cos)) });
    }
  }
  pairs.sort((x, y) => y.cos - x.cos);
  return { pairs, missing };
}

/**
 * Инкрементальная запись векторов в vec.db (A: /index-vectors).
 * rows: [{ task_id, vec:[float×1024], text_hash, model? }]. Upsert по task_id.
 * Открывает отдельное WRITABLE-соединение; поисковое инвалидируется.
 * table/metaTable параметризованы: vec_tasks (банк задач) | vec_geometry (геометрия).
 */
function indexVectorsInto(table, metaTable, rows) {
  invalidateDb(); // освобождаем readonly-attach на vec.db перед записью
  const w = new Database(VEC_DB);
  try {
    sqliteVec.load(w);
    w.pragma('busy_timeout = 5000');
    w.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${table} USING vec0(task_id TEXT, embedding FLOAT[${DIM}] distance_metric=cosine);`);
    w.exec(`CREATE TABLE IF NOT EXISTS ${metaTable} (task_id TEXT PRIMARY KEY, model TEXT, dim INTEGER, text_hash TEXT, indexed_at TEXT);`);
    const del = w.prepare(`DELETE FROM ${table} WHERE task_id = ?`);
    const ins = w.prepare(`INSERT INTO ${table}(task_id, embedding) VALUES (?, ?)`);
    const meta = w.prepare(`INSERT INTO ${metaTable}(task_id, model, dim, text_hash, indexed_at)
      VALUES (@task_id, @model, @dim, @text_hash, @indexed_at)
      ON CONFLICT(task_id) DO UPDATE SET model=@model, dim=@dim, text_hash=@text_hash, indexed_at=@indexed_at`);
    const tx = w.transaction((items) => {
      for (const r of items) {
        if (!Array.isArray(r.vec) || r.vec.length !== DIM) throw new Error(`bad vec dim for ${r.task_id}`);
        del.run(r.task_id);
        ins.run(r.task_id, Buffer.from(Float32Array.from(r.vec).buffer));
        meta.run({ task_id: r.task_id, model: r.model || 'bge-m3', dim: DIM, text_hash: r.text_hash || '', indexed_at: new Date().toISOString() });
      }
    });
    tx(rows);
    const total = w.prepare(`SELECT count(*) c FROM ${table}`).get().c;
    return { indexed: rows.length, total };
  } finally {
    w.close();
  }
}

export function indexVectors(rows) {
  return indexVectorsInto('vec_tasks', 'vec_meta', rows);
}

/**
 * A4 — построить параллельные варианты «по образцу».
 * Для каждой задачи базового набора подбирает похожих сиблингов (та же тема,
 * cos в полосе [minCos,maxCos] — «тот же тип, другие числа», но не байт-в-байт),
 * и собирает `count` вариантов, где позиция i везде одного типа.
 *
 * @param {string[]} baseIds  - задачи базового варианта (по позициям)
 * @param {object} o
 * @param {number} [o.count=2]    - сколько ПАРАЛЛЕЛЬНЫХ вариантов (помимо базового)
 * @param {number} [o.minCos=0.85]
 * @param {number} [o.maxCos=0.995] - выше — это байт-в-байт дубль (те же числа), не нужен
 * @returns {{ base:[], variants:[[]], shortage:[] }}
 */
export function buildParallelVariants(baseIds, { count = 2, minCos = 0.85, maxCos = 0.995 } = {}) {
  const d = getDb();
  const getVec = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?');
  const info = d.prepare('SELECT id, code, answer, topic, statement_md FROM main.tasks WHERE id = ?');
  const knn = d.prepare(`
    SELECT v.task_id AS task_id, v.distance AS distance, t.topic AS topic
    FROM vdb.vec_tasks v JOIN main.tasks t ON t.id = v.task_id
    WHERE v.embedding MATCH ? AND v.k = ? ORDER BY v.distance`);

  const baseSet = new Set(baseIds);
  const used = new Set(baseIds); // сиблинги не должны повторять базу и друг друга
  const fmt = (id, cos) => {
    const r = info.get(id);
    return r ? { task_id: id, code: r.code, answer: r.answer,
      statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 160),
      ...(cos != null ? { cos: Number(cos.toFixed(4)) } : {}) } : { task_id: id, missing: true };
  };

  // пул кандидатов для каждой позиции
  const pools = baseIds.map((id) => {
    const row = getVec.get(id);
    if (!row) return [];
    const src = info.get(id);
    const topic = src?.topic || '';
    const rows = knn.all(row.embedding, count * 6 + 15);
    return rows
      .filter((r) => r.task_id !== id && r.topic === topic)
      .map((r) => ({ id: r.task_id, cos: 1 - r.distance }))
      .filter((r) => r.cos >= minCos && r.cos <= maxCos);
  });

  const variants = [];
  const shortage = [];
  for (let v = 0; v < count; v++) {
    const variant = [];
    for (let i = 0; i < baseIds.length; i++) {
      const pick = pools[i].find((c) => !used.has(c.id));
      if (pick) { used.add(pick.id); variant.push(fmt(pick.id, pick.cos)); }
      else { variant.push({ position: i + 1, missing: true }); shortage.push({ position: i + 1, base: baseIds[i] }); }
    }
    variants.push(variant);
  }

  return { base: baseIds.map((id) => fmt(id, null)), variants, shortage };
}

/**
 * C4 — «работа над ошибками»: по проваленным задачам подобрать похожие для
 * отработки (тот же навык, не клон). Сгруппировано по исходной задаче.
 *
 * @param {string[]} failedIds - проваленные задачи
 * @param {object} o
 * @param {number} [o.perTask=2]   - сколько похожих на каждую провальную
 * @param {string[]} [o.excludeIds=[]] - дополнительно исключить (напр. уже выданные)
 * @param {number} [o.minCos=0.70] - нижняя граница «тот же навык»
 * @param {number} [o.maxCos=0.97] - верхняя (исключаем байт-в-байт клоны)
 * @returns {{ groups:[{source, picks:[]}], all:[], missing:[] }}
 */
export function buildRemediation(failedIds, { perTask = 2, excludeIds = [], minCos = 0.70, maxCos = 0.97 } = {}) {
  const d = getDb();
  const getVec = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?');
  const info = d.prepare('SELECT id, code, answer, topic, statement_md FROM main.tasks WHERE id = ?');
  const knn = d.prepare(`
    SELECT v.task_id AS task_id, v.distance AS distance, t.topic AS topic
    FROM vdb.vec_tasks v JOIN main.tasks t ON t.id = v.task_id
    WHERE v.embedding MATCH ? AND v.k = ? ORDER BY v.distance`);

  const used = new Set([...failedIds, ...excludeIds]); // не выдаём оригиналы и исключённые
  const fmt = (id, cos) => {
    const r = info.get(id);
    return r ? { task_id: id, code: r.code, answer: r.answer, topic: r.topic,
      statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 160),
      ...(cos != null ? { cos: Number(cos.toFixed(4)), pct: Math.round(toPct(cos)) } : {}) } : { task_id: id, missing: true };
  };

  const groups = [];
  const all = [];
  const missing = [];
  for (const fid of failedIds) {
    const row = getVec.get(fid);
    const src = info.get(fid);
    if (!row || !src) { missing.push(fid); groups.push({ source: fmt(fid, null), picks: [] }); continue; }
    const topic = src.topic || '';
    const cands = knn.all(row.embedding, perTask * 8 + 15)
      .filter((r) => r.task_id !== fid && r.topic === topic)
      .map((r) => ({ id: r.task_id, cos: 1 - r.distance }))
      .filter((r) => r.cos >= minCos && r.cos <= maxCos && !used.has(r.id));
    const picks = [];
    for (const c of cands) {
      if (picks.length >= perTask) break;
      used.add(c.id);
      const f = fmt(c.id, c.cos);
      picks.push(f); all.push(f);
    }
    if (picks.length === 0) missing.push(fid);
    groups.push({ source: fmt(fid, null), picks });
  }
  return { groups, all, missing };
}

// === Подбор задач для «Генератора» (v3.9.41) ===========================
// Три семантических режима набора листа поверх того же индекса:
//   selectBySeed   — «по образцу» (один ползунок похожести),
//   selectDiverse  — «разные сюжеты» (MMR или кластеры),
//   selectNovelty  — «анти-дубль» к ранее выданной работе.

// Buffer(Float32) → копия Float32Array (не view на пул better-sqlite3).
function bufToF32(buf) {
  const view = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  return Float32Array.from(view);
}

// Косинус между двумя Float32Array одинаковой длины.
function cosF32(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// Загрузить все векторы темы (опц. подтемы) вместе с лёгкими полями задачи.
// subtopic в tasks — JSON-массив id → matching через LIKE.
function loadTopicVectors(d, topicId, subtopicId) {
  let sql = `
    SELECT v.task_id AS id, v.embedding AS embedding,
           t.code AS code, t.answer AS answer, t.statement_md AS statement_md
    FROM vdb.vec_tasks v JOIN main.tasks t ON t.id = v.task_id
    WHERE t.topic = ?`;
  const args = [topicId];
  if (subtopicId) { sql += ' AND t.subtopic LIKE ?'; args.push(`%"${subtopicId}"%`); }
  return d.prepare(sql).all(...args).map((r) => ({
    id: r.id, code: r.code, answer: r.answer,
    statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 200),
    vec: bufToF32(r.embedding),
  }));
}

// Жадный MMR (max-min): из пула выбрать count максимально разных задач.
// Старт — случайный элемент (разнообразие между перегенерациями).
// items: [{vec:Float32Array, ...}]. Возвращает выбранные элементы (с полем _cos —
// похожесть на ближайшего уже выбранного, для отладки/бейджей).
function mmrSelect(items, count) {
  if (items.length === 0) return [];
  const n = Math.min(count, items.length);
  const chosenIdx = [Math.floor(Math.random() * items.length)];
  const minSim = items.map((it) => cosF32(it.vec, items[chosenIdx[0]].vec));
  while (chosenIdx.length < n) {
    let best = -1, bestSim = Infinity;
    for (let i = 0; i < items.length; i++) {
      if (chosenIdx.includes(i)) continue;
      if (minSim[i] < bestSim) { bestSim = minSim[i]; best = i; }
    }
    if (best < 0) break;
    chosenIdx.push(best);
    const bv = items[best].vec;
    for (let i = 0; i < items.length; i++) {
      const s = cosF32(items[i].vec, bv);
      if (s < minSim[i]) minSim[i] = s;
    }
  }
  return chosenIdx.map((i) => ({ ...items[i], _cos: minSim[i] }));
}

/**
 * «По образцу» — подобрать count задач вокруг эталона, регулируя один ползунок.
 * similarity ∈ [0,1]: 1 → самые близкие (клоны-тренажёр), 0 → самые далёкие внутри темы.
 * @returns {{error, source_topic, items:[{task_id,cos,pct,code,statement}]}}
 */
export function selectBySeed({ taskId, count = 20, similarity = 0.5, sameTopicOnly = true }) {
  const d = getDb();
  const row = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?').get(taskId);
  if (!row) return { error: 'not_indexed', items: [] };
  const src = d.prepare('SELECT topic FROM main.tasks WHERE id = ?').get(taskId);
  const srcTopic = src?.topic || '';

  const k = Math.max(count * 10 + 60, 120);
  const rows = d.prepare(`
    SELECT v.task_id AS task_id, v.distance AS distance,
           t.topic AS topic, t.code AS code, t.statement_md AS statement_md
    FROM vdb.vec_tasks v JOIN main.tasks t ON t.id = v.task_id
    WHERE v.embedding MATCH ? AND v.k = ?
    ORDER BY v.distance`).all(row.embedding, k);

  // кандидаты, отсортированные по cos ↓ (KNN уже по distance ↑ = cos ↓)
  const pool = [];
  for (const r of rows) {
    if (r.task_id === taskId) continue;
    if (sameTopicOnly && srcTopic && r.topic !== srcTopic) continue;
    const cos = 1 - r.distance;
    pool.push({ task_id: r.task_id, cos, code: r.code,
      statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 200) });
  }
  if (pool.length === 0) return { error: null, source_topic: srcTopic, items: [] };

  // окно по ползунку: similarity=1 → с начала (близкие), 0 → с конца (далёкие)
  const s = Math.max(0, Math.min(1, Number(similarity)));
  const start = Math.round((1 - s) * Math.max(0, pool.length - count));
  const slice = pool.slice(start, start + count);
  const items = slice.map((r) => ({
    task_id: r.task_id, cos: Number(r.cos.toFixed(4)), pct: Math.round(toPct(r.cos)),
    code: r.code, statement: r.statement,
  }));
  return { error: null, source_topic: srcTopic, items };
}

/**
 * «Разные сюжеты» — максимально разнообразный набор внутри темы.
 * method='mmr' (жадный max-min) | 'clusters' (k-means → медоиды).
 * @returns {{error, items:[{task_id,code,answer,statement}], pool_size}}
 */
export function selectDiverse({ topicId, subtopicId = null, count = 20, method = 'mmr' }) {
  const d = getDb();
  if (!topicId) return { error: 'no_topic', items: [], pool_size: 0 };
  const pool = loadTopicVectors(d, topicId, subtopicId);
  if (pool.length === 0) return { error: 'empty', items: [], pool_size: 0 };

  let picked;
  if (method === 'clusters') picked = kmeansMedoids(pool, count);
  else picked = mmrSelect(pool, count);

  const items = picked.map((p) => ({
    task_id: p.id, code: p.code, answer: p.answer, statement: p.statement,
  }));
  return { error: null, items, pool_size: pool.length };
}

// k-means (k=count) по векторам темы → медоид каждого кластера (по одной задаче «сюжета»).
function kmeansMedoids(items, count) {
  const k = Math.min(count, items.length);
  if (k <= 1) return items.slice(0, k);
  const dim = items[0].vec.length;
  // инициализация: k случайных различных задач
  const order = items.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, k);
  let centroids = order.map((i) => Float32Array.from(items[i].vec));
  let assign = new Array(items.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      let best = 0, bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const s = cosF32(items[i].vec, centroids[c]);
        if (s > bestSim) { bestSim = s; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    }
    if (!changed && iter > 0) break;
    const sums = Array.from({ length: k }, () => new Float64Array(dim));
    const cnts = new Array(k).fill(0);
    for (let i = 0; i < items.length; i++) {
      const c = assign[i]; cnts[c]++;
      const v = items[i].vec;
      for (let j = 0; j < dim; j++) sums[c][j] += v[j];
    }
    centroids = sums.map((s, c) => {
      const out = new Float32Array(dim);
      if (cnts[c] > 0) for (let j = 0; j < dim; j++) out[j] = s[j] / cnts[c];
      return out;
    });
  }
  // медоид каждого непустого кластера
  const medoids = [];
  for (let c = 0; c < k; c++) {
    let best = -1, bestSim = -Infinity;
    for (let i = 0; i < items.length; i++) {
      if (assign[i] !== c) continue;
      const s = cosF32(items[i].vec, centroids[c]);
      if (s > bestSim) { bestSim = s; best = i; }
    }
    if (best >= 0) medoids.push(items[best]);
  }
  return medoids;
}

/**
 * «Анти-дубль» — набор из темы, не похожий на задачи ранее выданной работы.
 * Оставляет кандидатов с maxSim(cand, avoid) ≤ maxCos, среди них — MMR до count.
 * @returns {{error, items:[...], pool_size, filtered_out}}
 */
export function selectNovelty({ topicId, subtopicId = null, count = 20, avoidTaskIds = [], maxCos = 0.85 }) {
  const d = getDb();
  if (!topicId) return { error: 'no_topic', items: [], pool_size: 0, filtered_out: 0 };
  const avoid = new Set(avoidTaskIds);
  const pool = loadTopicVectors(d, topicId, subtopicId).filter((p) => !avoid.has(p.id));
  if (pool.length === 0) return { error: 'empty', items: [], pool_size: 0, filtered_out: 0 };

  // векторы задач, которых надо избегать (могут быть из любой темы)
  const getVec = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?');
  const avoidVecs = [];
  for (const id of avoidTaskIds) { const r = getVec.get(id); if (r) avoidVecs.push(bufToF32(r.embedding)); }

  let survivors = pool;
  let filteredOut = 0;
  if (avoidVecs.length > 0) {
    survivors = pool.filter((p) => {
      let maxSim = 0;
      for (const av of avoidVecs) { const s = cosF32(p.vec, av); if (s > maxSim) maxSim = s; }
      if (maxSim > maxCos) { filteredOut++; return false; }
      return true;
    });
  }
  if (survivors.length === 0) return { error: null, items: [], pool_size: pool.length, filtered_out: filteredOut };

  const picked = mmrSelect(survivors, count);
  const items = picked.map((p) => ({
    task_id: p.id, code: p.code, answer: p.answer, statement: p.statement,
  }));
  return { error: null, items, pool_size: pool.length, filtered_out: filteredOut };
}

/**
 * Оценка «новизны» набора (v3.9.41) — насколько свежий сгенерированный лист
 * относительно задач ранее выданных работ. Для каждой задачи набора считаем
 * maxSim к референсному набору (объединение задач последних N работ).
 * freshCos — ниже него задача считается «новой»; dupCos — выше «почти повтор».
 * @returns {{error, items:[{task_id,max_sim}], novelty_pct, fresh, dup, scored, ref_count}}
 */
export function scoreNovelty({ taskIds = [], refTaskIds = [], dupCos = 0.95, freshCos = 0.85 }) {
  const d = getDb();
  const getVec = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?');

  const refVecs = [];
  const refSet = new Set(refTaskIds);
  for (const id of refSet) { const r = getVec.get(id); if (r) refVecs.push(bufToF32(r.embedding)); }

  const items = [];
  let fresh = 0, dup = 0, scored = 0;
  for (const id of taskIds) {
    const r = getVec.get(id);
    if (!r) { items.push({ task_id: id, max_sim: null }); continue; }
    const v = bufToF32(r.embedding);
    let maxSim = 0;
    for (const rv of refVecs) { const s = cosF32(v, rv); if (s > maxSim) maxSim = s; }
    scored++;
    if (maxSim < freshCos) fresh++;
    if (maxSim >= dupCos) dup++;
    items.push({ task_id: id, max_sim: Number(maxSim.toFixed(4)) });
  }
  const novelty_pct = scored > 0 ? Math.round((fresh / scored) * 100) : 100;
  return { error: null, items, novelty_pct, fresh, dup, scored, ref_count: refVecs.length };
}

/**
 * Прунинг осиротевших векторов: удалить из vec.db записи, чьих task_id больше
 * нет в base (актуальный список id задач из PB). Безопасно — поиск и так
 * игнорирует осиротевшие через JOIN, это гигиена/место.
 * @param {string[]} validIds - актуальные id задач
 * @returns {{ pruned:number, total:number, missing_on_vps:string[] }}
 *   missing_on_vps — id задач, которые есть локально (в validIds), но отсутствуют
 *   на VPS. Mac досылает их вектора (самосверка: лечит дрейф из-за непрошедшего
 *   когда-то пуша — инкремент сам бы их пропустил по text_hash и не дослал).
 */
function pruneVectorsFrom(table, metaTable, validIds) {
  const valid = new Set(validIds);
  invalidateDb();
  const w = new Database(VEC_DB);
  try {
    sqliteVec.load(w);
    w.pragma('busy_timeout = 5000');
    let all;
    try {
      all = w.prepare(`SELECT task_id FROM ${table}`).all().map((r) => r.task_id);
    } catch {
      // Таблицы ещё нет (первая индексация не приезжала) — нечего прунить,
      // все локальные вектора числятся отсутствующими → Mac их дошлёт.
      return { pruned: 0, total: 0, missing_on_vps: validIds };
    }
    const onVps = new Set(all);
    const orphans = all.filter((id) => !valid.has(id));
    const delVec = w.prepare(`DELETE FROM ${table} WHERE task_id = ?`);
    const delMeta = w.prepare(`DELETE FROM ${metaTable} WHERE task_id = ?`);
    const tx = w.transaction((ids) => { for (const id of ids) { delVec.run(id); delMeta.run(id); } });
    tx(orphans);
    const total = w.prepare(`SELECT count(*) c FROM ${table}`).get().c;
    const missing_on_vps = validIds.filter((id) => !onVps.has(id));
    return { pruned: orphans.length, total, missing_on_vps };
  } finally {
    w.close();
  }
}

export function pruneVectors(validIds) {
  return pruneVectorsFrom('vec_tasks', 'vec_meta', validIds);
}

// === Геометрия: vec_geometry ⋈ geometry_tasks ===============================
// Отдельная таблица в том же vec.db (та же модель/размерность). Смыслы не
// смешиваем с банком tasks: другая сущность — другая выдача.

function geoIndexReady(d) {
  try { d.prepare('SELECT 1 FROM vdb.vec_geometry LIMIT 1').get(); return true; }
  catch { return false; }
}

/**
 * Похожие геометрические задачи.
 * У банка МЦНМО дерево тем не используется (фасетные теги) → фильтра «та же
 * тема» нет; вместо него опциональный фильтр по происхождению (manual|mccme).
 * @param {object} o { taskId, limit=8, minCos=0, origin=null }
 */
export function findSimilarGeometry({ taskId, limit = 8, minCos = 0, origin = null }) {
  const d = getDb();
  if (!geoIndexReady(d)) return { error: 'no_index', items: [] };
  const row = d.prepare('SELECT embedding FROM vdb.vec_geometry WHERE task_id = ?').get(taskId);
  if (!row) return { error: 'not_indexed', items: [] };

  const k = Math.max(limit * 8, 60);
  const rows = d.prepare(`
    SELECT v.task_id AS task_id, v.distance AS distance,
           g.code AS code, g.title AS title, g.origin AS origin,
           g.source AS source, g.statement_md AS statement_md
    FROM vdb.vec_geometry v
    JOIN main.geometry_tasks g ON g.id = v.task_id
    WHERE v.embedding MATCH ? AND v.k = ?
    ORDER BY v.distance
  `).all(row.embedding, k);

  const out = [];
  for (const r of rows) {
    if (r.task_id === taskId) continue;
    const rOrigin = r.origin === 'mccme' ? 'mccme' : 'manual';
    if (origin && rOrigin !== origin) continue;
    const cos = 1 - r.distance;
    if (cos < minCos) continue;
    const stmt = (r.statement_md || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    out.push({
      task_id: r.task_id, cos: Number(cos.toFixed(4)), pct: Math.round(toPct(cos)),
      code: r.code, title: r.title || '', origin: rOrigin, source: r.source || '', statement: stmt,
    });
    if (out.length >= limit) break;
  }
  return { error: null, items: out };
}

export function indexGeometryVectors(rows) {
  return indexVectorsInto('vec_geometry', 'vec_geometry_meta', rows);
}

export function pruneGeometryVectors(validIds) {
  return pruneVectorsFrom('vec_geometry', 'vec_geometry_meta', validIds);
}

// Принять готовые дедуп-кластеры (посчитаны на Mac) — записать файл + кэш.
// Лёгкая операция (запись ~170KB), не грузит VPS. См. index.mjs (clustering).
export function setClusters(clusters) {
  if (!Array.isArray(clusters)) throw new Error('clusters must be array');
  fs.writeFileSync(CLUSTERS_FILE, JSON.stringify(clusters));
  _clusters = clusters;
  const exact = clusters.filter((c) => c.type === 'exact_dup').length;
  return { clusters: clusters.length, exact_dup: exact, param_family: clusters.length - exact };
}

export function vecHealth() {
  try {
    const d = getDb();
    const n = d.prepare('SELECT count(*) c FROM vdb.vec_tasks').get().c;
    let geo = 0;
    try { geo = d.prepare('SELECT count(*) c FROM vdb.vec_geometry').get().c; } catch { /* индекса ещё нет */ }
    return { ok: true, vectors: n, geometry_vectors: geo, data_db: DATA_DB, vec_db: VEC_DB };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
