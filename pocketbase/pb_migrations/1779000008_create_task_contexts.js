/// <reference path="../pb_data/types.d.ts" />
// Коллекция task_contexts — «сюжеты» практико-ориентированных блоков
// (прежде всего ОГЭ задания 1-5: общий текст-описание + план/чертёж,
// к которому относятся 5 связанных вопросов).
//
// Модель: контекст хранит ОБЩУЮ вводную (context_md) + картинку (image),
// а каждый из вопросов 1-5 — обычная запись tasks со своим statement_md
// (только сам вопрос, без повтора вводной) и relation tasks.context → этот контекст.
// Печать/генерация: вводная и план рисуются ОДИН раз, под ними вопросы.

migrate((app) => {
  const collection = new Collection({
    "id": "pbc_task_contexts",
    "name": "task_contexts",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "fields": [
      {
        "type": "text",
        "id": "text_task_contexts_title",
        "name": "title",
        "max": 200,
        "min": 0,
        "pattern": "",
        "autogeneratePattern": "",
        "primaryKey": false,
        "required": false,
        "presentable": true,
        "hidden": false,
        "system": false
      },
      {
        "type": "text",
        "id": "text_task_contexts_context_md",
        "name": "context_md",
        "max": 50000,
        "min": 0,
        "pattern": "",
        "autogeneratePattern": "",
        "primaryKey": false,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "file",
        "id": "file_task_contexts_image",
        "name": "image",
        "maxSelect": 1,
        "maxSize": 10485760,
        "mimeTypes": [
          "image/png",
          "image/jpeg",
          "image/svg+xml",
          "image/webp",
          "image/gif"
        ],
        "thumbs": ["120x120", "400x0"],
        "protected": false,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "url",
        "id": "url_task_contexts_image_original",
        "name": "image_original_url",
        "exceptDomains": null,
        "onlyDomains": null,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "text",
        "id": "text_task_contexts_sdamgia_file_id",
        "name": "sdamgia_file_id",
        "max": 100,
        "min": 0,
        "pattern": "",
        "autogeneratePattern": "",
        "primaryKey": false,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "select",
        "id": "select_task_contexts_exam_type",
        "name": "exam_type",
        "maxSelect": 1,
        "values": ["oge", "ege_base", "ege_profile", "vpr", "other"],
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "number",
        "id": "number_task_contexts_ege_block",
        "name": "ege_block",
        "min": null,
        "max": null,
        "onlyInt": true,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "text",
        "id": "text_task_contexts_source",
        "name": "source",
        "max": 200,
        "min": 0,
        "pattern": "",
        "autogeneratePattern": "",
        "primaryKey": false,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "autodate",
        "id": "autodate_task_contexts_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "autodate",
        "id": "autodate_task_contexts_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "hidden": false,
        "system": false
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_task_contexts_exam_type` ON `task_contexts` (`exam_type`)",
      "CREATE INDEX `idx_task_contexts_sdamgia_file_id` ON `task_contexts` (`sdamgia_file_id`) WHERE `sdamgia_file_id` != ''"
    ]
  });

  app.save(collection);
  console.log("[1779000008] Создана коллекция task_contexts");

  // Поле tasks.context → task_contexts (optional). Не cascadeDelete:
  // удаление сюжета не должно молча тереть вопросы; чистим осознанно.
  const tasks = app.findCollectionByNameOrId("tasks");
  tasks.fields.add(new Field({
    "type": "relation",
    "id": "rel_tasks_context",
    "name": "context",
    "collectionId": "pbc_task_contexts",
    "cascadeDelete": false,
    "maxSelect": 1,
    "minSelect": 0,
    "required": false,
    "presentable": false,
    "hidden": false,
    "system": false
  }));
  tasks.indexes = (tasks.indexes || []).concat([
    "CREATE INDEX `idx_tasks_context` ON `tasks` (`context`) WHERE `context` != ''"
  ]);
  app.save(tasks);
  console.log("[1779000008] Добавлено поле tasks.context → task_contexts");

}, (app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  const f = tasks.fields.getByName("context");
  if (f) tasks.fields.remove(f);
  tasks.indexes = (tasks.indexes || []).filter(idx => !String(idx).includes("idx_tasks_context"));
  app.save(tasks);

  const collection = app.findCollectionByNameOrId("pbc_task_contexts");
  app.delete(collection);
  console.log("[1779000008] Откат: удалено поле tasks.context и коллекция task_contexts");
});
