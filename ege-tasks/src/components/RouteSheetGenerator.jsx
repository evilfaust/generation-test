import { useState, useCallback } from 'react';
import { printPaged } from '../utils/printPage';
import {
  App, Button, Divider, Input, Modal, List, Popconfirm,
  Space, Switch, Tooltip, Typography,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, PlusOutlined, PrinterOutlined,
  SaveOutlined, UpOutlined, DownOutlined, FolderOpenOutlined,
  ThunderboltOutlined, CheckOutlined, CloseOutlined, ReloadOutlined,
  ApartmentOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import useRouteSheet, { circleNum } from '../hooks/useRouteSheet';
import RouteSheetPrintLayout from './route-sheet/RouteSheetPrintLayout';
import './route-sheet/RouteSheetPrintLayout.css';
import TaskSelectModal from './TaskSelectModal';
import RouteTaskEditor from './route-sheet/RouteTaskEditor';
import RouteChainGeneratorDrawer from './route-sheet/RouteChainGeneratorDrawer';
import MathRenderer from '../shared/components/MathRenderer';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigPreviewCard,
  TrigStatBadge,
} from './trig/TrigGeneratorLayout';

const REFORMULATE_API = import.meta.env.VITE_REFORMULATE_API_URL || 'https://l.oipav.ru/reformulate-task';
const { TextArea } = Input;
const { Text } = Typography;

const labelStyle = { fontSize: 12, color: 'var(--ink-3)', marginBottom: 4, display: 'block' };

// ─── Просмотр одной задачи ────────────────────────────────────────────────────
function TaskRow({ task, index, total, onRemove, onMoveUp, onMoveDown, onEdit }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px',
      border: '1px solid var(--rule-soft)',
      borderRadius: 'var(--radius)',
      background: 'var(--bg-raised)',
    }}>
      <span style={{
        fontSize: 18, fontWeight: 700, color: 'var(--accent)',
        flexShrink: 0, lineHeight: 1.2, minWidth: 24, textAlign: 'center',
        marginTop: 2,
      }}>
        {circleNum(index)}
      </span>
      <div style={{ flex: 1, overflow: 'hidden', fontSize: 13, minWidth: 0 }}>
        {task.code && (
          <div style={{ color: 'var(--ink-4)', fontSize: 11, marginBottom: 2, fontFamily: 'var(--font-mono)' }}>
            {task.code}
          </div>
        )}
        <div style={{ lineHeight: 1.5, color: 'var(--ink)' }}>
          <MathRenderer content={(task.statement_md || '').slice(0, 220)} />
        </div>
        {task.answer && (
          <div style={{ marginTop: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--ink-3)' }}>Ответ: </span>
            <span style={{ fontWeight: 600, color: 'var(--lvl-1)', fontFamily: 'var(--font-mono)' }}>
              {task.answer}
            </span>
          </div>
        )}
      </div>
      <Space size={3} style={{ flexShrink: 0 }}>
        <Tooltip title="Редактировать">
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(task.id)} />
        </Tooltip>
        <Tooltip title="Выше">
          <Button size="small" icon={<UpOutlined />} disabled={index === 0} onClick={() => onMoveUp(index)} />
        </Tooltip>
        <Tooltip title="Ниже">
          <Button size="small" icon={<DownOutlined />} disabled={index === total - 1} onClick={() => onMoveDown(index)} />
        </Tooltip>
        <Popconfirm title="Убрать из листа?" onConfirm={() => onRemove(task.id)} okText="Да" cancelText="Нет" okButtonProps={{ danger: true }}>
          <Button size="small" icon={<DeleteOutlined />} danger type="text" />
        </Popconfirm>
      </Space>
    </div>
  );
}

