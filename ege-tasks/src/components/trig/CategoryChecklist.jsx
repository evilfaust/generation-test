import { Checkbox, InputNumber, Tooltip } from 'antd';

/**
 * Список категорий блока: чекбокс «включена» + сколько заданий этого типа.
 *
 * Пустое поле — «сколько получится»: такие категории делят между собой
 * оставшиеся задания поровну (прежнее поведение). Указанное число — жёсткая
 * квота: «пропорций — 3, остальное как выйдет». Раскладку по позициям делает
 * `utils/questionPlan.js`, типы при этом чередуются, а не идут группами.
 */
export function CategoryChecklist({
  keys,
  labels,
  categories,
  counts = {},
  onToggle,
  onCount,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {keys.map(cat => {
        const on = Boolean(categories[cat]);
        return (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Checkbox
              checked={on}
              onChange={e => onToggle(cat, e.target.checked)}
              style={{ flex: 1, minWidth: 0 }}
            >
              <span style={{ fontSize: 12 }}>{labels[cat]}</span>
            </Checkbox>
            <Tooltip title="Сколько заданий этого типа. Пусто — сколько получится">
              <InputNumber
                size="small"
                min={1}
                max={30}
                controls={false}
                disabled={!on}
                placeholder="—"
                value={counts[cat] ?? null}
                onChange={v => onCount(cat, v)}
                style={{ width: 46, flexShrink: 0 }}
              />
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

export default CategoryChecklist;
