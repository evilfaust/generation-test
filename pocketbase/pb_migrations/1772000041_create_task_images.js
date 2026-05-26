/// <reference path="../pb_data/types.d.ts" />
// Коллекция task_images — раздельное хранение чертежей задачи по ролям:
//   condition / solution / criteria.
// В тексте задачи используются плейсхолдеры [[img:role:N]],
// рендерер подставляет картинки по совпадению (task, role, order).

migrate((app) => {
  const collection = new Collection({
    "id": "pbc_task_images",
    "name": "task_images",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "fields": [
      {
        "type": "relation",
        "id": "rel_task_images_task",
        "name": "task",
        "collectionId": "pbc_2602490748",
        "cascadeDelete": true,
        "maxSelect": 1,
        "minSelect": 1,
        "required": true,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "select",
        "id": "select_task_images_role",
        "name": "role",
        "maxSelect": 1,
        "values": ["condition", "solution", "criteria"],
        "required": true,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "number",
        "id": "number_task_images_order",
        "name": "order",
        "min": 1,
        "max": null,
        "onlyInt": true,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "file",
        "id": "file_task_images_file",
        "name": "file",
        "maxSelect": 1,
        "maxSize": 10485760,
        "mimeTypes": [
          "image/png",
          "image/jpeg",
          "image/svg+xml",
          "image/webp",
          "image/gif"
        ],
        "thumbs": ["120x120", "400x0"],
        "protected": false,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "text",
        "id": "text_task_images_sdamgia_file_id",
        "name": "sdamgia_file_id",
        "max": 100,
        "min": 0,
        "pattern": "",
        "autogeneratePattern": "",
        "primaryKey": false,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "url",
        "id": "url_task_images_original",
        "name": "original_url",
        "exceptDomains": null,
        "onlyDomains": null,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "number",
        "id": "number_task_images_width",
        "name": "width",
        "min": 0,
        "onlyInt": true,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "number",
        "id": "number_task_images_height",
        "name": "height",
        "min": 0,
        "onlyInt": true,
        "required": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "autodate",
        "id": "autodate_task_images_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "hidden": false,
        "system": false
      },
      {
        "type": "autodate",
        "id": "autodate_task_images_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "hidden": false,
        "system": false
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_task_images_task` ON `task_images` (`task`)",
      "CREATE INDEX `idx_task_images_task_role_order` ON `task_images` (`task`, `role`, `order`)",
      "CREATE INDEX `idx_task_images_sdamgia_file_id` ON `task_images` (`sdamgia_file_id`) WHERE `sdamgia_file_id` != ''"
    ]
  });

  app.save(collection);
  console.log("[1772000041] Создана коллекция task_images");
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_task_images");
  app.delete(collection);
  console.log("[1772000041] Удалена коллекция task_images");
});
