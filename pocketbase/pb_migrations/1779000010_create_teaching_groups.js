/// <reference path="../pb_data/types.d.ts" />

// Учительское фло, фаза 1: сущность «Класс/группа».
//
// Создаём коллекцию `teaching_groups` (личная сущность учителя) и аддитивно
// добавляем nullable relation `teaching_group` в коллекцию `students`.
// Старое строковое поле `students.student_class` НЕ трогаем (обратная совместимость).
//
// 🚨 Безопасность данных: всё аддитивно. Новая коллекция + новое nullable-поле.
// Существующие данные не изменяются. Down-миграция полностью откатывает изменения.
//
// Правила доступа: требуют логина учителя (`@request.auth.collectionName = "teachers"`).
// Фильтрацию по `owner` (owner = @request.auth.id) ПОКА не включаем — в текущей
// реальности один учитель. Но поле `owner` пишем с самого начала, чтобы не
// мигрировать данные потом, когда правила ужесточим (отдельный заход).

migrate((app) => {
  const collection = new Collection({
    "id": "pbc_teaching_groups",
    "name": "teaching_groups",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "rel_group_owner",
        "name": "owner",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation",
        "collectionId": "pbc_teachers",
        "cascadeDelete": false,
        "minSelect": 1,
        "maxSelect": 1
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_group_name",
        "max": 100,
        "min": 1,
        "name": "name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_group_subject",
        "max": 100,
        "min": 0,
        "name": "subject",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "num_group_grade",
        "max": null,
        "min": null,
        "name": "grade",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "num_group_hours",
        "max": null,
        "min": null,
        "name": "hours_per_week",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_group_umk",
        "max": 200,
        "min": 0,
        "name": "umk",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_group_year",
        "max": 20,
        "min": 0,
        "name": "year",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "json_group_schedule",
        "maxSize": 100000,
        "name": "schedule",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "bool_group_archived",
        "name": "archived",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "autodate_group_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_group_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_teaching_groups_owner ON teaching_groups (owner)"
    ],
    "listRule": "@request.auth.collectionName = \"teachers\"",
    "viewRule": "@request.auth.collectionName = \"teachers\"",
    "createRule": "@request.auth.collectionName = \"teachers\"",
    "updateRule": "@request.auth.collectionName = \"teachers\"",
    "deleteRule": "@request.auth.collectionName = \"teachers\""
  });

  app.save(collection);

  // Аддитивно: nullable relation `teaching_group` в students.
  const students = app.findCollectionByNameOrId("students");
  if (!students.fields.getByName("teaching_group")) {
    students.fields.add(new Field({
      "hidden": false,
      "id": "rel_student_group",
      "name": "teaching_group",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation",
      "collectionId": "pbc_teaching_groups",
      "cascadeDelete": false,
      "minSelect": 0,
      "maxSelect": 1
    }));
    app.save(students);
  }

  console.log("[1779000010] Создана teaching_groups + students.teaching_group");
}, (app) => {
  // Откат: убираем поле из students, затем удаляем коллекцию.
  try {
    const students = app.findCollectionByNameOrId("students");
    const f = students.fields.getByName("teaching_group");
    if (f) {
      students.fields.removeById(f.id);
      app.save(students);
    }
  } catch (e) {
    console.log("[1779000010] откат students.teaching_group:", e?.message);
  }

  const collection = app.findCollectionByNameOrId("pbc_teaching_groups");
  app.delete(collection);
  console.log("[1779000010] Откачена коллекция teaching_groups");
});
