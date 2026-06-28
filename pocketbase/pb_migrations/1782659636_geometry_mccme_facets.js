/// <reference path="../pb_data/types.d.ts" />

// Расширение коллекции `geometry_tasks` под интеграцию банка МЦНМО «Задачи по
// геометрии» (17 634 задачи). Подробный план — BACKLOG.md § 0.
//
// 🔑 Архитектура — ФАСЕТЫ, а не дерево. Теги МЦНМО трёхмерны (объект/метод/факт)
// и пересекаются: одна задача висит сразу в нескольких. Поэтому помимо дерева
// topic→subtopic добавляем независимый фасетный слой тегов (many-to-many через
// relation-поле `tags`, без pivot — патч массива id проще и дешевле при импорте).
//
// Что делает миграция (АДДИТИВНО, существующие 249 задач НЕ трогает):
//   1. Новая коллекция `geometry_tags` — фасетные теги (kind: object/method/fact/
//      named/source). Для фактов в `description` ляжет текст теоремы (мостик к
//      разделу «Теория»). `mccme_id` — исходный id тега из attrib.js (идемпотентность).
//   2. `geometry_tasks` += `origin` (manual|mccme), `mccme_id` (идемпотентность
//      импорта), `tags` (relation→geometry_tags, multi). Старые задачи остаются с
//      пустым origin → в каталоге «свои» = `origin != "mccme"`, ничего не обновляем.
//   3. `geometry_subtopics` += `parent` (self-relation) — вложенные подтемы.
//
// 🚨 Правила публичные (как у tasks/geometry_tasks — авторизация UI-only, см.
// CLAUDE.md § Security), чтобы Node-импортёр мог засеять банк. Down удаляет всё.

migrate((app) => {
  // ── 1. geometry_tags ──────────────────────────────────────────────────────
  const tags = new Collection({
    "id": "pbc_geometry_tags",
    "name": "geometry_tags",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "sel_gtag_kind", "name": "kind", "presentable": false,
        "required": true, "system": false, "type": "select", "maxSelect": 1,
        "values": ["object", "method", "fact", "named", "source"]
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_gtag_name",
        "max": 500, "min": 0, "name": "name", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_gtag_slug",
        "max": 160, "min": 0, "name": "slug", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "num_gtag_mccme", "name": "mccme_id",
        "presentable": false, "required": false, "system": false, "type": "number", "onlyInt": true
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_gtag_desc",
        "max": 0, "min": 0, "name": "description", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "autodate_gtag_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_gtag_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_geometry_tags_kind ON geometry_tags (kind)",
      "CREATE INDEX idx_geometry_tags_kind_mccme ON geometry_tags (kind, mccme_id)"
    ],
    "listRule": "", "viewRule": "", "createRule": "", "updateRule": "", "deleteRule": ""
  });
  app.save(tags);

  // ── 2. geometry_tasks: origin + mccme_id + tags ───────────────────────────
  const gt = app.findCollectionByNameOrId("geometry_tasks");
  gt.fields.add(new Field({
    "hidden": false, "id": "sel_gtask_origin", "name": "origin", "presentable": false,
    "required": false, "system": false, "type": "select", "maxSelect": 1,
    "values": ["manual", "mccme"]
  }));
  gt.fields.add(new Field({
    "hidden": false, "id": "num_gtask_mccme", "name": "mccme_id",
    "presentable": false, "required": false, "system": false, "type": "number", "onlyInt": true
  }));
  gt.fields.add(new Field({
    "hidden": false, "id": "rel_gtask_tags", "name": "tags", "presentable": false,
    "required": false, "system": false, "type": "relation",
    "collectionId": "pbc_geometry_tags", "cascadeDelete": false, "minSelect": 0, "maxSelect": 200
  }));
  // Сохраняем существующие индексы и добавляем свои (origin-фильтр + идемпотентность импорта).
  gt.indexes = [
    ...gt.indexes,
    "CREATE INDEX idx_geometry_tasks_origin ON geometry_tasks (origin)",
    "CREATE INDEX idx_geometry_tasks_mccme ON geometry_tasks (mccme_id)"
  ];
  app.save(gt);

  // ── 3. geometry_subtopics: parent (self-relation) для вложенных подтем ─────
  const sub = app.findCollectionByNameOrId("geometry_subtopics");
  sub.fields.add(new Field({
    "hidden": false, "id": "rel_gsub_parent", "name": "parent", "presentable": false,
    "required": false, "system": false, "type": "relation",
    "collectionId": sub.id, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
  }));
  app.save(sub);

  console.log("[1782659636] geometry_tags создана; geometry_tasks += origin/mccme_id/tags; geometry_subtopics += parent");
}, (app) => {
  // Down: снять добавленные поля и удалить geometry_tags.
  const sub = app.findCollectionByNameOrId("geometry_subtopics");
  sub.fields.removeByName("parent");
  app.save(sub);

  const gt = app.findCollectionByNameOrId("geometry_tasks");
  gt.indexes = gt.indexes.filter(
    (ix) => !ix.includes("idx_geometry_tasks_origin") && !ix.includes("idx_geometry_tasks_mccme")
  );
  gt.fields.removeByName("tags");
  gt.fields.removeByName("mccme_id");
  gt.fields.removeByName("origin");
  app.save(gt);

  app.delete(app.findCollectionByNameOrId("pbc_geometry_tags"));
  console.log("[1782659636] Откат: geometry_tags удалена; поля origin/mccme_id/tags/parent сняты");
});
