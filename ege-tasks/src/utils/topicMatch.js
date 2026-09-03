/**
 * Сопоставление названий тем и подтем из файла с записями базы.
 * Общее для импорта задач (useTaskImport) и импорта работы целиком
 * (useWorkImport) — раньше жило только внутри useTaskImport.
 */

import { normalizeTopicTitle } from './normalize';

// Минимальная длина названия темы для частичного совпадения. Короткие
// («Марафон», «Планиметрия») слишком часто встречаются внутри длинных
// заголовков из файла и дают ложный автовыбор темы.
export const MIN_PARTIAL_MATCH_LEN = 8;

/**
 * Ищет тему по названию: сначала точное совпадение (с точностью до регистра,
 * ё/е, «№» и пунктуации), затем частичное. Несколько частичных совпадений —
 * возвращает null: выбор за учителем.
 *
 * @param {string} name — название из файла
 * @param {Array} topics — записи topics
 * @param {object} [options]
 * @param {string} [options.examType] — сузить поиск до одного контекста
 * @returns {string|null} id темы
 */
export function matchTopicByName(name, topics = [], { examType = null } = {}) {
  if (!name || topics.length === 0) return null;

  const norm = normalizeTopicTitle(name);
  if (!norm) return null;

  const pool = examType ? topics.filter((t) => t.exam_type === examType) : topics;
  if (pool.length === 0) return null;

  const exact = pool.filter((t) => normalizeTopicTitle(t.title) === norm);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return exact[0].id; // одинаковые названия в разных контекстах — берём первое

  const partial = pool.filter((t) => {
    const title = normalizeTopicTitle(t.title);
    if (title.length < MIN_PARTIAL_MATCH_LEN) return false;
    return title.includes(norm) || norm.includes(title);
  });
  if (partial.length === 1) return partial[0].id;

  return null;
}

/**
 * Ищет подтему по названию внутри темы.
 *
 * @param {string} name
 * @param {Array} subtopics — записи subtopics
 * @param {string} topicId
 * @returns {string|null} id подтемы
 */
export function matchSubtopicByName(name, subtopics = [], topicId = null) {
  if (!name || !topicId) return null;

  const norm = normalizeTopicTitle(name);
  if (!norm) return null;

  const pool = subtopics.filter((st) => st.topic === topicId);
  const exact = pool.find((st) => normalizeTopicTitle(st.name) === norm);
  if (exact) return exact.id;

  const partial = pool.filter((st) => normalizeTopicTitle(st.name).includes(norm));
  if (partial.length === 1) return partial[0].id;

  return null;
}
