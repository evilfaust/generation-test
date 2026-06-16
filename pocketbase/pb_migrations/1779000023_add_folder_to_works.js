/// <reference path="../pb_data/types.d.ts" />

// Лёгкие папки-ярлыки для работ: works.folder (text, одноуровневая метка). Аддитивно.
migrate((app) => {
  const c = app.findCollectionByNameOrId('works');
  if (!c.fields.getByName('folder')) {
    c.fields.add(new Field({
      'autogeneratePattern': '', 'hidden': false, 'id': 'txt_work_folder', 'max': 100, 'min': 0,
      'name': 'folder', 'pattern': '', 'presentable': false, 'primaryKey': false,
      'required': false, 'system': false, 'type': 'text',
    }));
    app.save(c);
  }
  console.log('[1779000023] works: +folder');
}, (app) => {
  const c = app.findCollectionByNameOrId('works');
  const f = c.fields.getByName('folder');
  if (f) { c.fields.removeById(f.id); app.save(c); }
  console.log('[1779000023] works: -folder');
});
