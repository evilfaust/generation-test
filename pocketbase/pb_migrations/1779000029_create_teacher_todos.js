/// <reference path="../pb_data/types.d.ts" />

// Редизайн «Заметки» → новая фича «Дела» учителя (todo-лист). Отдельная сущность,
// НЕ путать с банком математических задач (коллекция `tasks` / меню «Все задачи»).
//
// Чек-лист в теле заметки можно выгрузить в «Дела» (кнопка «В Дела»): на каждый
// незакрытый пункт создаётся запись со ссылкой на заметку-источник (source_note +
// source_block). Дела также создаются вручную на странице /app/todos.
//
// 🚨 Аддитивно. Правила — логин учителя (как остальное учительское фло). owner-
// фильтрация пока не включена (общий заход перед мультиучительством). Down-миграция
// удаляет коллекцию.

migrate((app) => {
  const todos = new Collection({
    "id": "pbc_teacher_todos",
    "name": "teacher_todos",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_todo_owner", "name": "owner", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_teachers", "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_todo_title",
        "max": 500, "min": 0, "name": "title", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "bool_todo_done", "name": "done",
        "presentable": false, "required": false, "system": false, "type": "bool"
      },
      {
        "hidden": false, "id": "date_todo_due", "name": "due_date",
        "presentable": false, "required": false, "system": false, "type": "date", "min": "", "max": ""
      },
      {
        "hidden": false, "id": "select_todo_priority", "name": "priority",
        "presentable": false, "required": false, "system": false, "type": "select",
        "maxSelect": 1, "values": ["low", "normal", "high"]
      },
      {
        "hidden": false, "id": "rel_todo_group", "name": "group", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": "pbc_teaching_groups", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
      },
      {
        "hidden": false, "id": "rel_todo_note", "name": "source_note", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": "pbc_teacher_notes", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_todo_block",
        "max": 50, "min": 0, "name": "source_block", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "num_todo_order", "name": "sort_order",
        "presentable": false, "required": false, "system": false, "type": "number", "onlyInt": true
      },
      {
        "hidden": false, "id": "autodate_todo_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_todo_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_teacher_todos_owner ON teacher_todos (owner)",
      "CREATE INDEX idx_teacher_todos_note ON teacher_todos (source_note)"
    ],
    "listRule": "@request.auth.collectionName = \"teachers\"",
    "viewRule": "@request.auth.collectionName = \"teachers\"",
    "createRule": "@request.auth.collectionName = \"teachers\"",
    "updateRule": "@request.auth.collectionName = \"teachers\"",
    "deleteRule": "@request.auth.collectionName = \"teachers\""
  });
  app.save(todos);
  console.log("[1779000029] Создана коллекция teacher_todos");
}, (app) => {
  app.delete(app.findCollectionByNameOrId("pbc_teacher_todos"));
  console.log("[1779000029] Откачена коллекция teacher_todos");
});
