import { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, InputNumber, ColorPicker, Popconfirm, Spin, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BookOutlined, HolderOutlined, AppstoreOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { WorkspacePageHeader, EmptyState } from './workspace/ui';
import './theory/TheoryCategoryManager.css';

const DEFAULT_CATEGORIES = [
  { title: 'Алгебра', color: '#1890ff', order: 1 },
  { title: 'Геометрия', color: '#52c41a', order: 2 },
  { title: 'Тригонометрия', color: '#722ed1', order: 3 },
  { title: 'Теория вероятностей', color: '#fa8c16', order: 4 },
  { title: 'Математический анализ', color: '#eb2f96', order: 5 },
  { title: 'Комбинаторика', color: '#13c2c2', order: 6 },
];

export default function TheoryCategoryManager() {
  const { message } = App.useApp();
  const [categories, setCategories] = useState([]);
  const [articleCounts, setArticleCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, counts] = await Promise.all([
        api.getTheoryCategories(),
        api.getTheoryArticleCountByCategory(),
      ]);
      setCategories(cats);
      setArticleCounts(counts);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCategory(null);
    form.resetFields();
    form.setFieldsValue({ color: '#1890ff', order: categories.length + 1 });
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingCategory(record);
    form.setFieldsValue({
      title: record.title,
      description: record.description || '',
      color: record.color || '#1890ff',
      order: record.order || 0,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    const count = articleCounts[id] || 0;
    if (count > 0) {
      message.error(`Нельзя удалить категорию — в ней ${count} статей`);
      return;
    }
    try {
      await api.deleteTheoryCategory(id);
      message.success('Категория удалена');
      loadData();
    } catch (error) {
      message.error('Ошибка при удалении');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const color = typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || '#1890ff';
      const data = {
        title: values.title,
        description: values.description || '',
        color,
        order: values.order || 0,
      };
      if (editingCategory) {
        await api.updateTheoryCategory(editingCategory.id, data);
        message.success('Категория обновлена');
      } else {
        await api.createTheoryCategory(data);
        message.success('Категория создана');
      }
      setModalOpen(false);
      loadData();
    } catch (error) {
      if (error.errorFields) return;
      message.error('Ошибка при сохранении');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      for (const cat of DEFAULT_CATEGORIES) {
        const exists = categories.find(c => c.title === cat.title);
        if (!exists) {
          await api.createTheoryCategory(cat);
        }
      }
      message.success('Категории по умолчанию созданы');
      loadData();
    } catch (error) {
      message.error('Ошибка при создании категорий');
    }
  };

  // Drag-and-drop
  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (index) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newCats = [...categories];
    const [moved] = newCats.splice(dragIndex, 1);
    newCats.splice(index, 0, moved);

    // Optimistic update
    setCategories(newCats);
    setDragIndex(null);
    setDragOverIndex(null);

    // Update order in DB
    try {
      for (let i = 0; i < newCats.length; i++) {
        if (newCats[i].order !== i + 1) {
          await api.updateTheoryCategory(newCats[i].id, { order: i + 1 });
        }
      }
    } catch (error) {
      message.error('Ошибка при изменении порядка');
      loadData();
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Lighten color for gradient
  const lightenColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  };

  return (
    <div>
      <WorkspacePageHeader
        icon={<AppstoreOutlined />}
        accent="violet"
        title="Категории теории"
        subtitle="Разделы, по которым группируются статьи"
        extra={(
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Добавить категорию
          </Button>
        )}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          title="Категорий пока нет"
          description="Создайте категории по умолчанию или добавьте свою"
          cta="Создать категории по умолчанию"
          ctaType="default"
          onCta={handleSeedDefaults}
        />
      ) : (
        <div className="theory-categories-grid">
          {categories.map((cat, index) => {
            const count = articleCounts[cat.id] || 0;
            return (
              <div
                key={cat.id}
                className={`theory-category-card ${dragIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
              >
                <div className="category-card-drag">
                  <HolderOutlined />
                </div>

                <div
                  className="category-card-icon"
                  style={{
                    background: `linear-gradient(135deg, ${cat.color}, ${lightenColor(cat.color, 30)})`,
                  }}
                >
                  <BookOutlined />
                </div>

                <div className="category-card-body">
                  <h3 className="category-card-title">{cat.title}</h3>
                  {cat.description && (
                    <p className="category-card-desc">{cat.description}</p>
                  )}
                </div>

                <div className="category-card-stats">
                  <span className="category-card-count">{count} статей</span>
                  <span className="category-card-order">#{cat.order}</span>
                </div>

                <div className="category-card-actions">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(cat)}
                  />
                  <Popconfirm
                    title="Удалить категорию?"
                    description={count > 0
                      ? `В этой категории ${count} статей. Сначала переместите их.`
                      : 'Это действие нельзя отменить.'
                    }
                    onConfirm={() => handleDelete(cat.id)}
                    okText="Да"
                    cancelText="Нет"
                    disabled={count > 0}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={count > 0}
                    />
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        title={editingCategory ? 'Редактировать категорию' : 'Новая категория'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Название"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Например: Алгебра" />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} placeholder="Краткое описание категории" />
          </Form.Item>

          <Form.Item name="color" label="Цвет">
            <ColorPicker />
          </Form.Item>

          <Form.Item name="order" label="Порядок">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
