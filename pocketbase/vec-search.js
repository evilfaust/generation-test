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
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import {
  cosF32, shuffled, normalizeAnswer, isDiscriminativeAnswer, applyAllowed,
  seedTargetCos, pickByTargetCos, distributeParallel, mmrSelect, kmeansMedoids,
  taskSignature, signaturesCompatible,
} from './vec-lib.mjs';

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
  clearTopicPools(); // индекс изменился — кэшированные пулы тем устарели
  _indexStats = null;
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

/**
 * Похожие сразу для набора задач (A1 «дополнить лист»): один вызов вместо
 * запроса на каждую задачу. При sameTopicOnly (штатный режим) считаем по пулам
 * тем — KNN стоит ~45 мс независимо от k, и на 20 задачах это была секунда
 * блокировки event loop плюс 20 round-trip'ов из браузера.
 *
 * @param {string[]} taskIds
 * @param {object} o { limit=3, sameTopicOnly=true, minCos=0, excludeIds=[] }
 * @returns {{ groups: [{ task_id, items:[] }] }}
 */
export async function findSimilarBatch(taskIds, { limit = 3, sameTopicOnly = true, minCos = 0, excludeIds = [] } = {}) {
  const d = getDb();
  const info = d.prepare('SELECT id, topic FROM main.tasks WHERE id = ?');
  const getVec = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?');

  // Кандидат, уже стоящий в листе или предложенный для другой задачи, не нужен.
  const seen = new Set([...taskIds, ...excludeIds]);
  const groups = [];
  let loadedTopics = 0;

  for (const id of taskIds) {
    const src = info.get(id);
    if (!src) { groups.push({ task_id: id, items: [] }); continue; }
    if (!sameTopicOnly || !src.topic) {
      const single = findSimilar({ taskId: id, limit, sameTopicOnly, minCos });
      const items = (single.items || []).filter((it) => !seen.has(it.task_id)).slice(0, limit);
      items.forEach((it) => seen.add(it.task_id));
      groups.push({ task_id: id, items });
      continue;
    }
    const cold = !_topicPools.has(`${src.topic}|`);
    if (cold && loadedTopics > 0 && loadedTopics % 3 === 0) await new Promise((r) => setImmediate(r));
    if (cold) loadedTopics++;
    const pool = loadTopicVectorsCached(d, src.topic, null);
    const self = pool.find((p) => p.id === id);
    const rawVec = self ? null : getVec.get(id);
    if (!self && !rawVec) { groups.push({ task_id: id, items: [] }); continue; }
    const srcVec = self ? self.vec : bufToF32(rawVec.embedding);

    const items = pool
      .filter((p) => p.id !== id && !seen.has(p.id))
      .map((p) => ({ p, cos: cosF32(srcVec, p.vec) }))
      .filter((x) => x.cos >= minCos)
      .sort((a, b) => b.cos - a.cos)
      .slice(0, limit)
      .map(({ p, cos }) => ({
        task_id: p.id, cos: Number(cos.toFixed(4)), pct: Math.round(toPct(cos)),
        code: p.code, topic: src.topic, statement: p.statement,
      }));
    items.forEach((it) => seen.add(it.task_id));
    groups.push({ task_id: id, items });
  }
  return { error: null, groups };
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
 * Пул кандидатов — ВСЯ тема позиции, а не top-k соседей: KNN в sqlite-vec это
 * полный скан индекса (~45 мс на 22k векторов независимо от k), поэтому на 20
 * позиций он стоил бы ~1 с, а полоса cos резала бы уже усечённую выдачу
 * (замер: при k=27 полоса «Разные» 0.70–0.90 давала пустой пул у 24% позиций
 * против 5% при полном пуле). Загрузка темы + косинусы в JS — десятки мс.
 *
 * @param {string[]} baseIds  - задачи базового варианта (по позициям)
 * @param {object} o
 * @param {number} [o.count=2]    - сколько ПАРАЛЛЕЛЬНЫХ вариантов (помимо базового)
 * @param {number} [o.minCos=0.85]
 * @param {number} [o.maxCos=0.995] - выше — это байт-в-байт дубль (те же числа), не нужен
 * @param {string[]} [o.excludeIds=[]] - не выдавать эти задачи (напр. другие варианты той же работы)
 * @param {object} [o.rejectPairs] - { [baseTaskId]: [taskId] } — пары, отвергнутые учителем вручную
 * @param {boolean} [o.structural=true] - требовать совпадения структурной подписи (форма ответа,
 *        объём условия, таблица/формулы/чертёж). Несовместимые уходят в хвост пула, а не в мусор.
 * @returns {{ base:[], variants:[[]], shortage:[] }}
 */
export async function buildParallelVariants(baseIds, { count = 2, minCos = 0.85, maxCos = 0.995, excludeIds = [], rejectPairs = null, structural = true } = {}) {
  const d = getDb();
  const getVec = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?');
  const cols = taskColumns(d);
  const info = d.prepare(`SELECT id, code, answer, topic, statement_md,
      ${cols.has('has_image') ? 'has_image' : 'NULL AS has_image'},
      ${cols.has('image') ? 'image' : 'NULL AS image'},
      ${cols.has('exam_part') ? 'exam_part' : 'NULL AS exam_part'}
    FROM main.tasks WHERE id = ?`);

  const baseSet = new Set(baseIds);
  // Исключения: сам образец, явно переданные (другие варианты работы) и
  // задачи, уже помеченные дублями образца в B2 — они не параллель, а тот же текст.
  const blocked = new Set([...baseIds, ...excludeIds, ...dedupTwinsOf(d, baseIds)]);
  const stats = loadTaskStats(d);
  const fmt = (id, cos, extra = {}) => {
    const r = info.get(id);
    const rate = rateOf(stats, id);
    return r ? { task_id: id, code: r.code, answer: r.answer, topic: r.topic,
      statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 160),
      ...(cos != null ? { cos: Number(cos.toFixed(4)) } : {}),
      ...(rate != null ? { solve_rate: Number(rate.toFixed(2)) } : {}), ...extra } : { task_id: id, missing: true };
  };

  // Кандидаты для каждой позиции: вся тема в полосе cos, отсортировано по cos ↓.
  // Задачи с тем же ответом, что у образца, идут в конец: в параллельном варианте
  // совпадающий ответ обесценивает защиту от списывания. Совсем не выбрасываем —
  // это лучше, чем «нет замены», но помечаем флагом same_answer для UI.
  // Вариант ЕГЭ — это 20 РАЗНЫХ тем, то есть до 20 загрузок пула по ~60 мс;
  // между темами отпускаем event loop, иначе на это время встаёт весь
  // backend-helper (/latex-fix, /scan-blank идут в том же процессе).
  const pools = [];
  let loadedTopics = 0;
  for (const id of baseIds) {
    const src = info.get(id);
    if (!src?.topic) { pools.push([]); continue; }
    const cold = !_topicPools.has(`${src.topic}|`);
    if (cold && loadedTopics > 0 && loadedTopics % 3 === 0) await new Promise((r) => setImmediate(r));
    if (cold) loadedTopics++;
    const pool = loadTopicVectorsCached(d, src.topic, null);
    // Вектор образца берём из пула его темы: точечный SELECT по vec_tasks — это
    // скан виртуальной таблицы (~25 мс), на 20 позициях он стоил бы полсекунды.
    const self = pool.find((p) => p.id === id);
    const row = self ? null : getVec.get(id);
    if (!self && !row) { pools.push([]); continue; }
    const srcVec = self ? self.vec : bufToF32(row.embedding);
    const srcAns = normalizeAnswer(src.answer);
    // Решаемость образца: параллель должна быть не только про то же, но и
    // сопоставимой трудности — иначе «эквивалентные» варианты не эквивалентны.
    const srcRate = rateOf(stats, id);
    // Пары, которые учитель уже отверг вручную именно для этой задачи.
    const rejected = rejectPairs?.[id] ? new Set(rejectPairs[id]) : null;
    // Структурная подпись образца: форма ответа, объём условия, таблица,
    // формулы, чертёж. Косинус один этого не различает (см. vec-lib).
    const srcSig = structural ? taskSignature({
      answer: src.answer, statement_md: src.statement_md,
      hasImage: hasFigure(src), examPart: src.exam_part,
    }) : null;

    const cands = [];
    const offSpec = []; // структурно иные — запасной пул, если основной пуст
    for (const p of pool) {
      if (p.id === id || blocked.has(p.id)) continue;
      if (rejected?.has(p.id)) continue;
      const cos = cosF32(srcVec, p.vec);
      if (cos < minCos || cos > maxCos) continue;
      const rate = rateOf(stats, p.id);
      // Отсекаем только при данных с обеих сторон: у большинства задач ответов
      // пока нет, и жёсткий фильтр обнулил бы пул.
      if (srcRate != null && rate != null && Math.abs(rate - srcRate) > RATE_TOLERANCE) continue;
      const sameAnswer = !!srcAns && isDiscriminativeAnswer(srcAns) && normalizeAnswer(p.answer) === srcAns;
      const cand = { id: p.id, cos, sameAnswer };
      if (srcSig && !signaturesCompatible(srcSig, p.sig)) offSpec.push({ ...cand, offSpec: true });
      else cands.push(cand);
    }
    const byFit = (a, b) => (a.sameAnswer === b.sameAnswer ? b.cos - a.cos : (a.sameAnswer ? 1 : -1));
    cands.sort(byFit);
    offSpec.sort(byFit);
    // Структурно иная замена всё же лучше пустой ячейки — держим их в хвосте.
    pools.push([...cands, ...offSpec]);
  }

  // Раздача по позициям, а не по вариантам. Прежний жадный проход «вариант за
  // вариантом» брал для варианта 1 всегда ближайшего кандидата, для варианта 2 —
  // следующего и т.д.: параллели получались неравноценными (первая ближе к
  // образцу), а повторное «Подобрать» давало ровно тот же результат.
  // Теперь на каждую позицию берём окно лучших кандидатов, тасуем его и
  // раздаём вариантам в случайном порядке — варианты равноценны, а прогоны разные.
  const { variants: picked, shortage: gaps } = distributeParallel(pools, count);
  const variants = picked.map((variant) => variant.map((pick, i) => (
    pick
      ? fmt(pick.id, pick.cos, {
        ...(pick.sameAnswer ? { same_answer: true } : {}),
        ...(pick.offSpec ? { off_spec: true } : {}),
      })
      : { position: i + 1, missing: true }
  )));
  const shortage = gaps.map((g) => ({ ...g, base: baseIds[g.position - 1] }));

  return { base: baseIds.map((id) => fmt(id, null)), variants, shortage, base_count: baseSet.size };
}

