/// <reference path="../pb_data/types.d.ts" />

// Ученик видит «общее задание класса» (template_config.blocks кампании) в своём
// кабинете. Для этого открываем чтение (list/view) vacation_campaigns залогиненному
// ученику. Запись (create/update/delete) — по-прежнему только учитель.
//
// Правило аддитивное (ослабление чтения). Безопасность платформы — UI-only
// (см. корневой CLAUDE.md § Security): содержимое кампании = описание задания,
// ссылки и файлы, не персональные данные. Доступ открыт любому залогиненному
// ученику — это согласуется с тем, как открыты study_programs/items в 1779000021.
// down возвращает teacher-only.

const TEACHER = '@request.auth.collectionName = "teachers"';
const STUDENTS = '@request.auth.collectionName = "students"';

migrate((app) => {
  const col = app.findCollectionByNameOrId('pbc_vacation_campaigns');
  col.listRule = `${TEACHER} || ${STUDENTS}`;
  col.viewRule = `${TEACHER} || ${STUDENTS}`;
  app.save(col);
  console.log('[1779000034] Открыто чтение vacation_campaigns ученику');
}, (app) => {
  const col = app.findCollectionByNameOrId('pbc_vacation_campaigns');
  col.listRule = TEACHER;
  col.viewRule = TEACHER;
  app.save(col);
  console.log('[1779000034] Возврат vacation_campaigns к teacher-only');
});
