/// <reference path="../pb_data/types.d.ts" />
// Импорт работы целиком из .md (см. WORK_IMPORT_FORMAT.md):
// works.source        — от кого листок («Иванова Н.П., 2026»), из шапки файла;
// works.import_meta   — служебные данные разбора (кол-во задач, предупреждения,
//                       дата импорта) — чтобы потом понять, откуда работа взялась;
// works.original_files — фото/скан оригинала: при спорной формуле всегда можно
//                       свериться с рукописью. Файлы бэкапятся вместе с storage/.
migrate((app) => {
  const col = app.findCollectionByNameOrId('works');

  if (!col.fields.getByName('source')) {
    col.fields.add(new Field({
      'autogeneratePattern': '', 'hidden': false, 'id': 'txt_works_source', 'max': 200, 'min': 0,
      'name': 'source', 'pattern': '', 'presentable': false, 'primaryKey': false,
      'required': false, 'system': false, 'type': 'text',
    }));
  }

  if (!col.fields.getByName('import_meta')) {
    col.fields.add(new Field({
      'hidden': false, 'id': 'json_works_import_meta', 'maxSize': 200000,
      'name': 'import_meta', 'presentable': false, 'required': false,
      'system': false, 'type': 'json',
    }));
  }

  if (!col.fields.getByName('original_files')) {
    col.fields.add(new Field({
      'hidden': false, 'id': 'file_works_original_files', 'name': 'original_files',
      'maxSelect': 6, 'maxSize': 10485760, 'mimeTypes': [], 'thumbs': [],
      'presentable': false, 'protected': false, 'required': false, 'system': false,
      'type': 'file',
    }));
  }

  app.save(col);
  console.log('[1784100000] works: +source, +import_meta, +original_files');
}, (app) => {
  const col = app.findCollectionByNameOrId('works');
  for (const name of ['source', 'import_meta', 'original_files']) {
    const f = col.fields.getByName(name);
    if (f) col.fields.removeById(f.id);
  }
  app.save(col);
  console.log('[1784100000] works: rollback');
});
