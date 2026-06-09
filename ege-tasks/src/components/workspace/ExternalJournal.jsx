import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Segmented, Select, Space, Spin, Table, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { api } from '../../shared/services/pocketbase';
import ExternalThematic from './ExternalThematic';
import { EmptyState, Chip } from './ui';

const { Text } = Typography;

// Оценка → тон чипа (шкала «хорошо→плохо»): 5 teal · 4 blue · 3 amber · 2 rose.
const GRADE_TONE = { 5: 'teal', 4: 'blue', 3: 'amber', 2: 'rose' };

function fmtDate(d) {
  if (!d) return '';
  const m = dayjs(d);
  return m.isValid() ? m.format('DD.MM.YY') : String(d).slice(0, 10);
}

export default function ExternalJournal() {
  const { message } = App.useApp();
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState(null);
  const [subView, setSubView] = useState('grades'); // grades | heat

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, r] = await Promise.all([api.getExtExams(), api.getExtResults()]);
      setExams(e);
      setResults(r);
    } catch {
      message.error('Не удалось загрузить внешние результаты');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const groupNames = useMemo(
    () => Array.from(new Set(exams.map((e) => e.group_name).filter(Boolean))).sort(),
    [exams],
  );

  const visibleExams = useMemo(
    () => exams.filter((e) => !groupFilter || e.group_name === groupFilter),
    [exams, groupFilter],
  );

  // cell map: `${student}|${exam_id}` → result
  const cellMap = useMemo(() => {
    const m = new Map();
    for (const r of results) m.set(`${r.student_name}|${r.exam_id}`, r);
    return m;
  }, [results]);

  const students = useMemo(() => {
    const examIds = new Set(visibleExams.map((e) => e.exam_id));
    const names = new Set();
    for (const r of results) if (examIds.has(r.exam_id)) names.add(r.student_name);
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [results, visibleExams]);

  const columns = useMemo(() => {
    const first = {
      title: 'Ученик', key: 'student', fixed: 'left', width: 200,
      render: (_, row) => <Text strong>{row.student}</Text>,
    };
    const examCols = visibleExams.map((e) => ({
      title: (
        <Tooltip title={e.title || e.exam_id}>
          <div style={{ minWidth: 90 }}>
            <div style={{ fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.title || `работа ${e.exam_id}`}
            </div>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>{fmtDate(e.date)}</Text>
          </div>
        </Tooltip>
      ),
      key: e.exam_id,
      width: 120,
      align: 'center',
      render: (_, row) => {
        const r = cellMap.get(`${row.student}|${e.exam_id}`);
        if (!r) return <Text type="secondary">—</Text>;
        if (r.did_not_take) return <Chip tone="neutral" dot={false}>н/б</Chip>;
        const grade = Number(r.grade) || 0;
        const tip = [
          grade ? `оценка ${grade}` : null,
          r.correct_count != null ? `верно ${r.correct_count}` : null,
          r.part1_score != null ? `ч.1: ${r.part1_score}` : null,
        ].filter(Boolean).join(' · ');
        return (
          <Chip tone={GRADE_TONE[grade] || 'neutral'} dot={false} title={tip}>
            {grade || (r.correct_count != null ? `${r.correct_count}` : '?')}
          </Chip>
        );
      },
    }));
    return [first, ...examCols];
  }, [visibleExams, cellMap]);

  const dataSource = useMemo(() => students.map((s) => ({ key: s, student: s })), [students]);

  const header = (
    <Space style={{ marginBottom: 12 }} wrap>
      <Segmented
        value={subView}
        onChange={setSubView}
        options={[
          { value: 'grades', label: 'Оценки' },
          { value: 'heat', label: 'Тепловая карта (темы)' },
        ]}
      />
    </Space>
  );

  if (subView === 'heat') {
    return <div>{header}<ExternalThematic /></div>;
  }

  if (loading) return <div>{header}<div style={{ textAlign: 'center', padding: 48 }}><Spin /></div></div>;

  if (!exams.length) {
    return (
      <div>
        {header}
        <EmptyState
          title="Внешних работ пока нет"
          description="Результаты приходят из приложения «Журнал ЕГЭ» (синхронизация решу.ЕГЭ)"
        />
      </div>
    );
  }

  return (
    <div>
      {header}
      <Space style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">Результаты внешних работ с решу.ЕГЭ</Text>
        {groupNames.length > 0 && (
          <Select
            allowClear
            size="small"
            style={{ minWidth: 180 }}
            placeholder="Все группы"
            value={groupFilter}
            onChange={setGroupFilter}
            options={groupNames.map((g) => ({ value: g, label: g }))}
          />
        )}
      </Space>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small"
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Card>
      <Space style={{ marginTop: 12 }} wrap size={[8, 6]}>
        <Text type="secondary" style={{ fontSize: 12 }}>Оценки:</Text>
        <Chip tone="teal" dot={false}>5</Chip>
        <Chip tone="blue" dot={false}>4</Chip>
        <Chip tone="amber" dot={false}>3</Chip>
        <Chip tone="rose" dot={false}>2</Chip>
        <Chip tone="neutral" dot={false}>н/б — не был</Chip>
      </Space>
    </div>
  );
}
