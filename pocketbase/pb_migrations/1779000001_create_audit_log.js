/// <reference path="../pb_data/types.d.ts" />

// Коллекция audit_log — журнал значимых действий учителей.
// Пишется из фронтенда через api.logAudit() при create/update/delete
// в важных коллекциях (tasks, works, geometry_tasks, tdf_*, theory_articles,
// mc_tests, teachers).
//
// teacher_id/teacher_name хранятся как text (не relation), чтобы лог
// сохранялся даже после удаления учителя.
//
// Читать может только superadmin. Писать может любой залогиненный учитель.

migrate((app) => {
  const collection = new Collection({
    "id": "pbc_audit_log",
    "name": "audit_log",
    "type": "base",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_audit_teacher_id",
        "max": 50,
        "min": 0,
        "name": "teacher_id",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_audit_teacher_name",
        "max": 200,
        "min": 0,
        "name": "teacher_name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select_audit_action",
        "maxSelect": 1,
        "name": "action",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": ["create", "update", "delete"]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_audit_collection",
        "max": 100,
        "min": 0,
        "name": "collection_name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_audit_record_id",
        "max": 50,
        "min": 0,
        "name": "record_id",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_audit_summary",
        "max": 500,
        "min": 0,
        "name": "record_summary",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate_audit_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX idx_audit_created ON audit_log (created)",
      "CREATE INDEX idx_audit_teacher ON audit_log (teacher_id)",
      "CREATE INDEX idx_audit_collection ON audit_log (collection_name)"
    ],
    // Только superadmin может смотреть журнал.
    "listRule": "@request.auth.collectionName = \"teachers\" && @request.auth.role = \"superadmin\"",
    "viewRule": "@request.auth.collectionName = \"teachers\" && @request.auth.role = \"superadmin\"",
    // Любой залогиненный учитель может писать в журнал.
    "createRule": "@request.auth.collectionName = \"teachers\"",
    // Запись лога нельзя изменить или удалить — иммутабельный журнал.
    "updateRule": null,
    "deleteRule": null
  });

  app.save(collection);
  console.log("[1779000001] Создана коллекция audit_log");
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_audit_log");
  app.delete(collection);
  console.log("[1779000001] Откачена коллекция audit_log");
});
