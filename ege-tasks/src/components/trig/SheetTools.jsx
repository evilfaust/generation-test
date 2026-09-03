import { useState } from 'react';
import { Modal, Input, Button, Tooltip } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import MathInline from '../shared/MathInline';
import SheetTaskEditModal from './SheetTaskEditModal';
import { TrigSettingsSection } from './TrigGeneratorLayout';
import { getSheetGenerator } from '../../utils/sheetRegistry';

const { TextArea } = Input;

// Своё задание, вписанное руками. Попадает во все варианты одинаковым —
// это «общий вопрос» листа, а не параллель.
function AddTaskModal({ open, onClose, onAdd }) {
  const [expr, setExpr] = useState('');
  const [answer, setAnswer] = useState('');

  const handleOk = () => {
    if (!expr.trim()) return;
    onAdd({ exprLatex: expr.trim(), resultLatex: answer.trim() });
    setExpr('');
    setAnswer('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Добавить"
      cancelText="Отмена"
      title="Своё задание"
      destroyOnHidden
      okButtonProps={{ disabled: !expr.trim() }}
    >
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
        Задание встанет в конец листа одинаковым во всех вариантах.
      </div>
      <div style={{
        padding: '8px 10px', background: 'var(--bg-sunken)',
        borderRadius: 'var(--radius)', marginBottom: 10, minHeight: 34, overflowX: 'auto',
      }}>
        <MathInline latex={expr || '\\;'} />
        {answer && (
          <>
            <span style={{ color: 'var(--ink-3)', margin: '0 8px' }}>→</span>
            <MathInline latex={answer} />
          </>
        )}
      </div>
      <TextArea
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        autoSize={{ minRows: 1, maxRows: 3 }}
        placeholder="Условие в LaTeX, например 3x + 5 = 17"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 6 }}
        autoFocus
      />
      <Input
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Ответ в LaTeX (для листа учителя)"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
      />
    </Modal>
  );
}

/**
 * Модалки правки листа (правка задания + своё задание).
 * Ставится один раз в генераторе; кнопки-точки входа — в панелях
 * «Порядок заданий» (onEditTask) и «Задания» (SheetTasksPanel).
 */
export function SheetToolsModals({ sheet }) {
  const meta = getSheetGenerator(sheet.generator);
  const labels = meta?.categoryLabels || {};
  const cat = sheet.editIndex === null
    ? null
    : sheet.tasksData?.[0]?.[sheet.editIndex]?.cat;

  // Номер задания на листе: позиции могли быть переставлены, но правим мы
  // задание по его месту в варианте — показываем его же номер по порядку.
  const displayNumber = sheet.editIndex === null ? null : sheet.editIndex + 1;

  return (
    <>
      <SheetTaskEditModal
        open={sheet.editIndex !== null}
        onClose={sheet.closeTask}
        taskIndex={sheet.editIndex}
        displayNumber={displayNumber}
        categoryLabel={cat === 'manual'
          ? 'своё задание'
          : (cat ? (labels[cat] || cat).split(':')[0] : null)}
        tasksData={sheet.tasksData}
        editing={sheet.editing}
        canRegenerate={Boolean(meta?.generate)}
      />
      <AddTaskModal
        open={sheet.addOpen}
        onClose={sheet.closeAdd}
        onAdd={sheet.editing.append}
      />
    </>
  );
}

/**
 * Список заданий листа с правкой — для генераторов без панели «Порядок заданий»
 * (тригонометрия: своя печатная раскладка, порядок там не переставляется).
 */
export function SheetTasksPanel({ sheet }) {
  const tasks = sheet.tasksData?.[0];
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  return (
    <TrigSettingsSection label="Задания">
      <div style={{ maxHeight: 240, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
        {tasks.map((task, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 0', borderBottom: '1px solid var(--rule-soft)',
            }}
          >
            <span style={{
              width: 20, fontSize: 11, color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)', flexShrink: 0,
            }}>
              {idx + 1}
            </span>
            <span style={{
              flex: 1, minWidth: 0, fontSize: 12, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <MathInline latex={task.exprLatex} />
            </span>
            <Tooltip title="Править задание">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => sheet.openTask(idx)}
              />
            </Tooltip>
          </div>
        ))}
      </div>
      <Button
        size="small"
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={sheet.openAdd}
        style={{ marginTop: 8 }}
      >
        Своё задание
      </Button>
    </TrigSettingsSection>
  );
}

export default SheetToolsModals;
