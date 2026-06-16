import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tabs, Form, Input, InputNumber, Select, Button, Space, Switch, Typography, Tooltip, Alert, Empty, Tag, Popconfirm, Modal, App } from 'antd';
import { SaveOutlined, CopyOutlined, EditOutlined, SwapOutlined, DeleteOutlined, PlusOutlined, ExportOutlined, FileMarkdownOutlined, NodeIndexOutlined, PrinterOutlined, RetweetOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import TaskStatementRenderer from './TaskStatementRenderer';
import { api } from '../services/pocketbase';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import TaskSelectModal from './TaskSelectModal';
import SessionPanel from './worksheet/SessionPanel';
import TeacherResultsDashboard from './worksheet/TeacherResultsDashboard';
import WorksheetVectorTools from './worksheet/oral-generator/WorksheetVectorTools';
import SimilarSwapModal from './worksheet/SimilarSwapModal';
import WorkPrintPreview from './worksheet/WorkPrintPreview';
import WorksheetGridPrint from './worksheet/WorksheetGridPrint';
import WorkLessonLinks from './worksheet/WorkLessonLinks';
import WorkOverlapWarning from './worksheet/WorkOverlapWarning';
import { useTaskDragDrop, useTaskEditing } from '../hooks';
import { shuffleArray } from '../utils/shuffle';
import { PB_BASE_URL } from '../services/pocketbaseUrl';
import './TaskWorksheet.css';

const PB_URL = PB_BASE_URL;

const { Text } = Typography;
const { Option } = Select;

// Условие задачи в составе работы. Для задач из «Решу ЕГЭ» чертёж вшит в
// statement_md как ![image](внешний_url) — sdamgia блокирует прямой fetch из
// браузера, поэтому такие URL нужно подменить на локальные task_images.
// task_images грузим лениво и только если в условии реально есть inline-картинка
// (большинство задач её не имеют → лишних запросов нет).
const WorkTaskStatement = ({ task }) => {
  const needsImages = /!\[[^\]]*\]\(/.test(task.statement_md || '');
  const [conditionImages, setConditionImages] = useState([]);

  useEffect(() => {
    if (!needsImages) {
      setConditionImages([]);
      return;
    }
    let alive = true;
    api.getTaskImages(task.id)
      .then(imgs => { if (alive) setConditionImages(imgs.condition || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [task.id, needsImages]);

  if (!needsImages) {
    return <MathRenderer text={task.statement_md} />;
  }
  return <TaskStatementRenderer text={task.statement_md} images={conditionImages} />;
};

const WorkEditor = ({
  work,
  variants,
  setVariants,
  onSave,
  onSaveAsNew,
  hasAttempts,
  attemptCount = 0,
  sessions = [],
  dirty = false,
  onDirty,
  topics = [],
  tags = [],
  subtopics = [],
  years = [],
  sources = [],
}) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [activeVariantKey, setActiveVariantKey] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addTargetVariant, setAddTargetVariant] = useState(null);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveTargetVariantIndex, setMoveTargetVariantIndex] = useState(null);
  const [movingTaskRef, setMovingTaskRef] = useState(null);
  const [similarRef, setSimilarRef] = useState(null); // { variantIndex, taskIndex, task }
  const [printOpen, setPrintOpen] = useState(false);
  const [worksheetPrintOpen, setWorksheetPrintOpen] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [resultsSessionId, setResultsSessionId] = useState(null);

  const dragDropHandlers = useTaskDragDrop(variants, setVariants);
  const taskEditing = useTaskEditing(variants, setVariants);

  useEffect(() => {
    if (!work) return;
    form.setFieldsValue({
      title: work.title || 'Контрольная работа',
      topic: work.topic || null,
      timeLimit: work.time_limit || null,
    });
  }, [work, form]);

  useEffect(() => {
    if (variants.length === 0) {
      setActiveVariantKey(null);
      return;
    }
    const key = String(variants[0].number || 1);
    setActiveVariantKey(prev => prev || key);
  }, [variants]);

  // По умолчанию в «Результатах» показываем свежайшую сессию (sessions отсортированы -created).
  useEffect(() => {
    setResultsSessionId(prev => {
      if (prev && sessions.some(s => s.id === prev)) return prev;
      return sessions[0]?.id || null;
    });
  }, [sessions]);

  const activeVariantIndex = useMemo(() => {
    if (!activeVariantKey) return 0;
    const idx = variants.findIndex(v => String(v.number) === String(activeVariantKey));
    return idx === -1 ? 0 : idx;
  }, [variants, activeVariantKey]);

  const activeVariant = variants[activeVariantIndex];

  const totalTasksCount = useMemo(() => {
    return variants.reduce((sum, v) => sum + (v.tasks?.length || 0), 0);
  }, [variants]);

  const handleRemoveTask = (variantIndex, taskIndex) => {
    const next = [...variants];
    next[variantIndex].tasks.splice(taskIndex, 1);
    setVariants(next);
  };

  const openMoveTaskModal = (variantIndex, taskIndex) => {
    setMovingTaskRef({ variantIndex, taskIndex });
    const defaultTarget = variants.findIndex((_, idx) => idx !== variantIndex);
    setMoveTargetVariantIndex(defaultTarget >= 0 ? defaultTarget : null);
    setMoveModalVisible(true);
  };

  const handleMoveTask = () => {
    if (!movingTaskRef) return;
    const { variantIndex: sourceVariantIndex, taskIndex: sourceTaskIndex } = movingTaskRef;
    const targetVariantIndex = moveTargetVariantIndex;

    if (
      sourceVariantIndex === undefined ||
      sourceTaskIndex === undefined ||
      targetVariantIndex === null ||
      targetVariantIndex === undefined
    ) {
      return;
    }

    if (sourceVariantIndex === targetVariantIndex) {
      message.info('Выберите другой вариант');
      return;
    }

    const next = [...variants];
    const [task] = next[sourceVariantIndex].tasks.splice(sourceTaskIndex, 1);
    if (!task) return;

    next[targetVariantIndex].tasks.push(task);
    setVariants(next);
    setMoveModalVisible(false);
    setMoveTargetVariantIndex(null);
    setMovingTaskRef(null);
    setActiveVariantKey(String(next[targetVariantIndex]?.number || targetVariantIndex + 1));
    message.success('Задача перенесена в другой вариант');
  };

  const handleSimilarReplace = (fullTask) => {
    if (!similarRef) return;
    const { variantIndex, taskIndex } = similarRef;
    setVariants(prev => {
      const copy = prev.map(v => ({ ...v, tasks: [...(v.tasks || [])] }));
      if (copy[variantIndex]?.tasks?.[taskIndex]) {
        copy[variantIndex].tasks[taskIndex] = fullTask;
      }
      return copy;
    });
  };

  const handleSimilarAdd = (fullTask) => {
    if (!similarRef) return;
    const { variantIndex } = similarRef;
    setVariants(prev => {
      const copy = prev.map(v => ({ ...v, tasks: [...(v.tasks || [])] }));
      const target = copy[variantIndex];
      if (target && !target.tasks.some(t => t.id === fullTask.id)) {
        target.tasks.push(fullTask);
      }
      return copy;
    });
  };

  const openAddTaskModal = (variantIndex) => {
    setAddTargetVariant(variantIndex);
    setAddModalVisible(true);
  };

  const handleAddTask = (task) => {
    if (addTargetVariant === null || addTargetVariant === undefined) return;
    const next = [...variants];
    next[addTargetVariant].tasks.push(task);
    setVariants(next);
    setAddModalVisible(false);
    setAddTargetVariant(null);
  };

  const handleAddVariant = () => {
    const maxNumber = variants.reduce((max, v) => Math.max(max, v.number || 0), 0);
    const nextNumber = maxNumber + 1;
    const next = [...variants, { number: nextNumber, tasks: [] }];
    setVariants(next);
    setActiveVariantKey(String(nextNumber));
  };

  const handleDuplicateVariant = (variantIndex) => {
    const source = variants[variantIndex];
    if (!source) return;
    const maxNumber = variants.reduce((max, v) => Math.max(max, v.number || 0), 0);
    const nextNumber = maxNumber + 1;
    setVariants(prev => [...prev, { number: nextNumber, tasks: [...(prev[variantIndex]?.tasks || [])] }]);
    setActiveVariantKey(String(nextNumber));
    message.success(`Вариант ${source.number} продублирован как вариант ${nextNumber}`);
  };

  const handleShuffleVariant = (variantIndex) => {
    setVariants(prev => {
      const copy = prev.map(v => ({ ...v, tasks: [...(v.tasks || [])] }));
      if (copy[variantIndex]) {
        copy[variantIndex].tasks = shuffleArray(copy[variantIndex].tasks);
      }
      return copy;
    });
    message.success('Задачи варианта перемешаны');
  };

  const handleRemoveVariant = (variantIndex) => {
    const next = variants.filter((_, idx) => idx !== variantIndex);
    setVariants(next);
    const newActive = next[0]?.number ? String(next[0].number) : null;
    setActiveVariantKey(newActive);
  };

  const handleSaveClick = async () => {
    const values = await form.validateFields();
    if (hasAttempts) {
      await onSaveAsNew(values);
    } else {
      await onSave(values);
    }
  };

  const handleSaveAsNewClick = async () => {
    const values = await form.validateFields();
    await onSaveAsNew(values);
  };

  const handleExportMD = () => {
    const title = work?.title || 'Контрольная работа';
    let md = `# ${title}\n\n`;
    variants.forEach(variant => {
      md += `## Вариант ${variant.number}\n\n`;
      (variant.tasks || []).forEach((task, idx) => {
        md += `**${idx + 1}.** \`${task.code}\`\n\n${task.statement_md}\n\n`;
        if (task.answer) md += `> **Ответ:** ${task.answer}\n\n`;
        md += `---\n\n`;
      });
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.md`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
    message.success('Markdown успешно сохранён');
  };

  if (!work) {
    return (
      <Card>
        <Form form={form} component={false} />
        <Empty description="Работа не найдена. Откройте её из списка «Мои работы»." />
      </Card>
    );
  }

  // Режим печати рабочего листа в клетку — отдельная страница (паттерн как в
  // Генераторе): контент редактора убран из дерева, иначе он ломает абсолютное
  // позиционирование .wgp-root при печати → пустые листы.
  if (worksheetPrintOpen) {
    const wsTitle = work.title || 'Рабочий лист';
    return (
      <WorksheetGridPrint
        pages={variants.map((v) => ({
          title: wsTitle,
          label: `Вариант ${v.number}`,
          tasks: v.tasks || [],
        }))}
        onBack={() => setWorksheetPrintOpen(false)}
      />
    );
  }

  return (
    <Card
      title={
        <Space size={8} wrap>
          <span>{work.title || 'Работа без названия'}</span>
          {dirty && <Tag color="orange" style={{ margin: 0 }}>не сохранено</Tag>}
        </Space>
      }
      extra={
        <Space wrap>
          {hasAttempts ? (
            <Tooltip title="У работы есть попытки. Можно только сохранить как новую.">
              <Button type="primary" icon={<CopyOutlined />} onClick={handleSaveAsNewClick}>
                Сохранить как новую
              </Button>
            </Tooltip>
          ) : (
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveClick}>
              Сохранить
            </Button>
          )}
          <Button icon={<CopyOutlined />} onClick={handleSaveAsNewClick}>
            Копия
          </Button>
          {totalTasksCount > 0 && (
            <Tooltip title="Предпросмотр и печать листа (или экспорт в PDF)">
              <Button icon={<PrinterOutlined />} onClick={() => setPrintOpen(true)}>
                Печать / PDF
              </Button>
            </Tooltip>
          )}
          {variants.length > 0 && (
            <Tooltip title="Экспорт вариантов в Markdown для Obsidian">
              <Button icon={<FileMarkdownOutlined />} onClick={handleExportMD}>
                Экспорт MD
              </Button>
            </Tooltip>
          )}
        </Space>
      }
      styles={{ body: { paddingTop: 12 } }}
    >
      {hasAttempts && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="У этой работы есть попытки. Изменения можно сохранить только как новую работу."
          description={`Попыток: ${attemptCount}. История останется неизменной.`}
        />
      )}

      <WorkLessonLinks workId={work.id} workTitle={work.title} />

      <Tabs
        items={[
          {
            key: 'structure',
            label: 'Состав',
            children: (
              <div>
                {variants.length === 0 ? (
                  <Empty description="В работе нет вариантов" />
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <Text type="secondary">Вариантов: {variants.length} • Задач: {totalTasksCount}</Text>
                      <Space wrap>
                        <Tooltip title="Показывать ответы задач в составе">
                          <span style={{ fontSize: 13 }}>
                            <Switch size="small" checked={showAnswers} onChange={setShowAnswers} /> ответы
                          </span>
                        </Tooltip>
                        <Button
                          icon={<PlusOutlined />}
                          onClick={handleAddVariant}
                        >
                          Добавить вариант
                        </Button>
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => openAddTaskModal(activeVariantIndex)}
                          disabled={!activeVariant}
                        >
                          Добавить задачу
                        </Button>
                        <Tooltip title="Создать копию текущего варианта">
                          <Button
                            icon={<CopyOutlined />}
                            onClick={() => handleDuplicateVariant(activeVariantIndex)}
                            disabled={!activeVariant || (activeVariant.tasks?.length || 0) === 0}
                          >
                            Дублировать
                          </Button>
                        </Tooltip>
                        <Tooltip title="Перемешать порядок задач в текущем варианте">
                          <Button
                            icon={<RetweetOutlined />}
                            onClick={() => handleShuffleVariant(activeVariantIndex)}
                            disabled={!activeVariant || (activeVariant.tasks?.length || 0) < 2}
                          >
                            Перемешать
                          </Button>
                        </Tooltip>
                        <Popconfirm
                          title="Удалить вариант?"
                          description="Задачи из варианта будут удалены только из этой работы."
                          okText="Удалить"
                          cancelText="Отмена"
                          onConfirm={() => handleRemoveVariant(activeVariantIndex)}
                          disabled={!activeVariant || variants.length <= 1}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            disabled={!activeVariant || variants.length <= 1}
                          >
                            Удалить вариант
                          </Button>
                        </Popconfirm>
                      </Space>
                    </div>

                    <WorkOverlapWarning
                      workId={work.id}
                      variants={variants}
                      onOpenWork={(id) => navigate(`/app/works/${id}/edit`)}
                    />

                    <WorksheetVectorTools
                      variants={variants}
                      setVariants={setVariants}
                      workTitle={work.title}
                      currentWorkId={work.id}
                      onOpenWork={(id) => navigate(`/app/works/${id}/edit`)}
                    />

                    <Tabs
                      type="card"
                      activeKey={activeVariantKey || undefined}
                      onChange={setActiveVariantKey}
                      items={variants.map((variant, idx) => {
                        const vTasks = variant.tasks || [];
                        const diffCounts = vTasks.reduce((acc, t) => {
                          if (t.difficulty) acc[t.difficulty] = (acc[t.difficulty] || 0) + 1;
                          return acc;
                        }, {});
                        const noAnswer = vTasks.filter(t => !t.answer).length;
                        return {
                        key: String(variant.number || idx + 1),
                        label: `Вариант ${variant.number || idx + 1}`,
                        children: (
                          <div>
                            <div style={{ marginBottom: 10 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                Задач: {vTasks.length}
                                {diffCounts[1] > 0 && <> · <span style={{ color: '#52c41a' }}>базовых: {diffCounts[1]}</span></>}
                                {diffCounts[2] > 0 && <> · <span style={{ color: '#faad14' }}>средних: {diffCounts[2]}</span></>}
                                {diffCounts[3] > 0 && <> · <span style={{ color: '#ff4d4f' }}>сложных: {diffCounts[3]}</span></>}
                                {noAnswer > 0 && <> · <span style={{ color: '#ff4d4f' }}>без ответа: {noAnswer}</span></>}
                              </Text>
                            </div>
                            {vTasks.map((task, taskIndex) => {
                              const isDragging = dragDropHandlers?.isDragging(idx, taskIndex);
                              const isDragOver = dragDropHandlers?.isDragOver(idx, taskIndex);

                              return (
                                <div
                                  key={task.id}
                                  className={`task-item ${isDragging ? 'dragging' : ''} ${
                                    isDragOver ? 'drag-over' : ''
                                  }`}
                                  draggable
                                  onDragStart={e => dragDropHandlers?.handleDragStart(e, idx, taskIndex)}
                                  onDragOver={e => dragDropHandlers?.handleDragOver(e, idx, taskIndex)}
                                  onDragLeave={dragDropHandlers?.handleDragLeave}
                                  onDrop={e => dragDropHandlers?.handleDrop(e, idx, taskIndex)}
                                  onDragEnd={dragDropHandlers?.handleDragEnd}
                                  style={{ marginBottom: 12 }}
                                >
                                  <div className="task-header" style={{ alignItems: 'center' }}>
                                    <span className="task-number">{taskIndex + 1}.</span>
                                    {task.code && <Tag style={{ marginLeft: 8 }}>{task.code}</Tag>}
                                    {task.difficulty && (
                                      <Tag color="blue">Сложность: {task.difficulty}</Tag>
                                    )}
                                    <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                      <Tooltip title="Редактировать задачу">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<EditOutlined />}
                                          onClick={() => taskEditing.handleEditTask(task)}
                                        />
                                      </Tooltip>
                                      <Tooltip title="Заменить задачу">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<SwapOutlined />}
                                          onClick={() => taskEditing.handleReplaceTask(idx, taskIndex, task)}
                                        />
                                      </Tooltip>
                                      <Tooltip title="Похожие задачи (векторный поиск)">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<NodeIndexOutlined />}
                                          onClick={() => setSimilarRef({ variantIndex: idx, taskIndex, task })}
                                        />
                                      </Tooltip>
                                      <Tooltip title="Перенести в другой вариант">
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<ExportOutlined />}
                                          disabled={variants.length <= 1}
                                          onClick={() => openMoveTaskModal(idx, taskIndex)}
                                        />
                                      </Tooltip>
                                      <Tooltip title="Удалить из варианта">
                                        <Button
                                          type="text"
                                          size="small"
                                          danger
                                          icon={<DeleteOutlined />}
                                          onClick={() => handleRemoveTask(idx, taskIndex)}
                                        />
                                      </Tooltip>
                                    </div>
                                  </div>
                                  <div className="task-content">
                                    <WorkTaskStatement task={task} />
                                    {(task.image_url || task.image) && (
                                      <div className="task-image">
                                        <img
                                          src={task.image_url || `${PB_URL}/api/files/tasks/${task.id}/${task.image}`}
                                          alt=""
                                        />
                                      </div>
                                    )}
                                    {showAnswers && (
                                      <div style={{
                                        marginTop: 6, padding: '4px 10px', fontSize: 13,
                                        background: task.answer ? '#f6ffed' : '#fff2f0',
                                        border: `1px solid ${task.answer ? '#d9f7be' : '#ffccc7'}`,
                                        borderRadius: 4,
                                      }}>
                                        <Text type="secondary">Ответ: </Text>
                                        {task.answer ? <MathRenderer text={task.answer} /> : <Text type="danger">не задан</Text>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ),
                        };
                      })}
                    />
                  </>
                )}
              </div>
            ),
          },
          {
            key: 'params',
            label: 'Параметры',
            children: (
              <Form form={form} layout="vertical" onValuesChange={() => onDirty?.()}>
                <Form.Item
                  name="title"
                  label="Название работы"
                  rules={[{ required: true, message: 'Введите название работы' }]}
                >
                  <Input placeholder="Например: Контрольная — тригонометрия" />
                </Form.Item>

                <Form.Item name="topic" label="Основная тема">
                  <Select allowClear placeholder="Не выбрано" showSearch optionFilterProp="children">
                    {topics.map(topic => (
                      <Option key={topic.id} value={topic.id}>
                        {topic.ege_number ? `№${topic.ege_number} — ` : ''}{topic.title}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="timeLimit" label="Время на выполнение (мин)">
                  <InputNumber min={1} max={300} style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'results',
            label: 'Результаты',
            children: (
              <div>
                <Card size="small" title="Выдача" style={{ marginBottom: 12 }}>
                  <SessionPanel workId={work.id} />
                </Card>
                <Card
                  size="small"
                  title="Результаты"
                  extra={
                    sessions.length > 1 ? (
                      <Select
                        size="small"
                        style={{ minWidth: 240 }}
                        value={resultsSessionId}
                        onChange={setResultsSessionId}
                        options={sessions.map((s, i) => ({
                          value: s.id,
                          label: `Выдача ${sessions.length - i} — ${new Date(s.created).toLocaleDateString('ru-RU')}${s.is_open ? ' · приём открыт' : ''}`,
                        }))}
                      />
                    ) : null
                  }
                >
                  {resultsSessionId ? (
                    <TeacherResultsDashboard key={resultsSessionId} sessionId={resultsSessionId} />
                  ) : (
                    <Empty description="Нет активной сессии" />
                  )}
                </Card>
              </div>
            ),
          },
        ]}
      />

      <TaskReplaceModal
        visible={taskEditing.replaceModalVisible}
        taskToReplace={taskEditing.taskToReplace}
        onConfirm={taskEditing.handleConfirmReplace}
        onCancel={taskEditing.handleCancelReplace}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        currentVariantTasks={
          taskEditing.taskToReplace
            ? variants[taskEditing.taskToReplace.variantIndex]?.tasks || []
            : []
        }
      />

      <TaskEditModal
        visible={taskEditing.editModalVisible}
        task={taskEditing.taskToEdit}
        onClose={taskEditing.handleCancelEdit}
        onSave={taskEditing.handleSaveEdit}
        onDelete={taskEditing.handleDeleteEdit}
        allTags={tags}
        allSources={sources}
        allYears={years}
        allSubtopics={subtopics}
        allTopics={topics}
      />

      <TaskSelectModal
        visible={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          setAddTargetVariant(null);
        }}
        onSelect={handleAddTask}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={(activeVariant?.tasks || []).map(t => t.id)}
      />

      {printOpen && (
        <WorkPrintPreview
          work={work}
          variants={variants}
          onClose={() => setPrintOpen(false)}
          onOpenWorksheet={() => {
            setPrintOpen(false);
            setWorksheetPrintOpen(true);
          }}
        />
      )}

      <SimilarSwapModal
        open={!!similarRef}
        task={similarRef?.task}
        excludeIds={
          similarRef
            ? (variants[similarRef.variantIndex]?.tasks || []).map(t => t.id).filter(Boolean)
            : []
        }
        onClose={() => setSimilarRef(null)}
        onReplace={handleSimilarReplace}
        onAdd={handleSimilarAdd}
      />

      <Modal
        title="Перенести задачу"
        open={moveModalVisible}
        onCancel={() => {
          setMoveModalVisible(false);
          setMoveTargetVariantIndex(null);
          setMovingTaskRef(null);
        }}
        onOk={handleMoveTask}
        okText="Перенести"
        cancelText="Отмена"
        okButtonProps={{ disabled: moveTargetVariantIndex === null || moveTargetVariantIndex === undefined }}
      >
        <Form layout="vertical">
          <Form.Item label="Куда перенести">
            <Select
              placeholder="Выберите вариант"
              value={moveTargetVariantIndex}
              onChange={setMoveTargetVariantIndex}
            >
              {variants.map((variant, idx) => (
                <Option
                  key={variant.number || idx + 1}
                  value={idx}
                  disabled={idx === movingTaskRef?.variantIndex}
                >
                  Вариант {variant.number || idx + 1}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default WorkEditor;
