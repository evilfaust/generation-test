import dayjs from 'dayjs';
import { ClockCircleOutlined, PaperClipOutlined, CheckOutlined, FlagFilled } from '@ant-design/icons';
import { PAIRS, slotRangeFromCode, guessSlot } from '../lessonTime';
import { groupHex } from '../ui';
import { periodTitle } from './calendarUtils';
import { useCalendarCtx } from './CalendarContext';

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

// Какой паре принадлежит урок: по time_slot, иначе по времени старта (guessSlot).
function pairKeyForLesson(l, start) {
  const r = slotRangeFromCode(l.time_slot);
  if (r) {
    const hit = PAIRS.find((p) => p.full[0] === r[0] || (p.halves && (p.halves[0][0] === r[0] || p.halves[1][0] === r[0])));
    if (hit) return hit.key;
  }
  const g = guessSlot(start);
  return g.pair;
}

/**
 * Кастомный вид «Неделя» для react-big-calendar — сетка строк по парам школы
 * (PAIRS) вместо почасовой шкалы. Колонки — 7 дней. Сверху полоса «весь день»
 * для дедлайнов и дел. Клик по пустой ячейке пары → создание урока.
 */
export default function WeekByPairs({ date, events }) {
  const { onSelectEvent, onCreateInSlot, onToggleTodo } = useCalendarCtx();

  const days = WeekByPairs.range(date).map((d) => dayjs(d));
  const wkStart = days[0].startOf('day').valueOf();
  const wkEnd = days[6].endOf('day').valueOf();
  const weekEvents = events.filter((e) => {
    const t = +new Date(e.start);
    return t >= wkStart && t <= wkEnd;
  });

  const allDay = weekEvents.filter((e) => e.resource?.type !== 'lesson');
  const lessons = weekEvents.filter((e) => e.resource?.type === 'lesson');

  // lessons[dayIndex][pairKey] = [events]
  const grid = {};
  lessons.forEach((e) => {
    const start = new Date(e.start);
    const di = days.findIndex((d) => d.isSame(dayjs(start), 'day'));
    if (di < 0) return;
    const pk = pairKeyForLesson(e.resource.raw, start);
    if (!pk) return;
    (grid[`${di}:${pk}`] ||= []).push(e);
  });

  const today = dayjs();
  const cols = `66px repeat(7, minmax(0, 1fr))`;

  return (
    <div className="cw">
      {/* Заголовки дней */}
      <div className="cw-row cw-head" style={{ gridTemplateColumns: cols }}>
        <div className="cw-corner" />
        {days.map((d) => {
          const isToday = d.isSame(today, 'day');
          const weekend = d.day() === 0 || d.day() === 6;
          return (
            <div key={d.valueOf()} className={`cw-dayhead${weekend ? ' is-weekend' : ''}`}>
              <span className="cw-dow">{WD[(d.day() + 6) % 7]}</span>
              <span className={`cw-daynum${isToday ? ' is-today' : ''}`}>{d.date()}</span>
            </div>
          );
        })}
      </div>

      {/* Полоса «весь день» — дедлайны и дела */}
      <div className="cw-row cw-allday" style={{ gridTemplateColumns: cols }}>
        <div className="cw-timecell cw-allday-label">весь день</div>
        {days.map((d) => {
          const items = allDay.filter((e) => dayjs(e.start).isSame(d, 'day'));
          const weekend = d.day() === 0 || d.day() === 6;
          return (
            <div key={d.valueOf()} className={`cw-allday-cell${weekend ? ' is-weekend' : ''}`}>
              {items.map((e) => {
                const r = e.resource;
                if (r.type === 'todo') {
                  const accent = r.groupId ? groupHex(r.groupId).base : '#0D9488';
                  return (
                    <div key={e.id} className={`cw-ad cw-ad--todo${r.done ? ' is-done' : ''}`}
                      onClick={() => onSelectEvent(e)} role="button" tabIndex={0}>
                      <span className="cal-todo-check" role="checkbox" aria-checked={r.done}
                        style={{ borderColor: r.done ? '#B5BAC4' : accent, background: r.done ? accent : 'transparent' }}
                        onClick={(ev) => { ev.stopPropagation(); onToggleTodo(r.raw); }}>
                        {r.done && <CheckOutlined style={{ fontSize: 9, color: '#fff' }} />}
                      </span>
                      <span className="cal-chip-text">{e.title}</span>
                      {r.priority === 'high' && !r.done && <FlagFilled className="cal-flag" />}
                    </div>
                  );
                }
                return (
                  <div key={e.id} className="cw-ad cw-ad--deadline"
                    onClick={() => onSelectEvent(e)} role="button" tabIndex={0}>
                    <ClockCircleOutlined className="cal-chip-ico" />
                    <span className="cal-chip-text">{e.title}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Тайм-сетка по парам */}
      <div className="cw-grid">
        {PAIRS.map((p) => (
          <div key={p.key} className="cw-row cw-pairrow" style={{ gridTemplateColumns: cols }}>
            <div className="cw-timecell">
              <span className="cw-time">{p.full[0]}</span>
              <span className="cw-pairlabel">{p.label}</span>
            </div>
            {days.map((d, di) => {
              const cell = grid[`${di}:${p.key}`] || [];
              const weekend = d.day() === 0 || d.day() === 6;
              return (
                <div key={d.valueOf()}
                  className={`cw-cell${weekend ? ' is-weekend' : ''}${cell.length ? '' : ' is-empty'}`}
                  onClick={(e) => { if (e.target === e.currentTarget && !cell.length) onCreateInSlot(d.toDate(), p.key); }}>
                  {cell.map((e) => {
                    const r = e.resource;
                    const hex = groupHex(r.groupId);
                    const muted = r.status === 'done' || r.status === 'cancelled';
                    return (
                      <div key={e.id}
                        className={`cw-lesson${r.status === 'cancelled' ? ' is-cancelled' : ''}${r.status === 'done' ? ' is-done' : ''}`}
                        style={{ background: muted ? '#F6F7F9' : hex.soft, borderColor: muted ? '#E5E7EB' : hex.base }}
                        onClick={() => onSelectEvent(e)} role="button" tabIndex={0}>
                        <div className="cw-lesson-head">
                          <span className="cw-lesson-bar" style={{ background: muted ? '#C2C6CE' : hex.base }} />
                          <span className="cw-lesson-title">{e.title}</span>
                          {r.status === 'done' && <CheckOutlined className="cal-chip-tail" />}
                          {r.hasMaterials && r.status !== 'done' && <PaperClipOutlined className="cal-chip-tail" />}
                        </div>
                        <div className="cw-lesson-meta">
                          {dayjs(e.start).format('HH:mm')}{r.groupName ? ` · ${r.groupName}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Статика react-big-calendar для кастомного вида ──
WeekByPairs.range = (date) => {
  const start = dayjs(date).startOf('week');
  return Array.from({ length: 7 }, (_, i) => start.add(i, 'day').toDate());
};

WeekByPairs.navigate = (date, action) => {
  if (action === 'PREV') return dayjs(date).subtract(1, 'week').toDate();
  if (action === 'NEXT') return dayjs(date).add(1, 'week').toDate();
  return date;
};

WeekByPairs.title = (date) => periodTitle(date, 'week');