// Решаемость задач из внутренних ответов учеников — тем же readonly-соединением,
// что и задачи. Фронт считает это же для колонки «Успеваемость» (utils/successStats),
// но подбору параллелей нужны сырые доли на сервере, а не в браузере учителя.
// Один проход по attempt_answers (~десятки тысяч строк) с кэшем на 10 минут.
const TASK_STATS_TTL_MS = 10 * 60 * 1000;
let _taskStats = null; // { at, map: Map(taskId → {c, n}) }

function loadTaskStats(d) {
  if (_taskStats && Date.now() - _taskStats.at < TASK_STATS_TTL_MS) return _taskStats.map;
  const map = new Map();
  try {
    for (const r of d.prepare('SELECT task, is_correct FROM main.attempt_answers').iterate()) {
      if (!r.task) continue;
      const st = map.get(r.task) || { c: 0, n: 0 };
      st.n += 1;
      if (r.is_correct) st.c += 1;
      map.set(r.task, st);
    }
  } catch { /* коллекции нет — подбор работает без учёта решаемости */ }
  _taskStats = { at: Date.now(), map };
  return map;
}

// Ниже этого числа ответов доля слишком шумная, чтобы на неё опираться
// (та же граница, что LOW_CONFIDENCE_N на фронте).
const STATS_MIN_N = 5;
// Насколько кандидат может отличаться по решаемости от образца, когда данные
// есть у обоих. 0.3 = «лёгкая вместо трудной» отсекается, шум внутри уровня — нет.
const RATE_TOLERANCE = 0.3;

