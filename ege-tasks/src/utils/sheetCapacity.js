// Сколько заданий помещается в один вариант на листе A4.
//
// Нужно переключателю «Вариантов на листе»: раскладка намеренно НЕ режет
// переполнение (`overflow: hidden` прятал бы задания молча), поэтому лишние
// строки просто выдавливают ячейку за край листа. Прикидка ёмкости
// предупреждает об этом до печати.
//
// Модель грубая, но сверена с настоящей печатью (headless Chrome
// `--print-to-pdf` по реальному CSS, 03.09.2026): при интервале 1 на одном
// листе умещается 20 заданий в четверти, 12 в шестой части и 9 в восьмой;
// при интервале 1,5 — 12 / 7 / 5. Формула даёт те же числа.
// Величины в миллиметрах и совпадают с paddings в OralCountingPrintLayout.css:
// меняешь CSS — меняй здесь (сторожевой тест сверяет только калибровку).

export const PAGE_H_MM = 297;

// Раскладки: сколько рядов вариантов на листе и какие поля у ячейки.
// `rowMm` — минимальная высота строки задания, `headMm` — шапка целиком.
const LAYOUTS = {
  1:       { rows: 1, padMm: 20, rowMm: 7,   compact: false },
  '2side': { rows: 1, padMm: 16, rowMm: 7,   compact: false },
  '2half': { rows: 2, padMm: 10, rowMm: 7,   compact: false },
  4:       { rows: 2, padMm: 10, rowMm: 4.6, compact: true },
  6:       { rows: 3, padMm: 8,  rowMm: 4.4, compact: true },
  8:       { rows: 4, padMm: 6,  rowMm: 4.0, compact: true },
};

// Блоки над списком заданий: шапка (вариант/ФИО/класс/дата), название, инструкция
const HEAD_MM         = { normal: 11.5, compact: 9 };
const TITLE_MM        = { normal: 5,    compact: 4 };
const INSTRUCTION_MM  = { normal: 5,    compact: 4 };

// Задание занимает больше своей min-height: сверху-снизу padding, а дробь или
// корень поднимают строку ещё примерно на полмиллиметра. Без этой добавки
// прикидка обещала бы 26 заданий там, где реально помещается 20.
const ROW_EXTRA_MM = { normal: 2.6, compact: 1.4 };

export function sheetGeometry(perPage) {
  return LAYOUTS[perPage] || LAYOUTS[1];
}

/**
 * Прикидка: сколько заданий влезает в один вариант.
 *
 * @param {number|string} perPage  1 | '2side' | '2half' | 4 | 6 | 8
 * @param {object} opts  showHeader/showTitle/showInstruction/lineSpacing/columnsCount
 * @returns {{ rows, cellHeightMm, availableMm, rowHeightMm, perColumn, total }}
 */
export function sheetCapacity(perPage, opts = {}) {
  const {
    showHeader = true,
    showTitle = true,
    showInstruction = true,
    lineSpacing = 1,
    columnsCount = 1,
  } = opts;

  const geo = sheetGeometry(perPage);
  const key = geo.compact ? 'compact' : 'normal';

  const cellHeightMm = PAGE_H_MM / geo.rows;
  const headerMm = (showHeader ? HEAD_MM[key] : 0)
    + (showTitle ? TITLE_MM[key] : 0)
    + (showInstruction ? INSTRUCTION_MM[key] : 0);

  const availableMm = Math.max(0, cellHeightMm - geo.padMm - headerMm);

  // Интервал растягивает и саму строку, и зазор под ней (см. CSS:
  // margin-bottom: (scale − 1) × 6mm, в плотных раскладках × 3.5mm)
  const gapMm = Math.max(0, lineSpacing - 1) * (geo.compact ? 3.5 : 6);
  const rowHeightMm = geo.rowMm * lineSpacing + ROW_EXTRA_MM[key] + gapMm;

  const perColumn = Math.max(1, Math.floor(availableMm / rowHeightMm));
  // Две колонки задач бывают только там, где вариант занимает лист целиком
  // или половину: в четверти и мельче раскладка печатает одну колонку.
  const cols = geo.compact ? 1 : Math.max(1, columnsCount);

  return {
    rows: geo.rows,
    cellHeightMm,
    availableMm,
    rowHeightMm,
    perColumn,
    total: perColumn * cols,
  };
}

export default sheetCapacity;
