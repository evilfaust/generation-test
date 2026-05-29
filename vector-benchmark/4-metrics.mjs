// Шаг 4: по размеченному CSV считаем метрики и предлагаем порог + калибровку.
// Вход: data/pairs-labeled.csv (колонка label заполнена 1/0).

import fs from 'node:fs';
import { F_LABELED } from './lib/config.mjs';

function parseCsv(text) {
  // авто-определение разделителя: Excel/Numbers в RU-локали сохраняют через ';'
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  // простой парсер с поддержкой кавычек
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function main() {
  if (!fs.existsSync(F_LABELED)) {
    console.error(`❌ Нет файла ${F_LABELED}. Разметь pairs-to-label.csv и сохрани как pairs-labeled.csv`);
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(F_LABELED, 'utf8'));
  const head = rows[0];
  const li = head.indexOf('label'), ci = head.indexOf('cosine');
  const data = rows.slice(1)
    .filter((r) => r[li] === '0' || r[li] === '1')
    .map((r) => ({ label: Number(r[li]), cos: Number(r[ci]) }));

  if (data.length < 10) { console.error(`❌ Размечено только ${data.length} пар — мало.`); process.exit(1); }

  const pos = data.filter((d) => d.label === 1), neg = data.filter((d) => d.label === 0);
  console.log(`Размечено: ${data.length} пар (${pos.length} похожи, ${neg.length} нет)\n`);

  // Перебор порога → лучший F1
  let best = { thr: 0, f1: -1, prec: 0, rec: 0 };
  const thresholds = [];
  for (let t = 0.30; t <= 0.98; t += 0.01) thresholds.push(t);
  for (const thr of thresholds) {
    const tp = data.filter((d) => d.cos >= thr && d.label === 1).length;
    const fp = data.filter((d) => d.cos >= thr && d.label === 0).length;
    const fn = data.filter((d) => d.cos < thr && d.label === 1).length;
    const prec = tp / (tp + fp) || 0;
    const rec = tp / (tp + fn) || 0;
    const f1 = (2 * prec * rec) / (prec + rec) || 0;
    if (f1 > best.f1) best = { thr, f1, prec, rec };
  }

  console.log('═══ ПОРОГ (best F1) ═══');
  console.log(`  cosine >= ${best.thr.toFixed(2)}  →  precision ${(best.prec * 100).toFixed(0)}%, recall ${(best.rec * 100).toFixed(0)}%, F1 ${best.f1.toFixed(2)}`);

  // Распределение косинуса
  const avg = (a) => a.reduce((s, x) => s + x.cos, 0) / a.length;
  const range = (a) => `${Math.min(...a.map((x) => x.cos)).toFixed(3)}…${Math.max(...a.map((x) => x.cos)).toFixed(3)}`;
  console.log('\n═══ РАСПРЕДЕЛЕНИЕ КОСИНУСА ═══');
  console.log(`  похожи (1): среднее ${avg(pos).toFixed(3)}, диапазон ${range(pos)}`);
  console.log(`  не похожи (0): среднее ${avg(neg).toFixed(3)}, диапазон ${range(neg)}`);

  // Калибровка процента: линейно растянуть [floor..ceil] → [0..100]
  // floor = типичный косинус несвязанных, ceil ≈ 0.95 (почти-дубль)
  const floor = Math.max(...neg.map((x) => x.cos)) * 0.0 + (neg.length ? avg(neg) : 0.5);
  const ceil = 0.95;
  console.log('\n═══ КАЛИБРОВКА ПРОЦЕНТА ДЛЯ UI ═══');
  console.log(`  Сырой косинус bge-m3 несвязанных ≈ ${floor.toFixed(3)} → это должно быть ~0%, не ${(floor * 100).toFixed(0)}%.`);
  console.log(`  Формула:  pct = clamp( (cos - ${floor.toFixed(3)}) / (${ceil} - ${floor.toFixed(3)}) * 100, 0, 100 )`);
  console.log(`  Проверка: cos=${best.thr.toFixed(2)} (порог) → ${(Math.max(0, Math.min(100, (best.thr - floor) / (ceil - floor) * 100))).toFixed(0)}% в UI`);

  console.log('\n👉 Если precision/recall низкие (<0.7) — пробуем другую модель или меняем текст эмбеддинга (добавить ответ/убрать тему).');
}

main();
