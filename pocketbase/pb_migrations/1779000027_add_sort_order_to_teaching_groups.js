/// <reference path="../pb_data/types.d.ts" />

// Ручной порядок классов/групп в разделе «Классы и группы»:
// teaching_groups.sort_order (number). Меньше — выше. Аддитивно, дефолт 0
// (тогда сортировка падает на -created, как было раньше).
migrate((app) => {
  const c = app.findCollectionByNameOrId('teaching_groups');
  if (!c.fields.getByName('sort_order')) {
    c.fields.add(new Field({
      'hidden': false, 'id': 'number_group_sort', 'name': 'sort_order',
      'type': 'number', 'min': null, 'max': null, 'onlyInt': true,
      'presentable': false, 'required': false, 'system': false,
    }));
    app.save(c);
  }
  console.log('[1779000027] teaching_groups: +sort_order');
}, (app) => {
  const c = app.findCollectionByNameOrId('teaching_groups');
  const f = c.fields.getByName('sort_order');
  if (f) { c.fields.removeById(f.id); app.save(c); }
  console.log('[1779000027] teaching_groups: -sort_order');
});
