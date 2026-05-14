/// <reference path="../pb_data/types.d.ts" />

// Снимает лимит 5000 символов с geogebra_base64 (XML состояние GeoGebra
// для одного чертежа обычно 30-100 KB). Аналогично для geogebra_base64_control.

migrate((app) => {
  const items = app.findCollectionByNameOrId('tdf_items');

  for (const name of ['geogebra_base64', 'geogebra_base64_control']) {
    const f = items.fields.getByName(name);
    if (f) {
      f.max = 0; // 0 = без лимита
      console.log(`[1772000038] Removed max constraint from ${name}`);
    }
  }

  app.save(items);
}, (app) => {
  const items = app.findCollectionByNameOrId('tdf_items');
  for (const name of ['geogebra_base64', 'geogebra_base64_control']) {
    const f = items.fields.getByName(name);
    if (f) { f.max = 5000; }
  }
  app.save(items);
});
