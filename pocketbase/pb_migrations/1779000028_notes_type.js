/// <reference path="../pb_data/types.d.ts" />

// Редизайн «Заметки»: тип заметки (lesson|plan|idea|call|obs). Влияет на иконку/цвет
// в списке и шапке, шаблон при создании, фильтр-чипы. Ортогонален is_inbox.
//
// 🚨 Аддитивно, nullable. Существующие заметки без type фронт трактует как 'lesson'
// (если есть привязка к уроку) либо 'idea'. Down-миграция убирает поле.

migrate((app) => {
  const c = app.findCollectionByNameOrId("teacher_notes");

  if (!c.fields.getByName("type")) {
    c.fields.add(new Field({
      "hidden": false,
      "id": "select_note_type",
      "name": "type",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "maxSelect": 1,
      "values": ["lesson", "plan", "idea", "call", "obs"]
    }));
  }

  app.save(c);
  console.log("[1779000028] teacher_notes: +type (select)");
}, (app) => {
  const c = app.findCollectionByNameOrId("teacher_notes");
  const f = c.fields.getByName("type");
  if (f) c.fields.removeById(f.id);
  app.save(c);
  console.log("[1779000028] откат teacher_notes.type");
});
