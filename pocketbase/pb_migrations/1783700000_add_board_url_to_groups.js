/// <reference path="../pb_data/types.d.ts" />

// Курсы: постоянная ссылка на онлайн-доску курса (Miro/Excalidraw/сберджаз и т.п.),
// по аналогии с conference_url. Задаётся в форме группы (kind=course), видна
// ученикам курса (viewRule teaching_groups уже открыт для kind="course",
// см. 1782950050) — кнопка «Доска» в StudentCoursePortal.
//
// 🚨 Аддитивно: одно новое опциональное поле. Существующие данные не меняются.
// down-миграция удаляет поле.

migrate((app) => {
  const col = app.findCollectionByNameOrId("teaching_groups");

  if (!col.fields.getByName("board_url")) {
    col.fields.add(new Field({
      "autogeneratePattern": "", "hidden": false, "id": "text_group_board", "max": 1000, "min": 0,
      "name": "board_url", "pattern": "", "presentable": false, "primaryKey": false,
      "required": false, "system": false, "type": "text"
    }));
  }

  app.save(col);
  console.log("[1783700000] teaching_groups: добавлен board_url (онлайн-доска курса)");
}, (app) => {
  const col = app.findCollectionByNameOrId("teaching_groups");
  const f = col.fields.getByName("board_url");
  if (f) col.fields.removeById(f.id);
  app.save(col);
  console.log("[1783700000] teaching_groups: откат board_url");
});