function rateOf(stats, id) {
  const st = stats.get(id);
  return st && st.n >= STATS_MIN_N ? st.c / st.n : null;
}

// Все задачи, лежащие с данными в одном dedup-кластере (B2) — это тот же текст,
// а не параллель. Пустой Set, если разметки нет.
function dedupTwinsOf(d, taskIds) {
  const out = new Set();
  if (!taskIds.length) return out;
  let stmt;
  try {
    stmt = d.prepare(`
      SELECT DISTINCT m2.task AS task
      FROM main.task_family_members m1
      JOIN main.task_families f ON f.id = m1.family AND f.type = 'dedup_cluster'
      JOIN main.task_family_members m2 ON m2.family = m1.family
      WHERE m1.task = ?`);
  } catch { return out; }
  for (const id of taskIds) {
    try { for (const r of stmt.all(id)) out.add(r.task); } catch { /* нет коллекции — не мешаем подбору */ }
  }
  return out;
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

// Пулы векторов по темам живут дольше одного запроса: чтение blob'ов темы стоит
// ~50-90 мс, а Генератор и модалка параллелей дёргают одни и те же темы подряд
// (смена пресета, «Подобрать» ещё раз, соседние режимы подбора).
// LRU с бюджетом по числу векторов, а не по числу тем: вариант ЕГЭ трогает 20 тем
// сразу, и лимит «N тем» вытеснял бы их на каждом прогоне. 12 000 векторов ×
// 4 КБ ≈ 48 МБ — потолок кэша.
const TOPIC_POOL_BUDGET = 12000;
const TOPIC_POOL_TTL_MS = 5 * 60 * 1000;
const _topicPools = new Map(); // `${topic}|${subtopic}` → { at, rows }
let _topicPoolSize = 0;

function clearTopicPools() { _topicPools.clear(); _topicPoolSize = 0; }

function loadTopicVectorsCached(d, topicId, subtopicId) {
  const key = `${topicId}|${subtopicId || ''}`;
  const hit = _topicPools.get(key);
  if (hit && Date.now() - hit.at < TOPIC_POOL_TTL_MS) {
    _topicPools.delete(key); _topicPools.set(key, hit); // освежаем позицию в LRU
    return hit.rows;
  }
  if (hit) { _topicPools.delete(key); _topicPoolSize -= hit.rows.length; } // протух
  const rows = loadTopicVectors(d, topicId, subtopicId);
  _topicPools.set(key, { at: Date.now(), rows });
  _topicPoolSize += rows.length;
  while (_topicPoolSize > TOPIC_POOL_BUDGET && _topicPools.size > 1) {
    const oldestKey = _topicPools.keys().next().value;
    _topicPoolSize -= _topicPools.get(oldestKey).rows.length;
    _topicPools.delete(oldestKey);
  }
  return rows;
}

// Какие необязательные колонки есть в tasks: has_image/image/exam_part заводились
// в разное время (часть — руками через админку), и на чужой копии БД их может
// не быть. Спрашиваем схему один раз, а не ловим исключение на каждом запросе.
let _taskColumns = null;
function taskColumns(d) {
  if (_taskColumns) return _taskColumns;
  try {
    _taskColumns = new Set(d.prepare('PRAGMA main.table_info(tasks)').all().map((r) => r.name));
  } catch {
    _taskColumns = new Set();
  }
  return _taskColumns;
}

// Загрузить все векторы темы (опц. подтемы) вместе с лёгкими полями задачи.
// subtopic в tasks — JSON-массив id → matching через LIKE.
// Полный текст условия в пул НЕ кладём (пулы кэшируются) — из него сразу
// считается структурная подпись, а наружу идёт только сниппет.
function loadTopicVectors(d, topicId, subtopicId) {
  const cols = taskColumns(d);
  const extra = [
    cols.has('has_image') ? 't.has_image AS has_image' : 'NULL AS has_image',
    cols.has('image') ? 't.image AS image' : 'NULL AS image',
    cols.has('exam_part') ? 't.exam_part AS exam_part' : 'NULL AS exam_part',
  ].join(', ');
  let sql = `
    SELECT v.task_id AS id, v.embedding AS embedding,
           t.code AS code, t.answer AS answer, t.statement_md AS statement_md, ${extra}
    FROM vdb.vec_tasks v JOIN main.tasks t ON t.id = v.task_id
    WHERE t.topic = ?`;
  const args = [topicId];
  if (subtopicId) { sql += ' AND t.subtopic LIKE ?'; args.push(`%"${subtopicId}"%`); }
  return d.prepare(sql).all(...args).map((r) => ({
    id: r.id, code: r.code, answer: r.answer,
    statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 200),
    sig: taskSignature({
      answer: r.answer,
      statement_md: r.statement_md,
      hasImage: hasFigure(r),
      examPart: r.exam_part,
    }),
    vec: bufToF32(r.embedding),
  }));
}

