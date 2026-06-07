/// <reference path="../pb_data/types.d.ts" />

// Учительское фло, фаза 5: заметки (teacher_notes) — блочный редактор BlockNote.
//
// body — JSON-документ BlockNote (массив блоков). links — связи с уроком/учеником/
// задачей (json, на будущее — capture-anywhere/фаза 6). is_inbox — быстрый инбокс.
//
// 🚨 Аддитивно. Down-миграция удаляет коллекцию. Правила — логин учителя.

migrate((app) => {
  const notes = new Collection({
    "id": "pbc_teacher_notes",
    "name": "teacher_notes",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_note_owner", "name": "owner", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_teachers", "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_note_title",
        "max": 200, "min": 0, "name": "title", "pattern": "",
        "presentable": true, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "json_note_body", "maxSize": 2000000,
        "name": "body", "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "bool_note_inbox", "name": "is_inbox",
        "presentable": false, "required": false, "system": false, "type": "bool"
      },
      {
        "hidden": false, "id": "json_note_links", "maxSize": 100000,
        "name": "links", "presentable": false, "required": false, "system": false, "type": "json"
      },
      {
        "hidden": false, "id": "autodate_note_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_note_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": ["CREATE INDEX idx_teacher_notes_owner ON teacher_notes (owner)"],
    "listRule": "@request.auth.collectionName = \"teachers\"",
    "viewRule": "@request.auth.collectionName = \"teachers\"",
    "createRule": "@request.auth.collectionName = \"teachers\"",
    "updateRule": "@request.auth.collectionName = \"teachers\"",
    "deleteRule": "@request.auth.collectionName = \"teachers\""
  });
  app.save(notes);
  console.log("[1779000014] Создана коллекция teacher_notes");
}, (app) => {
  app.delete(app.findCollectionByNameOrId("pbc_teacher_notes"));
  console.log("[1779000014] Откачена коллекция teacher_notes");
});
