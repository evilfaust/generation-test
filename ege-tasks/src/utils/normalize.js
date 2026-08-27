/**
 * Нормализация строки для поиска дубликатов по названию.
 */
export function normalizeLabel(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

/**
 * Нормализация названия темы/подтемы для сопоставления с базой.
 * Дополнительно к normalizeLabel убирает «№» и пунктуацию: в YAML-файлах
 * тему пишут как «ЕГЭ-База №14 Вычисления», а в базе она «ЕГЭ-База. №14
 * Вычисления» — точное сравнение такую пару не ловит.
 */
export function normalizeTopicTitle(value) {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/№/g, ' ')
    .replace(/[.,:;!?'"`«»()\[\]{}<>—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Строгая нормализация условия задачи (точное совпадение текста).
 */
export function normalizeStatementStrict(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

/**
 * Агрессивная нормализация условия задачи (убирает пунктуацию, пробелы, LaTeX).
 */
export function normalizeStatementLoose(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, '')
    .replace(/[.,:;!?'"`~()\[\]{}<>—–-]/g, '')
    .replace(/\$/g, '')
    .replace(/\\/g, '');
}
