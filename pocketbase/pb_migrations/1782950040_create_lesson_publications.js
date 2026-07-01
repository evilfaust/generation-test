/// <reference path="../pb_data/types.d.ts" />

// Курсы: витрина урока для ученика (проекция).
//
// Отдельная коллекция, в которую учитель «публикует» урок курса. Сюда попадает
// ТОЛЬКО безопасное и предназначенное ученику: заголовок, дата/слот, ссылка на
// конференцию и items (видимые материалы + ДЗ). Приватная заметка урока (note_md)
// и скрытые материалы сюда физически НЕ копируются — поэтому даже прямой запрос
// к API из DevTools не раскроет скрытое (в отличие от открытия самих lessons).
//
// items (json): [{ kind:'work'|'file'|'text', role:'class'|'homework',
//                  title, session_id?, file_url?, description? }]
//   kind='work'  → ДЗ/материал = уже выданная сессия теста Леммы (ссылка
//                  /student/{session_id}); авто-проверка живёт в самой Лемме.
//   kind='file'  → файл из хранилища (file_url на files.l.oipav.ru).
//   kind='text'  → текстовое задание/заметка для ученика.
//
// one-to-one с lesson (уникальный индекс), cascadeDelete на lesson и group.
//
// Правила: учитель — всё; чтение открыто залогиненному ученику (содержимое
// безопасно, как vacation_campaigns/1779000034). Клиент фильтрует по членству
// в курсе (course_members). Запись — только учитель.
//
// 🚨 Аддитивно. down удаляет коллекцию.

const TEACHERS = "pbc_teachers";
const TEACHER = '@request.auth.collectionName = "teachers"';
const STUDENTS = '@request.auth.collectionName = "students"';

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
function dateField(id, name) {
  return { "hidden": false, "id": id, "name": name, "presentable": false, "required": false, "system": false, "type": "date", "max": "", "min": "" };
}
function jsonField(id, name) {
  return { "hidden": false, "id": id, "name": name, "maxSize": 500000, "presentable": false, "required": false, "system": false, "type": "json" };
}
function boolField(id, name) {
  return { "hidden": false, "id": id, "name": name, "presentable": false, "required": false, "system": false, "type": "bool" };
}
function created(id) { return { "hidden": false, "id": id, "name": "created", "onCreate": true, "onUpdate": false, "presentable": false, "system": false, "type": "autodate" }; }
function updated(id) { return { "hidden": false, "id": id, "name": "updated", "onCreate": true, "onUpdate": true, "presentable": false, "system": false, "type": "autodate" }; }

migrate((app) => {
  const GROUPS = app.findCollectionByNameOrId("teaching_groups").id;
  const LESSONS = app.findCollectionByNameOrId("lessons").id;

  const col = new Collection({
    "id": "pbc_lesson_publications", "name": "lesson_publications", "type": "base",
    "fields": [
      pk(),
      rel("rel_lp_owner", "owner", TEACHERS, { required: true }),
      rel("rel_lp_group", "group", GROUPS, { required: true, cascade: true }),
      rel("rel_lp_lesson", "lesson", LESSONS, { required: true, cascade: true }),
      txt("txt_lp_title", "title", 500),
      dateField("dt_lp_date", "date_plan"),
      txt("txt_lp_slot", "time_slot", 20),
      txt("txt_lp_conf", "conference_url", 1000),
      jsonField("json_lp_items", "items"),
      boolField("bool_lp_published", "published"),
      created("ad_lp_c"), updated("ad_lp_u")
    ],
    "indexes": [
      "CREATE INDEX idx_lesson_pub_group ON lesson_publications (group)",
      "CREATE INDEX idx_lesson_pub_date ON lesson_publications (date_plan)",
      "CREATE UNIQUE INDEX idx_lesson_pub_lesson ON lesson_publications (lesson)"
    ],
    "listRule": `${TEACHER} || ${STUDENTS}`,
    "viewRule": `${TEACHER} || ${STUDENTS}`,
    "createRule": TEACHER,
    "updateRule": TEACHER,
    "deleteRule": TEACHER
  });
  app.save(col);
  console.log("[1782950040] Создана lesson_publications");
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("pbc_lesson_publications")); } catch (e) { /**/ }
  console.log("[1782950040] Откачена lesson_publications");
});
