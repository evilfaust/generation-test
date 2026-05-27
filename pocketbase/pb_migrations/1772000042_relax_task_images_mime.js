/// <reference path="../pb_data/types.d.ts" />
// Ослабляем mimeTypes в task_images.file — пустой массив = принимать любые
// типы. Причина: sdamgia.ru за DDoS-guard иногда отдаёт нестандартные форматы
// (image/x-png, application/octet-stream), и PB определяет MIME по magic-bytes
// файла, а не по нашему заявлению. Если файл — мусор (HTML 87 байт от защиты),
// PB всё равно его отвергнет (size/контент-валидация),
// но реальная картинка с экзотическим MIME пройдёт.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_task_images");
  const field = collection.fields.getByName("file");
  if (field) {
    field.mimeTypes = []; // принимать любые
    app.save(collection);
    console.log("[1772000042] task_images.file.mimeTypes очищены");
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_task_images");
  const field = collection.fields.getByName("file");
  if (field) {
    field.mimeTypes = [
      "image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"
    ];
    app.save(collection);
    console.log("[1772000042] откат: восстановлены исходные mimeTypes");
  }
});
