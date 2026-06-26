import { useEffect, useMemo, useState } from 'react';
import { Modal, Select, Spin } from 'antd';
import dayjs from 'dayjs';
import { api } from '../../../shared/services/pocketbase';

const TITLES = { student: 'Привязать ученика', lesson: 'Привязать урок', work: 'Привязать работу' };

// Модалка выбора сущности для привязки дела. type ∈ student|lesson|work.
export default function TodoLinkModal({ open, type, current, onCancel, onPick }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [value, setValue] = useState(current || null);

  useEffect(() => { setValue(current || null); }, [current, open]);

  useEffect(() => {
    if (!open || !type) return;
    let cancelled = false;
    setLoading(true);
    const loader = type === 'student'
      ? api.getStudents()
      : type === 'lesson'
        ? api.getLessons({ from: dayjs().subtract(45, 'day').toISOString(), to: dayjs().add(90, 'day').toISOString() })
        : api.getWorks();
    Promise.resolve(loader)
      .then((list) => { if (!cancelled) setItems(Array.isArray(list) ? list : (list?.items || [])); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, type]);

  const options = useMemo(() => items.map((it) => {
    if (type === 'student') return { value: it.id, label: it.name || it.username };
    if (type === 'lesson') {
      const d = it.date_plan ? ` · ${dayjs(it.date_plan).format('DD.MM')}` : '';
      return { value: it.id, label: `${it.title || 'Урок'}${d}` };
    }
    return { value: it.id, label: it.title || 'Работа' };
  }), [items, type]);

  const confirm = () => {
    const picked = options.find((o) => o.value === value);
    onPick(type, value ? { id: value, label: picked?.label || '' } : null);
  };

  return (
    <Modal
      open={open}
      title={TITLES[type] || 'Привязать'}
      onCancel={onCancel}
      onOk={confirm}
      okText="Привязать"
      cancelText="Отмена"
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : (
        <Select
          showSearch
          allowClear
          style={{ width: '100%' }}
          placeholder="Выберите…"
          value={value}
          onChange={setValue}
          options={options}
          optionFilterProp="label"
        />
      )}
    </Modal>
  );
}
