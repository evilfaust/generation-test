/// <reference path="../pb_data/types.d.ts" />

// Закрепление работ в «Мои работы»: works.is_pinned (bool). Аддитивно.
migrate((app) => {
  const c = app.findCollectionByNameOrId('works');
  if (!c.fields.getByName('is_pinned')) {
    c.fields.add(new Field({
      'hidden': false, 'id': 'bool_work_pinned', 'name': 'is_pinned',
      'presentable': false, 'required': false, 'system': false, 'type': 'bool',
    }));
    app.save(c);
  }
  console.log('[1779000022] works: +is_pinned');
}, (app) => {
  const c = app.findCollectionByNameOrId('works');
  const f = c.fields.getByName('is_pinned');
  if (f) { c.fields.removeById(f.id); app.save(c); }
  console.log('[1779000022] works: -is_pinned');
});
