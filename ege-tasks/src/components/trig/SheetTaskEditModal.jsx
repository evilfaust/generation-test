import { useState } from 'react';
import { Modal, Input, Button, Popconfirm, Tooltip, Empty, App } from 'antd';
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import MathInline from '../shared/MathInline';
import { tasksAtPosition } from '../../utils/sheetTasks';

const { TextArea } = Input;

// Одно задание одного варианта: поля LaTeX + живое превью + «заново».
function TaskRow({ variantIndex, task, onPatch, onRegenerate }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 0', borderTop: '1px solid var(--rule-soft)',
    }}>
      <div style={{
        width: 34, flexShrink: 0, fontSize: 12, color: 'var(--ink-3)',
        fontFamily: 'var(--font-mono)', paddingTop: 6,
      }}>
        В{variantIndex + 1}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          padding: '6px 10px', background: 'var(--bg-sunken)',
          borderRadius: 'var(--radius)', marginBottom: 6, overflowX: 'auto',
        }}>
          <MathInline latex={task.exprLatex} />
          <span style={{ color: 'var(--ink-3)', margin: '0 8px' }}>→</span>
          <MathInline latex={task.resultLatex} />
        </div>
        <TextArea
          value={task.exprLatex}
          onChange={(e) => onPatch({ exprLatex: e.target.value })}
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 4 }}
          placeholder="Условие в LaTeX"
        />
        <Input
          value={task.resultLatex}
          onChange={(e) => onPatch({ resultLatex: e.target.value })}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          placeholder="Ответ в LaTeX"
        />
      </div>

      <Tooltip title="Другое задание этого же типа">
        <Button
          size="small"
          type="text"
          icon={<ReloadOutlined />}
          onClick={onRegenerate}
          style={{ marginTop: 6 }}
        />
      </Tooltip>
    </div>
  );
}

/**
 * Правка задания листа: сразу все варианты одной позиции.
 *
 * Позиция общая для вариантов (в №5 везде задание одного типа), поэтому
 * правится оно здесь целой строкой листа, а не по одному варианту вслепую.
 * Изменения уходят в снимок сразу — «Готово» просто закрывает окно.
 */
export function SheetTaskEditModal({
  open,
  onClose,
  taskIndex,
  displayNumber,
  categoryLabel,
  tasksData,
  editing,       // useSheetTaskEditing
  canRegenerate = true,
}) {
  const { message } = App.useApp();
  const rows = taskIndex === null ? [] : tasksAtPosition(tasksData, taskIndex);

  const handleRegenerate = (variantIndex) => {
    if (!editing.regenerate(variantIndex, taskIndex)) {
      message.warning('Генератор не смог собрать задание этого типа с текущими настройками');
    }
  };

  const handleRegenerateAll = () => {
    if (!editing.regenerateAll(taskIndex)) {
      message.warning('Генератор не смог собрать задания этого типа с текущими настройками');
    }
  };

  const handleRemove = () => {
    editing.remove(taskIndex);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Задание №${displayNumber ?? ''}${categoryLabel ? ` — ${categoryLabel}` : ''}`}
      width={720}
      destroyOnHidden
      footer={[
        <Popconfirm
          key="remove"
          title="Убрать задание с листа?"
          description="Позиция исчезнет во всех вариантах."
          okText="Убрать"
          cancelText="Отмена"
          okButtonProps={{ danger: true }}
          onConfirm={handleRemove}
        >
          <Button danger icon={<DeleteOutlined />} style={{ float: 'left' }}>
            Убрать с листа
          </Button>
        </Popconfirm>,
        canRegenerate && (
          <Button key="regen" icon={<ReloadOutlined />} onClick={handleRegenerateAll}>
            Заново во всех вариантах
          </Button>
        ),
        <Button key="ok" type="primary" onClick={onClose}>Готово</Button>,
      ].filter(Boolean)}
    >
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
        Правки видны на листе сразу. Чтобы они не пропали, сохраните лист —
        «Сформировать» соберёт задания заново.
      </div>

      <div style={{ maxHeight: 440, overflowY: 'auto' }}>
        {rows.length === 0 ? (
          <Empty description="Задание не найдено" />
        ) : rows.map(({ variantIndex, task }) => (
          <TaskRow
            key={variantIndex}
            variantIndex={variantIndex}
            task={task}
            onPatch={(fields) => editing.patch(variantIndex, taskIndex, fields)}
            onRegenerate={() => handleRegenerate(variantIndex)}
          />
        ))}
      </div>
    </Modal>
  );
}

export default SheetTaskEditModal;
