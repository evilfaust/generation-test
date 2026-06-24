import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Spin } from 'antd';
import {
  CalendarOutlined, CheckOutlined, ClockCircleOutlined, EditOutlined, FileTextOutlined, InboxOutlined,
  PlusOutlined, PushpinFilled, ToolOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { Chip, groupHex, TONE_HEX, SectionCard } from './ui';
import { lessonStartEnd, lessonProgress } from './lessonTime';
import WeekNavigator from './today/WeekNavigator';
import NowHero from './today/NowHero';
import KpiCluster from './today/KpiCluster';
import './today/today.css';

dayjs.locale('ru');

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const WD_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

function plural(n, one, few, many) {
  const m10 = n % 10; const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function sessionTitle(s) {
  const e = s?.expand || {};
  return e.work?.title || s?.student_title || e.mc_test?.title || e.trig_mc_test?.title || 'Работа';
}

const lessonTopic = (l) => l.expand?.ktp_entry?.title || '';
const matCount = (l) => (Array.isArray(l.materials) ? l.materials.length : 0);

export default function TodayDashboard() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { teacher, canEdit } = useAuth();

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('week'));
  const [selectedDate, setSelectedDate] = useState(() => dayjs());
  const [weekLessons, setWeekLessons] = useState([]);
  const [thisWeekLessons, setThisWeekLessons] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = useMemo(() => new Date(nowTick), [nowTick]);
  const today = useMemo(() => dayjs(nowTick), [nowTick]);
  const currentWeekStart = useMemo(() => today.startOf('week'), [today]);

  // Тик «текущего времени» — раз в минуту обновляет hero/прогресс.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Дедлайны + заметки — один раз.
  useEffect(() => {
    Promise.all([
      api.getSessionsWithDeadline().catch(() => []),
      api.getNotes().catch(() => []),
    ]).then(([d, n]) => { setDeadlines(d); setNotes(n); });
  }, []);

  // Уроки видимой недели (+ снимок текущей недели для KPI/бэклога).
  const loadWeek = useCallback(async (ws) => {
    setLoading(true);
    try {
      const from = ws.startOf('day').toISOString();
      const to = ws.add(6, 'day').endOf('day').toISOString();
      const l = await api.getLessons({ from, to });
      setWeekLessons(l);
      if (ws.isSame(dayjs().startOf('week'), 'day')) setThisWeekLessons(l);
    } catch {
      message.error('Не удалось загрузить расписание');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadWeek(weekStart); }, [weekStart, loadWeek]);

  // ── Производные ──
  const countByDay = useMemo(() => {
    const m = new Map();
    for (const l of weekLessons) {
      const k = dayjs(l.date_plan).format('YYYY-MM-DD');
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [weekLessons]);

  const isSelectedToday = selectedDate.isSame(today, 'day');

  const selectedLessons = useMemo(
    () => weekLessons
      .filter((l) => dayjs(l.date_plan).isSame(selectedDate, 'day'))
      .sort((a, b) => new Date(a.date_plan) - new Date(b.date_plan)),
    [weekLessons, selectedDate],
  );

  // Hero: текущий (live) или ближайший предстоящий урок сегодня.
  const hero = useMemo(() => {
    if (!isSelectedToday) return null;
    const active = (l) => l.status !== 'done' && l.status !== 'cancelled';
    const live = selectedLessons.find((l) => {
      if (!active(l)) return false;
      const { start, end } = lessonStartEnd(l);
      return start <= now && now < end;
    });
    const next = !live && selectedLessons.find((l) => active(l) && lessonStartEnd(l).start > now);
    const l = live || next;
    if (!l) return null;
    const { start, end } = lessonStartEnd(l);
    return {
      lesson: l,
      data: {
        live: !!live,
        startStr: dayjs(start).format('HH:mm'),
        endStr: dayjs(end).format('HH:mm'),
        groupName: l.expand?.group?.name || '',
        groupColor: groupHex(l.group || l.expand?.group?.name).base,
        subject: l.title,
        topic: lessonTopic(l),
        mats: matCount(l),
        progressPct: Math.max(0, Math.min(100, Math.round(lessonProgress(l, now) * 100))),
      },
    };
  }, [isSelectedToday, selectedLessons, now]);

  const todayLessonsCount = useMemo(
    () => thisWeekLessons.filter((l) => dayjs(l.date_plan).isSame(today, 'day')).length,
    [thisWeekLessons, today],
  );

  // Будущие уроки текущей недели без материалов.
  const prepBacklog = useMemo(() => {
    const startOfToday = today.startOf('day');
    return thisWeekLessons
      .filter((l) => matCount(l) === 0 && l.status !== 'cancelled' && dayjs(l.date_plan).isAfter(startOfToday))
      .sort((a, b) => new Date(a.date_plan) - new Date(b.date_plan))
      .slice(0, 5);
  }, [thisWeekLessons, today]);

  const upcomingDeadlines = useMemo(() => {
    const horizon = today.add(14, 'day');
    return deadlines
      .map((s) => ({ s, dl: dayjs(s.deadline) }))
      .filter(({ dl }) => dl.isAfter(today.subtract(7, 'day')) && dl.isBefore(horizon))
      .sort((a, b) => a.dl - b.dl);
  }, [deadlines, today]);

  const overdueCount = useMemo(
    () => deadlines.filter((s) => dayjs(s.deadline).isBefore(today)).length,
    [deadlines, today],
  );

  const dashboardNotes = useMemo(
    () => notes
      .filter((n) => !n.is_archived && (n.is_pinned || n.is_inbox))
      .sort((a, b) => (b.is_pinned - a.is_pinned) || (new Date(b.updated) - new Date(a.updated)))
      .slice(0, 6),
    [notes],
  );

  const inboxCount = useMemo(
    () => notes.filter((n) => n.is_inbox && !n.is_archived).length,
    [notes],
  );

  // ── Действия ──
  const openNote = useCallback(async (l) => {
    try {
      const note = await api.getOrCreateLessonNote(l);
      navigate(`/app/notes?note=${note.id}`);
    } catch { message.error('Не удалось открыть заметку'); }
  }, [navigate, message]);

  const finishLesson = useCallback(async (l) => {
    try {
      await api.updateLesson(l.id, { status: 'done' });
      setWeekLessons((p) => p.map((x) => (x.id === l.id ? { ...x, status: 'done' } : x)));
      setThisWeekLessons((p) => p.map((x) => (x.id === l.id ? { ...x, status: 'done' } : x)));
      message.success('Урок отмечен проведённым');
    } catch { message.error('Не удалось обновить урок'); }
  }, [message]);

  const goToWeek = useCallback((ws) => {
    setWeekStart(ws);
    const t = dayjs();
    setSelectedDate(t.startOf('week').isSame(ws, 'day') ? t : ws);
  }, []);

  const selectDay = useCallback((d) => {
    setSelectedDate(d);
    if (!d.startOf('week').isSame(weekStart, 'day')) setWeekStart(d.startOf('week'));
  }, [weekStart]);

  if (loading && !weekLessons.length) {
    return <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>;
  }

  const firstName = teacher?.name ? teacher.name.split(' ')[0] : '';
  const summaryLine = [
    `${todayLessonsCount} ${plural(todayLessonsCount, 'урок', 'урока', 'уроков')} сегодня`,
    `${upcomingDeadlines.length} ${plural(upcomingDeadlines.length, 'дедлайн', 'дедлайна', 'дедлайнов')} на 2 недели`,
    `${inboxCount} ${plural(inboxCount, 'заметка', 'заметки', 'заметок')} в инбоксе`,
  ].join(' · ');

  const kpis = [
    { key: 'lessons', label: 'Уроков сегодня', value: todayLessonsCount, tone: 'blue', icon: <ClockCircleOutlined />, onClick: () => navigate('/app/calendar') },
    { key: 'prep', label: 'К подготовке', value: prepBacklog.length, tone: 'amber', tag: 'неделя', alert: prepBacklog.length > 0, icon: <ToolOutlined />, onClick: () => navigate('/app/ktp') },
    { key: 'deadlines', label: 'Дедлайнов', value: upcomingDeadlines.length, tone: 'violet', tag: '2 нед.', icon: <CalendarOutlined />, onClick: () => navigate('/app/journal') },
    { key: 'overdue', label: 'Просрочено', value: overdueCount, tone: 'rose', alert: overdueCount > 0, icon: <WarningOutlined />, onClick: () => navigate('/app/journal') },
  ];

  const scheduleTitle = isSelectedToday ? 'Расписание на сегодня' : `Расписание · ${cap(selectedDate.format('dddd, D MMMM'))}`;
  const doneToday = selectedLessons.filter((l) => l.status === 'done').length;

  return (
    <div className="td-page">
      {/* Шапка + навигатор недели */}
      <div className="td-head">
        <div>
          <div className="td-head__eyebrow">{cap(today.format('dddd, D MMMM'))}</div>
          <h1 className="td-head__title">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          <div className="td-head__sub">{summaryLine}</div>
        </div>
        <WeekNavigator
          weekStart={weekStart}
          selectedDate={selectedDate}
          today={today}
          countByDay={countByDay}
          onPrev={() => goToWeek(weekStart.subtract(7, 'day'))}
          onNext={() => goToWeek(weekStart.add(7, 'day'))}
          onSelectDay={selectDay}
        />
      </div>

      {/* Hero + KPI */}
      <div className="td-hero-row">
        {hero ? (
          <NowHero
            data={hero.data}
            onAttendance={() => navigate('/app/calendar')}
            onMaterials={() => navigate('/app/calendar')}
            onNote={() => openNote(hero.lesson)}
            onFinish={() => finishLesson(hero.lesson)}
          />
        ) : (
          <div className="td-hero">
            <div className="td-hero__glow" />
            <div className="td-hero__inner">
              <div className="td-hero__top">
                <span className="td-hero__pulse" style={{ background: '#9FB4FF', boxShadow: 'none', animation: 'none' }} />
                <span className="td-hero__eyebrow">{isSelectedToday ? 'На сегодня' : cap(selectedDate.format('dddd, D MMMM'))}</span>
              </div>
              <div className="td-hero__topic" style={{ marginBottom: 6 }}>
                {isSelectedToday ? 'Уроков на сегодня больше нет' : 'Уроков не запланировано'}
              </div>
              <div className="td-hero__subject" style={{ color: '#9FB4FF' }}>
                Свободное окно — можно подготовить материалы к будущим урокам.
              </div>
            </div>
          </div>
        )}
        <KpiCluster items={kpis} />
      </div>

      {/* Двухколоночная сетка */}
      <div className="td-cols">
        {/* Левая колонка */}
        <div className="td-col">
          <SectionCard
            icon={<ClockCircleOutlined />}
            iconColor="var(--accent)"
            title={scheduleTitle}
            meta={selectedLessons.length ? `${selectedLessons.length} ${plural(selectedLessons.length, 'урок', 'урока', 'уроков')}${doneToday ? ` · ${doneToday} проведён` : ''}` : null}
            actionLabel="+ Урок"
            onAction={() => navigate('/app/calendar')}
          >
            {selectedLessons.length ? selectedLessons.map((l, i) => {
              const last = i === selectedLessons.length - 1;
              const { start, end } = lessonStartEnd(l);
              const live = isSelectedToday && l.status !== 'done' && l.status !== 'cancelled' && start <= now && now < end;
              const status = l.status === 'done' ? 'done' : live ? 'now' : (l.status || 'planned');
              const tone = status === 'done' ? 'teal' : status === 'now' ? 'blue' : 'neutral';
              const dotColor = status === 'done' ? '#0D9488' : status === 'now' ? '#2B4BFF' : '#9AA0AC';
              const dotRing = status === 'done' ? '#D1FAE5' : status === 'now' ? '#E7ECFF' : '#F3F4F6';
              const ghex = groupHex(l.group || l.expand?.group?.name);
              const mats = matCount(l);
              const needPrep = mats === 0 && status !== 'done';
              return (
                <div key={l.id} className={`td-lesson${live ? ' td-lesson--now' : ''}`} onClick={() => navigate('/app/calendar')}>
                  <div className="td-lesson__time">
                    <div className="td-lesson__start">{dayjs(start).format('HH:mm')}</div>
                    <div className="td-lesson__end">{dayjs(end).format('HH:mm')}</div>
                  </div>
                  <div className="td-lesson__rail">
                    <span className="td-lesson__dot" style={{ background: dotColor, boxShadow: `0 0 0 3px ${dotRing}` }} />
                    {!last && <span className="td-lesson__line" />}
                  </div>
                  <div className="td-lesson__main">
                    <div className="td-lesson__titlerow">
                      <span className="td-lesson__subject">{l.title}</span>
                      {l.expand?.group?.name && (
                        <span className="lemma-chip" style={{ color: ghex.base, background: ghex.soft }}>{l.expand.group.name}</span>
                      )}
                    </div>
                    {lessonTopic(l) && <div className="td-lesson__topic">{lessonTopic(l)}</div>}
                    <div className="td-lesson__metarow">
                      <Chip tone={tone} dot>{status === 'now' ? 'идёт сейчас' : status === 'done' ? 'проведён' : 'запланирован'}</Chip>
                      {mats > 0 && <span className="td-minichip">📎 {mats}</span>}
                      {needPrep && <span className="td-minichip td-minichip--warn">материалы не готовы</span>}
                    </div>
                  </div>
                  <div className="td-lesson__actions" onClick={(e) => e.stopPropagation()}>
                    {needPrep && (
                      <button type="button" className="td-prep-btn" onClick={() => navigate('/app/worksheets/test')}>Подготовить</button>
                    )}
                    {canEdit && status !== 'done' && (
                      <button type="button" className="td-iconbtn td-iconbtn--done" title="Отметить проведённым" onClick={() => finishLesson(l)}>
                        <CheckOutlined />
                      </button>
                    )}
                    <button type="button" className="td-iconbtn" title="Заметка урока" onClick={() => openNote(l)}>
                      <EditOutlined />
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className="ws-card__empty">
                {isSelectedToday ? 'На сегодня уроков нет — спланируйте занятие в календаре.' : 'В этот день уроков нет.'}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={<ToolOutlined />}
            iconColor="var(--c-amber)"
            title="К подготовке на неделе"
            meta="материалы ещё не прикреплены"
            actionLabel="КТП →"
            onAction={() => navigate('/app/ktp')}
          >
            {prepBacklog.length ? prepBacklog.map((l) => {
              const d = dayjs(l.date_plan);
              const hex = groupHex(l.group || l.expand?.group?.name);
              return (
                <div key={l.id} className="td-prep" onClick={() => navigate('/app/calendar')}>
                  <span className="td-prep__date" style={{ color: hex.base, background: hex.soft }}>
                    <span>{WD_SHORT[d.day()]}</span>
                    <span className="td-prep__date-num">{d.date()}</span>
                  </span>
                  <div className="td-prep__main">
                    <div className="td-prep__toprow">
                      <span className="td-prep__topic">{lessonTopic(l) || l.title}</span>
                      {l.expand?.group?.name && (
                        <span className="lemma-chip" style={{ color: hex.base, background: hex.soft }}>{l.expand.group.name}</span>
                      )}
                    </div>
                    <div className="td-prep__meta">{l.title} · нет материалов</div>
                  </div>
                  <button type="button" className="td-prep__btn" onClick={(e) => { e.stopPropagation(); navigate('/app/worksheets/test'); }}>Собрать урок</button>
                </div>
              );
            }) : (
              <div className="ws-card__empty">Все уроки недели обеспечены материалами 👍</div>
            )}
          </SectionCard>
        </div>

        {/* Правый рейл */}
        <div className="td-col">
          <SectionCard
            icon={<WarningOutlined />}
            iconColor="var(--c-rose)"
            title="Требует внимания"
            actionLabel="Журнал →"
            onAction={() => navigate('/app/journal')}
          >
            {upcomingDeadlines.length ? upcomingDeadlines.map(({ s, dl }) => {
              const overdue = dl.isBefore(today);
              const days = dl.startOf('day').diff(today.startOf('day'), 'day');
              const when = overdue ? `${days} дн.` : days === 0 ? 'сегодня' : days === 1 ? 'завтра' : `+${days} дн.`;
              const tone = overdue ? 'rose' : (days <= 1 ? 'amber' : 'neutral');
              const hex = TONE_HEX[tone];
              return (
                <div key={s.id} className="td-att" onClick={() => navigate('/app/journal')}>
                  <span className="td-att__bar" style={{ background: hex.base }} />
                  <div className="td-att__main">
                    <div className="td-att__toprow">
                      <span className="td-att__title">{sessionTitle(s)}</span>
                    </div>
                    <div className="td-att__sub">срок {dl.format('DD.MM HH:mm')}</div>
                  </div>
                  <span className="td-att__when" style={{ color: hex.base, background: hex.soft }}>{when}</span>
                </div>
              );
            }) : (
              <div className="ws-card__empty">Все выданные работы под контролем.</div>
            )}
          </SectionCard>

          <SectionCard
            icon={<FileTextOutlined />}
            iconColor="var(--c-violet)"
            title="Заметки"
            actionLabel="Все →"
            onAction={() => navigate('/app/notes')}
          >
            {dashboardNotes.map((n) => (
              <div key={n.id} className="td-note" onClick={() => navigate(`/app/notes?note=${n.id}`)}>
                <span className="td-note__icon" style={{ color: n.is_pinned ? 'var(--c-amber)' : 'var(--ink-4)' }}>
                  {n.is_pinned ? <PushpinFilled /> : <InboxOutlined />}
                </span>
                <span className="td-note__title">{n.title?.trim() || 'Без названия'}</span>
                {n.expand?.group?.name && (
                  <span className="lemma-chip" style={{ color: groupHex(n.group || n.expand.group.name).base, background: groupHex(n.group || n.expand.group.name).soft }}>
                    {n.expand.group.name}
                  </span>
                )}
              </div>
            ))}
            <button type="button" className="td-note__inbox" onClick={() => navigate('/app/notes')}>
              <PlusOutlined /> Бросить мысль в инбокс
            </button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
