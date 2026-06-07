/// <reference path="../pb_data/types.d.ts" />

// Учительское фло, фаза 2: дедлайн на сессии выдачи (work_sessions.deadline).
//
// Аддитивно: новое nullable date-поле. Существующие данные не меняются.
// 0/пусто = без дедлайна (как раньше). Используется «журналом сдачи» (GradeJournal)
// для статуса «сдал вовремя / просрочено» и в SessionPanel при выдаче.

migrate((app) => {
  const ws = app.findCollectionByNameOrId("work_sessions");
  if (!ws.fields.getByName("deadline")) {
    ws.fields.add(new Field({
      "hidden": false,
      "id": "date_session_deadline",
      "name": "deadline",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date",
      "min": "",
      "max": ""
    }));
    app.save(ws);
  }
  console.log("[1779000011] work_sessions: +deadline");
}, (app) => {
  const ws = app.findCollectionByNameOrId("work_sessions");
  const f = ws.fields.getByName("deadline");
  if (f) {
    ws.fields.removeById(f.id);
    app.save(ws);
  }
  console.log("[1779000011] откат work_sessions.deadline");
});
