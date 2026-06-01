import { Form, Select, InputNumber, Button, Segmented, Badge, Row, Col } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';

const { Option } = Select;

export const EXAM_TYPE_LABELS = {
  ege_base:    'ЕГЭ базовый (11 кл.)',
  ege_profile: 'ЕГЭ профильный (11 кл.)',
  oge:         'ОГЭ (9 кл.)',
  vpr:         'ВПР',
  oral:        'Устный счёт',
  trig:        'Тригонометрия',
  mordkovich:  'Мордкович',
  other:       'Прочее',
};

const VARIANTS_MODE_OPTIONS = [
  { label: 'Разные задачи', value: 'different' },
  { label: 'Перемешанные', value: 'shuffled' },
  { label: 'Одинаковые', value: 'same' },
];

const topicLabel = (topic) =>
  topic.ege_number ? `№${topic.ege_number} — ${topic.title}` : topic.title;

export default function HeroSection({
  topics,
  subtopics,
  form,
  loading,
  availableTasksCount,
  loadingTasksCount,
  selectedExamType,
  selectedTopic,
  distributionsActive,
  onSubtopicChange,
  filtersSlot,
  methodSlot,
}) {
  const variantsCount = Form.useWatch('variantsCount', form) || 0;
  const tasksPerVariant = Form.useWatch('tasksPerVariant', form) || 0;
  const total = variantsCount * tasksPerVariant;

  const visibleTopics = selectedExamType
    ? topics.filter(t => t.exam_type === selectedExamType)
    : topics;

  const visibleSubtopics = selectedTopic
    ? subtopics.filter(s => s.topic === selectedTopic)
    : [];

  const showCounterBadge = selectedExamType || selectedTopic;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Что брать в работу</span>
        {showCounterBadge && (
          <Badge
            count={loadingTasksCount ? '...' : `${availableTasksCount} задач`}
            overflowCount={99999}
            style={{
              backgroundColor: availableTasksCount > 0 ? '#52c41a' : '#ff4d4f',
              fontWeight: 400,
            }}
            showZero
          />
        )}
      </div>

      {methodSlot && <div style={{ marginBottom: 16 }}>{methodSlot}</div>}

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Form.Item name="exam_type" label="Контекст" style={{ marginBottom: 0 }}>
            <Select size="large" placeholder="Все контексты" allowClear>
              {Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => (
                <Option key={value} value={value}>{label}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item name="topic" label="Тема" style={{ marginBottom: 0 }}>
            <Select
              size="large"
              placeholder={selectedExamType ? 'Все темы контекста' : 'Все темы'}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {visibleTopics.map(topic => (
                <Option key={topic.id} value={topic.id}>
                  {topicLabel(topic)}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={6}>
          <Form.Item name="subtopic" label="Подтема" style={{ marginBottom: 0 }}>
            <Select
              size="large"
              placeholder={selectedTopic ? 'Все подтемы' : 'Выберите тему'}
              allowClear
              showSearch
              optionFilterProp="children"
              disabled={!selectedTopic}
              onChange={(value) => onSubtopicChange(value || null)}
            >
              {visibleSubtopics.map(s => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      {filtersSlot && (
        <div style={{ marginTop: 12 }}>
          {filtersSlot}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <Form.Item
          name="variantsCount"
          label="Вариантов"
          style={{ marginBottom: 0, flex: '0 0 110px' }}
        >
          <InputNumber min={1} max={10} size="large" style={{ width: '100%' }} />
        </Form.Item>

        <div style={{ fontSize: 20, color: '#bfbfbf', paddingBottom: 7 }}>×</div>

        <Form.Item
          name="tasksPerVariant"
          label="Задач в варианте"
          tooltip={distributionsActive ? 'Автоматически рассчитывается из распределения' : ''}
          style={{ marginBottom: 0, flex: '0 0 150px' }}
        >
          <InputNumber
            min={1}
            max={100}
            size="large"
            style={{ width: '100%' }}
            disabled={distributionsActive}
          />
        </Form.Item>

        <div style={{ fontSize: 20, color: '#bfbfbf', paddingBottom: 7 }}>=</div>

        <div
          style={{
            padding: '7px 14px',
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            color: '#389e0d',
            height: 40,
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {total} задач
        </div>

        <div style={{ width: 1, height: 32, background: '#e8e8e8', flexShrink: 0 }} />

        <Form.Item
          name="variantsMode"
          label="Режим"
          style={{ marginBottom: 0, flex: '1 1 240px' }}
        >
          <Segmented options={VARIANTS_MODE_OPTIONS} style={{ width: '100%' }} />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          icon={<ThunderboltOutlined />}
          loading={loading}
          size="large"
          style={{ height: 40, fontWeight: 600, flexShrink: 0 }}
        >
          Сгенерировать
        </Button>
      </div>
    </div>
  );
}
