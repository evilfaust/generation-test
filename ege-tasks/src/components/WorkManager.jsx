import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Tag, Empty, Spin, Modal, Typography, Tabs, Input, Select, Progress, Tooltip, App } from 'antd';
import {
  DeleteOutlined, SendOutlined, ReloadOutlined, EyeOutlined, EditOutlined,
  RightOutlined, InboxOutlined, SolutionOutlined, TeamOutlined,
  ClockCircleOutlined, SearchOutlined, SortAscendingOutlined, FormOutlined,
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useAuth } from '../contexts/AuthContext';
import SessionPanel from './worksheet/SessionPanel';
import ParallelVariantsModal from './worksheet/ParallelVariantsModal';
import TeacherResultsDashboard from './worksheet/TeacherResultsDashboard';
import MathRenderer from './MathRenderer';
import { PageHeader, StatRow, Stat, FilterRow } from '../ui';
import './WorkManager.css';

const { Text } = Typography;
const { Option } = Select;

const WorkManager = ({ onEditWork, onEditMCTest }) => {
  const { message, modal } = App.useApp();
  const { topics } = useReferenceData();
  const { canEdit, canDelete } = useAuth();

  const [activeTab, setActiveTab] = useState('works');
  const [mcTests, setMcTests] = useState([]);
  const [mcSessionsByTest, setMcSessionsByTest] = useState({});
  const [mcAttemptsByTest, setMcAttemptsByTest] = useState({});
  const [mcExpandedId, setMcExpandedId] = useState(null);
  const [mcLoading, setMcLoading] = useState(false);

  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workStats, setWorkStats] = useState({});
  const [sessionsByWork, setSessionsByWork] = useState({});
  const [expandedWorkId, setExpandedWorkId] = useState(null);
  const [previewVariants, setPreviewVariants] = useState({});
  const [previewLoading, setPreviewLoading] = useState({});

  // Filters
  const [parallelOpen, setParallelOpen] = useState(false);
  const [parallelBase, setParallelBase] = useState([]);
  const openParallel = async (e, workId) => {
    e.stopPropagation();
    try {
      const vars = await api.getVariantsByWork(workId);
      const tasks = vars[0]?.expand?.tasks || [];
      if (!tasks.length) { message.warning('В первом варианте работы нет задач'); return; }
      setParallelBase(tasks.map(t => ({ id: t.id })));
      setParallelOpen(true);
    } catch (err) {
      message.error('Не удалось загрузить работу');
    }
  };

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [topicFilter, setTopicFilter] = useState(null);
  const [sortBy, setSortBy] = useState('date_desc');

  // Load works
  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      const archived = statusFilter === 'archived';
      const data = await api.getWorks({
        archived: statusFilter === 'all' ? undefined : archived,
        search: searchText || undefined,
        topic: topicFilter || undefined,
      });
      setWorks(data);
      await loadStats(data);
    } catch (err) {
      console.error('Error loading works:', err);
      message.error('Ошибка загрузки работ');
    }
    setLoading(false);
  }, [searchText, statusFilter, topicFilter]);

  const loadStats = useCallback(async (workList) => {
    const ids = workList.map(w => w.id);
    if (!ids.length) {
      setWorkStats({});
      setSessionsByWork({});
      return;
    }

    try {
      const sessions = await api.getSessionsByWorks(ids);
      const sessionIds = sessions.map(s => s.id);
      const attempts = sessionIds.length > 0 ? await api.getAttemptsBySessions(sessionIds) : [];

      const stats = {};
      const sessMap = {};
      ids.forEach(id => {
        stats[id] = { sessions: 0, attempts: 0, avgScore: null, totalScore: 0, totalMax: 0 };
        sessMap[id] = [];
      });

      sessions.forEach(s => {
        if (!stats[s.work]) stats[s.work] = { sessions: 0, attempts: 0, avgScore: null, totalScore: 0, totalMax: 0 };
        stats[s.work].sessions += 1;
        if (!sessMap[s.work]) sessMap[s.work] = [];
        sessMap[s.work].push(s);
      });

      const sessionToWork = new Map(sessions.map(s => [s.id, s.work]));

      attempts.forEach(a => {
        const workId = sessionToWork.get(a.session);
        if (!workId || !stats[workId]) return;
        stats[workId].attempts += 1;
        stats[workId].totalScore += (a.score || 0);
        stats[workId].totalMax += (a.total || 0);
      });

      Object.keys(stats).forEach(workId => {
        const { totalMax, totalScore } = stats[workId];
        stats[workId].avgScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;
      });

      setWorkStats(stats);
      setSessionsByWork(sessMap);
    } catch (error) {
      console.error('Error loading work stats:', error);
      setWorkStats({});
      setSessionsByWork({});
    }
  }, []);

  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  // Load MC tests + sessions/attempts
  const loadMcTests = useCallback(async () => {
    setMcLoading(true);
    try {
      const tests = await api.getMCTests();
      setMcTests(tests);
      const sessByTest = {};
      const attByTest = {};
      await Promise.all(tests.map(async (mc) => {
        const sessions = await api.getSessionsByMCTest(mc.id);
        sessByTest[mc.id] = sessions;
        if (sessions.length) {
          const att = await api.getAttemptsBySessions(sessions.map(s => s.id));
          attByTest[mc.id] = att;
        } else {
          attByTest[mc.id] = [];
        }
      }));
      setMcSessionsByTest(sessByTest);
      setMcAttemptsByTest(attByTest);
    } catch (err) {
      console.error('Error loading MC tests:', err);
      message.error('Ошибка загрузки MC-тестов');
    }
    setMcLoading(false);
  }, [message]);

  useEffect(() => {
    if (activeTab === 'mc' && mcTests.length === 0 && !mcLoading) {
      loadMcTests();
    }
  }, [activeTab, mcTests.length, mcLoading, loadMcTests]);

  const handleDeleteMcTest = (e, mcId, mcTitle) => {
    e.stopPropagation();
    modal.confirm({
      title: `Удалить «${mcTitle || 'тест'}»?`,
      content: 'Также будут удалены все связанные сессии и попытки. Действие необратимо.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.deleteMCTest(mcId);
          message.success('Тест удалён');
          setMcTests([]);
          loadMcTests();
        } catch (err) {
          message.error('Ошибка: ' + (err.message || ''));
        }
      },
    });
  };

  // Load variants for preview
  const loadVariants = useCallback(async (workId) => {
    if (previewVariants[workId]) return;
    setPreviewLoading(prev => ({ ...prev, [workId]: true }));
    try {
      const variants = await api.getVariantsByWork(workId);
      setPreviewVariants(prev => ({ ...prev, [workId]: variants }));
    } catch (err) {
      console.error('Error loading variants:', err);
      message.error('Ошибка загрузки вариантов');
    }
    setPreviewLoading(prev => ({ ...prev, [workId]: false }));
  }, [previewVariants]);

  // Expand/collapse card
  const toggleExpanded = useCallback((workId) => {
    setExpandedWorkId(prev => {
      const newId = prev === workId ? null : workId;
      if (newId) loadVariants(newId);
      return newId;
    });
  }, [loadVariants]);

  // Delete work
  const handleDelete = (e, workId, workTitle) => {
    e.stopPropagation();
    Modal.confirm({
      title: 'Удалить работу?',
      content: `Вы уверены, что хотите удалить работу «${workTitle}»? Все варианты, сессии и результаты учеников будут удалены.`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.deleteWork(workId);
          setWorks(prev => prev.filter(w => w.id !== workId));
          if (expandedWorkId === workId) setExpandedWorkId(null);
          message.success(`Работа «${workTitle}» удалена`);
        } catch (err) {
          message.error('Ошибка при удалении');
        }
      },
    });
  };

  // Archive/unarchive
  const handleArchiveToggle = async (e, work) => {
    e.stopPropagation();
    try {
      if (work.archived) {
        await api.unarchiveWork(work.id);
        message.success('Работа возвращена из архива');
      } else {
        await api.archiveWork(work.id);
        message.success('Работа перемещена в архив');
      }
      await loadWorks();
    } catch (error) {
      message.error('Ошибка при архивировании');
    }
  };

  // Navigate to editor
  const handleEditWork = (e, workId) => {
    e.stopPropagation();
    onEditWork?.(workId);
  };

  // Computed stats for hero cards
  const heroStats = useMemo(() => {
    const allStats = Object.values(workStats);
    const totalWorks = works.length;
    const activeWorks = works.filter(w => !w.archived).length;
    const totalAttempts = allStats.reduce((sum, s) => sum + s.attempts, 0);
    const totalScore = allStats.reduce((sum, s) => sum + s.totalScore, 0);
    const totalMax = allStats.reduce((sum, s) => sum + s.totalMax, 0);
    const avgScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;

    return { totalWorks, activeWorks, totalAttempts, avgScore };
  }, [works, workStats]);

  // Filtered + sorted works
  const filteredWorks = useMemo(() => {
    let result = [...works];

    // Filter by status (has attempts)
    if (statusFilter === 'with_attempts') {
      result = result.filter(w => (workStats[w.id]?.attempts || 0) > 0);
    }

    // Sort
    switch (sortBy) {
      case 'date_desc':
        result.sort((a, b) => new Date(b.created) - new Date(a.created));
        break;
      case 'date_asc':
        result.sort((a, b) => new Date(a.created) - new Date(b.created));
        break;
      case 'attempts':
        result.sort((a, b) => (workStats[b.id]?.attempts || 0) - (workStats[a.id]?.attempts || 0));
        break;
      case 'avg_score':
        result.sort((a, b) => (workStats[b.id]?.avgScore ?? -1) - (workStats[a.id]?.avgScore ?? -1));
        break;
      default:
        break;
    }

    return result;
  }, [works, statusFilter, sortBy, workStats]);

  // Get session for a work (first one)
  const getSessionForWork = useCallback((workId) => {
    const sessions = sessionsByWork[workId];
    if (!sessions || sessions.length === 0) return null;
    return sessions[0];
  }, [sessionsByWork]);

  // Score color — использует токены Hybrid
  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'var(--ink-4)';
    if (score >= 80) return 'var(--lvl-1)';
    if (score >= 60) return 'var(--lvl-2)';
    return 'var(--lvl-3)';
  };

  // Loading skeleton
  if (loading && works.length === 0) {
    return (
      <div className="wm-dashboard">
        <div className="wm-skeleton-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="wm-skeleton-card" />)}
        </div>
        {[1, 2, 3].map(i => <div key={i} className="wm-skeleton-section" />)}
      </div>
    );
  }

  // Render variant preview tab content
  const renderVariantPreview = (workId) => {
    const variants = previewVariants[workId];
    const isLoading = previewLoading[workId];

    if (isLoading) {
      return <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>;
    }

    if (!variants || variants.length === 0) {
      return <Empty description="Нет вариантов" />;
    }

    return (
      <Tabs
        size="small"
        type="card"
        items={variants.map((variant, idx) => ({
          key: variant.id,
          label: `Вариант ${variant.number || idx + 1}`,
          children: (
            <div className="wm-variant-preview">
              {(variant.expand?.tasks || []).map((task, tIdx) => {
                const taskImageUrl = api.getTaskImageUrl(task);

                return (
                  <div key={task.id} className="wm-variant-task">
                    <div className="wm-variant-task-num">{tIdx + 1}</div>
                    <div className="wm-variant-task-content">
                      <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        {task.code && <Tag style={{ margin: 0 }}>{task.code}</Tag>}
                        {task.difficulty && (
                          <Tag
                            style={{ margin: 0 }}
                            color={{ 1: 'green', 2: 'orange', 3: 'red', 4: 'purple', 5: 'cyan' }[task.difficulty] || 'default'}
                          >
                            {{ 1: 'Базовый', 2: 'Средний', 3: 'Повышенный', 4: 'Высокий', 5: 'Олимпиадный' }[task.difficulty] || `Ур.${task.difficulty}`}
                          </Tag>
                        )}
                      </div>
                      <MathRenderer text={task.statement_md} />
                      {taskImageUrl && (
                        <div className="wm-variant-task-image">
                          <img src={taskImageUrl} alt="" />
                        </div>
                      )}
                      <div className="wm-variant-task-answer">
                        <Text type="secondary">Ответ: </Text>
                        <MathRenderer text={task.answer} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ),
        }))}
      />
    );
  };

  const worksContent = (
    <>
      {/* Hero Metrics */}
      <StatRow cols={4}>
        <Stat label="Всего работ"  value={heroStats.totalWorks}  sub="сохранено" />
        <Stat label="Активных"     value={heroStats.activeWorks} sub="не в архиве" />
        <Stat label="Попыток"      value={heroStats.totalAttempts} sub="всего" />
        <Stat
          label="Средний балл"
          value={heroStats.avgScore !== null ? `${heroStats.avgScore}%` : '—'}
          sub="по всем работам"
          accent={heroStats.avgScore >= 80 ? 'good' : heroStats.avgScore >= 60 ? 'warn' : heroStats.avgScore !== null ? 'bad' : undefined}
        />
      </StatRow>

      {/* Filters */}
      <FilterRow>
        <Input
          style={{ flex: 1, maxWidth: 320 }}
          placeholder="Поиск по названию..."
          prefix={<SearchOutlined style={{ color: 'var(--ink-4)' }} />}
          allowClear
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onPressEnter={loadWorks}
        />
        <Select style={{ minWidth: 140 }} value={statusFilter} onChange={setStatusFilter}>
          <Option value="all">Все</Option>
          <Option value="active">Активные</Option>
          <Option value="archived">Архив</Option>
          <Option value="with_attempts">С попытками</Option>
        </Select>
        <Select
          allowClear
          placeholder="Тема"
          value={topicFilter}
          onChange={v => setTopicFilter(v || null)}
          showSearch
          optionFilterProp="children"
          style={{ minWidth: 180 }}
        >
          {topics.map(t => (
            <Option key={t.id} value={t.id}>{t.ege_number ? `№${t.ege_number} — ` : ''}{t.title}</Option>
          ))}
        </Select>
        <Select
          value={sortBy}
          onChange={setSortBy}
          style={{ minWidth: 180, marginLeft: 'auto' }}
          suffixIcon={<SortAscendingOutlined />}
        >
          <Option value="date_desc">Сначала новые</Option>
          <Option value="date_asc">Сначала старые</Option>
          <Option value="attempts">По попыткам</Option>
          <Option value="avg_score">По среднему баллу</Option>
        </Select>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
          {filteredWorks.length} из {works.length}
        </span>
      </FilterRow>

      {/* Work Cards */}
      {filteredWorks.length === 0 ? (
        <div className="wm-empty">
          <div className="wm-empty-icon"><SolutionOutlined /></div>
          <div className="wm-empty-text">Нет работ</div>
          <div className="wm-empty-hint">
            Создайте контрольную работу в разделе «Контрольные работы» и сохраните её
          </div>
        </div>
      ) : (
        <div className="wm-work-list">
          {filteredWorks.map(work => {
            const isExpanded = expandedWorkId === work.id;
            const stats = workStats[work.id] || {};
            const session = getSessionForWork(work.id);
            const timeLimit = Number(work.time_limit);
            const hasPositiveTimeLimit = Number.isFinite(timeLimit) && timeLimit > 0;

            return (
              <div
                key={work.id}
                className={`wm-work-card ${isExpanded ? 'wm-work-card--expanded' : ''} ${work.archived ? 'wm-work-card--archived' : ''}`}
              >
                {/* Card Header */}
                <div className="wm-work-card-header" onClick={() => toggleExpanded(work.id)}>
                  <div className="wm-work-card-expand">
                    <RightOutlined />
                  </div>

                  <div className="wm-work-card-main">
                    <div className="wm-work-card-title">
                      {work.title || 'Без названия'}
                      {work.archived && (
                        <span className="wm-status-badge wm-status-badge--archived">Архив</span>
                      )}
                      {session?.is_open && (
                        <span className="wm-status-badge wm-status-badge--open">Приём открыт</span>
                      )}
                      {session && !session.is_open && stats.attempts > 0 && (
                        <span className="wm-status-badge wm-status-badge--closed">Приём закрыт</span>
                      )}
                    </div>
                    <div className="wm-work-card-meta">
                      <span className="wm-work-card-date">
                        {new Date(work.created).toLocaleDateString('ru-RU', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                      {hasPositiveTimeLimit && (
                        <Tag icon={<ClockCircleOutlined />} style={{ margin: 0 }}>{timeLimit} мин</Tag>
                      )}
                      {work.expand?.topic && (
                        <Tag color="purple" style={{ margin: 0 }}>
                          {work.expand.topic.ege_number ? `№${work.expand.topic.ege_number} — ` : ''}{work.expand.topic.title}
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="wm-work-card-stats">
                    {stats.attempts > 0 && (
                      <>
                        <div className="wm-work-card-stat">
                          <div className="wm-work-card-stat-value">{stats.attempts}</div>
                          <div className="wm-work-card-stat-label">попыток</div>
                        </div>
                        {stats.avgScore !== null && (
                          <div className="wm-work-card-progress">
                            <Tooltip title={`Средний результат: ${stats.avgScore}%`}>
                              <Progress
                                percent={stats.avgScore}
                                size="small"
                                strokeColor={getScoreColor(stats.avgScore)}
                                format={p => `${p}%`}
                              />
                            </Tooltip>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="wm-work-card-actions" onClick={e => e.stopPropagation()}>
                    <Tooltip title="Просмотр вариантов">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => toggleExpanded(work.id)}
                      />
                    </Tooltip>
                    {canEdit && onEditWork && (
                      <Tooltip title="Редактировать">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={e => handleEditWork(e, work.id)}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title="Параллельный вариант (по образцу)">
                      <Button
                        type="text"
                        size="small"
                        onClick={e => openParallel(e, work.id)}
                      >
                        🧬
                      </Button>
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title={work.archived ? 'Вернуть из архива' : 'В архив'}>
                        <Button
                          type="text"
                          size="small"
                          icon={<InboxOutlined />}
                          onClick={e => handleArchiveToggle(e, work)}
                        />
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title="Удалить">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={e => handleDelete(e, work.id, work.title)}
                        />
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Expanded Body */}
                {isExpanded && (
                  <div className="wm-work-card-body">
                    <Tabs
                      defaultActiveKey="session"
                      items={[
                        {
                          key: 'session',
                          label: (
                            <span><SendOutlined /> Выдача</span>
                          ),
                          children: <SessionPanel workId={work.id} />,
                        },
                        {
                          key: 'results',
                          label: (
                            <span><TeamOutlined /> Результаты{stats.attempts > 0 ? ` (${stats.attempts})` : ''}</span>
                          ),
                          children: session ? (
                            <TeacherResultsDashboard sessionId={session.id} />
                          ) : (
                            <Empty description="Нет активной сессии. Откройте вкладку «Выдача», чтобы создать сессию." />
                          ),
                        },
                        {
                          key: 'variants',
                          label: (
                            <span><EyeOutlined /> Варианты</span>
                          ),
                          children: renderVariantPreview(work.id),
                        },
                      ]}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const mcContent = (
    <div className="wm-mc-list">
      {mcLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : mcTests.length === 0 ? (
        <div className="wm-empty">
          <div className="wm-empty-icon"><FormOutlined /></div>
          <div className="wm-empty-text">Нет MC-тестов</div>
          <div className="wm-empty-hint">
            Создайте тест в разделе «Тесты с выбором» и сохраните его
          </div>
        </div>
      ) : (
        mcTests.map(mc => {
          const isExpanded = mcExpandedId === mc.id;
          const sessions = mcSessionsByTest[mc.id] || [];
          const session = sessions[0];
          const attempts = mcAttemptsByTest[mc.id] || [];
          const variantsCount = Array.isArray(mc.variants) ? mc.variants.length : 0;
          const tasksCount = Array.isArray(mc.variants)
            ? mc.variants.reduce((s, v) => s + (v.tasks?.length || 0), 0)
            : 0;
          return (
            <div
              key={mc.id}
              className={`wm-work-card ${isExpanded ? 'wm-work-card--expanded' : ''}`}
            >
              <div className="wm-work-card-header" onClick={() => setMcExpandedId(prev => prev === mc.id ? null : mc.id)}>
                <div className="wm-work-card-expand"><RightOutlined /></div>
                <div className="wm-work-card-main">
                  <div className="wm-work-card-title">
                    {mc.title || 'Без названия'}
                    <Tag color="purple" style={{ marginLeft: 8 }}>MC-тест</Tag>
                    {session?.is_open && (
                      <span className="wm-status-badge wm-status-badge--open">Приём открыт</span>
                    )}
                  </div>
                  <div className="wm-work-card-meta">
                    <span className="wm-work-card-date">
                      {new Date(mc.created).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <Tag style={{ margin: 0 }}>Вариантов: {variantsCount}</Tag>
                    <Tag style={{ margin: 0 }}>Задач: {tasksCount}</Tag>
                    {mc.shuffle_mode === 'per_student' && (
                      <Tag color="cyan" style={{ margin: 0 }}>Перемешивать у каждого</Tag>
                    )}
                    {attempts.length > 0 && (
                      <Tag color="green" style={{ margin: 0 }}>Попыток: {attempts.length}</Tag>
                    )}
                  </div>
                </div>
                <div className="wm-work-card-actions" onClick={e => e.stopPropagation()}>
                  {canEdit && onEditMCTest && (
                    <Tooltip title="Открыть в редакторе">
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEditMCTest(mc.id)} />
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Удалить">
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={e => handleDeleteMcTest(e, mc.id, mc.title)} />
                    </Tooltip>
                  )}
                </div>
              </div>
              {isExpanded && (
                <div className="wm-work-card-body">
                  <Tabs
                    defaultActiveKey="session"
                    items={[
                      {
                        key: 'session',
                        label: <span><SendOutlined /> Выдача</span>,
                        children: <SessionPanel mcTestId={mc.id} />,
                      },
                      {
                        key: 'results',
                        label: <span><TeamOutlined /> Результаты{attempts.length > 0 ? ` (${attempts.length})` : ''}</span>,
                        children: session ? (
                          <TeacherResultsDashboard sessionId={session.id} />
                        ) : (
                          <Empty description="Нет активной сессии. Откройте вкладку «Выдача», чтобы создать сессию." />
                        ),
                      },
                    ]}
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="wm-dashboard">
      <PageHeader
        title="Мои работы"
        lede="контрольные, тесты, тесты с выбором"
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => activeTab === 'mc' ? loadMcTests() : loadWorks()}
            loading={activeTab === 'mc' ? mcLoading : loading}
          >
            Обновить
          </Button>
        }
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'works', label: <span><SolutionOutlined /> Контрольные работы</span>, children: worksContent },
          { key: 'mc', label: <span><FormOutlined /> Тесты с выбором</span>, children: mcContent },
        ]}
      />
      <ParallelVariantsModal
        open={parallelOpen}
        onClose={() => setParallelOpen(false)}
        baseTasks={parallelBase}
      />
    </div>
  );
};

export default WorkManager;
