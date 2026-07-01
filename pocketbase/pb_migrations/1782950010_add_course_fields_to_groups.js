/// <reference path="../pb_data/types.d.ts" />

// Курсы (онлайн-интенсивы в малых группах): помечаем группу как «курс с кабинетом
// для учеников» и задаём постоянную комнату видеоконференции.
//
//   kind            — 'class' | 'course'. Пусто у старых записей = обычный класс.
//   conference_url  — постоянная ссылка на телемост курса (комната группы).
//                     На уровне урока её можно переопределить (см. lessons.conference_url).
//
// 🚨 Аддитивно: два новых опциональных поля. Существующие данные не меняются.
// down-миграция удаляет поля.

migrate((app) => {
  const col = app.findCollectionByNameOrId("teaching_groups");

  if (!col.fields.getByName("kind")) {
    col.fields.add(new Field({
      "hidden": false, "id": "select_group_kind", "name": "kind", "maxSelect": 1,
      "presentable": false, "required": false, "system": false, "type": "select",
      "values": ["class", "course"]
    }));
  }

  if (!col.fields.getByName("conference_url")) {
    col.fields.add(new Field({
      "autogeneratePattern": "", "hidden": false, "id": "text_group_conf", "max": 1000, "min": 0,
      "name": "conference_url", "pattern": "", "presentable": false, "primaryKey": false,
      "required": false, "system": false, "type": "text"
    }));
  }

  app.save(col);
  console.log("[1782950010] teaching_groups: добавлены kind + conference_url");
}, (app) => {
  const col = app.findCollectionByNameOrId("teaching_groups");
  const k = col.fields.getByName("kind");
  if (k) col.fields.removeById(k.id);
  const c = col.fields.getByName("conference_url");
  if (c) col.fields.removeById(c.id);
  app.save(col);
  console.log("[1782950010] teaching_groups: откат kind + conference_url");
});
