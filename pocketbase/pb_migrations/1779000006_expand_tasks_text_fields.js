/// <reference path="../pb_data/types.d.ts" />

// PB 0.36.4 не воспринимает max=0 как «без лимита» — оставляет дефолт 5000.
// У tasks.statement_md/solution_md/explanation_md был max=0 (=5000), из-за чего
// длинные решения обрезались (текущий максимум solution_md уже 4994 — впритык),
// а перенос внешних чертежей на локальные URL (v3.9.42, длиннее на ~40 символов)
// упирался в лимит. Ставим явные 50000 (как у criteria_md). Аналог 1772000039.

migrate((app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  for (const name of ['statement_md', 'solution_md', 'explanation_md']) {
    const f = tasks.fields.getByName(name);
    if (f) {
      f.max = 50000;
      console.log(`[1779000006] Set max=50000 on tasks.${name}`);
    }
  }
  app.save(tasks);
}, (app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  for (const name of ['statement_md', 'solution_md', 'explanation_md']) {
    const f = tasks.fields.getByName(name);
    if (f) { f.max = 0; }
  }
  app.save(tasks);
});
