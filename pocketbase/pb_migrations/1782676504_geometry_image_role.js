/// <reference path="../pb_data/types.d.ts" />

// geometry_tasks.image_role — куда относится чертёж (geogebra_image_base64):
// к условию задачи или к её решению. У банка МЦНМО ВСЕ картинки — чертежи
// РЕШЕНИЯ (в исходнике pic[] рендерится внутри блока решения, условие текстовое).
//
// 🚨 Пусто/"condition" = старое поведение (чертёж в условии) — наши 249 задач
// НЕ меняются. Только импорт МЦНМО получает "solution" (отдельным проходом).
// Аддитивно, down снимает поле.

migrate((app) => {
  const gt = app.findCollectionByNameOrId("geometry_tasks");
  gt.fields.add(new Field({
    "hidden": false, "id": "sel_gtask_imgrole", "name": "image_role", "presentable": false,
    "required": false, "system": false, "type": "select", "maxSelect": 1,
    "values": ["condition", "solution"]
  }));
  app.save(gt);
  console.log("[image_role] geometry_tasks += image_role (condition|solution)");
}, (app) => {
  const gt = app.findCollectionByNameOrId("geometry_tasks");
  gt.fields.removeByName("image_role");
  app.save(gt);
  console.log("[image_role] откат: geometry_tasks -= image_role");
});
