// Отбор id задач по фильтрам каталога, без похода в сеть.
//
// Векторные режимы «Генератора» (по образцу / разные сюжеты / анти-дубль) считают
// подбор на pdf-service, у которого нет ни тегов, ни логики фильтров каталога.
// Поэтому фронт присылает готовый белый список id, а считает его по снимку
// каталога (`useReferenceData().tasksSnapshot`: id, topic, subtopic, tags,
// difficulty, has_image, source, year) — снимок уже загружен, запросов не надо.
//
// Семантика повторяет `pb/tasks.js::getTasks`: подтемы и теги — ИЛИ внутри поля,
// разные поля — И.

const asArray = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

// tags/subtopic в снимке приходят массивом id (json-поле PocketBase), но у части
// старых записей могут быть строкой или null.
function fieldIds(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value) return [value];
  return [];
}

/**
 * @param {Array<object>} snapshot - tasksSnapshot из ReferenceDataContext
 * @param {object} filters - { topic, subtopic, difficulty, source, year, tags, hasImage }
 * @returns {string[]} id задач, прошедших фильтры
 */
export function filterTaskIds(snapshot = [], filters = {}) {
  const subtopics = asArray(filters.subtopic);
  const tags = asArray(filters.tags);
  const difficulty = filters.difficulty != null && filters.difficulty !== '' ? String(filters.difficulty) : null;
  const year = filters.year != null && filters.year !== '' ? String(filters.year) : null;

  return snapshot.filter((t) => {
    if (filters.topic && t.topic !== filters.topic) return false;
    if (difficulty && String(t.difficulty ?? '') !== difficulty) return false;
    if (filters.source && t.source !== filters.source) return false;
    if (year && String(t.year ?? '') !== year) return false;
    if (filters.hasImage !== undefined && !!t.has_image !== !!filters.hasImage) return false;
    if (subtopics.length) {
      const own = fieldIds(t.subtopic);
      if (!subtopics.some((s) => own.includes(s))) return false;
    }
    if (tags.length) {
      const own = fieldIds(t.tags);
      if (!tags.some((tag) => own.includes(tag))) return false;
    }
    return true;
  }).map((t) => t.id);
}

/**
 * Заданы ли фильтры, сужающие выборку помимо темы/подтемы (их векторные режимы
 * учитывают сами). Нужен, чтобы не гонять белый список без надобности.
 */
export function hasNarrowingFilters(filters = {}) {
  return !!(
    (filters.difficulty != null && filters.difficulty !== '')
    || filters.source
    || (filters.year != null && filters.year !== '')
    || asArray(filters.tags).length
    || filters.hasImage !== undefined
  );
}
