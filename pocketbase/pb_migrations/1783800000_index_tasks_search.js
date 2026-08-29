/// <reference path="../pb_data/types.d.ts" />

// Индексы под поиск и листание каталога задач (25 тыс. записей).
//
// Каталог всегда просит `sort=code` + постраничную выборку, а поиск по тексту
// добавляет к этому LIKE по code/statement_md. Без индекса на code SQLite
// сканирует и сортирует всю таблицу на каждый запрос; с ним идёт по индексу и
// останавливается, набрав страницу. Замер на копии боевой БД (29.08.2026):
//   листание           25 мс → 0 мс
//   поиск «треугольн»  62 мс → 1 мс
//   поиск редкого слова           → 14 мс
//   фильтр по теме                → 1 мс
// COUNT(*) для общего числа страниц остаётся полным сканом (~66 мс) — это цена
// пагинации, индексом не лечится.
migrate((app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  const existing = (tasks.indexes || []).map(String);
  const add = [
    "CREATE INDEX `idx_tasks_code` ON `tasks` (`code`)",
    "CREATE INDEX `idx_tasks_topic` ON `tasks` (`topic`)",
  ].filter(sql => !existing.some(idx => idx.includes(sql.split("`")[1])));

  if (add.length === 0) {
    console.log("[1783800000] Индексы уже есть, пропускаем");
    return;
  }
  tasks.indexes = existing.concat(add);
  app.save(tasks);
  console.log(`[1783800000] Добавлены индексы каталога задач: ${add.length}`);

}, (app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  tasks.indexes = (tasks.indexes || []).filter(idx => {
    const s = String(idx);
    return !s.includes("idx_tasks_code") && !s.includes("idx_tasks_topic");
  });
  app.save(tasks);
  console.log("[1783800000] Откат: индексы каталога задач удалены");
});
