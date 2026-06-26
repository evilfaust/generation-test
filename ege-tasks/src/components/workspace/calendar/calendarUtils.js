/**
 * Утилиты редизайна календаря «Моё пространство».
 * Единый источник построения событий трёх типов (урок · дедлайн · дело) и
 * производных метрик для правого рейла.
 */
import dayjs from 'dayjs';
import { endForLesson } from '../lessonTime';

// Порядок типов в ячейке месяца: дедлайн → урок → дело.
export const TYPE_ORDER = { deadline: 0, lesson: 1, todo: 2 };

// Заголовок дедлайна из связанной сущности.
export function deadlineTitle(s) {
  return s.expand?.work?.title
    || s.student_title
    || s.expand?.mc_test?.title
    || s.expand?.trig_mc_test?.title
    || 'Работа';
}

// Урок → RBC-событие.
export function lessonToEvent(l) {
  const start = new Date(l.date_plan);
  const hasMaterials = Array.isArray(l.materials) && l.materials.length > 0;
  return {
    id: l.id,
    title: l.title,
    start,
    end: endForLesson(l, start),
    resource: {
      type: 'lesson',
      raw: l,
      groupId: l.group || '',
      groupName: l.expand?.group?.name,
      status: l.status || 'planned',
      hasMaterials,
    },
  };
}

// Дедлайн выдачи → all-day событие.
export function deadlineToEvent(s) {
  const start = new Date(s.deadline);
  return {
    id: `dl_${s.id}`,
    title: deadlineTitle(s),
    start,
    end: start,
    allDay: true,
    resource: { type: 'deadline', raw: s, groupId: '' },
  };
}

// Дело (только с due_date) → all-day событие.
export function todoToEvent(t) {
  if (!t.due_date) return null;
  const start = new Date(t.due_date);
  return {
    id: `td_${t.id}`,
    title: t.title,
    start,
    end: start,
    allDay: true,
    resource: {
      type: 'todo',
      raw: t,
      groupId: t.group || '',
      groupName: t.expand?.group?.name,
      done: !!t.done,
      priority: t.priority || 'normal',
    },
  };
}

/**
 * Собрать события под текущие фильтры.
 * filters: { lesson, deadline, todo } (bool), groupFilter: id|null.
 */
export function buildEvents({ lessons, deadlines, todos, filters, groupFilter }) {
  const out = [];
  if (filters.lesson) {
    lessons
      .filter((l) => !groupFilter || l.group === groupFilter)
      .forEach((l) => out.push(lessonToEvent(l)));
  }
  if (filters.deadline) {
    // У дедлайна нет группы — фильтр по группе его не прячет (как и раньше).
    deadlines.forEach((s) => out.push(deadlineToEvent(s)));
  }
  if (filters.todo) {
    todos
      .filter((t) => !groupFilter || t.group === groupFilter)
      .forEach((t) => { const e = todoToEvent(t); if (e) out.push(e); });
  }
  return out;
}

// Сортировка событий внутри ячейки месяца: deadline → lesson → todo, затем время.
export function sortMonthEvents(a, b) {
  const ta = TYPE_ORDER[a.resource?.type] ?? 9;
  const tb = TYPE_ORDER[b.resource?.type] ?? 9;
  if (ta !== tb) return ta - tb;
  return a.start - b.start;
}

// Метрики правого рейла за неделю, в которую попадает `date`.
export function weekSummary({ lessons, deadlines, todos, date }) {
  const start = dayjs(date).startOf('week');
  const end = dayjs(date).endOf('week');
  const inWeek = (iso) => {
    const d = dayjs(iso);
    return d.isAfter(start) && d.isBefore(end);
  };
  const lessonsCount = lessons.filter((l) => inWeek(l.date_plan)).length;
  const deadlinesCount = deadlines.filter((s) => inWeek(s.deadline)).length;
  const todosOpen = todos.filter((t) => !t.done).length;

  // «Требует внимания» = просроченные невыполненные дела + дедлайны на сегодня.
  const today = dayjs();
  const overdueTodos = todos.filter((t) => !t.done && t.due_date
    && dayjs(t.due_date).isBefore(today, 'day')).length;
  const deadlinesToday = deadlines.filter((s) => dayjs(s.deadline).isSame(today, 'day')).length;
  const attention = overdueTodos + deadlinesToday;

  return { lessonsCount, deadlinesCount, todosOpen, attention };
}

// Дела на сегодня и просроченные (для блока рейла), отсортированы по сроку.
export function todayTodos(todos) {
  const end = dayjs().endOf('day');
  return todos
    .filter((t) => !t.done && t.due_date && dayjs(t.due_date).isBefore(end))
    .sort((a, b) => dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf());
}

// Подпись чипа срока дела относительно сегодня.
export function dueChip(due) {
  if (!due) return null;
  const d = dayjs(due);
  const today = dayjs();
  if (d.isSame(today, 'day')) return { tone: 'blue', label: 'сегодня' };
  if (d.isBefore(today, 'day')) {
    const days = today.startOf('day').diff(d.startOf('day'), 'day');
    return { tone: 'rose', label: `−${days} дн` };
  }
  return { tone: 'neutral', label: d.format('D MMM') };
}

// Заголовок периода для тулбара по активному виду.
export function periodTitle(date, view) {
  const d = dayjs(date);
  if (view === 'week') {
    const start = d.startOf('week');
    const end = d.endOf('week');
    if (start.month() === end.month()) {
      return `${start.date()}–${end.date()} ${end.format('MMMM YYYY')}`;
    }
    return `${start.format('D MMM')} – ${end.format('D MMM YYYY')}`;
  }
  if (view === 'day') return d.format('D MMMM YYYY');
  return d.format('MMMM YYYY');
}