// Чертёж у задачи: свежие задачи держат файл в `image`, у части стоит флаг
// has_image, у импортированных картинка приходит markdown-ссылкой в условии.
function hasFigure(row) {
  if (row.has_image != null && row.has_image !== '') return !!row.has_image;
  if (row.image) return true;
  if (/!\[/.test(row.statement_md || '')) return true;
  return false;
}

// Ползунок «похожести» в UI линеен, а косинус — нет: внутри одной темы случайная
// пара задач даёт ≈0.70 (замер по 22k векторов), почти-клон ≈0.98. Поэтому
// положение ползунка маппим на ЦЕЛЕВОЙ косинус в этой полосе, а не на ранг в
// списке соседей: раньше левые 80% хода ничего не меняли (0% ползунка = cos 0.699,
// 50% = 0.762 — обе величины неотличимы от случайной задачи темы).
/**
 * «По образцу» — подобрать count задач вокруг эталона, регулируя один ползунок.
 * similarity ∈ [0,1]: 1 → самые близкие (клоны-тренажёр), 0 → «тот же раздел, другой сюжет».
 * @returns {{error, source_topic, items:[{task_id,cos,pct,code,statement}], target_cos}}
 */
export function selectBySeed({ taskId, count = 20, similarity = 0.5, sameTopicOnly = true, allowedIds = null }) {
  const d = getDb();
  const src = d.prepare('SELECT topic FROM main.tasks WHERE id = ?').get(taskId);
  const srcTopic = src?.topic || '';

  // Пул: вся тема (через кэш) — по ней ползунок ходит честно. Без фильтра темы
  // остаёмся на KNN, но с глубоким k, иначе полоса срежет всё.
  let pool = [];
  let srcVec = null;
  if (sameTopicOnly && srcTopic) {
    const rows = loadTopicVectorsCached(d, srcTopic, null);
    const self = rows.find((r) => r.id === taskId);
    if (!self) {
      const raw = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?').get(taskId);
      if (!raw) return { error: 'not_indexed', items: [] };
      srcVec = bufToF32(raw.embedding);
    } else {
      srcVec = self.vec;
    }
    pool = applyAllowed(rows, allowedIds)
      .filter((r) => r.id !== taskId)
      .map((r) => ({ task_id: r.id, cos: cosF32(srcVec, r.vec), code: r.code, statement: r.statement }));
  } else {
    const raw = d.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?').get(taskId);
    if (!raw) return { error: 'not_indexed', items: [] };
    const k = Math.max(count * 10 + 200, 400);
    const rows = d.prepare(`
      SELECT v.task_id AS task_id, v.distance AS distance,
             t.topic AS topic, t.code AS code, t.statement_md AS statement_md
      FROM vdb.vec_tasks v JOIN main.tasks t ON t.id = v.task_id
      WHERE v.embedding MATCH ? AND v.k = ?
      ORDER BY v.distance`).all(raw.embedding, k);
    const allowSet = allowedIds ? new Set(allowedIds) : null;
    pool = rows
      .filter((r) => r.task_id !== taskId && (!allowSet || allowSet.has(r.task_id)))
      .map((r) => ({ task_id: r.task_id, cos: 1 - r.distance, code: r.code,
        statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 200) }));
  }
  if (pool.length === 0) return { error: null, source_topic: srcTopic, items: [], target_cos: null };

  const targetCos = seedTargetCos(similarity);
  // Ближайшие к целевой похожести; при ползунке «в упор» это просто топ соседей.
  const items = pickByTargetCos(pool, targetCos, count)
    .map((r) => ({
      task_id: r.task_id, cos: Number(r.cos.toFixed(4)), pct: Math.round(toPct(r.cos)),
      code: r.code, statement: r.statement,
    }));
  return { error: null, source_topic: srcTopic, items, target_cos: Number(targetCos.toFixed(3)) };
}

/**
 * «Разные сюжеты» — максимально разнообразный набор внутри темы.
 * method='mmr' (жадный max-min) | 'clusters' (k-means → медоиды).
 * @returns {{error, items:[{task_id,code,answer,statement}], pool_size}}
 */
