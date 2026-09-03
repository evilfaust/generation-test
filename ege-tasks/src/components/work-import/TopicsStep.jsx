import { useMemo, useState } from 'react';
import { Alert, Button, Card, Popover, Radio, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import TopicCreateModal from './TopicCreateModal';

const { Text } = Typography;

const EXAM_TYPE_LABELS = {
  ege_base: 'ЕГЭ базовый',
  ege_profile: 'ЕГЭ профильный',
  oge: 'ОГЭ',
  vpr: 'ВПР',
  trig: 'Тригонометрия',
  mordkovich: 'Мордкович',
  oral: 'Устный счёт',
  other: 'Прочее',
};

const shortText = (md, limit = 90) => {
  const plain = String(md || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '[рис.]').replace(/\s+/g, ' ').trim();
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
};

/**
 * Шаг 3 мастера: у каждой задачи должна быть тема, а найденные дубли можно
 * переиспользовать вместо создания копии.
 */
export default function TopicsStep({
  rows = [],
  topics = [],
  subtopics = [],
  examTypeHint,
  scanning,
  onUpdateRow,
  onSetTopicForRows,
  onScanDuplicates,
  onTopicCreated,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRowKey, setModalRowKey] = useState(null);
  const [bulkTopic, setBulkTopic] = useState(null);

  // Темы сгруппированы по контексту: одинаковые названия в базовом и профильном
  // ЕГЭ иначе неразличимы в выпадающем списке.
  const topicOptions = useMemo(() => {
    const groups = new Map();
    topics.forEach((t) => {
      const key = t.exam_type || 'other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({
        value: t.id,
        label: t.ege_number != null && t.ege_number !== '' ? `№${t.ege_number} · ${t.title}` : t.title,
      });
    });
    const ordered = [...groups.entries()].sort((a, b) => {
      if (examTypeHint && a[0] === examTypeHint) return -1;
      if (examTypeHint && b[0] === examTypeHint) return 1;
      return (EXAM_TYPE_LABELS[a[0]] || a[0]).localeCompare(EXAM_TYPE_LABELS[b[0]] || b[0]);
    });
    return ordered.map(([key, options]) => ({ label: EXAM_TYPE_LABELS[key] || key, options }));
  }, [topics, examTypeHint]);

  const withoutTopic = rows.filter((r) => r.mode === 'create' && !r.topicId);
  const duplicates = rows.filter((r) => r.duplicate);
  const modalRow = rows.find((r) => r.key === modalRowKey);

  const columns = [
    {
      title: 'Задача',
      dataIndex: 'key',
      width: 320,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Space size={4}>
            <Tag color="blue">В{row.variantNumber}</Tag>
            <Text strong>№{row.task.number || row.position + 1}</Text>
            {!row.task.answer && <Tag color="orange">без ответа</Tag>}
          </Space>
          <Tooltip
            title={<div style={{ maxWidth: 520 }}><MathRenderer text={row.task.statement_md} /></div>}
            styles={{ root: { maxWidth: 560 } }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>{shortText(row.task.statement_md)}</Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Тема',
      dataIndex: 'topicId',
      width: 320,
      render: (value, row) => (
        <Space.Compact style={{ width: '100%' }}>
          <Select
            style={{ width: '100%' }}
            showSearch
            allowClear
            placeholder={row.task.topicName ? `из файла: ${row.task.topicName}` : 'выберите тему'}
            status={row.mode === 'create' && !value ? 'warning' : undefined}
            value={value || undefined}
            options={topicOptions}
            optionFilterProp="label"
            onChange={(v) => onUpdateRow(row.key, { topicId: v || null, subtopicId: null })}
          />
          <Tooltip title="Создать новую тему">
            <Button icon={<PlusOutlined />} onClick={() => { setModalRowKey(row.key); setModalOpen(true); }} />
          </Tooltip>
        </Space.Compact>
      ),
    },
    {
      title: 'Подтема',
      dataIndex: 'subtopicId',
      width: 220,
      render: (value, row) => {
        const options = subtopics
          .filter((st) => st.topic === row.topicId)
          .map((st) => ({ value: st.id, label: st.name }));
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Select
              style={{ width: '100%' }}
              showSearch
              allowClear
              placeholder={row.topicId ? 'без подтемы' : 'сначала тема'}
              disabled={!row.topicId}
              value={value || undefined}
              options={options}
              optionFilterProp="label"
              onChange={(v) => onUpdateRow(row.key, { subtopicId: v || null, newSubtopicName: v ? '' : row.newSubtopicName })}
            />
            {!value && row.newSubtopicName && (
              <Text type="secondary" style={{ fontSize: 11 }}>будет создана: {row.newSubtopicName}</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'В базе',
      dataIndex: 'duplicate',
      width: 150,
      render: (duplicate) => {
        if (!duplicate) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        return (
          <Popover
            title={`Найдена задача ${duplicate.code || ''}`}
            content={<div style={{ maxWidth: 420 }}><MathRenderer text={duplicate.statement_md} /></div>}
          >
            <Tag color={duplicate.kind === 'strict' ? 'red' : 'orange'}>
              {duplicate.kind === 'strict' ? 'точный дубль' : 'похожая'}
            </Tag>
          </Popover>
        );
      },
    },
    {
      title: 'Что делать',
      dataIndex: 'mode',
      width: 260,
      render: (mode, row) => (
        <Radio.Group
          size="small"
          value={mode}
          onChange={(e) => onUpdateRow(row.key, {
            mode: e.target.value,
            reuseTaskId: e.target.value === 'reuse' ? row.duplicate?.id || row.reuseTaskId : null,
          })}
        >
          <Radio.Button value="create">Создать</Radio.Button>
          <Radio.Button value="reuse" disabled={!row.duplicate && !row.reuseTaskId}>Взять из базы</Radio.Button>
          <Radio.Button value="skip">Убрать</Radio.Button>
        </Radio.Group>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small">
        <Space wrap>
          <Button icon={<SearchOutlined />} loading={scanning} onClick={onScanDuplicates}>
            Найти дубли в базе
          </Button>
          {withoutTopic.length > 0 && (
            <>
              <Select
                style={{ minWidth: 260 }}
                showSearch
                allowClear
                placeholder={`Тема для всех без темы (${withoutTopic.length})`}
                value={bulkTopic || undefined}
                options={topicOptions}
                optionFilterProp="label"
                onChange={setBulkTopic}
              />
              <Button
                disabled={!bulkTopic}
                onClick={() => { onSetTopicForRows(withoutTopic.map((r) => r.key), bulkTopic); setBulkTopic(null); }}
              >
                Проставить
              </Button>
            </>
          )}
        </Space>
      </Card>

      {withoutTopic.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`Без темы: ${withoutTopic.length} задач(и)`}
          description="Выберите тему в строке, создайте новую кнопкой «+» или проставьте одну тему всем сразу."
        />
      )}

      {duplicates.length > 0 && (
        <Alert
          type="info"
          showIcon
          message={`Найдено в базе: ${duplicates.length} задач(и)`}
          description="Такие задачи по умолчанию берутся из базы — копия не создаётся. Нужна отдельная копия — переключите на «Создать»."
        />
      )}

      <Table
        rowKey="key"
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 1100 }}
        rowClassName={(row) => (row.mode === 'skip' ? 'wi-row-skipped' : '')}
      />

      <TopicCreateModal
        open={modalOpen}
        topics={topics}
        defaultTitle={modalRow?.task?.topicName || ''}
        defaultExamType={examTypeHint || 'ege_base'}
        onClose={() => { setModalOpen(false); setModalRowKey(null); }}
        onCreated={(topic) => {
          setModalOpen(false);
          if (modalRowKey) onUpdateRow(modalRowKey, { topicId: topic.id, subtopicId: null });
          setModalRowKey(null);
          onTopicCreated?.(topic);
        }}
      />
    </Space>
  );
}
