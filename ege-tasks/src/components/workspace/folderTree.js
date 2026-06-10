// Хелперы иерархии папок Библиотеки материалов (pb-files, коллекция folders).
// folders — плоский список записей { id, name, parent }.

// Дерево для antd TreeSelect: [{ value, title, children }], сортировка по имени.
export function buildFolderTree(folders) {
  const byParent = new Map();
  (folders || []).forEach((f) => {
    const p = f.parent || '';
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(f);
  });
  const build = (parentId) => (byParent.get(parentId) || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .map((f) => ({ value: f.id, title: f.name, children: build(f.id) }));
  return build('');
}

// Подпапки конкретной папки ('' = корень), по имени.
export function childFolders(folders, parentId = '') {
  return (folders || [])
    .filter((f) => (f.parent || '') === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

// Цепочка от корня до папки id: [{id, name}, ...]. Защита от циклов.
export function folderChain(folders, id) {
  const byId = new Map((folders || []).map((f) => [f.id, f]));
  const chain = [];
  let cur = byId.get(id);
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift({ id: cur.id, name: cur.name });
    cur = cur.parent ? byId.get(cur.parent) : null;
  }
  return chain;
}
