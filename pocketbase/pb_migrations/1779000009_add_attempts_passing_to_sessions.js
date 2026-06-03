/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const ws = app.findCollectionByNameOrId("work_sessions");

  // Максимум попыток на ученика. 0 = функция выключена (как раньше — 1 попытка).
  // >=2 — ученик может пройти работу повторно (новый вариант по round-robin).
  if (!ws.fields.getByName("max_attempts")) {
    ws.fields.add(new Field({
      name: "max_attempts",
      type: "number",
      required: false,
      onlyInt: true,
      min: 0,
    }));
  }

  // Проходной балл (число верных задач). 0 = функция выключена.
  if (!ws.fields.getByName("passing_score")) {
    ws.fields.add(new Field({
      name: "passing_score",
      type: "number",
      required: false,
      onlyInt: true,
      min: 0,
    }));
  }

  app.save(ws);
  console.log('[migration] work_sessions: +max_attempts, +passing_score');
}, (app) => {
  const ws = app.findCollectionByNameOrId("work_sessions");
  const ma = ws.fields.getByName("max_attempts");
  if (ma) ws.fields.removeById(ma.id);
  const ps = ws.fields.getByName("passing_score");
  if (ps) ws.fields.removeById(ps.id);
  app.save(ws);
});
