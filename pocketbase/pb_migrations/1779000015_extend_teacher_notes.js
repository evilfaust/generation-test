/// <reference path="../pb_data/types.d.ts" />

// Учительское фло: «общие заметки». Расширяем teacher_notes полями для связи с
// группой/датой/уроком — чтобы заметки урока (из календаря) и обычные заметки были
// одной сущностью. Всё nullable, аддитивно. Down-миграция убирает поля.

migrate((app) => {
  const c = app.findCollectionByNameOrId("teacher_notes");

  if (!c.fields.getByName("group")) {
    c.fields.add(new Field({
      "hidden": false, "id": "rel_note_group", "name": "group", "presentable": false,
      "required": false, "system": false, "type": "relation",
      "collectionId": "pbc_teaching_groups", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
    }));
  }
  if (!c.fields.getByName("lesson")) {
    c.fields.add(new Field({
      "hidden": false, "id": "rel_note_lesson", "name": "lesson", "presentable": false,
      "required": false, "system": false, "type": "relation",
      "collectionId": "pbc_lessons", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
    }));
  }
  if (!c.fields.getByName("note_date")) {
    c.fields.add(new Field({
      "hidden": false, "id": "date_note_date", "name": "note_date",
      "presentable": false, "required": false, "system": false, "type": "date", "min": "", "max": ""
    }));
  }

  app.save(c);
  console.log("[1779000015] teacher_notes: +group, +lesson, +note_date");
}, (app) => {
  const c = app.findCollectionByNameOrId("teacher_notes");
  for (const name of ["group", "lesson", "note_date"]) {
    const f = c.fields.getByName(name);
    if (f) c.fields.removeById(f.id);
  }
  app.save(c);
  console.log("[1779000015] откат teacher_notes доп.полей");
});
