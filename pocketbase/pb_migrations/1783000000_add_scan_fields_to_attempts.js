/// <reference path="../pb_data/types.d.ts" />
// Сканирование бумажных бланков ответов №1 (v3.9.116):
// attempts.source — откуда попытка: пусто/student = ученический интерфейс,
//   scan = учитель сфотографировал заполненный бланк и записал результат вручную
//   после верификации распознанных ответов.
// attempts.blank_photo — фото бланка (для спорных случаев).
migrate((app) => {
  const col = app.findCollectionByNameOrId("attempts");

  if (!col.fields.getByName("source")) {
    col.fields.add(new Field({
      "hidden": false, "id": "select_attempts_source", "name": "source", "maxSelect": 1,
      "presentable": false, "required": false, "system": false, "type": "select",
      "values": ["student", "scan"]
    }));
  }

  if (!col.fields.getByName("blank_photo")) {
    col.fields.add(new Field({
      "hidden": false, "id": "file_attempts_blank_photo", "name": "blank_photo",
      "maxSelect": 1, "maxSize": 10485760, "mimeTypes": [], "thumbs": [],
      "presentable": false, "protected": false, "required": false, "system": false,
      "type": "file"
    }));
  }

  app.save(col);
  console.log('[migration] attempts: +source, +blank_photo');
}, (app) => {
  const col = app.findCollectionByNameOrId("attempts");
  const s = col.fields.getByName("source");
  if (s) col.fields.removeById(s.id);
  const bp = col.fields.getByName("blank_photo");
  if (bp) col.fields.removeById(bp.id);
  app.save(col);
});
