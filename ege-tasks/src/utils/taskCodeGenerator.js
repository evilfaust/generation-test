import { api } from '../services/pocketbase';

function extractCounter(code, prefix) {
  if (!code || !code.startsWith(prefix)) return null;
  const num = parseInt(code.slice(prefix.length), 10);
  return isNaN(num) ? null : num;
}

function nextCode(existingCodes, prefix) {
  const counters = existingCodes.map(c => extractCounter(c, prefix)).filter(n => n !== null);
  const next = counters.length > 0 ? Math.max(...counters) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

/**
 * Префикс кодов темы: `T{N}-` для тригонометрии, `{ege_number}-` для остальных.
 * Бросает, если у обычной темы нет номера ЕГЭ.
 */
export function taskCodePrefix(topic) {
  if (!topic) throw new Error('taskCodePrefix: тема не передана');
  if (topic.exam_type === 'trig') {
    const idMatch = String(topic.id || '').match(/(\d+)$/);
    return `T${idMatch ? parseInt(idMatch[1], 10) : 0}-`;
  }
  const egeNumber = topic.ege_number;
  if (!egeNumber && egeNumber !== 0) {
    throw new Error(`У темы "${topic.title || topic.id}" не указан ege_number`);
  }
  return `${egeNumber}-`;
}

/**
 * Следующий код по уже занятым кодам темы — без обращения к сети.
 * Нужен при импорте пачкой: коды темы читаются один раз, дальше счётчик
 * крутится локально.
 */
export function nextCodeFromCodes(existingCodes, prefix) {
  return nextCode(existingCodes || [], prefix);
}

/**
 * Генерирует следующий код задачи для заданной темы.
 * Для тригонометрических тем (exam_type='trig'): T{N}-{seq}
 * Для остальных тем: {ege_number}-{seq}
 */
export async function generateTaskCode(topicId, topic = null) {
  if (!topicId) {
    throw new Error('topicId обязателен для генерации кода');
  }

  if (!topic) {
    const topics = await api.getTopics();
    topic = topics.find(t => t.id === topicId);
    if (!topic) {
      throw new Error(`Тема с ID "${topicId}" не найдена`);
    }
  }

  const tasks = await api.getTasks({ topic: topicId });
  const codes = tasks.map(t => t.code).filter(Boolean);

  if (topic.exam_type === 'trig') {
    const idMatch = topic.id.match(/(\d+)$/);
    const n = idMatch ? parseInt(idMatch[1], 10) : 0;
    return nextCode(codes, `T${n}-`);
  }

  const egeNumber = topic.ege_number;
  if (!egeNumber && egeNumber !== 0) {
    throw new Error(`У темы "${topic.title || topic.id}" не указан ege_number`);
  }
  return nextCode(codes, `${egeNumber}-`);
}

/**
 * Генерирует N кодов подряд для тригонометрической темы — один запрос к API.
 * Возвращает массив строк длиной count.
 */
export async function generateTrigTaskCodes(topicId, count) {
  const tasks = await api.getTasks({ topic: topicId });
  const idMatch = topicId.match(/(\d+)$/);
  const n = idMatch ? parseInt(idMatch[1], 10) : 0;
  const prefix = `T${n}-`;
  const codes = tasks.map(t => t.code).filter(Boolean);
  const counters = codes.map(c => extractCounter(c, prefix)).filter(v => v !== null);
  let next = counters.length > 0 ? Math.max(...counters) + 1 : 1;
  return Array.from({ length: count }, () => `${prefix}${String(next++).padStart(3, '0')}`);
}

export function validateTaskCode(code) {
  return /^(T\d+|\d+)-\d{3}$/.test(code);
}
