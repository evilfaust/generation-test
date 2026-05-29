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

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const DATA_DB = process.env.PB_DATA_DB || '/opt/pocketbase/pb_data/data.db';
const VEC_DB = process.env.VEC_DB || '/opt/pocketbase/pdf-service/vec.db';

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
    out.push({ task_id: r.task_id, cos: Number(cos.toFixed(4)), pct: Math.round(toPct(cos)), code: r.code, topic: r.topic });
    if (out.length >= limit) break;
  }
  return { error: null, source_topic: srcTopic, items: out };
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
