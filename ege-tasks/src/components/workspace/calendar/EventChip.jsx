import {
  ClockCircleOutlined, PaperClipOutlined, CheckOutlined, FlagFilled,
} from '@ant-design/icons';
import { groupHex } from '../ui';
import { useCalendarCtx } from './CalendarContext';

/**
 * Кастомный рендер события месяца/недели для react-big-calendar.
 * Цвет/фон обёртки задаёт eventPropGetter; здесь — внутреннее содержимое
 * под тип события (урок · дедлайн · дело с интерактивным чекбоксом).
 */
export default function EventChip({ event }) {
  const { onToggleTodo } = useCalendarCtx();
  const r = event.resource || {};

  if (r.type === 'todo') {
    const done = r.done;
    const accent = r.groupId ? groupHex(r.groupId).base : '#0D9488';
    return (
      <span className={`cal-chip cal-chip--todo${done ? ' is-done' : ''}`}>
        <span
          className="cal-todo-check"
          role="checkbox"
          aria-checked={done}
          tabIndex={0}
          style={{ borderColor: done ? '#B5BAC4' : accent, background: done ? accent : 'transparent' }}
          onClick={(e) => { e.stopPropagation(); onToggleTodo(r.raw); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleTodo(r.raw); } }}
        >
          {done && <CheckOutlined style={{ fontSize: 9, color: '#fff' }} />}
        </span>
        <span className="cal-chip-text">{event.title}</span>
        {r.priority === 'high' && !done && <FlagFilled className="cal-flag" />}
      </span>
    );
  }

  if (r.type === 'deadline') {
    return (
      <span className="cal-chip cal-chip--deadline">
        <ClockCircleOutlined className="cal-chip-ico" />
        <span className="cal-chip-text">{event.title}</span>
      </span>
    );
  }

  // Урок
  const status = r.status;
  const tail = status === 'done'
    ? <CheckOutlined className="cal-chip-tail" />
    : (r.hasMaterials ? <PaperClipOutlined className="cal-chip-tail" /> : null);
  return (
    <span className="cal-chip cal-chip--lesson">
      <span className="cal-chip-text">{event.title}</span>
      {tail}
    </span>
  );
}
