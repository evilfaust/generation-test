/// <reference path="../pb_data/types.d.ts" />

// Добавляем поле last_login в коллекцию teachers — для отслеживания
// последней активности пользователей.
//
// Заполняется из фронтенда после успешного authWithPassword().
// Поле опциональное (null до первого логина после обновления).
//
// Тип: text (ISO 8601 строка). НЕ autodate — обновляется не при изменении
// записи, а при логине (логин не вызывает update).

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_teachers");

  collection.fields.add(new Field({
    "hidden": false,
    "id": "text_teacher_last_login",
    "max": 30,
    "min": 0,
    "name": "last_login",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  app.save(collection);
  console.log("[1779000002] Добавлено поле last_login в teachers");
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_teachers");
  const field = collection.fields.getByName('last_login');
  if (field) {
    collection.fields.removeById(field.id);
    app.save(collection);
    console.log("[1779000002] Удалено поле last_login из teachers");
  }
});
