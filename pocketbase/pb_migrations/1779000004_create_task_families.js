/// <reference path="../pb_data/types.d.ts" />
// Коллекции для векторного поиска (Этап 1, см. lemma_vector_search_idea.md):
//   task_families        — группы связанных задач (дедуп-кластеры и семейства вариантов)
//   task_family_members  — членство задач в семействах (many-to-many)
//
// Сами ВЕКТОРЫ здесь НЕ хранятся — они в отдельной vec.db (sqlite-vec),
// которой владеет pdf-service. В PB только продуктовые данные для UI.
//
// type='dedup_cluster'   → найденные дубли (порог cos>=0.90 + answer-тайбрейкер),
//                          помечаем, НЕ мёржим (задачи переиспользуются везде).
// type='variant_family'  → осознанное семейство A4 (prep/control/review/retake).

migrate((app) => {
  // 1) task_families
  const families = new Collection({
    "id": "pbc_task_families",
    "name": "task_families",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "fields": [
      {
        "type": "select",
        "id": "select_task_families_type",
        "name": "type",
        "maxSelect": 1,
        "values": ["dedup_cluster", "variant_family"],
        "required": true,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "text",
        "id": "text_task_families_label",
        "name": "label",
        "max": 200,
        "min": 0,
        "pattern": "",
        "autogeneratePattern": "",
        "primaryKey": false,
        "required": false,
        "presentable": true,
        "hidden": false,
        "system": false
      },
      {
        "type": "autodate",
        "id": "autodate_task_families_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "autodate",
        "id": "autodate_task_families_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "hidden": false,
        "system": false
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_task_families_type` ON `task_families` (`type`)"
    ]
  });
  app.save(families);

  // 2) task_family_members
  const members = new Collection({
    "id": "pbc_task_family_members",
    "name": "task_family_members",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "fields": [
      {
        "type": "relation",
        "id": "rel_tfm_family",
        "name": "family",
        "collectionId": "pbc_task_families",
        "cascadeDelete": true,
        "maxSelect": 1,
        "minSelect": 1,
        "required": true,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "relation",
        "id": "rel_tfm_task",
        "name": "task",
        "collectionId": "pbc_2602490748",
        "cascadeDelete": true,
        "maxSelect": 1,
        "minSelect": 1,
        "required": true,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "text",
        "id": "text_tfm_role",
        "name": "role",
        "max": 50,
        "min": 0,
        "pattern": "",
        "autogeneratePattern": "",
        "primaryKey": false,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "number",
        "id": "number_tfm_similarity",
        "name": "similarity",
        "min": 0,
        "max": 1,
        "onlyInt": false,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "autodate",
        "id": "autodate_tfm_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "hidden": false,
        "system": false
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_tfm_family` ON `task_family_members` (`family`)",
      "CREATE INDEX `idx_tfm_task` ON `task_family_members` (`task`)",
      "CREATE UNIQUE INDEX `idx_tfm_family_task` ON `task_family_members` (`family`, `task`)"
    ]
  });
  app.save(members);

  console.log("[1779000004] Созданы коллекции task_families + task_family_members");
}, (app) => {
  // откат: сначала members (ссылается на families), потом families
  try { app.delete(app.findCollectionByNameOrId("pbc_task_family_members")); } catch (e) {}
  try { app.delete(app.findCollectionByNameOrId("pbc_task_families")); } catch (e) {}
  console.log("[1779000004] Удалены коллекции task_family_members + task_families");
});
