/// <reference path="../pb_data/types.d.ts" />

// Создаём auth-коллекцию `teachers` для учителей с ролями и секциями.
// Формат скопирован с миграции 1770000600_create_students.js (PB 0.36.4).
//
// Поля:
//   - username (login identity, unique)
//   - password (min 8)
//   - name (display name)
//   - role: superadmin | editor | viewer
//   - allowed_sections: json array of section keys (для editor/viewer)
//
// Правила: только superadmin может управлять пользователями; каждый учитель
// видит/редактирует свой профиль. Самостоятельная регистрация запрещена
// (createRule требует superadmin).
//
// Также создаём первого суперадмина: evilfaust / Zxasqw12#

migrate((app) => {
  const collection = new Collection({
    "id": "pbc_teachers",
    "name": "teachers",
    "type": "auth",
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
        "cost": 12,
        "hidden": true,
        "id": "password",
        "max": 0,
        "min": 8,
        "name": "password",
        "pattern": "",
        "presentable": false,
        "required": true,
        "system": true,
        "type": "password"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_teacher_username",
        "max": 0,
        "min": 3,
        "name": "username",
        "pattern": "^[\\w][\\w\\.\\-]*$",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "exceptDomains": [],
        "hidden": false,
        "id": "email",
        "max": 0,
        "min": 0,
        "name": "email",
        "onlyDomains": [],
        "presentable": false,
        "required": false,
        "system": true,
        "type": "email"
      },
      {
        "hidden": false,
        "id": "bool_emailVisibility",
        "name": "emailVisibility",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool_verified",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_teacher_name",
        "max": 100,
        "min": 2,
        "name": "name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select_teacher_role",
        "maxSelect": 1,
        "name": "role",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": ["superadmin", "editor", "viewer"]
      },
      {
        "hidden": false,
        "id": "json_allowed_sections",
        "maxSize": 5000,
        "name": "allowed_sections",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "autodate_teacher_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_teacher_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_teachers_username ON teachers (username)"
    ],
    // Только superadmin видит список учителей. Самопросмотр через viewRule.
    "listRule": "@request.auth.collectionName = \"teachers\" && @request.auth.role = \"superadmin\"",
    "viewRule": "@request.auth.collectionName = \"teachers\" && (id = @request.auth.id || @request.auth.role = \"superadmin\")",
    // Создание только через superadmin — самостоятельная регистрация запрещена.
    "createRule": "@request.auth.collectionName = \"teachers\" && @request.auth.role = \"superadmin\"",
    "updateRule": "@request.auth.collectionName = \"teachers\" && (id = @request.auth.id || @request.auth.role = \"superadmin\")",
    "deleteRule": "@request.auth.collectionName = \"teachers\" && @request.auth.role = \"superadmin\"",
    "authRule": "",
    "manageRule": null,
    "oauth2": {
      "enabled": false,
      "mappedFields": {}
    },
    "passwordAuth": {
      "enabled": true,
      "identityFields": ["username"]
    },
    "mfa": {
      "enabled": false,
      "rule": "",
      "duration": 0
    }
  });

  app.save(collection);

  // Создаём первого суперадмина (необходим для первого входа в UI).
  // Пароль можно изменить через интерфейс после первого логина.
  const superAdmin = new Record(collection, {
    username: "evilfaust",
    name: "Олег Фауст",
    role: "superadmin",
    allowed_sections: [] // superadmin не использует — у него доступ ко всему
  });
  superAdmin.setPassword("Zxasqw12#");
  app.save(superAdmin);

  console.log("[1779000000] Создана коллекция teachers + суперадмин evilfaust");
}, (app) => {
  // Откат: удаляем коллекцию (вместе с ней удалятся все учителя).
  const collection = app.findCollectionByNameOrId("pbc_teachers");
  app.delete(collection);
  console.log("[1779000000] Откачена коллекция teachers");
});
