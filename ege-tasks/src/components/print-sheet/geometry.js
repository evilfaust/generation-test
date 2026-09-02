/**
 * Геометрия печатного листа A4 и пагинация по измеренным высотам.
 *
 * Единственный источник правды по размерам: значения продублированы в
 * printSheet.css (там же — почему). Меняешь здесь — меняй там.
 *
 * Модуль чистый (без React и DOM) — на нём держатся юнит-тесты пагинации.
 */

export const PAGE_W_MM = 210;
export const PAGE_H_MM = 297;

export const HEAD_MM   = 9;   // «живой» колонтитул (стр. 2+): 5mm + 4mm отступа
export const FOOT_MM   = 8;   // подвал на каждой странице
const SAFETY_MM  = 3;         // запас на округления печати

/**
 * Поля листа. `normal` — канон входной контрольной (14/12/8 мм). `narrow`
 * отдаёт под задачи ещё 12 мм по ширине и 6 мм по высоте: для компактного
 * листа задач это заметно, а обычные принтеры печатают от 5 мм.
 */
export const MARGIN_PRESETS = {
  normal: { x: 14, top: 12, bottom: 8 },
  narrow: { x: 8,  top: 8,  bottom: 6 },
};

export const MARGIN_OPTIONS = [
  { label: 'Обычные', value: 'normal' },
  { label: 'Узкие',   value: 'narrow' },
];

export const marginsOf = (key) => MARGIN_PRESETS[key] || MARGIN_PRESETS.normal;

/** Зазор между колонками в двухколоночной вёрстке. */
export const COLUMN_GAP_MM = 8;

/** Зазор между задачами: 3.5mm margin + 3.5mm padding у `.ps-task + .ps-task`. */
export const TASK_GAP_MM = 7;

/** Колонка номера задачи: квадрат 6.5mm + зазор 3.5mm. */
export const NUM_COL_MM = 10;

/** Отступ зоны решения от условия (`.ps-solution { margin-top }`). */
export const SOLUTION_GAP_MM = 2.6;

/** Ширина контентной зоны листа при заданных полях. */
export const bodyWidthMm = (marginsKey) => PAGE_W_MM - 2 * marginsOf(marginsKey).x;

/** Ширина одной колонки (в двухколоночной вёрстке — с учётом зазора). */
export const columnWidthMm = (marginsKey, columns = 1) =>
  columns > 1
    ? (bodyWidthMm(marginsKey) - COLUMN_GAP_MM * (columns - 1)) / columns
    : bodyWidthMm(marginsKey);

/** Ширина контентной зоны при обычных полях. Оставлена ради старых импортов. */
export const BODY_W_MM = PAGE_W_MM - 2 * MARGIN_PRESETS.normal.x;   // 182

/** px на мм при 96dpi. */
export const MM = 96 / 25.4;
export const TASK_GAP_PX = TASK_GAP_MM * MM;

/**
 * Ёмкость страницы зависит от того, печатается ли подвал: без него задачам
 * достаётся ещё 8 мм, и пагинация обязана это учесть.
 */
export const bodyRestMm = (withFoot, marginsKey) => {
  const m = marginsOf(marginsKey);
  return PAGE_H_MM - m.top - m.bottom - HEAD_MM - (withFoot ? FOOT_MM : 0) - SAFETY_MM;
};

export const bodyFirstMm = (withFoot, marginsKey) => {
  const m = marginsOf(marginsKey);
  return PAGE_H_MM - m.top - m.bottom - (withFoot ? FOOT_MM : 0) - SAFETY_MM;
};

/** Высота зоны решения (режим «место для решения»), мм. */
export const SOLUTION_SPACE_MM = {
  none: 0,
  s: 22,
  m: 38,
  l: 58,
  xl: 82,
};

export const SOLUTION_SPACE_OPTIONS = [
  { label: 'Нет',  value: 'none' },
  { label: 'S',    value: 's' },
  { label: 'M',    value: 'm' },
  { label: 'L',    value: 'l' },
  { label: 'XL',   value: 'xl' },
];

/** Фон зоны решения. */
export const SOLUTION_FILL_OPTIONS = [
  { label: 'Пусто',   value: 'blank' },
  { label: 'Линейка', value: 'lines' },
  { label: 'Клетка',  value: 'grid' },
];

/** Зона решения ниже этого — рисовать бессмысленно (в неё ничего не влезет). */
export const MIN_SOLUTION_MM = 8;

/**
 * Жадная пагинация: складывает элементы в страницы по измеренным высотам.
 * Элемент, не влезающий на страницу целиком, начинает новую (а если не влезает
 * и в пустую — остаётся на ней один).
 *
 * @param {Array<{__key: string}>} items — элементы с ключом измерения
 * @param {Map<string, number>} heights — измеренные высоты, px
 * @param {number} firstCapPx — ёмкость первой страницы (за вычетом шапки)
 * @param {number} restCapPx — ёмкость последующих страниц
 * @param {number} gapPx — зазор между элементами
 */
