import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { Button, Tag, Empty, Spin, Modal, Typography, Tabs, Input, Select, Progress, Tooltip, AutoComplete, App } from 'antd';
import {
  DeleteOutlined, SendOutlined, ReloadOutlined, EyeOutlined, EditOutlined,
  RightOutlined, InboxOutlined, SolutionOutlined, TeamOutlined,
  ClockCircleOutlined, SearchOutlined, SortAscendingOutlined, FormOutlined,
  PushpinOutlined, PushpinFilled, FolderOutlined, DownOutlined, CameraOutlined,
  ShareAltOutlined, CopyOutlined, UserOutlined, SwapOutlined, ImportOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import SessionPanel from './worksheet/SessionPanel';
import ParallelVariantsModal from './worksheet/ParallelVariantsModal';
import ScanBlankModal from './worksheet/ScanBlankModal';
import GeneratorSheetsTab from './worksheet/GeneratorSheetsTab';
import TeacherResultsDashboard from './worksheet/TeacherResultsDashboard';
import MathRenderer from './MathRenderer';
import { PageHeader, StatRow, Stat, FilterRow } from '../ui';
import './WorkManager.css';

const { Text } = Typography;
const { Option } = Select;

const WorkManager = ({ onEditWork, onEditMCTest }) => {
  const { message, modal } = App.useApp();
  const { topics } = useReferenceData();
  const { canEdit, canDelete, aiEnabled, teacher, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

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
  const [resultsSessionId, setResultsSessionId] = useState(null);
  const [previewVariants, setPreviewVariants] = useState({});
  const [previewLoading, setPreviewLoading] = useState({});

  // Filters
  const [parallelOpen, setParallelOpen] = useState(false);
  const [parallelBase, setParallelBase] = useState([]);
  const [parallelWork, setParallelWork] = useState({ id: null, title: '', classNumber: null });
  const [parallelExclude, setParallelExclude] = useState([]);
  const openParallel = async (e, work) => {
    e.stopPropagation();
    try {
      const vars = await api.getVariantsByWork(work.id);
      const tasks = vars[0]?.expand?.tasks || [];
      if (!tasks.length) { message.warning('В первом варианте работы нет задач'); return; }
      setParallelBase(tasks.map(t => ({ id: t.id })));
      // Задачи ОСТАЛЬНЫХ вариантов работы в параллели попадать не должны —
      // иначе «дубль» повторит вариант 2 оригинала и списывание не отследить.
      const baseIds = new Set(tasks.map(t => t.id));
      const others = vars.slice(1).flatMap(v => v.tasks || []).filter(id => !baseIds.has(id));
      setParallelExclude([...new Set(others)]);
      setParallelWork({ id: work.id, title: work.title || 'Работа', classNumber: work.class || null });
      setParallelOpen(true);
    } catch (err) {
      message.error('Не удалось загрузить работу');
    }
  };

  const [scanWork, setScanWork] = useState(null); // работа, для которой сканируем бланки

  // ── Общие работы (шаринг, v3.9.118) ──
  const [sharedWorks, setSharedWorks] = useState([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [cloningId, setCloningId] = useState(null);

  const loadSharedWorks = useCallback(async () => {
    setSharedLoading(true);
    try {
      setSharedWorks(await api.getSharedWorks());
    } catch (err) {
      console.error('Error loading shared works:', err);
      message.error('Ошибка загрузки общих работ');
    }
    setSharedLoading(false);
  }, [message]);

  // Владелец записи (или запись без owner — легаси) может управлять шарингом.
  const canShareWork = (work) => canEdit
    && (isSuperAdmin || !work.owner || work.owner === teacher?.id);

  const handleShareToggle = async (e, work) => {
    e.stopPropagation();
    const next = work.visibility === 'shared' ? 'private' : 'shared';
    try {
      await api.setWorkVisibility(work.id, next);
      setWorks(prev => prev.map(w => (w.id === work.id ? { ...w, visibility: next } : w)));
      message.success(next === 'shared'
        ? 'Работа теперь общая — коллеги увидят её во вкладке «Общие работы»'
        : 'Работа снова личная');
    } catch (err) {
      message.error('Не удалось изменить видимость');
    }
  };

  // ── Передача работы другому учителю (v3.9.121) ──
  const [transferWork, setTransferWork] = useState(null); // работа в модалке передачи
  const [transferTo, setTransferTo] = useState(null);
  const [teachersList, setTeachersList] = useState(null);
  const [transferBusy, setTransferBusy] = useState(false);

  const openTransfer = async (e, work) => {
    e.stopPropagation();
    setTransferTo(null);
    setTransferWork(work);
    if (teachersList === null) {
      try {
        setTeachersList(await api.getTeachers());
      } catch {
        setTeachersList([]);
        message.error('Не удалось загрузить список учителей');
      }
    }
  };

  const handleTransferWork = async () => {
    if (!transferWork || !transferTo) return;
    setTransferBusy(true);
    try {
      await api.transferWork(transferWork.id, transferTo);
      message.success('Работа и её выдачи переданы');
      setTransferWork(null);
      setTransferTo(null);
      loadWorks();
    } catch (err) {
      console.error('Error transferring work:', err);
      message.error('Не удалось передать работу');
    } finally {
      setTransferBusy(false);
    }
  };

  const handleCloneWork = async (work) => {
    setCloningId(work.id);
    try {
      const rec = await api.cloneWork(work.id);
      message.success(`Скопировано в «Мои работы»: ${rec.title}`);
      loadWorks(); // чтобы копия сразу была в списке «Контрольные работы»
    } catch (err) {
      console.error('Error cloning work:', err);
      message.error('Не удалось клонировать работу');
    }
    setCloningId(null);
  };

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [topicFilter, setTopicFilter] = useState(null);
  const [sortBy, setSortBy] = useState('date_desc');
  const [folderFilter, setFolderFilter] = useState(null);     // null=все, '__none__'=без папки, иначе имя папки
  const [folderModalWork, setFolderModalWork] = useState(null); // работа, которой задаём папку
  const [folderInput, setFolderInput] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wm.collapsedFolders') || '[]')); }
    catch { return new Set(); }
  });
  const toggleFolderCollapse = (key) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('wm.collapsedFolders', JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  };

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

  // Общие работы перезагружаем при каждом входе на вкладку (могли поделиться/клонировать)
  useEffect(() => {
    if (activeTab === 'shared') loadSharedWorks();
  }, [activeTab, loadSharedWorks]);

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
    setResultsSessionId(null);
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
  const handlePinToggle = async (e, work) => {
    e.stopPropagation();
    const next = !work.is_pinned;
    setWorks(prev => prev.map(w => (w.id === work.id ? { ...w, is_pinned: next } : w)));
    try {
      await api.updateWork(work.id, { is_pinned: next });
    } catch (error) {
      message.error('Не удалось изменить закрепление');
      setWorks(prev => prev.map(w => (w.id === work.id ? { ...w, is_pinned: !next } : w)));
    }
  };

  const openFolderModal = (e, work) => {
    e.stopPropagation();
    setFolderInput(work.folder || '');
    setFolderModalWork(work);
  };

  const handleSaveFolder = async () => {
    if (!folderModalWork) return;
    const folder = (folderInput || '').trim();
    const id = folderModalWork.id;
    setWorks(prev => prev.map(w => (w.id === id ? { ...w, folder } : w)));
    setFolderModalWork(null);
    try {
      await api.updateWork(id, { folder });
      message.success(folder ? `Работа в папке «${folder}»` : 'Работа убрана из папки');
    } catch {
      message.error('Не удалось сохранить папку');
    }
  };

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

    // Filter by folder
    if (folderFilter === '__none__') {
      result = result.filter(w => !w.folder);
    } else if (folderFilter) {
      result = result.filter(w => w.folder === folderFilter);
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

    // Закреплённые — наверх (стабильная сортировка сохраняет порядок внутри групп).
    result.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

    return result;
  }, [works, statusFilter, sortBy, folderFilter, workStats]);

  // Список существующих папок (для фильтра и подсказок).
  const folderOptions = useMemo(() => {
    const set = new Set(works.map(w => w.folder).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [works]);


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
        {folderOptions.length > 0 && (
          <Select
            allowClear
            placeholder="Папка"
            value={folderFilter}
            onChange={v => setFolderFilter(v || null)}
            style={{ minWidth: 160 }}
            suffixIcon={<FolderOutlined />}
          >
            <Option value="__none__">Без папки</Option>
            {folderOptions.map(f => (
              <Option key={f} value={f}>{f}</Option>
            ))}
          </Select>
        )}
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
        {canEdit && (
          <Tooltip title="Загрузить готовую работу текстом: задачи разойдутся по темам">
            <Button icon={<ImportOutlined />} onClick={() => navigate('/app/works/import')}>
              Импорт работы
            </Button>
          </Tooltip>
        )}
      </FilterRow>

      {/* Work Cards */}
      {filteredWorks.length === 0 ? (
        <div className="wm-empty">
          <div className="wm-empty-icon"><SolutionOutlined /></div>
          <div className="wm-empty-text">Нет работ</div>
          <div className="wm-empty-hint">
            Создайте контрольную работу в разделе «Контрольные работы» и сохраните её —
            или загрузите готовую работу коллеги кнопкой «Импорт работы»
          </div>
        </div>
      ) : (
        <div className="wm-work-list">
          {(() => {
            const renderWorkCard = (work) => {
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
                      {work.is_pinned && <PushpinFilled style={{ color: '#faad14', marginRight: 6 }} />}
                      {work.title || 'Без названия'}
                      {work.visibility === 'shared' && (
                        <Tag color="green" icon={<ShareAltOutlined />} style={{ marginLeft: 6 }}>Общая</Tag>
                      )}
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
                    {canEdit && (
                      <Tooltip title={work.is_pinned ? 'Открепить' : 'Закрепить наверху'}>
                        <Button
                          type="text"
                          size="small"
                          icon={work.is_pinned ? <PushpinFilled style={{ color: '#faad14' }} /> : <PushpinOutlined />}
                          onClick={e => handlePinToggle(e, work)}
                        />
                      </Tooltip>
                    )}
                    {canEdit && (
                      <Tooltip title={work.folder ? `Папка: ${work.folder}` : 'Положить в папку'}>
                        <Button
                          type="text"
                          size="small"
                          icon={<FolderOutlined style={work.folder ? { color: '#5b5bd6' } : undefined} />}
                          onClick={e => openFolderModal(e, work)}
                        />
                      </Tooltip>
                    )}
                    {canShareWork(work) && (
                      <Tooltip title={work.visibility === 'shared' ? 'Общая — сделать личной' : 'Поделиться с коллегами'}>
                        <Button
                          type="text"
                          size="small"
                          icon={<ShareAltOutlined style={work.visibility === 'shared' ? { color: '#52c41a' } : undefined} />}
                          onClick={e => handleShareToggle(e, work)}
                        />
                      </Tooltip>
                    )}
                    {canShareWork(work) && (
                      <Tooltip title="Передать работу другому учителю (с выдачами и результатами)">
                        <Button
                          type="text"
                          size="small"
                          icon={<SwapOutlined />}
                          onClick={e => openTransfer(e, work)}
                        />
                      </Tooltip>
                    )}
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
                        onClick={e => openParallel(e, work)}
                      >
                        🧬
                      </Button>
                    </Tooltip>
                    {canEdit && aiEnabled && (
                      <Tooltip title="Проверить бумажные бланки (фото)">
                        <Button
                          type="text"
                          size="small"
                          icon={<CameraOutlined />}
                          onClick={e => { e.stopPropagation(); setScanWork(work); }}
                        />
                      </Tooltip>
                    )}
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
                {isExpanded && (() => {
                  const workSessions = sessionsByWork[work.id] || [];
                  const activeSessionId = workSessions.some(s => s.id === resultsSessionId)
                    ? resultsSessionId
                    : workSessions[0]?.id || null;
                  return (
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
                          children: activeSessionId ? (
                            <div>
                              {workSessions.length > 1 && (
                                <div style={{ marginBottom: 8, textAlign: 'right' }}>
                                  <Select
                                    size="small"
                                    style={{ minWidth: 240 }}
                                    value={activeSessionId}
                                    onChange={setResultsSessionId}
                                    options={workSessions.map((s, i) => ({
                                      value: s.id,
                                      label: `Выдача ${workSessions.length - i} — ${new Date(s.created).toLocaleDateString('ru-RU')}${s.is_open ? ' · приём открыт' : ''}`,
                                    }))}
                                  />
                                </div>
                              )}
                              <TeacherResultsDashboard key={activeSessionId} sessionId={activeSessionId} />
                            </div>
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
                  );
                })()}
              </div>
            );
            };

            // Конкретная папка/без-папки или папок нет — плоский список (закреплённые уже наверху).
            if (folderFilter != null || folderOptions.length === 0) {
              return filteredWorks.map(renderWorkCard);
            }

            // Иначе — секции: 📌 Закреплённые (над всеми), затем папки, затем «Без папки».
            const pinned = filteredWorks.filter(w => w.is_pinned);
            const rest = filteredWorks.filter(w => !w.is_pinned);
            const byFolder = new Map();
            for (const w of rest) {
              const k = w.folder || '__none__';
              if (!byFolder.has(k)) byFolder.set(k, []);
              byFolder.get(k).push(w);
            }
            const groups = [];
            if (pinned.length) groups.push({ key: '__pinned__', label: 'Закреплённые', pinned: true, works: pinned });
            for (const f of folderOptions) if (byFolder.has(f)) groups.push({ key: f, label: f, works: byFolder.get(f) });
            if (byFolder.has('__none__')) groups.push({ key: '__none__', label: 'Без папки', works: byFolder.get('__none__') });

            return groups.map(g => {
              const collapsed = collapsedFolders.has(g.key);
              return (
                <Fragment key={g.key}>
                  <div
                    className="wm-folder-header wm-folder-header--toggle"
                    onClick={() => toggleFolderCollapse(g.key)}
                    role="button"
                  >
                    {collapsed ? <RightOutlined /> : <DownOutlined />}
                    {g.pinned ? <PushpinFilled style={{ color: '#faad14' }} /> : <FolderOutlined />}
                    <span className="wm-folder-header-label">{g.label}</span>
                    <span className="wm-folder-count">{g.works.length}</span>
                  </div>
                  {!collapsed && g.works.map(renderWorkCard)}
                </Fragment>
              );
            });
          })()}
        </div>
      )}

      <Modal
        open={!!folderModalWork}
        title="Папка работы"
        onCancel={() => setFolderModalWork(null)}
        onOk={handleSaveFolder}
        okText="Сохранить"
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          Папка — простой ярлык для группировки работ. Очистите поле, чтобы убрать из папки.
        </Typography.Paragraph>
        <AutoComplete
          style={{ width: '100%' }}
          placeholder="Например: Каникулы 10А, Устный счёт, Контрольные…"
          value={folderInput}
          onChange={setFolderInput}
          options={folderOptions.map(f => ({ value: f }))}
          filterOption={(input, opt) => (opt?.value || '').toLowerCase().includes(input.toLowerCase())}
          allowClear
        />
      </Modal>
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

  // ── Вкладка «Общие работы»: работы коллег с visibility=shared ──
  const sharedContent = (
    <div>
      {sharedLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : sharedWorks.length === 0 ? (
        <Empty
          style={{ padding: 32 }}
          description="Общих работ пока нет. Нажмите «Поделиться» (значок ⤴) на своей работе — и коллеги увидят её здесь."
        />
      ) : (
        <div className="wm-work-list">
          {sharedWorks.map(work => {
            const isMine = !work.owner || work.owner === teacher?.id;
            const author = work.expand?.owner;
            return (
              <div key={work.id} className="wm-work-card">
                <div className="wm-work-card-header" style={{ cursor: 'default' }}>
                  <div className="wm-work-card-main">
                    <div className="wm-work-card-title">
                      {work.title || 'Без названия'}
                      {isMine && <Tag color="blue" style={{ marginLeft: 8 }}>моя</Tag>}
                    </div>
                    <div className="wm-work-card-meta">
                      <span><UserOutlined /> {author?.name || author?.username || 'учитель'}</span>
                      <span className="wm-work-card-date">
                        {new Date(work.created).toLocaleDateString('ru-RU', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                      {work.expand?.topic && (
                        <Tag color="purple" style={{ margin: 0 }}>
                          {work.expand.topic.ege_number ? `№${work.expand.topic.ege_number} — ` : ''}{work.expand.topic.title}
                        </Tag>
                      )}
                      {Number(work.time_limit) > 0 && (
                        <Tag icon={<ClockCircleOutlined />} style={{ margin: 0 }}>{work.time_limit} мин</Tag>
                      )}
                    </div>
                  </div>
                  <div className="wm-work-card-actions">
                    {canEdit && (
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        loading={cloningId === work.id}
                        onClick={() => handleCloneWork(work)}
                      >
                        Клонировать себе
                      </Button>
                    )}
                    {isMine && canShareWork(work) && (
                      <Tooltip title="Сделать личной (убрать из общих)">
                        <Button
                          type="text"
                          size="small"
                          icon={<ShareAltOutlined style={{ color: '#52c41a' }} />}
                          onClick={async (e) => { await handleShareToggle(e, work); loadSharedWorks(); }}
                        />
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
            onClick={() => activeTab === 'mc' ? loadMcTests() : (activeTab === 'shared' ? loadSharedWorks() : loadWorks())}
            loading={activeTab === 'mc' ? mcLoading : (activeTab === 'shared' ? sharedLoading : loading)}
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
          { key: 'shared', label: <span><ShareAltOutlined /> Общие работы</span>, children: sharedContent },
          // Листы генераторов — отдельная сущность (generator_sheets), не работы:
          // задания живут снимком внутри листа и в банк задач не попадают.
          { key: 'sheets', label: <span><ExperimentOutlined /> Листы генераторов</span>, children: <GeneratorSheetsTab /> },
        ]}
      />
      <ParallelVariantsModal
        open={parallelOpen}
        onClose={() => setParallelOpen(false)}
        baseTasks={parallelBase}
        baseWorkId={parallelWork.id}
        baseTitle={parallelWork.title}
        classNumber={parallelWork.classNumber}
        excludeTaskIds={parallelExclude}
        onOpenWork={onEditWork}
      />
      <ScanBlankModal
        open={!!scanWork}
        work={scanWork}
        onClose={() => setScanWork(null)}
        onRecorded={loadWorks}
      />
      <Modal
        open={!!transferWork}
        title={`Передать работу «${transferWork?.title || ''}»`}
        onCancel={() => { setTransferWork(null); setTransferTo(null); }}
        onOk={handleTransferWork}
        confirmLoading={transferBusy}
        okText="Передать"
        cancelText="Отмена"
        okButtonProps={{ disabled: !transferTo }}
        destroyOnHidden
      >
        <Text type="secondary">
          Работа уйдёт выбранному учителю вместе со всеми выдачами и результатами.
          {!isSuperAdmin && ' После передачи вы перестанете её видеть.'}
        </Text>
        <Select
          style={{ width: '100%', marginTop: 12 }}
          placeholder="Выберите учителя"
          loading={teachersList === null}
          value={transferTo}
          onChange={setTransferTo}
          options={(teachersList || [])
            .filter(t => t.id !== teacher?.id && t.id !== transferWork?.owner && t.username !== 'journal-sync')
            .map(t => ({ value: t.id, label: `${t.name || t.username} — @${t.username}` }))}
          showSearch
          optionFilterProp="label"
        />
      </Modal>
    </div>
  );
};

export default WorkManager;