export function selectDiverse({ topicId, subtopicId = null, count = 20, method = 'mmr', allowedIds = null }) {
  const d = getDb();
  if (!topicId) return { error: 'no_topic', items: [], pool_size: 0 };
  const pool = applyAllowed(loadTopicVectorsCached(d, topicId, subtopicId), allowedIds);
  if (pool.length === 0) return { error: 'empty', items: [], pool_size: 0 };

  let picked;
  if (method === 'clusters') picked = kmeansMedoids(pool, count);
  else picked = mmrSelect(pool, count);

  const items = picked.map((p) => ({
    task_id: p.id, code: p.code, answer: p.answer, statement: p.statement,
  }));
  return { error: null, items, pool_size: pool.length };
}

/**
 * «Анти-дубль» — набор из темы, не похожий на задачи ранее выданной работы.
 * Оставляет кандидатов с maxSim(cand, avoid) ≤ maxCos, среди них — MMR до count.
 * @returns {{error, items:[...], pool_size, filtered_out}}
 */
export function selectNovelty({ topicId, subtopicId = null, count = 20, avoidTaskIds = [], maxCos = 0.85, allowedIds = null }) {
  const d = getDb();
  if (!topicId) return { error: 'no_topic', items: [], pool_size: 0, filtered_out: 0 };
  const avoid = new Set(avoidTaskIds);
  const pool = applyAllowed(loadTopicVectorsCached(d, topicId, subtopicId), allowedIds).filter((p) => !avoid.has(p.id));
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
 * Состояние индекса (v3.9.152) — чтобы фронт мог объяснить учителю, почему
 * «нет подходящей замены»: индекс отстал от каталога или задач просто нет.
 * Индексация ручная (vector-benchmark → npm run index), поэтому разрыв нормален.
 * @returns {{ indexed, tasks_total, missing, indexed_at, geometry_indexed }}
 */
const INDEX_STATS_TTL_MS = 60 * 1000;
let _indexStats = null;

export function getIndexStats() {
  if (_indexStats && Date.now() - _indexStats.at < INDEX_STATS_TTL_MS) return _indexStats.data;
  const d = getDb();
  const one = (sql) => { try { return d.prepare(sql).get(); } catch { return null; } };
  const all = (sql) => { try { return d.prepare(sql).all(); } catch { return []; } };
  const tasksTotal = one('SELECT count(*) c FROM main.tasks')?.c ?? 0;
  const indexedAt = one('SELECT max(indexed_at) m FROM vdb.vec_meta')?.m || null;
  const geometry = one('SELECT count(*) c FROM vdb.vec_geometry')?.c ?? 0;
  // Задачи каталога, которых нет в индексе. Через SQL-антиджойн нельзя: vec0 —
  // виртуальная таблица без индекса по task_id, и подзапрос на задачу выливается
  // в полный скан индекса на каждую (17k × 22k — минуты). Сверяем множества в JS.
  const vecIds = new Set(all('SELECT task_id FROM vdb.vec_tasks').map((r) => r.task_id));
  const taskIds = all('SELECT id FROM main.tasks').map((r) => r.id);
  const missing = taskIds.reduce((acc, id) => acc + (vecIds.has(id) ? 0 : 1), 0);
  const data = {
    indexed: vecIds.size, tasks_total: tasksTotal, missing, indexed_at: indexedAt,
    geometry_indexed: geometry,
  };
  _indexStats = { at: Date.now(), data };
  return data;
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
// Отдельная таблица в том же vec.db (та же размерность 1024, но модель ДРУГАЯ —
// text-embedding-3-large, см. блок NL-поиска ниже). Смыслы не смешиваем с
// банком tasks: другая сущность — другая выдача.

// Калибровка % для геометрии — под te3-large: у неё косинусы сжаты
// (замер 13.07.2026: почти-дубль ≈ 0.90, несвязанные ≈ 0.45-0.55).
const GEO_CAL_FLOOR = 0.50;
const GEO_CAL_CEIL = 0.90;
const toPctGeo = (cos) => Math.max(0, Math.min(100, ((cos - GEO_CAL_FLOOR) / (GEO_CAL_CEIL - GEO_CAL_FLOOR)) * 100));

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
      task_id: r.task_id, cos: Number(cos.toFixed(4)), pct: Math.round(toPctGeo(cos)),
      code: r.code, title: r.title || '', origin: rOrigin, source: r.source || '', statement: stmt,
    });
    if (out.length >= limit) break;
  }
  return { error: null, items: out };
}

/**
 * Дедуп «мои ↔ банк МЦНМО»: для каждой проиндексированной СВОЕЙ задачи — ближайшие
 * соседи из банка с cos ≥ minCos. Офлайн-кластеризация не нужна, НО ~190 KNN по
 * 17.8k векторов = ~20с синхронного better-sqlite3 → кэш результата (TTL) +
 * уступка event loop между пачками запросов, чтобы не вешать /latex-fix и /similar.
 * ⚠️ У банка в тексте эмбеддинга есть фасетные теги, у своих задач их нет → даже
 * точный текстовый дубль даёт cos заметно ниже 1.0. Порог по умолчанию мягче
 * дедупа банка tasks (там 0.93).
 */
const _geoDupCache = new Map(); // `${minCos}|${perTask}` → { at, data }
const GEO_DUP_TTL_MS = 10 * 60 * 1000;

