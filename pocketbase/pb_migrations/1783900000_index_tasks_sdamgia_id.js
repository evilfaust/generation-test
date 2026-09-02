/// <reference path="../pb_data/types.d.ts" />

// Индекс под поиск задачи по номеру с «Решу ЕГЭ/ОГЭ».
//
// `tasks.sdamgia_id` спрашивают точным совпадением: поиск в каталоге
// (строка «311151» или ссылка на задачу), дедуп при импорте
// (findTaskBySdamgiaId), мост problem_id → task.id для внешнего журнала.
// Без индекса каждый такой запрос — полный скан 25 тыс. строк.
migrate((app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  const existing = (tasks.indexes || []).map(String);
  if (existing.some(idx => idx.includes("idx_tasks_sdamgia_id"))) {
    console.log("[1783900000] Индекс уже есть, пропускаем");
    return;
  }
  tasks.indexes = existing.concat([
    "CREATE INDEX `idx_tasks_sdamgia_id` ON `tasks` (`sdamgia_id`)",
  ]);
  app.save(tasks);
  console.log("[1783900000] Добавлен индекс tasks(sdamgia_id)");

}, (app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  tasks.indexes = (tasks.indexes || []).filter(idx => !String(idx).includes("idx_tasks_sdamgia_id"));
  app.save(tasks);
  console.log("[1783900000] Откат: индекс tasks(sdamgia_id) удалён");
});
