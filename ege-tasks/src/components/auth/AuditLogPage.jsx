/**
 * AuditLogPage — журнал значимых действий (создание/изменение/удаление
 * задач, работ, геометрии, ТДФ-наборов, статей теории, тестов, учителей).
 *
 * Доступно только superadmin. Запись лога создаётся автоматически из
 * мутирующих API-методов в shared/services/pocketbase.js (см. _logAudit).
 *
 * Фильтры: по действию, по коллекции, по учителю, по диапазону дат.
 */
import { useEffect, useState, useMemo } from 'react';
import {
  Table, Tag, Card, Select, DatePicker, Button, Space, Typography,
  message, Empty,
} from 'antd';
import {
  ReloadOutlined, PlusCircleOutlined, EditOutlined, DeleteOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../services/pocketbase';
import { escapeFilter } from '../../shared/utils/escapeFilter';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ACTION_META = {
  create: { color: 'green',  label: 'Создание', icon: <PlusCircleOutlined /> },
  update: { color: 'blue',   label: 'Изменение', icon: <EditOutlined /> },
  delete: { color: 'red',    label: 'Удаление', icon: <DeleteOutlined /> },
};

// Человекочитаемые названия коллекций.
const COLLECTION_LABELS = {
  tasks:            'Задачи',
  works:            'Работы',
  geometry_tasks:   'Геом. задачи',
  tdf_sets:         'ТДФ наборы',
  theory_articles:  'Статьи теории',
  mc_tests:         'Тесты A/B/C/D',
  teachers:         'Учителя',
};

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: null,        // 'create' | 'update' | 'delete'
    collection: null,    // collection_name
    teacherId: null,     // teacher_id
    dateRange: null,     // [dayjs, dayjs]
  });
  const [teachersList, setTeachersList] = useState([]);

  const filterString = useMemo(() => {
    const parts = [];
    if (filters.action) parts.push(`action = "${filters.action}"`);
    if (filters.collection) parts.push(`collection_name = "${filters.collection}"`);
    if (filters.teacherId) parts.push(`teacher_id = "${escapeFilter(filters.teacherId)}"`);
    if (filters.dateRange?.[0]) parts.push(`created >= "${filters.dateRange[0].startOf('day').toISOString()}"`);
    if (filters.dateRange?.[1]) parts.push(`created <= "${filters.dateRange[1].endOf('day').toISOString()}"`);
    return parts.join(' && ');
  }, [filters]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLog({ page, perPage: PAGE_SIZE, filter: filterString });
      setItems(res.items);
      setTotal(res.totalItems);
    } catch (e) {
      message.error('Не удалось загрузить журнал');
    } finally {
      setLoading(false);
    }
  };

  // Загружаем учителей один раз для фильтра.
  useEffect(() => {
    api.getTeachers().then(setTeachersList).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterString]);

  const handleClearFilters = () => {
    setFilters({ action: null, collection: null, teacherId: null, dateRange: null });
    setPage(1);
  };

  const columns = [
    {
      title: 'Когда',
      dataIndex: 'created',
      key: 'created',
      width: 160,
      render: (v) => (
        <div>
          <div>{dayjs(v).format('DD.MM.YYYY')}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(v).format('HH:mm:ss')}</Text>
        </div>
      ),
    },
    {
      title: 'Кто',
      dataIndex: 'teacher_name',
      key: 'teacher_name',
      width: 180,
      render: (name, record) => (
        <div>
          <div>{name}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>id: {record.teacher_id?.slice(0, 8)}…</Text>
        </div>
      ),
    },
    {
      title: 'Действие',
      dataIndex: 'action',
      key: 'action',
      width: 130,
      render: (action) => {
        const meta = ACTION_META[action];
        return meta ? <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag> : <Tag>{action}</Tag>;
      },
    },
    {
      title: 'Где',
      dataIndex: 'collection_name',
      key: 'collection_name',
      width: 140,
      render: (col) => <Tag>{COLLECTION_LABELS[col] || col}</Tag>,
    },
    {
      title: 'Что',
      dataIndex: 'record_summary',
      key: 'record_summary',
      render: (summary, record) => (
        <div>
          <div style={{ wordBreak: 'break-word' }}>{summary || <Text type="secondary">—</Text>}</div>
          {record.record_id && (
            <Text type="secondary" style={{ fontSize: 11 }}>id: {record.record_id}</Text>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Журнал действий</Title>
        <Space>
          <Button icon={<ClearOutlined />} onClick={handleClearFilters}>Сбросить</Button>
          <Button icon={<ReloadOutlined />} onClick={load}>Обновить</Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Действие"
            allowClear
            style={{ width: 160 }}
            value={filters.action}
            onChange={(v) => { setFilters((f) => ({ ...f, action: v })); setPage(1); }}
            options={Object.entries(ACTION_META).map(([k, m]) => ({ value: k, label: <Space>{m.icon}{m.label}</Space> }))}
          />
          <Select
            placeholder="Коллекция"
            allowClear
            style={{ width: 200 }}
            value={filters.collection}
            onChange={(v) => { setFilters((f) => ({ ...f, collection: v })); setPage(1); }}
            options={Object.entries(COLLECTION_LABELS).map(([k, label]) => ({ value: k, label }))}
          />
          <Select
            placeholder="Учитель"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 200 }}
            value={filters.teacherId}
            onChange={(v) => { setFilters((f) => ({ ...f, teacherId: v })); setPage(1); }}
            options={teachersList.map((t) => ({ value: t.id, label: `${t.name} (@${t.username})` }))}
          />
          <RangePicker
            value={filters.dateRange}
            onChange={(v) => { setFilters((f) => ({ ...f, dateRange: v })); setPage(1); }}
            format="DD.MM.YYYY"
            placeholder={['С', 'По']}
          />
        </Space>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          locale={{ emptyText: <Empty description="Записей нет" /> }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (t) => `Всего записей: ${t}`,
          }}
        />
      </Card>
    </div>
  );
}
