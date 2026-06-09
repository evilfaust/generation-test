/// <reference path="../pb_data/types.d.ts" />

// Учительское фло: расписание «пар» школы + интенсивы. Поле time_slot кодирует
// временной слот урока (старт хранится в date_plan, конец/длительность — здесь):
//   "0"        — нулевая пара (единый блок)
//   "N"        — целая пара N (N=1..5)
//   "Na"/"Nb"  — 1-я / 2-я полупара пары N
//   "N-M"      — интенсив с пары N по пару M (N<M), напр. "2-4"
// Пусто/null — урок со «своим» временем (как было раньше).
//
// 🚨 Аддитивно, nullable. Down-миграция удаляет поле. Бэкап сделан перед применением.

migrate((app) => {
  const c = app.findCollectionByNameOrId("lessons");
  if (!c.fields.getByName("time_slot")) {
    c.fields.add(new Field({
      "hidden": false, "id": "text_lesson_time_slot", "name": "time_slot",
      "max": 20, "min": 0, "pattern": "",
      "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
    }));
  }
  app.save(c);
  console.log("[1779000017] lessons: +time_slot");
}, (app) => {
  const c = app.findCollectionByNameOrId("lessons");
  const f = c.fields.getByName("time_slot");
  if (f) c.fields.removeById(f.id);
  app.save(c);
  console.log("[1779000017] откат lessons.time_slot");
});
