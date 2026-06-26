import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App, Button, Checkbox, DatePicker, Dropdown, Input, Segmented, Spin, Tooltip,
} from 'antd';
import {
  CheckSquareOutlined, DeleteOutlined, PlusOutlined, FlagFilled, FlagOutlined,
  FileTextOutlined, HolderOutlined, MoreOutlined, InboxOutlined, FolderOutlined,
  CalendarOutlined, EditOutlined, SyncOutlined, TeamOutlined, BookOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { WorkspacePageHeader, EmptyState, GroupChip, Chip } from './ui';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import TodoLinkModal from './todos/TodoLinkModal';
import FolderModal from './todos/FolderModal';
import './TodosPage.css';

const REPEAT_LABEL = { daily: 'кажд. день', weekly: 'кажд. неделю', monthly: 'кажд. месяц' };

function dueBucket(due) {
  if (!due) return { key: 'none', label: 'Без срока', order: 3 };
  const d = dayjs(due);
  if (d.isBefore(dayjs(), 'day')) return { key: 'overdue', label: 'Просрочено', order: 0 };
  if (d.isSame(dayjs(), 'day')) return { key: 'today', label: 'Сегодня', order: 1 };
  return { key: 'later', label: 'Позже', order: 2 };
}

// Переместить дело fromId на позицию перед toId (для drag-порядка).
function moveBefore(list, fromId, toId) {
  if (fromId === toId) return list;
  const arr = [...list];
  const fi = arr.findIndex((x) => x.id === fromId);
  if (fi < 0) return list;
  const [m] = arr.splice(fi, 1);
  const ti = arr.findIndex((x) => x.id === toId);
  if (ti < 0) return list;
  arr.splice(ti, 0, m);
  return arr;
}

export default function TodosPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { canEdit, canDelete } = useAuth();

  const [todos, setTodos] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState('today'); // today | all | inbox | f:<id>
  const [draft, setDraft] = useState('');
  const [draftDue, setDraftDue] = useState(null);
  const [adding, setAdding] = useState(false);
  const [linkModal, setLinkModal] = useState(null); // { todo, type }
  const [folderModal, setFolderModal] = useState(null); // { folder } | { } (new) | null
  const titleTimers = useRef({});
  const dragId = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, fl] = await Promise.all([api.getTodos(), api.getTodoFolders()]);
      setTodos(list);
      setFolders(fl);
    } catch {
      message.error('Не удалось загрузить дела');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const folderId = scope.startsWith('f:') ? scope.slice(2) : null;
  const activeFolder = folders.find((f) => f.id === folderId) || null;

  // Счётчики открытых дел по областям.
  const counts = useMemo(() => {
    const open = todos.filter((t) => !t.done);
    const today = open.filter((t) => t.due_date && dayjs(t.due_date).isBefore(dayjs().endOf('day'))).length;
    const inbox = open.filter((t) => !t.folder).length;
    const byFolder = {};
    open.forEach((t) => { if (t.folder) byFolder[t.folder] = (byFolder[t.folder] || 0) + 1; });
    return { today, all: open.length, inbox, byFolder };
  }, [todos]);

  // Дела текущей области.
  const scoped = useMemo(() => {
    if (scope === 'today') {
      return todos.filter((t) => !t.done && t.due_date
        && dayjs(t.due_date).isBefore(dayjs().endOf('day')));
    }
    if (scope === 'inbox') return todos.filter((t) => !t.folder);
    if (folderId) return todos.filter((t) => t.folder === folderId);
    return todos; // all
  }, [todos, scope, folderId]);

  const isToday = scope === 'today';
  const draggable = !isToday && canEdit;

  // Открытые/сделанные + секции «Сегодня».
  const { sections, openIds } = useMemo(() => {
    const open = scoped.filter((t) => !t.done);
    const done = scoped.filter((t) => t.done);
    if (isToday) {
      const buckets = new Map();
      open.forEach((t) => {
        const b = dueBucket(t.due_date);
        if (!buckets.has(b.key)) buckets.set(b.key, { ...b, items: [] });
        buckets.get(b.key).items.push(t);
      });
      const out = [...buckets.values()].sort((a, b) => a.order - b.order);
      out.forEach((s) => s.items.sort((a, b) => dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf()));
      return { sections: out, openIds: open.map((t) => t.id) };
    }
    const out = [];
    if (open.length) out.push({ key: 'open', label: null, items: open, drag: true });
    if (done.length) out.push({ key: 'done', label: 'Сделано', items: done });
    return { sections: out, openIds: open.map((t) => t.id) };
  }, [scoped, isToday]);

  const handleAdd = async () => {
    const title = draft.trim();
    if (!title) return;
    setAdding(true);
    try {
      const due = draftDue || (isToday ? dayjs() : null);
      const rec = await api.createTodo({
        title,
        due_date: due ? due.toISOString() : '',
        folder: folderId || '',
      });
      setTodos((prev) => [rec, ...prev]);
      setDraft('');
      setDraftDue(null);
    } catch {
      message.error('Не удалось добавить');
    } finally {
      setAdding(false);
    }
  };

  const patch = useCallback(async (id, data, optimistic) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...(optimistic || data) } : t)));
    try {
      const rec = await api.updateTodo(id, data);
      setTodos((prev) => prev.map((t) => (t.id === id ? rec : t)));
    } catch {
      message.error('Не удалось сохранить');
    }
  }, [message]);

  // Отметка done с учётом повтора (создаёт следующий экземпляр).
  const toggleDone = async (t) => {
    if (t.done) { patch(t.id, { done: false }); return; }
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: true } : x)));
    try {
      const { updated, next } = await api.completeTodo(t);
      setTodos((prev) => {
        let list = prev.map((x) => (x.id === t.id ? updated : x));
        if (next) list = [next, ...list];
        return list;
      });
      if (next) message.success(`Повтор: создано на ${dayjs(next.due_date).format('DD.MM')}`);
    } catch {
      message.error('Не удалось сохранить');
      setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: false } : x)));
    }
  };

  const togglePriority = (t) => patch(t.id, { priority: t.priority === 'high' ? 'normal' : 'high' });
  const changeDue = (t, d) => patch(t.id, { due_date: d ? d.toISOString() : '' });

  const changeTitle = (id, title) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    clearTimeout(titleTimers.current[id]);
    titleTimers.current[id] = setTimeout(() => {
      api.updateTodo(id, { title }).catch(() => {});
    }, 600);
  };

  const handleDelete = (id) => {
    modal.confirm({
      title: 'Удалить дело?', okText: 'Удалить', cancelText: 'Отмена', okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.deleteTodo(id);
          setTodos((prev) => prev.filter((t) => t.id !== id));
        } catch { message.error('Не удалось удалить'); }
      },
    });
  };

  // ⋯-меню дела: перенос / повтор / привязка / удаление.
  const handleRowMenu = (t, key) => {
    if (key.startsWith('snooze:')) {
      const k = key.slice(7);
      const map = { today: dayjs(), tomorrow: dayjs().add(1, 'day'), week: dayjs().add(1, 'week'), none: null };
      changeDue(t, map[k]);
    } else if (key.startsWith('repeat:')) {
      const r = key.slice(7);
      patch(t.id, { repeat: r === 'none' ? '' : r });
    } else if (key.startsWith('link:')) {
      setLinkModal({ todo: t, type: key.slice(5) });
    } else if (key === 'delete') {
      handleDelete(t.id);
    } else if (key.startsWith('move:')) {
      const fid = key.slice(5);
      const folder = folders.find((f) => f.id === fid);
      patch(t.id, { folder: fid }, { folder: fid, expand: { ...(t.expand || {}), folder } });
    }
  };

  const rowMenuItems = (t) => [
    {
      key: 'snooze', icon: <CalendarOutlined />, label: 'Перенести', children: [
        { key: 'snooze:today', label: 'Сегодня' },
        { key: 'snooze:tomorrow', label: 'Завтра' },
        { key: 'snooze:week', label: 'Через неделю' },
        { key: 'snooze:none', label: 'Без срока' },
      ],
    },
    {
      key: 'repeat', icon: <SyncOutlined />, label: 'Повтор', children: [
        { key: 'repeat:none', label: 'Нет' },
        { key: 'repeat:daily', label: 'Ежедневно' },
        { key: 'repeat:weekly', label: 'Еженедельно' },
        { key: 'repeat:monthly', label: 'Ежемесячно' },
      ],
    },
    {
      key: 'link', icon: <BookOutlined />, label: 'Привязать', children: [
        { key: 'link:student', label: 'Ученика…' },
        { key: 'link:lesson', label: 'Урок…' },
        { key: 'link:work', label: 'Работу…' },
      ],
    },
    ...(folders.length ? [{
      key: 'move', icon: <FolderOutlined />, label: 'В папку', children: [
        { key: 'move:', label: 'Входящие' },
        ...folders.map((f) => ({ key: `move:${f.id}`, label: f.name })),
      ],
    }] : []),
    { type: 'divider' },
    ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Удалить', danger: true }] : []),
  ];

  const applyLink = (type, picked) => {
    const t = linkModal?.todo;
    setLinkModal(null);
    if (!t) return;
    patch(t.id, { [type]: picked?.id || '' });
  };

  // Drag-порядок (нативный, только в списках-папках/Все/Входящие).
  const onDragEnter = (overId) => () => {
    if (!dragId.current || dragId.current === overId) return;
    setTodos((prev) => moveBefore(prev, dragId.current, overId));
  };
  const onDragEnd = () => {
    dragId.current = null;
    if (openIds.length > 1) api.reorderTodos(openIds).catch(() => {});
  };

  const renderLinks = (t) => {
    const out = [];
    if (t.expand?.folder && scope !== `f:${t.folder}`) {
      out.push(<Chip key="fl" tone={t.expand.folder.color || 'neutral'} dot>{t.expand.folder.name}</Chip>);
    }
    if (t.expand?.group) out.push(<GroupChip key="g" id={t.group} name={t.expand.group.name} />);
    if (t.repeat) out.push(<span key="r" className="todo-row__badge"><SyncOutlined /> {REPEAT_LABEL[t.repeat]}</span>);
    if (t.expand?.student) {
      out.push(<button key="st" type="button" className="todo-row__source"
        onClick={() => navigate(`/app/students/${t.student}`)}><TeamOutlined /> {t.expand.student.name || t.expand.student.username}</button>);
    }
    if (t.expand?.lesson) {
      out.push(<button key="ls" type="button" className="todo-row__source"
        onClick={() => navigate('/app/calendar')}><CalendarOutlined /> {t.expand.lesson.title || 'урок'}</button>);
    }
    if (t.expand?.work) {
      out.push(<button key="wk" type="button" className="todo-row__source"
        onClick={() => navigate(`/app/works/${t.work}/edit`)}><BookOutlined /> {t.expand.work.title || 'работа'}</button>);
    }
    if (t.expand?.source_note) {
      out.push(<button key="sn" type="button" className="todo-row__source"
        onClick={() => navigate(`/app/notes?note=${t.source_note}`)}><FileTextOutlined /> {t.expand.source_note.title?.trim() || 'заметка'}</button>);
    }
    return out;
  };

  const renderRow = (t, canDrag) => {
    const overdue = t.due_date && !t.done && dayjs(t.due_date).isBefore(dayjs(), 'day');
    return (
      <div
        key={t.id}
        className={`todo-row${t.done ? ' todo-row--done' : ''}`}
        draggable={canDrag}
        onDragStart={canDrag ? () => { dragId.current = t.id; } : undefined}
        onDragEnter={canDrag ? onDragEnter(t.id) : undefined}
        onDragOver={canDrag ? (e) => e.preventDefault() : undefined}
        onDragEnd={canDrag ? onDragEnd : undefined}
      >
        {canDrag && <HolderOutlined className="todo-row__handle" />}
        <Checkbox checked={t.done} onChange={() => toggleDone(t)} disabled={!canEdit} />
        <div className="todo-row__main">
          <Input
            variant="borderless"
            className="todo-row__title"
            value={t.title}
            onChange={(e) => changeTitle(t.id, e.target.value)}
            disabled={!canEdit}
          />
          {(() => { const links = renderLinks(t); return links.length
            ? <div className="todo-row__meta">{links}</div> : null; })()}
        </div>
        <div className="todo-row__actions">
          {t.priority === 'high' && (
            <Tooltip title="Важное">
              <Button type="text" size="small" icon={<FlagFilled style={{ color: 'var(--c-rose)' }} />}
                onClick={() => togglePriority(t)} />
            </Tooltip>
          )}
          <DatePicker
            size="small" variant="borderless" format="DD.MM"
            placeholder="срок"
            value={t.due_date ? dayjs(t.due_date) : null}
            onChange={(d) => changeDue(t, d)}
            disabled={!canEdit}
            className={`todo-row__due${overdue ? ' todo-row__due--overdue' : ''}`}
          />
          {canEdit && (
            <Dropdown trigger={['click']} menu={{ items: rowMenuItems(t), onClick: ({ key }) => handleRowMenu(t, key) }}>
              <Button type="text" size="small" icon={<MoreOutlined />} className="todo-row__more" />
            </Dropdown>
          )}
        </div>
      </div>
    );
  };

  // ── Папки: создание/правка/удаление ──
  const submitFolder = async ({ name, color }) => {
    try {
      if (folderModal?.folder) {
        const upd = await api.updateTodoFolder(folderModal.folder.id, { name, color });
        setFolders((prev) => prev.map((f) => (f.id === upd.id ? upd : f)));
      } else {
        const rec = await api.createTodoFolder({ name, color, sort_order: folders.length * 10 });
        setFolders((prev) => [...prev, rec]);
      }
      setFolderModal(null);
    } catch { message.error('Не удалось сохранить папку'); }
  };

  const deleteFolder = (f) => {
    modal.confirm({
      title: `Удалить папку «${f.name}»?`,
      content: 'Дела из папки не удалятся — они переедут во «Входящие».',
      okText: 'Удалить', cancelText: 'Отмена', okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.deleteTodoFolder(f.id);
          setFolders((prev) => prev.filter((x) => x.id !== f.id));
          setTodos((prev) => prev.map((t) => (t.folder === f.id ? { ...t, folder: '', expand: { ...(t.expand || {}), folder: undefined } } : t)));
          if (scope === `f:${f.id}`) setScope('all');
        } catch { message.error('Не удалось удалить'); }
      },
    });
  };

  const scopeTitle = isToday ? 'Сегодня' : scope === 'all' ? 'Все дела' : scope === 'inbox' ? 'Входящие' : activeFolder?.name || '';

  const navItem = (key, icon, label, count) => (
    <button type="button" className={`todo-nav__item${scope === key ? ' is-active' : ''}`} onClick={() => setScope(key)}>
      <span className="todo-nav__icon">{icon}</span>
      <span className="todo-nav__label">{label}</span>
      {count > 0 && <span className="todo-nav__count">{count}</span>}
    </button>
  );

  return (
    <div className="todos-page2">
      <WorkspacePageHeader
        icon={<CheckSquareOutlined />}
        accent="teal"
        title="Дела"
        subtitle="Личный список дел учителя — папки, сроки, привязки и повторы"
      />

      <div className="todos-layout">
        {/* ── Левая колонка: папки и смарт-списки ── */}
        <div className="todo-nav">
          {navItem('today', <CalendarOutlined />, 'Сегодня', counts.today)}
          {navItem('all', <CheckSquareOutlined />, 'Все дела', counts.all)}
          {navItem('inbox', <InboxOutlined />, 'Входящие', counts.inbox)}

          <div className="todo-nav__head">
            <span>Папки</span>
            {canEdit && (
              <Tooltip title="Новая папка">
                <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setFolderModal({})} />
              </Tooltip>
            )}
          </div>
          {folders.map((f) => (
            <div key={f.id} className={`todo-nav__item todo-nav__item--folder${scope === `f:${f.id}` ? ' is-active' : ''}`}>
              <button type="button" className="todo-nav__folderbtn" onClick={() => setScope(`f:${f.id}`)}>
                <span className="todo-nav__dot" style={{ background: `var(--c-${f.color === 'neutral' ? 'blue' : (f.color || 'blue')})`, opacity: f.color === 'neutral' ? 0.4 : 1 }} />
                <span className="todo-nav__label">{f.name}</span>
                {counts.byFolder[f.id] > 0 && <span className="todo-nav__count">{counts.byFolder[f.id]}</span>}
              </button>
              {canEdit && (
                <span className="todo-nav__folderactions">
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setFolderModal({ folder: f })} />
                  <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => deleteFolder(f)} />
                </span>
              )}
            </div>
          ))}
          {folders.length === 0 && <div className="todo-nav__hint">Папок пока нет</div>}
        </div>

        {/* ── Правая колонка: список ── */}
        <div className="todos-main">
          <div className="todos-main__head">
            <h3 className="todos-main__title">{scopeTitle}</h3>
          </div>

          {canEdit && (
            <div className="todos-add">
              <Input
                placeholder={folderId ? `Новое дело в «${activeFolder?.name}»…` : 'Новое дело…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPressEnter={handleAdd}
                allowClear
              />
              <DatePicker format="DD.MM.YYYY" placeholder="Срок" value={draftDue} onChange={setDraftDue} />
              <Button type="primary" icon={<PlusOutlined />} loading={adding} onClick={handleAdd}>Добавить</Button>
            </div>
          )}

          <div className="todos-list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : sections.length === 0 ? (
              <EmptyState
                title={isToday ? 'На сегодня дел нет' : 'Дел нет'}
                description={canEdit ? 'Добавьте дело выше или выгрузите чек-лист из заметки' : undefined}
              />
            ) : (
              sections.map((s) => (
                <div key={s.key} className={`todos-section todos-section--${s.key}`}>
                  {s.label && <div className="todos-section__title">{s.label}<span className="todos-section__n">{s.items.length}</span></div>}
                  {s.items.map((t) => renderRow(t, draggable && s.drag))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <TodoLinkModal
        open={!!linkModal}
        type={linkModal?.type}
        current={linkModal ? linkModal.todo[linkModal.type] : null}
        onCancel={() => setLinkModal(null)}
        onPick={applyLink}
      />
      <FolderModal
        open={!!folderModal}
        folder={folderModal?.folder}
        onCancel={() => setFolderModal(null)}
        onSubmit={submitFolder}
      />
    </div>
  );
}
