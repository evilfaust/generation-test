import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Col, Row, Space, Spin, Tooltip, Typography } from 'antd';
import {
  CalendarOutlined, CheckOutlined, ClockCircleOutlined, FileAddOutlined, FileTextOutlined,
  PlusOutlined, SolutionOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspacePageHeader, EmptyState, GroupChip, LessonStatusChip, Chip } from './ui';

dayjs.locale('ru');

const { Text } = Typography;

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

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

export default function TodayDashboard() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { teacher, canEdit } = useAuth();

  const [lessons, setLessons] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = dayjs().startOf('day').toISOString();
      const to = dayjs().add(7, 'day').endOf('day').toISOString();
      const [l, d] = await Promise.all([
        api.getLessons({ from, to }),
        api.getSessionsWithDeadline(),
      ]);
      setLessons(l);
      setDeadlines(d);
    } catch {
      message.error('Не удалось загрузить «Сегодня»');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const today = dayjs();

  const todayLessons = useMemo(
    () => lessons
      .filter((l) => dayjs(l.date_plan).isSame(today, 'day'))
      .sort((a, b) => new Date(a.date_plan) - new Date(b.date_plan)),
    [lessons], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Группировка недели по дням (исключая сегодня).
  const weekByDay = useMemo(() => {
    const map = new Map();
    for (const l of lessons) {
      const d = dayjs(l.date_plan);
      if (d.isSame(today, 'day')) continue;
      const key = d.format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, items]) => ({
        key,
        date: dayjs(key),
        items: items.sort((a, b) => new Date(a.date_plan) - new Date(b.date_plan)),
      }));
  }, [lessons]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcomingDeadlines = useMemo(() => {
    const horizon = dayjs().add(14, 'day');
    return deadlines
      .map((s) => ({ s, dl: dayjs(s.deadline) }))
      .filter(({ dl }) => dl.isAfter(today.subtract(7, 'day')) && dl.isBefore(horizon))
      .sort((a, b) => a.dl - b.dl);
  }, [deadlines]); // eslint-disable-line react-hooks/exhaustive-deps

  const overdueCount = useMemo(
    () => deadlines.filter((s) => dayjs(s.deadline).isBefore(today)).length,
    [deadlines], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const openNote = useCallback(async (l, e) => {
    e?.stopPropagation();
    try {
      const note = await api.getOrCreateLessonNote(l);
      navigate(`/app/notes?note=${note.id}`);
    } catch { message.error('Не удалось открыть заметку'); }
  }, [navigate, message]);

  const markDone = useCallback(async (l, e) => {
    e?.stopPropagation();
    try {
      await api.updateLesson(l.id, { status: 'done' });
      setLessons((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: 'done' } : x)));
      message.success('Урок отмечен проведённым');
    } catch { message.error('Не удалось обновить урок'); }
  }, [message]);

  const renderLesson = (l) => {
    const status = l.status || 'planned';
    const dotMod = status === 'done' ? ' ws-timeline__dot--done'
      : status === 'cancelled' ? ' ws-timeline__dot--muted' : '';
    const matCount = Array.isArray(l.materials) ? l.materials.length : 0;
    return (
      <div key={l.id} className="ws-timeline__item" onClick={() => navigate('/app/calendar')}>
        <div className="ws-timeline__time">{dayjs(l.date_plan).format('HH:mm')}</div>
        <div className="ws-timeline__rail"><span className={`ws-timeline__dot${dotMod}`} /></div>
        <div className="ws-timeline__body">
          <div className="ws-timeline__title">{l.title}</div>
          <div className="ws-timeline__meta">
            {l.expand?.group?.name && <GroupChip id={l.group} name={l.expand.group.name} />}
            <LessonStatusChip status={status} />
            {matCount > 0 && <Chip tone="neutral" dot={false}>📎 {matCount}</Chip>}
          </div>
        </div>
        <div className="ws-timeline__actions">
          {canEdit && status !== 'done' && (
            <Tooltip title="Отметить проведённым">
              <Button size="small" type="text" icon={<CheckOutlined />} onClick={(e) => markDone(l, e)} />
            </Tooltip>
          )}
          <Tooltip title="Заметка урока">
            <Button size="small" type="text" icon={<FileTextOutlined />} onClick={(e) => openNote(l, e)} />
          </Tooltip>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>;
  }

  const firstName = teacher?.name ? teacher.name.split(' ')[0] : '';

  return (
    <div style={{ maxWidth: 1100 }}>
      <WorkspacePageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}!`}
        subtitle={today.format('dddd, D MMMM YYYY')[0].toUpperCase() + today.format('dddd, D MMMM YYYY').slice(1)}
        extra={(
          <Space wrap>
            <Button icon={<CalendarOutlined />} onClick={() => navigate('/app/calendar')}>Календарь</Button>
            <Button icon={<SolutionOutlined />} onClick={() => navigate('/app/journal')}>Журнал</Button>
          </Space>
        )}
      />

      {/* Быстрые действия */}
      <div className="ws-quick" style={{ marginBottom: 16 }}>
        <button type="button" className="ws-quick__btn" onClick={() => navigate('/app/calendar')}>
          <span className="ws-quick__icon ws-icon--blue"><PlusOutlined /></span>
          <span><span className="ws-quick__label">Запланировать урок</span><span className="ws-quick__hint">в календаре</span></span>
        </button>
        <button type="button" className="ws-quick__btn" onClick={() => navigate('/app/works/new/edit')}>
          <span className="ws-quick__icon ws-icon--teal"><FileAddOutlined /></span>
          <span><span className="ws-quick__label">Создать работу</span><span className="ws-quick__hint">выдать ученикам</span></span>
        </button>
        <button type="button" className="ws-quick__btn" onClick={() => navigate('/app/journal')}>
          <span className="ws-quick__icon ws-icon--violet"><SolutionOutlined /></span>
          <span><span className="ws-quick__label">Журнал сдачи</span><span className="ws-quick__hint">кто сдал работы</span></span>
        </button>
        <button type="button" className="ws-quick__btn" onClick={() => navigate('/app/notes')}>
          <span className="ws-quick__icon ws-icon--amber"><FileTextOutlined /></span>
          <span><span className="ws-quick__label">Заметки</span><span className="ws-quick__hint">мысли и планы</span></span>
        </button>
      </div>

      {/* Сводка — кликабельная */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card size="small" className="ws-clickable" onClick={() => navigate('/app/calendar')}>
            <div className="ws-stat__label">Уроков сегодня</div>
            <div className="ws-stat__value"><ClockCircleOutlined style={{ fontSize: 20, color: 'var(--ink-3)', marginRight: 6 }} />{todayLessons.length}</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" className="ws-clickable" onClick={() => navigate('/app/journal')}>
            <div className="ws-stat__label">Дедлайнов (2 нед.)</div>
            <div className="ws-stat__value"><CalendarOutlined style={{ fontSize: 20, color: 'var(--ink-3)', marginRight: 6 }} />{upcomingDeadlines.length}</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" className="ws-clickable" onClick={() => navigate('/app/journal')}>
            <div className="ws-stat__label">Просрочено выдач</div>
            <div className={`ws-stat__value${overdueCount ? ' ws-stat__value--alert' : ''}`}>
              <WarningOutlined style={{ fontSize: 20, color: overdueCount ? 'var(--c-rose)' : 'var(--ink-3)', marginRight: 6 }} />{overdueCount}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Сегодня */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={<Space><ClockCircleOutlined /><span>Сегодня</span></Space>}
            extra={<Button size="small" type="link" icon={<PlusOutlined />} onClick={() => navigate('/app/calendar')}>Урок</Button>}
          >
            {todayLessons.length ? (
              <div className="ws-timeline">{todayLessons.map(renderLesson)}</div>
            ) : (
              <EmptyState
                title="На сегодня уроков нет"
                description="Спланируйте занятие — оно появится здесь и в календаре"
                cta="Запланировать урок"
                ctaIcon={<PlusOutlined />}
                onCta={() => navigate('/app/calendar')}
              />
            )}
          </Card>

          {/* Ближайшие дни */}
          <Card size="small" title={<Space><CalendarOutlined /><span>Ближайшие дни</span></Space>} style={{ marginTop: 16 }}>
            {weekByDay.length ? (
              weekByDay.map(({ key, date, items }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                    {WEEKDAYS[date.day()]}, {date.format('D MMMM')}
                  </Text>
                  <div className="ws-timeline" style={{ marginTop: 4 }}>{items.map(renderLesson)}</div>
                </div>
              ))
            ) : (
              <EmptyState description="На неделю уроков не запланировано" />
            )}
          </Card>
        </Col>

        {/* Дедлайны */}
        <Col xs={24} lg={10}>
          <Card size="small" title={<Space><WarningOutlined /><span>Ближайшие дедлайны</span></Space>}>
            {upcomingDeadlines.length ? (
              <div>
                {upcomingDeadlines.map(({ s, dl }) => {
                  const overdue = dl.isBefore(today);
                  const days = dl.startOf('day').diff(today.startOf('day'), 'day');
                  const when = overdue
                    ? 'просрочено'
                    : days === 0 ? 'сегодня' : days === 1 ? 'завтра' : `через ${days} дн.`;
                  const tone = overdue ? 'rose' : (days <= 1 ? 'amber' : 'neutral');
                  return (
                    <div key={s.id} className="ws-row" style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }} onClick={() => navigate('/app/journal')}>
                      <div style={{ minWidth: 0 }}>
                        <div className="ws-timeline__title">{overdue ? '⏰ ' : ''}{sessionTitle(s)}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{dl.format('DD.MM HH:mm')}</Text>
                      </div>
                      <Chip tone={tone} dot={tone !== 'neutral'}>{when}</Chip>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Дедлайнов нет" description="Все выданные работы под контролем" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
