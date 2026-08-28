// Авто-починка markdown-таблиц: если у pipe-таблицы пропущена обязательная
// строка-разделитель (|---|---|), GFM вообще не считает блок таблицей и рендерит
// сырой текст с палками. Учителя часто забывают/теряют разделитель (особенно при
// правках в ячейках), поэтому здесь мы аккуратно вставляем его сами.
//
// Срабатывает консервативно: только когда строка-заголовок (вся в палках) идёт
// первой в блоке (предыдущая строка — не таблица) и СЛЕДУЮЩАЯ строка — тоже
// таблица, но НЕ разделитель. Тогда после заголовка вставляем разделитель по
// числу столбцов заголовка. Существующие корректные таблицы не трогаем.
//
// Отдельный случай — таблица В ОДНУ СТРОКУ (ряд чертежей «А) … | Б) … | В) …»):
// тела у неё нет, поэтому GFM не видит таблицы вообще и печатает строку с
// палками как текст. Одинокую строку признаём таблицей ТОЛЬКО если перед ней
// стоит строка-директива («{галерея}» и т.п.) — там намерение объявлено явно.
// Без директивы любая строка с палками стала бы таблицей.

// Строка-директива оформления таблицы: «{без линий}», «{галерея}», «{бланк}»…
// (разбирает utils/remarkTableModifiers.js).
const DIRECTIVE_LINE_RE = /^\{\s*[^{}]+\s*\}$/;

function isTableish(line) {
  const t = (line || '').trim();
  return t.length > 1 && t.startsWith('|') && t.endsWith('|');
}

function isDelimiterRow(line) {
  const t = (line || '').trim();
  if (!isTableish(t)) return false;
  const cells = t.slice(1, -1).split('|');
  return cells.length > 0 && cells.every((c) => /^\s*:?-+:?\s*$/.test(c));
}

function headerColCount(line) {
  return line.trim().slice(1, -1).split('|').length;
}

// Ближайшая непустая строка выше — директива оформления?
function afterDirective(lines, i) {
  for (let j = i - 1; j >= 0; j -= 1) {
    const t = (lines[j] || '').trim();
    if (t === '') continue;
    return DIRECTIVE_LINE_RE.test(t);
  }
  return false;
}

export function autofixTableDelimiters(md) {
  if (!md || typeof md !== 'string' || md.indexOf('|') === -1) return md;
  const lines = md.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    out.push(lines[i]);
    const isStartOfBlock = isTableish(lines[i]) && (i === 0 || !isTableish(lines[i - 1]));
    if (!isStartOfBlock) continue;
    const next = lines[i + 1];
    const nextIsRow = next !== undefined && isTableish(next) && !isDelimiterRow(next);
    const soloRow = !isTableish(next) && afterDirective(lines, i);
    if (nextIsRow || soloRow) {
      const cols = headerColCount(lines[i]);
      if (cols >= 1) out.push(`|${' --- |'.repeat(cols)}`);
      // Однострочную таблицу нужно закрыть пустой строкой: иначе GFM утащит
      // следующий абзац («Запишите в ответ цифры…») в тело таблицы.
      if (soloRow && next !== undefined && next.trim() !== '') out.push('');
    }
  }
  return out.join('\n');
}

// Директива должна стать ОТДЕЛЬНЫМ параграфом — иначе она прилипнет к соседнему
// тексту и плагин её не увидит. Учителя пустые строки вокруг расставляют не
// всегда, поэтому добавляем их сами.
export function normalizeTableDirectives(md) {
  if (!md || typeof md !== 'string' || md.indexOf('{') === -1) return md;
  const lines = md.split('\n');
  const isDirective = new Array(lines.length).fill(false);

  // Идём снизу вверх: строка работает как директива, если ведёт к таблице —
  // напрямую или через другую директиву. Второе нужно, чтобы модификаторы
  // можно было писать отдельными строками («{галерея}» и «{без линий}»),
  // а не только перечислением через запятую.
  let below = -1; // ближайшая непустая строка ниже текущей
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const t = lines[i].trim();
    if (t === '') continue;
    if (DIRECTIVE_LINE_RE.test(t) && below >= 0 && (isTableish(lines[below]) || isDirective[below])) {
      isDirective[i] = true;
    }
    below = i;
  }

  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isDirective[i] && out.length && out[out.length - 1].trim() !== '') out.push('');
    out.push(lines[i]);
    if (isDirective[i]) out.push('');
  }
  return out.join('\n');
}

/** Полная подготовка markdown с таблицами: директивы + починка разделителей. */
export function prepareMarkdownTables(md) {
  return autofixTableDelimiters(normalizeTableDirectives(md));
}

// Готовые заготовки таблиц для кнопки «Таблица» в редакторе задачи.
// `md` вставляется по курсору как есть — директивы разбирает
// utils/remarkTableModifiers.js.
export const TABLE_SNIPPETS = [
  {
    key: 'matching',
    label: 'Соответствие + бланк ответа',
    hint: 'Два столбца без линий (А…Г / 1…4) и таблица для ответа',
    md: [
      '',
      '{без линий}',
      '| ВЕЛИЧИНЫ | ЗНАЧЕНИЯ |',
      '| --- | --- |',
      '| А) | 1) |',
      '| Б) | 2) |',
      '| В) | 3) |',
      '| Г) | 4) |',
      '',
      'Запишите в ответ цифры, расположив их в порядке, соответствующем буквам:',
      '',
      '| А | Б | В | Г |',
      '| --- | --- | --- | --- |',
      '|  |  |  |  |',
      '',
    ].join('\n'),
  },
  {
    key: 'answers',
    label: 'Бланк ответа (А Б В Г)',
    hint: 'Пустые клетки нормальной высоты — ученик вписывает от руки',
    md: ['', '| А | Б | В | Г |', '| --- | --- | --- | --- |', '|  |  |  |  |', ''].join('\n'),
  },
  {
    key: 'plain',
    label: 'Таблица без линий',
    hint: 'Колонки-раскладка: выравнивание есть, рамок нет',
    md: [
      '',
      '{без линий}',
      '| Первый столбец | Второй столбец |',
      '| --- | --- |',
      '| … | … |',
      '',
    ].join('\n'),
  },
  {
    key: 'gallery',
    label: 'Рисунки в клетках (2 × 2)',
    hint: 'Варианты ответа с чертежами: первая строка — не шапка',
    md: [
      '',
      '{галерея}',
      '| 1. `numline: domain -6 6; ray left -4 open` | 3. `numline: domain -6 6; ray right -4 open` |',
      '| --- | --- |',
      '| 2. `numline: domain -6 6; ray left 4 open` | 4. `numline: domain -6 6; ray right 4 open` |',
      '',
    ].join('\n'),
  },
  {
    key: 'gallery-row',
    label: 'Ряд рисунков (одна строка)',
    hint: 'А) … Б) … В) … Г) — чертежи в строку, без второй строки',
    md: [
      '',
      '{галерея}',
      '| А) `plot: x -3 3; y -2 4; f x^2-1` | Б) `plot: x -3 3; y -2 4; f x^2+1` '
        + '| В) `plot: x -3 3; y -4 2; f -x^2+1` | Г) `plot: x -3 3; y -4 2; f -x^2-1` |',
      '',
    ].join('\n'),
  },
  {
    key: 'grid',
    label: 'Обычная таблица с линиями',
    hint: 'Стандартная сетка 3 × 2',
    md: [
      '',
      '| Заголовок 1 | Заголовок 2 | Заголовок 3 |',
      '| --- | --- | --- |',
      '| … | … | … |',
      '| … | … | … |',
      '',
    ].join('\n'),
  },
];
