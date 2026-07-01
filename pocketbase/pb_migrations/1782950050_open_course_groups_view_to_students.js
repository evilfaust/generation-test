/// <reference path="../pb_data/types.d.ts" />

// Курсы: ученик должен видеть карточку своего курса (название, комната) в кабинете.
// teaching_groups по умолчанию teacher-only, из-за чего expand 'course' в
// course_members у ученика возвращал пусто. Открываем ТОЛЬКО view и ТОЛЬКО для
// строк kind='course' (обычные классы остаются скрытыми от учеников). listRule НЕ
// трогаем — ученик не может перечислять группы, только просмотреть курс по id
// (через membership/expand). Содержимое курса безопасно (см. lesson_publications).
//
// 🚨 Аддитивно (ослабление view). down возвращает teacher-only view.

const TEACHER = '@request.auth.collectionName = "teachers"';

migrate((app) => {
  const col = app.findCollectionByNameOrId('teaching_groups');
  col.viewRule = `${TEACHER} || kind = "course"`;
  app.save(col);
  console.log('[1782950050] teaching_groups: view курса открыт ученику');
}, (app) => {
  const col = app.findCollectionByNameOrId('teaching_groups');
  col.viewRule = TEACHER;
  app.save(col);
  console.log('[1782950050] teaching_groups: view возвращён teacher-only');
});