// ─── Inline-редактор задачи ────────────────────────────────────────────────────
function TaskRowEditor({ task, index, previousTasks, onSave, onCancel }) {
  const [statement, setStatement] = useState(task.statement_md || '');
  const [answer, setAnswer] = useState(task.answer || '');
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const handleAiReformulate = useCallback(async () => {
    if (!aiInstruction.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const resp = await fetch(REFORMULATE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement,
          answer,
          instruction: aiInstruction.trim(),
          previous_tasks: previousTasks.map(t => ({ answer: t.answer || '' })),
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (data.statement_md) setStatement(data.statement_md);
      if (data.answer) setAnswer(data.answer);
      setAiInstruction('');
    } catch (e) {
      setAiError(e.message || 'Ошибка AI');
    } finally {
      setAiLoading(false);
    }
  }, [statement, answer, aiInstruction, previousTasks]);

  return (
    <div style={{
      border: '1.5px solid var(--accent)',
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      background: 'var(--accent-soft)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{circleNum(index)}</span>
        <Text style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>Редактирование</Text>
      </div>

      {/* Быстрая вставка плейсхолдеров */}
      {previousTasks.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Вставить:</span>
          {previousTasks.map((t, i) => (
            <Tooltip key={t.id || i} title={`Ответ ${i + 1}: ${t.answer || '—'}`}>
              <Button
                size="small"
                onClick={() => setStatement(prev => prev + `[${circleNum(i)}]`)}
                style={{ fontFamily: 'var(--font-mono)', padding: '0 8px', fontSize: 12, height: 22 }}
              >
                [{circleNum(i)}]
              </Button>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Условие */}
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Условие</label>
        <TextArea
          value={statement}
          onChange={e => setStatement(e.target.value)}
          rows={4}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          placeholder="Условие задачи (Markdown + LaTeX)"
        />
      </div>

      {/* Превью */}
      {statement && (
        <div style={{
          background: 'var(--bg-raised)', border: '1px solid var(--rule-soft)',
          borderRadius: 'var(--radius-sm)', padding: '6px 10px',
          marginBottom: 8, fontSize: 13,
        }}>
          <MathRenderer content={statement} />
        </div>
      )}

      {/* Ответ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>Ответ:</span>
        <Input
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          style={{ width: 160, fontWeight: 600, fontFamily: 'var(--font-mono)' }}
          size="small"
          placeholder="числовой ответ"
        />
      </div>

      {/* AI-переформулировка */}
      <div style={{
        background: 'var(--bg-sunken)', border: '1px solid var(--rule)',
        borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>
          <ThunderboltOutlined style={{ color: '#faad14', marginRight: 4 }} />
          AI-переформулировка
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Input
            value={aiInstruction}
            onChange={e => setAiInstruction(e.target.value)}
            placeholder="Что изменить? «сделай про площадь», «упрости», «исправь ошибку»"
            size="small"
            onPressEnter={handleAiReformulate}
            disabled={aiLoading}
          />
          <Button
            size="small"
            type="primary"
            ghost
            icon={<ThunderboltOutlined />}
            loading={aiLoading}
            disabled={!aiInstruction.trim()}
            onClick={handleAiReformulate}
            style={{ flexShrink: 0 }}
          >
            AI
          </Button>
        </div>
        {aiError && <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 4 }}>{aiError}</div>}
      </div>

      <Space>
        <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => onSave({ statement_md: statement, answer })}>
          Сохранить
        </Button>
        <Button size="small" icon={<CloseOutlined />} onClick={onCancel}>Отмена</Button>
      </Space>
    </div>
  );
}

// ─── Коннектор цепочки ────────────────────────────────────────────────────────
function ChainConnector({ fromIndex }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      paddingLeft: 34, color: 'var(--ink-4)', fontSize: 11,
      margin: '1px 0',
    }}>
      <ArrowDownOutlined style={{ fontSize: 10 }} />
      <span style={{ fontStyle: 'italic' }}>ответ {circleNum(fromIndex)} → следующая задача</span>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function RouteSheetGenerator() {
  const { message } = App.useApp();
  const { topics, subtopics, tags } = useReferenceData();
  const {
    title, setTitle,
    tasks,
    effectiveLinks,
    savedId,
    showTeacherKey, setShowTeacherKey,
    addTask, removeTask, moveTask, updateTask,
    reset, loadFromSaved,
    save, update,
  } = useRouteSheet();

  const [editingId, setEditingId] = useState(null);
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [savedSheets, setSavedSheets] = useState([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);

  const handleAddTask = useCallback((task) => {
    addTask(task);
    setSelectModalOpen(false);
  }, [addTask]);

  const handleSaveTaskEdit = useCallback(async (taskId, fields) => {
    updateTask(taskId, fields);
    try {
      await api.updateTask(taskId, { statement_md: fields.statement_md, answer: fields.answer });
    } catch {
      message.error('Ошибка при сохранении задачи в базе');
    }
    setEditingId(null);
  }, [updateTask, message]);

  const handleAiTasksReady = useCallback(async (taskSpecs) => {
    setAiSaving(true);
    try {
      for (const spec of taskSpecs) {
        const record = await api.createTask({
          statement_md: spec.statement_md,
          answer: spec.answer,
          source: 'route',
          has_image: false,
        });
        addTask(record);
      }
      message.success(`Добавлено ${taskSpecs.length} задач в маршрут`);
    } catch {
      message.error('Ошибка при сохранении задач');
    } finally {
      setAiSaving(false);
    }
  }, [addTask, message]);

  const handlePrint = useCallback(() => printPaged(), []);

  const handleSave = useCallback(async () => {
    if (!tasks.length) { message.warning('Добавьте хотя бы одну задачу'); return; }
    setSaving(true);
    try {
      if (savedId) { await update(); message.success('Обновлён'); }
      else { await save(); message.success('Сохранён'); }
    } catch {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, [tasks, savedId, save, update, message]);

  const handleOpenLoad = useCallback(async () => {
    setLoadingSheets(true);
    setLoadModalOpen(true);
    try { setSavedSheets(await api.getRouteSheets()); }
    finally { setLoadingSheets(false); }
  }, []);

  const handleLoad = useCallback((sheet) => {
    loadFromSaved(sheet);
    setLoadModalOpen(false);
    message.success(`Загружен: ${sheet.title}`);
  }, [loadFromSaved, message]);

  const handleDelete = useCallback(async (id) => {
    await api.deleteRouteSheet(id);
    setSavedSheets(prev => prev.filter(s => s.id !== id));
    message.success('Удалён');
  }, [message]);

  // ─── Left panel ──────────────────────────────────────────────────────────────
  const left = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10, overflowY: 'auto' }}>
      <TrigSettingsSection label="Параметры листа">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch checked={showTeacherKey} onChange={setShowTeacherKey} size="small" />
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Страница ключа учителя</span>
        </div>
      </TrigSettingsSection>

      <TrigSettingsSection label="Добавить задачи">
        <TrigActions>
          <Button
            type="primary"
            block
            icon={<ThunderboltOutlined />}
            onClick={() => setAiDrawerOpen(true)}
            loading={aiSaving}
            style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
          >
            AI-генерация цепочки
          </Button>
          <Button block icon={<PlusOutlined />} onClick={() => setSelectModalOpen(true)}>
            Добавить из базы задач
          </Button>
          <Button block icon={<EditOutlined />} type="dashed" onClick={() => setEditorOpen(true)}>
            Создать задачу вручную
          </Button>
        </TrigActions>
      </TrigSettingsSection>

      <TrigSettingsSection label="Сохранение">
        <TrigActions>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              block
              icon={<SaveOutlined />}
              type={savedId ? 'default' : 'primary'}
              onClick={handleSave}
              loading={saving}
              disabled={!tasks.length}
            >
              {savedId ? 'Обновить' : 'Сохранить'}
            </Button>
            <Button icon={<FolderOpenOutlined />} onClick={handleOpenLoad} />
          </div>
          {savedId && (
            <Button block icon={<ReloadOutlined />} onClick={reset} danger type="text" size="small">
              Новый лист
            </Button>
          )}
        </TrigActions>
      </TrigSettingsSection>

      {tasks.length > 0 && (
        <TrigSettingsSection label="Печать">
          <TrigActions>
            <Button block type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
              Печать
            </Button>
          </TrigActions>
        </TrigSettingsSection>
      )}
    </div>
  );

  // ─── Right panel ─────────────────────────────────────────────────────────────
  const right = (
    <TrigPreviewPane
      hasData={tasks.length > 0}
      emptyIcon={<ApartmentOutlined />}
      emptyTitle="Цепочка пуста"
      emptyHint="Сгенерируйте задачи с помощью AI или добавьте из базы"
      summary={tasks.length > 0 ? [
        <TrigStatBadge key="n">{tasks.length} задач</TrigStatBadge>,
        showTeacherKey && <TrigStatBadge key="key" tone="success">+ ключ учителя</TrigStatBadge>,
      ].filter(Boolean) : null}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tasks.map((task, idx) => (
          <div key={task.id}>
            {idx > 0 && <ChainConnector fromIndex={idx - 1} />}
            {editingId === task.id ? (
              <TaskRowEditor
                task={task}
                index={idx}
                previousTasks={tasks.slice(0, idx)}
                onSave={(fields) => handleSaveTaskEdit(task.id, fields)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TaskRow
                task={task}
                index={idx}
                total={tasks.length}
                onRemove={removeTask}
                onMoveUp={(i) => moveTask(i, i - 1)}
                onMoveDown={(i) => moveTask(i, i + 1)}
                onEdit={setEditingId}
              />
            )}
          </div>
        ))}
      </div>
    </TrigPreviewPane>
  );

  return (
    <>
      <TrigGeneratorLayout
        icon={<ApartmentOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Название маршрутного листа"
        leftWidth={320}
        left={left}
        right={right}
      />

      {/* Печатный макет (скрыт на экране) */}
      {tasks.length > 0 && (
        <RouteSheetPrintLayout
          title={title}
          tasks={tasks}
          showTeacherKey={showTeacherKey}
        />
      )}

      {/* Модал выбора задачи из базы */}
      <TaskSelectModal
        visible={selectModalOpen}
        onCancel={() => setSelectModalOpen(false)}
        onSelect={handleAddTask}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={tasks.map(t => t.id)}
      />

      {/* Редактор новой задачи */}
      <RouteTaskEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={(task) => { addTask(task); setEditorOpen(false); message.success('Задача создана и добавлена'); }}
        previousTasks={tasks}
        insertIndex={tasks.length}
      />

      {/* AI-генерация */}
      <RouteChainGeneratorDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        existingTasks={tasks}
        onTasksReady={handleAiTasksReady}
      />

      {/* Загрузка сохранённых листов */}
      <Modal
        title="Загрузить маршрутный лист"
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={480}
      >
        <List
          loading={loadingSheets}
          dataSource={savedSheets}
          locale={{ emptyText: 'Нет сохранённых листов' }}
          renderItem={(sheet) => (
            <List.Item
              actions={[
                <Button key="load" type="link" onClick={() => handleLoad(sheet)}>Загрузить</Button>,
                <Popconfirm key="del" title="Удалить?" onConfirm={() => handleDelete(sheet.id)} okText="Да" cancelText="Нет" okButtonProps={{ danger: true }}>
                  <Button type="link" danger>Удалить</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={sheet.title}
                description={`${sheet.expand?.tasks?.length ?? 0} задач`}
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
