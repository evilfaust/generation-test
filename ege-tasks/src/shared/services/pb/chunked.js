import { pb } from './client.js';
import { buildOrFilter, orChunks, OR_CHUNK_SIZE } from '../../utils/orFilter';

/**
 * getFullList по списку значений одного поля, но безопасно: OR-цепочка режется
 * на куски (см. OR_CHUNK_SIZE), куски идут параллельно, результат склеивается
 * и дедуплицируется по id.
 *
 * Без этого длинные списки (все работы учителя, все попытки теста) уезжали в
 * один гигантский filter → 400 от PocketBase или 414 от nginx, который в
 * консоли браузера маскируется под ошибку CORS.
 *
 * @param {string} collection — имя коллекции PocketBase
 * @param {string} field — поле для сравнения (`work`, `session`, `id`, …)
 * @param {Array} values — значения; пустой массив = ни одного запроса
 * @param {object} [options] — обычные опции getFullList (fields, sort, expand)
 * @param {object} [opts]
 * @param {string} [opts.op='='] — оператор сравнения (`~` для json-массивов)
 * @param {string} [opts.extraFilter] — добавляется как `&& (…)` к каждому куску
 * @param {number} [opts.chunkSize=OR_CHUNK_SIZE]
 */
export async function getFullListByOr(collection, field, values, options = {}, opts = {}) {
  const { op = '=', extraFilter = '', chunkSize = OR_CHUNK_SIZE } = opts;
  const chunks = orChunks(values, chunkSize);
  if (chunks.length === 0) return [];

  const results = await Promise.all(
    chunks.map((chunk) => {
      const orPart = buildOrFilter(field, chunk, op);
      const filter = extraFilter ? `(${orPart}) && ${extraFilter}` : orPart;
      return pb.collection(collection).getFullList({ ...options, filter });
    })
  );

  // Куски не пересекаются по значению поля, но при op='~' одна запись может
  // попасть в несколько кусков — дедуплицируем по id.
  const seen = new Set();
  const out = [];
  for (const rec of results.flat()) {
    if (rec?.id && seen.has(rec.id)) continue;
    if (rec?.id) seen.add(rec.id);
    out.push(rec);
  }
  return out;
}
