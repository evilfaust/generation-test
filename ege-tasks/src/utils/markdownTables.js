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
