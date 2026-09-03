/**
 * План импорта работы: раскладка разобранного `.md` в строки таблицы мастера
 * (задача → тема → что делать: создать новую или переиспользовать найденную).
 *
 * Чистая логика без сети — сетевые шаги живут в hooks/useWorkImport.js.
 * Формат файла: WORK_IMPORT_FORMAT.md
 */

import { matchTopicByName, matchSubtopicByName } from './topicMatch';
import { normalizeStatementStrict, normalizeStatementLoose } from './normalize';

/** Ключ строки для таблицы и состояния мастера. */
export const rowKey = (variantNumber, position) => `v${variantNumber}-${position}`;

/**
 * Раскладывает результат parseWorkMarkdown в плоский список строк с
 * предложенными темами и подтемами.
 *
 * @param {object} parsed — результат parseWorkMarkdown
 * @param {object} refs — { topics, subtopics }
 * @returns {Array} строки плана
 */
export function buildImportRows(parsed, { topics = [], subtopics = [] } = {}) {
  const examType = parsed?.work?.examType || null;
  const rows = [];

  (parsed?.variants || []).forEach((variant) => {
    (variant.tasks || []).forEach((task, position) => {
      const topicId = matchTopicByName(task.topicName, topics, { examType })
        || matchTopicByName(task.topicName, topics); // подсказка контекста могла не совпасть
      const subtopicId = matchSubtopicByName(task.subtopicName, subtopics, topicId);

      rows.push({
        key: rowKey(variant.number, position),
        variantNumber: variant.number,
        position,
        task,
        topicId: topicId || null,
        subtopicId: subtopicId || null,
        // Подтема из файла, которой нет в базе, — будет создана при импорте
        newSubtopicName: subtopicId ? '' : (task.subtopicName || ''),
        mode: 'create',       // create | reuse | skip
        reuseTaskId: null,
        duplicate: null,      // { id, code, kind, statement_md }
      });
    });
  });

  return rows;
}

/**
 * Ищет дубль задачи среди уже существующих задач темы.
 * Сначала точное совпадение текста, затем «мягкое» (без пробелов, пунктуации
 * и LaTeX-обвязки) — те же ключи, что и во вкладке дублей каталога.
 *
 * @param {object} task — задача из разбора (statement_md, answer)
 * @param {Array} candidates — [{ id, code, statement_md, answer }]
 * @returns {object|null}
 */
export function findDuplicate(task, candidates = []) {
  const statement = task?.statement_md || '';
  if (!statement.trim() || candidates.length === 0) return null;

  const strict = normalizeStatementStrict(statement);
  const loose = normalizeStatementLoose(statement);
  if (!loose) return null;

  let looseHit = null;
  for (const candidate of candidates) {
    const candidateStatement = candidate.statement_md || '';
    if (normalizeStatementStrict(candidateStatement) === strict) {
      return { id: candidate.id, code: candidate.code, kind: 'strict', statement_md: candidateStatement, answer: candidate.answer };
    }
    if (!looseHit && normalizeStatementLoose(candidateStatement) === loose) {
      looseHit = { id: candidate.id, code: candidate.code, kind: 'loose', statement_md: candidateStatement, answer: candidate.answer };
    }
  }
  return looseHit;
}

/**
 * Проставляет строкам найденные дубли. Строка с дублем по умолчанию
 * переключается на переиспользование — учитель может вернуть «создать новую».
 *
 * @param {Array} rows
 * @param {Map|object} candidatesByTopic — topicId → массив кандидатов
 * @returns {Array} новые строки
 */
export function applyDuplicates(rows = [], candidatesByTopic = new Map()) {
  const get = (topicId) => {
    if (!topicId) return [];
    if (candidatesByTopic instanceof Map) return candidatesByTopic.get(topicId) || [];
    return candidatesByTopic[topicId] || [];
  };

  return rows.map((row) => {
    if (row.mode === 'skip') return row;
    const duplicate = findDuplicate(row.task, get(row.topicId));
    if (!duplicate) return { ...row, duplicate: null, mode: row.mode === 'reuse' ? 'create' : row.mode, reuseTaskId: null };
    return { ...row, duplicate, mode: 'reuse', reuseTaskId: duplicate.id };
  });
}

/**
 * Дубли внутри самого файла: одна и та же задача в двух вариантах — обычно
 * это ошибка распознавания, а не задумка. Возвращает ключи повторов
 * (первое вхождение не помечается).
 */
export function findInternalDuplicates(rows = []) {
  const seen = new Map();
  const repeats = [];
  rows.forEach((row) => {
    const key = normalizeStatementLoose(row.task?.statement_md || '');
    if (!key) return;
    if (seen.has(key)) repeats.push({ key: row.key, sameAs: seen.get(key) });
    else seen.set(key, row.key);
  });
  return repeats;
}

/** Сводка для шага подтверждения. */
export function summarizeRows(rows = []) {
  const summary = {
    total: rows.length,
    create: 0,
    reuse: 0,
    skip: 0,
    withoutTopic: 0,
    withoutAnswer: 0,
    variants: new Set(),
  };

  rows.forEach((row) => {
    summary[row.mode] = (summary[row.mode] || 0) + 1;
    if (!row.topicId) summary.withoutTopic += 1;
    if (!row.task?.answer) summary.withoutAnswer += 1;
    summary.variants.add(row.variantNumber);
  });

  return { ...summary, variants: summary.variants.size };
}

/** Строки, из-за которых импорт запускать нельзя. */
export function blockingIssues(rows = []) {
  const issues = [];
  const noTopic = rows.filter((r) => r.mode === 'create' && !r.topicId);
  if (noTopic.length) {
    issues.push(`Не выбрана тема: ${noTopic.length} задач(и). Выберите тему или создайте новую.`);
  }
  const empty = rows.filter((r) => r.mode !== 'skip' && !(r.task?.statement_md || '').trim());
  if (empty.length) {
    issues.push(`Пустое условие: ${empty.length} задач(и). Уберите их или заполните текст.`);
  }
  if (rows.filter((r) => r.mode !== 'skip').length === 0) {
    issues.push('Все задачи исключены из импорта.');
  }
  return issues;
}
