/// <reference path="../pb_data/types.d.ts" />

// Ученики «без аккаунта» — вписанные вручную для разовых/внешних занятий
// (продвинутые ученики чужих преподавателей). Флаг students.external (bool).
// Такие записи нужны только для заметок/посещаемости (фиксация продвижения),
// тесты/ДЗ им не выдаются. Скрываются из журнала сдачи и дашборда прогресса.
//
// 🚨 Аддитивно, nullable. Down-миграция удаляет поле.
migrate((app) => {
  const c = app.findCollectionByNameOrId('students');
  if (!c.fields.getByName('external')) {
    c.fields.add(new Field({
      'hidden': false, 'id': 'bool_student_external', 'name': 'external',
      'presentable': false, 'required': false, 'system': false, 'type': 'bool',
    }));
    app.save(c);
  }
  console.log('[1779000025] students: +external');
}, (app) => {
  const c = app.findCollectionByNameOrId('students');
  const f = c.fields.getByName('external');
  if (f) { c.fields.removeById(f.id); app.save(c); }
  console.log('[1779000025] students: -external');
});
