/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    // Удаляем старое поле и добавляем новое с явным max
    col.fields.removeByName('drawing_svg');
    col.fields.add(new TextField({
      name:     'drawing_svg',
      required: false,
      min:      0,
      max:      200000,
    }));
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    col.fields.removeByName('drawing_svg');
    col.fields.add(new TextField({
      name:     'drawing_svg',
      required: false,
    }));
    app.save(col);
  }
);