export async function findGeometryBankDuplicates({ minCos = 0.82, perTask = 3 } = {}) {
  const cacheKey = `${minCos}|${perTask}`;
  const hit = _geoDupCache.get(cacheKey);
  if (hit && Date.now() - hit.at < GEO_DUP_TTL_MS) return hit.data;

  const d = getDb();
  if (!geoIndexReady(d)) return { error: 'no_index', pairs: [] };

  const MANUAL_WHERE = `(g.origin IS NULL OR g.origin = '' OR g.origin = 'manual')`;
  const manual = d.prepare(`
    SELECT v.task_id AS id, v.embedding AS embedding,
           g.code AS code, g.title AS title, g.answer AS answer, g.statement_md AS statement_md
    FROM vdb.vec_geometry v
    JOIN main.geometry_tasks g ON g.id = v.task_id
    WHERE ${MANUAL_WHERE}
  `).all();
  const knn = d.prepare(`
    SELECT v.task_id AS task_id, v.distance AS distance,
           g.code AS code, g.origin AS origin, g.answer AS answer, g.statement_md AS statement_md
    FROM vdb.vec_geometry v JOIN main.geometry_tasks g ON g.id = v.task_id
    WHERE v.embedding MATCH ? AND v.k = ? ORDER BY v.distance
  `);

  const normAns = (a) => String(a || '').replace(/\s+/g, '').replace(/,/g, '.').toLowerCase();
  const snip = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 240);

  const pairs = [];
  for (let i = 0; i < manual.length; i++) {
    // Каждый KNN ~100мс синхронно; раз в несколько запросов отпускаем event loop.
    if (i % 5 === 4) await new Promise((resolve) => setImmediate(resolve));
    const m = manual[i];
    let picked = 0;
    for (const r of knn.all(m.embedding, perTask * 5 + 15)) {
      if (r.task_id === m.id) continue;
      const cos = 1 - r.distance;
      if (cos < minCos) break; // KNN отсортирован по cos ↓ — дальше только хуже
      if (r.origin !== 'mccme') continue; // пары свои↔свои здесь не интересны
      pairs.push({
        cos: Number(cos.toFixed(4)), pct: Math.round(toPctGeo(cos)),
        answers_match: !!normAns(m.answer) && normAns(m.answer) === normAns(r.answer),
        mine: { id: m.id, code: m.code, title: m.title || '', answer: m.answer || '', statement: snip(m.statement_md) },
        bank: { id: r.task_id, code: r.code, answer: r.answer || '', statement: snip(r.statement_md) },
      });
      if (++picked >= perTask) break;
    }
  }
  pairs.sort((a, b) => b.cos - a.cos);

  const manualTotal = d.prepare(
    `SELECT count(*) c FROM main.geometry_tasks g WHERE ${MANUAL_WHERE}`
  ).get().c;
  const data = { error: null, pairs, manual_indexed: manual.length, manual_total: manualTotal };
  _geoDupCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export function indexGeometryVectors(rows) {
  _geoDupCache.clear(); // индекс меняется — кэш дедуп-пар устарел
  return indexVectorsInto('vec_geometry', 'vec_geometry_meta', rows);
}

export function pruneGeometryVectors(validIds) {
  _geoDupCache.clear();
  return pruneVectorsFrom('vec_geometry', 'vec_geometry_meta', validIds);
}

// === NL-поиск + серверная переиндексация геометрии (v3.9.125) ===============
// Эмбеддинги геометрии считаются через Timeweb AI Gateway
// (openai/text-embedding-3-large @ dimensions=1024 — та же размерность, что у
// bge-m3, схема vec_geometry не меняется). Сервер сам и индексирует, и
// эмбеддит поисковый запрос — Mac/Ollama для геометрии больше не нужны.
// ⚠️ Банк tasks (vec_tasks) остаётся на bge-m3/Mac — не смешивать.

const AI_BASE = (process.env.TIMEWEB_AI_URL || '').replace(/\/chat\/completions\/?$/, '');
const AI_KEY = process.env.TIMEWEB_AI_KEY || '';
const GEO_EMBED_MODEL = process.env.GEO_EMBED_MODEL || 'openai/text-embedding-3-large';

// ⚠️ ТОЛЬКО по одному тексту за запрос. Батч-ответы шлюза Timeweb приходят с
// БИТЫМ полем index (проверено 12.07.2026: input из 3 → индексы [0,1,1]) —
// раскладка по index теряет/путает вектора. Одиночный запрос перепутать нечем.
async function embedRemoteOne(text) {
  if (!AI_BASE || !AI_KEY) throw new Error('AI gateway не настроен (TIMEWEB_AI_URL/TIMEWEB_AI_KEY)');
  const res = await fetch(`${AI_BASE}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_KEY}` },
    body: JSON.stringify({ model: GEO_EMBED_MODEL, input: text, dimensions: DIM }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== DIM) {
    throw new Error(`embeddings: неожиданный ответ (dim=${vec?.length ?? 'нет'})`);
  }
  return vec;
}

// LRU-кэш эмбеддингов поисковых запросов (запрос короткий, но зачем платить дважды).
const _queryVecCache = new Map(); // normalized text → Buffer(Float32)
async function embedQueryCached(text) {
  const key = text.trim().toLowerCase();
  const hit = _queryVecCache.get(key);
  if (hit) { _queryVecCache.delete(key); _queryVecCache.set(key, hit); return hit; }
  const vec = await embedRemoteOne(text);
  const buf = Buffer.from(Float32Array.from(vec).buffer);
  _queryVecCache.set(key, buf);
  if (_queryVecCache.size > 300) _queryVecCache.delete(_queryVecCache.keys().next().value);
  return buf;
}

