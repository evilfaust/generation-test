import { useEffect, useState } from 'react';
import { Modal, Segmented, Form, Input, Select, DatePicker, App } from 'antd';
import dayjs from 'dayjs';
import { PAIRS } from '../lessonTime';
import { api } from '../../../shared/services/pocketbase';

const TYPES = [
  { value: 'lesson', label: 'Урок' },
  { value: 'deadline', label: 'Дедлайн' },
  { value: 'todo', label: 'Дело' },
];

/**
 * Единое быстрое создание из сетки: табы Урок / Дедлайн / Дело.
 * Поля адаптируются под тип. Дата предзаполняется днём ячейки.
 */
export default function CreateEventModal({
  open, type: initType, day, pair: initPair, groups, works, onClose, onCreated,
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [type, setType] = useState(initType || 'lesson');
  const [pair, setPair] = useState(initPair || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType(initType || 'lesson');
      setPair(initPair || null);
      const base = day ? dayjs(day) : dayjs();
      form.setFieldsValue({
        title: '', group: undefined, work: undefined,
        date: base, due: base,
      });
    }
  }, [open, initType, initPair, day, form]);

  const applyPair = (key) => {
    setPair(key);
    const def = PAIRS.find((p) => p.key === key);
    if (def) {
      const [h, m] = def.full[0].split(':').map(Number);
      const cur = form.getFieldValue('date') || dayjs();
      form.setFieldsValue({ date: dayjs(cur).hour(h).minute(m).second(0) });
    }
  };

  const handleOk = async () => {
    let v;
    try { v = await form.validateFields(); } catch { return; }
    setSaving(true);
    try {
      if (type === 'lesson') {
        await api.createLesson({
          title: v.title,
          group: v.group || '',
          date_plan: (v.date || dayjs()).toISOString(),
          status: 'planned',
          time_slot: pair || '',
          materials: [],
        });
      } else if (type === 'deadline') {
        await api.createSession({
          work: v.work,
          is_open: true,
          deadline: (v.due || dayjs()).toISOString(),
        });
      } else {
        await api.createTodo({
          title: v.title,
          group: v.group || '',
          due_date: v.due ? v.due.toISOString() : '',
        });
      }
      message.success('Создано');
      onCreated();
      onClose();
    } catch {
      message.error('Не удалось создать');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Создать"
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      okText="Создать"
      cancelText="Отмена"
      destroyOnHidden
    >
      <Segmented block options={TYPES} value={type} onChange={setType} style={{ margin: '8px 0 16px' }} />
      <Form form={form} layout="vertical">
        {type === 'deadline' ? (
          <Form.Item name="work" label="Работа" rules={[{ required: true, message: 'Выберите работу' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Выберите работу"
              options={(works || []).map((w) => ({ value: w.id, label: w.title }))}
            />
          </Form.Item>
        ) : (
          <Form.Item name="title" label={type === 'lesson' ? 'Тема урока' : 'Что нужно сделать'}
            rules={[{ required: true, message: 'Введите название' }]}>
            <Input placeholder={type === 'lesson' ? 'Тема урока' : 'Например: проверить тетради'} maxLength={500} autoFocus />
          </Form.Item>
        )}

        {type !== 'deadline' && (
          <Form.Item name="group" label="Группа">
            <Select allowClear placeholder="Группа" options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
        )}

        {type === 'lesson' ? (
          <>
            <Form.Item label="Пара по расписанию">
              <div className="ce-pairs">
                {PAIRS.map((p) => (
                  <span key={p.key}
                    className={`ce-pair${pair === p.key ? ' is-active' : ''}`}
                    onClick={() => applyPair(p.key)} role="button" tabIndex={0}>
                    {p.label}
                  </span>
                ))}
              </div>
            </Form.Item>
            <Form.Item name="date" label="Дата и время" rules={[{ required: true }]}>
              <DatePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </>
        ) : (
          <Form.Item name="due" label="Срок" rules={type === 'deadline' ? [{ required: true }] : []}>
            <DatePicker
              showTime={type === 'deadline' ? { format: 'HH:mm' } : false}
              format={type === 'deadline' ? 'DD.MM.YYYY HH:mm' : 'DD.MM.YYYY'}
              style={{ width: '100%' }}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
