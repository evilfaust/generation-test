/// <reference path="../pb_data/types.d.ts" />

// Расширение «Дел»: папка, повтор, привязки к ученику/уроку/работе.
//   folder  → todo_folders (опц.) — список-папка; пусто = «Входящие».
//   repeat  → select daily|weekly|monthly (пусто = разовое). При отметке done
//             фронт создаёт следующий экземпляр со сдвинутым сроком.
//   student → students (опц.), lesson → lessons (опц.), work → works (опц.) —
//             привязка-контекст (чип со ссылкой, как source_note).
//
// 🚨 Аддитивно, всё nullable, cascadeDelete=false (удаление сущности не сносит
// дело — оно просто теряет привязку). Down-миграция убирает поля.

migrate((app) => {
  const c = app.findCollectionByNameOrId("teacher_todos");

  if (!c.fields.getByName("folder")) {
    c.fields.add(new Field({
      "hidden": false, "id": "rel_todo_folder", "name": "folder", "presentable": false,
      "required": false, "system": false, "type": "relation",
      "collectionId": "pbc_todo_folders", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
    }));
  }
  if (!c.fields.getByName("repeat")) {
    c.fields.add(new Field({
      "hidden": false, "id": "select_todo_repeat", "maxSelect": 1, "name": "repeat",
      "presentable": false, "required": false, "system": false, "type": "select",
      "values": ["daily", "weekly", "monthly"]
    }));
  }
  if (!c.fields.getByName("student")) {
    c.fields.add(new Field({
      "hidden": false, "id": "rel_todo_student", "name": "student", "presentable": false,
      "required": false, "system": false, "type": "relation",
      "collectionId": "pbc_students", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
    }));
  }
  if (!c.fields.getByName("lesson")) {
    c.fields.add(new Field({
      "hidden": false, "id": "rel_todo_lesson", "name": "lesson", "presentable": false,
      "required": false, "system": false, "type": "relation",
      "collectionId": "pbc_lessons", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
    }));
  }
  if (!c.fields.getByName("work")) {
    c.fields.add(new Field({
      "hidden": false, "id": "rel_todo_work", "name": "work", "presentable": false,
      "required": false, "system": false, "type": "relation",
      "collectionId": "pbc_1034140840", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
    }));
  }

  app.save(c);
  console.log("[1779000031] teacher_todos: +folder, +repeat, +student, +lesson, +work");
}, (app) => {
  const c = app.findCollectionByNameOrId("teacher_todos");
  for (const name of ["folder", "repeat", "student", "lesson", "work"]) {
    const f = c.fields.getByName(name);
    if (f) c.fields.removeById(f.id);
  }
  app.save(c);
  console.log("[1779000031] откат доп.полей teacher_todos");
});
