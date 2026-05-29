/// <reference path="../pb_data/types.d.ts" />
// Добавляем значение 'reviewed_not_dup' в select task_families.type.
// Нужно для кнопки «Не дубли» в дедуп-вкладке: кластер помечается просмотренным
// (не дубль) и больше не возвращается в очередь ревью.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_task_families");
  const field = collection.fields.getByName("type");
  if (field && !field.values.includes("reviewed_not_dup")) {
    field.values = [...field.values, "reviewed_not_dup"];
    app.save(collection);
    console.log("[1779000005] task_families.type += reviewed_not_dup");
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_task_families");
  const field = collection.fields.getByName("type");
  if (field) {
    field.values = field.values.filter((v) => v !== "reviewed_not_dup");
    app.save(collection);
    console.log("[1779000005] откат: убрано reviewed_not_dup");
  }
});
