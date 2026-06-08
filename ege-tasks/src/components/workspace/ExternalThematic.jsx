import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App, Button, Card, Empty, InputNumber, Modal, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography,
} from 'antd';
import { ExportOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../shared/services/pocketbase';
import { useReferenceData } from '../../contexts/ReferenceDataContext';

const { Title, Text } = Typography;

const TASK_NUMS = Array.from({ length: 21 }, (_, i) => i + 1);

// Ссылка на задачу на «Решу ЕГЭ» (базовый) по problem_id.
const problemUrl = (id) => `https://mathb-ege.sdamgia.ru/problem?id=${id}`;

// Цвет ячейки по проценту верных (светлые тинты, тёмный текст).
function pctColor(p) {
  if (p == null) return 'transparent';
  if (p < 50) return '#ffccc7';
  if (p < 70) return '#ffe7ba';
  if (p < 85) return '#fffb8f';
  return '#d9f7be';
}

export default function ExternalThematic() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { egeBaseTopics } = useReferenceData();

  const [exams, setExams] = useState([]);
  const [taskResults, setTaskResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState(null);
  const [threshold, setThreshold] = useState(60);
  const [perTopic, setPerTopic] = useState(3);
  const [building, setBuilding] = useState(false);
  const [drill, setDrill] = useState(null); // { taskNum, student? }
  const [onlyStudent, setOnlyStudent] = useState(true);

  const openDrill = (taskNum, student) => {
    setOnlyStudent(!!student);
    setDrill({ taskNum, student: student || null });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, t] = await Promise.all([api.getExtExams(), api.getExtTaskResultsAll()]);
      setExams(e);
      setTaskResults(t);
    } catch {
      message.error('Не удалось загрузить разбор по темам');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  // ege_number → тема ege_base
  const topicByNum = useMemo(() => {
    const m = new Map();
    for (const t of egeBaseTopics || []) if (t.ege_number) m.set(t.ege_number, t);
    return m;
  }, [egeBaseTopics]);

  const groupNames = useMemo(
    () => Array.from(new Set(exams.map((e) => e.group_name).filter(Boolean))).sort(),
    [exams],
  );

  // exam_id → group_name
  const examGroup = useMemo(() => new Map(exams.map((e) => [e.exam_id, e.group_name])), [exams]);

  // Отфильтрованные по группе потасковые результаты.
  const filtered = useMemo(
    () => (groupFilter ? taskResults.filter((r) => examGroup.get(r.exam_id) === groupFilter) : taskResults),
    [taskResults, groupFilter, examGroup],
  );

  // Агрегация: per student × task_number и общий по классу.
  const { students, cell, classStat } = useMemo(() => {
    const cellMap = new Map(); // `${student}|${n}` → {correct,total}
    const classMap = new Map(); // n → {correct,total}
    const studentSet = new Set();
    for (const r of filtered) {
      const n = r.task_number;
      if (!n) continue;
      studentSet.add(r.student_name);
      const ck = `${r.student_name}|${n}`;
      const c = cellMap.get(ck) || { correct: 0, total: 0 };
      c.total += 1; if (r.is_correct) c.correct += 1;
      cellMap.set(ck, c);
      const cl = classMap.get(n) || { correct: 0, total: 0 };
      cl.total += 1; if (r.is_correct) cl.correct += 1;
      classMap.set(n, cl);
    }
    return {
      students: Array.from(studentSet).sort((a, b) => a.localeCompare(b, 'ru')),
      cell: cellMap,
      classStat: classMap,
    };
  }, [filtered]);

  const pct = (o) => (o && o.total ? Math.round((o.correct / o.total) * 100) : null);

  // Слабые темы (ниже порога) для работы над ошибками.
  const weakTopics = useMemo(() => {
    const res = [];
    for (const n of TASK_NUMS) {
      const p = pct(classStat.get(n));
      if (p != null && p < threshold) {
        const topic = topicByNum.get(n);
        if (topic) res.push({ n, p, topic });
      }
    }
    return res;
  }, [classStat, threshold, topicByNum]);

  // Данные разбора по выбранному заданию.
  const examMeta = useMemo(() => {
    const m = new Map();
    for (const e of exams) m.set(e.exam_id, { date: e.date, title: e.title });
    return m;
  }, [exams]);

  const drillRows = useMemo(() => {
    if (!drill) return [];
    let rows = filtered
      .filter((r) => r.task_number === drill.taskNum)
      .map((r) => ({ ...r, ...(examMeta.get(r.exam_id) || {}) }));
    if (onlyStudent && drill.student) rows = rows.filter((r) => r.student_name === drill.student);
    return rows.sort(
      (a, b) => a.student_name.localeCompare(b.student_name, 'ru') || (new Date(a.date || 0) - new Date(b.date || 0)),
    );
  }, [drill, onlyStudent, filtered, examMeta]);

  const drillTopic = drill ? topicByNum.get(drill.taskNum) : null;
  const drillStat = drill ? pct(classStat.get(drill.taskNum)) : null;

  const handleRemediation = async () => {
    if (!weakTopics.length) { message.info('Нет тем ниже порога — класс справляется'); return; }
    setBuilding(true);
    try {
      const ids = [];
      for (const w of weakTopics) {
        const ts = await api.getRandomTasks(perTopic, { topic: w.topic.id });
        ids.push(...ts.map((x) => x.id));
      }
      if (!ids.length) { message.warning('Не нашлось задач по слабым темам в банке'); return; }
      const title = `Работа над ошибками${groupFilter ? ` — ${groupFilter}` : ''} (${new Date().toLocaleDateString('ru-RU')})`;
      const work = await api.createWork({ title, class: 11 });
      await api.createVariant({
        work: work.id, number: 1, tasks: ids,
        order: ids.map((id, i) => ({ taskId: id, position: i })),
      });
      message.success('Работа собрана — открываю редактор');
      navigate(`/app/works/${work.id}/edit`);
    } catch (e) {
      console.error(e);
      message.error('Не удалось собрать работу над ошибками');
    } finally {
      setBuilding(false);
    }
  };

  const columns = useMemo(() => {
    const first = {
      title: 'Ученик', key: 'student', fixed: 'left', width: 170,
      render: (_, row) => row.classRow ? <Text strong>Класс ({students.length})</Text> : <Text>{row.student}</Text>,
    };
    const taskCols = TASK_NUMS.map((n) => {
      const topic = topicByNum.get(n);
      return {
        title: (
          <Tooltip title={`${topic?.title || `Задание ${n}`} — нажмите для разбора`}>
            <div style={{ minWidth: 28, textAlign: 'center', cursor: 'pointer' }} onClick={() => openDrill(n, null)}>{n}</div>
          </Tooltip>
        ),
        key: n,
        width: 44,
        align: 'center',
        onCell: (row) => {
          const o = row.classRow ? classStat.get(n) : cell.get(`${row.student}|${n}`);
          const p = pct(o);
          return {
            style: { background: pctColor(p), padding: '4px 2px', fontWeight: row.classRow ? 600 : 400, cursor: o ? 'pointer' : 'default' },
            onClick: o ? () => openDrill(n, row.classRow ? null : row.student) : undefined,
          };
        },
        render: (_, row) => {
          const o = row.classRow ? classStat.get(n) : cell.get(`${row.student}|${n}`);
          const p = pct(o);
          if (p == null) return <span style={{ color: '#bbb' }}>·</span>;
          return <Tooltip title={`${o.correct}/${o.total}`}><span>{p}</span></Tooltip>;
        },
      };
    });
    return [first, ...taskCols];
  }, [students, topicByNum, classStat, cell]);

  const dataSource = useMemo(() => {
    const rows = [{ key: '__class__', classRow: true }];
    for (const s of students) rows.push({ key: s, student: s });
    return rows;
  }, [students]);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;

  if (!exams.length) {
    return <Empty description="Внешних работ пока нет — нужна синхронизация из «Журнал ЕГЭ»" />;
  }

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <Space wrap>
          <Text type="secondary">Тепловая карта по заданиям ЕГЭ (база) · % верных</Text>
          {groupNames.length > 0 && (
            <Select
              allowClear size="small" style={{ minWidth: 160 }} placeholder="Все группы"
              value={groupFilter} onChange={setGroupFilter}
              options={groupNames.map((g) => ({ value: g, label: g }))}
            />
          )}
        </Space>
        <Space wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>порог слабой темы</Text>
          <InputNumber size="small" min={10} max={100} value={threshold} onChange={(v) => setThreshold(v || 60)} addonAfter="%" style={{ width: 110 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>задач/тему</Text>
          <InputNumber size="small" min={1} max={10} value={perTopic} onChange={(v) => setPerTopic(v || 3)} style={{ width: 60 }} />
          <Tooltip title={weakTopics.length ? `Слабых тем: ${weakTopics.length}` : 'Нет тем ниже порога'}>
            <Button type="primary" icon={<ThunderboltOutlined />} loading={building} onClick={handleRemediation}>
              Работа над ошибками{weakTopics.length ? ` (${weakTopics.length})` : ''}
            </Button>
          </Tooltip>
        </Space>
      </Space>

      {!students.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет потасковых данных по выбранной группе" />
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            size="small"
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            scroll={{ x: 'max-content' }}
            rowClassName={(r) => (r.classRow ? 'ext-class-row' : '')}
          />
        </Card>
      )}

      {!!weakTopics.length && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Слабые темы (ниже {threshold}%): </Text>
          {weakTopics.map((w) => (
            <Tooltip key={w.n} title={w.topic.title}>
              <Text style={{ marginRight: 10, fontSize: 12 }}>№{w.n} — {w.p}%</Text>
            </Tooltip>
          ))}
        </div>
      )}

      <Space style={{ marginTop: 12 }} wrap size={[8, 4]}>
        <Text type="secondary" style={{ fontSize: 12 }}>Шкала:</Text>
        <Text style={{ background: '#ffccc7', padding: '0 8px', borderRadius: 4 }}>&lt;50%</Text>
        <Text style={{ background: '#ffe7ba', padding: '0 8px', borderRadius: 4 }}>50–70%</Text>
        <Text style={{ background: '#fffb8f', padding: '0 8px', borderRadius: 4 }}>70–85%</Text>
        <Text style={{ background: '#d9f7be', padding: '0 8px', borderRadius: 4 }}>≥85%</Text>
      </Space>

      <Modal
        open={!!drill}
        onCancel={() => setDrill(null)}
        footer={null}
        width={680}
        title={drill ? `Задание №${drill.taskNum}${drillTopic ? ` — ${drillTopic.title}` : ''}` : ''}
      >
        {drill && (
          <>
            <Space style={{ marginBottom: 12 }} wrap>
              <Tag color="blue">Класс: {drillStat != null ? `${drillStat}% верных` : '—'}</Tag>
              {drill.student && (
                <Space size={6}>
                  <Switch size="small" checked={onlyStudent} onChange={setOnlyStudent} />
                  <Text type="secondary" style={{ fontSize: 12 }}>только {drill.student}</Text>
                </Space>
              )}
              {drillTopic && (
                <Button size="small" type="link" icon={<ThunderboltOutlined />}
                  onClick={async () => {
                    try {
                      const ts = await api.getRandomTasks(perTopic, { topic: drillTopic.id });
                      if (!ts.length) { message.warning('Нет задач по теме в банке'); return; }
                      const work = await api.createWork({ title: `Отработка №${drill.taskNum} — ${drillTopic.title}`, class: 11 });
                      await api.createVariant({ work: work.id, number: 1, tasks: ts.map((x) => x.id), order: ts.map((x, i) => ({ taskId: x.id, position: i })) });
                      navigate(`/app/works/${work.id}/edit`);
                    } catch { message.error('Не удалось собрать отработку'); }
                  }}>
                  Отработать тему
                </Button>
              )}
            </Space>
            <Table
              size="small"
              rowKey="id"
              dataSource={drillRows}
              pagination={false}
              scroll={{ y: 360 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет данных" /> }}
              rowClassName={(r) => (r.is_correct ? '' : 'ext-drill-wrong')}
              columns={[
                { title: 'Ученик', dataIndex: 'student_name', key: 's', width: 180 },
                {
                  title: 'Работа', key: 'w', width: 150,
                  render: (_, r) => (
                    <Tooltip title={r.title || ''}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{r.date ? dayjs(r.date).format('DD.MM.YY') : (r.title || '—')}</Text>
                    </Tooltip>
                  ),
                },
                {
                  title: 'Задача', key: 'p', width: 120,
                  render: (_, r) => r.problem_id
                    ? <a href={problemUrl(r.problem_id)} target="_blank" rel="noreferrer">№{r.problem_id} <ExportOutlined /></a>
                    : <Text type="secondary">—</Text>,
                },
                {
                  title: 'Итог', key: 'res', width: 80, align: 'center',
                  render: (_, r) => r.is_correct ? <Tag color="green">верно</Tag> : <Tag color="red">ошибка</Tag>,
                },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
