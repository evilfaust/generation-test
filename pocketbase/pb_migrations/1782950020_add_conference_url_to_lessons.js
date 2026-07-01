/// <reference path="../pb_data/types.d.ts" />

// Курсы: переопределение ссылки на видеоконференцию на уровне конкретного урока.
// Пусто → в кабинете ученика используется комната группы (teaching_groups.conference_url).
//
// 🚨 Аддитивно: одно новое опциональное текстовое поле. down удаляет поле.

migrate((app) => {
  const col = app.findCollectionByNameOrId("lessons");
  if (!col.fields.getByName("conference_url")) {
    col.fields.add(new Field({
      "autogeneratePattern": "", "hidden": false, "id": "text_lesson_conf", "max": 1000, "min": 0,
      "name": "conference_url", "pattern": "", "presentable": false, "primaryKey": false,
      "required": false, "system": false, "type": "text"
    }));
    app.save(col);
  }
  console.log("[1782950020] lessons: добавлено conference_url");
}, (app) => {
  const col = app.findCollectionByNameOrId("lessons");
  const f = col.fields.getByName("conference_url");
  if (f) { col.fields.removeById(f.id); app.save(col); }
  console.log("[1782950020] lessons: откат conference_url");
});
