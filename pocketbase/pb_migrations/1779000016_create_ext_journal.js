/// <reference path="../pb_data/types.d.ts" />

// Интеграция с ege-journal: приёмные коллекции для внешних результатов решу.ЕГЭ.
// Заполняются ПУШЕМ из локального ege-journal (дома) под отдельным sync-аккаунтом
// (teachers, role=editor). Lemma их только читает (вкладка «Решу» в журнале).
//
// Ключи идемпотентности (используются sync-скриптом журнала при upsert):
//   exams        — (owner, exam_id)
//   results      — (owner, exam_id, student_name)
//   task_results — (owner, exam_id, student_name, task_number)
//
// 🚨 Аддитивно. Правила — логин учителя. Down-миграция удаляет все три.

const TEACHERS = "pbc_teachers";

function ownerField(id) {
  return {
    "hidden": false, "id": id, "name": "owner", "presentable": false,
    "required": true, "system": false, "type": "relation",
    "collectionId": TEACHERS, "cascadeDelete": false, "minSelect": 1, "maxSelect": 1
  };
}
function pk() {
  return {
    "autogeneratePattern": "[a-z0-9]{15}", "hidden": false, "id": "text3208210256",
    "max": 15, "min": 15, "name": "id", "pattern": "^[a-z0-9]+$",
    "presentable": false, "primaryKey": true, "required": true, "system": true, "type": "text"
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
function boolean(id, name) {
  return { "hidden": false, "id": id, "name": name, "presentable": false,
    "required": false, "system": false, "type": "bool" };
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
  const exams = new Collection({
    "id": "pbc_ext_journal_exams", "name": "ext_journal_exams", "type": "base",
    "fields": [
      pk(),
      ownerField("rel_extexam_owner"),
      txt("txt_extexam_examid", "exam_id", 50),
      txt("txt_extexam_title", "title", 300),
      txt("txt_extexam_date", "date", 30),
      txt("txt_extexam_group", "group_name", 100),
      txt("txt_extexam_source", "source", 50),
      created("ad_extexam_c"), updated("ad_extexam_u")
    ],
    "indexes": ["CREATE INDEX idx_extexam_owner_exam ON ext_journal_exams (owner, exam_id)"],
    ...RULES
  });
  app.save(exams);

  const results = new Collection({
    "id": "pbc_ext_journal_results", "name": "ext_journal_results", "type": "base",
    "fields": [
      pk(),
      ownerField("rel_extres_owner"),
      txt("txt_extres_examid", "exam_id", 50),
      txt("txt_extres_student", "student_name", 200),
      txt("txt_extres_group", "group_name", 100),
      num("num_extres_grade", "grade"),
      num("num_extres_correct", "correct_count"),
      num("num_extres_part1", "part1_score"),
      boolean("bool_extres_dnt", "did_not_take"),
      created("ad_extres_c"), updated("ad_extres_u")
    ],
    "indexes": ["CREATE INDEX idx_extres_owner_exam_stud ON ext_journal_results (owner, exam_id, student_name)"],
    ...RULES
  });
  app.save(results);

  const tasks = new Collection({
    "id": "pbc_ext_journal_task_results", "name": "ext_journal_task_results", "type": "base",
    "fields": [
      pk(),
      ownerField("rel_exttask_owner"),
      txt("txt_exttask_examid", "exam_id", 50),
      txt("txt_exttask_student", "student_name", 200),
      num("num_exttask_tasknum", "task_number"),
      txt("txt_exttask_problem", "problem_id", 50),
      boolean("bool_exttask_correct", "is_correct"),
      created("ad_exttask_c"), updated("ad_exttask_u")
    ],
    "indexes": ["CREATE INDEX idx_exttask_owner_exam_stud_task ON ext_journal_task_results (owner, exam_id, student_name, task_number)"],
    ...RULES
  });
  app.save(tasks);

  console.log("[1779000016] Созданы ext_journal_exams/results/task_results");
}, (app) => {
  for (const id of ["pbc_ext_journal_task_results", "pbc_ext_journal_results", "pbc_ext_journal_exams"]) {
    try { app.delete(app.findCollectionByNameOrId(id)); } catch (e) { console.log("[1779000016] откат:", e?.message); }
  }
  console.log("[1779000016] Откачены ext_journal_*");
});
