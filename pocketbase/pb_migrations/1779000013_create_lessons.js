/// <reference path="../pb_data/types.d.ts" />

// Учительское фло, фаза 4: сущность «Урок» (lessons) — узел плана с датой.
//
// Урок = дата (план/факт) + группа + опц. связь со строкой КТП + заметка +
// материалы (json, на будущее — фаза 6 «замыкание петли»). Лёгкая заметка
// note_md — обычный текст; блочный редактор (BlockNote) придёт в фазе 5.
//
// 🚨 Аддитивно. Down-миграция удаляет коллекцию. Правила — логин учителя.

migrate((app) => {
  const lessons = new Collection({
    "id": "pbc_lessons",
    "name": "lessons",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_lesson_owner", "name": "owner", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_teachers", "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
      },
      {
        "hidden": false, "id": "rel_lesson_group", "name": "group", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": "pbc_teaching_groups", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
      },
      {
        "hidden": false, "id": "rel_lesson_ktp", "name": "ktp_entry", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": "pbc_ktp_entries", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_lesson_title",
        "max": 500, "min": 1, "name": "title", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "date_lesson_plan", "name": "date_plan",
        "presentable": false, "required": true, "system": false, "type": "date", "min": "", "max": ""
      },
      {
        "hidden": false, "id": "date_lesson_fact", "name": "date_fact",
        "presentable": false, "required": false, "system": false, "type": "date", "min": "", "max": ""
      },
      {
        "hidden": false, "id": "select_lesson_status", "maxSelect": 1, "name": "status",
        "presentable": false, "required": false, "system": false, "type": "select",
        "values": ["planned", "done", "cancelled"]
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_lesson_note",
        "max": 10000, "min": 0, "name": "note_md", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "json_lesson_materials", "maxSize": 200000,
        "name": "materials", "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "autodate_lesson_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_lesson_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_lessons_owner ON lessons (owner)",
      "CREATE INDEX idx_lessons_date ON lessons (date_plan)"
    ],
    "listRule": "@request.auth.collectionName = \"teachers\"",
    "viewRule": "@request.auth.collectionName = \"teachers\"",
    "createRule": "@request.auth.collectionName = \"teachers\"",
    "updateRule": "@request.auth.collectionName = \"teachers\"",
    "deleteRule": "@request.auth.collectionName = \"teachers\""
  });
  app.save(lessons);
  console.log("[1779000013] Создана коллекция lessons");
}, (app) => {
  app.delete(app.findCollectionByNameOrId("pbc_lessons"));
  console.log("[1779000013] Откачена коллекция lessons");
});
