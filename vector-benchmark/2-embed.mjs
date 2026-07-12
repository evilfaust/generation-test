// Шаг 2: эмбеддим задачи через Ollama (bge-m3).
// Текст = "тема + условие" (по решению 2026-05-29), LaTeX → лёгкая чистка.
// Сохраняем векторы в data/vectors.json.

import fs from 'node:fs';
import { OLLAMA_URL, MODEL, F_TASKS, F_VECTORS } from './lib/config.mjs';
import { cleanLatex } from './lib/cleanLatex.mjs';

// Текст для эмбеддинга одной задачи
export function buildText(task) {
  const topic = task.topic_title ? `Тема: ${task.topic_title}.` : '';
  const body = cleanLatex(task.statement_md);
  return `${topic}\n${body}`.trim();
}

// Текст для эмбеддинга ГЕОМЕТРИЧЕСКОЙ задачи (geometry_tasks):
// тема + фасетные теги МЦНМО (объект/метод/факт — сильный семантический сигнал,
// вытягивает короткие условия) + заголовок + условие.
const GEO_TAG_KIND = { object: 'объекты', method: 'методы', fact: 'факты', named: 'теоремы', source: 'источник' };
export function buildGeoText(task) {
  const parts = [];
  if (task.topic_title) parts.push(`Тема: ${task.topic_title}.`);
  if (Array.isArray(task.tags) && task.tags.length) {
    const byKind = {};
    for (const t of task.tags) { if (t?.name) (byKind[t.kind] ||= []).push(t.name); }
    const s = Object.entries(byKind)
      .map(([k, names]) => `${GEO_TAG_KIND[k] || k}: ${names.join(', ')}`)
      .join('; ');
    if (s) parts.push(`Теги — ${s}.`);
  }
  if (task.title) parts.push(task.title);
  const body = cleanLatex(task.statement_md);
  if (body) parts.push(body);
  return parts.join('\n').trim();
}

async function embed(text) {
  const r = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: text }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.embedding;
}

async function main() {
  const tasks = JSON.parse(fs.readFileSync(F_TASKS, 'utf8'));
  console.log(`Эмбеддю ${tasks.length} задач моделью ${MODEL} ...`);

  const t0 = Date.now();
  const vectors = [];
  for (let i = 0; i < tasks.length; i++) {
    const text = buildText(tasks[i]);
    const vec = await embed(text);
    vectors.push({ id: tasks[i].id, vec });
    if (i % 25 === 0 || i === tasks.length - 1) {
      const rate = (i + 1) / ((Date.now() - t0) / 1000);
      process.stdout.write(`\r  ${i + 1}/${tasks.length}  (${rate.toFixed(0)} зад/с, dim=${vec.length})`);
    }
  }
  console.log();

  fs.writeFileSync(F_VECTORS, JSON.stringify(vectors));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`✅ ${vectors.length} векторов за ${secs}с → ${F_VECTORS}`);
}

// Запускаем main() только при прямом вызове, а не при импорте buildText
import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('❌', e.message); process.exit(1); });
}
