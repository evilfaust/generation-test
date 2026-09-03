import { Checkbox, Slider, Space, Segmented, Tooltip } from 'antd';
import { sheetCapacity } from '../../utils/sheetCapacity';

/**
 * Общие настройки печатного листа для всех генераторов: что показывать в шапке
 * и насколько разреженно печатать задания.
 *
 * Настройки живут в том же объекте `settings`, что и остальные параметры
 * генератора, и читаются через `sheetOptions()` — отсутствующий ключ означает
 * прежнее поведение. Поэтому хуки генераторов трогать не нужно: старый
 * сохранённый набор настроек и `reset()` продолжают работать как раньше.
 */

export const SHEET_DEFAULTS = {
  showHeader:      true,   // шапка целиком: «Вариант N», ФИО, класс, дата
  showClassField:  true,   // поле «Класс» в шапке
  showTitle:       true,   // название листа
  showInstruction: true,   // строка-инструкция («Вычислите:», «Решите…»)
  showAnswerSpace: true,   // место для ответа в строке задания («= ___», «Ответ:»)
  lineSpacing:     1,      // множитель межстрочного интервала заданий
};

export const LINE_SPACING_MIN = 0.75;
export const LINE_SPACING_MAX = 2.5;

export function sheetOptions(settings = {}) {
  const raw = Number(settings.lineSpacing);
  const lineSpacing = Number.isFinite(raw) && raw > 0
    ? Math.min(Math.max(raw, LINE_SPACING_MIN), LINE_SPACING_MAX)
    : SHEET_DEFAULTS.lineSpacing;

  return {
    showHeader:      settings.showHeader      ?? SHEET_DEFAULTS.showHeader,
    showClassField:  settings.showClassField  ?? SHEET_DEFAULTS.showClassField,
    showTitle:       settings.showTitle       ?? SHEET_DEFAULTS.showTitle,
    showInstruction: settings.showInstruction ?? SHEET_DEFAULTS.showInstruction,
    showAnswerSpace: settings.showAnswerSpace ?? SHEET_DEFAULTS.showAnswerSpace,
    lineSpacing,
  };
}

/**
 * Стиль корня раскладки: множитель уезжает в CSS-переменную, на которую
 * завязаны отступы строк заданий (`calc(7mm * var(--sheet-line-scale))`).
 * Inline-переменная переживает печать, в отличие от классов-модификаторов.
 */
export function sheetSpacingStyle(lineSpacing, extra) {
  return { '--sheet-line-scale': lineSpacing ?? 1, ...extra };
}

// Ant центрирует подпись под точкой (transform: translateX(-50%)), поэтому
// «Плотно» и «Просторно» на краях шкалы вылезали за панель настроек. Крайним
// меткам сдвиг переопределяем: первая выравнивается по левому краю ползунка,
// последняя — по правому.
const MARK_EDGE_LEFT  = { transform: 'translateX(-6%)',  whiteSpace: 'nowrap', fontSize: 11 };
const MARK_EDGE_RIGHT = { transform: 'translateX(-94%)', whiteSpace: 'nowrap', fontSize: 11 };
const MARK_MID        = { fontSize: 11 };

const SPACING_MARKS = {
  0.75: { style: MARK_EDGE_LEFT,  label: 'Плотно' },
  1:    { style: MARK_MID,        label: '1' },
  1.5:  { style: MARK_MID,        label: '1,5' },
  2.5:  { style: MARK_EDGE_RIGHT, label: 'Просторно' },
};

/**
 * Блок переключателей для панели генератора. Кладётся внутрь секции
 * «Печать и вид» рядом с настройками конкретного генератора.
 */
// Сколько вариантов помещается на листе. Значение пишется в `variantsPerPage`,
// раскладка читает его через `variantsPerPage(settings)` со старым фолбэком.
export const PER_PAGE_OPTIONS = [
  { value: 1,        label: '1' },
  { value: '2side',  label: '2 ↔' },
  { value: '2half',  label: '2 ↕' },
  { value: 4,        label: '4' },
  { value: 6,        label: '6' },
  { value: 8,        label: '8' },
];

