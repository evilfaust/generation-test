/**
 * Эвристический парсер задач на «установление соответствия».
 * Обрабатывает два формата:
 *  — компактный (всё в одной строке): «ВЕЛИЧИНЫА)текстБ)...ЗНАЧЕНИЯ1)...»
 *  — структурированный (построчный): отдельные строки А), Б)... и 1), 2)...
 *
 * Возвращает готовый markdown с двухколоночной таблицей + таблицей ответов,
 * либо null если паттерн не распознан.
 */

const LETTER_SEQ = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'];

const LEFT_HEADERS = [
  'ВЕЛИЧИНЫ', 'НЕРАВЕНСТВА', 'УРАВНЕНИЯ', 'ФУНКЦИИ', 'ВЫРАЖЕНИЯ',
  'ГРАФИКИ', 'ФОРМУЛЫ', 'СВОЙСТВА', 'ОБЪЕКТЫ', 'ПОНЯТИЯ',
  'ПАРАБОЛЫ', 'ЧИСЛА', 'ОПЕРАЦИИ', 'ХАРАКТЕРИСТИКИ',
];
const RIGHT_HEADERS = [
  'ЗНАЧЕНИЯ', 'РЕШЕНИЯ', 'ОТВЕТЫ', 'ОБЛАСТИ', 'ОПРЕДЕЛЕНИЯ',
  'ВЫРАЖЕНИЯ', 'ГРАФИКИ', 'ФОРМУЛЫ', 'ЧИСЛА',
];
const ALL_HEADERS = [...new Set([...LEFT_HEADERS, ...RIGHT_HEADERS])];

/**
 * Находит все позиции меток вида «А)», «Б)», ..., «1)», «2)»...
 * Возвращает отдельные списки для букв и цифр, отсортированные по позиции.
 */
function findLabelPositions(text) {
  const letters = [];
  const numbers = [];

  for (const letter of LETTER_SEQ) {
    let idx = 0;
    while ((idx = text.indexOf(letter + ')', idx)) !== -1) {
      letters.push({ label: letter, pos: idx });
      idx += 2;
    }
  }

  for (let n = 1; n <= 9; n++) {
    let idx = 0;
    while ((idx = text.indexOf(n + ')', idx)) !== -1) {
      numbers.push({ label: String(n), pos: idx });
      idx += 2;
    }
  }

  letters.sort((a, b) => a.pos - b.pos);
  numbers.sort((a, b) => a.pos - b.pos);
  return { letters, numbers };
}

/**
 * Из всех вхождений буквы «А», «Б»... выбирает первое по порядку
 * вхождение каждой следующей буквы (строго последовательно).
 * Например: А при pos=10, первый Б после pos=10, первый В после Б, etc.
 */
function extractSequentialLetters(letterOccurrences) {
  const result = [];
  let afterPos = -1;
  for (const letter of LETTER_SEQ) {
    const found = letterOccurrences.find(o => o.label === letter && o.pos > afterPos);
    if (!found) break;
    result.push(found);
    afterPos = found.pos;
  }
  return result;
}

/**
 * Из всех вхождений «1)», «2)»... выбирает первое последовательное
 * начиная только ПОСЛЕ начала последнего буквенного элемента.
 */
function extractSequentialNumbers(numberOccurrences, afterPos) {
  const result = [];
  let curPos = afterPos;
  for (let n = 1; n <= 9; n++) {
    const found = numberOccurrences.find(o => o.label === String(n) && o.pos > curPos);
    if (!found) break;
    result.push(found);
    curPos = found.pos;
  }
  return result;
}

