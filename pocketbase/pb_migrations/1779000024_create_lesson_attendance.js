/// <reference path="../pb_data/types.d.ts" />

// Учительское фло: посещаемость уроков (lesson_attendance).
//
// По строке на (урок, ученик). Список учеников урока НЕ дублируется — он берётся
// из группы урока (lessons.group → teaching_groups, students.teaching_group).
// Эта коллекция хранит только СОСТОЯНИЕ на конкретный урок: был/отсутствовал/
// опоздал/уважительная. Строки создаются лениво — только когда учитель отметил.
//
// cascadeDelete на lesson и student: удалили урок или ученика → отметки ушли.
// Уникальный индекс (lesson, student) — одна отметка на ученика в уроке (upsert).
//
// 🚨 Аддитивно. Down-миграция удаляет коллекцию. Правила — логин учителя.

const TEACHERS = "pbc_teachers";

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
  const LESSONS = app.findCollectionByNameOrId("lessons").id;

  const attendance = new Collection({
    "id": "pbc_lesson_attendance", "name": "lesson_attendance", "type": "base",
    "fields": [
      pk(),
      rel("rel_att_owner", "owner", TEACHERS, { required: true }),
      rel("rel_att_lesson", "lesson", LESSONS, { required: true, cascade: true }),
      rel("rel_att_student", "student", STUDENTS, { required: true, cascade: true }),
      {
        "hidden": false, "id": "select_att_status", "maxSelect": 1, "name": "status",
        "presentable": false, "required": false, "system": false, "type": "select",
        "values": ["present", "absent", "late", "excused"]
      },
      created("ad_att_c"), updated("ad_att_u")
    ],
    "indexes": [
      "CREATE INDEX idx_lesson_attendance_lesson ON lesson_attendance (lesson)",
      "CREATE INDEX idx_lesson_attendance_student ON lesson_attendance (student)",
      "CREATE UNIQUE INDEX idx_lesson_attendance_lesson_student ON lesson_attendance (lesson, student)"
    ],
    ...RULES
  });
  app.save(attendance);
  console.log("[1779000024] Создана коллекция lesson_attendance");
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("pbc_lesson_attendance"));
  } catch (e) {
    console.log("[1779000024] откат:", e?.message);
  }
  console.log("[1779000024] Откачена коллекция lesson_attendance");
});
