import { LeftOutlined, RightOutlined } from '@ant-design/icons';

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/**
 * Навигатор недели в шапке «Сегодня».
 * weekStart/selectedDate — dayjs; countByDay — Map 'YYYY-MM-DD' → число уроков.
 */
export default function WeekNavigator({ weekStart, selectedDate, today, countByDay, onPrev, onNext, onSelectDay }) {
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
  return (
    <div className="td-weeknav">
      <button type="button" className="td-weeknav__arrow" aria-label="Предыдущая неделя" onClick={onPrev}>
        <LeftOutlined />
      </button>
      {days.map((d) => {
        const key = d.format('YYYY-MM-DD');
        const count = countByDay.get(key) || 0;
        const isToday = d.isSame(today, 'day');
        const isSel = d.isSame(selectedDate, 'day');
        let cls = 'td-weeknav__day';
        if (isToday) cls += ' td-weeknav__day--today';
        else if (isSel) cls += ' td-weeknav__day--sel';
        else if (!count) cls += ' td-weeknav__day--empty';
        const dot = isToday ? 'rgba(255,255,255,.7)' : (count ? 'var(--accent)' : 'transparent');
        return (
          <button type="button" key={key} className={cls} onClick={() => onSelectDay(d)}>
            <span className="td-weeknav__d">{WD[d.day()]}</span>
            <span className="td-weeknav__n">{d.date()}</span>
            <span className="td-weeknav__dot" style={{ background: dot }} />
          </button>
        );
      })}
      <button type="button" className="td-weeknav__arrow" aria-label="Следующая неделя" onClick={onNext}>
        <RightOutlined />
      </button>
    </div>
  );
}
