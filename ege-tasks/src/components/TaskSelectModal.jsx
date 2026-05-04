import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Card, Button, Spin, Empty, Form, Select, Row, Col, Input, Space, Tag } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';

const { Option } = Select;

const EXAM_TYPE_OPTIONS = [
  { value: 'ege_base',    label: 'ЕГЭ базовый' },
  { value: 'ege_profile', label: 'ЕГЭ профильный' },
  { value: 'mordkovich',  label: 'Мордкович' },
  { value: 'oral',        label: 'Устный счёт' },
  { value: 'vpr',         label: 'ВПР' },
  { value: 'trig',        label: 'Тригонометрия' },
  { value: 'other',       label: 'Прочее' },
];

const TaskSelectModal = ({
  visible,
  onCancel,
  onSelect,
  // topics/subtopics/tags props kept for backward compat but not used internally
  excludeIds = [],
}) => {
  const { topics: allTopics, subtopics: allSubtopics, tags: allTags } = useReferenceData();

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');

  const PER_PAGE = 60;

  // AbortController для отмены незавершённых запросов
  const abortRef = useRef(null);
  // Кеш: { key, tasks, totalItems, loadedPages }
  const cacheRef = useRef(null);

  const [totalItems, setTotalItems] = useState(0);
  const [loadedPages, setLoadedPages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const buildFilterObj = (f) => {
    const obj = {};
    if (f.exam_type)               obj.exam_type  = f.exam_type;
    if (f.topic)                   obj.topic      = f.topic;
    if (f.subtopic)                obj.subtopic   = f.subtopic;
    if (f.tags && f.tags.length)   obj.tags       = f.tags;
    if (f.difficulty)              obj.difficulty = f.difficulty;
    return obj;
  };

  const hasFilters = (f) => !!(
    f.exam_type || f.topic || f.subtopic ||
    (f.tags && f.tags.length) || f.difficulty
  );

  const loadTasks = useCallback(async (currentFilters) => {
    if (!hasFilters(currentFilters)) {
      setTasks([]);
      setTotalItems(0);
      setLoadedPages(0);
      cacheRef.current = null;
      return;
    }

    const cacheKey = JSON.stringify(currentFilters);

    // Попадание в кеш — мгновенный ответ, без запроса
    if (cacheRef.current?.key === cacheKey) {
      const excluded = new Set(excludeIds);
      setTasks(cacheRef.current.tasks.filter(t => !excluded.has(t.id)));
      setTotalItems(cacheRef.current.totalItems);
      setLoadedPages(cacheRef.current.loadedPages);
      return;
    }

    // Отменяем предыдущий незавершённый запрос
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setTasks([]);
    setTotalItems(0);
    setLoadedPages(0);
    try {
      const result = await api.getTasksPage({ page: 1, perPage: PER_PAGE, filters: buildFilterObj(currentFilters) });
      if (controller.signal.aborted) return;

      cacheRef.current = { key: cacheKey, tasks: result.items, totalItems: result.totalItems, loadedPages: 1 };
      const excluded = new Set(excludeIds);
      setTasks(result.items.filter(t => !excluded.has(t.id)));
      setTotalItems(result.totalItems);
      setLoadedPages(1);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Error loading tasks for selection:', error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [excludeIds]);

  const loadMore = useCallback(async () => {
    if (!cacheRef.current) return;
    const nextPage = cacheRef.current.loadedPages + 1;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingMore(true);
    try {
      const result = await api.getTasksPage({ page: nextPage, perPage: PER_PAGE, filters: buildFilterObj(filters) });
      if (controller.signal.aborted) return;

      const merged = [...cacheRef.current.tasks, ...result.items];
      cacheRef.current = { ...cacheRef.current, tasks: merged, loadedPages: nextPage };

      const excluded = new Set(excludeIds);
      setTasks(merged.filter(t => !excluded.has(t.id)));
      setLoadedPages(nextPage);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Error loading more tasks:', error);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }, [filters, excludeIds]);

  useEffect(() => {
    if (!visible) {
      abortRef.current?.abort();
      return;
    }
    // Дебаунс 300 мс: при cascade exam_type→topic→subtopic отправляем 1 запрос, не 3
    const timer = setTimeout(() => loadTasks(filters), 300);
    return () => clearTimeout(timer);
  }, [visible, filters, loadTasks]);

  const filteredTopics = useMemo(() => {
    if (!filters.exam_type) return allTopics;
    return allTopics.filter(t => t.exam_type === filters.exam_type);
  }, [allTopics, filters.exam_type]);

  const filteredSubtopics = filters.topic
    ? allSubtopics.filter(st => st.topic === filters.topic)
    : [];

  const visibleTasks = useMemo(() => {
    if (!search) return tasks;
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(t => {
      const code = (t.code || '').toLowerCase();
      const statement = (t.statement_md || '').toLowerCase();
      return code.includes(q) || statement.includes(q);
    });
  }, [tasks, search]);

  const handleReset = () => {
    form.resetFields();
    setFilters({});
    setSearch('');
    setTotalItems(0);
    setLoadedPages(0);
    cacheRef.current = null;
  };

  const handleClose = () => {
    handleReset();
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <PlusOutlined />
          <span>Добавить задачу</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={920}
      style={{ top: 20 }}
    >
      <Card size="small" style={{ marginBottom: 16 }} title="Фильтры">
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changed, values) => {
            const next = { ...values };
            if (Object.prototype.hasOwnProperty.call(changed, 'exam_type')) {
              next.topic = undefined;
              next.subtopic = undefined;
              form.setFieldsValue({ topic: undefined, subtopic: undefined });
            }
            if (Object.prototype.hasOwnProperty.call(changed, 'topic')) {
              next.subtopic = undefined;
              form.setFieldsValue({ subtopic: undefined });
            }
            setFilters(next);
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={6}>
              <Form.Item name="exam_type" label="Контекст">
                <Select placeholder="Все задачи" allowClear>
                  {EXAM_TYPE_OPTIONS.map(o => (
                    <Option key={o.value} value={o.value}>{o.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item name="topic" label="Тема">
                <Select
                  placeholder="Выберите тему"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {filteredTopics.map(topic => (
                    <Option key={topic.id} value={topic.id}>
                      {topic.ege_number ? `№${topic.ege_number} — ` : ''}{topic.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item name="subtopic" label="Подтема">
                <Select
                  placeholder="Выберите подтему"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  disabled={!filters.topic}
                >
                  {filteredSubtopics.map(subtopic => (
                    <Option key={subtopic.id} value={subtopic.id}>
                      {subtopic.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
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

            <Col xs={24}>
              <Form.Item name="tags" label="Теги">
                <Select
                  mode="multiple"
                  placeholder="Выберите теги"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {allTags.map(tag => (
                    <Option key={tag.id} value={tag.id}>
                      {tag.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button onClick={handleReset} size="small">
              Сбросить
            </Button>
            <Input
              allowClear
              placeholder="Поиск по коду или условию"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
            />
          </Space>
        </Form>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : tasks.length === 0 ? (
        <Empty description="Выберите фильтры, чтобы загрузить задачи" />
      ) : visibleTasks.length === 0 ? (
        <Empty description="Нет задач по заданным условиям" />
      ) : (
        <>
          <div style={{ marginBottom: 8, color: '#888', fontSize: 13 }}>
            Показано {tasks.length} из {totalItems} задач
            {search && ` (фильтр: ${visibleTasks.length})`}
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {visibleTasks.map(task => (
              <Card key={task.id} size="small" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      {task.code || 'Без кода'}
                    </div>
                    <MathRenderer text={task.statement_md} />
                    {task.answer && (
                      <div style={{ marginTop: 6 }}>
                        <Tag color="green">Ответ: {task.answer}</Tag>
                      </div>
                    )}
                  </div>
                  <div>
                    <Button type="primary" onClick={() => onSelect(task)}>
                      Добавить
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {tasks.length < totalItems && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <Button onClick={loadMore} loading={loadingMore}>
                  Загрузить ещё (осталось {totalItems - tasks.length})
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
};

export default TaskSelectModal;
