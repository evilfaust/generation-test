import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Spin } from 'antd';
import {
  DownloadOutlined, LinkOutlined, PlayCircleOutlined, VideoCameraOutlined,
  ClockCircleOutlined, ReadOutlined, RightOutlined, FundProjectionScreenOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { api } from '../../shared/services/pocketbase';
import { slotRangeFromCode } from '../workspace/lessonTime';
import MathRenderer from '../MathRenderer';
import './StudentCoursePortal.css';

// Точный отсчёт до начала занятия (учитывает конец пары → «идёт сейчас»).
function untilLabel(pub, d) {
  if (!d) return '';
  const now = dayjs();
  const r = slotRangeFromCode(pub.time_slot);
  if (r) {
    const [eh, em] = r[1].split(':').map(Number);
    const end = d.hour(eh).minute(em);
    if (now.isAfter(end)) return 'Завершилось';
    if (!now.isBefore(d)) return 'Идёт сейчас';
  } else if (now.isAfter(d)) {
    return 'Завершилось';
  }
  const mins = d.diff(now, 'minute');
  if (mins < 1) return 'Вот-вот начнётся';
  if (mins < 60) return `Через ${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Через ${hours} ч ${mins % 60} мин`;
  const days = Math.floor(hours / 24);
  return `Через ${days} дн ${hours % 24} ч`;
}

function ItemRow({ item }) {
  const hwTag = item.role === 'homework';
  if (item.kind === 'work') {
    return (
      <div className="sc-item">
        <span className="sc-item-title"><PlayCircleOutlined /> {item.title || 'Работа'}</span>
        {item.session_id
          ? <Button type="primary" size="small" className="sc-btn" href={`/student/${item.session_id}`}>Решать</Button>
          : <span className="sc-item-muted">ссылка не задана</span>}
      </div>
    );
  }
  if (item.kind === 'file') {
    return (
      <div className="sc-item">
        <span className="sc-item-title"><DownloadOutlined /> {item.title || 'Материал'}</span>
        {item.file_url
          ? <Button size="small" className="sc-btn" href={item.file_url} target="_blank">Открыть</Button>
          : <span className="sc-item-muted">недоступно</span>}
      </div>
    );
  }
  return (
    <div className="sc-item sc-item--text">
      <MathRenderer text={item.description || ''} inline={false} />
    </div>
  );
}

function timeRange(pub, d) {
  const r = slotRangeFromCode(pub.time_slot);
  if (r) return `${r[0]}–${r[1]}`;
  return d ? d.format('HH:mm') : '';
}

function LessonBody({ pub }) {
  const items = Array.isArray(pub.items) ? pub.items : [];
  const classItems = items.filter((i) => i.role !== 'homework');
  const hwItems = items.filter((i) => i.role === 'homework');
  if (!classItems.length && !hwItems.length) {
    return <div className="sc-empty-note">Материалы появятся позже</div>;
  }
  return (
    <>
      {classItems.length > 0 && (
        <div className="sc-block">
          <div className="sc-block-head">Материалы</div>
          {classItems.map((it, i) => <ItemRow key={`c${i}`} item={it} />)}
        </div>
      )}
      {hwItems.length > 0 && (
        <div className="sc-block sc-block--hw">
          <div className="sc-block-head">🏠 Домашнее задание</div>
          {hwItems.map((it, i) => <ItemRow key={`h${i}`} item={it} />)}
        </div>
      )}
    </>
  );
}

// Компактная карточка занятия (расписание/прошедшие).
function LessonCard({ pub, dimmed }) {
  const d = pub.date_plan ? dayjs(pub.date_plan).locale('ru') : null;
  const until = dimmed ? '' : untilLabel(pub, d);
  return (
    <div className={`sc-card${dimmed ? ' sc-card--dim' : ''}`}>
      <div className="sc-date">
        <span className="sc-date-day">{d ? d.format('D') : '—'}</span>
        <span className="sc-date-mon">{d ? d.format('MMM') : ''}</span>
      </div>
      <div className="sc-card-main">
        <div className="sc-card-top">
          <span className="sc-card-title">{pub.title || 'Занятие'}</span>
          <span className="sc-card-time"><ClockCircleOutlined /> {timeRange(pub, d)}</span>
        </div>
        {until && <div className="sc-card-until">{until}</div>}
        <LessonBody pub={pub} />
      </div>
    </div>
  );
}

// Крупная карточка ближайшего занятия.
function NextLessonHero({ pub, boardUrl }) {
  const d = pub.date_plan ? dayjs(pub.date_plan).locale('ru') : null;
  return (
    <div className="sc-hero">
      <div className="sc-hero-head">
        <div>
          <div className="sc-hero-rel">{d ? untilLabel(pub, d) : 'Ближайшее занятие'}</div>
          <div className="sc-hero-title">{pub.title || 'Занятие'}</div>
          <div className="sc-hero-when">
            {d ? d.format('dddd, D MMMM') : ''} · <b>{timeRange(pub, d)}</b>
          </div>
        </div>
        {(pub.conference_url || boardUrl) && (
          <div className="sc-hero-actions">
            {pub.conference_url && (
              <Button type="primary" icon={<VideoCameraOutlined />} href={pub.conference_url} target="_blank" className="sc-hero-join sc-btn">
                Подключиться
              </Button>
            )}
            {boardUrl && (
              <Button icon={<FundProjectionScreenOutlined />} href={boardUrl} target="_blank" className="sc-hero-join sc-btn">
                Доска
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="sc-hero-body"><LessonBody pub={pub} /></div>
    </div>
  );
}

export default function StudentCoursePortal({ student }) {
  const [courses, setCourses] = useState([]);
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState({}); // courseId -> bool

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const memberships = await api.getMyCourseMemberships(student.id);
        if (cancelled) return;
        const courseList = memberships
          .map((m) => m.expand?.course)
          .filter((c) => c && c.archived !== true);
        setCourses(courseList);
        setPubs(await api.getPublicationsForCourses(courseList.map((c) => c.id)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [student.id]);

  const byCourse = useMemo(() => {
    const map = new Map();
    for (const p of pubs) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group).push(p);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.date_plan || 0) - new Date(b.date_plan || 0));
    }
    return map;
  }, [pubs]);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;

  if (!courses.length) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Ты пока не записан ни на один курс. Как только учитель добавит — курс появится здесь." />
      </div>
    );
  }

  const startOfToday = dayjs().startOf('day');

  return (
    <div className="sc-portal">
      <h2 className="sc-portal-title"><ReadOutlined /> Мои курсы</h2>

      {courses.map((course) => {
        const list = byCourse.get(course.id) || [];
        const upcoming = list.filter((p) => !dayjs(p.date_plan).isBefore(startOfToday, 'day'));
        const past = list.filter((p) => dayjs(p.date_plan).isBefore(startOfToday, 'day')).reverse();
        const [next, ...rest] = upcoming;
        const openPast = !!showPast[course.id];

        return (
          <section key={course.id} className="sc-course">
            <header className="sc-course-head">
              <div className="sc-course-name">🎓 {course.name}</div>
              <div className="sc-course-links">
                {course.conference_url && (
                  <Button size="small" className="sc-btn" icon={<LinkOutlined />} href={course.conference_url} target="_blank">
                    Комната курса
                  </Button>
                )}
                {course.board_url && (
                  <Button size="small" className="sc-btn" icon={<FundProjectionScreenOutlined />} href={course.board_url} target="_blank">
                    Доска
                  </Button>
                )}
              </div>
            </header>

            {!list.length && <div className="sc-empty-note">Занятия ещё не опубликованы</div>}

            {next && <NextLessonHero pub={next} boardUrl={course.board_url} />}

            {rest.length > 0 && (
              <div className="sc-section">
                <div className="sc-section-title">Расписание</div>
                {rest.map((pub) => <LessonCard key={pub.id} pub={pub} />)}
              </div>
            )}

            {past.length > 0 && (
              <div className="sc-section">
                <button
                  type="button"
                  className="sc-past-toggle"
                  onClick={() => setShowPast((s) => ({ ...s, [course.id]: !s[course.id] }))}
                >
                  <RightOutlined className={`sc-past-caret${openPast ? ' is-open' : ''}`} />
                  Прошедшие занятия ({past.length})
                </button>
                {openPast && past.map((pub) => <LessonCard key={pub.id} pub={pub} dimmed />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
