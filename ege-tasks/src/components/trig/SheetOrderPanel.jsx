import { useState } from 'react';
import { Button, Tooltip } from 'antd';
import {
  HolderOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CloseOutlined, LineOutlined, ReloadOutlined, EditOutlined, PlusOutlined,
} from '@ant-design/icons';
import { TrigSettingsSection } from './TrigGeneratorLayout';

/**
 * Порядок заданий на листе: перетаскивание строк, разделительные черты и
 * правка отдельного задания (✏️ — если генератор передал onEditTask).
 *
 * Порядок общий для всех вариантов — задания одного типа стоят на одинаковых
 * местах, поэтому и черта («отсюда — задания посложнее») проходит через все
 * варианты одинаково. Меняет только вид листа: задания не перегенерируются.
 */
export function SheetOrderPanel({
  layout,
  categoryLabels = {},
  sample = [],          // первый вариант — из него берём подпись задания
  onMove,
  onAddDivider,
  onRemoveAt,
  onReset,
  onEditTask,   // (idx) => void — открыть правку задания этой позиции
  onAddTask,    // () => void — вписать своё задание
}) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  if (!layout?.length) return null;

  const handleDrop = (target) => {
    if (dragIdx !== null && dragIdx !== target) onMove(dragIdx, target);
    setDragIdx(null);
    setOverIdx(null);
  };

  // Короткая подпись задания: название категории без примера после двоеточия
  const label = (item) => {
    const q = sample[item.idx];
    // Задание, вписанное учителем руками, категории не имеет
    if (q?.cat === 'manual') return 'своё задание';
    const raw = categoryLabels[q?.cat] || q?.cat || 'задание';
    return raw.split(':')[0];
  };

  let taskNo = 0;

  return (
    <TrigSettingsSection label="Порядок заданий">
      <div style={{ maxHeight: 260, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
        {layout.map((item, i) => {
          const isDivider = item.kind === 'divider';
          const n = isDivider ? null : ++taskNo;
          return (
            <div
              key={isDivider ? item.id : `t${item.idx}`}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 4px',
                marginBottom: 2,
                borderRadius: 4,
                cursor: 'grab',
                fontSize: 12,
                background: dragIdx === i ? 'var(--accent-soft)' : 'transparent',
                borderTop: overIdx === i && dragIdx !== null && dragIdx !== i
                  ? '2px solid var(--accent)' : '2px solid transparent',
                opacity: dragIdx === i ? 0.6 : 1,
              }}
            >
              <HolderOutlined style={{ color: 'var(--ink-4)', fontSize: 12 }} />
              {isDivider ? (
                <>
                  <span style={{ flex: 1, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                    ──── черта ────
                  </span>
                  <Button
                    type="text" size="small" icon={<CloseOutlined />}
                    onClick={() => onRemoveAt(i)}
                  />
                </>
              ) : (
                <>
                  <span style={{
                    minWidth: 18, fontWeight: 600,
                    fontFamily: 'var(--font-mono)', color: 'var(--ink-3)',
                  }}>
                    {n})
                  </span>
                  <span style={{
                    flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {label(item)}
                  </span>
                  {onEditTask && (
                    <Tooltip title="Править задание: текст, ответ, заново">
                      <Button
                        type="text" size="small" icon={<EditOutlined />}
                        onClick={() => onEditTask(item.idx)}
                      />
                    </Tooltip>
                  )}
                  <Button
                    type="text" size="small" icon={<ArrowUpOutlined />}
                    disabled={i === 0}
                    onClick={() => onMove(i, i - 1)}
                  />
                  <Button
                    type="text" size="small" icon={<ArrowDownOutlined />}
                    disabled={i === layout.length - 1}
                    onClick={() => onMove(i, i + 1)}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <Tooltip title="Горизонтальная линия на листе — например, отделить задания посложнее">
          <Button block size="small" icon={<LineOutlined />} onClick={() => onAddDivider()}>
            Черта
          </Button>
        </Tooltip>
        <Button block size="small" icon={<ReloadOutlined />} onClick={onReset}>
          Сбросить
        </Button>
      </div>

      {onAddTask && (
        <Button
          block size="small" type="dashed" icon={<PlusOutlined />}
          onClick={onAddTask} style={{ marginTop: 6 }}
        >
          Своё задание
        </Button>
      )}
    </TrigSettingsSection>
  );
}

export default SheetOrderPanel;
