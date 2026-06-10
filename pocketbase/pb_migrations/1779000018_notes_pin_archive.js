/// <reference path="../pb_data/types.d.ts" />

// Заметки: закрепление (пин) + архив вместо мгновенного удаления.
// Всё nullable/bool, аддитивно. Down-миграция убирает поля.

migrate((app) => {
  const c = app.findCollectionByNameOrId("teacher_notes");

  if (!c.fields.getByName("is_pinned")) {
    c.fields.add(new Field({
      "hidden": false, "id": "bool_note_pinned", "name": "is_pinned",
      "presentable": false, "required": false, "system": false, "type": "bool"
    }));
  }
  if (!c.fields.getByName("is_archived")) {
    c.fields.add(new Field({
      "hidden": false, "id": "bool_note_archived", "name": "is_archived",
      "presentable": false, "required": false, "system": false, "type": "bool"
    }));
  }

  app.save(c);
  console.log("[1779000018] teacher_notes: +is_pinned, +is_archived");
}, (app) => {
  const c = app.findCollectionByNameOrId("teacher_notes");
  for (const name of ["is_pinned", "is_archived"]) {
    const f = c.fields.getByName(name);
    if (f) c.fields.removeById(f.id);
  }
  app.save(c);
  console.log("[1779000018] откат teacher_notes pin/archive");
});
