import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Typography, Modal, Form, Input, InputNumber,
  Popconfirm, message, Tag, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined,
  UnorderedListOutlined, CreditCardOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const TYPE_LABELS = {
  theorem: { label: 'Теорема', color: 'blue' },
  definition: { label: 'Определение', color: 'green' },
  formula: { label: 'Формула', color: 'purple' },
  axiom: { label: 'Аксиома', color: 'orange' },
  property: { label: 'Свойство', color: 'cyan' },
  criterion: { label: 'Признак', color: 'magenta' },
  corollary: { label: 'Следствие', color: 'gold' },
};

export default function TDFManager({ onOpenEditor, onOpenVariants, onOpenFlashcards }) {
  const { canEdit, canDelete } = useAuth();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadSets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTdfSets();
      setSets(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSets(); }, [loadSets]);

  const openCreate = () => {
    setEditingSet(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingSet(record);
    form.setFieldsValue({
      title: record.title,
      class_number: record.class_number || undefined,
      description: record.description || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingSet) {
        await api.updateTdfSet(editingSet.id, values);
        message.success('ТДФ обновлён');
      } else {
        await api.createTdfSet({ ...values, order: sets.length });
        message.success('ТДФ создан');
      }
      setModalOpen(false);
      loadSets();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTdfSet(id);
      message.success('ТДФ удалён');
      loadSets();
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{text}</Text>
          {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>}
        </Space>
      ),
    },
    {
      title: 'Класс',
      dataIndex: 'class_number',
      key: 'class_number',
      width: 80,
      render: (v) => v ? <Tag>{v} кл.</Tag> : '—',
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 310,
      render: (_, record) => (
        <Space>
          {canEdit && (
            <Tooltip title="Редактировать конспект">
              <Button
                icon={<FileTextOutlined />}
                onClick={() => onOpenEditor(record.id)}
              >
                Конспект
              </Button>
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Варианты опросников">
              <Button
                icon={<UnorderedListOutlined />}
                onClick={() => onOpenVariants(record.id)}
              >
                Варианты
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Карточки-флипы для самопроверки">
            <Button
              icon={<CreditCardOutlined />}
              onClick={() => onOpenFlashcards?.(record.id)}
            >
              Карточки
            </Button>
          </Tooltip>
          {canEdit && <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />}
          {canDelete && (
            <Popconfirm
              title="Удалить этот ТДФ?"
              description="Все пункты и варианты будут удалены."
              onConfirm={() => handleDelete(record.id)}
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
            >
              <Button icon={<DeleteOutlined />} danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>ТДФ — Теоремы, Определения, Формулы</Title>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Новый ТДФ
          </Button>
        )}
      </div>

      <Table
        dataSource={sets}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'Нет ТДФ-наборов. Создайте первый!' }}
      />

      <Modal
        title={editingSet ? 'Редактировать ТДФ' : 'Новый ТДФ'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input placeholder="Например: Параллельные прямые, 7 класс" />
          </Form.Item>
          <Form.Item name="class_number" label="Класс">
            <InputNumber min={1} max={12} style={{ width: '100%' }} placeholder="7" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} placeholder="Краткое описание (необязательно)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
