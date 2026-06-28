/// <reference path="../pb_data/types.d.ts" />

// Фича «Листки» — листки Р. К. Гордина (планиметрия/стереометрия) с zadachi.mccme.ru
// + собственные листки учителя. Задачи листков лежат в общем банке `tasks`
// (source='listok_gordin', обычно без темы — изолированы от каталога ЕГЭ/ОГЭ,
// которые фильтруют по topic.exam_type). Картинок-чертежей у Гордина нет —
// только текст + LaTeX, поэтому task_images здесь не нужны.
//
// Две новые коллекции:
//   listok_sheets — лист (kind: official | teacher). Официальные = 41 часть
//     Гордина (intro_md = теория части). Учительские = свои подборки (owner).
//   listok_items  — упорядоченные элементы листа: ссылка на задачу (type=task)
//     или заголовок-разделитель (type=heading, напр. «Дополнительные задачи»).
//
// Лист можно и печатать как раздатку (@media print / html2pdf), и выдавать
// ученику через work_sessions (на уровне UI).
//
// 🚨 Аддитивно. Правила публичные (как у `tasks`/`works` — авторизация UI-only,
// см. CLAUDE.md § Security) — чтобы Node-импортёр мог засеять официальные листы.
// Защита редактирования — в UI (useAuth/ProtectedRoute). Down-миграция удаляет обе.

migrate((app) => {
  const TASKS = "pbc_2602490748";
  const TEACHERS = "pbc_teachers";

  const sheets = new Collection({
    "id": "pbc_listok_sheets",
    "name": "listok_sheets",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "sel_sheet_kind", "name": "kind", "presentable": false,
        "required": true, "system": false, "type": "select", "maxSelect": 1,
        "values": ["official", "teacher"]
      },
      {
        "hidden": false, "id": "sel_sheet_course", "name": "course", "presentable": false,
        "required": false, "system": false, "type": "select", "maxSelect": 1,
        "values": ["planimetry", "stereometry"]
      },
      {
        "hidden": false, "id": "num_sheet_partorder", "name": "part_order",
        "presentable": false, "required": false, "system": false, "type": "number", "onlyInt": true
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_sheet_title",
        "max": 500, "min": 0, "name": "title", "pattern": "",
        "presentable": true, "primaryKey": false, "required": true, "system": false, "type": "text"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_sheet_slug",
        "max": 120, "min": 0, "name": "slug", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_sheet_intro",
        "max": 0, "min": 0, "name": "intro_md", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "rel_sheet_owner", "name": "owner", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": TEACHERS, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_sheet_srcurl",
        "max": 500, "min": 0, "name": "source_url", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_sheet_pdfurl",
        "max": 500, "min": 0, "name": "pdf_url", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_sheet_folder",
        "max": 200, "min": 0, "name": "folder", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "bool_sheet_pinned", "name": "is_pinned",
        "presentable": false, "required": false, "system": false, "type": "bool"
      },
      {
        "hidden": false, "id": "bool_sheet_published", "name": "published",
        "presentable": false, "required": false, "system": false, "type": "bool"
      },
      {
        "hidden": false, "id": "autodate_sheet_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      },
      {
        "hidden": false, "id": "autodate_sheet_updated", "name": "updated",
        "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_listok_sheets_kind ON listok_sheets (kind)",
      "CREATE INDEX idx_listok_sheets_course_part ON listok_sheets (course, part_order)",
      "CREATE INDEX idx_listok_sheets_owner ON listok_sheets (owner)",
      "CREATE UNIQUE INDEX idx_listok_sheets_slug ON listok_sheets (slug) WHERE slug != ''"
    ],
    "listRule": "", "viewRule": "", "createRule": "", "updateRule": "", "deleteRule": ""
  });
  app.save(sheets);

  // Само-ссылка cloned_from добавляется вторым шагом — коллекция уже существует
  sheets.fields.add(new Field({
    "hidden": false, "id": "rel_sheet_clonedfrom", "name": "cloned_from", "presentable": false,
    "required": false, "system": false, "type": "relation",
    "collectionId": "pbc_listok_sheets", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1
  }));
  app.save(sheets);

  const items = new Collection({
    "id": "pbc_listok_items",
    "name": "listok_items",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
        "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
        "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
      },
      {
        "hidden": false, "id": "rel_item_sheet", "name": "sheet", "presentable": false,
        "required": true, "system": false, "type": "relation",
        "collectionId": "pbc_listok_sheets", "cascadeDelete": true, "minSelect": 1, "maxSelect": 1
      },
      {
        "hidden": false, "id": "sel_item_type", "name": "type", "presentable": false,
        "required": true, "system": false, "type": "select", "maxSelect": 1,
        "values": ["task", "heading"]
      },
      {
        "hidden": false, "id": "rel_item_task", "name": "task", "presentable": false,
        "required": false, "system": false, "type": "relation",
        "collectionId": TASKS, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1
      },
      {
        "autogeneratePattern": "", "hidden": false, "id": "text_item_heading",
        "max": 300, "min": 0, "name": "heading_text", "pattern": "",
        "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
      },
      {
        "hidden": false, "id": "num_item_order", "name": "order",
        "presentable": false, "required": false, "system": false, "type": "number", "onlyInt": true
      },
      {
        "hidden": false, "id": "sel_item_flag", "name": "flag", "presentable": false,
        "required": false, "system": false, "type": "select", "maxSelect": 1,
        "values": ["basic", "hard"]
      },
      {
        "hidden": false, "id": "sel_item_section", "name": "section", "presentable": false,
        "required": false, "system": false, "type": "select", "maxSelect": 1,
        "values": ["main", "additional"]
      },
      {
        "hidden": false, "id": "autodate_item_created", "name": "created",
        "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_listok_items_sheet ON listok_items (sheet, `order`)",
      "CREATE INDEX idx_listok_items_task ON listok_items (task)"
    ],
    "listRule": "", "viewRule": "", "createRule": "", "updateRule": "", "deleteRule": ""
  });
  app.save(items);

  console.log("[1779000035] Созданы коллекции listok_sheets + listok_items");
}, (app) => {
  app.delete(app.findCollectionByNameOrId("pbc_listok_items"));
  app.delete(app.findCollectionByNameOrId("pbc_listok_sheets"));
  console.log("[1779000035] Откачены listok_items + listok_sheets");
});
