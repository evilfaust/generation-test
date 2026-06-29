/// <reference path="../pb_data/types.d.ts" />

// Добавляем курс «algebra» в select listok_sheets.course (были planimetry|stereometry).
// Нужно для импорта листков по алгебре Гордина (zadachi.mccme.ru/listki.alg).
// 🚨 Аддитивно (расширение списка значений). Down — возврат к двум курсам.

migrate((app) => {
  const c = app.findCollectionByNameOrId("pbc_listok_sheets");
  const f = c.fields.getById("sel_sheet_course");
  f.values = ["planimetry", "stereometry", "algebra"];
  app.save(c);
  console.log("[1779000037] listok_sheets.course += algebra");
}, (app) => {
  const c = app.findCollectionByNameOrId("pbc_listok_sheets");
  const f = c.fields.getById("sel_sheet_course");
  f.values = ["planimetry", "stereometry"];
  app.save(c);
  console.log("[1779000037] listok_sheets.course − algebra");
});
