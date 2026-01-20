import { useState } from 'react';
import { Card, Form, Select, Button, Space, Row, Col, Radio, Statistic, Badge } from 'antd';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';

const { Option } = Select;

const TaskFilters = ({ topics, tags, onFilterChange, totalCount }) => {
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

  const handleApplyFilters = () => {
    const values = form.getFieldsValue();
    const newFilters = {};

    if (values.topic) newFilters.topic = values.topic;
    if (values.difficulty) newFilters.difficulty = values.difficulty;
    if (values.source) newFilters.source = values.source;
    if (values.year) newFilters.year = values.year;
    if (values.hasAnswer !== undefined) newFilters.hasAnswer = values.hasAnswer === 'yes';
    if (values.hasSolution !== undefined) newFilters.hasSolution = values.hasSolution === 'yes';

    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleResetFilters = () => {
    form.resetFields();
    setFilters({});
    onFilterChange({});
  };

  const sources = [...new Set(topics.map(t => t.section))].filter(Boolean);
  const years = [2024, 2025, 2026];
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
        onFinish={handleApplyFilters}
      >
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

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<FilterOutlined />}>
              Применить фильтры
            </Button>
            <Button onClick={handleResetFilters} icon={<ClearOutlined />}>
              Сбросить
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default TaskFilters;

