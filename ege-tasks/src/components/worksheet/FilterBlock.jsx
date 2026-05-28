import { Card, Form, Select, Row, Col, InputNumber, Button, Tag } from 'antd';
import { DeleteOutlined, DragOutlined } from '@ant-design/icons';

const { Option } = Select;

/**
 * Переиспользуемый блок фильтров для подбора задач
 */
const FilterBlock = ({
  block,
  index,
  topics = [],
  subtopics = [],
  tags = [],
  sources = [],
  years = [],
  onChange,
  onRemove,
  showRemoveButton = true,
  draggable = false,
}) => {
  const handleChange = (field, value) => {
    onChange(index, field, value);
  };

  // Фильтруем подтемы по выбранной теме
  const filteredSubtopics = subtopics.filter(st =>
    !block.topic || st.topic === block.topic
  );

  // Получаем название темы для заголовка
  const selectedTopic = topics.find(t => t.id === block.topic);
  const topicTitle = selectedTopic
    ? (selectedTopic.ege_number ? `№${selectedTopic.ege_number} — ${selectedTopic.title}` : selectedTopic.title)
    : `Блок ${index + 1}`;

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {draggable && <DragOutlined style={{ cursor: 'move', color: '#999' }} />}
          <span>{topicTitle}</span>
        </div>
      }
      extra={
        showRemoveButton && (
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => onRemove(index)}
          >
            Удалить
          </Button>
        )
      }
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[16, 16]}>
        {/* Тема */}
        <Col xs={24} md={12}>
          <Form.Item label="Тема" style={{ marginBottom: 0 }}>
            <Select
              placeholder="Выберите тему"
              value={block.topic}
              onChange={v => handleChange('topic', v)}
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {topics.map(topic => (
                <Option key={topic.id} value={topic.id}>
                  {topic.ege_number ? `№${topic.ege_number} — ` : ''}{topic.title}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        {/* Количество задач */}
        <Col xs={24} md={12}>
          <Form.Item label="Количество задач" style={{ marginBottom: 0 }}>
            <InputNumber
              min={1}
              max={50}
              value={block.count}
              onChange={v => handleChange('count', v)}
              style={{ width: '100%' }}
              placeholder="Количество"
            />
          </Form.Item>
        </Col>

        {/* Подтемы */}
        <Col xs={24} md={12}>
          <Form.Item label="Подтемы (опционально)" style={{ marginBottom: 0 }}>
            <Select
              mode="multiple"
              placeholder={block.topic ? "Выберите подтемы" : "Сначала выберите тему"}
              value={block.subtopics}
              onChange={v => handleChange('subtopics', v)}
              showSearch
              optionFilterProp="children"
              allowClear
              disabled={!block.topic}
            >
              {filteredSubtopics.map(subtopic => (
                <Option key={subtopic.id} value={subtopic.id}>
                  {subtopic.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        {/* Сложность */}
        <Col xs={24} md={12}>
          <Form.Item label="Сложность (опционально)" style={{ marginBottom: 0 }}>
            <Select
              mode="multiple"
              placeholder="Выберите уровни сложности"
              value={block.difficulty}
              onChange={v => handleChange('difficulty', v)}
              allowClear
            >
              <Option value="1">
                <Tag color="#52c41a">1</Tag> Базовый
              </Option>
              <Option value="2">
                <Tag color="#faad14">2</Tag> Средний
              </Option>
              <Option value="3">
                <Tag color="#ff4d4f">3</Tag> Повышенный
              </Option>
              <Option value="4">
                <Tag color="#a8071a">4</Tag> Высокий
              </Option>
              <Option value="5">
                <Tag color="#722ed1">5</Tag> Олимпиадный
              </Option>
            </Select>
          </Form.Item>
        </Col>

        {/* Теги */}
        <Col xs={24} md={12}>
          <Form.Item label="Теги (опционально)" style={{ marginBottom: 0 }}>
            <Select
              mode="multiple"
              placeholder="Выберите теги"
              value={block.tags}
              onChange={v => handleChange('tags', v)}
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {tags.map(tag => (
                <Option key={tag.id} value={tag.id}>
                  <Tag color={tag.color} style={{ marginRight: 4 }}>
                    {tag.title}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        {/* Источник */}
        <Col xs={24} md={6}>
          <Form.Item label="Источник (опционально)" style={{ marginBottom: 0 }}>
            <Select
              placeholder="Любой"
              value={block.source}
              onChange={v => handleChange('source', v)}
              showSearch
              allowClear
            >
              {sources.map(s => (
                <Option key={s} value={s}>{s}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        {/* Год */}
        <Col xs={24} md={6}>
          <Form.Item label="Год (опционально)" style={{ marginBottom: 0 }}>
            <Select
              placeholder="Любой"
              value={block.year}
              onChange={v => handleChange('year', v)}
              showSearch
              allowClear
            >
              {years.map(y => (
                <Option key={y} value={y}>{y}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

export default FilterBlock;
