/// <reference path="../pb_data/types.d.ts" />

// Вложения к решению геометрической задачи (v3.9.95).
//
// solution_files — json-массив ссылок на файлы в файловом хранилище pb-files
// (files.l.oipav.ru): `[{ id, title, url, mime }]`. Чаще всего это фото решения
// с бумаги — учитель прикрепляет картинку вместо набора LaTeX.
//
// 🚨 Аддитивно. Файлы физически живут в pb-files, здесь только ссылки.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    col.fields.add(new JSONField({
      id: 'json_geo_solution_files',
      name: 'solution_files',
      maxSize: 100000,
      required: false,
    }));
    app.save(col);
    console.log('[1779000026] geometry_tasks.solution_files добавлено');
  },
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    col.fields.removeByName('solution_files');
    app.save(col);
    console.log('[1779000026] geometry_tasks.solution_files откачено');
  }
);
