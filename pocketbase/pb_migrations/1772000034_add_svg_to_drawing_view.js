/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    const field = col.fields.getByName('drawing_view');
    if (!field.values.includes('svg')) {
      field.values.push('svg');
    }
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('geometry_tasks');
    const field = col.fields.getByName('drawing_view');
    field.values = field.values.filter((v) => v !== 'svg');
    app.save(col);
  }
);
