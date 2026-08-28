// Авто-починка markdown-таблиц: если у pipe-таблицы пропущена обязательная
// строка-разделитель (|---|---|), GFM вообще не считает блок таблицей и рендерит
// сырой текст с палками. Учителя часто забывают/теряют разделитель (особенно при
// правках в ячейках), поэтому здесь мы аккуратно вставляем его сами.
//
// Срабатывает консервативно: только когда строка-заголовок (вся в палках) идёт
// первой в блоке (предыдущая строка — не таблица) и СЛЕДУЮЩАЯ строка — тоже
// таблица, но НЕ разделитель. Тогда после заголовка вставляем разделитель по
// числу столбцов заголовка. Существующие корректные таблицы не трогаем.

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

export function autofixTableDelimiters(md) {
  if (!md || typeof md !== 'string' || md.indexOf('|') === -1) return md;
  const lines = md.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    out.push(lines[i]);
    const isStartOfBlock = isTableish(lines[i]) && (i === 0 || !isTableish(lines[i - 1]));
    const next = lines[i + 1];
    if (isStartOfBlock && next !== undefined && isTableish(next) && !isDelimiterRow(next)) {
      const cols = headerColCount(lines[i]);
      if (cols >= 1) out.push(`|${' --- |'.repeat(cols)}`);
    }
  }
  return out.join('\n');
}

// Строка-директива оформления таблицы («{без линий}», «{бланк}» и т.п.,
// см. utils/remarkTableModifiers.js) должна стать ОТДЕЛЬНЫМ параграфом —
// иначе она прилипнет к соседнему тексту и плагин её не увидит. Учителя
// пустые строки вокруг расставляют не всегда, поэтому добавляем их сами.
const DIRECTIVE_LINE_RE = /^\{\s*[^{}]+\s*\}$/;

export function normalizeTableDirectives(md) {
  if (!md || typeof md !== 'string' || md.indexOf('{') === -1) return md;
  const lines = md.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const isDirective = DIRECTIVE_LINE_RE.test(line.trim()) && isTableish(lines[i + 1]);
    if (isDirective && out.length && out[out.length - 1].trim() !== '') out.push('');
    out.push(line);
    if (isDirective) out.push('');
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
