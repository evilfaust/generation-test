import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Empty, Select, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { api } from '../../shared/services/pocketbase';

const { Title, Text } = Typography;

// Человекочитаемое название выдачи из expand сессии.
function sessionTitle(s) {
  const e = s?.expand || {};
  return (
    e.work?.title ||
    s?.student_title ||
    e.mc_test?.title ||
    e.trig_mc_test?.title ||
    'Работа'
  );
}

// Статус ячейки «ученик × выдача» по лучшей попытке + дедлайну.
function cellStatus(agg, session) {
  const now = dayjs();
  const deadline = session.deadline ? dayjs(session.deadline) : null;

  if (!agg || (!agg.best && !agg.started)) {
    if (deadline && now.isAfter(deadline)) {
      return { color: 'red', text: 'просрочено', tip: 'Не сдал, срок прошёл' };
    }
    return { color: 'default', text: '—', tip: 'Не сдавал' };
  }
  if (!agg.best && agg.started) {
    return { color: 'processing', text: 'выполняет', tip: 'Попытка начата, не завершена' };
  }

  const a = agg.best;
  const pct = a.total ? Math.round((a.score / a.total) * 100) : null;
  const late = deadline && a.submitted_at && dayjs(a.submitted_at).isAfter(deadline);
  const ps = Number(session.passing_score) || 0;

  let color;
  let label;
  if (ps >= 1) {
    const pass = (a.score || 0) >= ps;
    label = pass ? 'зачёт' : 'незачёт';
    color = pass ? 'green' : 'volcano';
  } else {
    label = 'сдал';
    color = late ? 'orange' : 'green';
  }

  const text = pct != null ? `${label} · ${pct}%` : label;
  const tipParts = [
    `${a.score ?? 0}${a.total ? ` / ${a.total}` : ''}`,
    a.submitted_at ? `сдано ${dayjs(a.submitted_at).format('DD.MM.YYYY HH:mm')}` : null,
    late ? '⏰ с опозданием' : null,
  ].filter(Boolean);
  return { color, text: late ? `${text} ⏰` : text, tip: tipParts.join(' · ') };
}

export default function GradeJournal() {
  const { message } = App.useApp();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { students, perStudent }

  // Загрузка групп.
  useEffect(() => {
    (async () => {
      setLoadingGroups(true);
      try {
        const list = await api.getTeachingGroups();
        setGroups(list);
        if (list.length && !groupId) setGroupId(list[0].id);
      } catch {
        message.error('Не удалось загрузить группы');
      } finally {
        setLoadingGroups(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadJournal = useCallback(async (gid) => {
    if (!gid) return;
    setLoading(true);
    try {
      const res = await api.getGroupJournal(gid);
      setData(res);
    } catch {
      message.error('Не удалось загрузить журнал');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (groupId) loadJournal(groupId);
  }, [groupId, loadJournal]);

  // Сборка сессий-колонок + ячеек.
  const { sessions, cellMap } = useMemo(() => {
    const sessMap = new Map();
    const cells = new Map(); // `${studentId}|${sessionId}` → { best, started }

    if (data?.perStudent) {
      for (const { student, attempts } of data.perStudent) {
        for (const att of attempts) {
          const sess = att.expand?.session;
          const sid = att.session;
          if (!sess || !sid) continue;

          if (!sessMap.has(sid)) {
            sessMap.set(sid, {
              id: sid,
              title: sessionTitle(sess),
              date: sess.created,
              deadline: sess.deadline || '',
              passing_score: sess.passing_score || 0,
            });
          }

          const key = `${student.id}|${sid}`;
          const cur = cells.get(key) || { best: null, started: false };
          const submitted = att.status === 'submitted' || att.status === 'corrected';
          if (submitted) {
            if (!cur.best || (att.score || 0) > (cur.best.score || 0)) cur.best = att;
          } else if (att.status === 'started') {
            cur.started = true;
          }
          cells.set(key, cur);
        }
      }
    }

    const sessList = Array.from(sessMap.values()).sort(
      (a, b) => new Date(b.date) - new Date(a.date), // новые слева
    );
    return { sessions: sessList, cellMap: cells };
  }, [data]);

  const columns = useMemo(() => {
    const studentCol = {
      title: 'Ученик',
      key: 'student',
      fixed: 'left',
      width: 200,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.student.name || '—'}</Text>
          {row.student.username && (
            <Text type="secondary" style={{ fontSize: 12 }}>@{row.student.username}</Text>
          )}
        </Space>
      ),
    };

    const sessCols = sessions.map((s) => ({
      title: (
        <Tooltip title={s.title}>
          <div style={{ minWidth: 110 }}>
            <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
              {s.title}
            </div>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>
              {s.deadline
                ? `до ${dayjs(s.deadline).format('DD.MM')}`
                : s.date ? dayjs(s.date).format('DD.MM.YY') : ''}
            </Text>
          </div>
        </Tooltip>
      ),
      key: s.id,
      width: 130,
      align: 'center',
      render: (_, row) => {
        const agg = cellMap.get(`${row.student.id}|${s.id}`);
        const st = cellStatus(agg, s);
        return (
          <Tooltip title={st.tip}>
            <Tag color={st.color} style={{ margin: 0, cursor: 'default' }}>{st.text}</Tag>
          </Tooltip>
        );
      },
    }));

    return [studentCol, ...sessCols];
  }, [sessions, cellMap]);

  const dataSource = useMemo(
    () => (data?.students || []).map((s) => ({ key: s.id, student: s })),
    [data],
  );

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div>
          <Title level={4} style={{ margin: 0 }}>Журнал сдачи</Title>
          <Text type="secondary">Кто сдал, кто просрочил — по реальным результатам, без выдуманных оценок</Text>
        </div>
        <Select
          style={{ minWidth: 220 }}
          placeholder="Выберите группу"
          loading={loadingGroups}
          value={groupId}
          onChange={setGroupId}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
      </Space>

      {!groupId ? (
        <Empty description="Сначала создайте группу в «Классы и группы»" />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : !dataSource.length ? (
        <Empty description="В группе нет учеников" />
      ) : !sessions.length ? (
        <Empty description="У учеников группы пока нет выданных работ" />
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            size="small"
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      )}

      {!!sessions.length && (
        <Space style={{ marginTop: 12 }} wrap size={[8, 4]}>
          <Text type="secondary" style={{ fontSize: 12 }}>Легенда:</Text>
          <Tag color="green">сдал / зачёт</Tag>
          <Tag color="orange">сдал с опозданием</Tag>
          <Tag color="volcano">незачёт</Tag>
          <Tag color="red">просрочено</Tag>
          <Tag color="processing">выполняет</Tag>
          <Tag>не сдавал</Tag>
        </Space>
      )}
    </div>
  );
}
