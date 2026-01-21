import { useState, useEffect, useCallback } from 'react';
import { Card, Form, Select, Button, Space, Row, Col, Radio, Statistic, Badge, Input, Tag } from 'antd';
import { FilterOutlined, ClearOutlined, SearchOutlined, CloseCircleOutlined, SortAscendingOutlined } from '@ant-design/icons';

const { Option } = Select;

const TaskFilters = ({ topics, tags, years = [], sources = [], subtopics = [], onFilterChange, totalCount }) => {
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({});

  const getDifficultyColor = (difficulty) => {
    const colors = {
      '1': '#52c41a',
      '2': '#1890ff',
      '3': '#fa8c16',
      '4': '#f5222d',
      '5': '#722ed1',
    };
    return colors[difficulty] || '#d9d9d9';
  };

  // Автоматическое применение фильтров при изменении
  const applyFilters = useCallback((values) => {
    const newFilters = {};

    if (values.search) newFilters.search = values.search;
    if (values.topic) newFilters.topic = values.topic;
    if (values.subtopic) newFilters.subtopic = values.subtopic;
    if (values.difficulty) newFilters.difficulty = values.difficulty;
    if (values.source) newFilters.source = values.source;
    if (values.year) newFilters.year = values.year;
    if (values.tags && values.tags.length > 0) newFilters.tags = values.tags;
    if (values.hasAnswer !== undefined) newFilters.hasAnswer = values.hasAnswer === 'yes';
    if (values.hasSolution !== undefined) newFilters.hasSolution = values.hasSolution === 'yes';
    if (values.sortBy) newFilters.sortBy = values.sortBy;

    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [onFilterChange]);

  // Обработчик изменения любого поля
  const handleFieldChange = () => {
    const values = form.getFieldsValue();
    applyFilters(values);
  };

  const handleResetFilters = () => {
    form.resetFields();
    setFilters({});
    onFilterChange({});
  };

  const removeFilter = (filterKey) => {
    form.setFieldValue(filterKey, undefined);
    const values = form.getFieldsValue();
    values[filterKey] = undefined;
    applyFilters(values);
  };

  const getActiveFiltersCount = () => {
    return Object.keys(filters).length;
  };

  const difficulties = [
    { value: '1', label: 'Базовый' },
    { value: '2', label: 'Средний' },
    { value: '3', label: 'Повышенный' },
    { value: '4', label: 'Высокий' },
    { value: '5', label: 'Олимпиадный' },
  ];

  return (
    <Card 
      style={{ marginBottom: 24 }}
      title={
        <Space>
          <FilterOutlined />
          <span>Фильтры</span>
        </Space>
      }
      extra={
        <Statistic 
          value={totalCount} 
          suffix="задач" 
          valueStyle={{ fontSize: 18 }}
        />
      }
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFieldChange}
      >
        <Row gutter={16}>
          <Col xs={24} sm={18} md={18}>
            <Form.Item name="search" label="Поиск по коду или тексту">
              <Input
                placeholder="Введите код задачи или текст..."
                prefix={<SearchOutlined />}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6} md={6}>
            <Form.Item name="sortBy" label="Сортировка">
              <Select
                placeholder="Выберите сортировку"
                defaultValue="code"
                suffixIcon={<SortAscendingOutlined />}
              >
                <Option value="code">По коду</Option>
                <Option value="difficulty">По сложности</Option>
                <Option value="created">Новые первые</Option>
                <Option value="updated">Обновленные первые</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item name="topic" label="Тема">
              <Select
                placeholder="Выберите тему"
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {topics.map(topic => (
                  <Option key={topic.id} value={topic.id}>
                    №{topic.ege_number} - {topic.title}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="subtopic" label="Подтема">
              <Select
                placeholder="Выберите подтему"
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {subtopics.map(subtopic => (
                  <Option key={subtopic} value={subtopic}>
                    {subtopic}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="difficulty" label="Сложность">
              <Select placeholder="Выберите сложность" allowClear>
                {difficulties.map(d => (
                  <Option key={d.value} value={d.value}>
                    <Space size={4}>
                      <Badge color={getDifficultyColor(d.value)} />
                      <span>{d.value} - {d.label}</span>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="source" label="Источник">
              <Select placeholder="Выберите источник" allowClear>
                {sources.map(s => (
                  <Option key={s} value={s}>{s}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Form.Item name="year" label="Год">
              <Select placeholder="Выберите год" allowClear>
                {years.map(y => (
                  <Option key={y} value={y}>{y}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24}>
            <Form.Item name="tags" label="Теги">
              <Select
                mode="multiple"
                placeholder="Выберите теги"
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {tags.map(tag => (
                  <Option key={tag.id} value={tag.id}>
                    {tag.title}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="hasAnswer" label="Наличие ответа">
              <Radio.Group>
                <Radio.Button value={undefined}>Все</Radio.Button>
                <Radio.Button value="yes">С ответом</Radio.Button>
                <Radio.Button value="no">Без ответа</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Col>

          <Col xs={24} sm={12}>
            <Form.Item name="hasSolution" label="Наличие решения">
              <Radio.Group>
                <Radio.Button value={undefined}>Все</Radio.Button>
                <Radio.Button value="yes">С решением</Radio.Button>
                <Radio.Button value="no">Без решения</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        {getActiveFiltersCount() > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Space wrap>
              <span style={{ color: '#666', fontWeight: 500 }}>Активные фильтры:</span>
              {filters.search && (
                <Tag
                  closable
                  onClose={() => removeFilter('search')}
                  color="blue"
                >
                  Поиск: {filters.search}
                </Tag>
              )}
              {filters.topic && (
                <Tag
                  closable
                  onClose={() => removeFilter('topic')}
                  color="blue"
                >
                  Тема: {topics.find(t => t.id === filters.topic)?.title}
                </Tag>
              )}
              {filters.subtopic && (
                <Tag
                  closable
                  onClose={() => removeFilter('subtopic')}
                  color="purple"
                >
                  Подтема: {filters.subtopic}
                </Tag>
              )}
              {filters.difficulty && (
                <Tag
                  closable
                  onClose={() => removeFilter('difficulty')}
                  color="blue"
                >
                  Сложность: {filters.difficulty}
                </Tag>
              )}
              {filters.source && (
                <Tag
                  closable
                  onClose={() => removeFilter('source')}
                  color="blue"
                >
                  Источник: {filters.source}
                </Tag>
              )}
              {filters.year && (
                <Tag
                  closable
                  onClose={() => removeFilter('year')}
                  color="blue"
                >
                  Год: {filters.year}
                </Tag>
              )}
              {filters.tags && filters.tags.length > 0 && (
                <Tag
                  closable
                  onClose={() => removeFilter('tags')}
                  color="cyan"
                >
                  Теги: {filters.tags.map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    return tag ? tag.title : tagId;
                  }).join(', ')}
                </Tag>
              )}
              {filters.hasAnswer !== undefined && (
                <Tag
                  closable
                  onClose={() => removeFilter('hasAnswer')}
                  color="green"
                >
                  {filters.hasAnswer ? 'С ответом' : 'Без ответа'}
                </Tag>
              )}
              {filters.hasSolution !== undefined && (
                <Tag
                  closable
                  onClose={() => removeFilter('hasSolution')}
                  color="green"
                >
                  {filters.hasSolution ? 'С решением' : 'Без решения'}
                </Tag>
              )}
              {filters.sortBy && filters.sortBy !== 'code' && (
                <Tag
                  closable
                  onClose={() => removeFilter('sortBy')}
                  color="purple"
                >
                  Сортировка: {
                    filters.sortBy === 'difficulty' ? 'По сложности' :
                    filters.sortBy === 'created' ? 'Новые первые' :
                    filters.sortBy === 'updated' ? 'Обновленные первые' :
                    'По коду'
                  }
                </Tag>
              )}
            </Space>
          </div>
        )}

        <Form.Item>
          <Button onClick={handleResetFilters} icon={<ClearOutlined />}>
            Сбросить все фильтры
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default TaskFilters;

