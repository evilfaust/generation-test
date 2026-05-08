import { useState, useCallback, useEffect } from 'react';
import {
  Button, Card, Input, InputNumber, Space, List, Tag, Tooltip,
  Modal, Empty, Spin, message, Popconfirm, Typography, Switch,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, FolderOpenOutlined,
  PrinterOutlined, ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined,
  TrophyOutlined, UserOutlined, OrderedListOutlined, FileTextOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useMarathon } from '../hooks/useMarathon';
import { api } from '../shared/services/pocketbase';
import TaskSelectModal from './TaskSelectModal';
import MarathonCardsPrint from './marathon/MarathonCardsPrint';
import MarathonTeacherSheet from './marathon/MarathonTeacherSheet';
import MarathonRatingPrint from './marathon/MarathonRatingPrint';
import MarathonTracker from './marathon/MarathonTracker';
import MathRenderer from '../shared/components/MathRenderer';
import './MarathonGenerator.css';

const { Text } = Typography;
const DIFFICULTY_COLOR = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f' };
const DIFFICULTY_LABEL = { 1: 'Лёгкая', 2: 'Средняя', 3: 'Сложная' };

// Есть ли реальный прогресс в trackingData
function hasProgress(trackingData) {
  return Object.values(trackingData).some(studentData =>
    Object.entries(studentData).some(([k, v]) =>
      !k.startsWith('_') && (v.solved || v.failed || v.attempts > 0)
    )
  );
}

// Инициализирован ли трекер (есть записи по ученикам)
function isTrackerInitialized(students, trackingData) {
  return students.length > 0 && students.every(s => s in trackingData);
}

