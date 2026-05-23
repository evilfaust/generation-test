/// <reference path="../pb_data/types.d.ts" />

// Добавляем поле avatar в коллекцию teachers — аватарка пользователя.
//
// File field, max 2MB, только изображения. Опциональное.
// Превью генерирует PocketBase: ?thumb=64x64 для UserMenu, ?thumb=120x120
// для UserManager и AuditLog.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_teachers");

  collection.fields.add(new Field({
    "hidden": false,
    "id": "file_teacher_avatar",
    "name": "avatar",
    "maxSelect": 1,
    "maxSize": 2097152,             // 2 MB
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml"
    ],
    "thumbs": ["64x64", "120x120"],
    "protected": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "file"
  }));

  app.save(collection);
  console.log("[1779000003] Добавлено поле avatar в teachers");
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_teachers");
  const field = collection.fields.getByName('avatar');
  if (field) {
    collection.fields.removeById(field.id);
    app.save(collection);
    console.log("[1779000003] Удалено поле avatar из teachers");
  }
});
