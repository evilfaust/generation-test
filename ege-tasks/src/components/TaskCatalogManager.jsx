import { useMemo, useState, useCallback } from 'react';
import { Tabs, Space, Button, Spin } from 'antd';
import { ReloadOutlined, AppstoreOutlined, TagsOutlined, CopyOutlined, BookOutlined, BarChartOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { normalizeLabel, normalizeStatementStrict, normalizeStatementLoose } from '../utils/normalize';
import TopicTab from './catalog/TopicTab';
import SubtopicTab from './catalog/SubtopicTab';
import TagTab from './catalog/TagTab';
import SourceTab from './catalog/SourceTab';
import OtherTab from './catalog/OtherTab';
import DuplicateTab from './catalog/DuplicateTab';
import VectorDuplicatesTab from './catalog/VectorDuplicatesTab';
import MergeModal from './catalog/MergeModal';
import './TaskCatalogManager.css';

const TaskCatalogManager = ({ onOpenTasks, onOpenWork, onBackToAnalytics }) => {
  const { topics, subtopics, tags, sources, years, tasksSnapshot, withAnswerCount, withSolutionCount, loading: refLoading, reloadData, reloadSnapshot } = useReferenceData();

  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeType, setMergeType] = useState(null);
  const [mergeFrom, setMergeFrom] = useState(null);

  // Ленивая загрузка statement_md для вкладки дубликатов
  const [duplicateTasksData, setDuplicateTasksData] = useState(null);
  const [duplicateTasksLoading, setDuplicateTasksLoading] = useState(false);

  const loadDuplicateTasks = useCallback(async () => {
    if (duplicateTasksData !== null) return; // уже загружено
    setDuplicateTasksLoading(true);
    try {
      const data = await api.getTasksForDuplicateCheck();
      setDuplicateTasksData(data);
    } finally {
      setDuplicateTasksLoading(false);
    }
  }, [duplicateTasksData]);

  const stats = useMemo(() => {
    const byTopic = new Map();
    const bySubtopic = new Map();
    const byTag = new Map();
    const bySource = new Map();
    const byDifficulty = new Map();
    const byYear = new Map();
    const hasAnswer = withAnswerCount;
    const hasSolution = withSolutionCount;
    const hasImage = tasksSnapshot.filter(t => !!t.has_image).length;

    tasksSnapshot.forEach(task => {
      if (task.topic) byTopic.set(task.topic, (byTopic.get(task.topic) || 0) + 1);

      if (Array.isArray(task.subtopic)) {
        task.subtopic.forEach(stId => {
          if (stId) bySubtopic.set(stId, (bySubtopic.get(stId) || 0) + 1);
        });
      } else if (typeof task.subtopic === 'string' && task.subtopic.length > 0) {
        bySubtopic.set(task.subtopic, (bySubtopic.get(task.subtopic) || 0) + 1);
      }

      if (Array.isArray(task.tags)) {
        task.tags.forEach(tagId => {
          if (tagId) byTag.set(tagId, (byTag.get(tagId) || 0) + 1);
        });
      } else if (typeof task.tags === 'string' && task.tags.length > 0) {
        byTag.set(task.tags, (byTag.get(task.tags) || 0) + 1);
      }

      if (task.source) bySource.set(task.source, (bySource.get(task.source) || 0) + 1);

      const diff = task.difficulty === undefined || task.difficulty === null || task.difficulty === ''
        ? '1'
        : String(task.difficulty);
      byDifficulty.set(diff, (byDifficulty.get(diff) || 0) + 1);

      if (task.year) byYear.set(task.year, (byYear.get(task.year) || 0) + 1);
    });

    return { byTopic, bySubtopic, byTag, bySource, byDifficulty, byYear, hasAnswer, hasSolution, hasImage };
  }, [tasksSnapshot, withAnswerCount, withSolutionCount]);

  const topicRows = useMemo(() => topics.map(t => ({
    key: t.id, title: t.title, ege: t.ege_number, order: t.order,
    count: stats.byTopic.get(t.id) || 0, raw: t,
  })).sort((a, b) => b.count - a.count), [topics, stats.byTopic]);

  const subtopicRows = useMemo(() => subtopics.map(st => {
    const topic = topics.find(t => t.id === st.topic);
    return {
      key: st.id, title: st.name || st.title,
      topicTitle: topic ? (topic.ege_number ? `№${topic.ege_number} ${topic.title}` : topic.title) : '',
      topicId: st.topic, order: st.order,
      count: stats.bySubtopic.get(st.id) || 0, raw: st,
    };
  }).sort((a, b) => b.count - a.count), [subtopics, topics, stats.bySubtopic]);

  const tagRows = useMemo(() => tags.map(t => ({
    key: t.id, title: t.title, color: t.color,
    count: stats.byTag.get(t.id) || 0, raw: t,
  })).sort((a, b) => b.count - a.count), [tags, stats.byTag]);

  const sourceRows = useMemo(() => {
    const unique = new Map();
    sources.forEach(s => unique.set(s, stats.bySource.get(s) || 0));
    stats.bySource.forEach((count, source) => {
      if (!unique.has(source)) unique.set(source, count);
    });
    return Array.from(unique.entries())
      .map(([source, count]) => ({ key: source, source, count }))
      .sort((a, b) => b.count - a.count);
  }, [sources, stats.bySource]);

  const difficultyRows = useMemo(() => ['1', '2', '3', '4', '5'].map(d => ({
    key: d, difficulty: d, count: stats.byDifficulty.get(d) || 0,
  })), [stats.byDifficulty]);

  const yearRows = useMemo(() => {
    const yearsList = years.length > 0 ? years : Array.from(stats.byYear.keys()).sort((a, b) => b - a);
    return yearsList.map(y => ({ key: y, year: y, count: stats.byYear.get(y) || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [years, stats.byYear]);

  const duplicateGroups = useMemo(() => {
    const groupBy = (items, getLabel) => {
      const map = new Map();
      items.forEach(item => {
        const key = normalizeLabel(getLabel(item));
        if (!key) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      });
      return Array.from(map.entries())
        .filter(([, list]) => list.length > 1)
        .map(([key, list]) => ({ key, items: list }));
    };

    const topicsDup = groupBy(topics, t => t.title);
    const subtopicsDup = groupBy(subtopics, st => st.name || st.title);
    const tagsDup = groupBy(tags, t => t.title);
    const sourcesDup = groupBy(sourceRows, s => s.source);

    // Дубликаты задач по statement_md — из лениво загруженных данных
    let strictTasks = [];
    let looseTasks = [];
    if (duplicateTasksData) {
      const strictMap = new Map();
      const looseMap = new Map();

      duplicateTasksData.forEach(task => {
        const strictKey = normalizeStatementStrict(task.statement_md);
        const looseKey = normalizeStatementLoose(task.statement_md);
        if (strictKey) {
          if (!strictMap.has(strictKey)) strictMap.set(strictKey, []);
          strictMap.get(strictKey).push(task);
        }
        if (looseKey) {
          if (!looseMap.has(looseKey)) looseMap.set(looseKey, []);
          looseMap.get(looseKey).push(task);
        }
      });

      strictTasks = Array.from(strictMap.entries())
        .filter(([, list]) => list.length > 1)
        .map(([key, list]) => ({ key, items: list }));

      looseTasks = Array.from(looseMap.entries())
        .filter(([, list]) => list.length > 1)
        .map(([key, list]) => ({ key, items: list }));
    }

    return { topicsDup, subtopicsDup, tagsDup, sourcesDup, strictTasks, looseTasks };
  }, [topics, subtopics, tags, sourceRows, duplicateTasksData]);

  const handleOpenTasks = (filters) => onOpenTasks?.(filters);

  const openMerge = (type, from) => {
    setMergeType(type);
    setMergeFrom(from);
    setMergeModalOpen(true);
  };

  if (refLoading) {
    return (
      <div className="catalog-dashboard catalog-loading">
        <Spin size="large" />
      </div>
    );
  }

  const handleTabChange = (key) => {
    if (key === 'duplicates') {
      loadDuplicateTasks();
    }
  };

  const reloadAll = () => { reloadSnapshot(); setDuplicateTasksData(null); };

  const tabItems = [
    { key: 'topics', label: 'Темы', children: <TopicTab topicRows={topicRows} tasksSnapshot={tasksSnapshot} onOpenTasks={handleOpenTasks} onMerge={openMerge} onReload={reloadAll} /> },
    { key: 'subtopics', label: 'Подтемы', children: <SubtopicTab subtopicRows={subtopicRows} tasksSnapshot={tasksSnapshot} onOpenTasks={handleOpenTasks} onMerge={openMerge} onReload={reloadAll} /> },
    { key: 'tags', label: 'Теги', children: <TagTab tagRows={tagRows} tasksSnapshot={tasksSnapshot} onOpenTasks={handleOpenTasks} onMerge={openMerge} onReload={reloadAll} /> },
    { key: 'sources', label: 'Источники', children: <SourceTab sourceRows={sourceRows} tasksSnapshot={tasksSnapshot} onOpenTasks={handleOpenTasks} onMerge={openMerge} onReload={reloadAll} /> },
    { key: 'other', label: 'Прочее', children: <OtherTab difficultyRows={difficultyRows} yearRows={yearRows} stats={stats} onOpenTasks={handleOpenTasks} /> },
    { key: 'duplicates', label: 'Дубли', children: duplicateTasksLoading ? <Spin /> : <DuplicateTab duplicateGroups={duplicateGroups} onOpenTasks={handleOpenTasks} onMerge={openMerge} /> },
    { key: 'vec-duplicates', label: '🔎 Похожие (вектор)', children: <VectorDuplicatesTab onOpenTasks={handleOpenTasks} onOpenWork={onOpenWork} /> },
  ];

  const totalDuplicates =
    duplicateGroups.topicsDup.length +
    duplicateGroups.subtopicsDup.length +
    duplicateGroups.tagsDup.length +
    duplicateGroups.sourcesDup.length +
    duplicateGroups.strictTasks.length +
    duplicateGroups.looseTasks.length;

  return (
    <div className="catalog-dashboard">
      <div className="catalog-dashboard-header">
        <h2 className="catalog-dashboard-title">
          <AppstoreOutlined />
          Каталог и справочники
        </h2>
        <Space>
          <Button icon={<BarChartOutlined />} onClick={onBackToAnalytics}>
            Аналитика
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => { reloadSnapshot(); setDuplicateTasksData(null); }}>Обновить статистику</Button>
          <Button onClick={reloadData}>Обновить справочники</Button>
        </Space>
      </div>

      <div className="catalog-hero-grid">
        <div className="catalog-hero-card catalog-hero-card--tasks">
          <div className="catalog-hero-label">Всего задач</div>
          <div className="catalog-hero-value">{tasksSnapshot.length.toLocaleString()}</div>
        </div>
        <div className="catalog-hero-card catalog-hero-card--topics">
          <div className="catalog-hero-label"><BookOutlined /> Темы и подтемы</div>
          <div className="catalog-hero-value">{(topics.length + subtopics.length).toLocaleString()}</div>
        </div>
        <div className="catalog-hero-card catalog-hero-card--tags">
          <div className="catalog-hero-label"><TagsOutlined /> Теги</div>
          <div className="catalog-hero-value">{tagRows.length.toLocaleString()}</div>
        </div>
        <div className="catalog-hero-card catalog-hero-card--duplicates">
          <div className="catalog-hero-label"><CopyOutlined /> Группы дублей</div>
          <div className="catalog-hero-value">{totalDuplicates.toLocaleString()}</div>
        </div>
      </div>

      <div className="catalog-tabs-shell">
        <Tabs defaultActiveKey="topics" items={tabItems} onChange={handleTabChange} />
      </div>

      <MergeModal
        open={mergeModalOpen}
        mergeType={mergeType}
        mergeFrom={mergeFrom}
        sourceRows={sourceRows}
        tasksSnapshot={tasksSnapshot}
        onClose={() => { setMergeModalOpen(false); setMergeType(null); setMergeFrom(null); }}
        onReload={reloadAll}
      />
    </div>
  );
};

export default TaskCatalogManager;
