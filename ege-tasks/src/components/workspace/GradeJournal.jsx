import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Segmented, Select, Space, Spin, Table, Tooltip, Typography } from 'antd';
import { SolutionOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '../../shared/services/pocketbase';
import ExternalJournal from './ExternalJournal';
import { WorkspacePageHeader, EmptyState, Chip, SubmitChip } from './ui';

const { Text } = Typography;

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
// kind → тон чипа (см. SubmitChip): passed|late|failed|overdue|in_progress|none.
function cellStatus(agg, session) {
  const now = dayjs();
  const deadline = session.deadline ? dayjs(session.deadline) : null;

  if (!agg || (!agg.best && !agg.started)) {
    if (deadline && now.isAfter(deadline)) {
      return { kind: 'overdue', text: 'просрочено', tip: 'Не сдал, срок прошёл' };
    }
    return { kind: 'none', text: '—', tip: 'Не сдавал' };
  }
  if (!agg.best && agg.started) {
    return { kind: 'in_progress', text: 'выполняет', tip: 'Попытка начата, не завершена' };
  }

  const a = agg.best;
  const pct = a.total ? Math.round((a.score / a.total) * 100) : null;
  const late = deadline && a.submitted_at && dayjs(a.submitted_at).isAfter(deadline);
  const ps = Number(session.passing_score) || 0;

  let kind;
  let label;
  if (ps >= 1) {
    const pass = (a.score || 0) >= ps;
    label = pass ? 'зачёт' : 'незачёт';
    kind = pass ? 'passed' : 'failed';
  } else {
    label = 'сдал';
    kind = late ? 'late' : 'passed';
  }

  const text = pct != null ? `${label} · ${pct}%` : label;
  const tipParts = [
    `${a.score ?? 0}${a.total ? ` / ${a.total}` : ''}`,
    a.submitted_at ? `сдано ${dayjs(a.submitted_at).format('DD.MM.YYYY HH:mm')}` : null,
    late ? '⏰ с опозданием' : null,
  ].filter(Boolean);
  return { kind, text: late ? `${text} ⏰` : text, tip: tipParts.join(' · ') };
}

export default function GradeJournal() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { students, perStudent }
  const [view, setView] = useState('lemma'); // lemma | ext

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
        return <SubmitChip kind={st.kind} title={st.tip} dot={st.kind !== 'none'}>{st.text}</SubmitChip>;
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
      <WorkspacePageHeader
        icon={<SolutionOutlined />}
        accent="teal"
        title="Журнал сдачи"
        subtitle={view === 'lemma'
          ? 'Сдача работ Lemma — по реальным результатам, без выдуманных оценок'
          : 'Внешние работы с решу.ЕГЭ (из приложения «Журнал ЕГЭ»)'}
        extra={(
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'lemma', label: 'Сдача (Lemma)' },
                { value: 'ext', label: 'Решу (внешние)' },
              ]}
            />
            {view === 'lemma' && (
              <Select
                style={{ minWidth: 200 }}
                placeholder="Выберите группу"
                loading={loadingGroups}
                value={groupId}
                onChange={setGroupId}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            )}
          </>
        )}
      />

      {view === 'ext' ? (
        <ExternalJournal />
      ) : !groupId ? (
        <EmptyState
          title="Нет групп"
          description="Журнал строится по ученикам группы — сначала создайте класс"
          cta="К группам"
          onCta={() => navigate('/app/groups')}
        />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : !dataSource.length ? (
        <EmptyState
          title="В группе нет учеников"
          description="Добавьте учеников в группу — и здесь появится их сдача"
          cta="Открыть группу"
          onCta={() => navigate(`/app/groups/${groupId}`)}
        />
      ) : !sessions.length ? (
        <EmptyState
          title="Пока нет выданных работ"
          description="Создайте работу и выдайте её группе — результаты лягут в журнал"
          cta="Создать работу"
          onCta={() => navigate('/app/worksheets/test')}
        />
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

      {view === 'lemma' && !!sessions.length && (
        <Space style={{ marginTop: 12 }} wrap size={[8, 6]}>
          <Text type="secondary" style={{ fontSize: 12 }}>Легенда:</Text>
          <SubmitChip kind="passed">сдал / зачёт</SubmitChip>
          <SubmitChip kind="late">с опозданием</SubmitChip>
          <SubmitChip kind="failed">незачёт</SubmitChip>
          <SubmitChip kind="overdue">просрочено</SubmitChip>
          <SubmitChip kind="in_progress">выполняет</SubmitChip>
          <Chip tone="neutral" dot={false}>не сдавал</Chip>
        </Space>
      )}
    </div>
  );
}
