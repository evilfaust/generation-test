/**
 * MaterialEditModal — правка метаданных файла из «Библиотеки» (название, категория,
 * предмет, описание, папка). Сам файл не меняется. Использует materialsApi.updateMaterial.
 * folders: array → показать TreeSelect «Папка» (перемещение); null → папки выключены.
 */
import { useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select, TreeSelect, App } from 'antd';
import { materialsApi, CATEGORY_LABELS } from '../../shared/services/pb/filesClient';
import { buildFolderTree } from './folderTree';

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export default function MaterialEditModal({ open, record, folders = null, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const foldersEnabled = Array.isArray(folders);

  const folderTreeData = useMemo(
    () => (foldersEnabled
      ? [{ value: '', title: '📁 Корень библиотеки', children: buildFolderTree(folders) }]
      : []),
    [folders, foldersEnabled],
  );

  useEffect(() => {
    if (open && record) {
      form.setFieldsValue({
        title: record.title || record.original_name || '',
        category: record.category || 'other',
        subject: record.subject || '',
        description: record.description || '',
        folder: record.folder || '',
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
        ...(foldersEnabled ? { folder: v.folder || '' } : {}),
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
        {foldersEnabled && (
          <Form.Item name="folder" label="Папка">
            <TreeSelect treeData={folderTreeData} treeDefaultExpandAll showSearch
              treeNodeFilterProp="title" />
          </Form.Item>
        )}
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
