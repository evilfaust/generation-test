/**
 * remark-плагин: модификаторы оформления markdown-таблиц.
 *
 * Зачем: GFM-таблица умеет только «сетку с линиями» с шапкой. В КИМ же нужны
 * ещё три вида таблиц:
 *   1) «плоская» — два столбца без единой линии (задания на соответствие:
 *      ВЕЛИЧИНЫ / ЗНАЧЕНИЯ, ПЕРИОДЫ ВРЕМЕНИ / ХАРАКТЕРИСТИКИ);
 *   2) «бланк ответа» — шапка А Б В Г и пустая строка, куда ученик вписывает
 *      цифры от руки (пустые ячейки схлопывались в нулевую высоту — вписать
 *      было физически некуда);
 *   3) «галерея» — клетки с чертежами («на каком рисунке изображено множество
 *      решений»). GFM обязан сделать первую строку шапкой, а шапка — это
 *      серая заливка, центр и полужирный; рисунку в первой клетке всё это
 *      не нужно, поэтому она снова оформляется как обычная ячейка.
 *
 * Синтаксис — строка-директива в фигурных скобках ПЕРЕД таблицей:
 *
 *     {без линий}
 *     | ВЕЛИЧИНЫ | ЗНАЧЕНИЯ |
 *     | --- | --- |
 *     | А) длительность урока | 1) 17,6 секунды |
 *
 * Модификаторы (перечисляются через запятую — `{без линий, без шапки}` — либо
 * отдельными строками подряд, это одно и то же):
 *   {без линий} | {плоская} | {plain}     → таблица без рамок и заливки
 *   {без шапки} | {noheader}              → строка заголовка скрыта
 *   {бланк}     | {ответы}  | {answers}   → бланк для вписывания от руки
 *   {компактная}| {compact}               → уменьшенные отступы в ячейках
 *   {галерея}   | {рисунки} | {варианты}  → сетка без шапки: первая строка —
 *                                           обычная клетка (для чертежей)
 *   {линии}     | {сетка}   | {grid}      → обычная сетка (отключает автоподбор)
 *
 * Если директивы нет, вид подбирается автоматически (это важно: в базе тысячи
 * импортированных с «Решу ЕГЭ» задач, размечать их руками никто не будет):
 *   • все ячейки тела пустые           → бланк ответа;
 *   • 2 столбца, строки вида «А) …» | «1) …» → плоская таблица.
 *
 * Плагин НЕ трогает базовое оформление таблиц (остаётся как было) — только
 * добавляет классы `md-table--*` на <table> и `md-cell--blank` на пустые
 * ячейки. Сами стили — в `shared/components/markdownTables.css`.
 */

const MOD_ALIASES = {
  // без линий
  'plain': 'plain',
  'flat': 'plain',
  'плоская': 'plain',
  'без линий': 'plain',
  'без рамок': 'plain',
  'без сетки': 'plain',
  // без шапки
  'noheader': 'noheader',
  'без шапки': 'noheader',
  'без заголовка': 'noheader',
  'без заголовков': 'noheader',
  // бланк для вписывания
  'answers': 'answers',
  'бланк': 'answers',
  'ответы': 'answers',
  'для ответа': 'answers',
  // компактная
  'compact': 'compact',
  'компактная': 'compact',
  'плотная': 'compact',
  // галерея рисунков (первая строка — обычная клетка, а не шапка)
  'gallery': 'gallery',
  'галерея': 'gallery',
  'рисунки': 'gallery',
  'варианты': 'gallery',
  // обычная сетка (явно отключить автоподбор)
  'grid': 'grid',
  'линии': 'grid',
  'сетка': 'grid',
  'с линиями': 'grid',
};

const LETTER_RE = /^[А-ЯЁA-Z]\s*[).]/;      // «А)», «Б.», «A)»
const NUMBER_RE = /^\d+\s*[).]/;            // «1)», «2.»

/**
 * Разбирает строку-директиву `{без линий, без шапки}`.
 * Возвращает массив модификаторов либо null, если это не директива
 * (любой нераспознанный токен → строка считается обычным текстом).
 */
