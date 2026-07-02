/// <reference path="../pb_data/types.d.ts" />
// Мультиучительство, этап 2 (v3.9.117): настоящие серверные правила PocketBase.
// До этого защита была UI-only (правила публичные) — приемлемо для одного
// учителя, недопустимо при открытии платформы.
//
// Принципы:
// • Ученические пути НЕ ломаем: attempts/attempt_answers/variants/students/
//   achievements не трогаем вообще; view публичный там, где ученик читает
//   запись по id или через expand (works, work_sessions, mc_tests);
//   студенческие клаузы (кампании, программы, курсы) сохранены дословно.
// • Старый задеплоенный фронт (до v3.9.117) продолжает работать: create не
//   требует owner (запись без owner редактируема любым editor'ом и видна
//   superadmin'у), evilfaust = superadmin → полный доступ.
// • Банк (tasks/topics/theory/tdf/geometry/листки) читается как раньше,
//   но ПИСАТЬ теперь могут только учителя с ролью editor+ (не viewer, не аноним).
// • Личное скоупится владельцем; superadmin видит и правит всё.
//
// Откат: down() восстанавливает правила из снапшота прода от 02.07.2026
// (scratchpad rules_snapshot.json; актуальный бэкап БД сделан перед применением).

const T  = '@request.auth.collectionName = "teachers"';
const NV = '@request.auth.role != "viewer"';
const OWN = '(owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")';
const COURSE_OWN = '(course.owner = @request.auth.id || course.owner = "" || @request.auth.role = "superadmin")';
const PROGRAM_OWN = '(program.owner = @request.auth.id || program.owner = "" || @request.auth.role = "superadmin")';
const TEAMSET_OWN = '(team_set.owner = @request.auth.id || team_set.owner = "" || @request.auth.role = "superadmin")';

// Личные материалы учителя (ученикам не нужны)
const PRIVATE_TEACHER = [
  'cards', 'marathons', 'qr_worksheets', 'pixel_art_worksheets',
  'unit_circle_worksheets', 'trig_values_worksheets', 'cryptograms',
  'route_sheets', 'formula_sheets', 'geometry_print_tests', 'pixel_art_team_sets',
];

// Общий банк: чтение как раньше (публичное), запись — editor+
const BANK_WRITE_PROTECT = [
  'tasks', 'task_images', 'task_contexts', 'topics', 'subtopics', 'tags',
  'theory_categories', 'theory_articles', 'tdf_sets', 'tdf_items', 'tdf_variants',
  'geometry_topics', 'geometry_subtopics', 'geometry_tasks', 'geometry_tags',
  'pixel_art_images', 'task_families', 'task_family_members',
  'listok_sheets', 'listok_items',
];

// Личное «Моё пространство» с owner (было: только логин учителя)
const WORKSPACE_OWNED = [
  'lessons', 'teacher_notes', 'teacher_todos', 'todo_folders',
  'lesson_attendance', 'courses',
];

const NEW_RULES = {};

for (const name of PRIVATE_TEACHER) {
  NEW_RULES[name] = {
    listRule: `${T} && ${OWN}`,
    viewRule: T,
    createRule: `${T} && ${NV}`,
    updateRule: `${T} && ${NV} && ${OWN}`,
    deleteRule: `${T} && ${NV} && ${OWN}`,
  };
}

for (const name of BANK_WRITE_PROTECT) {
  NEW_RULES[name] = {
    createRule: `${T} && ${NV}`,
    updateRule: `${T} && ${NV}`,
    deleteRule: `${T} && ${NV}`,
  };
}

for (const name of WORKSPACE_OWNED) {
  NEW_RULES[name] = {
    listRule: `${T} && ${OWN}`,
    viewRule: `${T} && ${OWN}`,
    createRule: `${T} && ${NV}`,
    updateRule: `${T} && ${NV} && ${OWN}`,
    deleteRule: `${T} && ${NV} && ${OWN}`,
  };
}

// Видны ученикам по id/expand (view публичный), списки/запись — учительские
for (const name of ['works', 'work_sessions', 'mc_tests']) {
  NEW_RULES[name] = {
    listRule: `${T} && ${OWN}`,
    viewRule: '',
    createRule: `${T} && ${NV}`,
    updateRule: `${T} && ${NV} && ${OWN}`,
    deleteRule: `${T} && ${NV} && ${OWN}`,
  };
}

// Спец-случаи
NEW_RULES.pixel_art_team_tiles = {
  listRule: T,
  viewRule: T,
  createRule: `${T} && ${NV} && ${TEAMSET_OWN}`,
  updateRule: `${T} && ${NV} && ${TEAMSET_OWN}`,
  deleteRule: `${T} && ${NV} && ${TEAMSET_OWN}`,
};

NEW_RULES.ktp_entries = {
  listRule: `${T} && ${COURSE_OWN}`,
  viewRule: `${T} && ${COURSE_OWN}`,
  createRule: `${T} && ${NV}`,
  updateRule: `${T} && ${NV} && ${COURSE_OWN}`,
  deleteRule: `${T} && ${NV} && ${COURSE_OWN}`,
};

