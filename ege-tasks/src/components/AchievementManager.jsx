import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Space, Tag,
  Popconfirm, Segmented, Statistic, Row, Col, Tooltip, App,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  TrophyOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import AchievementBadge from './student/AchievementBadge';

// ==================== CONSTANTS ====================

// icon001–078 — png (071 отсутствует), icon079–089 — jpg
const ALL_ICONS = [
  ...Array.from({ length: 78 }, (_, i) => `icon${String(i + 1).padStart(3, '0')}.png`)
    .filter((name) => name !== 'icon071.png'),
  ...Array.from({ length: 11 }, (_, i) => `icon${String(i + 79).padStart(3, '0')}.jpg`),
];

const RARITY_COLORS = {
  common: 'green',
  rare: 'blue',
  legendary: 'gold',
};

const RARITY_LABELS = {
  common: 'Обычный',
  rare: 'Редкий',
  legendary: 'Легендарный',
};

const CONDITION_TYPE_LABELS = {
  score: 'Процент',
  speed: 'Скорость',
  count: 'Кол-во попыток',
  special: 'Специальное',
};

const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: 'Воскресенье' },
  { value: 1, label: 'Понедельник' },
  { value: 2, label: 'Вторник' },
  { value: 3, label: 'Среда' },
  { value: 4, label: 'Четверг' },
  { value: 5, label: 'Пятница' },
  { value: 6, label: 'Суббота' },
];

// ==================== HELPERS ====================

function normalizeUnlockedIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(v => (typeof v === 'object' && v?.id) ? v.id : String(v)).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch { /* not JSON */ }
    return value ? [value] : [];
  }
  return [];
}

function describeCondition(achievement) {
  if (achievement.type !== 'condition') return '';
  const cv = achievement.condition_value || {};
  switch (achievement.condition_type) {
    case 'score': return `≥ ${cv.min}%`;
    case 'speed': return `≤ ${cv.max_minutes} мин`;
    case 'count': return `${cv.attempts} попыток`;
    case 'special': {
      const parts = [];
      if (cv.time_after) parts.push(`после ${cv.time_after}`);
      if (cv.time_before) parts.push(`до ${cv.time_before}`);
      if (cv.day_of_week) {
        const days = (Array.isArray(cv.day_of_week) ? cv.day_of_week : [cv.day_of_week]);
        const names = days.map(d => DAY_OF_WEEK_OPTIONS.find(o => o.value === d)?.label || d);
        parts.push(names.join(', '));
      }
      return parts.join(', ');
    }
    default: return '';
  }
}

// ==================== ICON PICKER ====================

