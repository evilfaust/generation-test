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

let db = null;
let openError = null;

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

  // task_id уже размеченных дублей (в data.db через ATTACH main)
  const reviewed = new Set(
    d.prepare(`SELECT DISTINCT m.task AS t FROM main.task_family_members m
               JOIN main.task_families f ON f.id = m.family
               WHERE f.type = 'dedup_cluster'`).all().map((r) => r.t)
  );

  const pending = all.filter((c) => !c.ids.some((id) => reviewed.has(id)));
  const total = pending.length;
  const start = (page - 1) * perPage;
  const slice = pending.slice(start, start + perPage);

  const info = d.prepare('SELECT id, code, answer, statement_md, topic FROM main.tasks WHERE id = ?');
  const items = slice.map((c) => ({
    type: c.type,
    size: c.ids.length,
    members: c.ids.map((id) => {
      const r = info.get(id);
      return r ? { id: r.id, code: r.code, answer: r.answer, topic: r.topic,
        statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 240) } : { id, missing: true };
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

export function vecHealth() {
  try {
    const d = getDb();
    const n = d.prepare('SELECT count(*) c FROM vdb.vec_tasks').get().c;
    return { ok: true, vectors: n, data_db: DATA_DB, vec_db: VEC_DB };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