function geoIndexModel(d) {
  try { return d.prepare('SELECT model FROM vdb.vec_geometry_meta LIMIT 1').get()?.model || null; }
  catch { return null; }
}

/**
 * Поиск геометрических задач по запросу на естественном языке
 * («задача про биссектрису и вписанную окружность»).
 * Запрос эмбеддится ТОЙ ЖЕ моделью, что индекс — иначе отказ (model_mismatch).
 */
export async function searchGeometryByText({ query, limit = 12, origin = null, minCos = 0.2 }) {
  const q = String(query || '').trim();
  if (!q) return { error: 'empty_query', items: [] };
  const d = getDb();
  if (!geoIndexReady(d)) return { error: 'no_index', items: [] };
  const idxModel = geoIndexModel(d);
  if (idxModel && idxModel !== GEO_EMBED_MODEL) {
    return { error: 'index_model_mismatch', index_model: idxModel, expected: GEO_EMBED_MODEL, items: [] };
  }

  const qvec = await embedQueryCached(q);
  const k = Math.max(limit * 6, 60);
  const rows = d.prepare(`
    SELECT v.task_id AS task_id, v.distance AS distance,
           g.code AS code, g.title AS title, g.origin AS origin,
           g.source AS source, g.statement_md AS statement_md
    FROM vdb.vec_geometry v
    JOIN main.geometry_tasks g ON g.id = v.task_id
    WHERE v.embedding MATCH ? AND v.k = ?
    ORDER BY v.distance
  `).all(qvec, k);

  const out = [];
  for (const r of rows) {
    const rOrigin = r.origin === 'mccme' ? 'mccme' : 'manual';
    if (origin && rOrigin !== origin) continue;
    const cos = 1 - r.distance;
    if (cos < minCos) continue;
    out.push({
      task_id: r.task_id, cos: Number(cos.toFixed(4)),
      code: r.code, title: r.title || '', origin: rOrigin, source: r.source || '',
      statement: (r.statement_md || '').replace(/\s+/g, ' ').trim().slice(0, 240),
    });
    if (out.length >= limit) break;
  }
  return { error: null, model: GEO_EMBED_MODEL, items: out };
}

// --- Серверная переиндексация геометрии (фоновая job) -----------------------
// Текст эмбеддинга = тема + фасетные теги + заголовок + условие — семантика
// как у buildGeoText в vector-benchmark/2-embed.mjs (Mac-путь для геометрии
// выведен из эксплуатации, сервер — единственный владелец vec_geometry).

const GEO_TAG_KIND = { object: 'объекты', method: 'методы', fact: 'факты', named: 'теоремы', source: 'источник' };

// Упрощённый cleanLatex (порт vector-benchmark/lib/cleanLatex.mjs).
function cleanLatexForEmbed(input) {
  if (!input) return '';
  let s = String(input);
  s = s.replace(/\$\$?/g, ' ');
  s = s.replace(/\\[()[\]]/g, ' ');
  for (let i = 0; i < 3; i++) s = s.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, 'корень $1-й степени из ($2)');
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)');
  s = s.replace(/\^\s*\{([^{}]*)\}/g, '^$1');
  s = s.replace(/_\s*\{([^{}]*)\}/g, '_$1');
  const cmd = {
    '\\cdot': '*', '\\times': '*', '\\div': '/', '\\pm': '±', '\\mp': '∓',
    '\\leq': '<=', '\\le': '<=', '\\geq': '>=', '\\ge': '>=', '\\neq': '≠', '\\ne': '≠',
    '\\approx': '≈', '\\infty': '∞', '\\pi': 'пи', '\\alpha': 'альфа', '\\beta': 'бета',
    '\\gamma': 'гамма', '\\theta': 'тета', '\\angle': 'угол', '\\triangle': 'треугольник',
    '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tg', '\\tg': 'tg', '\\cot': 'ctg', '\\ctg': 'ctg',
    '\\log': 'log', '\\ln': 'ln', '\\lg': 'lg', '\\sum': 'сумма', '\\int': 'интеграл',
    '\\to': '→', '\\rightarrow': '→', '\\Rightarrow': '⇒', '\\in': 'принадлежит',
    '\\cup': 'объединение', '\\cap': 'пересечение', '\\varnothing': 'пустое множество',
    '\\left': '', '\\right': '', '\\,': ' ', '\\;': ' ', '\\!': '', '\\quad': ' ', '\\qquad': ' ',
  };
  for (const [k, v] of Object.entries(cmd)) s = s.split(k).join(` ${v} `);
  s = s.replace(/\\([a-zA-Z]+)/g, '$1');
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/[{}]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function buildGeoTextRow(row, tagsById) {
  const parts = [];
  if (row.topic_title) parts.push(`Тема: ${row.topic_title}.`);
  let tagIds = [];
  try { tagIds = JSON.parse(row.tags_json || '[]'); } catch { tagIds = []; }
  if (!Array.isArray(tagIds)) tagIds = tagIds ? [tagIds] : [];
  if (tagIds.length) {
    const byKind = {};
    for (const id of tagIds) {
      const t = tagsById.get(id);
      if (t?.name) (byKind[t.kind] ||= []).push(t.name);
    }
    const s = Object.entries(byKind)
      .map(([k, names]) => `${GEO_TAG_KIND[k] || k}: ${names.join(', ')}`)
      .join('; ');
    if (s) parts.push(`Теги — ${s}.`);
  }
  if (row.title) parts.push(row.title);
  const body = cleanLatexForEmbed(row.statement_md);
  if (body) parts.push(body);
  return parts.join('\n').trim();
}

