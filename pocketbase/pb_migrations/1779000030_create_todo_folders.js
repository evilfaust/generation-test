/// <reference path="../pb_data/types.d.ts" />

// Расширение «Дел»: папки-списки учителя (todo_folders). Дело может лежать в папке
// (teacher_todos.folder, миграция 1779000031). Без папки → «Входящие».
//
// 🚨 Аддитивно. Правила — логин учителя. Down-миграция удаляет коллекцию.

migrate((app) => {
  const folders = new Collection({
    "id": "pbc_todo_folders",
    "name": "todo_folders",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_folder_owner", "name": "owner", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_teachers", "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_folder_name",
        "max": 100, "min": 0, "name": "name", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "select_folder_color", "maxSelect": 1, "name": "color",
        "presentable": false, "required": false, "system": false, "type": "select",
        "values": ["blue", "teal", "violet", "amber", "rose", "neutral"]
      },
      {
        "hidden": false, "id": "num_folder_order", "name": "sort_order",
        "presentable": false, "required": false, "system": false, "type": "number", "onlyInt": true
      },
      {
        "hidden": false, "id": "autodate_folder_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_folder_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": ["CREATE INDEX idx_todo_folders_owner ON todo_folders (owner)"],
    "listRule": "@request.auth.collectionName = \"teachers\"",
    "viewRule": "@request.auth.collectionName = \"teachers\"",
    "createRule": "@request.auth.collectionName = \"teachers\"",
    "updateRule": "@request.auth.collectionName = \"teachers\"",
    "deleteRule": "@request.auth.collectionName = \"teachers\""
  });
  app.save(folders);
  console.log("[1779000030] Создана коллекция todo_folders");
}, (app) => {
  app.delete(app.findCollectionByNameOrId("pbc_todo_folders"));
  console.log("[1779000030] Откачена коллекция todo_folders");
});
