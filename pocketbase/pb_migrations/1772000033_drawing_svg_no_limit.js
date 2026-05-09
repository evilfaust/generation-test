/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    const field = col.fields.getByName('drawing_svg');
    field.max = 0; // без ограничения длины
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    const field = col.fields.getByName('drawing_svg');
    field.max = 5000;
    app.save(col);
  }
);
