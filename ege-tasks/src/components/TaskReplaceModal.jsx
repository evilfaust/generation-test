import { useState, useEffect } from 'react';
import { Modal, Card, Button, Badge, Spin, Empty, Form, Select, Row, Col } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import { api } from '../services/pocketbase';

const { Option } = Select;

const TaskReplaceModal = ({
  visible,
  taskToReplace,
  onConfirm,
  onCancel,
  topics = [],
  subtopics = [],
  tags = []
}) => {
  const [form] = Form.useForm();
  const [replacementTasks, setReplacementTasks] = useState([]);
  const [filteredReplacementTasks, setFilteredReplacementTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});

  // Загрузка задач для замены
  useEffect(() => {
    if (visible && taskToReplace) {
      loadReplacementTasks();
    }
  }, [visible, taskToReplace]);

  // Применение фильтров
  useEffect(() => {
    applyFilters();
  }, [filters, replacementTasks]);

  const loadReplacementTasks = async () => {
    setLoading(true);
    try {
      const task = taskToReplace.task;

      // Загружаем задачи той же темы
      const filterObj = {};
      if (task.topic) {
        filterObj.topic = task.topic;
      }

      const allTasks = await api.getTasks(filterObj);

      // Исключаем текущую задачу
      const filtered = allTasks.filter(t => t.id !== task.id);

      setReplacementTasks(filtered);
      setFilteredReplacementTasks(filtered);
    } catch (error) {
      console.error('Error loading replacement tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...replacementTasks];

    // Фильтр по подтеме
    if (filters.subtopic) {
      result = result.filter(task => {
        if (Array.isArray(task.subtopic)) {
          return task.subtopic.includes(filters.subtopic);
        }
        return task.subtopic === filters.subtopic;
      });
    }

    // Фильтр по тегам
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(task => {
        if (!task.tags || task.tags.length === 0) return false;
        return filters.tags.some(tagId => task.tags.includes(tagId));
      });
    }

    // Фильтр по сложности
    if (filters.difficulty) {
      result = result.filter(task => task.difficulty === filters.difficulty);
    }

    setFilteredReplacementTasks(result);
  };

  const handleFilterChange = (changedValues) => {
    setFilters(prev => ({ ...prev, ...changedValues }));
  };

  const handleResetFilters = () => {
    form.resetFields();
    setFilters({});
  };

  const handleConfirm = (newTask) => {
    onConfirm(newTask);
    handleResetFilters();
  };

  const handleClose = () => {
    onCancel();
    handleResetFilters();
  };

  // Фильтруем подтемы по текущей теме задачи
  const filteredSubtopics = taskToReplace?.task?.topic
    ? subtopics.filter(st => st.topic === taskToReplace.task.topic)
    : [];

  return (
    <Modal
      title={
        <span>
          <SwapOutlined style={{ marginRight: 8 }} />
          Заменить задачу
        </span>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={900}
      style={{ top: 20 }}
    >
      {taskToReplace && (
        <div>
          {/* Текущая задача */}
          <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
            <div style={{ marginBottom: 8 }}>
              <Badge color="blue" text={`Код: ${taskToReplace.task.code}`} />
              <Badge
                style={{ marginLeft: 12 }}
                color={
                  taskToReplace.task.difficulty === '1' ? 'green' :
                  taskToReplace.task.difficulty === '2' ? 'blue' :
                  taskToReplace.task.difficulty === '3' ? 'orange' :
                  taskToReplace.task.difficulty === '4' ? 'red' : 'purple'
                }
                text={`Сложность: ${taskToReplace.task.difficulty || '1'}`}
              />
            </div>
            <div style={{ fontSize: 14 }}>
              <MathRenderer text={taskToReplace.task.statement_md} />
            </div>
          </Card>

          {/* Фильтры */}
          <Card size="small" style={{ marginBottom: 16 }} title="Фильтры">
            <Form
              form={form}
              layout="vertical"
              onValuesChange={handleFilterChange}
            >
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="subtopic" label="Подтема">
                    <Select
                      placeholder="Выберите подтему"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                    >
                      {filteredSubtopics.map(subtopic => (
                        <Option key={subtopic.id} value={subtopic.id}>
                          {subtopic.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={8}>
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

                <Col xs={24} sm={8}>
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

              <Button onClick={handleResetFilters} size="small">
                Сбросить фильтры
              </Button>
            </Form>
          </Card>

          {/* Список задач для замены */}
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>
              Выберите задачу для замены ({filteredReplacementTasks.length} доступно):
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : filteredReplacementTasks.length === 0 ? (
              <Empty description="Нет подходящих задач для замены" />
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {filteredReplacementTasks.map((task) => (
                  <Card
                    key={task.id}
                    size="small"
                    style={{ marginBottom: 12 }}
                    hoverable
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: 8 }}>
                          <Badge color="blue" text={`Код: ${task.code}`} />
                          <Badge
                            style={{ marginLeft: 12 }}
                            color={
                              task.difficulty === '1' ? 'green' :
                              task.difficulty === '2' ? 'blue' :
                              task.difficulty === '3' ? 'orange' :
                              task.difficulty === '4' ? 'red' : 'purple'
                            }
                            text={`Сложность: ${task.difficulty || '1'}`}
                          />
                        </div>
                        <div style={{ fontSize: 14 }}>
                          <MathRenderer text={task.statement_md} />
                        </div>
                      </div>
                      <Button
                        type="primary"
                        style={{ marginLeft: 16 }}
                        onClick={() => handleConfirm(task)}
                      >
                        Заменить
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default TaskReplaceModal;
