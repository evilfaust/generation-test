/// <reference path="../pb_data/types.d.ts" />
// Добавляет значение "oge" (ОГЭ 9 класс) в select-поле exam_type коллекции topics.
// Не деструктивно: расширяем список допустимых значений, существующие темы не трогаем.
// Темы ОГЭ создаются на лету через импортёр (как у ЕГЭ), здесь только инфраструктура.
migrate((app) => {
  const topics = app.findCollectionByNameOrId("topics");

  // Пересохраняем поле с тем же id — PocketBase обновляет его на месте.
  topics.fields.add(new Field({
    "id":          "select_topics_exam_type",
    "name":        "exam_type",
    "type":        "select",
    "required":    false,
    "presentable": false,
    "hidden":      false,
    "system":      false,
    "maxSelect":   1,
    "values":      ["ege_base", "ege_profile", "oge", "mordkovich", "oral", "vpr", "trig", "other"]
  }));

  app.save(topics);
  console.log('Added "oge" to topics.exam_type select values');
}, (app) => {
  // Откат: убираем "oge" из списка значений.
  const topics = app.findCollectionByNameOrId("topics");

  topics.fields.add(new Field({
    "id":          "select_topics_exam_type",
    "name":        "exam_type",
    "type":        "select",
    "required":    false,
    "presentable": false,
    "hidden":      false,
    "system":      false,
    "maxSelect":   1,
    "values":      ["ege_base", "ege_profile", "mordkovich", "oral", "vpr", "trig", "other"]
  }));

  app.save(topics);
  console.log('Rolled back: removed "oge" from topics.exam_type');
});
