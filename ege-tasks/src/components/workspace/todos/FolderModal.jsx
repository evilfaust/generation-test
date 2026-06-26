import { useEffect, useState } from 'react';
import { Modal, Input } from 'antd';

const COLORS = ['blue', 'teal', 'violet', 'amber', 'rose', 'neutral'];

// Создание/переименование папки «Дел» (имя + цвет-тон).
export default function FolderModal({ open, folder, onCancel, onSubmit }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('neutral');

  useEffect(() => {
    if (open) {
      setName(folder?.name || '');
      setColor(folder?.color || 'neutral');
    }
  }, [open, folder]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, color });
  };

  return (
    <Modal
      open={open}
      title={folder ? 'Переименовать папку' : 'Новая папка'}
      onCancel={onCancel}
      onOk={submit}
      okText={folder ? 'Сохранить' : 'Создать'}
      cancelText="Отмена"
      okButtonProps={{ disabled: !name.trim() }}
      destroyOnClose
    >
      <Input
        autoFocus
        placeholder="Название папки"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onPressEnter={submit}
        maxLength={100}
        style={{ marginBottom: 14 }}
      />
      <div className="todo-folder-colors">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`todo-folder-color${color === c ? ' is-active' : ''}`}
            style={{ background: `var(--c-${c === 'neutral' ? 'blue' : c})`, opacity: c === 'neutral' ? 0.35 : 1 }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
      </div>
    </Modal>
  );
}
