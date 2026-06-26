/// <reference path="../pb_data/types.d.ts" />

// Расширяем study_programs двумя полями:
//   campaign   — ссылка на vacation_campaigns (nullable, без каскадного удаления)
//   reviewed_at — дата, когда учитель отметил программу «проверена»

migrate((app) => {
  const col = app.findCollectionByNameOrId("pbc_study_programs");

  col.fields.add(new Field({
    "hidden": false, "id": "rel_sprog_campaign", "name": "campaign",
    "presentable": false, "required": false, "system": false, "type": "relation",
    "collectionId": "pbc_vacation_campaigns", "cascadeDelete": false,
    "minSelect": 0, "maxSelect": 1
  }));

  col.fields.add(new Field({
    "hidden": false, "id": "dt_sprog_reviewed", "name": "reviewed_at",
    "presentable": false, "required": false, "system": false, "type": "date",
    "max": "", "min": ""
  }));

  app.save(col);
  console.log("[1779000033] study_programs: добавлены campaign + reviewed_at");
}, (app) => {
  const col = app.findCollectionByNameOrId("pbc_study_programs");
  col.fields.removeById("rel_sprog_campaign");
  col.fields.removeById("dt_sprog_reviewed");
  app.save(col);
  console.log("[1779000033] study_programs: откат campaign + reviewed_at");
});
