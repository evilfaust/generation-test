import { useState, useRef } from 'react';
import { 
  Card, 
  Form, 
  Select, 
  Button, 
  Space, 
  Row, 
  Col,
  Switch,
  Radio,
  InputNumber,
  message,
  Spin,
  Tag,
} from 'antd';
import { 
  PrinterOutlined, 
  ReloadOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import { api } from '../services/pocketbase';
import './TaskWorksheet.css';

const { Option } = Select;

const TaskWorksheet = ({ topics, tags }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [showAnswers, setShowAnswers] = useState(false);
  const printRef = useRef();

  const handleGenerate = async (values) => {
    setLoading(true);
    try {
      const filters = {
        topic: values.topic,
        tags: values.tags,
        difficulty: values.difficulty,
      };

      const tasksData = await api.getTasks(filters);

      if (tasksData.length === 0) {
        message.warning('Задачи по заданным фильтрам не найдены');
        setTasks([]);
        setLoading(false);
        return;
      }

      // Ограничиваем количество задач если указано
      const limitedTasks = values.limit 
        ? tasksData.slice(0, values.limit)
        : tasksData;

      setTasks(limitedTasks);
      message.success(`Загружено задач: ${limitedTasks.length}`);
    } catch (error) {
      console.error('Error loading tasks:', error);
      message.error('Ошибка при загрузке задач');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setTasks([]);
    form.resetFields();
  };

  return (
    <div className="task-worksheet-container">
      {/* Панель управления */}
      <Card 
        title={
          <Space>
            <FilterOutlined />
            Настройки листа задач
          </Space>
        }
        className="no-print"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerate}
          initialValues={{
            columns: 1,
            fontSize: 12,
            showAnswers: false,
            limit: 50,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="topic"
                label="Тема"
                rules={[{ required: true, message: 'Выберите тему' }]}
              >
                <Select
                  placeholder="Выберите тему"
                  showSearch
                  optionFilterProp="children"
                  allowClear
                >
                  {topics.map(topic => (
                    <Option key={topic.id} value={topic.id}>
                      {topic.ege_number}. {topic.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item name="tags" label="Теги (опционально)">
                <Select
                  mode="multiple"
                  placeholder="Выберите теги"
                  allowClear
                >
                  {tags.map(tag => (
                    <Option key={tag.id} value={tag.id}>
                      {tag.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item name="difficulty" label="Сложность">
                <Select placeholder="Любая" allowClear>
                  <Option value="1">1 - Базовый</Option>
                  <Option value="2">2 - Средний</Option>
                  <Option value="3">3 - Повышенный</Option>
                  <Option value="4">4 - Высокий</Option>
                  <Option value="5">5 - Олимпиадный</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="limit" label="Макс. задач">
                <InputNumber
                  min={1}
                  max={200}
                  style={{ width: '100%' }}
                  placeholder="50"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Колонки">
                <Radio.Group
                  value={columns}
                  onChange={(e) => setColumns(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value={1}>1</Radio.Button>
                  <Radio.Button value={2}>2</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Размер шрифта">
                <Radio.Group
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value={10}>10pt</Radio.Button>
                  <Radio.Button value={12}>12pt</Radio.Button>
                  <Radio.Button value={14}>14pt</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Показать ответы" valuePropName="checked">
                <Switch
                  checked={showAnswers}
                  onChange={setShowAnswers}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<ReloadOutlined />}
                loading={loading}
              >
                Сформировать лист
              </Button>
              {tasks.length > 0 && (
                <>
                  <Button 
                    type="default" 
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                  >
                    Печать
                  </Button>
                  <Button onClick={handleReset}>
                    Сбросить
                  </Button>
                </>
              )}
            </Space>
          </Form.Item>
        </Form>

        {/* Превью информация */}
        {tasks.length > 0 && (
          <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                    {tasks.length}
                  </div>
                  <div style={{ color: '#666' }}>Всего задач</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                    {columns}
                  </div>
                  <div style={{ color: '#666' }}>
                    {columns === 1 ? 'Колонка' : 'Колонки'}
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: showAnswers ? '#52c41a' : '#ff4d4f' }}>
                    {showAnswers ? '✓' : '✗'}
                  </div>
                  <div style={{ color: '#666' }}>С ответами</div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      {/* Печатный лист */}
      {tasks.length > 0 && (
        <div 
          ref={printRef}
          className="printable-worksheet"
          style={{
            fontSize: `${fontSize}pt`,
            columnCount: columns,
            columnGap: '20px',
            columnRule: columns > 1 ? '1px solid #ddd' : 'none',
          }}
        >
          {tasks.map((task, index) => (
            <div key={task.id} className="task-item">
              <div className="task-header">
                <span className="task-number">{index + 1}.</span>
                <span className="task-code">{task.code}</span>
              </div>
              
              <div className="task-content">
                <MathRenderer text={task.statement_md} />
                
                {task.has_image && task.image && (
                  <div className="task-image">
                    <img
                      src={api.getImageUrl(task, task.image)}
                      alt=""
                    />
                  </div>
                )}
              </div>

              {showAnswers && task.answer && (
                <div className="task-answer">
                  <strong>Ответ:</strong>{' '}
                  <MathRenderer text={task.answer} />
                </div>
              )}

              {!showAnswers && (
                <div className="answer-space">
                  Ответ: _________________
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
        </div>
      )}
    </div>
  );
};

export default TaskWorksheet;