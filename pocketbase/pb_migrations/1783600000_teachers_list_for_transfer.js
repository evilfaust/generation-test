/// <reference path="../pb_data/types.d.ts" />
// Передача учеников между учителями (v3.9.120):
// teachers.listRule ослабляется до «любой залогиненный учитель» — нужно для
// Select'а «Передать ученика» (выбрать коллегу) и вообще для коллаборации
// (авторы общих работ и т.п.). viewRule уже ослаблен миграцией 1783400000.
// create/update/delete остаются строгими (superadmin / своя запись).
migrate((app) => {
  const col = app.findCollectionByNameOrId("teachers");
  col.listRule = '@request.auth.collectionName = "teachers"';
  app.save(col);
  console.log('[migration] teachers.listRule → любой залогиненный учитель');
}, (app) => {
  // Снапшот прода (миграция 1779000000): список — только superadmin
  const col = app.findCollectionByNameOrId("teachers");
  col.listRule = '@request.auth.collectionName = "teachers" && @request.auth.role = "superadmin"';
  app.save(col);
});
