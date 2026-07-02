/// <reference path="../pb_data/types.d.ts" />
// Мультиучительство, этап 1 (v3.9.117): поле owner→teachers у сущностей,
// которые до сих пор были глобальными. Банк (tasks/topics/theory/tdf/geometry_tasks,
// pixel_art_images, listok_sheets) остаётся общим — его не трогаем.
// ext_journal_* не трогаем: owner там = sync-аккаунт, входит в ключ идемпотентности.
// Бэкфилл: все существующие записи получают owner = evilfaust.
// owner специально required:false — задеплоенный фронт ещё не шлёт owner при create,
// обязательность включим вместе с ужесточением правил PB (этап «rules»).

const OWNED_COLLECTIONS = [
  "works",
  "work_sessions",
  "cards",
  "mc_tests",
  "marathons",
  "qr_worksheets",
  "pixel_art_worksheets",
  "unit_circle_worksheets",
  "trig_values_worksheets",
  "cryptograms",
  "route_sheets",
  "formula_sheets",
  "geometry_print_tests",
  "pixel_art_team_sets",
  "students",
];

migrate((app) => {
  const teachers = app.findCollectionByNameOrId("teachers");

  for (const name of OWNED_COLLECTIONS) {
    const col = app.findCollectionByNameOrId(name);
    if (!col.fields.getByName("owner")) {
      col.fields.add(new Field({
        "hidden": false, "id": `rel_${name}_owner`, "name": "owner",
        "presentable": false, "required": false, "system": false, "type": "relation",
        "collectionId": teachers.id, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
      }));
      app.save(col);
    }
  }

  // Бэкфилл: всё существующее принадлежит evilfaust
  let ownerId = "e2aibf5o17ko6ai"; // fallback — прод-id evilfaust
  try {
    ownerId = app.findFirstRecordByFilter("teachers", "username = 'evilfaust'").id;
  } catch (_) { /* оставляем fallback */ }

  for (const name of OWNED_COLLECTIONS) {
    app.db()
      .newQuery(`UPDATE ${name} SET owner = {:owner} WHERE owner = '' OR owner IS NULL`)
      .bind({ owner: ownerId })
      .execute();
  }
  console.log(`[migration] owner→teachers добавлен в ${OWNED_COLLECTIONS.length} коллекций, бэкфилл на ${ownerId}`);
}, (app) => {
  for (const name of OWNED_COLLECTIONS) {
    const col = app.findCollectionByNameOrId(name);
    const f = col.fields.getByName("owner");
    if (f) {
      col.fields.removeById(f.id);
      app.save(col);
    }
  }
});
