import { useMemo, useState, useCallback } from 'react';
import { Progress, Space, Button, Tag, Empty, Tooltip, Table } from 'antd';
import {
  ReloadOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  TagsOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  CalendarOutlined,
  BranchesOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  TableOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import './TaskStatsDashboard.css';

const KNOWN_DIFFICULTIES = ['1', '2', '3', '4', '5'];
const UNSET_DIFFICULTY = '__unset__';

const DIFFICULTY_COLORS = {
  '1': { bg: '#52c41a', label: 'Базовый' },
  '2': { bg: '#faad14', label: 'Средний' },
  '3': { bg: '#ff4d4f', label: 'Повышенный' },
  '4': { bg: '#a8071a', label: 'Высокий' },
  '5': { bg: '#722ed1', label: 'Олимпиадный' },
  [UNSET_DIFFICULTY]: { bg: '#d9d9d9', label: 'Не указана' },
};

// Heat map color scale (green = many tasks, yellow = some, red = few)
const getHeatColor = (value, max) => {
  if (value === 0) return '#fafafa';
  const ratio = Math.min(value / max, 1);
  if (ratio > 0.6) return `rgba(82, 196, 26, ${0.12 + ratio * 0.15})`;
  if (ratio > 0.3) return `rgba(250, 173, 20, ${0.1 + ratio * 0.12})`;
  return `rgba(255, 77, 79, ${0.06 + ratio * 0.1})`;
};

const getHeatBarColor = (value, max) => {
  if (value === 0) return '#d9d9d9';
  const ratio = Math.min(value / max, 1);
  if (ratio > 0.6) return '#52c41a';
  if (ratio > 0.3) return '#faad14';
  return '#ff7a45';
};

const TaskStatsDashboard = ({ onOpenTasks, onTagClick, onOpenCatalog }) => {
  const { topics, tags, subtopics, sources, tasksSnapshot, withAnswerCount, withSolutionCount, loading: refLoading, reloadSnapshot } = useReferenceData();
  const [showSubtopics, setShowSubtopics] = useState(false);
  const [topicsView, setTopicsView] = useState('grid'); // 'grid' | 'table'
  const [sourcesView, setSourcesView] = useState('chart'); // 'chart' | 'table'

  const stats = useMemo(() => {
    const total = tasksSnapshot.length;
    const withAnswer = withAnswerCount;
    const withSolution = withSolutionCount;
    const withImage = tasksSnapshot.filter(t => !!t.has_image).length;

    const byTopic = new Map();
    const bySubtopic = new Map();
    const byTag = new Map();
    const byDifficulty = new Map();
    const bySource = new Map();
    const byYear = new Map();

    tasksSnapshot.forEach(task => {
      if (task.topic) {
        byTopic.set(task.topic, (byTopic.get(task.topic) || 0) + 1);
      }
      if (Array.isArray(task.subtopic)) {
        task.subtopic.forEach(stId => {
          if (stId) bySubtopic.set(stId, (bySubtopic.get(stId) || 0) + 1);
        });
      } else if (typeof task.subtopic === 'string' && task.subtopic.length > 0) {
        bySubtopic.set(task.subtopic, (bySubtopic.get(task.subtopic) || 0) + 1);
      }
      if (Array.isArray(task.tags)) {
        task.tags.forEach(tagId => {
          byTag.set(tagId, (byTag.get(tagId) || 0) + 1);
        });
      } else if (typeof task.tags === 'string' && task.tags.length > 0) {
        byTag.set(task.tags, (byTag.get(task.tags) || 0) + 1);
      }
      if (task.source) {
        bySource.set(task.source, (bySource.get(task.source) || 0) + 1);
      }
      if (task.year) {
        byYear.set(task.year, (byYear.get(task.year) || 0) + 1);
      }
      const diff = task.difficulty === undefined || task.difficulty === null || task.difficulty === ''
        ? UNSET_DIFFICULTY
        : String(task.difficulty);
      byDifficulty.set(diff, (byDifficulty.get(diff) || 0) + 1);
    });

    return { total, withAnswer, withSolution, withImage, byTopic, bySubtopic, byTag, byDifficulty, bySource, byYear };
  }, [tasksSnapshot, withAnswerCount, withSolutionCount]);

  // ---- Derived data ----

  const topicRows = useMemo(() => {
    const rows = topics.map(t => ({
      key: t.id,
      title: t.title,
      ege: t.ege_number,
      count: stats.byTopic.get(t.id) || 0,
      topicId: t.id,
    }));
    const topicSet = new Set(topics.map(t => t.id));
    stats.byTopic.forEach((count, id) => {
      if (topicSet.has(id)) return;
      rows.push({ key: `unknown-topic-${id}`, title: `(Удалена) ${id}`, ege: '—', count, topicId: id });
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [topics, stats.byTopic]);

  const tagRows = useMemo(() => {
    const rows = tags.map(t => ({
      key: t.id, title: t.title, color: t.color, count: stats.byTag.get(t.id) || 0, tagId: t.id,
    }));
    const tagSet = new Set(tags.map(t => t.id));
    stats.byTag.forEach((count, id) => {
      if (tagSet.has(id)) return;
      rows.push({ key: `unknown-tag-${id}`, title: `(Удален) ${id}`, color: 'default', count, tagId: id });
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [tags, stats.byTag]);

  const subtopicRows = useMemo(() => {
    const rows = subtopics.map(st => {
      const topic = topics.find(t => t.id === st.topic);
      return {
        key: st.id, title: st.name || st.title,
        topicTitle: topic ? (topic.ege_number ? `№${topic.ege_number} ${topic.title}` : topic.title) : '',
        count: stats.bySubtopic.get(st.id) || 0, subtopicId: st.id,
      };
    });
    const subtopicSet = new Set(subtopics.map(st => st.id));
    stats.bySubtopic.forEach((count, id) => {
      if (subtopicSet.has(id)) return;
      rows.push({ key: `unknown-subtopic-${id}`, title: `(Удалена) ${id}`, topicTitle: '—', count, subtopicId: id });
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [subtopics, stats.bySubtopic, topics]);

  const sourceRows = useMemo(() => {
    const merged = new Map();
    sources.forEach(s => merged.set(s, stats.bySource.get(s) || 0));
    stats.bySource.forEach((count, source) => {
      if (!merged.has(source)) merged.set(source, count);
    });
    return Array.from(merged.entries())
      .map(([source, count]) => ({ key: source, source, count }))
      .sort((a, b) => b.count - a.count);
  }, [sources, stats.bySource]);

  const difficultyRows = useMemo(() => {
    const base = KNOWN_DIFFICULTIES.map(d => ({
      key: d, difficulty: d, count: stats.byDifficulty.get(d) || 0, filterDifficulty: d,
    }));
    stats.byDifficulty.forEach((count, difficulty) => {
      if (KNOWN_DIFFICULTIES.includes(difficulty)) return;
      if (difficulty === UNSET_DIFFICULTY) {
        base.push({ key: UNSET_DIFFICULTY, difficulty: UNSET_DIFFICULTY, count, filterDifficulty: null });
        return;
      }
      base.push({ key: `difficulty-${difficulty}`, difficulty, count, filterDifficulty: difficulty });
    });
    return base.filter(d => d.count > 0).sort((a, b) => b.count - a.count);
  }, [stats.byDifficulty]);

  const yearRows = useMemo(() => {
    return Array.from(stats.byYear.entries())
      .map(([year, count]) => ({ key: year, year, count }))
      .sort((a, b) => Number(a.year) - Number(b.year));
  }, [stats.byYear]);

  // ---- Helpers ----
  const toPercent = (count) => {
    if (!stats.total) return '0%';
    return `${Math.round((count / stats.total) * 100)}%`;
  };

  const openTasks = useCallback((filters) => {
    onOpenTasks?.(filters);
  }, [onOpenTasks]);

  const handleTagOpen = useCallback((tagId) => {
    if (onOpenTasks) {
      openTasks({ tags: [tagId] });
      return;
    }
    onTagClick?.(tagId);
  }, [onOpenTasks, onTagClick, openTasks]);

  const emptyTopics = topicRows.filter(t => t.count === 0);
  const emptySubtopics = subtopicRows.filter(t => t.count === 0);
  const coverage = topics.length > 0 ? Math.round(((topics.length - emptyTopics.length) / topics.length) * 100) : 0;
  const maxTopicCount = Math.max(...topicRows.map(t => t.count), 1);
  const maxDiffCount = Math.max(...difficultyRows.map(d => d.count), 1);
  const maxSourceCount = Math.max(...sourceRows.map(s => s.count), 1);
  const maxYearCount = Math.max(...yearRows.map(y => y.count), 1);

  // ---- Loading state ----
  if (refLoading) {
    return (
      <div className="stats-dashboard">
        <div className="stats-skeleton-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="stats-skeleton-card" />)}
        </div>
        <div className="stats-two-columns">
          <div className="stats-skeleton-section" />
          <div className="stats-skeleton-section" />
        </div>
        <div className="stats-skeleton-section" />
      </div>
    );
  }

  if (tasksSnapshot.length === 0 && !refLoading) {
    return <Empty description="Нет данных по задачам" />;
  }

  return (
    <div className="stats-dashboard">
      {/* Header */}
      <div className="stats-dashboard-header">
        <h2 className="stats-dashboard-title">
          <BarChartOutlined /> Аналитика
        </h2>
        <Space>
          <Button icon={<AppstoreOutlined />} onClick={onOpenCatalog} type="text">
            Каталог
          </Button>
          <Button icon={<ReloadOutlined />} onClick={reloadSnapshot} type="text">
            Обновить
          </Button>
        </Space>
      </div>

      {/* Hero Metrics */}
      <div className="stats-hero-grid">
        <div className="stats-hero-card stats-hero-card--total">
          <div className="stats-hero-card-content">
            <div className="stats-hero-card-info">
              <div className="stats-hero-card-label">Всего задач</div>
              <div className="stats-hero-card-value">{stats.total.toLocaleString()}</div>
              <div className="stats-hero-card-suffix">{topics.length} тем</div>
            </div>
            <div className="stats-hero-card-ring">
              <Progress
                type="circle"
                percent={100}
                size={64}
                strokeWidth={8}
                format={() => <DatabaseOutlined style={{ fontSize: 22, color: '#fff' }} />}
              />
            </div>
          </div>
        </div>

        <div className="stats-hero-card stats-hero-card--answers">
          <div className="stats-hero-card-content">
            <div className="stats-hero-card-info">
              <div className="stats-hero-card-label">С ответом</div>
              <div className="stats-hero-card-value">{stats.withAnswer.toLocaleString()}</div>
              <div className="stats-hero-card-suffix">{toPercent(stats.withAnswer)} от всех</div>
            </div>
            <div className="stats-hero-card-ring">
              <Progress
                type="circle"
                percent={stats.total ? Math.round((stats.withAnswer / stats.total) * 100) : 0}
                size={64}
                strokeWidth={8}
                format={(p) => `${p}%`}
              />
            </div>
          </div>
        </div>

        <div className="stats-hero-card stats-hero-card--solutions">
          <div className="stats-hero-card-content">
            <div className="stats-hero-card-info">
              <div className="stats-hero-card-label">С решением</div>
              <div className="stats-hero-card-value">{stats.withSolution.toLocaleString()}</div>
              <div className="stats-hero-card-suffix">{toPercent(stats.withSolution)} от всех</div>
            </div>
            <div className="stats-hero-card-ring">
              <Progress
                type="circle"
                percent={stats.total ? Math.round((stats.withSolution / stats.total) * 100) : 0}
                size={64}
                strokeWidth={8}
                format={(p) => `${p}%`}
              />
            </div>
          </div>
        </div>

        <div className="stats-hero-card stats-hero-card--images">
          <div className="stats-hero-card-content">
            <div className="stats-hero-card-info">
              <div className="stats-hero-card-label">С изображением</div>
              <div className="stats-hero-card-value">{stats.withImage.toLocaleString()}</div>
              <div className="stats-hero-card-suffix">{toPercent(stats.withImage)} от всех</div>
            </div>
            <div className="stats-hero-card-ring">
              <Progress
                type="circle"
                percent={stats.total ? Math.round((stats.withImage / stats.total) * 100) : 0}
                size={64}
                strokeWidth={8}
                format={(p) => `${p}%`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Difficulty + Coverage row */}
      <div className="stats-two-columns">
        {/* Difficulty Distribution */}
        <div className="stats-section" style={{ animationDelay: '0.25s' }}>
          <div className="stats-section-header">
            <div className="stats-section-icon stats-section-icon--difficulty">
              <SafetyCertificateOutlined />
            </div>
            <h3 className="stats-section-title">Распределение по сложности</h3>
          </div>
          <div className="stats-difficulty-bars">
            {difficultyRows.map((row) => {
              const colorInfo = DIFFICULTY_COLORS[row.difficulty] || DIFFICULTY_COLORS[UNSET_DIFFICULTY];
              const widthPercent = maxDiffCount > 0 ? Math.max((row.count / maxDiffCount) * 100, 4) : 0;
              return (
                <div
                  key={row.key}
                  className="stats-difficulty-row"
                  onClick={() => row.filterDifficulty && onOpenTasks && openTasks({ difficulty: row.filterDifficulty })}
                >
                  <div className="stats-difficulty-label">
                    <span className="stats-difficulty-dot" style={{ background: colorInfo.bg }} />
                    {colorInfo.label}
                  </div>
                  <div className="stats-difficulty-bar-track">
                    <div
                      className="stats-difficulty-bar-fill"
                      style={{ width: `${widthPercent}%`, background: colorInfo.bg }}
                    >
                      {widthPercent > 15 && (
                        <span className="stats-difficulty-bar-text">{row.count}</span>
                      )}
                    </div>
                  </div>
                  <div className="stats-difficulty-count">
                    {row.count}
                    <div className="stats-difficulty-percent">{toPercent(row.count)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coverage */}
        <div className="stats-section" style={{ animationDelay: '0.3s' }}>
          <div className="stats-section-header">
            <div className="stats-section-icon stats-section-icon--coverage">
              <CheckCircleOutlined />
            </div>
            <h3 className="stats-section-title">Покрытие тем</h3>
          </div>
          <div className="stats-coverage">
            <div className="stats-coverage-ring">
              <Progress
                type="circle"
                percent={coverage}
                size={120}
                strokeWidth={10}
                strokeColor={coverage === 100 ? '#52c41a' : '#4361ee'}
              />
            </div>
            <div className="stats-coverage-details">
              <div className="stats-coverage-text">
                Заполнено <strong>{topics.length - emptyTopics.length}</strong> из <strong>{topics.length}</strong> тем
              </div>
              {emptyTopics.length > 0 && (
                <>
                  <div className="stats-coverage-text" style={{ marginBottom: 8 }}>
                    Пустые темы:
                  </div>
                  <div className="stats-coverage-empty-tags">
                    {emptyTopics.map(t => (
                      <Tag key={t.key} color="red" style={{ borderRadius: 12 }}>
                        №{t.ege} {t.title}
                      </Tag>
                    ))}
                  </div>
                </>
              )}
              {emptyTopics.length === 0 && (
                <div className="stats-coverage-text" style={{ color: '#52c41a', fontWeight: 600 }}>
                  ✓ Все темы заполнены!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Topics Grid */}
      <div className="stats-section" style={{ animationDelay: '0.35s' }}>
        <div className="stats-section-header">
          <div className="stats-section-icon stats-section-icon--topics">
            <BookOutlined />
          </div>
          <h3 className="stats-section-title">Задачи по темам</h3>
          <span className="stats-section-subtitle">{topicRows.length} тем</span>
          <div className="stats-view-toggle">
            <button
              className={`stats-view-toggle-btn ${topicsView === 'grid' ? 'stats-view-toggle-btn--active' : ''}`}
              onClick={() => setTopicsView('grid')}
            >
              <BarChartOutlined /> Плитки
            </button>
            <button
              className={`stats-view-toggle-btn ${topicsView === 'table' ? 'stats-view-toggle-btn--active' : ''}`}
              onClick={() => setTopicsView('table')}
            >
              <TableOutlined /> Таблица
            </button>
          </div>
        </div>

        {topicsView === 'grid' ? (
          <div className="stats-topics-grid">
            {topicRows.map((topic, i) => (
              <Tooltip key={topic.key} title={`${topic.title}: ${topic.count} задач (${toPercent(topic.count)})`}>
                <div
                  className={`stats-topic-tile ${topic.count === 0 ? 'stats-topic-tile--empty' : ''}`}
                  style={{
                    background: getHeatColor(topic.count, maxTopicCount),
                    animationDelay: `${0.02 * i}s`,
                  }}
                  onClick={() => topic.count > 0 && onOpenTasks && openTasks({ topic: topic.topicId })}
                >
                  <div className="stats-topic-tile-ege">{topic.ege}</div>
                  <div className="stats-topic-tile-title">{topic.title}</div>
                  <div className="stats-topic-tile-count">{topic.count}</div>
                  <div className="stats-topic-tile-percent">{toPercent(topic.count)}</div>
                  <div
                    className="stats-topic-tile-bar"
                    style={{
                      background: getHeatBarColor(topic.count, maxTopicCount),
                      opacity: 0.7,
                    }}
                  />
                </div>
              </Tooltip>
            ))}
          </div>
        ) : (
          <Table
            size="small"
            dataSource={topicRows}
            pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
            columns={[
              { title: '№', dataIndex: 'ege', width: 60 },
              { title: 'Тема', dataIndex: 'title' },
              {
                title: 'Кол-во', dataIndex: 'count', width: 160,
                render: (_, row) => (
                  <Space>
                    <span style={{ fontWeight: 600 }}>{row.count}</span>
                    <Tag>{toPercent(row.count)}</Tag>
                    {onOpenTasks && (
                      <Button type="link" size="small" onClick={() => openTasks({ topic: row.topicId })}>
                        Открыть
                      </Button>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        )}
      </div>

      {/* Tag Cloud */}
      <div className="stats-section" style={{ animationDelay: '0.4s' }}>
        <div className="stats-section-header">
          <div className="stats-section-icon stats-section-icon--tags">
            <TagsOutlined />
          </div>
          <h3 className="stats-section-title">Теги</h3>
          <span className="stats-section-subtitle">{tagRows.length} тегов</span>
        </div>
        <div className="stats-tag-cloud">
          {tagRows.map(tag => {
            const max = tagRows[0]?.count || 1;
            const min = tagRows[tagRows.length - 1]?.count || 0;
            const scale = max === min ? 1 : (tag.count - min) / (max - min);
            const fontSize = Math.round(12 + scale * 14);
            return (
              <Tooltip key={tag.key} title={`${tag.title}: ${tag.count} задач`}>
                <span
                  className="stats-tag-item"
                  style={{
                    fontSize,
                    background: tag.color ? `${tag.color}30` : '#e8e8e8',
                    color: tag.color || '#555',
                    borderColor: tag.color ? `${tag.color}70` : '#bbb',
                    opacity: tag.count > 0 ? 1 : 0.35,
                    fontWeight: scale > 0.5 ? 700 : 500,
                    cursor: tag.count > 0 && (onTagClick || onOpenTasks) ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (tag.count > 0) handleTagOpen(tag.tagId);
                  }}
                >
                  {tag.title}
                  <span className="stats-tag-item-count">({tag.count})</span>
                </span>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Sources + Years row */}
      <div className="stats-two-columns">
        {/* Sources */}
        <div className="stats-section" style={{ animationDelay: '0.45s' }}>
          <div className="stats-section-header">
            <div className="stats-section-icon stats-section-icon--sources">
              <FileTextOutlined />
            </div>
            <h3 className="stats-section-title">Источники</h3>
            <span className="stats-section-subtitle">{sourceRows.length}</span>
            <div className="stats-view-toggle">
              <button
                className={`stats-view-toggle-btn ${sourcesView === 'chart' ? 'stats-view-toggle-btn--active' : ''}`}
                onClick={() => setSourcesView('chart')}
              >
                <BarChartOutlined />
              </button>
              <button
                className={`stats-view-toggle-btn ${sourcesView === 'table' ? 'stats-view-toggle-btn--active' : ''}`}
                onClick={() => setSourcesView('table')}
              >
                <TableOutlined />
              </button>
            </div>
          </div>

          {sourcesView === 'chart' ? (
            <div className="stats-hbar-chart stats-scroll-container">
              {sourceRows.map((row, i) => {
                const widthPercent = maxSourceCount > 0 ? Math.max((row.count / maxSourceCount) * 100, 3) : 0;
                return (
                  <div
                    key={row.key}
                    className="stats-hbar-row"
                    style={{ animationDelay: `${0.03 * i}s` }}
                    onClick={() => onOpenTasks && openTasks({ source: row.source })}
                  >
                    <Tooltip title={row.source}>
                      <div className="stats-hbar-label">{row.source}</div>
                    </Tooltip>
                    <div className="stats-hbar-track">
                      <div
                        className="stats-hbar-fill"
                        style={{
                          width: `${widthPercent}%`,
                          background: `linear-gradient(90deg, #7b2ff7, #c77dff)`,
                          animationDelay: `${0.03 * i}s`,
                        }}
                      >
                        {widthPercent > 15 && (
                          <span className="stats-hbar-fill-text">{row.count}</span>
                        )}
                      </div>
                    </div>
                    <div className="stats-hbar-value">{row.count}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Table
              size="small"
              dataSource={sourceRows}
              pagination={{ pageSize: 15, showSizeChanger: true }}
              columns={[
                { title: 'Источник', dataIndex: 'source' },
                {
                  title: 'Кол-во', dataIndex: 'count', width: 140,
                  render: (_, row) => (
                    <Space>
                      <span style={{ fontWeight: 600 }}>{row.count}</span>
                      <Tag>{toPercent(row.count)}</Tag>
                      {onOpenTasks && (
                        <Button type="link" size="small" onClick={() => openTasks({ source: row.source })}>
                          Открыть
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </div>

        {/* Years Timeline */}
        <div className="stats-section" style={{ animationDelay: '0.5s' }}>
          <div className="stats-section-header">
            <div className="stats-section-icon stats-section-icon--years">
              <CalendarOutlined />
            </div>
            <h3 className="stats-section-title">Годы</h3>
            <span className="stats-section-subtitle">{yearRows.length} лет</span>
          </div>

          {yearRows.length > 0 ? (
            <div className="stats-year-timeline">
              {yearRows.map((row, i) => {
                const heightPercent = maxYearCount > 0 ? Math.max((row.count / maxYearCount) * 100, 8) : 0;
                const barHeight = Math.max(20, (heightPercent / 100) * 180);
                const hue = 200 + (i / Math.max(yearRows.length - 1, 1)) * 60; // blue to teal gradient
                return (
                  <Tooltip key={row.key} title={`${row.year}: ${row.count} задач`}>
                    <div
                      className="stats-year-column"
                      onClick={() => onOpenTasks && openTasks({ year: row.year })}
                    >
                      <div className="stats-year-bar-wrapper" style={{ height: 180 }}>
                        <div
                          className="stats-year-bar"
                          style={{
                            height: barHeight,
                            background: `hsl(${hue}, 70%, 55%)`,
                          }}
                        >
                          {barHeight > 30 && (
                            <span className="stats-year-bar-count">{row.count}</span>
                          )}
                        </div>
                      </div>
                      <div className="stats-year-label">{row.year}</div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <Empty description="Нет данных по годам" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      </div>

      {/* Subtopics (collapsible) */}
      <div className="stats-section" style={{ animationDelay: '0.55s' }}>
        <div className="stats-section-header" style={{ marginBottom: 0, borderBottom: showSubtopics ? undefined : 'none', paddingBottom: showSubtopics ? 12 : 0 }}>
          <div className="stats-section-icon stats-section-icon--subtopics">
            <BranchesOutlined />
          </div>
          <h3 className="stats-section-title">Подтемы</h3>
          <span className="stats-section-subtitle">
            Заполнено: {subtopicRows.length - emptySubtopics.length}/{subtopicRows.length}
          </span>
          <div
            className="stats-subtopics-toggle"
            onClick={() => setShowSubtopics(!showSubtopics)}
            style={{ marginLeft: 'auto', marginBottom: 0 }}
          >
            {showSubtopics ? <DownOutlined style={{ fontSize: 11 }} /> : <RightOutlined style={{ fontSize: 11 }} />}
            <span className="stats-subtopics-toggle-text">
              {showSubtopics ? 'Скрыть' : 'Показать'}
            </span>
          </div>
        </div>

        {showSubtopics && (
          <div style={{ marginTop: 16 }}>
            <Table
              size="small"
              dataSource={subtopicRows}
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              columns={[
                { title: 'Подтема', dataIndex: 'title' },
                { title: 'Тема', dataIndex: 'topicTitle' },
                {
                  title: 'Кол-во', dataIndex: 'count', width: 160,
                  render: (_, row) => (
                    <Space>
                      <span style={{ fontWeight: 600 }}>{row.count}</span>
                      <Tag>{toPercent(row.count)}</Tag>
                      {onOpenTasks && (
                        <Button type="link" size="small" onClick={() => openTasks({ subtopic: row.subtopicId })}>
                          Открыть
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskStatsDashboard;
