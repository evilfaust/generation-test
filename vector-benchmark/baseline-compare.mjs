/**
 * baseline-compare.mjs — какой ДЕШЁВЫЙ (без вектора) оценщик сложности лучший.
 * LOO по якорям (attempt_answers + ext_journal). Сравнивает иерархические
 * средние: global / topic / (topic,difficulty) / subtopic / (subtopic,difficulty),
 * каждое с leave-one-out и усадкой к родителю. Только чтение JSON.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

// якоря
const evid = new Map();
const bump = (id, c, n) => { if (!id) return; const e = evid.get(id) || { c: 0, n: 0 }; e.c += c; e.n += n; evid.set(id, e); };
for (const r of rd('anchors_internal.json')) bump(r.task, r.c, r.n);
for (const r of rd('anchors_external.json')) bump(r.id, r.c, r.n);

const meta = new Map();
for (const r of rd('task_meta.json')) {
  let sub = 'none';
  try { const a = JSON.parse(r.subtopic || '[]'); if (Array.isArray(a) && a.length) sub = a[0]; } catch { /* */ }
  meta.set(r.id, { topic: r.topic || 'none', diff: r.difficulty || 0, sub });
}

const MIN_N = Number(process.env.MIN_N || 5);
const anchors = [];
for (const [id, e] of evid) {
  if (e.n < MIN_N) continue;
  const m = meta.get(id); if (!m) continue;
  anchors.push({ id, rate: e.c / e.n, ...m });
}

// агрегаты по уровням (по якорям)
const agg = (keyFn) => {
  const m = new Map();
  for (const a of anchors) { const k = keyFn(a); const o = m.get(k) || { s: 0, c: 0 }; o.s += a.rate; o.c += 1; m.set(k, o); }
  return m;
};
const gTopic = agg((a) => a.topic);
const gTopicDiff = agg((a) => a.topic + '|' + a.diff);
const gSub = agg((a) => a.sub);
const gSubDiff = agg((a) => a.sub + '|' + a.diff);
const globalMean = anchors.reduce((s, a) => s + a.rate, 0) / anchors.length;

// leave-one-out среднее по бакету: (s - rate)/(c - 1), иначе null
const looMean = (g, k, rate) => { const o = g.get(k); if (!o || o.c <= 1) return null; return (o.s - rate) / (o.c - 1); };

// усадка к родителю: (looSum*n + ALPHA*parent)/(n+ALPHA); n = размер бакета-1
const ALPHA = Number(process.env.ALPHA || 4);
const shrink = (g, k, rate, parent) => {
  const o = g.get(k); if (!o) return parent;
  const n = o.c - 1; if (n <= 0) return parent;
  const loo = (o.s - rate) / n;
  return (loo * n + ALPHA * parent) / (n + ALPHA);
};

let n = 0;
const mae = { global: 0, topic: 0, topicDiff: 0, sub: 0, subDiff: 0, hierShrink: 0 };
for (const a of anchors) {
  n += 1;
  const tm = looMean(gTopic, a.topic, a.rate) ?? globalMean;
  const tdm = looMean(gTopicDiff, a.topic + '|' + a.diff, a.rate) ?? tm;
  const sm = looMean(gSub, a.sub, a.rate) ?? tm;
  const sdm = looMean(gSubDiff, a.sub + '|' + a.diff, a.rate) ?? tdm;
  // иерархия с усадкой: global → topic → topic,diff → sub,diff
  let h = globalMean;
  h = shrink(gTopic, a.topic, a.rate, h);
  h = shrink(gTopicDiff, a.topic + '|' + a.diff, a.rate, h);
  if (a.sub !== 'none') h = shrink(gSubDiff, a.sub + '|' + a.diff, a.rate, h);
  mae.global += Math.abs(globalMean - a.rate);
  mae.topic += Math.abs(tm - a.rate);
  mae.topicDiff += Math.abs(tdm - a.rate);
  mae.sub += Math.abs(sm - a.rate);
  mae.subDiff += Math.abs(sdm - a.rate);
  mae.hierShrink += Math.abs(h - a.rate);
}

console.log(`=== Базлайны сложности (LOO, MIN_N=${MIN_N}, ALPHA=${ALPHA}) ===`);
console.log(`Якорей: ${anchors.length}`);
const p = (x) => (x / n * 100).toFixed(2);
console.log(`MAE global:            ${p(mae.global)} п.п.`);
console.log(`MAE topic:             ${p(mae.topic)} п.п.`);
console.log(`MAE topic×difficulty:  ${p(mae.topicDiff)} п.п.`);
console.log(`MAE subtopic:          ${p(mae.sub)} п.п.`);
console.log(`MAE subtopic×diff:     ${p(mae.subDiff)} п.п.`);
console.log(`MAE иерархия+усадка:   ${p(mae.hierShrink)} п.п.  ← рекомендуемый`);
