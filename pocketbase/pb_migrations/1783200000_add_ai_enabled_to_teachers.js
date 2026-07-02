/// <reference path="../pb_data/types.d.ts" />
// ИИ-тумблер (v3.9.117, мультиучительство): teachers.ai_enabled —
// суперадмин включает/выключает ИИ-функции (LLM) конкретному учителю.
// UI-гейт — кнопки LLM-фиксов/сканирования/AI-определений; серверный гейт —
// pdf-service проверяет токен учителя и флаг (env REQUIRE_TEACHER_AI_AUTH=1).
// Бэкфилл: всем существующим учителям ИИ включён.
migrate((app) => {
  const col = app.findCollectionByNameOrId("teachers");

  if (!col.fields.getByName("ai_enabled")) {
    col.fields.add(new Field({
      "hidden": false, "id": "bool_teachers_ai_enabled", "name": "ai_enabled",
      "presentable": false, "required": false, "system": false, "type": "bool"
    }));
    app.save(col);
  }

  app.db().newQuery("UPDATE teachers SET ai_enabled = 1").execute();
  console.log('[migration] teachers: +ai_enabled (backfill = true)');
}, (app) => {
  const col = app.findCollectionByNameOrId("teachers");
  const f = col.fields.getByName("ai_enabled");
  if (f) {
    col.fields.removeById(f.id);
    app.save(col);
  }
});