// Курсы-витрины: студенческие клаузы сохранены
NEW_RULES.teaching_groups = {
  listRule: `${T} && ${OWN}`,
  viewRule: `(${T} && ${OWN}) || kind = "course"`,
  createRule: `${T} && ${NV}`,
  updateRule: `${T} && ${NV} && ${OWN}`,
  deleteRule: `${T} && ${NV} && ${OWN}`,
};

NEW_RULES.course_members = {
  listRule: `(${T} && ${COURSE_OWN}) || @request.auth.id = student`,
  viewRule: `(${T} && ${COURSE_OWN}) || @request.auth.id = student`,
  createRule: `${T} && ${NV}`,
  updateRule: `${T} && ${NV} && ${COURSE_OWN}`,
  deleteRule: `${T} && ${NV} && ${COURSE_OWN}`,
};

NEW_RULES.lesson_publications = {
  createRule: `${T} && ${NV}`,
  updateRule: `${T} && ${NV}`,
  deleteRule: `${T} && ${NV}`,
};

NEW_RULES.study_programs = {
  listRule: `(${T} && ${OWN}) || @request.auth.id = student`,
  viewRule: `(${T} && ${OWN}) || @request.auth.id = student`,
  createRule: `${T} && ${NV}`,
  updateRule: `${T} && ${NV} && ${OWN}`,
  deleteRule: `${T} && ${NV} && ${OWN}`,
};

NEW_RULES.study_program_items = {
  listRule: `(${T} && ${PROGRAM_OWN}) || @request.auth.id = program.student`,
  viewRule: `(${T} && ${PROGRAM_OWN}) || @request.auth.id = program.student`,
  createRule: `${T} && ${NV}`,
  updateRule: `${T} && ${NV} && ${PROGRAM_OWN}`,
  deleteRule: `${T} && ${NV} && ${PROGRAM_OWN}`,
};

NEW_RULES.vacation_campaigns = {
  listRule: `(${T} && ${OWN}) || @request.auth.collectionName = "students"`,
  viewRule: `(${T} && ${OWN}) || @request.auth.collectionName = "students"`,
  createRule: `${T} && ${NV}`,
  updateRule: `${T} && ${NV} && ${OWN}`,
  deleteRule: `${T} && ${NV} && ${OWN}`,
};

// ── Снапшот старых правил (прод, 02.07.2026) — для down() ──────────────────
const OLD_T = '@request.auth.collectionName = "teachers"';
const OLD_RULES = {};
// Всё публичное ("" во всех пяти правилах):
for (const name of [
  ...PRIVATE_TEACHER, ...BANK_WRITE_PROTECT,
  'works', 'work_sessions', 'mc_tests', 'pixel_art_team_tiles',
]) {
  OLD_RULES[name] = { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' };
}
// Workspace: только логин учителя
for (const name of [...WORKSPACE_OWNED, 'ktp_entries']) {
  OLD_RULES[name] = {
    listRule: OLD_T, viewRule: OLD_T, createRule: OLD_T, updateRule: OLD_T, deleteRule: OLD_T,
  };
}
OLD_RULES.teaching_groups = {
  listRule: OLD_T, viewRule: `${OLD_T} || kind = "course"`,
  createRule: OLD_T, updateRule: OLD_T, deleteRule: OLD_T,
};
OLD_RULES.course_members = {
  listRule: `${OLD_T} || @request.auth.id = student`,
  viewRule: `${OLD_T} || @request.auth.id = student`,
  createRule: OLD_T, updateRule: OLD_T, deleteRule: OLD_T,
};
OLD_RULES.lesson_publications = {
  createRule: OLD_T, updateRule: OLD_T, deleteRule: OLD_T,
};
OLD_RULES.study_programs = {
  listRule: `${OLD_T} || @request.auth.id = student`,
  viewRule: `${OLD_T} || @request.auth.id = student`,
  createRule: OLD_T, updateRule: OLD_T, deleteRule: OLD_T,
};
OLD_RULES.study_program_items = {
  listRule: `${OLD_T} || @request.auth.id = program.student`,
  viewRule: `${OLD_T} || @request.auth.id = program.student`,
  createRule: OLD_T, updateRule: OLD_T, deleteRule: OLD_T,
};
OLD_RULES.vacation_campaigns = {
  listRule: `${OLD_T} || @request.auth.collectionName = "students"`,
  viewRule: `${OLD_T} || @request.auth.collectionName = "students"`,
  createRule: OLD_T, updateRule: OLD_T, deleteRule: OLD_T,
};

function applyRules(app, rulesMap) {
  for (const [name, rules] of Object.entries(rulesMap)) {
    let col;
    try {
      col = app.findCollectionByNameOrId(name);
    } catch (_) {
      console.log(`[rules] коллекция ${name} не найдена — пропуск`);
      continue;
    }
    for (const [key, val] of Object.entries(rules)) {
      col[key] = val;
    }
    app.save(col);
  }
}

migrate((app) => {
  applyRules(app, NEW_RULES);
  console.log(`[migration] правила мультиучительства применены к ${Object.keys(NEW_RULES).length} коллекциям`);
}, (app) => {
  applyRules(app, OLD_RULES);
});
