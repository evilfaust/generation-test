// B2 — прогон дедупа по всей базе.
// Для каждой задачи ищет соседей с cos>=THRESHOLD (внутри темы),
// кластеризует (union-find) и классифицирует кластеры:
//   - «точные дубли»  — у всех членов совпадает ответ;
//   - «параметрическое семейство» — ответы разные (тот же шаблон, другие числа).
//
//   node dedup-scan.mjs                 # отчёт в консоль + data/dedup-report.json
//   THRESHOLD=0.95 node dedup-scan.mjs  # строже
//
// Только ЧТЕНИЕ: vec.db + data.db (readonly). Ничего не пишет в боевую БД.

import fs from 'node:fs';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const VEC_DB = process.env.VEC_DB || new URL('./data/vec.db', import.meta.url).pathname;
const DATA_DB = process.env.DATA_DB || '/tmp/dedup/data.db';
const THRESHOLD = Number(process.env.THRESHOLD || 0.93);
const K = Number(process.env.K || 10);
const REPORT = new URL('./data/dedup-report.json', import.meta.url).pathname;

// --- union-find ---
const parent = new Map();
function find(x) { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; }
function union(a, b) { parent.set(find(a), find(b)); }

function normAnswer(a) { return (a || '').replace(/\s+/g, '').replace(',', '.').toLowerCase(); }

// Ответ-заглушка не подтверждает дублирование: «доказать», «а) б)», пустой и т.п.
// Только дискриминативный (обычно числовой/формульный уникальный) ответ — сигнал.
function isDiscriminative(ans) {
  const a = normAnswer(ans);
  if (!a) return false;
  if (a === 'доказать' || a === 'докажите') return false;
  if (/^[абвгдеж)(,;.\s]+$/.test(a)) return false; // только буквы пунктов/скобки
  return true;
}

async function main() {
  const db = new Database(DATA_DB, { readonly: true });
  sqliteVec.load(db);
  db.exec(`ATTACH DATABASE '${VEC_DB}' AS vdb;`);

  const ids = db.prepare('SELECT task_id FROM vdb.vec_tasks').all().map((r) => r.task_id);
  console.log(`Сканирую ${ids.length} задач, порог cos>=${THRESHOLD}, k=${K}...`);
  for (const id of ids) parent.set(id, id);

  // тема каждой задачи (дубли ищем внутри темы)
  const topicOf = new Map();
  for (const r of db.prepare('SELECT id, topic FROM main.tasks').all()) topicOf.set(r.id, r.topic || '');

  const getVec = db.prepare('SELECT embedding FROM vdb.vec_tasks WHERE task_id = ?');
  const knn = db.prepare('SELECT task_id, distance FROM vdb.vec_tasks WHERE embedding MATCH ? AND k = ? ORDER BY distance');

  let pairs = 0;
  const cosHist = { '0.85-0.90': 0, '0.90-0.95': 0, '0.95-0.99': 0, '0.99-1.0': 0 };
  const t0 = Date.now();
  let n = 0;
  for (const id of ids) {
    const row = getVec.get(id);
    const neighbors = knn.all(row.embedding, K + 1);
    for (const nb of neighbors) {
      if (nb.task_id === id) continue;
      const cos = 1 - nb.distance;
      if (cos >= 0.85) {
        if (cos < 0.90) cosHist['0.85-0.90']++;
        else if (cos < 0.95) cosHist['0.90-0.95']++;
        else if (cos < 0.99) cosHist['0.95-0.99']++;
        else cosHist['0.99-1.0']++;
      }
      if (cos < THRESHOLD) continue;
      if (topicOf.get(id) !== topicOf.get(nb.task_id)) continue; // только внутри темы
      union(id, nb.task_id);
      pairs++;
    }
    if (++n % 1000 === 0) process.stdout.write(`\r  ${n}/${ids.length}`);
  }
  console.log(`\r  ${ids.length}/${ids.length}  (${((Date.now() - t0) / 1000).toFixed(0)}с)`);

  // собрать кластеры
  const clusters = new Map();
  for (const id of ids) {
    const root = find(id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(id);
  }
  const multi = [...clusters.values()].filter((c) => c.length >= 2);

  // обогатить + классифицировать
  const info = db.prepare('SELECT id, code, answer, statement_md, topic FROM main.tasks WHERE id = ?');
  const report = [];
  let exactDup = 0, paramFam = 0, exactTaskCount = 0;
  for (const members of multi) {
    const rows = members.map((id) => info.get(id)).filter(Boolean);
    const answers = new Set(rows.map((r) => normAnswer(r.answer)).filter((a) => a !== ''));
    // Точный дубль только если общий ответ ОДИН и он дискриминативный (не заглушка).
    const allSameAnswer = answers.size === 1 && rows.every((r) => isDiscriminative(r.answer));
    const type = allSameAnswer ? 'exact_dup' : 'param_family';
    if (type === 'exact_dup') { exactDup++; exactTaskCount += rows.length; } else paramFam++;
    report.push({
      type,
      size: rows.length,
      topic: rows[0]?.topic,
      members: rows.map((r) => ({ id: r.id, code: r.code, answer: r.answer, statement: (r.statement_md || '').replace(/\s+/g, ' ').slice(0, 90) })),
    });
  }
  report.sort((a, b) => b.size - a.size);

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

  console.log('\n═══ РАСПРЕДЕЛЕНИЕ КОСИНУСА ПАР (top-k соседи) ═══');
  for (const [k, v] of Object.entries(cosHist)) console.log(`  ${k}: ${v}`);

  console.log('\n═══ ИТОГ ═══');
  console.log(`  Кластеров (≥2 задачи): ${multi.length}`);
  console.log(`  • Точные дубли (одинаковый ответ): ${exactDup} кластеров, ${exactTaskCount} задач`);
  console.log(`  • Параметрические семейства (разные ответы): ${paramFam} кластеров`);
  console.log(`  Отчёт: ${REPORT}`);

  console.log('\n═══ ТОП-8 КРУПНЫХ КЛАСТЕРОВ ═══');
  for (const c of report.slice(0, 8)) {
    console.log(`\n[${c.type === 'exact_dup' ? 'ТОЧНЫЙ ДУБЛЬ' : 'параметрич.'}] ${c.size} задач (тема ${c.topic}):`);
    for (const m of c.members.slice(0, 4)) console.log(`   ${m.code} (ответ: ${m.answer || '—'}) ${m.statement}`);
    if (c.members.length > 4) console.log(`   … ещё ${c.members.length - 4}`);
  }
  db.close();
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