const _geoReindex = {
  running: false, phase: null, done: 0, total: 0, skipped: 0, skipped_short: 0,
  failed: 0, pruned: 0, total_vectors: 0, started_at: null, finished_at: null, error: null,
};
export function geoReindexStatus() { return { ..._geoReindex, model: GEO_EMBED_MODEL }; }

/**
 * Запустить фоновую переиндексацию геометрии (эмбеддинги через AI gateway).
 * Инкрементальная: пропускает задачи с совпавшим text_hash И моделью.
 * full=true — пересчитать всё. Возвращает сразу; прогресс — geoReindexStatus().
 */
export function reindexGeometry({ full = false } = {}) {
  if (_geoReindex.running) return { started: false, reason: 'already_running', status: geoReindexStatus() };
  if (!AI_BASE || !AI_KEY) return { started: false, reason: 'ai_not_configured' };
  Object.assign(_geoReindex, {
    running: true, phase: 'read', done: 0, total: 0, skipped: 0, skipped_short: 0,
    failed: 0, pruned: 0, total_vectors: 0, started_at: new Date().toISOString(), finished_at: null, error: null,
  });

  (async () => {
    try {
      const d = getDb();
      const tagsById = new Map(
        d.prepare('SELECT id, kind, name FROM main.geometry_tags').all().map((t) => [t.id, t])
      );
      const rows = d.prepare(`
        SELECT g.id, g.title, g.statement_md, g.tags AS tags_json, t.title AS topic_title
        FROM main.geometry_tasks g
        LEFT JOIN main.geometry_topics t ON t.id = g.topic
      `).all();

      // Мета для инкремента — отдельным ro-соединением (attach инвалидируется записями).
      let meta = new Map();
      try {
        const mr = new Database(VEC_DB, { readonly: true, fileMustExist: true });
        try {
          meta = new Map(mr.prepare('SELECT task_id, text_hash, model FROM vec_geometry_meta').all()
            .map((r) => [r.task_id, r]));
        } finally { mr.close(); }
      } catch { /* таблицы ещё нет */ }

      const items = [];
      const validIds = [];
      for (const r of rows) {
        const text = buildGeoTextRow(r, tagsById);
        const signal = text.split('\n').filter((l) => !l.startsWith('Тема:')).join(' ').trim();
        if (signal.length < 30) { _geoReindex.skipped_short++; continue; }
        validIds.push(r.id);
        const hash = crypto.createHash('sha256').update(text).digest('hex');
        const m = meta.get(r.id);
        if (!full && m && m.text_hash === hash && m.model === GEO_EMBED_MODEL) { _geoReindex.skipped++; continue; }
        items.push({ id: r.id, text, hash });
      }
      _geoReindex.total = items.length;
      _geoReindex.phase = 'embed';

      // Эмбеддим ПО ОДНОЙ задаче (батчи шлюза с битым index — см. embedRemoteOne),
      // но CONC параллельных запросов; пишем в vec.db пачками по мере готовности.
      // Единичный отказ не валит прогон — задача идёт в failed и доедет
      // следующим инкрементом (text_hash в мета не записывается).
      const CONC = 8;
      const FLUSH_AT = 64;
      let cursor = 0;
      let pending = [];
      const flush = () => {
        if (!pending.length) return;
        const chunk = pending;
        pending = [];
        indexVectorsInto('vec_geometry', 'vec_geometry_meta', chunk);
      };
      const worker = async () => {
        for (;;) {
          const i = cursor++;
          if (i >= items.length) return;
          const it = items[i];
          let vec = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try { vec = await embedRemoteOne(it.text); break; }
            catch (e) {
              if (attempt >= 3) console.warn(`[geo-reindex] пропуск ${it.id}: ${e.message}`);
              else await new Promise((r) => setTimeout(r, 1500 * attempt));
            }
          }
          if (vec) {
            pending.push({ task_id: it.id, vec, text_hash: it.hash, model: GEO_EMBED_MODEL });
            if (pending.length >= FLUSH_AT) flush();
          } else {
            _geoReindex.failed++;
          }
          _geoReindex.done++;
        }
      };
      await Promise.all(Array.from({ length: CONC }, worker));
      flush();

      _geoReindex.phase = 'prune';
      const pr = pruneVectorsFrom('vec_geometry', 'vec_geometry_meta', validIds);
      _geoReindex.pruned = pr.pruned;
      _geoReindex.total_vectors = pr.total;
      _geoReindex.phase = 'done';
      console.log(`[geo-reindex] готово: ${_geoReindex.done - _geoReindex.failed} посчитано, `
        + `${_geoReindex.failed} с ошибками, ${_geoReindex.skipped} пропущено, всего ${pr.total}`);
    } catch (e) {
      _geoReindex.error = e.message;
      _geoReindex.phase = 'error';
      console.error('[geo-reindex]', e.message);
    } finally {
      _geoReindex.running = false;
      _geoReindex.finished_at = new Date().toISOString();
      _geoDupCache.clear();
      _queryVecCache.clear();
    }
  })();

  return { started: true };
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
