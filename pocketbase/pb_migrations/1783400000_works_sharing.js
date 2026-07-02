/// <reference path="../pb_data/types.d.ts" />
// Шаринг работ (v3.9.118, мультиучительство этап 3):
// • works.visibility: пусто/"private" = личная, "shared" = общая (видна всем
//   учителям во вкладке «Общие работы», read-only — правка только через клон).
// • works.listRule расширен: учитель видит свои + общие.
// • teachers.viewRule ослаблен до «любой залогиненный учитель» — нужно для
//   expand(owner) в списке общих работ (показать автора). list остаётся
//   superadmin-only, пароли/токены PB не отдаёт по определению.
migrate((app) => {
  const works = app.findCollectionByNameOrId("works");

  if (!works.fields.getByName("visibility")) {
    works.fields.add(new Field({
      "hidden": false, "id": "select_works_visibility", "name": "visibility",
      "maxSelect": 1, "presentable": false, "required": false, "system": false,
      "type": "select", "values": ["private", "shared"]
    }));
  }
  works.listRule = '@request.auth.collectionName = "teachers" && ((owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin") || visibility = "shared")';
  app.save(works);

  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.viewRule = '@request.auth.collectionName = "teachers"';
  app.save(teachers);

  console.log('[migration] works: +visibility, listRule с shared; teachers.viewRule → любой учитель');
}, (app) => {
  const works = app.findCollectionByNameOrId("works");
  const f = works.fields.getByName("visibility");
  if (f) works.fields.removeById(f.id);
  // Правило этапа 2 (миграция 1783300000)
  works.listRule = '@request.auth.collectionName = "teachers" && (owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")';
  app.save(works);

  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.viewRule = '@request.auth.collectionName = "teachers" && (id = @request.auth.id || @request.auth.role = "superadmin")';
  app.save(teachers);
});
