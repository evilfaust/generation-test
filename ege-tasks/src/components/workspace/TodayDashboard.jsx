import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App, Button, Card, Col, Empty, List, Row, Space, Spin, Statistic, Tag, Typography,
} from 'antd';
import {
  CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined,
  PlusOutlined, SolutionOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';

dayjs.locale('ru');

const { Title, Text } = Typography;

const STATUS_TAG = {
  planned: { color: 'blue', label: 'запланирован' },
  done: { color: 'green', label: 'проведён' },
  cancelled: { color: 'default', label: 'отменён' },
};

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
  const { teacher } = useAuth();

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

  const renderLesson = (l) => (
    <List.Item
      style={{ cursor: 'pointer' }}
      onClick={() => navigate('/app/calendar')}
      actions={[
        <Button
          key="note"
          size="small"
          type="text"
          icon={<FileTextOutlined />}
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const note = await api.getOrCreateLessonNote(l);
              navigate(`/app/notes?note=${note.id}`);
            } catch { message.error('Не удалось открыть заметку'); }
          }}
        >
          заметка
        </Button>,
      ]}
    >
      <List.Item.Meta
        title={
          <Space>
            <Text strong>{dayjs(l.date_plan).format('HH:mm')}</Text>
            <span>{l.title}</span>
          </Space>
        }
        description={
          <Space size={6}>
            {l.expand?.group?.name && <Tag color="blue">{l.expand.group.name}</Tag>}
            {(() => { const st = STATUS_TAG[l.status || 'planned']; return <Tag color={st.color}>{st.label}</Tag>; })()}
            {Array.isArray(l.materials) && l.materials.length > 0 && <Tag>📎 {l.materials.length}</Tag>}
          </Space>
        }
      />
    </List.Item>
  );

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} align="start" wrap>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {greeting()}{teacher?.name ? `, ${teacher.name.split(' ')[0]}` : ''}!
          </Title>
          <Text type="secondary" style={{ textTransform: 'capitalize' }}>
            {today.format('dddd, D MMMM YYYY')}
          </Text>
        </div>
        <Space wrap>
          <Button icon={<CalendarOutlined />} onClick={() => navigate('/app/calendar')}>Календарь</Button>
          <Button icon={<SolutionOutlined />} onClick={() => navigate('/app/journal')}>Журнал</Button>
        </Space>
      </Space>

      {/* Сводка */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic title="Уроков сегодня" value={todayLessons.length} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic title="Дедлайнов (2 нед.)" value={upcomingDeadlines.length} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic
              title="Просрочено выдач"
              value={overdueCount}
              prefix={<WarningOutlined />}
              valueStyle={overdueCount ? { color: '#cf1322' } : undefined}
            />
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
              <List size="small" dataSource={todayLessons} renderItem={renderLesson} />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="На сегодня уроков нет" />
            )}
          </Card>

          {/* Эта неделя */}
          <Card size="small" title={<Space><CalendarOutlined /><span>Ближайшие дни</span></Space>} style={{ marginTop: 16 }}>
            {weekByDay.length ? (
              weekByDay.map(({ key, date, items }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {WEEKDAYS[date.day()]}, {date.format('D MMMM')}
                  </Text>
                  <List size="small" dataSource={items} renderItem={renderLesson} />
                </div>
              ))
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="На неделю уроков не запланировано" />
            )}
          </Card>
        </Col>

        {/* Дедлайны */}
        <Col xs={24} lg={10}>
          <Card size="small" title={<Space><WarningOutlined /><span>Ближайшие дедлайны</span></Space>}>
            {upcomingDeadlines.length ? (
              <List
                size="small"
                dataSource={upcomingDeadlines}
                renderItem={({ s, dl }) => {
                  const overdue = dl.isBefore(today);
                  const days = dl.startOf('day').diff(today.startOf('day'), 'day');
                  const when = overdue
                    ? 'просрочено'
                    : days === 0 ? 'сегодня' : days === 1 ? 'завтра' : `через ${days} дн.`;
                  return (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/app/journal')}
                    >
                      <List.Item.Meta
                        title={<span>{overdue ? '⏰ ' : ''}{sessionTitle(s)}</span>}
                        description={
                          <Space size={6}>
                            <Text type={overdue ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                              {dl.format('DD.MM HH:mm')} · {when}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Дедлайнов нет" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
