// Шаг 3: генерим пары на ручную разметку.
// Стратегия: для каждой задачи берём ближайшего соседа (top-1 cosine),
// затем стратифицируем по диапазону косинуса (от высокого к низкому) +
// добавляем случайные пары как заведомые "не похожи". Это даёт и порог,
// и калибровку шкалы процента.
// Результат → data/pairs-to-label.csv (колонку label заполняешь руками: 1=похожа, 0=нет).

import fs from 'node:fs';
import { F_TASKS, F_VECTORS, F_PAIRS, PAIRS_TO_LABEL } from './lib/config.mjs';
import { buildText } from './2-embed.mjs';

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function csvCell(s) {
  const v = String(s ?? '').replace(/\s+/g, ' ').trim();
  return `"${v.replace(/"/g, '""')}"`;
}

async function main() {
  const tasks = JSON.parse(fs.readFileSync(F_TASKS, 'utf8'));
  const vectors = JSON.parse(fs.readFileSync(F_VECTORS, 'utf8'));
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const vById = Object.fromEntries(vectors.map((v) => [v.id, v.vec]));
  const ids = vectors.map((v) => v.id);
  console.log(`Считаю ближайших соседей для ${ids.length} задач (O(n²) перебор)...`);

  // top-1 сосед для каждой задачи
  const nn = [];
  for (let i = 0; i < ids.length; i++) {
    let best = -1, bestJ = -1;
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      const c = cosine(vById[ids[i]], vById[ids[j]]);
      if (c > best) { best = c; bestJ = j; }
    }
    nn.push({ a: ids[i], b: ids[bestJ], cos: best });
    if (i % 100 === 0) process.stdout.write(`\r  ${i}/${ids.length}`);
  }
  console.log();

  // дедуп симметричных пар (a,b)==(b,a)
  const seen = new Set();
  const uniq = nn.filter((p) => {
    const k = [p.a, p.b].sort().join('|');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  uniq.sort((x, y) => y.cos - x.cos);

  // Стратификация по бинам косинуса → ровный спред для калибровки
  const min = uniq[uniq.length - 1].cos, max = uniq[0].cos;
  const BINS = 9;
  const perBin = Math.ceil((PAIRS_TO_LABEL * 0.8) / BINS);
  const picked = [];
  for (let b = 0; b < BINS; b++) {
    const lo = min + ((max - min) * b) / BINS;
    const hi = min + ((max - min) * (b + 1)) / BINS;
    const inBin = uniq.filter((p) => p.cos >= lo && p.cos < hi);
    // случайная выборка из бина
    for (let k = 0; k < Math.min(perBin, inBin.length); k++) {
      picked.push(inBin[Math.floor(Math.random() * inBin.length)]);
    }
  }

  // + случайные пары (заведомо разные) как негативный контроль
  const randCount = PAIRS_TO_LABEL - picked.length;
  for (let k = 0; k < randCount; k++) {
    const a = ids[Math.floor(Math.random() * ids.length)];
    let b = ids[Math.floor(Math.random() * ids.length)];
    while (b === a) b = ids[Math.floor(Math.random() * ids.length)];
    picked.push({ a, b, cos: cosine(vById[a], vById[b]) });
  }

  // дедуп и перемешать, чтобы разметка была "вслепую"
  const fseen = new Set();
  const final = picked.filter((p) => {
    const k = [p.a, p.b].sort().join('|');
    if (fseen.has(k)) return false; fseen.add(k); return true;
  });
  for (let i = final.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [final[i], final[j]] = [final[j], final[i]];
  }

  // CSV: label пустой — заполняешь руками
  const head = ['label', 'cosine', 'code_a', 'topic_a', 'text_a', 'code_b', 'topic_b', 'text_b', 'id_a', 'id_b'];
  const rows = [head.join(',')];
  for (const p of final) {
    const ta = byId[p.a], tb = byId[p.b];
    rows.push([
      '', // label — оставь пустым, проставь 1/0
      p.cos.toFixed(4),
      csvCell(ta.code), csvCell(ta.topic_title), csvCell(buildText(ta).slice(0, 400)),
      csvCell(tb.code), csvCell(tb.topic_title), csvCell(buildText(tb).slice(0, 400)),
      ta.id, tb.id,
    ].join(','));
  }
  fs.writeFileSync(F_PAIRS, rows.join('\n'));
  console.log(`✅ ${final.length} пар → ${F_PAIRS}`);
  console.log(`   Диапазон косинуса: ${min.toFixed(3)} … ${max.toFixed(3)}`);
  console.log(`\n👉 Открой CSV, в колонке label проставь 1 (похожа) или 0 (нет).`);
  console.log(`   Сохрани как data/pairs-labeled.csv и запусти: node 4-metrics.mjs`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
