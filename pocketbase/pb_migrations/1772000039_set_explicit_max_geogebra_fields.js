/// <reference path="../pb_data/types.d.ts" />

// PB 0.36.4 не воспринимает max=0 как "без лимита" — оставляет дефолт 5000.
// Ставим явное большое значение 500000 (GeoGebra XML обычно 30-100 KB, с запасом).
// Аналог миграции 1772000035 для drawing_svg.

migrate((app) => {
  const items = app.findCollectionByNameOrId('tdf_items');

  for (const name of ['geogebra_base64', 'geogebra_base64_control']) {
    const f = items.fields.getByName(name);
    if (f) {
      f.max = 500000;
      console.log(`[1772000039] Set max=500000 on ${name}`);
    }
  }

  app.save(items);
}, (app) => {
  const items = app.findCollectionByNameOrId('tdf_items');
  for (const name of ['geogebra_base64', 'geogebra_base64_control']) {
    const f = items.fields.getByName(name);
    if (f) { f.max = 0; }
  }
  app.save(items);
});
