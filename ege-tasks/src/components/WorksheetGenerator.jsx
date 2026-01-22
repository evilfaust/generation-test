import { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Select, 
  InputNumber, 
  Button, 
  Space, 
  Row, 
  Col,
  Switch,
  message,
  Spin,
  Alert,
  Input,
  Table,
  Popconfirm,
  Tag,
} from 'antd';
import { 
  PrinterOutlined, 
  ReloadOutlined, 
  InfoCircleOutlined,
  SaveOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PrintableWorksheet from './PrintableWorksheet';
import { api } from '../services/pocketbase';

const { Option } = Select;
const { TextArea } = Input;

const WorksheetGenerator = ({ topics, tags = [], subtopics = [] }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [worksheet, setWorksheet] = useState(null);
  const [savedCards, setSavedCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    loadSavedCards();
  }, []);

  const loadSavedCards = async () => {
    setLoadingCards(true);
    try {
      const cards = await api.getCards();
      setSavedCards(cards);
    } catch (error) {
      console.error('Error loading cards:', error);
    } finally {
      setLoadingCards(false);
    }
  };

  const handleGenerate = async (values) => {
    setLoading(true);
    try {
      const filters = {
        topic: values.topic,
        difficulty: values.difficulty,
      };

      // Вычисляем общее количество заданий
      const totalTasks = values.cardsCount * values.tasksPerCard;
      const tasks = await api.getRandomTasks(totalTasks, filters);

      if (tasks.length === 0) {
        message.warning('Задачи с выбранными фильтрами не найдены');
        return;
      }

      if (tasks.length < totalTasks) {
        message.warning(`Найдено только ${tasks.length} задач из запрошенных ${totalTasks}`);
      }

      // Получаем название темы если выбрана
      let topicName = '';
      if (values.topic) {
        const selectedTopic = topics.find(t => t.id === values.topic);
        if (selectedTopic) {
          topicName = selectedTopic.title;
        }
      }

      // Разбиваем задачи на карточки
      const cards = [];
      for (let i = 0; i < tasks.length; i += values.tasksPerCard) {
        cards.push(tasks.slice(i, i + values.tasksPerCard));
      }

      setWorksheet({
        cards,
        title: values.title,
        topicName: topicName,
        showAnswers: values.showAnswers,
        showSolutions: values.showSolutions,
        format: values.format,
        cardsCount: values.cardsCount,
        tasksPerCard: values.tasksPerCard,
        note: values.note,
      });

      message.success(`Сгенерировано ${cards.length} карточек по ${values.tasksPerCard} заданий`);
    } catch (error) {
      console.error('Error generating worksheet:', error);
      message.error('Ошибка при генерации карточек');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCards = async () => {
    if (!worksheet) return;

    try {
      setLoading(true);
      const values = form.getFieldsValue();

      // Получаем название темы если выбрана
      let topicName = '';
      if (values.topic) {
        const selectedTopic = topics.find(t => t.id === values.topic);
        if (selectedTopic) {
          topicName = selectedTopic.title;
        }
      }

      // Базовое название (тема или общее название)
      const baseTitle = topicName || values.title;

      // Сохраняем каждую карточку отдельно
      for (let i = 0; i < worksheet.cards.length; i++) {
        const cardTasks = worksheet.cards[i];
        const taskIds = cardTasks.map(t => t.id);

        // Форматируем номер карточки с нулями (001, 002, etc)
        const cardNumber = String(i + 1).padStart(3, '0');

        const cardData = {
          title: `${baseTitle} ${cardNumber}`,
          tasks: taskIds,
          show_answers: values.showAnswers,
          show_solutions: values.showSolutions,
          format: values.format,
          layout: 'one-column',
          note: values.note || '',
        };

        await api.createCard(cardData);
      }

      message.success(`Сохранено ${worksheet.cards.length} карточек в базу данных`);
      await loadSavedCards();
    } catch (error) {
      console.error('Error saving cards:', error);
      message.error('Ошибка при сохранении карточек');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadCard = async (cardId) => {
    try {
      setLoading(true);
      const card = await api.getCard(cardId);
      
      if (!card || !card.expand?.tasks) {
        message.error('Не удалось загрузить карточку');
        return;
      }

      setWorksheet({
        cards: [card.expand.tasks],
        title: card.title,  // Используем полное название карточки
        topicName: '',      // Оставляем пустым, чтобы использовалось card.title
        showAnswers: card.show_answers,
        showSolutions: card.show_solutions,
        format: card.format,
        cardsCount: 1,
        tasksPerCard: card.tasks.length,
        note: card.note,
      });

      message.success('Карточка загружена');
    } catch (error) {
      console.error('Error loading card:', error);
      message.error('Ошибка при загрузке карточки');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCard = async (cardId) => {
    try {
      await api.deleteCard(cardId);
      message.success('Карточка удалена');
      await loadSavedCards();
    } catch (error) {
      console.error('Error deleting card:', error);
      message.error('Ошибка при удалении карточки');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setWorksheet(null);
    form.resetFields();
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Заданий',
      dataIndex: 'tasks',
      key: 'tasks',
      render: (tasks) => tasks?.length || 0,
    },
    {
      title: 'Формат',
      dataIndex: 'format',
      key: 'format',
      render: (format) => <Tag>{format}</Tag>,
    },
    {
      title: 'Ответы',
      dataIndex: 'show_answers',
      key: 'show_answers',
      render: (show) => show ? <Tag color="green">Да</Tag> : <Tag>Нет</Tag>,
    },
    {
      title: 'Решения',
      dataIndex: 'show_solutions',
      key: 'show_solutions',
      render: (show) => show ? <Tag color="blue">Да</Tag> : <Tag>Нет</Tag>,
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => handleLoadCard(record.id)}
          >
            Открыть
          </Button>
          <Popconfirm
            title="Удалить карточку?"
            onConfirm={() => handleDeleteCard(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="Формат карточек"
        description={
          <div>
            <div>📄 Настраиваемое количество карточек и заданий</div>
            <div>💾 Сохранение карточек в базу данных</div>
            <div>📝 Отдельные листы с ответами для каждой карточки</div>
          </div>
        }
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card title="Настройки карточек" style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerate}
          initialValues={{
            cardsCount: 4,
            tasksPerCard: 10,
            showAnswers: false,
            showSolutions: false,
            title: 'Проверочная работа',
            format: 'А6',
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="title"
                label="Название"
                rules={[{ required: true, message: 'Введите название' }]}
              >
                <Input placeholder="Проверочная работа" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="format" label="Формат карточек">
                <Select>
                  <Option value="А6">А6 (1/4 листа A4)</Option>
                  <Option value="А5">А5 (1/2 листа A4)</Option>
                  <Option value="А4">А4 (полный лист)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="cardsCount"
                label="Количество карточек"
                rules={[{ required: true, message: 'Укажите количество' }]}
              >
                <InputNumber
                  min={1}
                  max={50}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="tasksPerCard"
                label="Заданий в карточке"
                rules={[{ required: true, message: 'Укажите количество' }]}
              >
                <InputNumber
                  min={1}
                  max={30}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Всего заданий">
                <div style={{ 
                  padding: '8px 12px', 
                  background: '#f0f0f0', 
                  borderRadius: 4,
                  fontWeight: 'bold',
                  fontSize: 16,
                }}>
                  {(form.getFieldValue('cardsCount') || 0) * (form.getFieldValue('tasksPerCard') || 0)}
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="topic" label="Тема (опционально)">
                <Select
                  placeholder="Все темы"
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

            <Col xs={24} md={12}>
              <Form.Item name="difficulty" label="Сложность (опционально)">
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
            <Col xs={24} md={12}>
              <Form.Item name="showAnswers" label="Показать ответы в карточках" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="showSolutions" label="Показать решения" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label="Примечание (опционально)">
            <TextArea rows={2} placeholder="Дополнительная информация о карточках" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<ReloadOutlined />}
                loading={loading}
              >
                Сгенерировать карточки
              </Button>
              {worksheet && (
                <>
                  <Button 
                    type="default" 
                    icon={<SaveOutlined />}
                    onClick={handleSaveCards}
                    loading={loading}
                  >
                    Сохранить в базу
                  </Button>
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
      </Card>

      {/* Сохраненные карточки */}
      <Card 
        title="Сохраненные карточки" 
        style={{ marginBottom: 24 }}
        loading={loadingCards}
      >
        <Table
          dataSource={savedCards}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="Генерируем карточки..." />
        </div>
      )}

      {worksheet && !loading && (
        <>
          <Card 
            style={{ marginBottom: 24 }}
            title="📊 Статистика"
          >
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff' }}>
                    {worksheet.cards.length}
                  </div>
                  <div style={{ color: '#666' }}>Карточек</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a' }}>
                    {worksheet.tasksPerCard}
                  </div>
                  <div style={{ color: '#666' }}>Заданий/карточка</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fa8c16' }}>
                    {worksheet.cards.length * worksheet.tasksPerCard}
                  </div>
                  <div style={{ color: '#666' }}>Всего заданий</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#722ed1' }}>
                    {worksheet.showAnswers ? '✓' : '✗'}
                  </div>
                  <div style={{ color: '#666' }}>С ответами</div>
                </div>
              </Col>
            </Row>

            {/* Предпросмотр названий карточек */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ marginBottom: 10, fontWeight: 'bold', color: '#666' }}>
                Названия карточек при сохранении:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {worksheet.cards.map((_, index) => {
                  const values = form.getFieldsValue();
                  let topicName = '';
                  if (values.topic) {
                    const selectedTopic = topics.find(t => t.id === values.topic);
                    if (selectedTopic) {
                      topicName = selectedTopic.title;
                    }
                  }
                  const baseTitle = topicName || values.title;
                  const cardNumber = String(index + 1).padStart(3, '0');
                  
                  return (
                    <Tag key={index} color="blue" style={{ margin: 0 }}>
                      {baseTitle} {cardNumber}
                    </Tag>
                  );
                })}
              </div>
            </div>
          </Card>

          <PrintableWorksheet {...worksheet} topics={topics} tags={tags} subtopics={subtopics} />
        </>
      )}
    </div>
  );
};

export default WorksheetGenerator;
