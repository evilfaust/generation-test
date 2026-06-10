// Извлечение плоского текста из BlockNote-документа (teacher_notes.body) —
// для клиентского поиска по содержимому заметок. Документ = массив блоков,
// у блока content (массив инлайнов или объект таблицы) + children (вложенные блоки).

function inlineText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node.text === 'string') return node.text;
  // link и пр. — текст лежит в content
  if (Array.isArray(node.content)) return node.content.map(inlineText).join('');
  return '';
}

function blockText(block) {
  if (!block) return '';
  const parts = [];
  const c = block.content;
  if (Array.isArray(c)) {
    parts.push(c.map(inlineText).join(''));
  } else if (c && Array.isArray(c.rows)) {
    // Таблица: rows[].cells[][] — инлайны в ячейках
    c.rows.forEach((row) => (row.cells || []).forEach((cell) => {
      const arr = Array.isArray(cell) ? cell : (cell?.content || []);
      parts.push(arr.map(inlineText).join(''));
    }));
  }
  // Кастомные блоки с пропсами-текстом (math: formula) и подписи картинок
  if (block.props) {
    if (typeof block.props.formula === 'string') parts.push(block.props.formula);
    if (typeof block.props.caption === 'string') parts.push(block.props.caption);
    if (typeof block.props.name === 'string') parts.push(block.props.name);
  }
  if (Array.isArray(block.children)) {
    parts.push(block.children.map(blockText).join(' '));
  }
  return parts.filter(Boolean).join(' ');
}

export function extractNoteText(body) {
  if (!Array.isArray(body)) return '';
  try {
    return body.map(blockText).join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}