export default function MarathonGenerator() {
  const { topics, subtopics, tags } = useReferenceData();

  const {
    title, setTitle,
    classNumber, setClassNumber,
    tasks, students, trackingData, setTrackingData,
    savedId, saved, loadingSaved, saving, saveStatus,
    addTasks, removeTask, moveTask,
    addStudent, removeStudent,
    saveMarathon, saveTracking, loadMarathon, loadSavedList, deleteMarathon, reset,
    initTracking,
  } = useMarathon();

  // --- Фазы и подвкладки ---
  const [phase, setPhase] = useState('prep'); // 'prep' | 'live'
  const [prepTab, setPrepTab] = useState('content'); // 'content' | 'cards' | 'teacher' | 'rating'
  const [liveTab, setLiveTab] = useState('tracker'); // 'tracker'

  // --- Прочий UI-стейт ---
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [printMode, setPrintMode] = useState(null); // 'cards' | 'teacher' | 'rating' | null
  const [showLogo, setShowLogo] = useState(true);

  // Ждём рендера print-блока + загрузки картинок, потом печатаем
  useEffect(() => {
    if (!printMode) return;
    const styleId = 'marathon-print-page-style';
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = styleId;
    if (printMode === 'rating') {
      style.textContent = '@page { size: A4 landscape; margin: 10mm 12mm; }';
    } else if (printMode === 'teacher') {
      style.textContent = '@page { size: A4 portrait; margin: 10mm 12mm; }';
    } else {
      style.textContent = '@page { size: A4 portrait; margin: 0; }';
    }
    document.head.appendChild(style);
    const timer = setTimeout(() => {
      window.print();
      setTimeout(() => {
        const s = document.getElementById(styleId);
        if (s) s.remove();
        setPrintMode(null);
      }, 1000);
    }, 300);
    return () => clearTimeout(timer);
  }, [printMode]);

  // --- Обработчики ---

  const handleAddStudent = () => {
    if (!newStudentName.trim()) return;
    addStudent(newStudentName.trim());
    setNewStudentName('');
  };

  const handleSave = async () => {
    if (!tasks.length) return message.warning('Добавьте хотя бы одну задачу');
    try {
      await saveMarathon();
      message.success(savedId ? 'Марафон обновлён' : 'Марафон сохранён');
    } catch {
      message.error('Ошибка при сохранении');
    }
  };

  const handleLoad = async () => {
    setShowLoadModal(true);
    await loadSavedList();
  };

  const handleLoadItem = async (item) => {
    setShowLoadModal(false);
    try {
      const full = await api.getMarathon(item.id);
      const order = full.task_order || [];
      const raw = full.expand?.tasks;
      const expandedTasks = Array.isArray(raw) ? raw : raw ? [raw] : [];

      if (order.length > expandedTasks.length && order.length > 0) {
        const missingIds = order.filter(id => !expandedTasks.find(t => t.id === id));
        if (missingIds.length > 0) {
          try {
            const recoveredTasks = await Promise.all(
              missingIds.map(id => api.getTask(id).catch(() => null))
            );
            full.expand = full.expand || {};
            full.expand.tasks = [...expandedTasks, ...recoveredTasks.filter(Boolean)];
          } catch (e) {
            console.error('Failed to recover missing tasks', e);
          }
        }
      }
      loadMarathon(full);
      message.success('Марафон загружен');
    } catch (e) {
      console.error(e);
      loadMarathon(item);
      message.success('Марафон загружен (ошибка полной загрузки)');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMarathon(id);
      message.success('Удалено');
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const handlePrint = (type) => setPrintMode(type);

  const handleInitTracking = () => {
    if (!students.length) return message.warning('Добавьте учеников');
    if (!tasks.length) return message.warning('Добавьте задачи');
    initTracking();
    message.success('Трекер инициализирован');
  };

  // Переключение в фазу урока: инициализировать если нужно
  const handleSwitchToLive = () => {
    if (!students.length || !tasks.length) {
      message.warning('Добавьте учеников и задачи перед началом урока');
      return;
    }
    setPhase('live');
    setLiveTab('tracker');
  };

  // =====================================================================
  // ФАЗА «ПОДГОТОВКА» — подвкладки
  // =====================================================================

  // Подвкладка: Содержимое (задачи + ученики + параметры)
  const contentTab = (
    <div className="mg-setup">
      {/* Основные параметры */}
      <Card size="small" title="Параметры марафона" className="mg-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Название</Text>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{ width: 300 }}
                placeholder="Марафон по алгебре"
              />
            </div>
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Класс</Text>
              <InputNumber
                value={classNumber}
                onChange={setClassNumber}
                min={5} max={11}
                style={{ width: 80 }}
              />
            </div>
          </Space>

          <Space>
            <Button
              icon={<SaveOutlined />}
              type="primary"
              onClick={handleSave}
              loading={saving}
            >
              {savedId ? 'Обновить' : 'Сохранить'}
            </Button>
            <Button icon={<FolderOpenOutlined />} onClick={handleLoad}>
              Загрузить
            </Button>
            <Popconfirm title="Сбросить всё?" onConfirm={reset}>
              <Button icon={<ReloadOutlined />} danger>
                Новый
              </Button>
            </Popconfirm>
          </Space>
          {savedId && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {savedId}
            </Text>
          )}
        </Space>
      </Card>

      {/* Задачи */}
      <Card
        size="small"
        title={
          <Space>
            <OrderedListOutlined />
            {`Задачи (${tasks.length})`}
          </Space>
        }
        className="mg-card"
        extra={
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowTaskModal(true)}
          >
            Добавить задачи
          </Button>
        }
      >
        {tasks.length === 0 ? (
          <Empty description="Задачи не выбраны" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={tasks}
            renderItem={(task, idx) => (
              <List.Item
                key={task.id}
                className="mg-task-item"
                actions={[
                  <Tooltip title="Переместить вверх">
                    <Button
                      size="small"
                      icon={<ArrowUpOutlined />}
                      disabled={idx === 0}
                      onClick={() => moveTask(idx, idx - 1)}
                    />
                  </Tooltip>,
                  <Tooltip title="Переместить вниз">
                    <Button
                      size="small"
                      icon={<ArrowDownOutlined />}
                      disabled={idx === tasks.length - 1}
                      onClick={() => moveTask(idx, idx + 1)}
                    />
                  </Tooltip>,
                  <Tooltip title="Удалить">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeTask(task.id)}
                    />
                  </Tooltip>,
                ]}
              >
                <Space size={8} align="start" style={{ width: '100%', flexWrap: 'wrap' }}>
                  <div
                    className="mg-task-num"
                    style={{ background: DIFFICULTY_COLOR[task.difficulty] || '#1890ff' }}
                  >
                    {idx + 1}
                  </div>
                  <Tag
                    color={DIFFICULTY_COLOR[task.difficulty] || 'blue'}
                    style={{ fontSize: 11 }}
                  >
                    {DIFFICULTY_LABEL[task.difficulty] || '?'}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>{task.code}</Text>
                  <div className="mg-task-preview" style={{ fontSize: 13 }}>
                    <MathRenderer
                      content={(task.statement_md || '').slice(0, 200) + ((task.statement_md || '').length > 200 ? '…' : '')}
                    />
                  </div>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Ученики */}
      <Card
        size="small"
        title={
          <Space>
            <UserOutlined />
            {`Ученики (${students.length})`}
          </Space>
        }
        className="mg-card"
      >
        <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
          <Input
            placeholder="Фамилия Имя"
            value={newStudentName}
            onChange={e => setNewStudentName(e.target.value)}
            onPressEnter={handleAddStudent}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddStudent}>
            Добавить
          </Button>
        </Space.Compact>

        {students.length === 0 ? (
          <Text type="secondary">Список учеников пуст</Text>
        ) : (
          <div className="mg-students-list">
            {students.map((name, idx) => (
              <div key={name} className="mg-student-item">
                <span className="mg-student-idx">{idx + 1}.</span>
                <span className="mg-student-name">{name}</span>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeStudent(name)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  // Подвкладка: Карточки учеников
  const cardsTab = (
    <div className="mg-print-tab">
      {tasks.length === 0 ? (
        <Empty description="Добавьте задачи в разделе «Содержимое»" />
      ) : (
        <>
          <div className="mg-print-actions">
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => handlePrint('cards')}
              className="marathon-print-cards-trigger"
            >
              Печать карточек (A6, 4 на лист)
            </Button>
            <Space>
              <Switch size="small" checked={showLogo} onChange={setShowLogo} />
              <Text type="secondary" style={{ fontSize: 13 }}>Логотип</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Каждая карточка — одна задача. Распечатайте и разрежьте по пунктиру.
            </Text>
          </div>

          <div className="mg-cards-preview">
            {tasks.map((task, idx) => {
              const diff = task.difficulty || 1;
              return (
                <div key={task.id} className="mg-card-preview-item">
                  <div
                    className="mg-card-preview__header"
                    style={{ background: DIFFICULTY_COLOR[diff] }}
                  >
                    <span className="mg-card-preview__num">{idx + 1}</span>
                    <span className="mg-card-preview__diff">{DIFFICULTY_LABEL[diff]}</span>
                    <span className="mg-card-preview__code" style={{ opacity: 0.7, fontSize: 10 }}>{task.code}</span>
                  </div>
                  <div className="mg-card-preview__body">
                    <MathRenderer content={task.statement_md || ''} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // Подвкладка: Лист учителя
  const teacherTab = (
    <div className="mg-print-tab">
      {tasks.length === 0 ? (
        <Empty description="Добавьте задачи в разделе «Содержимое»" />
      ) : (
        <>
          <div className="mg-print-actions">
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => handlePrint('teacher')}
              className="marathon-print-teacher-trigger"
            >
              Печать листа учителя (A4)
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Компактная таблица со всеми задачами, ответами и решениями.
            </Text>
          </div>

          <div className="mg-teacher-preview">
            <table className="mg-teacher-preview__table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Условие</th>
                  <th>Ответ</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => (
                  <tr key={task.id}>
                    <td style={{ fontWeight: 700, color: DIFFICULTY_COLOR[task.difficulty] }}>
                      {idx + 1}
                    </td>
                    <td>
                      <MathRenderer content={(task.statement_md || '').slice(0, 120)} />
                    </td>
                    <td>
                      <strong><MathRenderer content={task.answer || '—'} /></strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  // Подвкладка: Печатный бланк рейтинга
  const ratingTab = (
    <div className="mg-print-tab">
      <div className="mg-print-actions">
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          onClick={() => handlePrint('rating')}
          className="marathon-print-rating-trigger"
          disabled={!students.length || !tasks.length}
        >
          Печать рейтингового бланка (A4)
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Бланк для ручного заполнения во время марафона.
          Кружки — попытки, галочка — задача решена.
        </Text>
      </div>

      {students.length > 0 && tasks.length > 0 ? (
        <div className="mg-rating-preview">
          <table className="mg-rating-preview__table">
            <thead>
              <tr>
                <th>Ученик</th>
                {tasks.map((_, i) => <th key={i}>{i + 1}</th>)}
                <th>Итого</th>
              </tr>
            </thead>
            <tbody>
              {students.map(name => (
                <tr key={name}>
                  <td>{name}</td>
                  {tasks.map((_, i) => (
                    <td key={i} style={{ textAlign: 'center', color: '#ccc', fontSize: 10 }}>
                      ○○○
                    </td>
                  ))}
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty description="Добавьте учеников и задачи" />
      )}
    </div>
  );

  // =====================================================================
  // ФАЗА «УРОК ИДЁТ» — трекер
  // =====================================================================

  const trackerInitialized = isTrackerInitialized(students, trackingData);

  // Экран до инициализации трекера
  const initScreen = (
    <div className="mg-init-screen">
      <div className="mg-init-icon">🏁</div>
      <h2 className="mg-init-title">Готовы запустить марафон?</h2>
      <p className="mg-init-desc">
        Трекер отслеживает прогресс каждого ученика по каждой задаче в реальном времени.
      </p>
      <div className="mg-init-summary">
        <div className="mg-init-stat">
          <strong>{students.length}</strong>
          <span>учеников</span>
        </div>
        <div className="mg-init-stat">
          <strong>{tasks.length}</strong>
          <span>задач</span>
        </div>
        <div className="mg-init-stat">
          <strong>{tasks.length * 3}</strong>
          <span>max очков</span>
        </div>
      </div>
      <Button
        type="primary"
        size="large"
        onClick={() => {
          handleInitTracking();
        }}
        style={{ marginTop: 8 }}
      >
        🚀 Старт марафона
      </Button>
      {hasProgress(trackingData) && (
        <p className="mg-init-warn">
          ⚠️ Это сбросит текущий прогресс трекера
        </p>
      )}
    </div>
  );

  const trackerView = (
    <div>
      <div className="mg-print-actions" style={{ marginBottom: 12 }}>
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={handleInitTracking}
        >
          Переинициализировать трекер
        </Button>
        {savedId && (
          <Button
            type="primary"
            icon={<DashboardOutlined />}
            onClick={() => {
              const base = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/student`;
              window.open(`${base}/marathon-live/${savedId}`, '_blank');
            }}
          >
            Открыть дашборд
          </Button>
        )}
      </div>
      <MarathonTracker
        tasks={tasks}
        students={students}
        trackingData={trackingData}
        setTrackingData={setTrackingData}
        onSaveTracking={savedId ? saveTracking : null}
      />
    </div>
  );

  // =====================================================================
  // ПОДВКЛАДКИ — рендер по фазе
  // =====================================================================

  const PREP_TABS = [
    { key: 'content', label: 'Содержимое', icon: <OrderedListOutlined /> },
    { key: 'cards',   label: 'Карточки учеников', icon: <FileTextOutlined /> },
    { key: 'teacher', label: 'Лист учителя', icon: <UserOutlined /> },
    { key: 'rating',  label: 'Бланк рейтинга', icon: <TrophyOutlined /> },
  ];

  const LIVE_TABS = [
    { key: 'tracker', label: 'Трекер', icon: <TrophyOutlined /> },
  ];

  const currentPrepContent = {
    content: contentTab,
    cards: cardsTab,
    teacher: teacherTab,
    rating: ratingTab,
  };

  const currentLiveContent = {
    tracker: trackerInitialized ? trackerView : initScreen,
  };

  const activeTabs = phase === 'prep' ? PREP_TABS : LIVE_TABS;
  const activeSubtab = phase === 'prep' ? prepTab : liveTab;
  const setActiveSubtab = phase === 'prep' ? setPrepTab : setLiveTab;
  const tabContent = phase === 'prep'
    ? currentPrepContent[prepTab]
    : currentLiveContent[liveTab];

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <div className="marathon-generator">
      {/* ---- Sticky-шапка ---- */}
      <div className="m-header">
        <div className="m-title-row">
          <input
            className="m-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Название марафона"
            spellCheck={false}
          />
          <div className="m-actions">
            {saveStatus === 'saving' && (
              <span className="m-chip is-saving">⏳ Сохранение…</span>
            )}
            {saveStatus === 'saved' && (
              <span className="m-chip is-saved">✓ Сохранено</span>
            )}
            {saveStatus === 'dirty' && (
              <span className="m-chip">● Не сохранено</span>
            )}
            <button className="btn" onClick={handleLoad}>
              <FolderOpenOutlined /> Загрузить
            </button>
            {(!savedId || saveStatus === 'dirty' || saveStatus === 'idle') && (
              <button
                className="btn is-primary"
                onClick={handleSave}
                disabled={saving}
              >
                <SaveOutlined /> {savedId ? 'Обновить' : 'Сохранить'}
              </button>
            )}
            <Popconfirm title="Сбросить всё?" onConfirm={reset}>
              <button className="btn">
                <ReloadOutlined /> Новый
              </button>
            </Popconfirm>
          </div>
        </div>

        <div className="m-meta">
          <span className="m-chip">
            {classNumber} класс
          </span>
          <span className="m-chip">
            <span className="m-chip-num">{tasks.length}</span> задач
          </span>
          <span className="m-chip">
            <span className="m-chip-num">{students.length}</span> учеников
          </span>
          {savedId && (
            <span className="m-chip" style={{ fontFamily: 'monospace', fontSize: 11 }}>
              #{savedId.slice(-6)}
            </span>
          )}
        </div>

        {/* Phase toggle */}
        <div className={`phase-toggle${phase === 'live' ? ' is-live' : ''}`}>
          <span className="pill" />
          <button
            className={phase === 'prep' ? 'is-active' : ''}
            onClick={() => setPhase('prep')}
          >
            Подготовка
          </button>
          <button
            className={`${phase === 'live' ? 'is-active is-live' : ''}`}
            onClick={handleSwitchToLive}
          >
            {phase === 'live' && <span className="live-dot" />}
            Урок идёт
          </button>
        </div>

        {/* Subtabs */}
        <div className="subtabs">
          {activeTabs.map(tab => (
            <div
              key={tab.key}
              className={`subtab${activeSubtab === tab.key ? ' is-active' : ''}`}
              onClick={() => setActiveSubtab(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Контент подвкладки ---- */}
      <div className="mg-tab-content">
        {tabContent}
      </div>

      {/* ---- Модал выбора задач ---- */}
      <TaskSelectModal
        visible={showTaskModal}
        onCancel={() => setShowTaskModal(false)}
        onSelect={(selected) => {
          const arr = Array.isArray(selected) ? selected : [selected];
          addTasks(arr);
          setShowTaskModal(false);
        }}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={tasks.map(t => t.id)}
      />

      {/* ---- Модал загрузки ---- */}
      <Modal
        title="Загрузить марафон"
        open={showLoadModal}
        onCancel={() => setShowLoadModal(false)}
        footer={null}
        width={520}
      >
        {loadingSaved ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : saved.length === 0 ? (
          <Empty description="Нет сохранённых марафонов" />
        ) : (
          <List
            dataSource={saved}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button size="small" type="primary" onClick={() => handleLoadItem(item)}>
                    Загрузить
                  </Button>,
                  <Popconfirm title="Удалить марафон?" onConfirm={() => handleDelete(item.id)}>
                    <Button size="small" danger>Удалить</Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={item.title}
                  description={
                    <Space size={4}>
                      <Tag>{item.class_number} класс</Tag>
                      <Tag>{(item.task_order || []).length} задач</Tag>
                      <Tag>{(item.students || []).length} учеников</Tag>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(item.created).toLocaleDateString('ru')}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

      {/* ---- Блоки для печати ---- */}
      {printMode === 'cards' && (
        <MarathonCardsPrint tasks={tasks} title={title} showLogo={showLogo} />
      )}
      {printMode === 'teacher' && (
        <MarathonTeacherSheet tasks={tasks} title={title} />
      )}
      {printMode === 'rating' && (
        <MarathonRatingPrint students={students} taskCount={tasks.length} title={title} />
      )}
    </div>
  );
}
