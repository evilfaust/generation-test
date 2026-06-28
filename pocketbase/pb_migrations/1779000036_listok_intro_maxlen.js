/// <reference path="../pb_data/types.d.ts" />

// listok_sheets.intro_md хранит теорию части листка (определения + теоремы).
// У планиметрии «Введение» длиннее дефолтного лимита PB (5000) → поднимаем max.
// 🚨 Аддитивно (только увеличение лимита поля). Down — возврат к 5000.

migrate((app) => {
  const c = app.findCollectionByNameOrId("pbc_listok_sheets");
  const f = c.fields.getById("text_sheet_intro");
  f.max = 200000;
  app.save(c);
  console.log("[1779000036] listok_sheets.intro_md max → 200000");
}, (app) => {
  const c = app.findCollectionByNameOrId("pbc_listok_sheets");
  const f = c.fields.getById("text_sheet_intro");
  f.max = 5000;
  app.save(c);
  console.log("[1779000036] listok_sheets.intro_md max → 5000");
});
