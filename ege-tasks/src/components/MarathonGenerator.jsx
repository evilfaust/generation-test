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
import MarathonTeacherSheetFull from './marathon/MarathonTeacherSheetFull';
import MarathonRatingPrint from './marathon/MarathonRatingPrint';
import MarathonWorksheetPrint from './marathon/MarathonWorksheetPrint';
import MarathonTracker from './marathon/MarathonTracker';
import LessonSidebar from './marathon/LessonSidebar';
import QueueBoard from './marathon/QueueBoard';
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
    addStudent, removeStudent, updateStudentName,
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
  const [trackerMode, setTrackerMode] = useState('grid'); // 'grid' | 'queue'
  const [showWorksheet,    setShowWorksheet]    = useState(false);
  const [showAnswerSheet,  setShowAnswerSheet]  = useState(false);
  const [showTeacherFull,  setShowTeacherFull]  = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null); // имя редактируемого
  const [editingValue, setEditingValue] = useState('');

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

  const handleBulkImport = () => {
    const names = bulkText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    names.forEach(name => addStudent(name));
    setBulkText('');
    setShowBulk(false);
  };

  const handleStartRename = (name) => {
    setEditingStudent(name);
    setEditingValue(name);
  };

  const handleFinishRename = (oldName) => {
    if (editingValue.trim() && editingValue.trim() !== oldName) {
      updateStudentName(oldName, editingValue.trim());
    }
    setEditingStudent(null);
    setEditingValue('');
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

  // CSV экспорт результатов
  const handleExportCSV = () => {
    const calcScore = (data, taskCount) => {
      let total = 0;
      for (let i = 0; i < taskCount; i++) {
        const d = data[String(i)];
        if (!d || (!d.solved && !d.failed)) continue;
        if (d.failed) continue;
        if (d.solved) {
          const a = d.attempts || 0;
          total += a === 0 ? 3 : a === 1 ? 2 : 1;
        }
      }
      return total;
    };

    const header = ['Ученик', ...tasks.map((_, i) => `Задача ${i + 1}`), 'Итого'];
    const rows = students.map(name => {
      const data = trackingData[name] || {};
      const cells = tasks.map((_, i) => {
        const d = data[String(i)];
        if (!d || (!d.solved && !d.failed && !d.attempts)) return '';
        if (d.failed) return '0';
        if (d.solved) {
          const a = d.attempts || 0;
          return String(a === 0 ? 3 : a === 1 ? 2 : 1);
        }
        return `попыток:${d.attempts}`;
      });
      const total = calcScore(data, tasks.length);
      return [name, ...cells, String(total)];
    });

    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const bom = '﻿'; // UTF-8 BOM для Excel
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'марафон'}_результаты.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        extra={
          <Button size="small" onClick={() => setShowBulk(v => !v)}>
            Пакетный импорт
          </Button>
        }
      >
        <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
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

        {showBulk && (
          <div className="mg-bulk-import">
            <Input.TextArea
              placeholder={"Иванов Иван\nПетров Пётр\nСидорова Мария"}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={5}
              style={{ marginBottom: 8 }}
            />
            <Space>
              <Button type="primary" size="small" onClick={handleBulkImport}>
                Добавить всех
              </Button>
              <Button size="small" onClick={() => { setShowBulk(false); setBulkText(''); }}>
                Отмена
              </Button>
            </Space>
            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 4 }}>
              По одному имени на строку. Дубликаты игнорируются.
            </Text>
          </div>
        )}

        {students.length === 0 ? (
          <Text type="secondary">Список учеников пуст</Text>
        ) : (
          <div className="mg-students-list">
            {students.map((name, idx) => (
              <div key={name} className="mg-student-item">
                <span className="mg-student-idx">{idx + 1}.</span>
                {editingStudent === name ? (
                  <Input
                    size="small"
                    value={editingValue}
                    onChange={e => setEditingValue(e.target.value)}
                    onPressEnter={() => handleFinishRename(name)}
                    onBlur={() => handleFinishRename(name)}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                ) : (
                  <span
                    className="mg-student-name"
                    onDoubleClick={() => handleStartRename(name)}
                    title="Двойной клик — переименовать"
                  >
                    {name}
                  </span>
                )}
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

  // Подвкладка: Рабочий лист (2/3/4/5 задач на A4 с ФИ + клеткой)
  const worksheetTab = (
    <div className="mg-print-tab">
      {tasks.length === 0 ? (
        <Empty description="Добавьте задачи в разделе «Содержимое»" />
      ) : (
        <div className="mg-print-actions">
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => setShowWorksheet(true)}
            size="large"
          >
            Открыть рабочий лист
          </Button>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Карточки задач с полем для имени, клетками для попыток и областью для записи решения.
            Режимы: 2 / 3 / 4 / 5 задач на листе A4.
          </Text>
        </div>
      )}
    </div>
  );

  // Подвкладка: Карточки учеников (flashcard-превью)
  const cardsTab = (
    <div className="mg-print-tab">
      {tasks.length === 0 ? (
        <Empty description="Добавьте задачи в разделе «Содержимое»" />
      ) : (
        <>
          <div className="cards-toolbar">
            <button
              className="btn is-primary"
              onClick={() => handlePrint('cards')}
            >
              <PrinterOutlined /> Печать карточек (A6, 4 на лист)
            </button>
            <Space>
              <Switch size="small" checked={showLogo} onChange={setShowLogo} />
              <Text type="secondary" style={{ fontSize: 13 }}>Логотип</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Каждая карточка — одна задача. Распечатайте и разрежьте по пунктиру.
            </Text>
          </div>

          <div className="cards-grid">
            {tasks.map((task, idx) => {
              const diff = task.difficulty || 1;
              const diffClass = { 1: 'easy', 2: 'med', 3: 'hard' }[diff];
              // Детерминированный наклон по task.id
              const rot = ((task.id.charCodeAt(0) + task.id.charCodeAt(1)) % 7) - 3;
              return (
                <div
                  key={task.id}
                  className="flashcard"
                  style={{ '--rot': `${rot * 0.4}deg` }}
                >
                  <div className={`fc-header ${diffClass}`}>
                    <span className="fc-num">{idx + 1}</span>
                    <span className="fc-diff">{DIFFICULTY_LABEL[diff]}</span>
                    <span className="fc-code">{task.code}</span>
                  </div>
                  <div className="fc-body">
                    <MathRenderer content={task.statement_md || ''} />
                    <span className="fc-watermark">LEMMA</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // Подвкладка: Лист учителя (два варианта)
  const teacherTab = (
    <div className="mg-print-tab">
      {tasks.length === 0 ? (
        <Empty description="Добавьте задачи в разделе «Содержимое»" />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* Вариант 1: компактный лист ответов */}
          <div className="mg-print-actions">
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => setShowAnswerSheet(true)}
              size="large"
            >
              Лист ответов
            </Button>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Сетка карточек на одном A4: номер + чертёж + ответ. Без условия.
              Удобно для большого набора простых задач.
            </Text>
          </div>

          {/* Вариант 2: полный лист учителя */}
          <div className="mg-print-actions">
            <Button
              icon={<PrinterOutlined />}
              onClick={() => setShowTeacherFull(true)}
              size="large"
            >
              Полный лист учителя
            </Button>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Таблица с условием, ответом и решением. Для сложных задач, где нужен контекст при проверке.
            </Text>
          </div>
        </Space>
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

  const trackerContent = (
    <div className="lesson-hud">
      {/* Левая колонка: тулбар + грид/очередь */}
      <div style={{ minWidth: 0 }}>
        {/* Тулбар урока */}
        <div className="mg-lesson-toolbar">
          {/* Grid / Queue toggle */}
          <div className="seg">
            <button
              className={trackerMode === 'grid' ? 'is-active' : ''}
              onClick={() => setTrackerMode('grid')}
            >
              📊 Сетка
            </button>
            <button
              className={trackerMode === 'queue' ? 'is-active' : ''}
              onClick={() => setTrackerMode('queue')}
            >
              📋 По задачам
            </button>
          </div>

          {savedId && (
            <button
              className="btn is-primary"
              onClick={() => {
                const base = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/student`;
                window.open(`${base}/marathon-live/${savedId}`, '_blank');
              }}
            >
              <DashboardOutlined /> Live-дашборд
            </button>
          )}

          <button className="btn" onClick={handleInitTracking}>
            <ReloadOutlined /> Сброс трекера
          </button>
        </div>

        {trackerMode === 'grid' ? (
          <MarathonTracker
            tasks={tasks}
            students={students}
            trackingData={trackingData}
            setTrackingData={setTrackingData}
            onSaveTracking={savedId ? saveTracking : null}
          />
        ) : (
          <QueueBoard
            tasks={tasks}
            students={students}
            trackingData={trackingData}
            setTrackingData={setTrackingData}
            onSaveTracking={savedId ? saveTracking : null}
          />
        )}
      </div>

      {/* Правая колонка: сайдбар */}
      <LessonSidebar
        students={students}
        tasks={tasks}
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
    { key: 'content',   label: 'Содержимое',      icon: <OrderedListOutlined /> },
    { key: 'worksheet', label: 'Рабочий лист',    icon: <PrinterOutlined /> },
    { key: 'cards',     label: 'Карточки',         icon: <FileTextOutlined /> },
    { key: 'teacher',   label: 'Лист учителя',    icon: <UserOutlined /> },
    { key: 'rating',    label: 'Бланк рейтинга',  icon: <TrophyOutlined /> },
  ];

  const LIVE_TABS = [
    { key: 'tracker', label: 'Трекер', icon: <TrophyOutlined /> },
  ];

  const currentPrepContent = {
    content: contentTab,
    worksheet: worksheetTab,
    cards: cardsTab,
    teacher: teacherTab,
    rating: ratingTab,
  };

  const currentLiveContent = {
    tracker: trackerInitialized ? trackerContent : initScreen,
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

  if (showWorksheet) {
    return (
      <MarathonWorksheetPrint
        tasks={tasks}
        title={title}
        onBack={() => setShowWorksheet(false)}
      />
    );
  }

  if (showAnswerSheet) {
    return (
      <MarathonTeacherSheet
        tasks={tasks}
        title={title}
        onBack={() => setShowAnswerSheet(false)}
      />
    );
  }

  if (showTeacherFull) {
    return (
      <MarathonTeacherSheetFull
        tasks={tasks}
        title={title}
        onBack={() => setShowTeacherFull(false)}
      />
    );
  }

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
            {phase === 'live' && students.length > 0 && tasks.length > 0 && (
              <button className="btn" onClick={handleExportCSV} title="Экспорт результатов CSV">
                ↓ CSV
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
      {printMode === 'rating' && (
        <MarathonRatingPrint students={students} taskCount={tasks.length} title={title} />
      )}
    </div>
  );
}
