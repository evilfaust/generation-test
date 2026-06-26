/// <reference path="../pb_data/types.d.ts" />

// Кампании каникулярных заданий.
// Кампания = «пакет» для группы: учитель создаёт одну запись → система
// генерирует individual study_programs для каждого ученика, все ссылаются
// на кампанию через study_programs.campaign.
//
// season — свободный текст («Лето», «Зима», «Майские праздники»).
// mode   — 'individual' (из профиля слабостей) | 'identical' (одинаковое всем).
// status — draft | issued | archived.

const TEACHERS = "pbc_teachers";
const GROUPS   = "pbc_teaching_groups";

function pk() {
  return {
    "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
    "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
    "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
  };
}
function rel(id, name, collectionId, opts = {}) {
  return {
    "hidden": false, "id": id, "name": name, "presentable": false,
    "required": opts.required || false, "system": false, "type": "relation",
    "collectionId": collectionId, "cascadeDelete": opts.cascade || false,
    "minSelect": opts.required ? 1 : 0, "maxSelect": 1
  };
}
function txt(id, name, max) {
  return {
    "autogeneratePattern": "", "hidden": false, "id": id, "max": max || 0, "min": 0,
    "name": name, "pattern": "", "presentable": false, "primaryKey": false,
    "required": false, "system": false, "type": "text"
  };
}
function num(id, name) {
  return {
    "hidden": false, "id": id, "max": null, "min": null, "name": name,
    "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number"
  };
}
function json(id, name) {
  return {
    "hidden": false, "id": id, "name": name, "maxSize": 2000000,
    "presentable": false, "required": false, "system": false, "type": "json"
  };
}
function dateField(id, name) {
  return {
    "hidden": false, "id": id, "name": name,
    "presentable": false, "required": false, "system": false, "type": "date",
    "max": "", "min": ""
  };
}
function created(id) {
  return { "hidden": false, "id": id, "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" };
}
function updated(id) {
  return { "hidden": false, "id": id, "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" };
}

const RULES = {
  "listRule": "@request.auth.collectionName = \"teachers\"",
  "viewRule": "@request.auth.collectionName = \"teachers\"",
  "createRule": "@request.auth.collectionName = \"teachers\"",
  "updateRule": "@request.auth.collectionName = \"teachers\"",
  "deleteRule": "@request.auth.collectionName = \"teachers\""
};

migrate((app) => {
  const col = new Collection({
    "id": "pbc_vacation_campaigns", "name": "vacation_campaigns", "type": "base",
    "fields": [
      pk(),
      rel("rel_vc_owner", "owner", TEACHERS, { required: true }),
      rel("rel_vc_group", "group", GROUPS),
      txt("txt_vc_title",    "title",        300),
      txt("txt_vc_season",   "season",        80),  // свободный текст
      num("num_vc_year",     "year"),
      dateField("dt_vc_deadline", "deadline"),
      txt("txt_vc_instructions", "instructions", 0),
      txt("txt_vc_mode",    "mode",          20),   // 'individual' | 'identical'
      json("json_vc_tmpl",  "template_config"),     // для mode='identical'
      txt("txt_vc_status",  "status",        20),   // 'draft' | 'issued' | 'archived'
      created("ad_vc_c"), updated("ad_vc_u")
    ],
    "indexes": [
      "CREATE INDEX idx_vc_owner ON vacation_campaigns (owner)",
      "CREATE INDEX idx_vc_group ON vacation_campaigns (group)"
    ],
    ...RULES
  });
  app.save(col);
  console.log("[1779000032] Создана vacation_campaigns");
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("pbc_vacation_campaigns")); } catch (e) { /**/ }
  console.log("[1779000032] Откачена vacation_campaigns");
});
