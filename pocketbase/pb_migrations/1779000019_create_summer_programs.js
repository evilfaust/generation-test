/// <reference path="../pb_data/types.d.ts" />

// Индивидуальная летняя программа занятий (per-student).
//   study_programs       — программа конкретного ученика (конфиг блоков + слепок слабостей)
//   study_program_items  — элементы программы (блоки): алгебра/геометрия/устный счёт/вне-экзамена,
//                          каждый опц. ссылается на адресную work_session (цифровая выдача)
//
// Ключ: блоки/темы кодируются через topic-relation (НЕ номер ЕГЭ) → готовность к профилю.
// Правила — логин учителя (как у workspace-коллекций). Аддитивно; down удаляет обе.

const TEACHERS = "pbc_teachers";
const TOPICS = "pbc_2800040823";
const GROUPS = "pbc_teaching_groups";

function pk() {
  return {
    "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
    "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
    "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
  };
}
function rel(id, name, collectionId, { required = false, cascade = false } = {}) {
  return {
    "hidden": false, "id": id, "name": name, "presentable": false,
    "required": required, "system": false, "type": "relation",
    "collectionId": collectionId, "cascadeDelete": cascade,
    "minSelect": required ? 1 : 0, "maxSelect": 1
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
  return { "hidden": false, "id": id, "max": null, "min": null, "name": name,
    "onlyInt": false, "presentable": false, "required": false, "system": false, "type": "number" };
}
function json(id, name) {
  return { "hidden": false, "id": id, "name": name, "maxSize": 2000000,
    "presentable": false, "required": false, "system": false, "type": "json" };
}
function created(id) { return { "hidden": false, "id": id, "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" }; }
function updated(id) { return { "hidden": false, "id": id, "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" }; }

const RULES = {
  "listRule": "@request.auth.collectionName = \"teachers\"",
  "viewRule": "@request.auth.collectionName = \"teachers\"",
  "createRule": "@request.auth.collectionName = \"teachers\"",
  "updateRule": "@request.auth.collectionName = \"teachers\"",
  "deleteRule": "@request.auth.collectionName = \"teachers\""
};

migrate((app) => {
  // ID коллекций досхемной эры резолвим в рантайме (надёжнее хардкода).
  const STUDENTS = app.findCollectionByNameOrId("students").id;
  const SESSIONS = app.findCollectionByNameOrId("work_sessions").id;

  const programs = new Collection({
    "id": "pbc_study_programs", "name": "study_programs", "type": "base",
    "fields": [
      pk(),
      rel("rel_sprog_owner", "owner", TEACHERS, { required: true }),
      rel("rel_sprog_student", "student", STUDENTS, { required: true }),
      rel("rel_sprog_group", "group", GROUPS),
      txt("txt_sprog_title", "title", 300),
      num("num_sprog_year", "year"),
      txt("txt_sprog_season", "season", 20),       // 'summer'
      txt("txt_sprog_examtype", "exam_type", 20),  // 'ege_base' | 'ege_profile'
      json("json_sprog_config", "config"),         // { blocks: [...] }
      json("json_sprog_snapshot", "profile_snapshot"), // слепок слабостей на момент генерации
      txt("txt_sprog_status", "status", 20),        // 'draft' | 'issued' | 'archived'
      created("ad_sprog_c"), updated("ad_sprog_u")
    ],
    "indexes": [
      "CREATE INDEX idx_sprog_owner ON study_programs (owner)",
      "CREATE INDEX idx_sprog_student ON study_programs (student)"
    ],
    ...RULES
  });
  app.save(programs);

  const items = new Collection({
    "id": "pbc_study_program_items", "name": "study_program_items", "type": "base",
    "fields": [
      pk(),
      rel("rel_sitem_program", "program", "pbc_study_programs", { required: true, cascade: true }),
      num("num_sitem_order", "order"),
      txt("txt_sitem_block", "block_type", 20),     // 'algebra' | 'geometry' | 'oral' | 'extra'
      rel("rel_sitem_topic", "topic", TOPICS),
      txt("txt_sitem_ref", "ref_label", 200),       // для geometry/extra/oral (вне topics)
      rel("rel_sitem_session", "session", SESSIONS), // адресная цифровая выдача
      txt("txt_sitem_title", "title", 300),
      json("json_sitem_params", "params"),
      txt("txt_sitem_status", "status", 20),         // 'planned' | 'issued' | 'done'
      created("ad_sitem_c"), updated("ad_sitem_u")
    ],
    "indexes": [
      "CREATE INDEX idx_sitem_program ON study_program_items (program)"
    ],
    ...RULES
  });
  app.save(items);

  console.log("[1779000019] Созданы study_programs + study_program_items");
}, (app) => {
  for (const id of ["pbc_study_program_items", "pbc_study_programs"]) {
    try { app.delete(app.findCollectionByNameOrId(id)); } catch (e) { console.log("[1779000019] откат:", e?.message); }
  }
  console.log("[1779000019] Откачены study_programs/items");
});