export function parseTableDirective(raw) {
  const s = String(raw ?? '').trim();
  const m = /^\{\s*([^{}]+?)\s*\}$/.exec(s);
  if (!m) return null;

  const tokens = m[1].split(/[,;]+/).map((t) => t.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean);
  if (!tokens.length) return null;

  const mods = [];
  for (const token of tokens) {
    const mod = MOD_ALIASES[token];
    if (!mod) return null;
    if (!mods.includes(mod)) mods.push(mod);
  }
  return mods;
}

/** Плоский текст узла mdast (без картинок и разметки). */
function nodeText(node) {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(nodeText).join('');
}

/** Ячейка считается пустой, если в ней нет ни текста, ни картинки/чертежа. */
function isBlankCell(cell) {
  if (!cell || !Array.isArray(cell.children) || cell.children.length === 0) return true;
  const hasVisual = (n) => n.type === 'image' || n.type === 'html' || n.type === 'inlineMath'
    || (Array.isArray(n.children) && n.children.some(hasVisual));
  if (cell.children.some(hasVisual)) return false;
  return !nodeText(cell).trim();
}

function addClass(node, className) {
  node.data = node.data || {};
  node.data.hProperties = node.data.hProperties || {};
  const current = node.data.hProperties.className;
  const list = Array.isArray(current) ? current : (current ? String(current).split(/\s+/) : []);
  if (!list.includes(className)) list.push(className);
  node.data.hProperties.className = list;
}

/** Автоподбор вида таблицы, когда явной директивы нет. */
function detectMods(table) {
  const rows = table.children || [];
  if (rows.length < 2) return [];

  const body = rows.slice(1);
  const bodyCells = body.flatMap((r) => r.children || []);
  if (!bodyCells.length) return [];

  // Бланк ответа: шапка есть, всё тело пустое.
  const headerFilled = (rows[0].children || []).some((c) => !isBlankCell(c));
  if (headerFilled && bodyCells.every(isBlankCell)) return ['answers'];

  // Задание на соответствие: 2 столбца, строки «А) …» | «1) …».
  const cols = Math.max(...rows.map((r) => (r.children || []).length));
  if (cols === 2) {
    const matching = body.filter((r) => {
      const [left, right] = r.children || [];
      return LETTER_RE.test(nodeText(left).trim()) && NUMBER_RE.test(nodeText(right).trim());
    });
    if (matching.length >= 2) return ['plain'];
  }

  return [];
}

function decorateTable(table, explicitMods) {
  // Место под рукописный ответ — это ЦЕЛИКОМ пустая строка тела (шапка А Б В Г
  // + пустая строка под ней). Одиночная пустая ячейка в заполненной таблице —
  // это «нет данных», её раздувать не надо.
  (table.children || []).forEach((row, idx) => {
    if (idx === 0) return;
    const cells = row.children || [];
    if (!cells.length || !cells.every(isBlankCell)) return;
    cells.forEach((cell) => addClass(cell, 'md-cell--blank'));
  });

  // Явная директива всегда сильнее автоподбора; `{линии}` = «оставить как есть».
  const mods = explicitMods && explicitMods.length ? explicitMods : detectMods(table);
  const applied = mods.filter((m) => m !== 'grid');
  if (!applied.length) return;

  addClass(table, 'md-table');
  applied.forEach((m) => addClass(table, `md-table--${m}`));
}

function walk(node) {
  if (!node || !Array.isArray(node.children)) return;
  const kids = node.children;
  for (let i = kids.length - 1; i >= 0; i -= 1) {
    const child = kids[i];
    if (child.type === 'table') {
      // Директив перед таблицей может быть несколько подряд: «{галерея}» и
      // «{без линий}» отдельными строками — то же, что «{галерея, без линий}».
      let mods = null;
      let j = i - 1;
      while (j >= 0 && kids[j].type === 'paragraph') {
        const parsed = parseTableDirective(nodeText(kids[j]));
        if (!parsed) break;
        mods = parsed.concat(mods || []).filter((m, k, all) => all.indexOf(m) === k);
        j -= 1;
      }
      // Директивы-параграфы убираем из дерева; идём с конца, поэтому после
      // удаления соседей слева индекс надо подвинуть — иначе на следующем
      // шаге снова попадём на эту же таблицу (уже без директив).
      const eaten = i - 1 - j;
      if (eaten > 0) { kids.splice(j + 1, eaten); i -= eaten; }
      decorateTable(child, mods);
    } else {
      walk(child);
    }
  }
}

export default function remarkTableModifiers() {
  return (tree) => { walk(tree); };
}
