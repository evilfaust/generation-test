/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    col.fields.add(new TextField({ name: 'drawing_svg', required: false }));
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    col.fields.removeByName('drawing_svg');
    app.save(col);
  }
);
