/// <reference path="../pb_data/types.d.ts" />

// Добавляет новый тип ТДФ «Геометрические формулы» (geometry_formula).
// Поля:
//   drawing_image_control — PNG/SVG вариант контроля (частичный чертёж)
//   geogebra_base64_control — XML состояние GeoGebra для контрольного чертежа
//   formula_control_hidden — скрывать ли формулу в режиме контроля (default: true)

migrate((app) => {
  const items = app.findCollectionByNameOrId("tdf_items");

  // ── 1. Добавить geometry_formula в select-поле type ──────────────────────
  const typeField = items.fields.getByName("type");
  if (!typeField) throw new Error('Field "type" not found in tdf_items');

  const nextValues = Array.isArray(typeField.values) ? [...typeField.values] : [];
  if (!nextValues.includes("geometry_formula")) {
    nextValues.push("geometry_formula");
  }
  typeField.values = nextValues;
  console.log('[1772000037] Added "geometry_formula" to tdf_items.type');

  // ── 2. Добавить drawing_image_control (file) ─────────────────────────────
  if (!items.fields.getByName("drawing_image_control")) {
    items.fields.add(new FileField({
      id:        "file_tdf_items_drawing_ctrl",
      name:      "drawing_image_control",
      maxSelect: 1,
      maxSize:   5242880,
      mimeTypes: ["image/png", "image/jpeg", "image/webp"],
    }));
    console.log('[1772000037] Added drawing_image_control field');
  }

  // ── 3. Добавить geogebra_base64_control (text, без лимита) ──────────────
  if (!items.fields.getByName("geogebra_base64_control")) {
    items.fields.add(new TextField({
      id:       "text_tdf_items_ggb_base64_ctrl",
      name:     "geogebra_base64_control",
      required: false,
      max:      0,
    }));
    console.log('[1772000037] Added geogebra_base64_control field');
  }

  // ── 4. Добавить formula_control_hidden (bool) ────────────────────────────
  if (!items.fields.getByName("formula_control_hidden")) {
    items.fields.add(new BoolField({
      id:   "bool_tdf_items_formula_ctrl_hidden",
      name: "formula_control_hidden",
    }));
    console.log('[1772000037] Added formula_control_hidden field');
  }

  app.save(items);
  console.log('[1772000037] Migration complete');

}, (app) => {
  const items = app.findCollectionByNameOrId("tdf_items");

  // Убрать geometry_formula из select
  const typeField = items.fields.getByName("type");
  if (typeField) {
    typeField.values = (Array.isArray(typeField.values) ? typeField.values : [])
      .filter((v) => v !== "geometry_formula");
  }

  // Удалить добавленные поля
  for (const name of ["drawing_image_control", "geogebra_base64_control", "formula_control_hidden"]) {
    const f = items.fields.getByName(name);
    if (f) items.fields.removeById(f.id);
  }

  app.save(items);
  console.log('[rollback 1772000037] Removed geometry_formula type and associated fields');
});
