/// <reference path="../pb_data/types.d.ts" />

// Сохранённые листы генераторов (v3.9.160).
//
// Одна запись = один лист целиком: настройки генератора + все варианты заданий +
// порядок заданий на листе. НЕ задачи банка: задание генератора («2x = 18»,
// «sin 30°») не самостоятельно — у него нет темы, кода, разбора, статистики
// решаемости и вектора. Класть такие в `tasks` — засорять банк и ломать
// аналитику/дедуп (так уже вышло с source='trig_generator' от MC-тестов).
//
// Обобщает частные `unit_circle_worksheets` / `trig_values_worksheets`
// (там та же пара settings+tasks_data, но по коллекции на генератор).
//
// tasks_data — снимок, а не seed: генераторы не seeded (Math.random), и учитель
// правит отдельные задания руками. Формы две (поле `kind`):
//   flat     — Variant[][], задание = { exprLatex, resultLatex, cat, ... }
//   sections — [{ number, sections: [{ id, label, tasks: [...] }] }] (смешанные работы)
//
// 🚨 Аддитивно: новая коллекция, существующие данные не трогаются.
// Правила — как у прочих личных материалов учителя (PRIVATE_TEACHER,
// миграция 1783300000): список свой, правка/удаление — владелец, editor+.

migrate((app) => {
  const T   = '@request.auth.collectionName = "teachers"';
  const NV  = '@request.auth.role != "viewer"';
  const OWN = '(owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")';

  const sheets = new Collection({
    'id': 'pbc_generator_sheets',
    'name': 'generator_sheets',
    'type': 'base',
    'fields': [
      {
        'autogeneratePattern': '[a-z0-9]{15}', 'hidden': false, 'id': 'text3208210256',
        'max': 15, 'min': 15, 'name': 'id', 'pattern': '^[a-z0-9]+$',
        'presentable': false, 'primaryKey': true, 'required': true, 'system': true, 'type': 'text',
      },
      {
        'hidden': false, 'id': 'rel_gsheet_owner', 'name': 'owner', 'presentable': false,
        'required': false, 'system': false, 'type': 'relation',
        'collectionId': 'pbc_teachers', 'cascadeDelete': false, 'minSelect': 0, 'maxSelect': 1,
      },
      {
        'autogeneratePattern': '', 'hidden': false, 'id': 'text_gsheet_title',
        'max': 300, 'min': 0, 'name': 'title', 'pattern': '',
        'presentable': true, 'primaryKey': false, 'required': true, 'system': false, 'type': 'text',
      },
      // Тип генератора: 'linear_equations', 'oral_counting', 'trig_expressions', …
      // Свободный текст, а не select — новый генератор не должен требовать миграции.
      {
        'autogeneratePattern': '', 'hidden': false, 'id': 'text_gsheet_generator',
        'max': 60, 'min': 1, 'name': 'generator', 'pattern': '',
        'presentable': false, 'primaryKey': false, 'required': true, 'system': false, 'type': 'text',
      },
      {
        'hidden': false, 'id': 'select_gsheet_kind', 'name': 'kind',
        'presentable': false, 'required': false, 'system': false, 'type': 'select',
        'maxSelect': 1, 'values': ['flat', 'sections'],
      },
      {
        'hidden': false, 'id': 'json_gsheet_settings', 'maxSize': 200000,
        'name': 'settings', 'presentable': false, 'required': false,
        'system': false, 'type': 'json',
      },
      // Порядок заданий и разделительные черты (useSheetLayout)
      {
        'hidden': false, 'id': 'json_gsheet_layout', 'maxSize': 100000,
        'name': 'layout', 'presentable': false, 'required': false,
        'system': false, 'type': 'json',
      },
      // Сами задания. 32 варианта × 30 заданий ≈ 200 КБ — берём запас.
      {
        'hidden': false, 'id': 'json_gsheet_tasks', 'maxSize': 4000000,
        'name': 'tasks_data', 'presentable': false, 'required': false,
        'system': false, 'type': 'json',
      },
      {
        'hidden': false, 'id': 'num_gsheet_variants', 'name': 'variants_count',
        'presentable': false, 'required': false, 'system': false, 'type': 'number', 'onlyInt': true,
      },
      {
        'hidden': false, 'id': 'num_gsheet_questions', 'name': 'questions_count',
        'presentable': false, 'required': false, 'system': false, 'type': 'number', 'onlyInt': true,
      },
      {
        'hidden': false, 'id': 'num_gsheet_class', 'name': 'class_number',
        'presentable': false, 'required': false, 'system': false, 'type': 'number', 'onlyInt': true,
      },
      // Папки-ярлыки и закрепление — как у works (миграции 1779000022/023)
      {
        'autogeneratePattern': '', 'hidden': false, 'id': 'text_gsheet_folder',
        'max': 100, 'min': 0, 'name': 'folder', 'pattern': '',
        'presentable': false, 'primaryKey': false, 'required': false, 'system': false, 'type': 'text',
      },
      {
        'hidden': false, 'id': 'bool_gsheet_pinned', 'name': 'is_pinned',
        'presentable': false, 'required': false, 'system': false, 'type': 'bool',
      },
      {
        'autogeneratePattern': '', 'hidden': false, 'id': 'text_gsheet_note',
        'max': 2000, 'min': 0, 'name': 'note', 'pattern': '',
        'presentable': false, 'primaryKey': false, 'required': false, 'system': false, 'type': 'text',
      },
      {
        'hidden': false, 'id': 'autodate_gsheet_created', 'name': 'created',
        'onCreate': true, 'onUpdate': false, 'presentable': false, 'system': false, 'type': 'autodate',
      },
      {
        'hidden': false, 'id': 'autodate_gsheet_updated', 'name': 'updated',
        'onCreate': true, 'onUpdate': true, 'presentable': false, 'system': false, 'type': 'autodate',
      },
    ],
    'indexes': [
      'CREATE INDEX idx_generator_sheets_owner ON generator_sheets (owner)',
      'CREATE INDEX idx_generator_sheets_generator ON generator_sheets (generator)',
    ],
    'listRule':   `${T} && ${OWN}`,
    'viewRule':   T,
    'createRule': `${T} && ${NV}`,
    'updateRule': `${T} && ${NV} && ${OWN}`,
    'deleteRule': `${T} && ${NV} && ${OWN}`,
  });

  app.save(sheets);
  console.log('[1784200000] Создана коллекция generator_sheets');
}, (app) => {
  app.delete(app.findCollectionByNameOrId('pbc_generator_sheets'));
  console.log('[1784200000] Откачена коллекция generator_sheets');
});
