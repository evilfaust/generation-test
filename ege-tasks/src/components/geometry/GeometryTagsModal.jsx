import { useMemo, useState } from 'react';
import { Modal, Table, Input, Select, Button, Space, Tag, Popconfirm, message } from 'antd';
import { SearchOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';

const KIND_LABELS = { object: 'Объект', method: 'Метод', fact: 'Факт', named: 'Имя', source: 'Источник' };
const KIND_COLORS = { object: 'blue', method: 'green', fact: 'volcano', named: 'purple', source: 'default' };

/**
 * Менеджер фасетных тегов банка МЦНМО (geometry_tags) — правка имени и удаление.
 * Открывается из каталога геометрии (режим «Банк МЦНМО»).
 */
export default function GeometryTagsModal({ open, onClose, geoTags, onChanged }) {
  const [kindFilter, setKindFilter] = useState('');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState({});   // { id: editedName }
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Плоский список всех тегов из сгруппированного geoTags
  const allTags = useMemo(() => {
    const out = [];
    for (const kind of ['object', 'method', 'fact', 'named', 'source']) {
      for (const t of geoTags[kind] || []) out.push(t);
    }
    return out;
  }, [geoTags]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allTags.filter((t) =>
      (!kindFilter || t.kind === kindFilter) &&
      (!s || (t.name || '').toLowerCase().includes(s)),
    );
  }, [allTags, kindFilter, search]);

  const handleSave = async (tag) => {
    const next = (drafts[tag.id] ?? tag.name).trim();
    if (!next || next === tag.name) return;
    setSavingId(tag.id);
    try {
      await api.updateGeometryTag(tag.id, { name: next });
      message.success('Сохранено');
      setDrafts((d) => { const c = { ...d }; delete c[tag.id]; return c; });
      onChanged?.();
    } catch {
      message.error('Не удалось сохранить');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (tag) => {
    setDeletingId(tag.id);
    try {
      await api.deleteGeometryTag(tag.id);
      message.success('Тег удалён');
      onChanged?.();
    } catch {
      message.error('Не удалось удалить');
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      title: 'Тип', dataIndex: 'kind', width: 110,
      render: (k) => <Tag color={KIND_COLORS[k]}>{KIND_LABELS[k] || k}</Tag>,
    },
    {
      title: 'Название', dataIndex: 'name',
      render: (_, tag) => (
        <Input
          value={drafts[tag.id] ?? tag.name}
          onChange={(e) => setDrafts((d) => ({ ...d, [tag.id]: e.target.value }))}
          onPressEnter={() => handleSave(tag)}
          size="small"
        />
      ),
    },
    {
      title: '', width: 90, align: 'right',
      render: (_, tag) => (
        <Space size={4}>
          <Button
            type="text" size="small" icon={<SaveOutlined />}
            disabled={(drafts[tag.id] ?? tag.name) === tag.name || !(drafts[tag.id] ?? tag.name).trim()}
            loading={savingId === tag.id}
            onClick={() => handleSave(tag)}
          />
          <Popconfirm
            title="Удалить тег?"
            description="Он отвяжется от всех задач банка."
            onConfirm={() => handleDelete(tag)}
            okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} loading={deletingId === tag.id} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Теги банка МЦНМО — объекты / методы / факты"
      footer={<Button onClick={onClose}>Закрыть</Button>}
      width={760}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          value={kindFilter}
          onChange={setKindFilter}
          style={{ width: 160 }}
          options={[
            { value: '', label: 'Все типы' },
            { value: 'object', label: `Объекты (${geoTags.object?.length || 0})` },
            { value: 'method', label: `Методы (${geoTags.method?.length || 0})` },
            { value: 'fact', label: `Факты (${geoTags.fact?.length || 0})` },
          ]}
        />
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Поиск по названию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
      </Space>
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 12, showSizeChanger: false, size: 'small' }}
      />
    </Modal>
  );
}