export function paginateByHeight(items, heights, firstCapPx, restCapPx, gapPx = TASK_GAP_PX) {
  if (!items.length) return [];
  const pages = [];
  let current = [];
  let used = 0;

  for (const item of items) {
    const h = heights.get(item.__key) || 0;
    const cap = pages.length === 0 ? firstCapPx : restCapPx;
    if (current.length > 0 && used + gapPx + h > cap) {
      pages.push(current);
      current = [];
      used = 0;
    }
    if (current.length > 0) used += gapPx;
    current.push(item);
    used += h;
  }
  if (current.length) pages.push(current);
  return pages;
}

/**
 * Режим «N заданий на лист»: страницы набиваются ровно по N, а весь остаток
 * высоты листа делится между заданиями как зона решения. Так печатался
 * «Рабочий лист» (равные блоки с клеткой), только теперь высота считается по
 * реальному условию, а не по формуле «270мм / N».
 *
 * @param {number} tailPx — высота хвостового блока на последней странице
 * @returns {Array<{items: Array, solutionMm: number}>}
 */
export function paginateFixedCount(items, heights, perPage, firstCapPx, restCapPx, gapPx = TASK_GAP_PX, tailPx = 0) {
  if (!items.length) return [];
  const n = Math.max(1, Math.floor(perPage));
  const pages = [];

  for (let i = 0; i < items.length; i += n) {
    const chunk = items.slice(i, i + n);
    const cap = pages.length === 0 ? firstCapPx : restCapPx;
    const isLast = i + n >= items.length;
    // Считаем страницу по n слотам, даже если задач на ней меньше: иначе две
    // задачи на хвосте растянулись бы на пол-листа каждая, и блоки на разных
    // листах вышли бы разного размера.
    const used = chunk.reduce((sum, it) => sum + (heights.get(it.__key) || 0), 0)
      + gapPx * (n - 1)
      + (isLast && tailPx ? tailPx + gapPx : 0);   // хвост (шифровка) на последнем листе
    const leftMm = (cap - used) / MM - SOLUTION_GAP_MM * n;
    const perTask = leftMm / n;
    pages.push({
      items: chunk,
      // Округление вниз до 0.1 мм (+эпсилон против 82.39999) — зона решения
      // не должна оказаться выше остатка страницы.
      solutionMm: perTask >= MIN_SOLUTION_MM ? Math.floor(perTask * 10 + 1e-6) / 10 : 0,
    });
  }
  return pages;
}

/**
 * Пагинация в несколько колонок: колонка набивается сверху вниз до конца, потом
 * начинается следующая, после последней — новая страница.
 *
 * Задачи меряются ПРИ ШИРИНЕ КОЛОНКИ (measure-зона сужается) — иначе высоты
 * занижены вдвое и колонки переполняются.
 *
 * @returns {Array<Array<Array>>} страницы → колонки → элементы
 */
export function paginateIntoColumns(
  items, heights, firstCapPx, restCapPx, gapPx = TASK_GAP_PX, columns = 2
) {
  if (!items.length) return [];
  const cols = Math.max(1, Math.floor(columns));
  const pages = [];
  let page = [];
  let col = [];
  let used = 0;

  const closeColumn = () => {
    page.push(col);
    col = [];
    used = 0;
    if (page.length === cols) {
      pages.push(page);
      page = [];
    }
  };

  for (const item of items) {
    const h = heights.get(item.__key) || 0;
    const cap = pages.length === 0 ? firstCapPx : restCapPx;
    if (col.length > 0 && used + gapPx + h > cap) closeColumn();
    if (col.length > 0) used += gapPx;
    col.push(item);
    used += h;
  }

  if (col.length) page.push(col);
  if (page.length) pages.push(page);

  // Последняя страница набралась не на все колонки (частый случай: задач мало,
  // и все они уехали в левую колонку, а правая осталась пустой) — раскладываем
  // её остаток поровну. Полные страницы не трогаем: там жадная набивка верна.
  const last = pages[pages.length - 1];
  if (last && last.length < cols) {
    const rest = last.flat();
    const cap = pages.length === 1 ? firstCapPx : restCapPx;
    pages[pages.length - 1] = balanceColumns(rest, heights, cols, cap, gapPx);
  }

  return pages;
}

/**
 * Раскладка остатка по колонкам «поровну»: колонка закрывается, когда
 * следующая задача перевалила бы за среднюю высоту колонки (или просто не
 * влезает). Зазоры входят и в цель, и в накопленную высоту — иначе страница из
 * задач одинаковой высоты схлопывается в одну колонку.
 */
function balanceColumns(items, heights, cols, capPx, gapPx) {
  const total = items.reduce((sum, it) => sum + (heights.get(it.__key) || 0), 0)
    + gapPx * Math.max(0, items.length - 1);
  const target = total / cols;

  const res = [];
  let col = [];
  let used = 0;

  items.forEach((item) => {
    const h = heights.get(item.__key) || 0;
    const next = used + gapPx + h;
    if (col.length > 0 && res.length < cols - 1 && (next > capPx || next > target)) {
      res.push(col);
      col = [];
      used = 0;
    }
    if (col.length > 0) used += gapPx;
    col.push(item);
    used += h;
  });

  if (col.length) res.push(col);
  return res;
}