function IconPicker({ value, onChange, achievements, editingId }) {
  const usedIcons = useMemo(() =>
    new Set(achievements.filter(a => a.id !== editingId).map(a => a.icon)),
    [achievements, editingId]
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(8, 1fr)',
      gap: 6,
      maxHeight: 280,
      overflowY: 'auto',
      border: '1px solid #d9d9d9',
      borderRadius: 8,
      padding: 8,
    }}>
      {ALL_ICONS.map(icon => {
        const isSelected = value === icon;
        const isUsed = usedIcons.has(icon);
        return (
          <div
            key={icon}
            onClick={() => onChange(icon)}
            style={{
              cursor: 'pointer',
              border: isSelected ? '2px solid #1890ff' : '2px solid transparent',
              borderRadius: 8,
              padding: 3,
              opacity: isUsed && !isSelected ? 0.35 : 1,
              background: isSelected ? '#e6f7ff' : 'transparent',
              textAlign: 'center',
              transition: 'all 0.2s',
            }}
          >
            <img
              src={`/achievements/${icon}`}
              alt={icon}
              style={{ width: '100%', height: 'auto', borderRadius: 4 }}
            />
            {isUsed && !isSelected && (
              <div style={{ fontSize: 9, color: '#999', lineHeight: 1 }}>занято</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function AchievementManager() {
  const { message, modal } = App.useApp();
  const [achievements, setAchievements] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  // "Кому выдано" modal
  const [awardedModalOpen, setAwardedModalOpen] = useState(false);
  const [awardedAchievement, setAwardedAchievement] = useState(null);

  // Preview modal
  const [previewAchievement, setPreviewAchievement] = useState(null);

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');

  // ==================== DATA LOADING ====================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [achData, attData] = await Promise.all([
        api.getAchievements(),
        api.getAttemptsWithAchievements(),
      ]);
      setAchievements(achData);
      setAttempts(attData);
    } catch (error) {
      console.error('Error loading achievement data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ==================== COMPUTED ====================

  const awardStats = useMemo(() => {
    const stats = {};
    attempts.forEach(attempt => {
      if (attempt.achievement) {
        const id = typeof attempt.achievement === 'object' ? attempt.achievement.id : attempt.achievement;
        if (!stats[id]) stats[id] = { count: 0, entries: [] };
        stats[id].count++;
        stats[id].entries.push({
          studentName: attempt.student_name || 'Аноним',
          date: attempt.created,
          score: attempt.score,
          total: attempt.total,
          type: 'random',
        });
      }
      const unlocked = normalizeUnlockedIds(attempt.unlocked_achievements);
      unlocked.forEach(id => {
        if (!stats[id]) stats[id] = { count: 0, entries: [] };
        stats[id].count++;
        stats[id].entries.push({
          studentName: attempt.student_name || 'Аноним',
          date: attempt.created,
          score: attempt.score,
          total: attempt.total,
          type: 'condition',
        });
      });
    });
    return stats;
  }, [attempts]);

  const summary = useMemo(() => {
    const byType = { random: 0, condition: 0 };
    const byRarity = { common: 0, rare: 0, legendary: 0 };
    let totalAwards = 0;

    achievements.forEach(a => {
      byType[a.type] = (byType[a.type] || 0) + 1;
      if (a.type === 'random' && a.rarity) {
        byRarity[a.rarity] = (byRarity[a.rarity] || 0) + 1;
      }
      totalAwards += (awardStats[a.id]?.count || 0);
    });

    return { total: achievements.length, byType, byRarity, totalAwards };
  }, [achievements, awardStats]);

  const filteredAchievements = useMemo(() => {
    let result = achievements;
    if (filterType !== 'all') {
      result = result.filter(a => a.type === filterType);
    }
    if (filterType === 'random' && filterRarity !== 'all') {
      result = result.filter(a => a.rarity === filterRarity);
    }
    return result;
  }, [achievements, filterType, filterRarity]);

  // ==================== CRUD HANDLERS ====================

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'random',
      rarity: 'common',
      order: achievements.length + 1,
    });
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    const values = {
      code: record.code,
      title: record.title,
      description: record.description,
      type: record.type,
      icon: record.icon,
      order: record.order,
    };
    if (record.type === 'random') {
      values.rarity = record.rarity;
    } else if (record.type === 'condition') {
      values.condition_type = record.condition_type;
      // Flatten condition_value for form
      const cv = record.condition_value || {};
      values.condition_value = { ...cv };
    }
    form.setFieldsValue(values);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        code: values.code,
        title: values.title,
        description: values.description,
        type: values.type,
        icon: values.icon,
        order: values.order || 0,
      };

      if (values.type === 'random') {
        data.rarity = values.rarity;
        data.condition_type = '';
        data.condition_value = null;
      } else {
        data.rarity = '';
        data.condition_type = values.condition_type;
        data.condition_value = values.condition_value || {};
      }

      if (editing) {
        await api.updateAchievement(editing.id, data);
        message.success('Достижение обновлено');
      } else {
        await api.createAchievement(data);
        message.success('Достижение создано');
      }
      setModalOpen(false);
      loadData();
    } catch (error) {
      if (error.errorFields) return;
      console.error('Save error:', error);
      const detail = error?.data?.data;
      if (detail?.code?.message) {
        message.error(`Ошибка: код "${form.getFieldValue('code')}" — ${detail.code.message}`);
      } else {
        message.error('Ошибка при сохранении');
      }
    }
  };

  const handleDelete = (record) => {
    const count = awardStats[record.id]?.count || 0;
    if (count > 0) {
      modal.confirm({
        title: 'Удалить достижение?',
        content: (
          <div>
            <p>Достижение <strong>«{record.title}»</strong> уже выдано <strong>{count} раз</strong>.</p>
            <p>При удалении ссылки в попытках учеников станут недействительными.</p>
          </div>
        ),
        okText: 'Удалить',
        okType: 'danger',
        cancelText: 'Отмена',
        onOk: async () => {
          try {
            await api.deleteAchievement(record.id);
            message.success('Достижение удалено');
            loadData();
          } catch {
            message.error('Ошибка при удалении');
          }
        },
      });
    } else {
      // Простое удаление через Popconfirm уже обработано в render
      api.deleteAchievement(record.id)
        .then(() => { message.success('Достижение удалено'); loadData(); })
        .catch(() => message.error('Ошибка при удалении'));
    }
  };

  // ==================== "КОМУ ВЫДАНО" ====================

  const openAwardedModal = (record) => {
    setAwardedAchievement(record);
    setAwardedModalOpen(true);
  };

  const awardedEntries = useMemo(() => {
    if (!awardedAchievement) return [];
    return (awardStats[awardedAchievement.id]?.entries || [])
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [awardedAchievement, awardStats]);

  // ==================== TABLE COLUMNS ====================

  const columns = [
    {
      title: '',
      dataIndex: 'icon',
      key: 'icon',
      width: 56,
      render: (icon) => (
        <img
          src={`/achievements/${icon}`}
          alt=""
          style={{ width: 40, height: 40, borderRadius: 6 }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ),
    },
    {
      title: 'Код',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code) => <Tag style={{ fontFamily: 'monospace' }}>{code}</Tag>,
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      sorter: (a, b) => a.title.localeCompare(b.title),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (type) => (
        <Tag color={type === 'random' ? 'gold' : 'blue'}>
          {type === 'random' ? 'Случайный' : 'За условие'}
        </Tag>
      ),
    },
    {
      title: 'Редкость / Условие',
      key: 'rarityOrCondition',
      width: 160,
      render: (_, record) => {
        if (record.type === 'random') {
          return (
            <Tag color={RARITY_COLORS[record.rarity]}>
              {RARITY_LABELS[record.rarity] || record.rarity}
            </Tag>
          );
        }
        return (
          <Tooltip title={describeCondition(record)}>
            <Tag>{CONDITION_TYPE_LABELS[record.condition_type] || record.condition_type}</Tag>
            <span style={{ fontSize: 11, color: '#888' }}>{describeCondition(record)}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '№',
      dataIndex: 'order',
      key: 'order',
      width: 60,
      sorter: (a, b) => (a.order || 0) - (b.order || 0),
    },
    {
      title: 'Выдано',
      key: 'awarded',
      width: 80,
      render: (_, record) => {
        const count = awardStats[record.id]?.count || 0;
        return count > 0 ? (
          <Button type="link" size="small" onClick={() => openAwardedModal(record)}>
            {count}
          </Button>
        ) : (
          <span style={{ color: '#ccc' }}>0</span>
        );
      },
      sorter: (a, b) => (awardStats[a.id]?.count || 0) - (awardStats[b.id]?.count || 0),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 140,
      render: (_, record) => {
        const awarded = awardStats[record.id]?.count || 0;
        return (
          <Space size={4}>
            <Tooltip title="Предпросмотр">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => setPreviewAchievement(record)}
              />
            </Tooltip>
            <Tooltip title="Редактировать">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
            {awarded > 0 ? (
              <Tooltip title={`Выдано ${awarded} раз — удаление с подтверждением`}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            ) : (
              <Popconfirm
                title="Удалить достижение?"
                description="Это действие нельзя отменить."
                onConfirm={() => handleDelete(record)}
                okText="Да"
                cancelText="Нет"
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  // ==================== RENDER ====================

  const formType = Form.useWatch('type', form);
  const formConditionType = Form.useWatch('condition_type', form);

  return (
    <div>
      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col><Statistic title="Всего" value={summary.total} prefix={<TrophyOutlined />} /></Col>
        <Col><Statistic title="Случайных" value={summary.byType.random || 0} valueStyle={{ color: '#d4a017' }} /></Col>
        <Col>
          <Space size={4}>
            <Tag color="green">{summary.byRarity.common || 0}</Tag>
            <Tag color="blue">{summary.byRarity.rare || 0}</Tag>
            <Tag color="gold">{summary.byRarity.legendary || 0}</Tag>
          </Space>
        </Col>
        <Col><Statistic title="За условия" value={summary.byType.condition || 0} valueStyle={{ color: '#1890ff' }} /></Col>
        <Col><Statistic title="Выдано всего" value={summary.totalAwards} valueStyle={{ color: '#52c41a' }} /></Col>
      </Row>

      {/* Toolbar */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Новое достижение
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          Обновить
        </Button>
        <Segmented
          value={filterType}
          onChange={(v) => { setFilterType(v); setFilterRarity('all'); }}
          options={[
            { label: 'Все', value: 'all' },
            { label: 'Случайные', value: 'random' },
            { label: 'За условия', value: 'condition' },
          ]}
        />
        {filterType === 'random' && (
          <Segmented
            value={filterRarity}
            onChange={setFilterRarity}
            options={[
              { label: 'Все', value: 'all' },
              { label: 'Обычные', value: 'common' },
              { label: 'Редкие', value: 'rare' },
              { label: 'Легендарные', value: 'legendary' },
            ]}
          />
        )}
      </div>

      {/* Main Table */}
      <Table
        columns={columns}
        dataSource={filteredAchievements}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: false }}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editing ? 'Редактировать достижение' : 'Новое достижение'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Код"
                rules={[
                  { required: true, message: 'Введите код' },
                  { pattern: /^[a-z0-9_]+$/, message: 'Только латиница, цифры и _' },
                ]}
              >
                <Input placeholder="snake_case (например: new_hero)" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Название"
                rules={[{ required: true, message: 'Введите название' }]}
              >
                <Input placeholder="Отображается ученику" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Описание"
            rules={[{ required: true, message: 'Введите описание' }]}
          >
            <Input.TextArea rows={2} placeholder="Как получить это достижение" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="type"
                label="Тип"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { value: 'random', label: 'Случайный значок' },
                    { value: 'condition', label: 'За условие' },
                  ]}
                  onChange={() => {
                    form.setFieldsValue({
                      rarity: undefined,
                      condition_type: undefined,
                      condition_value: {},
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              {formType === 'random' && (
                <Form.Item
                  name="rarity"
                  label="Редкость"
                  rules={[{ required: true, message: 'Выберите редкость' }]}
                >
                  <Select options={[
                    { value: 'common', label: 'Обычный (40-69%)' },
                    { value: 'rare', label: 'Редкий (70-89%)' },
                    { value: 'legendary', label: 'Легендарный (90%+)' },
                  ]} />
                </Form.Item>
              )}
              {formType === 'condition' && (
                <Form.Item
                  name="condition_type"
                  label="Тип условия"
                  rules={[{ required: true, message: 'Выберите тип условия' }]}
                >
                  <Select options={[
                    { value: 'score', label: 'Процент правильных' },
                    { value: 'speed', label: 'Скорость' },
                    { value: 'count', label: 'Кол-во попыток' },
                    { value: 'special', label: 'Специальное' },
                  ]} />
                </Form.Item>
              )}
            </Col>
            <Col span={8}>
              <Form.Item name="order" label="Порядок">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* Condition value fields */}
          {formType === 'condition' && formConditionType === 'score' && (
            <Form.Item
              name={['condition_value', 'min']}
              label="Минимальный процент"
              rules={[{ required: true, message: 'Укажите процент' }]}
            >
              <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
            </Form.Item>
          )}

          {formType === 'condition' && formConditionType === 'speed' && (
            <Form.Item
              name={['condition_value', 'max_minutes']}
              label="Максимум минут"
              rules={[{ required: true, message: 'Укажите время' }]}
            >
              <InputNumber min={1} max={120} addonAfter="мин" style={{ width: '100%' }} />
            </Form.Item>
          )}

          {formType === 'condition' && formConditionType === 'count' && (
            <Form.Item
              name={['condition_value', 'attempts']}
              label="Количество попыток"
              rules={[{ required: true, message: 'Укажите количество' }]}
            >
              <InputNumber min={1} max={1000} style={{ width: '100%' }} />
            </Form.Item>
          )}

          {formType === 'condition' && formConditionType === 'special' && (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name={['condition_value', 'time_after']} label="Время после">
                  <Input placeholder="HH:MM (напр. 22:00)" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['condition_value', 'time_before']} label="Время до">
                  <Input placeholder="HH:MM (напр. 08:00)" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['condition_value', 'day_of_week']} label="Дни недели">
                  <Select
                    mode="multiple"
                    options={DAY_OF_WEEK_OPTIONS}
                    placeholder="Выберите дни"
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* Icon Picker */}
          <Form.Item
            name="icon"
            label="Иконка"
            rules={[{ required: true, message: 'Выберите иконку' }]}
          >
            <IconPicker
              achievements={achievements}
              editingId={editing?.id}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* "Кому выдано" Modal */}
      <Modal
        title={
          awardedAchievement
            ? `«${awardedAchievement.title}» — кому выдано (${awardedEntries.length})`
            : 'Кому выдано'
        }
        open={awardedModalOpen}
        onCancel={() => setAwardedModalOpen(false)}
        footer={null}
        width={650}
      >
        {awardedAchievement && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img
              src={`/achievements/${awardedAchievement.icon}`}
              alt=""
              style={{ width: 48, height: 48, borderRadius: 8 }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>{awardedAchievement.title}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{awardedAchievement.description}</div>
            </div>
          </div>
        )}
        <Table
          columns={[
            {
              title: 'Ученик',
              dataIndex: 'studentName',
              key: 'studentName',
            },
            {
              title: 'Дата',
              dataIndex: 'date',
              key: 'date',
              width: 160,
              render: (d) => d ? new Date(d).toLocaleString('ru-RU') : '—',
            },
            {
              title: 'Тип',
              dataIndex: 'type',
              key: 'type',
              width: 120,
              render: (type) => (
                <Tag color={type === 'random' ? 'gold' : 'blue'}>
                  {type === 'random' ? 'Случайный' : 'Разблокирован'}
                </Tag>
              ),
            },
            {
              title: 'Результат',
              key: 'result',
              width: 100,
              render: (_, record) => record.total
                ? `${record.score}/${record.total}`
                : '—',
            },
          ]}
          dataSource={awardedEntries}
          rowKey={(_, i) => i}
          size="small"
          pagination={awardedEntries.length > 20 ? { pageSize: 20 } : false}
        />
      </Modal>

      {/* Preview Modal */}
      <Modal
        title="Предпросмотр достижения"
        open={!!previewAchievement}
        onCancel={() => setPreviewAchievement(null)}
        footer={null}
        width={400}
      >
        {previewAchievement && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24 }}>
            <AchievementBadge
              achievement={previewAchievement}
              size="large"
              showDetails
              animated
            />
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Tag style={{ fontFamily: 'monospace' }}>{previewAchievement.code}</Tag>
              {previewAchievement.type === 'condition' && (
                <div style={{ marginTop: 8, color: '#888', fontSize: 13 }}>
                  Условие: {describeCondition(previewAchievement)}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
