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
  Input,
  message,
  Spin,
  Tag,
  Divider,
  Collapse,
  Tabs,
  Modal,
  List,
  Badge,
  Tooltip,
} from 'antd';
import {
  PrinterOutlined,
  ReloadOutlined,
  FilterOutlined,
  SaveOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import { api } from '../services/pocketbase';
import './TaskWorksheet.css';

const { Option } = Select;
const { Panel } = Collapse;
const { TabPane } = Tabs;

const TaskWorksheet = ({ topics, tags, years = [], sources = [] }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [allTasks, setAllTasks] = useState([]); // Все загруженные задачи
  const [variants, setVariants] = useState([]); // Массив вариантов с задачами
  const [columns, setColumns] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [showAnswersInline, setShowAnswersInline] = useState(false);
  const [showAnswersPage, setShowAnswersPage] = useState(true);
  const [showTitlePage, setShowTitlePage] = useState(true);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [solutionSpace, setSolutionSpace] = useState('medium');
  const printRef = useRef();

  // Состояния для замены задачи
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [taskToReplace, setTaskToReplace] = useState(null); // { variantIndex, taskIndex, task }
  const [replacementTasks, setReplacementTasks] = useState([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);

  const handleGenerate = async (values) => {
    setLoading(true);
    try {
      // Собираем фильтры
      const filters = {};
      if (values.topic) filters.topic = values.topic;
      if (values.tags && values.tags.length > 0) filters.tags = values.tags;
      if (values.difficulty) filters.difficulty = values.difficulty;
      if (values.source) filters.source = values.source;
      if (values.year) filters.year = values.year;
      if (values.hasAnswer !== undefined) filters.hasAnswer = values.hasAnswer === 'yes';
      if (values.hasSolution !== undefined) filters.hasSolution = values.hasSolution === 'yes';

      const tasksData = await api.getTasks(filters);

      if (tasksData.length === 0) {
        message.warning('Задачи по заданным фильтрам не найдены');
        setAllTasks([]);
        setVariants([]);
        setLoading(false);
        return;
      }

      // Клиентский поиск если есть
      let filteredTasks = tasksData;
      if (values.search) {
        const searchLower = values.search.toLowerCase();
        filteredTasks = tasksData.filter(task =>
          task.code?.toLowerCase().includes(searchLower) ||
          task.statement_md?.toLowerCase().includes(searchLower)
        );
      }

      if (filteredTasks.length === 0) {
        message.warning('Задачи не найдены по поисковому запросу');
        setAllTasks([]);
        setVariants([]);
        setLoading(false);
        return;
      }

      // Сортировка
      let sortedTasks = [...filteredTasks];
      const sortType = values.sortType || 'code';

      if (sortType === 'code') {
        sortedTasks.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      } else if (sortType === 'difficulty') {
        sortedTasks.sort((a, b) => (a.difficulty || '1').localeCompare(b.difficulty || '1'));
      } else if (sortType === 'random') {
        sortedTasks = sortedTasks.sort(() => Math.random() - 0.5);
      }

      setAllTasks(sortedTasks);

      // Генерация вариантов
      const variantsCount = values.variantsCount || 1;
      const tasksPerVariant = values.tasksPerVariant || sortedTasks.length;
      const variantsMode = values.variantsMode || 'different';

      const generatedVariants = [];

      if (variantsMode === 'different') {
        // Разные задачи в каждом варианте
        for (let i = 0; i < variantsCount; i++) {
          const startIdx = i * tasksPerVariant;
          const endIdx = Math.min(startIdx + tasksPerVariant, sortedTasks.length);
          generatedVariants.push({
            number: i + 1,
            tasks: sortedTasks.slice(startIdx, endIdx),
          });
        }
      } else if (variantsMode === 'shuffled') {
        // Одинаковые задачи, разный порядок
        const baseTasks = sortedTasks.slice(0, tasksPerVariant);
        for (let i = 0; i < variantsCount; i++) {
          const shuffled = [...baseTasks].sort(() => Math.random() - 0.5);
          generatedVariants.push({
            number: i + 1,
            tasks: shuffled,
          });
        }
      } else {
        // Одинаковые задачи, одинаковый порядок
        const baseTasks = sortedTasks.slice(0, tasksPerVariant);
        for (let i = 0; i < variantsCount; i++) {
          generatedVariants.push({
            number: i + 1,
            tasks: baseTasks,
          });
        }
      }

      setVariants(generatedVariants);

      const totalTasks = generatedVariants.reduce((sum, v) => sum + v.tasks.length, 0);
      message.success(`Сгенерировано ${variantsCount} вариант(ов), всего ${totalTasks} задач`);
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
    setAllTasks([]);
    setVariants([]);
    form.resetFields();
  };

  const handleReplaceTask = async (variantIndex, taskIndex, task) => {
    setTaskToReplace({ variantIndex, taskIndex, task });
    setReplaceModalVisible(true);
    setLoadingReplacements(true);

    try {
      // Загружаем все задачи из той же темы
      const filters = {};
      if (task.topic) filters.topic = task.topic;

      const allTopicTasks = await api.getTasks(filters);

      // Фильтруем: убираем только текущую задачу и задачи, уже используемые в вариантах
      const usedTaskIds = new Set();
      variants.forEach(variant => {
        variant.tasks.forEach(t => usedTaskIds.add(t.id));
      });

      const filtered = allTopicTasks.filter(t =>
        t.id !== task.id &&
        !usedTaskIds.has(t.id)
      );

      // Сортируем по коду для удобства
      filtered.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

      setReplacementTasks(filtered);
    } catch (error) {
      console.error('Error loading replacement tasks:', error);
      message.error('Ошибка при загрузке задач для замены');
    } finally {
      setLoadingReplacements(false);
    }
  };

  const handleConfirmReplace = (newTask) => {
    const { variantIndex, taskIndex } = taskToReplace;

    // Создаем копию вариантов и заменяем задачу
    const newVariants = [...variants];
    newVariants[variantIndex].tasks[taskIndex] = newTask;

    setVariants(newVariants);
    setReplaceModalVisible(false);
    message.success('Задача успешно заменена');
  };

  const handleCancelReplace = () => {
    setReplaceModalVisible(false);
    setTaskToReplace(null);
    setReplacementTasks([]);
  };

  const renderTitlePage = (workTitle, workDate, workClass) => {
    if (!showTitlePage) return null;

    return (
      <div className="title-page">
        <div className="title-page-content">
          <h1>{workTitle || 'Контрольная работа'}</h1>
          {workDate && <p className="work-date">{workDate}</p>}
          {workClass && <p className="work-class">Класс: {workClass}</p>}
        </div>
        <div className="page-break"></div>
      </div>
    );
  };

  const renderVariant = (variant, workTitle, variantIndex) => {
    return (
      <div key={variant.number} className="variant-container">
        {/* Заголовок варианта */}
        <div className="variant-header">
          <h2>Вариант {variant.number}</h2>
          {showStudentInfo && (
            <div className="student-info">
              <div className="student-field">
                <span>Фамилия, Имя:</span>
                <div className="student-line">_______________________________</div>
              </div>
              <div className="student-field">
                <span>Класс:</span>
                <div className="student-line">________</div>
              </div>
            </div>
          )}
        </div>

        {/* Задачи варианта */}
        <div
          className="tasks-content"
          style={{
            fontSize: `${fontSize}pt`,
            columnCount: columns,
            columnGap: '20px',
            columnRule: columns > 1 ? '1px solid #ddd' : 'none',
          }}
        >
          {variant.tasks.map((task, taskIndex) => (
            <div key={task.id} className="task-item">
              <div className="task-header">
                <span className="task-number">{taskIndex + 1}.</span>
                <span className="task-code">{task.code}</span>
                {/* Кнопка замены (только на экране) */}
                <Tooltip title="Заменить задачу" className="no-print">
                  <Button
                    type="text"
                    size="small"
                    icon={<SwapOutlined />}
                    onClick={() => handleReplaceTask(variantIndex, taskIndex, task)}
                    style={{ marginLeft: 'auto' }}
                  />
                </Tooltip>
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

              {showAnswersInline && task.answer && (
                <div className="task-answer">
                  <strong>Ответ:</strong>{' '}
                  <MathRenderer text={task.answer} />
                </div>
              )}

              {!showAnswersInline && (
                <div className={`answer-space answer-space-${solutionSpace}`}>
                  {solutionSpace !== 'none' && 'Решение:'}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="page-break"></div>
      </div>
    );
  };

  const renderAnswersPage = () => {
    if (!showAnswersPage || variants.length === 0) return null;

    return (
      <div className="answers-page">
        <h2>Ответы</h2>

        {variants.map((variant) => (
          <div key={variant.number} className="variant-answers">
            <h3>Вариант {variant.number}</h3>
            <div className="answers-grid">
              {variant.tasks.map((task, index) => (
                <div key={task.id} className="answer-item">
                  <span className="answer-number">{index + 1}.</span>
                  <span className="answer-value">
                    {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
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
            sortType: 'code',
            variantsCount: 1,
            variantsMode: 'different',
            tasksPerVariant: 20,
          }}
        >
          <Collapse defaultActiveKey={['filters', 'variants', 'format']}>
            {/* Фильтры */}
            <Panel header="📋 Фильтры задач" key="filters">
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item name="search" label="Поиск по коду или тексту">
                    <Input
                      placeholder="Введите код задачи или текст..."
                      prefix={<SearchOutlined />}
                      allowClear
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="topic" label="Тема">
                    <Select
                      placeholder="Выберите тему"
                      showSearch
                      optionFilterProp="children"
                      allowClear
                    >
                      {topics.map(topic => (
                        <Option key={topic.id} value={topic.id}>
                          №{topic.ege_number} - {topic.title}
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

                <Col xs={24} md={8}>
                  <Form.Item name="tags" label="Теги">
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
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="source" label="Источник">
                    <Select placeholder="Любой" allowClear showSearch>
                      {sources.map(s => (
                        <Option key={s} value={s}>{s}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="year" label="Год">
                    <Select placeholder="Любой" allowClear showSearch>
                      {years.map(y => (
                        <Option key={y} value={y}>{y}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="sortType" label="Сортировка">
                    <Select>
                      <Option value="code">По коду</Option>
                      <Option value="difficulty">По сложности</Option>
                      <Option value="random">Случайная</Option>
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
            </Panel>

            {/* Варианты */}
            <Panel header="🎲 Генерация вариантов" key="variants">
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="variantsCount" label="Количество вариантов">
                    <InputNumber
                      min={1}
                      max={10}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="tasksPerVariant" label="Задач в варианте">
                    <InputNumber
                      min={1}
                      max={100}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item name="variantsMode" label="Режим вариантов">
                    <Select>
                      <Option value="different">Разные задачи</Option>
                      <Option value="shuffled">Одинаковые, разный порядок</Option>
                      <Option value="same">Одинаковые задачи</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Panel>

            {/* Формат */}
            <Panel header="🎨 Формат печати" key="format">
              <Row gutter={16}>
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
                  <Form.Item label="Место для решения">
                    <Radio.Group
                      value={solutionSpace}
                      onChange={(e) => setSolutionSpace(e.target.value)}
                      buttonStyle="solid"
                    >
                      <Radio.Button value="none">Нет</Radio.Button>
                      <Radio.Button value="small">Мало</Radio.Button>
                      <Radio.Button value="medium">Средне</Radio.Button>
                      <Radio.Button value="large">Много</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Form.Item label="Титульный лист">
                    <Switch
                      checked={showTitlePage}
                      onChange={setShowTitlePage}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item label="Поля для ФИО">
                    <Switch
                      checked={showStudentInfo}
                      onChange={setShowStudentInfo}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item label="Ответы в тексте">
                    <Switch
                      checked={showAnswersInline}
                      onChange={setShowAnswersInline}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item label="Лист с ответами">
                    <Switch
                      checked={showAnswersPage}
                      onChange={setShowAnswersPage}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {showTitlePage && (
                <>
                  <Divider>Титульный лист</Divider>
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item name="workTitle" label="Название работы">
                        <Input placeholder="Контрольная работа" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={8}>
                      <Form.Item name="workDate" label="Дата">
                        <Input placeholder="12 января 2026" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={8}>
                      <Form.Item name="workClass" label="Класс">
                        <Input placeholder="10 класс" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}
            </Panel>
          </Collapse>

          <Form.Item style={{ marginTop: 16 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<ReloadOutlined />}
                loading={loading}
                size="large"
              >
                Сформировать лист
              </Button>
              {variants.length > 0 && (
                <>
                  <Button
                    type="default"
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    size="large"
                  >
                    Печать
                  </Button>
                  <Button onClick={handleReset} size="large">
                    Сбросить
                  </Button>
                </>
              )}
            </Space>
          </Form.Item>
        </Form>

        {/* Превью информация */}
        {variants.length > 0 && (
          <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                    {variants.length}
                  </div>
                  <div style={{ color: '#666' }}>Вариант(ов)</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                    {variants[0]?.tasks.length || 0}
                  </div>
                  <div style={{ color: '#666' }}>Задач в варианте</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>
                    {variants.reduce((sum, v) => sum + v.tasks.length, 0)}
                  </div>
                  <div style={{ color: '#666' }}>Всего задач</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: showAnswersPage ? '#52c41a' : '#ff4d4f' }}>
                    {showAnswersPage ? '✓' : '✗'}
                  </div>
                  <div style={{ color: '#666' }}>Лист ответов</div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      {/* Печатный лист */}
      {variants.length > 0 && (
        <div ref={printRef} className="printable-worksheet">
          {renderTitlePage(
            form.getFieldValue('workTitle'),
            form.getFieldValue('workDate'),
            form.getFieldValue('workClass')
          )}

          {variants.map((variant, index) => renderVariant(variant, form.getFieldValue('workTitle'), index))}

          {renderAnswersPage()}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="Генерируем варианты..." />
        </div>
      )}

      {/* Модальное окно для замены задачи */}
      <Modal
        title={
          <Space>
            <SwapOutlined />
            <span>Заменить задачу</span>
          </Space>
        }
        open={replaceModalVisible}
        onCancel={handleCancelReplace}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        {taskToReplace && (
          <div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <strong>Текущая задача:</strong>
              <div style={{ marginTop: 8 }}>
                <Badge color="blue" text={`Код: ${taskToReplace.task.code}`} />
                <Divider type="vertical" />
                <Badge
                  color={
                    taskToReplace.task.difficulty === '1' ? 'green' :
                    taskToReplace.task.difficulty === '2' ? 'blue' :
                    taskToReplace.task.difficulty === '3' ? 'orange' :
                    taskToReplace.task.difficulty === '4' ? 'red' : 'purple'
                  }
                  text={`Сложность: ${taskToReplace.task.difficulty || '1'}`}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <MathRenderer text={taskToReplace.task.statement_md} />
              </div>
            </div>

            <Divider>Задачи для замены</Divider>

            {loadingReplacements ? (
              <div style={{ textAlign: 'center', padding: 30 }}>
                <Spin tip="Загружаем задачи из темы..." />
              </div>
            ) : replacementTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>
                Задачи для замены не найдены
              </div>
            ) : (
              <List
                dataSource={replacementTasks}
                renderItem={(task) => (
                  <List.Item
                    actions={[
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => handleConfirmReplace(task)}
                      >
                        Заменить
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Badge color="blue" text={task.code} />
                          <Badge
                            color={
                              task.difficulty === '1' ? 'green' :
                              task.difficulty === '2' ? 'blue' :
                              task.difficulty === '3' ? 'orange' :
                              task.difficulty === '4' ? 'red' : 'purple'
                            }
                            text={`Сложность: ${task.difficulty || '1'}`}
                          />
                          {task.answer && <Tag color="green">С ответом</Tag>}
                          {task.solution && <Tag color="blue">С решением</Tag>}
                        </Space>
                      }
                      description={
                        <div style={{ maxHeight: 100, overflow: 'hidden' }}>
                          <MathRenderer text={task.statement_md} />
                        </div>
                      }
                    />
                  </List.Item>
                )}
                style={{ maxHeight: 500, overflowY: 'auto' }}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TaskWorksheet;
