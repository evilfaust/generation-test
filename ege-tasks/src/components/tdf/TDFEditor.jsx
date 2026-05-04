import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button, Space, Typography, Spin, message, Tooltip, Tag, Popconfirm,
  Table, Modal, Dropdown,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  PrinterOutlined, DragOutlined, LineOutlined, DownOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import TDFItemModal from './TDFItemModal';
import TDFPrintView from './TDFPrintView';
import MathRenderer from '../../shared/components/MathRenderer';

const { Title, Text } = Typography;

const TYPE_COLORS = {
  theorem: 'blue', definition: 'green', formula: 'purple', axiom: 'orange', property: 'cyan', criterion: 'magenta', corollary: 'gold',
};
const TYPE_LABELS = {
  theorem: 'Теорема', definition: 'Определение', formula: 'Формула',
  axiom: 'Аксиома', property: 'Свойство', criterion: 'Признак', corollary: 'Следствие',
};

export default function TDFEditor({ setId, onBack }) {
  const [tdfSet, setTdfSet] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState(null);
  const [printMode, setPrintMode] = useState(null); // null | 'etalon'
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [set, its] = await Promise.all([
        api.getTdfSet(setId),
        api.getTdfItems(setId),
      ]);
      setTdfSet(set);
      setItems(its);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = (afterIndex = null) => {
    setEditingItem(null);
    setInsertAfterIndex(afterIndex);
    setItemModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setInsertAfterIndex(null);
    setItemModalOpen(true);
  };

  const handleItemSaved = async (savedItem, isNew) => {
    if (isNew && insertAfterIndex !== null) {
      // Переупорядочить: вставить после insertAfterIndex
      const newItems = [...items];
      const insertPos = insertAfterIndex + 1;
      newItems.splice(insertPos, 0, savedItem);
      await reorderItems(newItems);
    } else {
      await loadData();
    }
    setItemModalOpen(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTdfItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      message.success('Пункт удалён');
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const addSectionHeader = async (afterIndex = null) => {
    const order = afterIndex !== null ? afterIndex + 1 : items.length;
    try {
      const created = await api.createTdfItem({
        tdf_set: setId,
        is_section_header: true,
        section_title: 'Новый раздел',
        order,
      });
      const newItems = [...items];
      newItems.splice(order, 0, created);
      await reorderItems(newItems);
    } catch {
      message.error('Ошибка добавления раздела');
    }
  };

  const reorderItems = async (newItems) => {
    const ordered = newItems.map((item, idx) => ({ ...item, order: idx }));
    setItems(ordered);
    // Сохранить порядок в БД
    await Promise.all(ordered.map(item => api.updateTdfItem(item.id, { order: item.order })));
  };

  // Drag & Drop
  const onDragStart = (idx) => setDragIdx(idx);
  const onDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop = async (idx) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const newItems = [...items];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(idx, 0, moved);
    setDragIdx(null);
    setDragOverIdx(null);
    await reorderItems(newItems);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;

  if (printMode === 'etalon') {
    return (
      <TDFPrintView
        tdfSet={tdfSet}
        items={items}
        mode="etalon"
        onBack={() => setPrintMode(null)}
      />
    );
  }

  const addMenu = (afterIndex) => ({
    items: [
      { key: 'item', label: 'Добавить пункт ТДФ', icon: <PlusCircleOutlined /> },
      { key: 'section', label: 'Добавить заголовок раздела', icon: <LineOutlined /> },
    ],
    onClick: ({ key }) => {
      if (key === 'item') openCreate(afterIndex);
      else addSectionHeader(afterIndex);
    },
  });

  return (
    <div style={{ padding: 24, maxWidth: 1440, margin: '0 auto' }}>
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              {tdfSet?.title}
              {tdfSet?.class_number && <Tag style={{ marginLeft: 8 }}>{tdfSet.class_number} кл.</Tag>}
            </Title>
            <Text type="secondary">Эталонный конспект · {items.filter(i => !i.is_section_header).length} пунктов</Text>
          </div>
        </Space>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={() => setPrintMode('etalon')}>
            Печать конспекта
          </Button>
          <Dropdown menu={addMenu(items.length - 1)} trigger={['click']}>
            <Button type="primary" icon={<PlusOutlined />}>
              Добавить <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      </div>

      {/* Таблица пунктов */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: '#fafafa', borderRadius: 8 }}>
          <Text type="secondary">Пунктов ещё нет. Добавьте первый!</Text>
          <br /><br />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate(null)}>
            Добавить пункт
          </Button>
        </div>
      ) : (
        <div>
          {items.map((item, idx) => (
            <div key={item.id}>
              {item.is_section_header ? (
                /* Заголовок раздела */
                <div
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={() => onDrop(idx)}
                  style={{
                    background: dragOverIdx === idx ? '#e6f4ff' : '#f0f0f0',
                    padding: '8px 16px',
                    marginBottom: 4,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'grab',
                    border: dragOverIdx === idx ? '2px dashed #1677ff' : '2px dashed transparent',
                  }}
                >
                  <Space>
                    <DragOutlined style={{ color: '#aaa' }} />
                    <Text strong style={{ fontSize: 15 }}>{item.section_title || 'Без названия'}</Text>
                  </Space>
                  <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(item)} />
                    <Popconfirm
                      title="Удалить заголовок раздела?"
                      onConfirm={() => handleDelete(item.id)}
                      okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
                    >
                      <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                    <Dropdown menu={addMenu(idx)} trigger={['click']}>
                      <Button size="small" icon={<PlusOutlined />} />
                    </Dropdown>
                  </Space>
                </div>
              ) : (
                /* Пункт ТДФ */
                <div
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={() => onDrop(idx)}
                  style={{
                    background: dragOverIdx === idx ? '#e6f4ff' : '#fff',
                    border: dragOverIdx === idx ? '2px dashed #1677ff' : '1px solid #f0f0f0',
                    borderRadius: 6,
                    padding: '10px 14px',
                    marginBottom: 4,
                    cursor: 'grab',
                    display: 'grid',
                    gridTemplateColumns: '28px auto 1fr 1fr 1fr 120px',
                    gap: 8,
                    alignItems: 'start',
                    minHeight: 64,
                  }}
                >
                  {/* Drag handle + номер */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                    <DragOutlined style={{ color: '#aaa', fontSize: 16 }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>{idx + 1}</Text>
                  </div>

                  {/* Тип */}
                  <div style={{ paddingTop: 2 }}>
                    {item.type && (
                      <Tag color={TYPE_COLORS[item.type]} style={{ fontSize: 10 }}>
                        {TYPE_LABELS[item.type]}
                      </Tag>
                    )}
                  </div>

                  {/* Название */}
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{item.name || '—'}</Text>
                  </div>

                  {/* Формулировка */}
                  <div style={{ fontSize: 12 }}>
                    {item.formulation_md
                      ? <MathRenderer content={item.formulation_md} />
                      : <Text type="secondary">—</Text>}
                  </div>

                  {/* Чертёж + краткая запись */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {item.drawing_image && (
                      <img
                        src={api.getTdfItemDrawingUrl(item)}
                        alt="чертёж"
                        style={{ maxHeight: 60, maxWidth: 80, objectFit: 'contain' }}
                      />
                    )}
                    {item.short_notation_md && (
                      <div style={{ fontSize: 12 }}>
                        <MathRenderer content={item.short_notation_md} />
                      </div>
                    )}
                  </div>

                  {/* Действия */}
                  <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(item)} />
                    <Popconfirm
                      title="Удалить пункт?"
                      onConfirm={() => handleDelete(item.id)}
                      okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
                    >
                      <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                    <Dropdown menu={addMenu(idx)} trigger={['click']}>
                      <Button size="small" icon={<PlusOutlined />} />
                    </Dropdown>
                  </Space>
                </div>
              )}
            </div>
          ))}

          {/* Кнопка добавить в конец */}
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Dropdown menu={addMenu(items.length - 1)} trigger={['click']}>
              <Button icon={<PlusOutlined />}>Добавить в конец <DownOutlined /></Button>
            </Dropdown>
          </div>
        </div>
      )}

      {/* Модальное окно пункта */}
      <TDFItemModal
        open={itemModalOpen}
        item={editingItem}
        setId={setId}
        onClose={() => setItemModalOpen(false)}
        onSaved={handleItemSaved}
        nextOrder={insertAfterIndex !== null ? insertAfterIndex + 1 : items.length}
      />
    </div>
  );
}
