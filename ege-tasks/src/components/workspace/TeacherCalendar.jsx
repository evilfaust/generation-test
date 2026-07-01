import { Children, cloneElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { App, Button, Segmented, Select, Tooltip } from 'antd';
import {
  CalendarOutlined, PlusOutlined, LeftOutlined, RightOutlined,
  LayoutOutlined, ColumnHeightOutlined, CompressOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import localeData from 'dayjs/plugin/localeData';
import weekday from 'dayjs/plugin/weekday';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { WorkspacePageHeader, groupHex } from './ui';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import LessonModal from './calendar/LessonModal';
import EventChip from './calendar/EventChip';
import WeekByPairs from './calendar/WeekByPairs';
import RightRail from './calendar/RightRail';
import EventInspector from './calendar/EventInspector';
import CreateEventModal from './calendar/CreateEventModal';
import RepeatLessonModal from './calendar/RepeatLessonModal';
import { CalendarContext, useCalendarCtx } from './calendar/CalendarContext';
import {
  buildEvents, sortMonthEvents, weekSummary, todayTodos, periodTitle,
} from './calendar/calendarUtils';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './TeacherCalendar.css';
import './calendar/calendar.css';

dayjs.extend(localeData);
dayjs.extend(weekday);
dayjs.extend(localizedFormat);
dayjs.locale('ru');

const localizer = dayjsLocalizer(dayjs);
const DnDCalendar = withDragAndDrop(Calendar);

const RU_MESSAGES = {
  date: 'Дата', time: 'Время', event: 'Событие', allDay: 'Весь день',
  week: 'Неделя', work_week: 'Раб. неделя', day: 'День', month: 'Месяц',
  previous: 'Назад', next: 'Вперёд', today: 'Сегодня', agenda: 'Список',
  noEventsInRange: 'Нет событий в этом периоде',
  showMore: (n) => `+ ещё ${n}`,
};

const VIEW_OPTIONS = [
  { value: Views.MONTH, label: 'Месяц' },
  { value: Views.WEEK, label: 'Неделя' },
  { value: Views.DAY, label: 'День' },
  { value: Views.AGENDA, label: 'Список' },
];

// Ячейка месяца с кнопкой быстрого создания (появляется на hover).
function MonthDateCell({ children, value }) {
  const { onCreateInSlot, canEdit } = useCalendarCtx();
  if (!canEdit) return children;
  const child = Children.only(children);
  return cloneElement(child, { className: `${child.props.className || ''} cal-monthcell` }, (
    <span className="cal-cell-add" title="Создать"
      onClick={(e) => { e.stopPropagation(); onCreateInSlot(value, null); }}>
      <PlusOutlined />
    </span>
  ));
}

export default function TeacherCalendar() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { canEdit, canDelete } = useAuth();

  const [groups, setGroups] = useState([]);
  const [works, setWorks] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [todos, setTodos] = useState([]);

  const [filters, setFilters] = useState({ lesson: true, deadline: true, todo: true });
  const [groupFilter, setGroupFilter] = useState(null);
  const [view, setView] = useState(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [density, setDensity] = useState('comfortable');
  const [showRail, setShowRail] = useState(true);

  const [selected, setSelected] = useState(null);       // событие в инспекторе
  const [modalOpen, setModalOpen] = useState(false);    // LessonModal
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [createState, setCreateState] = useState(null); // { type, day, pair } | null
  const [repeatBase, setRepeatBase] = useState(null);   // урок для «Повторить серией»
  const [repeating, setRepeating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, l, d, w, t] = await Promise.all([
        api.getTeachingGroups(),
        api.getLessons(),
        api.getSessionsWithDeadline(),
        api.getWorks(),
        api.getTodos(),
      ]);
      setGroups(g); setLessons(l); setDeadlines(d); setWorks(w); setTodos(t);
    } catch {
      message.error('Не удалось загрузить календарь');
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const events = useMemo(
    () => buildEvents({ lessons, deadlines, todos, filters, groupFilter }),
    [lessons, deadlines, todos, filters, groupFilter],
  );

  const summary = useMemo(
    () => weekSummary({ lessons, deadlines, todos, date }),
    [lessons, deadlines, todos, date],
  );
  const railTodos = useMemo(() => todayTodos(todos), [todos]);
  const counts = useMemo(() => ({
    lesson: lessons.filter((l) => !groupFilter || l.group === groupFilter).length,
    deadline: deadlines.length,
    todo: todos.filter((t) => !t.done && (!groupFilter || t.group === groupFilter)).length,
  }), [lessons, deadlines, todos, groupFilter]);

  // ── Переключение действий с делом (оптимистично) ──
  const toggleTodo = useCallback(async (todo) => {
    const next = !todo.done;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: next } : t)));
    try {
      if (next) await api.completeTodo(todo);
      else await api.updateTodo(todo.id, { done: false });
      load();
    } catch {
      message.error('Не удалось обновить дело');
      load();
    }
  }, [load, message]);

  const openInspector = useCallback((event) => setSelected(event), []);

  const openCreate = useCallback((day, pair) => {
    if (!canEdit) return;
    setCreateState({ type: 'lesson', day, pair });
  }, [canEdit]);

  // ── eventPropGetter: фон/класс обёртки по типу ──
  const eventPropGetter = useCallback((event) => {
    const r = event.resource || {};
    if (r.type === 'deadline') return { className: 'rbc-evt-deadline-soft' };
    if (r.type === 'todo') return { className: `rbc-evt-todo${r.done ? ' is-done' : ''}` };
    const hex = groupHex(r.groupId || '');
    let cls = 'rbc-evt-lesson';
    if (r.status === 'done') cls += ' rbc-evt-done';
    else if (r.status === 'cancelled') cls += ' rbc-evt-cancelled';
    else {
      const now = Date.now();
      if (now >= +event.start && now <= +event.end) cls += ' is-now';
    }
    const style = (r.status === 'cancelled')
      ? undefined
      : { backgroundColor: hex.base, borderColor: hex.base };
    return { className: cls, style };
  }, []);

  const dayPropGetter = useCallback((d) => {
    const wd = dayjs(d).day();
    if (wd === 0 || wd === 6) return { className: 'cal-weekend' };
    return {};
  }, []);

  // ── Drag-перенос (сохранён из прежнего календаря) ──
  const onEventDrop = useCallback(({ event, start }) => {
    if (!canEdit) return;
    const r = event.resource;
    if (r?.type === 'lesson') {
      setLessons((prev) => prev.map((l) => (l.id === r.raw.id ? { ...l, date_plan: start.toISOString() } : l)));
      api.updateLesson(r.raw.id, { date_plan: start.toISOString() }).catch(() => { message.error('Не удалось перенести урок'); load(); });
    } else if (r?.type === 'deadline') {
      setDeadlines((prev) => prev.map((s) => (s.id === r.raw.id ? { ...s, deadline: start.toISOString() } : s)));
      api.updateSession(r.raw.id, { deadline: start.toISOString() }).catch(() => { message.error('Не удалось перенести дедлайн'); load(); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  const onSelectSlot = useCallback(({ start }) => { openCreate(start, null); }, [openCreate]);

  // ── Инспектор → правка ──
  const handleEditFromInspector = (event) => {
    const r = event.resource;
    setSelected(null);
    if (r.type === 'lesson') { setEditing(r.raw); setModalOpen(true); }
    else if (r.type === 'todo') { navigate('/app/todos'); }
  };

  const handleDeleteFromInspector = async (event) => {
    const r = event.resource;
    try {
      if (r.type === 'lesson') await api.deleteLesson(r.raw.id);
      else if (r.type === 'todo') await api.deleteTodo(r.raw.id);
      setSelected(null);
      load();
    } catch {
      message.error('Не удалось удалить');
    }
  };

  // ── LessonModal save/delete/note/material ──
  const handleSave = async (data, meta = {}) => {
    setSaving(true);
    try {
      let id;
      if (editing?.id) { await api.updateLesson(editing.id, data); id = editing.id; }
      else { const rec = await api.createLesson(data); id = rec.id; }
      // Витрина для ученика: no-op если группа урока — не курс.
      try { await api.syncLessonPublication(id, { published: meta.published !== false }); } catch (e) { console.error('syncLessonPublication', e?.message); }
      setModalOpen(false); setEditing(null); load();
    } catch {
      message.error('Не удалось сохранить урок');
    } finally {
      setSaving(false);
    }
  };

  // Серия занятий: создаём копии базового урока по расписанию + витрины для курса.
  const handleRepeat = async (payloads) => {
    setRepeating(true);
    try {
      for (const p of payloads) {
        // eslint-disable-next-line no-await-in-loop
        const rec = await api.createLesson(p);
        try {
          // eslint-disable-next-line no-await-in-loop
          await api.syncLessonPublication(rec.id, { published: true });
        } catch (e) { console.error('syncLessonPublication (series)', e?.message); }
      }
      message.success(`Создано занятий: ${payloads.length}`);
      setRepeatBase(null);
      load();
    } catch {
      message.error('Не удалось создать серию занятий');
    } finally {
      setRepeating(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!editing?.id) return;
    try {
      await api.deleteLesson(editing.id);
      setModalOpen(false); setEditing(null); load();
    } catch {
      message.error('Не удалось удалить урок');
    }
  };

  const handleOpenNote = async (lesson) => {
    try {
      const note = await api.getOrCreateLessonNote(lesson);
      navigate(`/app/notes?note=${note.id}`);
    } catch {
      message.error('Не удалось открыть заметку урока');
    }
  };

  const handleOpenMaterial = (workId) => {
    setModalOpen(false);
    navigate(`/app/works/${workId}/edit`);
  };

  const handleOpenWork = (workId) => {
    setSelected(null);
    navigate(`/app/works/${workId}/edit`);
  };

  const handleOpenNoteById = (noteId) => {
    setSelected(null);
    navigate(`/app/notes?note=${noteId}`);
  };

  // ── Навигация периода ──
  const navPeriod = (dir) => {
    const unit = view === Views.WEEK ? 'week' : view === Views.DAY ? 'day' : 'month';
    setDate((d) => (dir === 0 ? new Date() : dayjs(d)[dir > 0 ? 'add' : 'subtract'](1, unit).toDate()));
  };

  const ctx = useMemo(() => ({
    onToggleTodo: toggleTodo,
    onSelectEvent: openInspector,
    onCreateInSlot: openCreate,
    canEdit,
    density,
  }), [toggleTodo, openInspector, openCreate, canEdit, density]);

  const components = useMemo(() => ({
    event: EventChip,
    dateCellWrapper: MonthDateCell,
  }), []);

  const minHeight = density === 'compact' ? 96 : 118;

  return (
    <CalendarContext.Provider value={ctx}>
      <WorkspacePageHeader
        icon={<CalendarOutlined />}
        accent="blue"
        title="Календарь"
        subtitle="Уроки · дедлайны · дела на одной сетке"
        extra={(
          <>
            <Select
              allowClear style={{ minWidth: 160 }} placeholder="Все группы"
              value={groupFilter} onChange={setGroupFilter}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
            <Tooltip title={density === 'comfortable' ? 'Компактная сетка' : 'Просторная сетка'}>
              <Button icon={density === 'comfortable' ? <CompressOutlined /> : <ColumnHeightOutlined />}
                onClick={() => setDensity((x) => (x === 'comfortable' ? 'compact' : 'comfortable'))} />
            </Tooltip>
            <Tooltip title={showRail ? 'Скрыть панель' : 'Показать панель'}>
              <Button icon={<LayoutOutlined />} type={showRail ? 'default' : 'text'}
                onClick={() => setShowRail((x) => !x)} />
            </Tooltip>
            {canEdit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateState({ type: 'lesson', day: date, pair: null })}>
                Создать
              </Button>
            )}
          </>
        )}
      />

      {/* Toolbar */}
      <div className="cal-toolbar">
        <div className="cal-nav">
          <Button onClick={() => navPeriod(0)}>Сегодня</Button>
          <Button icon={<LeftOutlined />} onClick={() => navPeriod(-1)} />
          <Button icon={<RightOutlined />} onClick={() => navPeriod(1)} />
        </div>
        <div className="cal-period">{periodTitle(date, view === Views.WEEK ? 'week' : view === Views.DAY ? 'day' : 'month')}</div>
        <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} />
      </div>

      <div className={`cal-layout${showRail ? '' : ' no-rail'}`}>
        <div className="cal-main teacher-calendar-wrap" style={{ '--cal-cell-min': `${minHeight}px` }}>
          <DnDCalendar
            localizer={localizer}
            events={events}
            messages={RU_MESSAGES}
            culture="ru"
            views={{ month: true, week: WeekByPairs, day: true, agenda: true }}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            toolbar={false}
            popup
            selectable={canEdit}
            resizable={false}
            onEventDrop={onEventDrop}
            onSelectSlot={onSelectSlot}
            onSelectEvent={openInspector}
            eventPropGetter={eventPropGetter}
            dayPropGetter={dayPropGetter}
            components={components}
            draggableAccessor={() => canEdit}
            dayLayoutAlgorithm="no-overlap"
            allDayAccessor="allDay"
            style={{ height: 'calc(100vh - 250px)', minHeight: 520 }}
          />
        </div>

        {showRail && (
          <RightRail
            summary={summary}
            filters={filters}
            setFilters={setFilters}
            counts={counts}
            groups={groups}
            groupFilter={groupFilter}
            setGroupFilter={setGroupFilter}
            today={railTodos}
            onToggleTodo={toggleTodo}
            onSelectTodo={(t) => openInspector({ id: `td_${t.id}`, title: t.title, resource: { type: 'todo', raw: t, groupId: t.group || '', groupName: t.expand?.group?.name, done: !!t.done, priority: t.priority } })}
            onCreateTodo={() => setCreateState({ type: 'todo', day: new Date(), pair: null })}
            canEdit={canEdit}
          />
        )}
      </div>

      <EventInspector
        event={selected}
        onClose={() => setSelected(null)}
        onEdit={handleEditFromInspector}
        onDelete={handleDeleteFromInspector}
        onToggleTodo={(t) => { toggleTodo(t); setSelected(null); }}
        onOpenWork={handleOpenWork}
        onOpenNote={handleOpenNoteById}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <CreateEventModal
        open={!!createState}
        type={createState?.type}
        day={createState?.day}
        pair={createState?.pair}
        groups={groups}
        works={works}
        onClose={() => setCreateState(null)}
        onCreated={load}
      />

      <LessonModal
        open={modalOpen}
        initial={editing}
        groups={groups}
        saving={saving}
        works={works}
        canEdit={canEdit}
        onSave={handleSave}
        onDelete={handleDeleteLesson}
        onOpenNote={handleOpenNote}
        onOpenMaterial={handleOpenMaterial}
        onRepeat={(lesson) => { setModalOpen(false); setEditing(null); setRepeatBase(lesson); }}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
      />

      <RepeatLessonModal
        open={!!repeatBase}
        base={repeatBase}
        groups={groups}
        saving={repeating}
        onConfirm={handleRepeat}
        onCancel={() => setRepeatBase(null)}
      />
    </CalendarContext.Provider>
  );
}
