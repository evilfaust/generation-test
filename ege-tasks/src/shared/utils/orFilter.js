import { escapeFilter } from './escapeFilter';

/**
 * Сколько условий кладём в один OR-фильтр PocketBase.
 *
 * Ограничений два, и оба жёсткие:
 *  1) PocketBase падает с 400 на цепочке примерно от 130 условий
 *     (слишком глубокое выражение для SQLite);
 *  2) nginx рубит запрос с URL длиннее ~8 КБ (414 Request-URI Too Large),
 *     а так как на 414 нет CORS-заголовков, в браузере это выглядит
 *     как «blocked by CORS policy» — см. историю с /app/works.
 *
 * 50 условий ≈ 2,3 КБ query-строки — с запасом под оба лимита.
 */
export const OR_CHUNK_SIZE = 50;

/** Режет массив на куски по size элементов. */
export function chunkArray(values = [], size = OR_CHUNK_SIZE) {
  const arr = Array.isArray(values) ? values : [];
  if (arr.length === 0) return [];
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** `field = "a" || field = "b"` (оператор настраивается — например `~` для json-массивов). */
export function buildOrFilter(field, values = [], op = '=') {
  return values.map((v) => `${field} ${op} "${escapeFilter(v)}"`).join(' || ');
}

/**
 * Уникальные непустые значения + разбивка на безопасные по длине куски.
 * @returns {Array<Array<*>>}
 */
export function orChunks(values = [], size = OR_CHUNK_SIZE) {
  const unique = [...new Set((values || []).filter(Boolean))];
  return chunkArray(unique, size);
}
