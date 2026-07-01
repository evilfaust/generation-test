/// <reference path="../pb_data/types.d.ts" />

// Курсы: членство ученика в курсе-интенсиве.
//
// Отдельная связка (course, student), НЕ students.teaching_group — ученик может
// одновременно числиться в своём обычном классе и ходить на догоняющий курс.
// active — мягкое отчисление без удаления истории.
//
// Правила: учитель — всё; ученик читает ТОЛЬКО свои строки (student = он сам),
// чтобы в кабинете видеть только свои курсы. Запись — только учитель.
//
// 🚨 Аддитивно. cascadeDelete на course и student. down удаляет коллекцию.

const TEACHERS = "pbc_teachers";
const TEACHER = '@request.auth.collectionName = "teachers"';

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
function boolField(id, name) {
  return { "hidden": false, "id": id, "name": name, "presentable": false, "required": false, "system": false, "type": "bool" };
}
function created(id) { return { "hidden": false, "id": id, "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" }; }
function updated(id) { return { "hidden": false, "id": id, "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" }; }

migrate((app) => {
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;
  const STUDENTS = app.findCollectionByNameOrId("students").id;

  const col = new Collection({
    "id": "pbc_course_members", "name": "course_members", "type": "base",
    "fields": [
      pk(),
      rel("rel_cm_owner", "owner", TEACHERS, { required: true }),
      rel("rel_cm_course", "course", GROUPS, { required: true, cascade: true }),
      rel("rel_cm_student", "student", STUDENTS, { required: true, cascade: true }),
      boolField("bool_cm_active", "active"),
      created("ad_cm_c"), updated("ad_cm_u")
    ],
    "indexes": [
      "CREATE INDEX idx_course_members_course ON course_members (course)",
      "CREATE INDEX idx_course_members_student ON course_members (student)",
      "CREATE UNIQUE INDEX idx_course_members_course_student ON course_members (course, student)"
    ],
    "listRule": `${TEACHER} || @request.auth.id = student`,
    "viewRule": `${TEACHER} || @request.auth.id = student`,
    "createRule": TEACHER,
    "updateRule": TEACHER,
    "deleteRule": TEACHER
  });
  app.save(col);
  console.log("[1782950030] Создана course_members");
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("pbc_course_members")); } catch (e) { /**/ }
  console.log("[1782950030] Откачена course_members");
});
