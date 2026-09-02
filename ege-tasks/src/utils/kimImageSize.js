// Размер чертежей/картинок в КИМ-печати, выбираемый per-задача (S/M/L/XL).
// M = исторический дефолт (max-height 35mm, контейнер 48% ширины задачи) —
// именно так картинки печатались до появления переключателя, поэтому задачи
// без явного выбора выглядят как раньше.
//
// Применяется инлайн-стилем (перебивает базовые правила .kim-book-task-image
// из EgeVariantGenerator.css) одинаково в фазе измерения и в печати — чтобы
// пагинация КИМ учитывала реальную высоту увеличенной картинки.

export const DEFAULT_KIM_IMAGE_SIZE = 'm';

export const KIM_IMAGE_SIZE_OPTIONS = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
];

// Чертёж в ЯЧЕЙКЕ таблицы (задачи вида «на каком рисунке изображено множество
// решений» — 4 числовые прямые галереей). База здесь другая: доля от ширины
// ячейки, а не от ширины колонки текста, иначе 48% ячейки — это мизер.
const CELL_CFG = {
  s:  '50%',
  m:  '70%',
  l:  '85%',
  xl: '100%',
};

const CFG = {
  s:  { maxWidth: '35%',  maxHeight: '24mm' },
  m:  { maxWidth: '48%',  maxHeight: '35mm' },
  l:  { maxWidth: '70%',  maxHeight: '55mm' },
  xl: { maxWidth: '100%', maxHeight: '85mm' },
};

// Стиль для КОНТЕЙНЕРА картинки (.kim-book-task-image) — ограничивает ширину.
export function kimImageBoxStyle(size) {
  const c = CFG[size] || CFG[DEFAULT_KIM_IMAGE_SIZE];
  return { maxWidth: c.maxWidth };
}

// Стиль для самого <img> — ограничивает высоту.
export function kimImageImgStyle(size) {
  const c = CFG[size] || CFG[DEFAULT_KIM_IMAGE_SIZE];
  return { maxWidth: '100%', maxHeight: c.maxHeight };
}

// Та же шкала, но CSS-переменными — для печатного листа print-sheet, где
// размер должен достаться разом внешним картинкам, inline-картинкам markdown и
// внутренним SVG (```numline / ```plot). Инлайн-стилем их все не накрыть:
// у наших SVG уже есть свой style, а картинки в тексте рендерит react-markdown.
export function figureSizeVars(size) {
  const c = CFG[size] || CFG[DEFAULT_KIM_IMAGE_SIZE];
  return {
    '--ps-fig-w': c.maxWidth,
    '--ps-fig-h': c.maxHeight,
    '--ps-fig-cell-w': CELL_CFG[size] || CELL_CFG[DEFAULT_KIM_IMAGE_SIZE],
  };
}
