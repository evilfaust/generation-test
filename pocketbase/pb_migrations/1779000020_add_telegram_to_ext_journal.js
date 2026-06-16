/// <reference path="../pb_data/types.d.ts" />

// Аддитивно: telegram_id в ext_journal_results / ext_journal_task_results.
// Источник — students.telegram_id журнала (ege-journal), пушится sync-скриптом.
// Нужен, чтобы профиль слабостей джойнил Lemma students.telegram_id ↔ внешние строки
// по железному ключу (имя — фолбэк). Формат как в журнале: text, цифры, max 32.

function tg(id) {
  return {
    "autogeneratePattern": "", "hidden": false, "id": id, "max": 32, "min": 0,
    "name": "telegram_id", "pattern": "^[0-9]*$", "presentable": false,
    "primaryKey": false, "required": false, "system": false, "type": "text"
  };
}

migrate((app) => {
  for (const [colId, fieldId] of [
    ["pbc_ext_journal_results", "txt_extres_tg"],
    ["pbc_ext_journal_task_results", "txt_exttask_tg"],
  ]) {
    const col = app.findCollectionByNameOrId(colId);
    if (!col.fields.getByName("telegram_id")) {
      col.fields.add(new Field(tg(fieldId)));
      app.save(col);
    }
  }
  console.log("[1779000020] Добавлен telegram_id в ext_journal_results/task_results");
}, (app) => {
  for (const colId of ["pbc_ext_journal_results", "pbc_ext_journal_task_results"]) {
    try {
      const col = app.findCollectionByNameOrId(colId);
      const f = col.fields.getByName("telegram_id");
      if (f) { col.fields.removeById(f.id); app.save(col); }
    } catch (e) { console.log("[1779000020] откат:", e?.message); }
  }
  console.log("[1779000020] Убран telegram_id из ext_journal_*");
});
