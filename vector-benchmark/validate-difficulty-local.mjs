/**
 * validate-difficulty-local.mjs — локальная LOO-валидация Слоя C.
 *
 * Читает локальную vec.db + JSON-якоря (выгружены с прода read-only):
 *   data/anchors_internal.json  [{task,c,n}]   — attempt_answers
 *   data/anchors_external.json  [{id,c,n}]      — ext_journal по sdamgia_id (без пустых)
 *   data/task_topics.json       [{id,topic}]
 * Считает MAE векторного переноса vs базлайны (среднее темы / глобальное).
 * Ничего не пишет.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, 'data');
const VEC_DB = path.join(DATA, 'vec.db');

const MIN_N = Number(process.env.MIN_N || 5);
const K = Number(process.env.K || 8);
const POOL = Number(process.env.POOL || 200);
const MIN_COS = Number(process.env.MIN_COS || 0.5);

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

const db = new Database(VEC_DB, { readonly: true, fileMustExist: true });
sqliteVec.load(db);

// ---- якоря ----
const evid = new Map();
const bump = (id, c, n) => {
  if (!id) return;
  const e = evid.get(id) || { c: 0, n: 0 };
  e.c += c; e.n += n; evid.set(id, e);
};
for (const r of readJson('anchors_internal.json')) bump(r.task, r.c, r.n);
for (const r of readJson('anchors_external.json')) bump(r.id, r.c, r.n);

const topicOf = new Map(readJson('task_topics.json').map((r) => [r.id, r.topic]));
const hasVec = db.prepare('SELECT 1 FROM vec_tasks WHERE task_id = ?');

const anchors = [];
for (const [id, e] of evid) {
  if (e.n >= MIN_N && hasVec.get(id)) anchors.push({ id, rate: e.c / e.n, topic: topicOf.get(id) });
}
const anchorRate = new Map(anchors.map((a) => [a.id, a.rate]));
const globalMean = anchors.reduce((s, a) => s + a.rate, 0) / anchors.length;
const topicSum = new Map();
for (const a of anchors) {
  const t = topicSum.get(a.topic) || { s: 0, c: 0 };
  t.s += a.rate; t.c += 1; topicSum.set(a.topic, t);
}
// Leave-one-out среднее по теме (исключаем саму задачу) — честный базлайн.
const topicMeanLoo = (topic, rate) => {
  const t = topicSum.get(topic);
  return t && t.c > 1 ? (t.s - rate) / (t.c - 1) : globalMean;
};

// ---- kNN-перенос ----
const getVec = db.prepare('SELECT embedding FROM vec_tasks WHERE task_id = ?');
const knn = db.prepare('SELECT task_id, distance FROM vec_tasks WHERE embedding MATCH ? AND k = ? ORDER BY distance');

const SAME_TOPIC = process.env.SAME_TOPIC === '1';
function predict(id, sameTopic = SAME_TOPIC) {
  const row = getVec.get(id);
  if (!row) return null;
  const cands = knn.all(row.embedding, POOL);
  const picked = [];
  for (const c of cands) {
    if (c.task_id === id) continue;
    const ar = anchorRate.get(c.task_id);
    if (ar === undefined) continue;
    if (sameTopic && topicOf.get(c.task_id) !== topicOf.get(id)) continue;
    const cos = 1 - c.distance;
    if (cos < MIN_COS) continue;
    picked.push({ rate: ar, cos });
    if (picked.length >= K) break;
  }
  if (!picked.length) return null;
  let ws = 0, w = 0;
  for (const p of picked) { ws += p.cos * p.rate; w += p.cos; }
  return { pred: ws / w, used: picked.length, w };
}
const ALPHA = Number(process.env.ALPHA || 2); // сила усадки к среднему темы

// ---- метрики LOO ----
let nEval = 0, noNbr = 0, maeVec = 0, maeTopic = 0, maeGlobal = 0, maeHybrid = 0, full = 0;
for (const a of anchors) {
  const tm = topicMeanLoo(a.topic, a.rate);
  const p = predict(a.id);
  maeTopic += Math.abs(tm - a.rate);     // базлайн считаем на всех (даже без соседей)
  maeGlobal += Math.abs(globalMean - a.rate);
  if (!p) { noNbr += 1; nEval += 1; maeVec += Math.abs(tm - a.rate); maeHybrid += Math.abs(tm - a.rate); continue; }
  nEval += 1;
  maeVec += Math.abs(p.pred - a.rate);
  const hybrid = (p.w * p.pred + ALPHA * tm) / (p.w + ALPHA);
  maeHybrid += Math.abs(hybrid - a.rate);
  if (p.used >= K) full += 1;
}

// ---- охват каталога (выборка; SAMPLE=0 — пропустить) ----
const allIds = db.prepare('SELECT task_id FROM vec_tasks').all().map((r) => r.task_id);
const nonAnchors = allIds.filter((id) => !anchorRate.has(id));
const SAMPLE = Number(process.env.SAMPLE ?? 1500);
let catTotal = 0, catEst = 0;
if (SAMPLE > 0) {
  const step = Math.max(1, Math.floor(nonAnchors.length / SAMPLE));
  for (let i = 0; i < nonAnchors.length; i += step) {
    catTotal += 1;
    if (predict(nonAnchors[i])) catEst += 1;
  }
}

console.log('=== Слой C: LOO-валидация (локально) ===');
console.log(`Параметры: MIN_N=${MIN_N} K=${K} POOL=${POOL} MIN_COS=${MIN_COS}`);
console.log(`Векторов в vec.db: ${allIds.length} | якорей: ${anchors.length} | глоб. среднее: ${(globalMean * 100).toFixed(1)}%`);
console.log('');
console.log(`Оценено LOO: ${nEval} | без соседей-якорей: ${noNbr} | с полным k=${K}: ${full}`);
console.log(`SAME_TOPIC=${SAME_TOPIC ? 1 : 0} ALPHA=${ALPHA}`);
console.log(`MAE вектор:           ${(maeVec / nEval * 100).toFixed(2)} п.п.`);
console.log(`MAE гибрид(усадка):   ${(maeHybrid / nEval * 100).toFixed(2)} п.п.`);
console.log(`MAE среднее темы:     ${(maeTopic / nEval * 100).toFixed(2)} п.п.`);
console.log(`MAE глоб. среднее:    ${(maeGlobal / nEval * 100).toFixed(2)} п.п.`);
if (SAMPLE > 0) {
  console.log('');
  console.log(`Не-якорей: ${nonAnchors.length} | охват (выборка ${catTotal}): ${(catEst / catTotal * 100).toFixed(1)}%`);
}

db.close();
