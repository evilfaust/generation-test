import { useState, useEffect, useRef } from 'react';
import {
  Row, Col, Spin, Empty, Pagination, Skeleton, Card, Space, Button,
  Select, Checkbox, Modal, App, Drawer, Divider, Form, Input,
  InputNumber, Tag, Typography, Radio, Tooltip,
} from 'antd';
import {
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import TaskFilters from './TaskFilters';
import TaskCard from './TaskCard';
import TaskEditModal from './TaskEditModal';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useAuth } from '../contexts/AuthContext';

const { Text, Title } = Typography;

const TaskList = ({
  initialFilters = null,
  initialFiltersToken = 0,
  onOpenWorkEditor = null,
}) => {
  const { topics, tags, years, sources, subtopics, loading: initialLoading } = useReferenceData();
  const { canEdit, canDelete } = useAuth();
  const { message } = App.useApp();
  const [tasks, setTasks] = useState([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());

  // Bulk edit state
  const [bulkTags, setBulkTags] = useState([]);
  const [bulkTagMode, setBulkTagMode] = useState('add'); // add | replace
  const [bulkDifficulty, setBulkDifficulty] = useState(null);
  const [bulkSource, setBulkSource] = useState(null);
  const [bulkSubtopics, setBulkSubtopics] = useState([]);
  const [bulkTopic, setBulkTopic] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Create work state
  const [createWorkModal, setCreateWorkModal] = useState(false);
  const [createWorkLoading, setCreateWorkLoading] = useState(false);
  const [workForm] = Form.useForm();

  const filtersRef = useRef({});

  useEffect(() => {
    if (!initialFiltersToken) {
      loadTasks({}, { page: 1, perPage: pageSize });
    }
  }, [initialFiltersToken]);

  const loadTasks = async (newFilters = {}, options = {}) => {
    const {
      page = currentPage,
      perPage = pageSize,
      clearSelection = true,
    } = options;

    setLoading(true);
    try {
      const pageData = await api.getTasksPage({
        page,
        perPage,
        filters: newFilters,
      });

      if (page > 1 && pageData.items.length === 0 && pageData.totalItems > 0) {
        const lastPage = Math.ceil(pageData.totalItems / perPage);
        setCurrentPage(lastPage);
        await loadTasks(newFilters, { page: lastPage, perPage, clearSelection });
        return;
      }

      setTasks(pageData.items || []);
      setTotalTasks(pageData.totalItems || 0);
      setCurrentPage(pageData.page || page);
      setPageSize(pageData.perPage || perPage);

      if (clearSelection) {
        resetBulkState();
      }

      filtersRef.current = newFilters;
    } catch (error) {
      console.error('Error loading tasks:', error);
      message.error('Ошибка при загрузке задач');
    } finally {
      setLoading(false);
    }
  };

  const resetBulkState = () => {
    setSelectedTaskIds(new Set());
    setBulkTags([]);
    setBulkTagMode('add');
    setBulkDifficulty(null);
    setBulkSource(null);
    setBulkSubtopics([]);
    setBulkTopic(null);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    loadTasks(newFilters, { page: 1, perPage: pageSize });
  };

  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
    loadTasks(filtersRef.current, { page, perPage: size, clearSelection: false });
  };

  const handleTaskUpdate = () => {
    loadTasks(filtersRef.current, {
      page: currentPage,
      perPage: pageSize,
      clearSelection: false,
    });
  };

  const handleCreateTask = () => setCreateModalVisible(true);

  const handleTaskSave = async (taskId, taskData) => {
    try {
      if (taskId === null) {
        await api.createTask(taskData);
        message.success('Задача успешно создана');
      } else {
        await api.updateTask(taskId, taskData);
        message.success('Задача успешно обновлена');
      }
      handleTaskUpdate();
    } catch (error) {
      console.error('Error saving task:', error);
      message.error('Ошибка при сохранении задачи');
      throw error;
    }
  };

  const paginatedTasks = tasks;
  const selectedTasks = tasks.filter((t) => selectedTaskIds.has(t.id));
  const pageAllSelected = paginatedTasks.length > 0 && paginatedTasks.every((t) => selectedTaskIds.has(t.id));
  const pageSomeSelected = paginatedTasks.some((t) => selectedTaskIds.has(t.id));
  const selCount = selectedTaskIds.size;

  const handleSelectTask = (taskId, checked) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const handleSelectPage = (checked) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (checked) paginatedTasks.forEach((t) => next.add(t.id));
      else paginatedTasks.forEach((t) => next.delete(t.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
    setDrawerOpen(false);
  };

  // ── Массовые операции ────────────────────────────────────────────────────

  const runBulkOp = async (label, op) => {
    if (selCount === 0) { message.warning('Выберите задачи'); return; }
    setBulkLoading(true);
    message.loading({ content: `${label}…`, key: 'bulk', duration: 0 });
    try {
      await op();
      message.success({ content: `Готово`, key: 'bulk', duration: 2 });
      setSelectedTaskIds(new Set());
      await loadTasks(filtersRef.current, { page: currentPage, perPage: pageSize });
    } catch (error) {
      console.error('Bulk op error:', error);
      message.error({ content: 'Ошибка массовой операции', key: 'bulk', duration: 2 });
    } finally {
      setBulkLoading(false);
    }
  };

  const applyBulkTags = () => {
    if (!bulkTags.length) { message.warning('Выберите теги'); return; }
    runBulkOp('Обновляем теги', async () => {
      for (const task of selectedTasks) {
        const existing = task.tags || [];
        const nextTags = bulkTagMode === 'replace'
          ? [...bulkTags]
          : Array.from(new Set([...existing, ...bulkTags]));
        await api.updateTask(task.id, { tags: nextTags });
      }
      setBulkTags([]);
    });
  };

  const applyBulkDifficulty = () => {
    if (!bulkDifficulty) { message.warning('Выберите сложность'); return; }
    runBulkOp('Обновляем сложность', async () => {
      for (const task of selectedTasks) await api.updateTask(task.id, { difficulty: bulkDifficulty });
      setBulkDifficulty(null);
    });
  };

  const applyBulkSource = () => {
    if (!bulkSource) { message.warning('Выберите источник'); return; }
    runBulkOp('Обновляем источник', async () => {
      for (const task of selectedTasks) await api.updateTask(task.id, { source: bulkSource });
      setBulkSource(null);
    });
  };

  const applyBulkTopic = () => {
    if (!bulkTopic) { message.warning('Выберите тему'); return; }
    runBulkOp('Обновляем тему', async () => {
      for (const task of selectedTasks) await api.updateTask(task.id, { topic: bulkTopic, subtopic: [] });
      setBulkTopic(null);
      setBulkSubtopics([]);
    });
  };

  const applyBulkSubtopics = () => {
    if (!bulkSubtopics.length) { message.warning('Выберите подтемы'); return; }
    runBulkOp('Обновляем подтемы', async () => {
      for (const task of selectedTasks) await api.updateTask(task.id, { subtopic: bulkSubtopics });
      setBulkSubtopics([]);
    });
  };

  const handleBulkDelete = () => {
    if (selCount === 0) { message.warning('Выберите задачи'); return; }
    Modal.confirm({
      title: 'Удалить выбранные задачи?',
      content: `Будет удалено ${selCount} задач(и). Это действие нельзя отменить.`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        setBulkLoading(true);
        message.loading({ content: 'Удаляем задачи…', key: 'bulk', duration: 0 });
        try {
          let failed = 0;
          for (const taskId of selectedTaskIds) {
            try {
              await api.deleteTask(taskId);
            } catch (e) {
              if (e?.status === 400) {
                await api.forceDeleteTask(taskId);
              } else {
                failed++;
              }
            }
          }
          if (failed > 0) {
            message.warning({ content: `Удалено с ошибками: ${failed} не удалось`, key: 'bulk', duration: 3 });
          } else {
            message.success({ content: `Удалено: ${selCount}`, key: 'bulk', duration: 2 });
          }
          setSelectedTaskIds(new Set());
          await loadTasks(filtersRef.current, { page: currentPage, perPage: pageSize });
        } catch (error) {
          message.error({ content: 'Ошибка при удалении', key: 'bulk', duration: 2 });
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  // ── Создание работы из выбранных задач ───────────────────────────────────

  const createWorkFromSelection = async (values) => {
    setCreateWorkLoading(true);
    try {
      const work = await api.createWork({
        title: values.title,
        topic: values.topic || null,
        time_limit: values.time_limit || null,
      });

      const taskIds = [...selectedTaskIds];
      await api.createVariant({
        work: work.id,
        number: 1,
        tasks: taskIds,
      });

      setCreateWorkModal(false);
      workForm.resetFields();
      setSelectedTaskIds(new Set());
      setDrawerOpen(false);

      message.success({
        content: (
          <span>
            Работа «{values.title}» создана.{' '}
            {onOpenWorkEditor && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => onOpenWorkEditor(work.id)}
              >
                Открыть редактор
              </Button>
            )}
          </span>
        ),
        duration: 6,
      });
    } catch (error) {
      console.error('Error creating work:', error);
      message.error('Ошибка при создании работы');
    } finally {
      setCreateWorkLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <TaskFilters
        topics={topics}
        tags={tags}
        years={years}
        sources={sources}
        subtopics={subtopics}
        onFilterChange={handleFilterChange}
        totalCount={totalTasks}
        onCreateTask={handleCreateTask}
        initialFilters={initialFilters}
        initialFiltersToken={initialFiltersToken}
      />

      {/* ── Панель выделения ─────────────────────────────────────────────── */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: selCount > 0 ? '#f0f5ff' : '#fafafa',
          borderColor: selCount > 0 ? '#adc6ff' : undefined,
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {/* Левая часть */}
          <Space wrap>
            <Checkbox
              checked={pageAllSelected}
              indeterminate={pageSomeSelected && !pageAllSelected}
              onChange={(e) => handleSelectPage(e.target.checked)}
              disabled={paginatedTasks.length === 0}
            >
              Выбрать все на странице
            </Checkbox>

            {selCount > 0 ? (
              <>
                <Tag color="blue" style={{ fontSize: 13, padding: '2px 8px' }}>
                  Выбрано: {selCount}
                </Tag>
                <Tooltip title="Снять выделение">
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={handleClearSelection}
                  >
                    Снять
                  </Button>
                </Tooltip>
              </>
            ) : (
              <Text type="secondary" style={{ fontSize: 13 }}>
                Выберите задачи для массовых действий
              </Text>
            )}
          </Space>

          {/* Правая часть — действия (только при выборе; viewer не видит мутаций) */}
          {selCount > 0 && (
            <Space>
              {canEdit && (
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => setCreateWorkModal(true)}
                >
                  Создать работу
                </Button>
              )}
              {canEdit && (
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setDrawerOpen(true)}
                >
                  Изменить атрибуты
                </Button>
              )}
              {canDelete && (
                <Tooltip title={`Удалить ${selCount} задач(и)`}>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleBulkDelete}
                    loading={bulkLoading}
                  >
                    Удалить
                  </Button>
                </Tooltip>
              )}
            </Space>
          )}
        </div>
      </Card>

      {/* ── Список задач ─────────────────────────────────────────────────── */}
      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Col xs={24} sm={24} md={12} lg={8} key={i}>
              <Card>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : tasks.length === 0 ? (
        <Empty description="Задачи не найдены" style={{ marginTop: 50 }} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {paginatedTasks.map((task) => (
              <Col xs={24} sm={24} md={12} lg={8} key={task.id}>
                <TaskCard
                  task={task}
                  allTags={tags}
                  allSources={sources}
                  allYears={years}
                  allSubtopics={subtopics}
                  allTopics={topics}
                  onUpdate={handleTaskUpdate}
                  selected={selectedTaskIds.has(task.id)}
                  onSelect={handleSelectTask}
                />
              </Col>
            ))}
          </Row>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalTasks}
              onChange={handlePageChange}
              showSizeChanger
              showTotal={(total) => `Всего задач: ${total}`}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </>
      )}

      {/* ── Drawer массовых действий ─────────────────────────────────────── */}
      <Drawer
        title={(
          <Space>
            <SettingOutlined />
            <span>Изменить атрибуты</span>
            <Tag color="blue">{selCount}</Tag>
          </Space>
        )}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={360}
        mask={false}
        extra={(
          <Button
            size="small"
            icon={<CloseOutlined />}
            onClick={handleClearSelection}
          >
            Снять выделение
          </Button>
        )}
      >
        {/* Теги */}
        <Title level={5} style={{ marginTop: 0 }}>Теги</Title>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Select
            mode="multiple"
            placeholder="Выберите теги…"
            value={bulkTags}
            onChange={setBulkTags}
            style={{ width: '100%' }}
            options={(tags || []).map((t) => ({ label: t.title, value: t.id }))}
            disabled={bulkLoading}
          />
          <Radio.Group
            value={bulkTagMode}
            onChange={(e) => setBulkTagMode(e.target.value)}
            disabled={bulkLoading}
            size="small"
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: 'Добавить', value: 'add' },
              { label: 'Заменить', value: 'replace' },
            ]}
          />
          <Button
            type="primary"
            block
            onClick={applyBulkTags}
            loading={bulkLoading}
            disabled={!bulkTags.length}
          >
            {bulkTagMode === 'replace' ? 'Заменить теги' : 'Добавить теги'}
          </Button>
        </Space>

        <Divider />

        {/* Сложность */}
        <Title level={5}>Сложность</Title>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Select
            placeholder="Выберите сложность…"
            value={bulkDifficulty}
            onChange={setBulkDifficulty}
            style={{ width: '100%' }}
            options={[
              { label: '1 — Базовый', value: '1' },
              { label: '2 — Средний', value: '2' },
              { label: '3 — Повышенный', value: '3' },
              { label: '4 — Высокий', value: '4' },
              { label: '5 — Олимпиадный', value: '5' },
            ]}
            disabled={bulkLoading}
            allowClear
          />
          <Button
            block
            onClick={applyBulkDifficulty}
            loading={bulkLoading}
            disabled={!bulkDifficulty}
          >
            Применить сложность
          </Button>
        </Space>

        <Divider />

        {/* Источник */}
        <Title level={5}>Источник</Title>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Select
            placeholder="Выберите источник…"
            value={bulkSource}
            onChange={setBulkSource}
            style={{ width: '100%' }}
            options={(sources || []).map((s) => ({ label: s, value: s }))}
            disabled={bulkLoading}
            showSearch
            allowClear
          />
          <Button
            block
            onClick={applyBulkSource}
            loading={bulkLoading}
            disabled={!bulkSource}
          >
            Применить источник
          </Button>
        </Space>

        <Divider />

        {/* Тема / Подтемы */}
        <Title level={5}>Тема и подтемы</Title>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Select
            placeholder="Выберите тему…"
            value={bulkTopic}
            onChange={(v) => { setBulkTopic(v); setBulkSubtopics([]); }}
            style={{ width: '100%' }}
            options={(topics || []).map((t) => ({
              label: t.ege_number ? `№${t.ege_number} — ${t.title}` : t.title,
              value: t.id,
            }))}
            disabled={bulkLoading}
            showSearch
            optionFilterProp="label"
            allowClear
          />
          <Button
            block
            onClick={applyBulkTopic}
            loading={bulkLoading}
            disabled={!bulkTopic}
          >
            Сменить тему (очистит подтемы)
          </Button>
          <Select
            mode="multiple"
            placeholder="Выберите подтемы…"
            value={bulkSubtopics}
            onChange={setBulkSubtopics}
            style={{ width: '100%' }}
            options={(subtopics || [])
              .filter((st) => !bulkTopic || st.topic === bulkTopic)
              .map((st) => ({ label: st.name || st.title, value: st.id }))}
            disabled={bulkLoading}
            showSearch
          />
          <Button
            block
            onClick={applyBulkSubtopics}
            loading={bulkLoading}
            disabled={!bulkSubtopics.length}
          >
            Применить подтемы
          </Button>
        </Space>

        <Divider style={{ borderColor: '#ff4d4f' }} />

        {/* Опасная зона */}
        <Title level={5} type="danger">Удаление</Title>
        <Button
          danger
          block
          icon={<DeleteOutlined />}
          onClick={handleBulkDelete}
          loading={bulkLoading}
        >
          Удалить {selCount} задач(и)
        </Button>
      </Drawer>

      {/* ── Модал создания работы ────────────────────────────────────────── */}
      <Modal
        title={`Создать работу из ${selCount} задач`}
        open={createWorkModal}
        onCancel={() => { setCreateWorkModal(false); workForm.resetFields(); }}
        onOk={() => workForm.submit()}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createWorkLoading}
        destroyOnHidden
      >
        <Form
          form={workForm}
          layout="vertical"
          onFinish={createWorkFromSelection}
          style={{ marginTop: 8 }}
        >
          <Form.Item
            name="title"
            label="Название работы"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Контрольная работа №1" />
          </Form.Item>

          <Form.Item name="topic" label="Тема (необязательно)">
            <Select
              placeholder="Выберите тему…"
              options={(topics || []).map((t) => ({
                label: t.ege_number ? `№${t.ege_number} — ${t.title}` : t.title,
                value: t.id,
              }))}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>

          <Form.Item name="time_limit" label="Время выполнения (минуты, необязательно)">
            <InputNumber min={1} max={300} style={{ width: '100%' }} placeholder="45" />
          </Form.Item>

          <div style={{ padding: '8px 12px', background: '#f6f8ff', borderRadius: 6, border: '1px solid #e6edff' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Будет создан 1 вариант с {selCount} задачами в выбранном порядке.
              Открыть и отредактировать работу можно в разделе «Мои работы».
            </Text>
          </div>
        </Form>
      </Modal>

      {/* ── Модальное окно создания задачи ──────────────────────────────── */}
      <TaskEditModal
        task={null}
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSave={handleTaskSave}
        onDelete={null}
        allTags={tags || []}
        allSources={sources || []}
        allYears={years || []}
        allSubtopics={subtopics || []}
        allTopics={topics || []}
      />
    </div>
  );
};

export default TaskList;
