/// <reference path="../pb_data/types.d.ts" />
// Добавляем значение 'rejected_parallel' в select task_families.type.
// Нужно для модалки «Параллельные варианты»: когда учитель вручную заменяет
// подобранную параллель, пара (образец → отвергнутая задача) запоминается и
// больше не предлагается при следующем подборе по той же задаче.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_task_families");
  const field = collection.fields.getByName("type");
  if (field && !field.values.includes("rejected_parallel")) {
    field.values = [...field.values, "rejected_parallel"];
    app.save(collection);
    console.log("[1784000000] task_families.type += rejected_parallel");
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_task_families");
  const field = collection.fields.getByName("type");
  if (field) {
    field.values = field.values.filter((v) => v !== "rejected_parallel");
    app.save(collection);
    console.log("[1784000000] откат: убрано rejected_parallel");
  }
});
