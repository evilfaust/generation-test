/**
 * MaterialEditModal — правка метаданных файла из «Библиотеки» (название, категория,
 * предмет, описание). Сам файл не меняется. Использует materialsApi.updateMaterial.
 */
import { useEffect } from 'react';
import { Modal, Form, Input, Select, App } from 'antd';
import { materialsApi, CATEGORY_LABELS } from '../../shared/services/pb/filesClient';

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export default function MaterialEditModal({ open, record, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && record) {
      form.setFieldsValue({
        title: record.title || record.original_name || '',
        category: record.category || 'other',
        subject: record.subject || '',
        description: record.description || '',
      });
    }
  }, [open, record, form]);

  const onFinish = async (v) => {
    try {
      const updated = await materialsApi.updateMaterial(record.id, {
        title: v.title,
        category: v.category,
        subject: v.subject || '',
        description: v.description || '',
      });
      message.success('Сохранено');
      onSaved?.(updated);
      onClose();
    } catch (e) {
      message.error(e?.message || 'Не удалось сохранить');
    }
  };

  return (
    <Modal open={open} title="Редактировать файл" onCancel={onClose} onOk={() => form.submit()}
      okText="Сохранить" cancelText="Отмена" destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 8 }}>
        <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
          <Input maxLength={500} />
        </Form.Item>
        <Form.Item name="category" label="Категория">
          <Select options={CATEGORY_OPTIONS} />
        </Form.Item>
        <Form.Item name="subject" label="Предмет / тема (необязательно)">
          <Input maxLength={200} placeholder="алгебра, стереометрия…" />
        </Form.Item>
        <Form.Item name="description" label="Описание (необязательно)">
          <Input.TextArea rows={2} maxLength={1000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
