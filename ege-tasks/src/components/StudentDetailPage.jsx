import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button, Table, Tag, Progress, Space, Spin, Typography, Popover, Segmented, Modal, Input, Checkbox, message } from 'antd';
import { CheckCircleOutlined, CopyOutlined, FileAddOutlined } from '@ant-design/icons';
import {
  ArrowLeftOutlined, LineChartOutlined, BookOutlined,
  WarningOutlined, HistoryOutlined, TrophyOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import MathRenderer from './MathRenderer';
import './StudentDetailPage.css';

const { Title, Text } = Typography;

// ============================================
// Attempt Details — expandable row content
// ============================================
const AttemptDetails = ({ answers }) => {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggle = (id) => setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  if (!answers || !answers.length) {
    return <div className="sdp-attempt-empty">Нет данных об ответах</div>;
  }
  return (
    <div className="sdp-attempt-details">
      {answers.map((ans) => {
        const task = ans.expand?.task;
        const topic = task?.expand?.topic;
        const isExpanded = expandedIds.has(ans.id);
        const hasStatement = !!(task?.statement_md || task?.statement);
        const taskImageUrl = task ? api.getTaskImageUrl(task) : null;
        return (
          <div
            key={ans.id}
            className={`sdp-attempt-row ${ans.is_correct ? 'sdp-attempt-row--ok' : 'sdp-attempt-row--err'}`}
          >
            <div className="sdp-attempt-row-main">
              <span className="sdp-attempt-status">{ans.is_correct ? '✓' : '✗'}</span>
              {task?.code && <span className="sdp-attempt-code">{task.code}</span>}
              {topic && <span className="sdp-attempt-topic">{topic.title}</span>}
              <span className="sdp-attempt-answers">
                <span className={ans.is_correct ? 'sdp-ans-ok' : 'sdp-ans-err'}>
                  {ans.answer_raw || '—'}
                </span>
                {!ans.is_correct && task?.answer && (
                  <span className="sdp-ans-right">→ {task.answer}</span>
                )}
              </span>
              {(hasStatement || taskImageUrl) && (
                <Button
                  size="small"
                  type={isExpanded ? 'default' : 'link'}
                  onClick={() => toggle(ans.id)}
                  className="sdp-attempt-stmt-btn"
                >
                  {isExpanded ? 'Скрыть' : 'Условие'}
                </Button>
              )}
            </div>
            {isExpanded && (
              <div className="sdp-attempt-statement">
                {hasStatement && (
                  <MathRenderer text={task.statement_md || task.statement} />
                )}
                {taskImageUrl && (
                  <img src={taskImageUrl} alt="" className="sdp-attempt-stmt-img" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// SVG Line Chart with tooltip + click
// ============================================
const ScoreChart = ({ data, onPointClick }) => {
  const [tooltip, setTooltip] = useState(null);

  if (data.length < 2) return null;

  const W = 640, H = 170;
  const PAD = { top: 14, right: 16, bottom: 30, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * plotW,
    y: PAD.top + plotH - (d.percent / 100) * plotH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`;

  const maxLabels = 8;
  const step = data.length > maxLabels ? Math.ceil(data.length / maxLabels) : 1;
  const dayCountMap = data.reduce((acc, item) => {
    const key = item.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());

  const getColor = (pct) => pct >= 70 ? '#52c41a' : pct >= 40 ? '#faad14' : '#ff4d4f';

  return (
    <div className="sdp-chart-wrap" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="sdp-chart"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="sdpChartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4361ee" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4361ee" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map(v => {
          const y = PAD.top + plotH - (v / 100) * plotH;
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e8e8e8" strokeDasharray="4,4" />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#8c8c8c" fontFamily="Inter, -apple-system, sans-serif">{v}%</text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#sdpChartGrad)" />
        <path d={linePath} fill="none" stroke="#4361ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Invisible hit areas for easy hover */}
        {points.map((p, i) => (
          <circle
            key={`hit-${i}`}
            cx={p.x} cy={p.y} r="14"
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setTooltip({ xPct: p.x / W, yPct: p.y / H, point: p })}
            onClick={() => onPointClick?.(p)}
          />
        ))}
        {/* Visible dots */}
        {points.map((p, i) => {
          const color = getColor(p.percent);
          const isHovered = tooltip?.point === p;
          return (
            <circle
              key={`dot-${i}`}
              cx={p.x} cy={p.y}
              r={isHovered ? 6 : 4}
              fill="#fff"
              stroke={color}
              strokeWidth={isHovered ? 2.5 : 2}
              style={{ pointerEvents: 'none' }}
            />
          );
        })}
        {/* X axis labels */}
        {points.map((p, i) => {
          if (i % step !== 0 && i !== data.length - 1) return null;
          const dayLabel = p.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
          const isDuplicateDay = (dayCountMap.get(dayLabel) || 0) > 1;
          const dateStr = isDuplicateDay
            ? `${dayLabel} ${p.date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
            : dayLabel;
          return (
            <text key={`d-${i}`} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#8c8c8c" fontFamily="Inter, -apple-system, sans-serif">
              {dateStr}
            </text>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="sdp-chart-tooltip"
          style={{
            left: `${tooltip.xPct * 100}%`,
            top: `${tooltip.yPct * 100}%`,
          }}
        >
          <div className="sdp-chart-tooltip-title">{tooltip.point.title}</div>
          <div className="sdp-chart-tooltip-date">
            {tooltip.point.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div className="sdp-chart-tooltip-score" style={{ color: getColor(tooltip.point.percent) }}>
            {tooltip.point.percent}%
            {tooltip.point.score !== undefined && ` (${tooltip.point.score}/${tooltip.point.total})`}
          </div>
          <div className="sdp-chart-tooltip-hint">Нажмите, чтобы выделить</div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Helpers
// ============================================
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  if (m === 0) return `${seconds} сек`;
  return `${m} мин`;
};

const difficultyLabels = { 1: 'Базовый', 2: 'Средний', 3: 'Повышенный', 4: 'Высокий', 5: 'Олимпиадный' };
const difficultyColors = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f', 4: '#a8071a', 5: '#722ed1' };

const normalizeUnlockedIds = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => (typeof item === 'string' ? item : item?.id)).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(i => typeof i === 'string' ? i : i?.id).filter(Boolean) : [];
    } catch { return []; }
  }
  return [];
};

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Всё время' },
  { value: '3months', label: '3 месяца' },
  { value: 'month', label: 'Месяц' },
];

const SECTION_ORDER = ['Алгебра', 'Геометрия'];

// ============================================
// MAIN COMPONENT
// ============================================
function StudentDetailPage({ studentId, onBack, onOpenWork }) {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [allAnswers, setAllAnswers] = useState(null);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [expandedWeakTasks, setExpandedWeakTasks] = useState(() => new Set());
  const [isWeakTasksOpen, setIsWeakTasksOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [highlightedAttemptId, setHighlightedAttemptId] = useState(null);

  const [isErrorWorkModalOpen, setIsErrorWorkModalOpen] = useState(false);
  const [selectedWeakTaskIds, setSelectedWeakTaskIds] = useState(() => new Set());
  const [errorWorkTitle, setErrorWorkTitle] = useState('');
  const [errorWorkCreating, setErrorWorkCreating] = useState(false);
  const [errorWorkResult, setErrorWorkResult] = useState(null); // { work, session }

  const historySectionRef = useRef(null);
  const highlightTimerRef = useRef(null);

  const buildStudentUrl = (sessionId) => {
    const base = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/student`;
    return `${base}/${sessionId}`;
  };

  // Загрузка основных данных
  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [students, attemptsData, achievementsData] = await Promise.all([
          api.getStudents(),
          api.getAttemptsByStudentAllWithWorks(studentId),
          api.getAchievements(),
        ]);

        const studentRecord = students.find(s => s.id === studentId);
        setStudent(studentRecord || null);

        const finished = attemptsData.filter(a => a.status === 'submitted' || a.status === 'corrected');
        finished.sort((a, b) => new Date(b.created) - new Date(a.created));
        setAttempts(finished);
        setAchievements(achievementsData);
      } catch (err) {
        console.error('Error loading student detail:', err);
      }
      setLoading(false);
    };
    load();
  }, [studentId]);

  // Автозагрузка ответов через 300ms
  useEffect(() => {
    if (!attempts.length) return;
    const timer = setTimeout(async () => {
      setAnswersLoading(true);
      try {
        const ids = attempts.map(a => a.id);
        const answers = await api.getAttemptAnswersByAttemptsDetailed(ids);
        setAllAnswers(answers);
      } catch (err) {
        console.error('Error loading answers:', err);
        setAllAnswers([]);
      }
      setAnswersLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [attempts]);

  useEffect(() => () => clearTimeout(highlightTimerRef.current), []);

  // ============ COMPUTED ============

  const filteredAttempts = useMemo(() => {
    if (periodFilter === 'all') return attempts;
    const cutoff = new Date();
    if (periodFilter === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (periodFilter === '3months') cutoff.setMonth(cutoff.getMonth() - 3);
    return attempts.filter(a => new Date(a.submitted_at || a.created) >= cutoff);
  }, [attempts, periodFilter]);

  const filteredAnswers = useMemo(() => {
    if (!allAnswers) return null;
    if (periodFilter === 'all') return allAnswers;
    const ids = new Set(filteredAttempts.map(a => a.id));
    return allAnswers.filter(ans => ids.has(ans.attempt));
  }, [allAnswers, filteredAttempts, periodFilter]);

  // Для expandable rows — все ответы сгруппированы по попытке (без фильтра периода)
  const allAnswersByAttempt = useMemo(() => {
    if (!allAnswers) return new Map();
    const map = new Map();
    allAnswers.forEach(ans => {
      const aid = ans.attempt;
      if (!map.has(aid)) map.set(aid, []);
      map.get(aid).push(ans);
    });
    return map;
  }, [allAnswers]);

  const stats = useMemo(() => {
    if (!filteredAttempts.length) return null;
    const workIds = new Set();
    filteredAttempts.forEach(a => {
      const workId = a.expand?.session?.expand?.work?.id || a.expand?.session?.work
        || a.expand?.session?.expand?.mc_test?.id || a.expand?.session?.mc_test;
      if (workId) workIds.add(workId);
    });
    const totalScore = filteredAttempts.reduce((s, a) => s + (a.score || 0), 0);
    const totalTasks = filteredAttempts.reduce((s, a) => s + (a.total || 0), 0);
    const avgPercent = totalTasks > 0 ? Math.round((totalScore / totalTasks) * 100) : 0;
    const bestPercent = filteredAttempts.reduce((best, a) => {
      const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
      return Math.max(best, pct);
    }, 0);
    const withTime = filteredAttempts.filter(a => a.duration_seconds > 0);
    const avgTime = withTime.length > 0
      ? Math.round(withTime.reduce((s, a) => s + a.duration_seconds, 0) / withTime.length)
      : 0;

    // Тренд: последние 3 попытки vs предыдущие 3
    const sorted = [...filteredAttempts]
      .filter(a => a.total > 0)
      .sort((a, b) => new Date(a.submitted_at || a.created) - new Date(b.submitted_at || b.created));
    const recent = sorted.slice(-3);
    const prev = sorted.slice(-6, -3);
    let trend = null;
    if (recent.length >= 1 && prev.length >= 1) {
      const recentAvg = Math.round(recent.reduce((s, a) => s + (a.score / a.total) * 100, 0) / recent.length);
      const prevAvg = Math.round(prev.reduce((s, a) => s + (a.score / a.total) * 100, 0) / prev.length);
      trend = recentAvg - prevAvg;
    }

    return { totalWorks: workIds.size, totalAttempts: filteredAttempts.length, avgPercent, bestPercent, avgTime, trend };
  }, [filteredAttempts]);

  const chartData = useMemo(() => {
    return filteredAttempts
      .filter(a => a.total > 0)
      .map(a => ({
        id: a.id,
        date: new Date(a.submitted_at || a.created),
        percent: Math.round((a.score / a.total) * 100),
        title: a.expand?.session?.expand?.work?.title || a.expand?.session?.expand?.mc_test?.title || 'Тест',
        score: a.score,
        total: a.total,
      }))
      .sort((a, b) => a.date - b.date);
  }, [filteredAttempts]);

  const topicStats = useMemo(() => {
    if (!filteredAnswers) return null;
    const byTopic = new Map();
    filteredAnswers.forEach(answer => {
      const topic = answer.expand?.task?.expand?.topic;
      if (!topic) return;
      if (!byTopic.has(topic.id)) {
        byTopic.set(topic.id, {
          id: topic.id,
          title: topic.title,
          section: topic.section || '',
          correct: 0,
          total: 0,
        });
      }
      const entry = byTopic.get(topic.id);
      entry.total++;
      if (answer.is_correct) entry.correct++;
    });
    return Array.from(byTopic.values())
      .map(t => ({ ...t, percent: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0 }))
      .sort((a, b) => a.percent - b.percent);
  }, [filteredAnswers]);

  const openErrorWorkModal = () => {
    if (!weakTasks?.length) return;
    setSelectedWeakTaskIds(new Set(weakTasks.map(t => t.key)));
    setErrorWorkTitle(`Работа над ошибками — ${student.name || student.username}`);
    setErrorWorkResult(null);
    setIsErrorWorkModalOpen(true);
  };

  const handleCreateErrorWork = async () => {
    const taskIds = [...selectedWeakTaskIds];
    if (!taskIds.length) return;
    setErrorWorkCreating(true);
    try {
      const work = await api.createWork({
        title: errorWorkTitle || 'Работа над ошибками',
        ...(student.student_class ? { class: student.student_class } : {}),
      });
      const order = taskIds.map((id, idx) => ({ taskId: id, position: idx }));
      await api.createVariant({
        work: work.id,
        number: 1,
        tasks: taskIds,
        order,
      });
      const session = await api.createSession({
        work: work.id,
        is_open: true,
        achievements_enabled: true,
        student_title: 'Работа над ошибками',
      });
      setErrorWorkResult({ work, session });
    } catch (err) {
      console.error('Error creating error work:', err);
      message.error('Не удалось создать работу. Попробуйте ещё раз.');
    }
    setErrorWorkCreating(false);
  };

  const topicsBySection = useMemo(() => {
    if (!topicStats || !topicStats.length) return null;
    const groups = {};
    topicStats.forEach(t => {
      const s = SECTION_ORDER.includes(t.section) ? t.section : 'Другое';
      if (!groups[s]) groups[s] = [];
      groups[s].push(t);
    });
    return groups;
  }, [topicStats]);

  const sectionKeys = useMemo(() => {
    if (!topicsBySection) return [];
    return [...SECTION_ORDER, 'Другое'].filter(s => topicsBySection[s]);
  }, [topicsBySection]);

  const weakTasks = useMemo(() => {
    if (!filteredAnswers) return null;
    const byTaskId = new Map();
    filteredAnswers.forEach(answer => {
      const task = answer.expand?.task;
      if (!task) return;
      const taskId = answer.task;
      if (!byTaskId.has(taskId)) {
        byTaskId.set(taskId, {
          key: taskId,
          task,
          topic: task.expand?.topic,
          totalAttempts: 0,
          wrongAttempts: 0,
          studentAnswers: [],
        });
      }
      const entry = byTaskId.get(taskId);
      entry.totalAttempts++;
      if (!answer.is_correct) entry.wrongAttempts++;
      if (!answer.is_correct && answer.answer_raw) {
        entry.studentAnswers.push(answer.answer_raw);
      }
    });
    return Array.from(byTaskId.values())
      .filter(t => t.wrongAttempts > 0)
      .map(t => ({ ...t, errorRate: Math.round((t.wrongAttempts / t.totalAttempts) * 100) }))
      .sort((a, b) => b.errorRate !== a.errorRate ? b.errorRate - a.errorRate : b.wrongAttempts - a.wrongAttempts);
  }, [filteredAnswers]);

  const achievementsById = useMemo(() => new Map(achievements.map(a => [a.id, a])), [achievements]);

  const earnedAchievementIds = useMemo(() => {
    const ids = new Set();
    attempts.forEach(a => {
      if (a.achievement) ids.add(typeof a.achievement === 'string' ? a.achievement : a.achievement);
      normalizeUnlockedIds(a.unlocked_achievements).forEach(id => ids.add(id));
    });
    return ids;
  }, [attempts]);

  const toggleWeakTaskExpanded = (taskId) => {
    setExpandedWeakTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleChartPointClick = (point) => {
    setHighlightedAttemptId(point.id);
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAttemptId(null), 3000);
    historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ============ COLUMNS ============

  const historyColumns = [
    {
      title: 'Дата',
      key: 'date',
      width: 120,
      render: (_, record) => {
        const d = new Date(record.submitted_at || record.created);
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
      },
    },
    {
      title: 'Работа',
      key: 'work',
      render: (_, record) => {
        const work = record.expand?.session?.expand?.work;
        const mcTest = record.expand?.session?.expand?.mc_test;
        const title = work?.title || mcTest?.title || 'Тест';
        const isMC = !!mcTest && !work?.id;
        return (
          <Space>
            <Text>{title}{isMC ? ' (тест с выбором)' : ''}</Text>
            {work?.id && (
              <Button size="small" type="link" onClick={() => onOpenWork?.(work.id)}>Открыть</Button>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Результат',
      key: 'score',
      width: 160,
      render: (_, record) => {
        const pct = record.total ? Math.round((record.score / record.total) * 100) : 0;
        const color = pct >= 70 ? '#52c41a' : pct >= 40 ? '#faad14' : '#ff4d4f';
        return (
          <Space>
            <Progress type="circle" size={36} percent={pct} strokeColor={color}
              format={() => <span style={{ fontSize: 11, fontWeight: 700 }}>{pct}%</span>} />
            <Text type="secondary">{record.score}/{record.total}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Время',
      key: 'duration',
      width: 90,
      render: (_, record) => <Text type="secondary">{formatDuration(record.duration_seconds)}</Text>,
    },
    {
      title: 'Достижения',
      key: 'achievements',
      width: 120,
      render: (_, record) => {
        const ids = [
          ...(record.achievement ? [record.achievement] : []),
          ...normalizeUnlockedIds(record.unlocked_achievements),
        ];
        if (!ids.length) return <Text type="secondary">—</Text>;
        const names = ids.map(id => achievementsById.get(id)?.title).filter(Boolean);
        return (
          <Popover content={<div>{names.map((n, i) => <div key={i}>{n}</div>)}</div>} trigger="hover">
            <Tag color="gold" style={{ cursor: 'pointer' }}>{ids.length} шт.</Tag>
          </Popover>
        );
      },
    },
  ];

  // ============ RENDER ============

  if (loading) {
    return (
      <div className="sdp-page">
        <div className="sdp-loading">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: '#4361ee' }} spin />} />
          <p>Загрузка данных ученика...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="sdp-page">
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад к списку</Button>
        <div className="sdp-loading">
          <p>Ученик не найден</p>
        </div>
      </div>
    );
  }

  const noDataInPeriod = filteredAttempts.length === 0 && periodFilter !== 'all';

  return (
    <div className="sdp-page">
      {/* S1: Header */}
      <div className="sdp-header">
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
        <div className="sdp-student-info">
          <Title level={3} className="sdp-student-name">{student.name || student.username}</Title>
          <div className="sdp-student-meta">
            {student.student_class && <Tag color="geekblue">{student.student_class} класс</Tag>}
            <Tag>@{student.username}</Tag>
            <Text type="secondary">
              Регистрация: {new Date(student.created).toLocaleDateString('ru-RU')}
            </Text>
            <Text type="secondary">
              Попыток: {attempts.length}
            </Text>
          </div>
        </div>
      </div>

      {/* Period Filter */}
      <div className="sdp-period-bar">
        <Text type="secondary" className="sdp-period-label">Период анализа:</Text>
        <Segmented
          value={periodFilter}
          onChange={setPeriodFilter}
          options={PERIOD_OPTIONS}
          size="small"
        />
      </div>

      {noDataInPeriod && (
        <div className="sdp-empty-period">
          Нет попыток за выбранный период.{' '}
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setPeriodFilter('all')}>
            Показать всё время
          </Button>
        </div>
      )}

      {/* S2: Hero Stats */}
      {stats && (
        <div className="sdp-stats-grid">
          <div className="sdp-hero-card sdp-hero-card--works">
            <div className="sdp-hero-label">Работ выполнено</div>
            <div className="sdp-hero-value">{stats.totalWorks}</div>
            <div className="sdp-hero-suffix">{stats.totalAttempts} попыток</div>
          </div>
          <div className="sdp-hero-card sdp-hero-card--avg">
            <div className="sdp-hero-label">Средний балл</div>
            <div className="sdp-hero-value">{stats.avgPercent}%</div>
            <div className="sdp-hero-suffix">по всем работам</div>
            {stats.trend !== null && (
              <div className={`sdp-hero-trend ${
                stats.trend > 0 ? 'sdp-hero-trend--up'
                : stats.trend < 0 ? 'sdp-hero-trend--down'
                : 'sdp-hero-trend--flat'
              }`}>
                {stats.trend > 0 ? '▲' : stats.trend < 0 ? '▼' : '—'}
                {' '}{Math.abs(stats.trend)}%
                <span className="sdp-hero-trend-sub"> vs пред. 3</span>
              </div>
            )}
          </div>
          <div className="sdp-hero-card sdp-hero-card--best">
            <div className="sdp-hero-label">Лучший результат</div>
            <div className="sdp-hero-value">{stats.bestPercent}%</div>
            <div className="sdp-hero-suffix">рекордный результат</div>
          </div>
          <div className="sdp-hero-card sdp-hero-card--time">
            <div className="sdp-hero-label">Среднее время</div>
            <div className="sdp-hero-value">{formatDuration(stats.avgTime)}</div>
            <div className="sdp-hero-suffix">на работу</div>
          </div>
        </div>
      )}

      {/* S3: Score Chart */}
      {chartData.length >= 2 && (
        <div className="sdp-section sdp-section--chart">
          <Title level={4} className="sdp-section-title">
            <LineChartOutlined /> Динамика результатов
          </Title>
          <ScoreChart data={chartData} onPointClick={handleChartPointClick} />
        </div>
      )}

      {/* S4: Topic Breakdown */}
      <div className="sdp-section">
        <Title level={4} className="sdp-section-title">
          <BookOutlined /> Результаты по темам
        </Title>
        {answersLoading && <div className="sdp-answers-loading"><Spin size="small" /> Загрузка...</div>}
        {topicsBySection && sectionKeys.length > 0 && (
          <div className="sdp-topic-list">
            {sectionKeys.map(section => (
              <div key={section} className="sdp-topic-section">
                {sectionKeys.length > 1 && (
                  <div className="sdp-topic-section-header">{section}</div>
                )}
                {topicsBySection[section].map(topic => {
                  const level = topic.percent >= 70 ? 'good' : topic.percent >= 40 ? 'ok' : 'bad';
                  return (
                    <div key={topic.id} className="sdp-topic-row">
                      <div className="sdp-topic-name" title={topic.title}>{topic.title}</div>
                      <div className="sdp-topic-bar-wrap">
                        <div className={`sdp-topic-bar sdp-topic-bar--${level}`} style={{ width: `${topic.percent}%` }} />
                      </div>
                      <div className="sdp-topic-info">
                        <span className={`sdp-topic-pct sdp-topic-pct--${level}`}>{topic.percent}%</span>
                        <span className="sdp-topic-count">{topic.correct}/{topic.total}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {topicStats && topicStats.length === 0 && (
          <div className="sdp-empty-section">Нет данных по темам</div>
        )}
      </div>

      {/* S5: Weak Tasks */}
      <div className="sdp-section sdp-weak-tasks">
        <Title level={4} className="sdp-section-title">
          <WarningOutlined style={{ color: '#ff4d4f' }} /> Проблемные задачи
          {weakTasks && weakTasks.length > 0 && (
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 400, marginLeft: 8 }}>
              ({weakTasks.length})
            </Text>
          )}
          <Space style={{ marginLeft: 'auto' }}>
            {isWeakTasksOpen && weakTasks && weakTasks.length > 0 && (
              <Button
                size="small"
                icon={<FileAddOutlined />}
                onClick={openErrorWorkModal}
              >
                Создать работу над ошибками
              </Button>
            )}
            <Button
              size="small"
              type={isWeakTasksOpen ? 'default' : 'link'}
              onClick={() => setIsWeakTasksOpen(v => !v)}
            >
              {isWeakTasksOpen ? 'Скрыть' : 'Показать'}
            </Button>
          </Space>
        </Title>
        {isWeakTasksOpen && answersLoading && <div className="sdp-answers-loading"><Spin size="small" /> Загрузка...</div>}
        {isWeakTasksOpen && weakTasks && weakTasks.length > 0 && (
          <div className="sdp-weak-list">
            {weakTasks.map((record) => {
              const d = record.task.difficulty;
              const errorColor = record.errorRate >= 70 ? '#ff4d4f' : record.errorRate >= 40 ? '#faad14' : '#52c41a';
              const isExpanded = expandedWeakTasks.has(record.key);
              const uniqueWrongAnswers = [...new Set(record.studentAnswers)].slice(0, 4);
              const taskStatement = record.task.statement_md || record.task.statement || record.task.condition || 'Нет условия';
              const taskImageUrl = api.getTaskImageUrl(record.task);
              return (
                <div key={record.key} className="sdp-weak-card">
                  <div className="sdp-weak-card-header">
                    <div className="sdp-weak-card-meta">
                      <Text strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{record.task.code || '—'}</Text>
                      {record.topic && <Tag>{record.topic.title}</Tag>}
                      {d && (
                        <span style={{ color: difficultyColors[d], fontWeight: 600, fontSize: 12 }}>
                          {difficultyLabels[d]}
                        </span>
                      )}
                    </div>
                    <div className="sdp-weak-card-stats">
                      <span className="sdp-weak-card-error-count">
                        <Text type="danger" strong>{record.wrongAttempts}</Text>
                        <Text type="secondary"> / {record.totalAttempts}</Text>
                      </span>
                      <Progress
                        percent={record.errorRate}
                        size="small"
                        strokeColor={errorColor}
                        style={{ width: 100 }}
                        format={(pct) => `${pct}%`}
                      />
                      <Button size="small" type={isExpanded ? 'default' : 'link'} onClick={() => toggleWeakTaskExpanded(record.key)}>
                        {isExpanded ? 'Скрыть условие' : 'Условие'}
                      </Button>
                    </div>
                  </div>
                  <div className="sdp-weak-card-footer">
                    {uniqueWrongAnswers.length > 0 && (
                      <span className="sdp-weak-task-wrong">
                        <Text type="secondary">Ошибки: </Text>
                        {uniqueWrongAnswers.map((a, i) => (
                          <Tag key={i} color="red">{a}</Tag>
                        ))}
                        {record.studentAnswers.length > uniqueWrongAnswers.length && (
                          <Text type="secondary">+{record.studentAnswers.length - uniqueWrongAnswers.length}</Text>
                        )}
                      </span>
                    )}
                    {record.task.answer && (
                      <span className="sdp-weak-task-answer">
                        <Text type="secondary">Правильный ответ: </Text>
                        <Tag color="green">{record.task.answer}</Tag>
                      </span>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="sdp-weak-card-body">
                      <MathRenderer text={taskStatement} />
                      {taskImageUrl && (
                        <img
                          src={taskImageUrl}
                          alt={`Иллюстрация к задаче ${record.task.code || ''}`}
                          className="sdp-weak-task-image"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {isWeakTasksOpen && weakTasks && weakTasks.length === 0 && (
          <div className="sdp-empty-section">Нет ошибок — ученик отвечает на все задачи правильно!</div>
        )}
      </div>

      {/* S6: Attempt History */}
      <div className="sdp-section sdp-history" ref={historySectionRef}>
        <Title level={4} className="sdp-section-title">
          <HistoryOutlined /> История попыток ({attempts.length})
        </Title>
        <Table
          dataSource={attempts}
          columns={historyColumns}
          rowKey="id"
          pagination={attempts.length > 15 ? { pageSize: 15 } : false}
          size="small"
          rowClassName={(record) => record.id === highlightedAttemptId ? 'sdp-row-highlighted' : ''}
          expandable={{
            expandedRowRender: (record) => (
              answersLoading ? (
                <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ marginLeft: 8 }}>Загрузка ответов...</Text>
                </div>
              ) : (
                <AttemptDetails answers={allAnswersByAttempt.get(record.id) || []} />
              )
            ),
            rowExpandable: () => true,
          }}
        />
      </div>

      {/* S7: Achievements */}
      {earnedAchievementIds.size > 0 && (
        <div className="sdp-section">
          <Title level={4} className="sdp-section-title">
            <TrophyOutlined style={{ color: '#f5a623' }} /> Достижения ({earnedAchievementIds.size})
          </Title>
          <div className="sdp-achievements-wrap">
            {[...earnedAchievementIds].map(id => {
              const ach = achievementsById.get(id);
              if (!ach) return null;
              return (
                <Tag key={id} color="gold">
                  {ach.icon} {ach.title}
                </Tag>
              );
            })}
          </div>
        </div>
      )}
      {/* Error Work Modal */}
      <Modal
        open={isErrorWorkModalOpen}
        onCancel={() => setIsErrorWorkModalOpen(false)}
        title="Создать работу над ошибками"
        width={520}
        footer={
          errorWorkResult ? (
            <Space>
              <Button onClick={() => setIsErrorWorkModalOpen(false)}>Закрыть</Button>
              <Button
                type="primary"
                onClick={() => {
                  setIsErrorWorkModalOpen(false);
                  onOpenWork?.(errorWorkResult.work.id);
                }}
              >
                Открыть работу
              </Button>
            </Space>
          ) : (
            <Space>
              <Button onClick={() => setIsErrorWorkModalOpen(false)}>Отмена</Button>
              <Button
                type="primary"
                loading={errorWorkCreating}
                disabled={selectedWeakTaskIds.size === 0}
                onClick={handleCreateErrorWork}
              >
                Создать ({selectedWeakTaskIds.size} задач)
              </Button>
            </Space>
          )
        }
      >
        {errorWorkResult ? (
          <div className="sdp-ewm-success">
            <CheckCircleOutlined className="sdp-ewm-success-icon" />
            <div className="sdp-ewm-success-title">Работа создана!</div>
            <div className="sdp-ewm-success-name">{errorWorkResult.work.title}</div>
            <div className="sdp-ewm-url-row">
              <Input
                readOnly
                value={buildStudentUrl(errorWorkResult.session.id)}
                className="sdp-ewm-url-input"
              />
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(buildStudentUrl(errorWorkResult.session.id));
                  message.success('Ссылка скопирована');
                }}
              >
                Копировать
              </Button>
            </div>
          </div>
        ) : (
          <div className="sdp-ewm-body">
            <div className="sdp-ewm-field">
              <label className="sdp-ewm-label">Название работы</label>
              <Input
                value={errorWorkTitle}
                onChange={e => setErrorWorkTitle(e.target.value)}
                placeholder="Название работы"
              />
            </div>
            <div className="sdp-ewm-field">
              <div className="sdp-ewm-label-row">
                <label className="sdp-ewm-label">
                  Задачи ({selectedWeakTaskIds.size} из {weakTasks?.length})
                </label>
                <Space size={4}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={() => setSelectedWeakTaskIds(new Set(weakTasks.map(t => t.key)))}
                  >
                    Все
                  </Button>
                  <span style={{ color: '#d9d9d9' }}>|</span>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={() => setSelectedWeakTaskIds(new Set())}
                  >
                    Сбросить
                  </Button>
                </Space>
              </div>
              <div className="sdp-ewm-task-list">
                {weakTasks?.map(record => (
                  <label key={record.key} className="sdp-ewm-task-row">
                    <Checkbox
                      checked={selectedWeakTaskIds.has(record.key)}
                      onChange={e => {
                        setSelectedWeakTaskIds(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(record.key);
                          else next.delete(record.key);
                          return next;
                        });
                      }}
                    />
                    <span className="sdp-ewm-task-code">{record.task.code || '—'}</span>
                    {record.topic && (
                      <span className="sdp-ewm-task-topic">{record.topic.title}</span>
                    )}
                    <span className="sdp-ewm-task-rate" style={{
                      color: record.errorRate >= 70 ? '#ff4d4f' : record.errorRate >= 40 ? '#faad14' : '#52c41a'
                    }}>
                      {record.errorRate}% ошибок
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default StudentDetailPage;