const PER_PAGE_VALUES = new Set([1, 4, 6, 8, '2side', '2half']);

export function currentPerPage(settings = {}) {
  const v = settings.variantsPerPage;
  if (PER_PAGE_VALUES.has(v)) return v;
  if (settings.sideBySide) return '2side';
  if (settings.twoPerPage) return '2half';
  return 1;
}

export function SheetLayoutOptions({
  settings,
  onChange,
  showSpacing = true,          // у листов без строк заданий интервал не нужен
  showInstructionToggle = true, // ...а у листов без инструкции — её переключатель
  showPerPage = false,          // переключатель «вариантов на листе»
}) {
  const o = sheetOptions(settings);

  // Сколько заданий помещается в один вариант при выбранной раскладке.
  // Раскладка переполнение не режет (иначе задания пропадали бы молча),
  // поэтому предупреждаем заранее — см. utils/sheetCapacity.js.
  const plannedCount = Number(settings.questionsCount ?? settings.tasksPerVariant) || 0;
  const capacity = showPerPage
    ? sheetCapacity(currentPerPage(settings), { ...o, columnsCount: settings.columnsCount })
    : null;
  const tooMany = Boolean(capacity && plannedCount && plannedCount > capacity.total);

  const handlePerPage = (v) => {
    // старые ключи держим в согласии с новым — их читают смешанные работы
    onChange('variantsPerPage', v);
    onChange('sideBySide', v === '2side');
    onChange('twoPerPage', v === '2half');
  };

  return (
    <>
      {showPerPage && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>Вариантов на листе:</span>
            <Segmented
              size="small"
              options={PER_PAGE_OPTIONS}
              value={currentPerPage(settings)}
              onChange={handlePerPage}
            />
          </div>
          {capacity && (
            <Tooltip title="Лишние задания не обрезаются — они выдавят вариант за край листа">
              <div style={{
                fontSize: 11,
                marginTop: 4,
                color: tooMany ? 'var(--danger, #cf1322)' : 'var(--ink-3)',
              }}>
                {tooMany
                  ? `В ячейку влезает ~${capacity.total} заданий, а в варианте ${plannedCount} — лист переполнится`
                  : `В ячейку влезает ~${capacity.total} заданий`}
              </div>
            </Tooltip>
          )}
        </div>
      )}

      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Checkbox
          checked={o.showHeader}
          onChange={e => onChange('showHeader', e.target.checked)}
        >
          <span style={{ fontSize: 13 }}>Шапка: вариант, ФИО, дата</span>
        </Checkbox>
        <Checkbox
          checked={o.showClassField}
          disabled={!o.showHeader}
          onChange={e => onChange('showClassField', e.target.checked)}
        >
          <span style={{ fontSize: 13 }}>Поле «Класс»</span>
        </Checkbox>
        <Checkbox
          checked={o.showTitle}
          onChange={e => onChange('showTitle', e.target.checked)}
        >
          <span style={{ fontSize: 13 }}>Название листа</span>
        </Checkbox>
        <Checkbox
          checked={o.showAnswerSpace}
          onChange={e => onChange('showAnswerSpace', e.target.checked)}
        >
          <span style={{ fontSize: 13 }}>Место для ответа в строке</span>
        </Checkbox>
        {showInstructionToggle && (
          <Checkbox
            checked={o.showInstruction}
            onChange={e => onChange('showInstruction', e.target.checked)}
          >
            <span style={{ fontSize: 13 }}>Строка задания («Вычислите:»)</span>
          </Checkbox>
        )}
      </Space>

      {showSpacing && (
        <div style={{ marginTop: 10, padding: '0 4px' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 2 }}>
            Межстрочный интервал:{' '}
            <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
              {String(o.lineSpacing).replace('.', ',')}
            </b>
          </div>
          <Slider
            min={LINE_SPACING_MIN}
            max={LINE_SPACING_MAX}
            step={0.25}
            value={o.lineSpacing}
            onChange={v => onChange('lineSpacing', v)}
            marks={SPACING_MARKS}
            tooltip={{ formatter: v => String(v).replace('.', ',') }}
          />
        </div>
      )}
    </>
  );
}

export default SheetLayoutOptions;
