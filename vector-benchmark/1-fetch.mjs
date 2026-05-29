// Шаг 1: тянем случайную выборку задач из PB с резолвом темы.
// Сохраняем в data/tasks-sample.json.

import fs from 'node:fs';
import path from 'node:path';
import { PB_URL, SAMPLE_SIZE, F_TASKS } from './lib/config.mjs';

async function fetchPage(page, perPage) {
  const url = `${PB_URL}/api/collections/tasks/records?perPage=${perPage}&page=${page}&expand=topic&fields=id,code,statement_md,answer,difficulty,exam_part,topic,expand.topic.title,expand.topic.section,expand.topic.ege_number`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`PB ${r.status} на странице ${page}`);
  return r.json();
}

async function main() {
  console.log(`Тяну до ${SAMPLE_SIZE} задач из ${PB_URL} ...`);

  // Узнаём общее число и берём случайные страницы
  const first = await fetchPage(1, 1);
  const total = first.totalItems;
  console.log(`Всего задач в базе: ${total}`);

  const perPage = 200;
  const totalPages = Math.ceil(total / perPage);
  const pagesNeeded = Math.ceil(SAMPLE_SIZE / perPage);

  // Случайные неповторяющиеся страницы
  const pages = new Set();
  while (pages.size < Math.min(pagesNeeded, totalPages)) {
    pages.add(1 + Math.floor(Math.random() * totalPages));
  }

  const tasks = [];
  for (const p of pages) {
    const data = await fetchPage(p, perPage);
    for (const it of data.items) {
      const topic = it.expand?.topic;
      tasks.push({
        id: it.id,
        code: it.code,
        statement_md: it.statement_md || '',
        answer: it.answer || '',
        difficulty: it.difficulty,
        exam_part: it.exam_part,
        topic_id: it.topic || '',
        topic_title: topic?.title || '',
        topic_section: topic?.section || '',
        ege_number: topic?.ege_number ?? '',
      });
    }
    process.stdout.write(`\r  собрано ${tasks.length}`);
    if (tasks.length >= SAMPLE_SIZE) break;
  }
  console.log();

  // Отфильтруем задачи без условия (картинки-only и пустые)
  const withText = tasks.filter((t) => t.statement_md.trim().length > 10);
  const noText = tasks.length - withText.length;
  const usable = withText.slice(0, SAMPLE_SIZE);

  fs.mkdirSync(path.dirname(F_TASKS), { recursive: true });
  fs.writeFileSync(F_TASKS, JSON.stringify(usable, null, 2));
  console.log(`✅ Сохранено ${usable.length} задач → ${F_TASKS}`);
  console.log(`   Из ${tasks.length} собранных: ${noText} без текстового условия (${(noText / tasks.length * 100).toFixed(0)}% — картинки-only/пустые)`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
