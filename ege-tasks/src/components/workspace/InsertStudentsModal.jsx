import { useEffect, useMemo, useState } from 'react';
import { App, Checkbox, Modal, Space, Spin, Typography } from 'antd';
import { api } from '../../shared/services/pocketbase';

const { Text } = Typography;

// Модалка выбора учеников группы для вставки разделов траектории в заметку урока.
// Все ученики отмечены по умолчанию — снимаешь ненужных.
export default function InsertStudentsModal({ open, groupId, onCancel, onConfirm }) {
  const { message } = App.useApp();
  const [students, setStudents] = useState([]);
  const [checked, setChecked] = useState(() => new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!open || !groupId) return undefined;
    setLoading(true);
    api.getStudentsByGroup(groupId)
      .then((st) => {
        if (cancelled) return;
        setStudents(st);
        setChecked(new Set(st.map((s) => s.id))); // все отмечены
      })
      .catch(() => { if (!cancelled) message.error('Не удалось загрузить учеников группы'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, groupId, message]);

  const allChecked = students.length > 0 && checked.size === students.length;
  const someChecked = checked.size > 0 && !allChecked;

  const toggle = (id, on) => setChecked((prev) => {
    const n = new Set(prev);
    if (on) n.add(id); else n.delete(id);
    return n;
  });
  const toggleAll = (on) => setChecked(on ? new Set(students.map((s) => s.id)) : new Set());

  const selected = useMemo(
    () => students.filter((s) => checked.has(s.id)),
    [students, checked],
  );

  return (
    <Modal
      open={open}
      title="Ученики группы → разделы в заметке"
      onCancel={onCancel}
      onOk={() => onConfirm(selected)}
      okText={`Вставить (${selected.length})`}
      cancelText="Отмена"
      okButtonProps={{ disabled: selected.length === 0 }}
      destroyOnHidden
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        На каждого выбранного ученика добавится раздел (имя-заголовок + место для траектории).
        Ученик отметится в заметке — она появится в его карточке.
      </Text>
      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ padding: '12px 0', textAlign: 'center' }}><Spin size="small" /></div>
        ) : students.length === 0 ? (
          <Text type="secondary">В группе нет учеников.</Text>
        ) : (
          <>
            <Checkbox
              indeterminate={someChecked}
              checked={allChecked}
              onChange={(e) => toggleAll(e.target.checked)}
              style={{ marginBottom: 8 }}
            >
              Все ({students.length})
            </Checkbox>
            <Space direction="vertical" size={4} style={{ width: '100%', maxHeight: 320, overflowY: 'auto' }}>
              {students.map((s) => (
                <Checkbox
                  key={s.id}
                  checked={checked.has(s.id)}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                >
                  {s.name || s.username}
                </Checkbox>
              ))}
            </Space>
          </>
        )}
      </div>
    </Modal>
  );
}
