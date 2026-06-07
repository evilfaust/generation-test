/// <reference path="../pb_data/types.d.ts" />

// Учительское фло, фаза 3: КТП (календарно-тематическое планирование) — ось времени.
//
// Две коллекции:
//   - courses      — КТП-документ (привязан к группе + учебному году)
//   - ktp_entries  — строки КТП (темы по неделям/часам). cascadeDelete по course.
//
// ktp_entries.title — свободный текст (тема урока/раздела); ktp_entries.topic —
// ОПЦИОНАЛЬНАЯ связь с темой фонда (topics). Это гибрид: не все темы КТП есть в
// фонде 1:1, но связь даёт переход к материалам.
//
// 🚨 Аддитивно. Существующие коллекции не меняются. Правила — требуют логина учителя
// (owner-фильтрация пока не включена, как в teaching_groups). Down-миграция удаляет обе.

migrate((app) => {
  // ── courses ──────────────────────────────────────────────────────────────
  const courses = new Collection({
    "id": "pbc_ktp_courses",
    "name": "courses",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_course_owner", "name": "owner", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_teachers", "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
      },
      {
        "hidden": false, "id": "rel_course_group", "name": "group", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": "pbc_teaching_groups", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_course_title",
        "max": 200, "min": 1, "name": "title", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_course_year",
        "max": 20, "min": 0, "name": "year", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "bool_course_archived", "name": "archived",
        "presentable": false, "required": false, "system": false, "type": "bool"
      },
      {
        "hidden": false, "id": "autodate_course_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_course_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": ["CREATE INDEX idx_courses_owner ON courses (owner)"],
    "listRule": "@request.auth.collectionName = \"teachers\"",
    "viewRule": "@request.auth.collectionName = \"teachers\"",
    "createRule": "@request.auth.collectionName = \"teachers\"",
    "updateRule": "@request.auth.collectionName = \"teachers\"",
    "deleteRule": "@request.auth.collectionName = \"teachers\""
  });
  app.save(courses);

  // ── ktp_entries ──────────────────────────────────────────────────────────
  const entries = new Collection({
    "id": "pbc_ktp_entries",
    "name": "ktp_entries",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_entry_course", "name": "course", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_ktp_courses", "cascadeDelete": true, "minSelect": 1, "maxSelect": 1
      },
      {
        "hidden": false, "id": "num_entry_order", "max": null, "min": null, "name": "order",
        "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_entry_title",
        "max": 500, "min": 1, "name": "title", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "rel_entry_topic", "name": "topic", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": "pbc_2800040823", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
      },
      {
        "hidden": false, "id": "num_entry_hours", "max": null, "min": null, "name": "hours",
        "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number"
      },
      {
        "hidden": false, "id": "num_entry_week", "max": null, "min": null, "name": "week_no",
        "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number"
      },
      {
        "hidden": false, "id": "date_entry_planned", "name": "planned_date",
        "presentable": false, "required": false, "system": false, "type": "date", "min": "", "max": ""
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_entry_results",
        "max": 2000, "min": 0, "name": "planned_results", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "bool_entry_section", "name": "is_section",
        "presentable": false, "required": false, "system": false, "type": "bool"
      },
      {
        "hidden": false, "id": "autodate_entry_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_entry_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": ["CREATE INDEX idx_ktp_entries_course ON ktp_entries (course)"],
    "listRule": "@request.auth.collectionName = \"teachers\"",
    "viewRule": "@request.auth.collectionName = \"teachers\"",
    "createRule": "@request.auth.collectionName = \"teachers\"",
    "updateRule": "@request.auth.collectionName = \"teachers\"",
    "deleteRule": "@request.auth.collectionName = \"teachers\""
  });
  app.save(entries);

  console.log("[1779000012] Созданы courses + ktp_entries");
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("pbc_ktp_entries"));
  } catch (e) { console.log("[1779000012] откат ktp_entries:", e?.message); }
  try {
    app.delete(app.findCollectionByNameOrId("pbc_ktp_courses"));
  } catch (e) { console.log("[1779000012] откат courses:", e?.message); }
  console.log("[1779000012] Откачены courses + ktp_entries");
});
