import { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, App } from 'antd';
import { api } from '../../services/pocketbase';
import { normalizeTopicTitle } from '../../utils/normalize';
import { EXAM_TYPES } from '../../utils/workImportFormat';

const EXAM_TYPE_LABELS = {
  ege_base: 'ЕГЭ базовый',
  ege_profile: 'ЕГЭ профильный',
  oge: 'ОГЭ (9 кл.)',
  vpr: 'ВПР',
  trig: 'Тригонометрия',
  mordkovich: 'Мордкович',
  oral: 'Устный счёт',
  other: 'Прочее',
};

const EXAM_TYPE_OPTIONS = EXAM_TYPES.map((value) => ({ value, label: EXAM_TYPE_LABELS[value] || value }));

/**
 * Создание темы прямо из мастера импорта работы: в чужой работе почти всегда
 * находится тема, которой в базе ещё нет.
 *
 * Правила совпадают с «Импортом задач»: дубль ищется по паре
 * (exam_type, ege_number), номер 0 — тема вне нумерации ЕГЭ.
 */
export default function TopicCreateModal({ open, topics = [], defaultTitle = '', defaultExamType = 'ege_base', onClose, onCreated }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [examType, setExamType] = useState(defaultExamType || 'ege_base');

  const handleOk = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const title = (values.title || '').trim();
    const number = Number(values.ege_number);

    if (number !== 0) {
      const clash = topics.find(
        (t) => String(t.ege_number) === String(number) && (t.exam_type || 'ege_base') === values.exam_type,
      );
      if (clash) {
        message.warning(`Номер ${number} уже занят темой «${clash.title}»`);
        return;
      }
    }

    const sameTitle = topics.find((t) => normalizeTopicTitle(t.title) === normalizeTopicTitle(title));
    if (sameTitle) {
      message.warning(`Тема «${title}» уже существует`);
      return;
    }

    setSaving(true);
    try {
      const data = {
        title,
        ege_number: number,
        order: number,
        exam_type: values.exam_type,
      };
      // exam_part имеет смысл только для профильного ЕГЭ
      if (values.exam_type === 'ege_profile' && values.exam_part) data.exam_part = Number(values.exam_part);

      const created = await api.createTopic(data);
      message.success(`Тема «${title}» создана`);
      form.resetFields();
      onCreated?.(created);
    } catch (error) {
      console.error('Error creating topic:', error);
      message.error('Не удалось создать тему');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Новая тема"
      okText="Создать"
      cancelText="Отмена"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose?.(); }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ title: defaultTitle, exam_type: defaultExamType || 'ege_base', ege_number: null, exam_part: 1 }}
        onValuesChange={(changed) => { if (changed.exam_type) setExamType(changed.exam_type); }}
      >
        <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название темы' }]}>
          <Input placeholder="Например: Производная и первообразная" />
        </Form.Item>
        <Form.Item
          name="ege_number"
          label="Номер задания"
          extra="0 — тема вне нумерации экзамена (входной тест, летнее ДЗ и т. п.)"
          rules={[{ required: true, message: 'Укажите номер' }]}
        >
          <InputNumber min={0} max={30} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="exam_type" label="Контекст">
          <Select options={EXAM_TYPE_OPTIONS} />
        </Form.Item>
        {examType === 'ege_profile' && (
          <Form.Item name="exam_part" label="Часть экзамена">
            <Select
              options={[
                { value: 1, label: 'Часть 1 — краткий ответ' },
                { value: 2, label: 'Часть 2 — развёрнутое решение' },
              ]}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