/** Удаляет упоминания известных заголовков из строки. */
function stripHeaders(str) {
  let result = str;
  for (const h of ALL_HEADERS) {
    result = result.replace(h, '');
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/** Схлопывает пробелы и переносы строк в одну строку (для ячеек таблицы). */
function toTableCell(str) {
  return str.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Основная функция. Принимает текст, возвращает markdown или null.
 */
export function parseMatchingTask(text) {
  if (!text || typeof text !== 'string') return null;

  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  const { letters: allLetters, numbers: allNumbers } = findLabelPositions(s);

  // Нужно минимум 2 буквенных и 2 числовых элемента
  if (allLetters.length < 2 || allNumbers.length < 2) return null;

  // Выбираем последовательные буквенные метки начиная с А
  const letterOcc = extractSequentialLetters(allLetters);
  if (letterOcc.length < 2) return null;

  // Числовые метки должны идти ПОСЛЕ последней буквенной метки
  const lastLetterPos = letterOcc[letterOcc.length - 1].pos;
  const numberOcc = extractSequentialNumbers(allNumbers, lastLetterPos);
  if (numberOcc.length < 2) return null;

  // Извлекаем содержимое каждого буквенного элемента
  const allSorted = [...letterOcc, ...numberOcc].sort((a, b) => a.pos - b.pos);
  const allOcc = [...letterOcc, ...numberOcc];

  function contentOf(occ) {
    const start = occ.pos + 2; // после «А)»
    const idx = allSorted.indexOf(occ);
    const nextOcc = allSorted[idx + 1];
    const end = nextOcc ? nextOcc.pos : s.length;
    return s.slice(start, end);
  }

  const letterItems = letterOcc.map(o => ({
    label: o.label,
    content: toTableCell(stripHeaders(contentOf(o))),
  }));

  const numItems = numberOcc.map(o => ({
    label: o.label,
    content: toTableCell(stripHeaders(contentOf(o))),
  }));

  // Обрезаем содержимое последнего числового элемента до «Запишите» / начала таблицы
  if (numItems.length > 0) {
    const lastNum = numItems[numItems.length - 1];
    const zapIdx = lastNum.content.toLowerCase().indexOf('запишите');
    const pipeIdx = lastNum.content.indexOf('|');
    const cutIdx = Math.min(
      zapIdx >= 0 ? zapIdx : Infinity,
      pipeIdx >= 0 ? pipeIdx : Infinity
    );
    if (cutIdx !== Infinity) {
      lastNum.content = lastNum.content.slice(0, cutIdx).trim();
    }
  }

  // Вступительный текст (до первой буквенной метки)
  const introRaw = s.slice(0, letterOcc[0].pos).trim();
  let introText = introRaw;
  let leftHeader = '';

  for (const h of LEFT_HEADERS) {
    const idx = introRaw.lastIndexOf(h);
    if (idx !== -1) {
      leftHeader = h;
      introText = introRaw.slice(0, idx).trim();
      break;
    }
  }

  // Правый заголовок: ищем между последней буквой и первым числом
  const gapText = s.slice(letterOcc[letterOcc.length - 1].pos, numberOcc[0].pos);
  let rightHeader = '';
  for (const h of RIGHT_HEADERS) {
    if (gapText.includes(h)) {
      rightHeader = h;
      break;
    }
  }

  // Текст «Запишите...» (из исходного текста, после числовых элементов)
  const afterNumbers = s.slice(numberOcc[numberOcc.length - 1].pos + 2);
  const zapIdx = afterNumbers.toLowerCase().indexOf('запишите');
  let outroText = '';
  if (zapIdx >= 0) {
    const pipeIdx = afterNumbers.indexOf('|', zapIdx);
    outroText = pipeIdx >= 0
      ? afterNumbers.slice(zapIdx, pipeIdx).trim()
      : afterNumbers.slice(zapIdx).trim();
  }

  // Строим двухколоночную таблицу
  const maxRows = Math.max(letterItems.length, numItems.length);
  const lHead = leftHeader || 'Левый столбец';
  const rHead = rightHeader || 'Правый столбец';
  let table = `| ${lHead} | ${rHead} |\n|---|---|\n`;
  for (let i = 0; i < maxRows; i++) {
    const left = i < letterItems.length
      ? `${letterItems[i].label}) ${letterItems[i].content}`
      : '';
    const right = i < numItems.length
      ? `${numItems[i].label}) ${numItems[i].content}`
      : '';
    table += `| ${left} | ${right} |\n`;
  }

  // Строим таблицу ответов с пустыми ячейками
  const heads = letterItems.map(i => i.label).join(' | ');
  const seps = letterItems.map(() => '---').join(' | ');
  const cells = letterItems.map(() => '   ').join(' | ');
  const answerTable = `| ${heads} |\n| ${seps} |\n| ${cells} |`;

  // Собираем итог
  let result = '';
  if (introText) result += introText + '\n\n';
  result += table.trim() + '\n\n';
  if (outroText) result += outroText + '\n\n';
  result += answerTable;

  return result.trim();
}
