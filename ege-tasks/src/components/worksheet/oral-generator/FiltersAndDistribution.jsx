import { Collapse, Tabs, Form, Select, Input, Radio, Row, Col, Tag, Alert, Spin, Space, Switch } from 'antd';
import {
  FilterOutlined,
  SearchOutlined,
  TagsOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import DistributionPanel from '../DistributionPanel';

const { Option } = Select;

const DIFFICULTY_OPTIONS = [
  { value: '1', label: '1 - Базовый', color: '#52c41a' },
  { value: '2', label: '2 - Средний', color: '#faad14' },
  { value: '3', label: '3 - Повышенный', color: '#ff4d4f' },
  { value: '4', label: '4 - Высокий', color: '#722ed1' },
  { value: '5', label: '5 - Олимпиадный', color: '#13c2c2' },
];

export default function FiltersAndDistribution({
  form,
  sources,
  years,
  availableTags,
  loadingTags,
  selectedTopic,
  tagDistribution,
  difficultyDistribution,
  progressiveDifficulty,
  setProgressiveDifficulty,
}) {
  const tagDistActive = tagDistribution.items.length > 0;
  const diffDistActive = difficultyDistribution.items.length > 0;

  const filtersTab = (
    <>
      <Form.Item name="search" label="Поиск по коду или тексту" style={{ marginBottom: 16 }}>
        <Input placeholder="Введите код задачи или текст..." prefix={<SearchOutlined />} allowClear />
      </Form.Item>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="difficulty" label="Сложность">
            <Select placeholder="Любая" allowClear>
              <Option value="1">1 — Базовый</Option>
              <Option value="2">2 — Средний</Option>
              <Option value="3">3 — Повышенный</Option>
              <Option value="4">4 — Высокий</Option>
              <Option value="5">5 — Олимпиадный</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item name="filterTags" label="Теги">
            <Select
              mode="multiple"
              placeholder="Фильтр по тегам"
              allowClear
              showSearch
              optionFilterProp="children"
              loading={loadingTags}
            >
              {availableTags.map(tag => (
                <Option key={tag.id} value={tag.id}>
                  <Tag color={tag.color} style={{ marginRight: 4 }}>{tag.title}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="source" label="Источник">
            <Select placeholder="Любой" allowClear showSearch>
              {sources.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item name="year" label="Год">
            <Select placeholder="Любой" allowClear showSearch>
              {years.map(y => <Option key={y} value={y}>{y}</Option>)}
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item name="sortType" label="Сортировка">
            <Select>
              <Option value="code">По коду</Option>
              <Option value="difficulty">По сложности</Option>
              <Option value="random">Случайная</Option>
              <Option value="similarity">По похожести (лесенка)</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="hasAnswer" label="Наличие ответа">
            <Radio.Group>
              <Radio.Button value={undefined}>Все</Radio.Button>
              <Radio.Button value="yes">С ответом</Radio.Button>
              <Radio.Button value="no">Без ответа</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item name="hasSolution" label="Наличие решения">
            <Radio.Group>
              <Radio.Button value={undefined}>Все</Radio.Button>
              <Radio.Button value="yes">С решением</Radio.Button>
              <Radio.Button value="no">Без решения</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  const tagDistributionTab = (
    <>
      {!selectedTopic && (
        <Alert
          message="Выберите тему, чтобы настроить распределение по тегам"
          type="warning"
          style={{ marginBottom: 16 }}
        />
      )}
      {selectedTopic && loadingTags && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
          <div style={{ marginTop: 8, color: '#666' }}>Загрузка доступных тегов...</div>
        </div>
      )}
      {selectedTopic && !loadingTags && availableTags.length === 0 && (
        <Alert message="В выбранной теме нет задач с тегами" type="info" style={{ marginBottom: 16 }} />
      )}
      {selectedTopic && !loadingTags && availableTags.length > 0 && (
        <>
          <Alert
            message={`Доступно ${availableTags.length} тег(ов). Общее количество задач будет автоматически рассчитано.`}
            type="info"
            style={{ marginBottom: 16 }}
          />
          <DistributionPanel
            items={tagDistribution.items}
            options={availableTags.map(tag => ({ value: tag.id, label: tag.title }))}
            keyField="tag"
            onAdd={tagDistribution.addItem}
            onRemove={tagDistribution.removeItem}
            onChange={tagDistribution.updateItem}
            total={tagDistribution.getTotal()}
            expectedTotal={form.getFieldValue('tasksPerVariant') || 0}
            addButtonText="Добавить тег"
            selectPlaceholder="Выберите тег"
          />
        </>
      )}
    </>
  );

  const difficultyDistributionTab = (
    <>
      {!selectedTopic && (
        <Alert
          message="Выберите тему, чтобы настроить распределение по сложности"
          type="warning"
          style={{ marginBottom: 16 }}
        />
      )}
      {selectedTopic && tagDistActive && (
        <Alert
          message="Распределение по сложности нельзя использовать одновременно с распределением по тегам"
          type="warning"
          style={{ marginBottom: 16 }}
        />
      )}
      <Form.Item name="progressiveDifficulty" valuePropName="checked" style={{ marginBottom: 16 }}>
        <Space>
          <Switch
            checked={progressiveDifficulty}
            onChange={(checked) => {
              setProgressiveDifficulty(checked);
              if (checked) difficultyDistribution.reset();
            }}
          />
          <span>Автопрогрессия сложности</span>
        </Space>
      </Form.Item>
      {selectedTopic && !tagDistActive && !progressiveDifficulty && (
        <DistributionPanel
          items={difficultyDistribution.items}
          options={DIFFICULTY_OPTIONS}
          keyField="difficulty"
          onAdd={difficultyDistribution.addItem}
          onRemove={difficultyDistribution.removeItem}
          onChange={difficultyDistribution.updateItem}
          total={difficultyDistribution.getTotal()}
          expectedTotal={form.getFieldValue('tasksPerVariant') || 0}
          addButtonText="Добавить уровень сложности"
          selectPlaceholder="Выберите уровень сложности"
          showColorTags
        />
      )}
    </>
  );

  const tabs = [
    { key: 'filters', label: <span><FilterOutlined /> Фильтры</span>, children: filtersTab },
    {
      key: 'tags',
      label: (
        <span>
          <TagsOutlined /> По тегам
          {tagDistActive && <Tag color="blue" style={{ marginLeft: 6 }}>{tagDistribution.items.length}</Tag>}
        </span>
      ),
      children: tagDistributionTab,
    },
    {
      key: 'difficulty',
      label: (
        <span>
          <BarChartOutlined /> По сложности
          {(diffDistActive || progressiveDifficulty) && (
            <Tag color="purple" style={{ marginLeft: 6 }}>{progressiveDifficulty ? 'прогресс' : diffDistActive ? difficultyDistribution.items.length : ''}</Tag>
          )}
        </span>
      ),
      children: difficultyDistributionTab,
    },
  ];

  return (
    <Collapse
      defaultActiveKey={[]}
      items={[
        {
          key: 'filters-and-dist',
          label: (
            <span style={{ fontWeight: 500 }}>
              <FilterOutlined /> Фильтры и распределения
            </span>
          ),
          children: <Tabs items={tabs} />,
        },
      ]}
      style={{ background: '#fafafa' }}
    />
  );
}
