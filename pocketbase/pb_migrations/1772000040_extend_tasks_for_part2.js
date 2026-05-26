/// <reference path="../pb_data/types.d.ts" />
// Расширение коллекции tasks для поддержки задач ЕГЭ-профиль части 2 (sdamgia.ru)
// Поля:
//   sdamgia_id           — номер задачи в «Решу ЕГЭ» (для дедупа и обратной ссылки)
//   sdamgia_url          — прямая ссылка на задачу на sdamgia
//   exam_part            — 1 или 2; default=1 (для существующих задач — бэкфил)
//   criteria_md          — критерии оценивания (часть 2)
//   max_score            — максимальный балл за задание
//   latex_needs_review   — флаг: KaTeX не смог отрендерить хотя бы одну формулу;
//                          в UI появляется кнопка «🤖 Перепарсить через LLM»

migrate((app) => {
  const tasks = app.findCollectionByNameOrId("tasks");

  tasks.fields.add(new Field({
    "id": "text_tasks_sdamgia_id",
    "name": "sdamgia_id",
    "type": "text",
    "max": 50,
    "min": 0,
    "pattern": "",
    "autogeneratePattern": "",
    "primaryKey": false,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false
  }));

  tasks.fields.add(new Field({
    "id": "url_tasks_sdamgia_url",
    "name": "sdamgia_url",
    "type": "url",
    "exceptDomains": null,
    "onlyDomains": null,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false
  }));

  tasks.fields.add(new Field({
    "id": "number_tasks_exam_part",
    "name": "exam_part",
    "type": "number",
    "min": 1,
    "max": 2,
    "onlyInt": true,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false
  }));

  tasks.fields.add(new Field({
    "id": "text_tasks_criteria_md",
    "name": "criteria_md",
    "type": "text",
    "max": 50000,
    "min": 0,
    "pattern": "",
    "autogeneratePattern": "",
    "primaryKey": false,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false
  }));

  tasks.fields.add(new Field({
    "id": "number_tasks_max_score",
    "name": "max_score",
    "type": "number",
    "min": 0,
    "max": 10,
    "onlyInt": true,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false
  }));

  tasks.fields.add(new Field({
    "id": "bool_tasks_latex_needs_review",
    "name": "latex_needs_review",
    "type": "bool",
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false
  }));

  // Индекс на sdamgia_id (не unique — пустых может быть много, плюс возможны теоретические дубли при импорте из разных категорий)
  tasks.indexes = (tasks.indexes || []).concat([
    "CREATE INDEX `idx_tasks_sdamgia_id` ON `tasks` (`sdamgia_id`) WHERE `sdamgia_id` != ''"
  ]);

  app.save(tasks);
  console.log("[1772000040] Добавлены поля: sdamgia_id, sdamgia_url, exam_part, criteria_md, max_score, latex_needs_review");

  // Бэкфил exam_part=1 для всех существующих задач.
  // PocketBase для number-поля выставляет DEFAULT 0 (не NULL), поэтому условие — `= 0`.
  app.db().newQuery(`UPDATE tasks SET exam_part = 1 WHERE exam_part = 0 OR exam_part IS NULL`).execute();
  console.log("[1772000040] Бэкфилл exam_part=1 для существующих задач");

}, (app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  const names = [
    "sdamgia_id", "sdamgia_url", "exam_part",
    "criteria_md", "max_score", "latex_needs_review"
  ];
  for (const n of names) {
    const f = tasks.fields.getByName(n);
    if (f) tasks.fields.remove(f);
  }
  // Удаляем индекс
  tasks.indexes = (tasks.indexes || []).filter(idx => !String(idx).includes("idx_tasks_sdamgia_id"));
  app.save(tasks);
  console.log("[1772000040] Откат: удалены поля части 2 из tasks");
});
