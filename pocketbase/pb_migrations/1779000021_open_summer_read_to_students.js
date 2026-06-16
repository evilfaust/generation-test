/// <reference path="../pb_data/types.d.ts" />

// Фаза B: ученик видит СВОЮ летнюю программу в ученическом приложении.
// Открываем чтение (list/view) study_programs и study_program_items залогиненному
// ученику для его собственных записей. Запись (create/update/delete) — по-прежнему
// только учитель. Аддитивно (ослабление чтения); down возвращает teacher-only.

const TEACHER = '@request.auth.collectionName = "teachers"';

migrate((app) => {
  // study_programs: учитель ИЛИ сам ученик (student = он).
  const progs = app.findCollectionByNameOrId('pbc_study_programs');
  progs.listRule = `${TEACHER} || @request.auth.id = student`;
  progs.viewRule = `${TEACHER} || @request.auth.id = student`;
  app.save(progs);

  // study_program_items: учитель ИЛИ ученик-владелец родительской программы.
  const items = app.findCollectionByNameOrId('pbc_study_program_items');
  items.listRule = `${TEACHER} || @request.auth.id = program.student`;
  items.viewRule = `${TEACHER} || @request.auth.id = program.student`;
  app.save(items);

  console.log('[1779000021] Открыто чтение summer-программ ученику (self)');
}, (app) => {
  const progs = app.findCollectionByNameOrId('pbc_study_programs');
  progs.listRule = TEACHER; progs.viewRule = TEACHER;
  app.save(progs);
  const items = app.findCollectionByNameOrId('pbc_study_program_items');
  items.listRule = TEACHER; items.viewRule = TEACHER;
  app.save(items);
  console.log('[1779000021] Возврат summer-правил к teacher-only');
});
