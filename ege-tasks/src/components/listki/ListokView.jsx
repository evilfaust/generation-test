import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Card, Checkbox, Collapse, Space, Spin, Tag, Tooltip } from 'antd';
import {
  ArrowLeftOutlined, PrinterOutlined, EditOutlined, CopyOutlined,
  SendOutlined, ReadOutlined, FormOutlined, SettingOutlined, CloseOutlined,
} from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import TaskEditModal from '../TaskEditModal';
import ListokTaskBulkDrawer from './ListokTaskBulkDrawer';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { R, route } from '../../App';
import ListokPrint from './ListokPrint';
import './listki.css';

const COURSE_LABEL = { planimetry: 'Планиметрия', stereometry: 'Стереометрия', algebra: 'Алгебра' };

// Номер задачи из code: gordin-plan-1.1 → 1.1 (иначе пусто)
function numFromCode(code) {
  const m = /(\d+\.\d+)$/.exec(code || '');
  return m ? m[1] : '';
}

export default function ListokView() {
  const { sheetId } = useParams();
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  const { canEdit } = useAuth();
  const { topics, subtopics, tags, sources, years, reloadData } = useReferenceData();
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [items, setItems] = useState([]);
  const [printMode, setPrintMode] = useState(false);
  const [busy, setBusy] = useState(false);

  // ── Режим правки задач ────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [editingTask, setEditingTask] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const reloadItems = async () => {
    try { setItems(await api.getListokItems(sheetId)); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [s, its] = await Promise.all([api.getListokSheet(sheetId), api.getListokItems(sheetId)]);
        if (!alive) return;
        setSheet(s);
        setItems(its);
      } catch (e) {
        console.error(e); message.error('Листок не найден');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [sheetId]);

  const problems = useMemo(
    () => items.map((it) => ({
      ...it,
      num: it.type === 'task' ? numFromCode(it.expand?.task?.code) : '',
      statement: it.expand?.task?.statement_md || '',
      taskId: it.expand?.task?.id || it.task || null,
      hasTopic: !!it.expand?.task?.topic,
    })),
    [items],
  );

  // Задачи листка (для выбора «все»)
  const taskItems = useMemo(() => problems.filter((p) => p.type === 'task' && p.taskId), [problems]);
  const selCount = selected.size;
  const allSelected = taskItems.length > 0 && taskItems.every((p) => selected.has(p.taskId));
  const someSelected = taskItems.some((p) => selected.has(p.taskId));

  const toggleSelect = (taskId, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(taskId); else next.delete(taskId);
      return next;
    });
  };
  const selectAll = (checked) => {
    setSelected(checked ? new Set(taskItems.map((p) => p.taskId)) : new Set());
  };
  const clearSelection = () => setSelected(new Set());

  const exitEditMode = () => { setEditMode(false); clearSelection(); };

  // ── Открыть редактор одной задачи ──────────────────────────────────────
  const openTaskEditor = async (taskId) => {
    try {
      const full = await api.getTask(taskId);
      setEditingTask(full);
    } catch (e) { console.error(e); message.error('Не удалось загрузить задачу'); }
  };

  const saveTask = async (taskId, data) => {
    try {
      await api.updateTask(taskId, data);
      message.success('Задача сохранена');
      await reloadItems();
      reloadData?.();
    } catch (e) { console.error(e); message.error('Ошибка сохранения задачи'); throw e; }
  };

  // ── Массовые операции ──────────────────────────────────────────────────
  const runBulk = async (label, op) => {
    if (!selCount) return;
    setBulkLoading(true);
    message.loading({ content: `${label}…`, key: 'listok-bulk', duration: 0 });
    try {
      await op([...selected]);
      message.success({ content: 'Готово', key: 'listok-bulk', duration: 2 });
      await reloadItems();
      reloadData?.();
    } catch (e) {
      console.error('Bulk op error:', e);
      message.error({ content: 'Ошибка массовой операции', key: 'listok-bulk', duration: 2 });
    } finally { setBulkLoading(false); }
  };

  const bulkMove = (topicId, subIds) => runBulk('Переносим в каталог', async (ids) => {
    for (const id of ids) await api.updateTask(id, { topic: topicId, subtopic: subIds });
  });
  const bulkTags = (tagIds, mode) => runBulk('Обновляем теги', async (ids) => {
    for (const id of ids) {
      const t = items.find((it) => (it.expand?.task?.id || it.task) === id)?.expand?.task;
      const existing = Array.isArray(t?.tags) ? t.tags : [];
      const nextTags = mode === 'replace' ? [...tagIds] : Array.from(new Set([...existing, ...tagIds]));
      await api.updateTask(id, { tags: nextTags });
    }
  });
  const bulkDifficulty = (d) => runBulk('Обновляем сложность', async (ids) => {
    for (const id of ids) await api.updateTask(id, { difficulty: d });
  });

  const assign = async () => {
    setBusy(true);
    try {
      const work = await api.createWorkFromListok(sheet, items);
      message.success('Создана работа из листка — настройте выдачу');
      navigate(route(R.WORK_EDITOR, { workId: work.id }));
    } catch (e) { console.error(e); message.error('Не удалось создать работу'); }
    finally { setBusy(false); }
  };

  const clone = async () => {
    setBusy(true);
    try {
      const copy = await api.cloneListok(sheet.id);
      message.success('Лист скопирован в «Мои листки»');
      navigate(R.LISTOK_EDIT.replace(':sheetId', copy.id));
    } catch (e) { console.error(e); message.error('Не удалось склонировать'); }
    finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>;
  if (!sheet) return null;

  if (printMode) return <ListokPrint sheet={sheet} problems={problems} onBack={() => setPrintMode(false)} />;

  const isOfficial = sheet.kind === 'official';

  return (
    <div className="listok-view">
      <div className="listok-toolbar">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(R.LISTKI)}>К листкам</Button>
        <div style={{ flex: 1 }} />
        <Button icon={<PrinterOutlined />} onClick={() => setPrintMode(true)}>Печать / PDF</Button>
        <Tooltip title="Создать работу из задач листка и выдать ученикам">
          <Button icon={<SendOutlined />} loading={busy} onClick={assign}>Выдать ученику</Button>
        </Tooltip>
        {canEdit && (
          <Tooltip title="Править задачи: редактор по ✏️ и массовое изменение тем/тегов/сложности">
            <Button
              icon={<FormOutlined />}
              type={editMode ? 'primary' : 'default'}
              onClick={() => (editMode ? exitEditMode() : setEditMode(true))}
            >
              {editMode ? 'Готово' : 'Править задачи'}
            </Button>
          </Tooltip>
        )}
        {isOfficial && canEdit && (
          <Tooltip title="Скопировать в «Мои листки» для редактирования">
            <Button icon={<CopyOutlined />} loading={busy} onClick={clone}>В свои листки</Button>
          </Tooltip>
        )}
        {!isOfficial && canEdit && (
          <Button type="primary" icon={<EditOutlined />}
            onClick={() => navigate(R.LISTOK_EDIT.replace(':sheetId', sheet.id))}>Редактировать</Button>
        )}
      </div>

      <h1 className="listok-title">{sheet.title}</h1>
      <div className="listok-sub">
        {sheet.course && <span className="listok-badge">{COURSE_LABEL[sheet.course]}</span>}
        {isOfficial && <span className="listok-badge listok-badge--muted">Р. К. Гордин · 57 школа</span>}
        {sheet.source_url && <a href={sheet.source_url} target="_blank" rel="noreferrer">↗ источник</a>}
        {sheet.pdf_url && <a href={sheet.pdf_url} target="_blank" rel="noreferrer">↗ PDF части</a>}
      </div>

      {sheet.intro_md?.trim() && (
        <Collapse
          defaultActiveKey={isOfficial ? ['theory'] : []}
          className="listok-theory"
          items={[{
            key: 'theory',
            label: <span><ReadOutlined /> Теория и определения</span>,
            children: <div className="listok-md"><MathRenderer content={sheet.intro_md} /></div>,
          }]}
        />
      )}

      {editMode && (
        <Card
          size="small"
          style={{
            marginBottom: 12,
            background: selCount > 0 ? '#f0f5ff' : '#fafafa',
            borderColor: selCount > 0 ? '#adc6ff' : undefined,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space wrap>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onChange={(e) => selectAll(e.target.checked)}
                disabled={taskItems.length === 0}
              >
                Выбрать все задачи
              </Checkbox>
              {selCount > 0 ? (
                <>
                  <Tag color="blue">Выбрано: {selCount}</Tag>
                  <Button size="small" icon={<CloseOutlined />} onClick={clearSelection}>Снять</Button>
                </>
              ) : (
                <span style={{ color: '#8c8c8c', fontSize: 13 }}>
                  Отметьте задачи для массового изменения атрибутов · ✏️ — редактор задачи
                </span>
              )}
            </Space>
            {selCount > 0 && (
              <Button icon={<SettingOutlined />} onClick={() => setBulkOpen(true)}>Изменить атрибуты</Button>
            )}
          </div>
        </Card>
      )}

      <ol className="listok-problems">
        {problems.map((p) => p.type === 'heading' ? (
          <li key={p.id} className="listok-heading-row"><h3>{p.heading_text}</h3></li>
        ) : (
          <li key={p.id} className={`listok-problem${editMode ? ' listok-problem--edit' : ''}`}>
            {editMode && (
              <Checkbox
                className="listok-pcheck"
                checked={selected.has(p.taskId)}
                onChange={(e) => toggleSelect(p.taskId, e.target.checked)}
              />
            )}
            <div className="listok-pnum">
              {p.num || '•'}
              {p.flag === 'basic' && <span className="listok-flag listok-flag--basic" title="базовая / устная">°</span>}
              {p.flag === 'hard' && <span className="listok-flag listok-flag--hard" title="повышенной трудности">∗</span>}
            </div>
            <div className="listok-md listok-pbody">
              {editMode && !p.hasTopic && (
                <Tag color="orange" style={{ marginBottom: 4 }}>без темы</Tag>
              )}
              <MathRenderer content={p.statement} />
            </div>
            {editMode && p.taskId && (
              <Tooltip title="Редактировать задачу">
                <Button
                  className="listok-row-edit"
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openTaskEditor(p.taskId)}
                />
              </Tooltip>
            )}
          </li>
        ))}
      </ol>

      <TaskEditModal
        task={editingTask}
        visible={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={saveTask}
        allTags={tags}
        allSources={sources}
        allYears={years}
        allSubtopics={subtopics}
        allTopics={topics}
      />

      <ListokTaskBulkDrawer
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        count={selCount}
        loading={bulkLoading}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        onApplyMove={bulkMove}
        onApplyTags={bulkTags}
        onApplyDifficulty={bulkDifficulty}
        onClearSelection={clearSelection}
      />
    </div>
  );
}
