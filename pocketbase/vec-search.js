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

  const pending = all.filter((c) => !c.ids.some((id) => reviewed.has(id)));
  const total = pending.length;
  const start = (page - 1) * perPage;
  const slice = pending.slice(start, start + perPage);

  const info = d.prepare('SELECT id, code, answer, statement_md, topic FROM main.tasks WHERE id = ?');
  // работы, использующие задачу (variants.tasks — JSON-массив id)
  const worksStmt = d.prepare(`
    SELECT DISTINCT w.id AS id, w.title AS title, v.number AS variant
    FROM main.variants v JOIN main.works w ON w.id = v.work
    WHERE v.tasks LIKE ? LIMIT 8`);
  const worksOf = (id) => { try { return worksStmt.all(`%"${id}"%`); } catch { return []; } };
  const items = slice.map((c) => ({
    type: c.type,
    size: c.ids.length,
    members: c.ids.map((id) => {
      const r = info.get(id);
      if (!r) return { id, missing: true };
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
 */
export function indexVectors(rows) {
  invalidateDb(); // освобождаем readonly-attach на vec.db перед записью
  const w = new Database(VEC_DB);
  try {
    sqliteVec.load(w);
    w.pragma('busy_timeout = 5000');
    w.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS vec_tasks USING vec0(task_id TEXT, embedding FLOAT[${DIM}] distance_metric=cosine);`);
    w.exec(`CREATE TABLE IF NOT EXISTS vec_meta (task_id TEXT PRIMARY KEY, model TEXT, dim INTEGER, text_hash TEXT, indexed_at TEXT);`);
    const del = w.prepare('DELETE FROM vec_tasks WHERE task_id = ?');
    const ins = w.prepare('INSERT INTO vec_tasks(task_id, embedding) VALUES (?, ?)');
    const meta = w.prepare(`INSERT INTO vec_meta(task_id, model, dim, text_hash, indexed_at)
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
    const total = w.prepare('SELECT count(*) c FROM vec_tasks').get().c;
    return { indexed: rows.length, total };
  } finally {
    w.close();
  }
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

/**
 * Прунинг осиротевших векторов: удалить из vec.db записи, чьих task_id больше
 * нет в base (актуальный список id задач из PB). Безопасно — поиск и так
 * игнорирует осиротевшие через JOIN, это гигиена/место.
 * @param {string[]} validIds - актуальные id задач
 * @returns {{ pruned:number, total:number }}
 */
export function pruneVectors(validIds) {
  const valid = new Set(validIds);
  invalidateDb();
  const w = new Database(VEC_DB);
  try {
    sqliteVec.load(w);
    w.pragma('busy_timeout = 5000');
    const all = w.prepare('SELECT task_id FROM vec_tasks').all().map((r) => r.task_id);
    const orphans = all.filter((id) => !valid.has(id));
    const delVec = w.prepare('DELETE FROM vec_tasks WHERE task_id = ?');
    const delMeta = w.prepare('DELETE FROM vec_meta WHERE task_id = ?');
    const tx = w.transaction((ids) => { for (const id of ids) { delVec.run(id); delMeta.run(id); } });
    tx(orphans);
    const total = w.prepare('SELECT count(*) c FROM vec_tasks').get().c;
    return { pruned: orphans.length, total };
  } finally {
    w.close();
  }
}

export function vecHealth() {
  try {
    const d = getDb();
    const n = d.prepare('SELECT count(*) c FROM vdb.vec_tasks').get().c;
    return { ok: true, vectors: n, data_db: DATA_DB, vec_db: VEC_DB };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
