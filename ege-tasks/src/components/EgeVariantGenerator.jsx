import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import dayjs from 'dayjs';
import {
  Card, Button, Space, Alert, Spin, Row, Col, Statistic,
  Table, Select, Tag, Tooltip, Typography, App, InputNumber, Switch, Progress,
  DatePicker, Input,
} from 'antd';
import {
  ThunderboltOutlined,
  InfoCircleOutlined,
  PushpinOutlined,
  PushpinFilled,
  SwapOutlined,
  DeleteOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useWorksheetActions,
  useTaskEditing,
} from '../hooks';
import MathRenderer from './MathRenderer';
import VariantRenderer from './worksheet/VariantRenderer';
import AnswersPage from './worksheet/AnswersPage';
import ActionButtons from './worksheet/ActionButtons';
import ParallelVariantsModal from './worksheet/ParallelVariantsModal';
import SaveWorkModal from './worksheet/SaveWorkModal';
import LoadWorkModal from './worksheet/LoadWorkModal';
import SessionPanel from './worksheet/SessionPanel';
import TaskSelectModal from './TaskSelectModal';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import { api } from '../services/pocketbase';
import './TaskWorksheet.css';
import './EgeVariantGenerator.css';

const { Text } = Typography;
const { Option } = Select;
const APP_BRAND = '© Лемма 2025–2026 уч. г.';


// Размеры в px (при 96dpi: 1mm ≈ 3.78px)
const MM_TO_PX = 3.78;
const KIM_GAP_PX = 2.5 * MM_TO_PX; // 2.5mm gap

/**
 * Разбивает задачи по страницам на основе реальных DOM-измерений.
 * Простой жадный алгоритм: кладём задачу на текущую страницу если влезает,
 * иначе — на следующую.
 *
 * Размеры A5-страницы (148.5mm × 210mm):
 *   padding: 5mm top/bottom, 5mm left/right
 *   content area: 138.5mm × 200mm
 *
 * Вычет "служебных" зон:
 *   header (text ~3mm + margin-bottom 4mm) ≈ 7mm
 *   footer (padding-top 2mm + text 3mm) ≈ 5mm
 *   → для задач: 200 - 7 - 5 = 188mm
 *
 * Первая страница задач (стр.2) дополнительно имеет note-box:
 *   padding 1.5mm×2 + text 11px×3×1.18 ≈ 13mm + margin-bottom 2mm ≈ 18mm
 *   → для задач: 188 - 15 = 173mm (берём 172 с небольшим запасом)
 */
const paginateKimByHeight = (tasks, heights) => {
  const withNumbers = tasks.map((task, i) => ({ ...task, kimNumber: i + 1 }));
  if (withNumbers.length === 0) return [];

  const PAGE_HEIGHT_PX = 188 * MM_TO_PX;
  const FIRST_PAGE_HEIGHT_PX = 172 * MM_TO_PX;

  const pages = [];
  let current = [];
  let usedPx = 0;

  for (const task of withNumbers) {
    const h = heights.get(task.id) || 60; // fallback
    const capacity = pages.length === 0 ? FIRST_PAGE_HEIGHT_PX : PAGE_HEIGHT_PX;
    const gapCost = current.length > 0 ? KIM_GAP_PX : 0;

    if (current.length > 0 && usedPx + gapCost + h > capacity) {
      pages.push(current);
      current = [];
      usedPx = 0;
    }

    if (current.length > 0) usedPx += KIM_GAP_PX;
    current.push(task);
    usedPx += h;
  }
  if (current.length > 0) pages.push(current);

  return pages;
};

const KimCoverPage = ({ variant, kimMeta }) => (
  <div className="kim-page kim-page-cover">
    <div className="kim-cover-body">
      <div className="kim-cover-title">Тренировочная работа по МАТЕМАТИКЕ</div>
      <div className="kim-cover-class">{kimMeta.classNum} класс</div>
      <div className="kim-cover-date">{kimMeta.displayDate}</div>
      <div className="kim-cover-variant">Вариант {kimMeta.variantNumberOverride || variant.number}</div>
      <div className="kim-cover-level">(базовый уровень)</div>

      <div className="kim-cover-student-row">
        <span>Выполнена: ФИО</span>
        <span className="kim-cover-line kim-cover-line-name" />
        <span>класс</span>
        <span className="kim-cover-line kim-cover-line-class" />
      </div>

      <div className="kim-cover-instruction-title">Инструкция по выполнению работы</div>

      <div className="kim-cover-text">
        <p>Работа по математике включает в себя 21 задание.</p>
        <p>На выполнение работы отводится 3 часа (180 минут).</p>
        <p>Ответы к заданиям записываются в виде числа или последовательности цифр в поле ответа в тексте работы.</p>
        <p>При выполнении заданий можно пользоваться черновиком. Записи в черновике не учитываются при оценивании работы. Баллы, полученные Вами за выполненные задания, суммируются. Постарайтесь выполнить как можно больше заданий и набрать наибольшее количество баллов.</p>
      </div>

      <div className="kim-cover-wish">Желаем успеха!</div>
    </div>
    <div className="kim-page-footer">{kimMeta.brand}</div>
  </div>
);

const KimTaskPage = ({ variant, pageNumber, tasks, kimMeta }) => (
  <div className="kim-page kim-page-task">
    <div className="kim-page-header">
      <span>Математика. {kimMeta.classNum} класс. Вариант {kimMeta.variantNumberOverride || variant.number}</span>
      <span>{pageNumber}</span>
    </div>

    {pageNumber === 2 && (
      <div className="kim-page-note">
        <em>Ответом к каждому заданию является конечная десятичная дробь,
        целое число или последовательность цифр. Запишите ответы
        к заданиям в поле ответа в тексте работы.</em>
      </div>
    )}

    <div className="kim-book-tasks">
      {tasks.map((task) => {
        const taskImageUrl = api.getTaskImageUrl(task);
        return (
          <div key={task.id} className="kim-book-task">
            <div className="kim-book-task-number">{task.kimNumber}</div>
            <div className="kim-book-task-main">
              <div className="kim-book-task-content">
                <MathRenderer text={task.statement_md} />
                {task.has_image && taskImageUrl && (
                  <div className="kim-book-task-image">
                    <img src={taskImageUrl} alt="" />
                  </div>
                )}
              </div>
              <div className="kim-book-answer">
                <span>Ответ:</span>
                <span className="kim-book-answer-line" />
                <span className="kim-book-answer-dot">.</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    <div className="kim-page-footer">{kimMeta.brand}</div>
  </div>
);

/**
 * Печатный КИМ — плоский список A5-страниц.
 *
 * Двухфазный рендер:
 *  1. "measure": задачи рендерятся в скрытый блок внутри React-дерева,
 *     CSS применяется корректно (таблицы, KaTeX и т.д.)
 *  2. useLayoutEffect синхронно снимает offsetHeight, вычисляет пагинацию
 *  3. "render": плоский список A5-страниц (cover + task pages)
 *
 * Для печати: браузер сам разбивает по @page { size: A5; }.
 * Чтобы получить два листа на одном A4 — выбрать "2 страницы на листе" в диалоге печати.
 */
const KimVariantPrint = ({ variant, kimMeta }) => {
  const tasks = variant.tasks || [];
  const [state, setState] = useState({ taskKey: null, pages: null });
  const taskRefs = useRef([]);

  // Ключ measure-фазы включает СОДЕРЖИМОЕ, а не только id — иначе правка
  // задачи через редактор (id не меняется) не триггерит перерасчёт пагинации
  // и КИМ печатает устаревший текст из закэшированных страниц.
  const taskKey = tasks
    .map((t) => `${t.id}|${t.statement_md || ''}|${t.image || ''}|${t.has_image ? 1 : 0}`)
    .join('§');
  const needsMeasure = state.taskKey !== taskKey;

  useLayoutEffect(() => {
    if (!needsMeasure) return;
    if (tasks.length === 0) { setState({ taskKey, pages: [] }); return; }

    const heights = new Map();
    tasks.forEach((task, index) => {
      const el = taskRefs.current[index];
      if (el) heights.set(task.id, el.offsetHeight);
    });
    setState({ taskKey, pages: paginateKimByHeight(tasks, heights) });
  });

  // ── Фаза 1: скрытый рендер для измерения ──
  if (needsMeasure) {
    return (
      <div className="kim-measure-root">
        <div className="kim-measure-page">
          <div className="kim-measure-tasks">
            {tasks.map((task, index) => {
              const taskImageUrl = api.getTaskImageUrl(task);
              return (
                <div
                  key={task.id}
                  ref={(el) => { taskRefs.current[index] = el; }}
                  className="kim-book-task"
                >
                  <div className="kim-book-task-number">{index + 1}</div>
                  <div className="kim-book-task-main">
                    <div className="kim-book-task-content">
                      <MathRenderer text={task.statement_md} />
                      {task.has_image && taskImageUrl && (
                        <div className="kim-book-task-image">
                          <img src={taskImageUrl} alt="" />
                        </div>
                      )}
                    </div>
                    <div className="kim-book-answer">
                      <span>Ответ:</span>
                      <span className="kim-book-answer-line" />
                      <span className="kim-book-answer-dot">.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Фаза 2: плоский список A5-страниц ──
  const taskPages = state.pages || [];
  if (taskPages.length === 0) return null;

  return (
    <div className="kim-booklet">
      <KimCoverPage variant={variant} kimMeta={kimMeta} />
      {taskPages.map((pageTasks, index) => (
        <KimTaskPage
          key={index}
          variant={variant}
          pageNumber={index + 2}
          tasks={pageTasks}
          kimMeta={kimMeta}
        />
      ))}
    </div>
  );
};

/**
 * Генератор полных вариантов ЕГЭ базового уровня (21 задание)
 */
const EgeVariantGenerator = () => {
  const { message } = App.useApp();
  const { egeBaseTopics, subtopics, tags, topics, years, sources, tasksSnapshot } = useReferenceData();
  const printRef = useRef();

  // Настройки каждого слота (21 строка)
  const [slots, setSlots] = useState([]);

  // Настройки генерации
  const [variantsCount, setVariantsCount] = useState(1);
  const [variantsMode, setVariantsMode] = useState('different');

  // Настройки формата
  const [columns] = useState(1);
  const [fontSize, setFontSize] = useState(13);
  const [solutionSpace, setSolutionSpace] = useState('medium');
  const [showSolutionSpace, setShowSolutionSpace] = useState(true);
  const [compactMode] = useState(false);
  const [kimStyle, setKimStyle] = useState(false);
  const [kimVariantNumber, setKimVariantNumber] = useState('');
  const [kimClass, setKimClass] = useState('11');
  const [kimDate, setKimDate] = useState(null); // null = сегодня, dayjs-объект когда задана
  const [kimShowYear, setKimShowYear] = useState(true);

  // Вычисляемые значения для КИМ-печати
  const kimDisplayDate = (kimDate ? kimDate.toDate() : new Date())
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(' г.', ' года');
  const kimBrand = kimShowYear ? APP_BRAND : '© Лемма';
  const kimMeta = {
    variantNumberOverride: kimVariantNumber.trim(),
    classNum: kimClass || '11',
    displayDate: kimDisplayDate,
    brand: kimBrand,
  };

  // Модальные окна
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [parallelOpen, setParallelOpen] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [currentWork, setCurrentWork] = useState(null);

  // Модальное окно выбора задачи для фиксации
  const [pinModalSlotIndex, setPinModalSlotIndex] = useState(null);

  // Хуки
  const { variants, setVariants, loading, generateFromStructure, reset } = useWorksheetGeneration();
  const dragDropHandlers = useTaskDragDrop(variants, setVariants);
  const {
    saving,
    exporting,
    handlePrint,
    handleExportPDF,
    handleSaveWork,
    handleUpdateWork,
    handleLoadWorks,
    handleLoadWork,
    handleDeleteWork,
    pdfMethod,
    setPdfMethod,
    puppeteerAvailable,
  } = useWorksheetActions();
  const taskEditing = useTaskEditing(variants, setVariants);

  // Инициализируем слоты как только загрузятся egeBaseTopics
  useEffect(() => {
    if (egeBaseTopics.length === 0) return;
    if (slots.length > 0) return;
    setSlots(
      egeBaseTopics.map(topic => ({
        topicId: topic.id,
        pinnedTask: null,
        subtopics: [],
        difficulty: [],
        tags: [],
      }))
    );
  }, [egeBaseTopics]); // eslint-disable-line react-hooks/exhaustive-deps

  // Подтемы, сгруппированные по теме
  const subtopicsByTopic = useMemo(() => {
    const map = {};
    subtopics.forEach(s => {
      if (!map[s.topic]) map[s.topic] = [];
      map[s.topic].push(s);
    });
    return map;
  }, [subtopics]);

  // Средний success_rate по каждому слоту (из tasksSnapshot)
  // -1 = нет данных (задача никогда не выдавалась)
  const successRateByTopic = useMemo(() => {
    const map = {};
    egeBaseTopics.forEach(topic => {
      // Только задачи с реальными данными (success_rate >= 0)
      const tested = tasksSnapshot.filter(
        t => t.topic === topic.id && t.success_rate != null && t.success_rate >= 0
      );
      if (tested.length === 0) {
        map[topic.id] = null;
      } else {
        const avg = tested.reduce((s, t) => s + t.success_rate, 0) / tested.length;
        map[topic.id] = avg;
      }
    });
    return map;
  }, [egeBaseTopics, tasksSnapshot]);

  // Подсчёт зафиксированных слотов
  const pinnedCount = useMemo(() => slots.filter(s => s.pinnedTask).length, [slots]);

  const updateSlot = (index, field, value) => {
    setSlots(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const openPinModal = (slotIndex) => setPinModalSlotIndex(slotIndex);

  const handlePinTask = (task) => {
    if (pinModalSlotIndex === null) return;
    updateSlot(pinModalSlotIndex, 'pinnedTask', task);
    setPinModalSlotIndex(null);
    message.success(`Задача ${task.code} зафиксирована в слоте №${egeBaseTopics[pinModalSlotIndex]?.ege_number}`);
  };

  const unpinSlot = (index) => updateSlot(index, 'pinnedTask', null);

  const handleGenerate = async () => {
    if (slots.length === 0) {
      message.warning('Темы ЕГЭ ещё загружаются...');
      return;
    }
    const structure = slots.map(slot => ({
      topic: slot.topicId,
      subtopics: slot.subtopics,
      difficulty: slot.difficulty,
      tags: slot.tags,
      count: 1,
    }));
    await generateFromStructure(structure, {
      variantsMode,
      variantsCount,
      sortType: 'structured',
      progressiveDifficulty: false,
    });
  };

  // Применяем pinnedTask после генерации
  useEffect(() => {
    if (variants.length === 0) return;
    const hasPinned = slots.some(s => s.pinnedTask);
    if (!hasPinned) return;
    setVariants(prev => prev.map(variant => ({
      ...variant,
      tasks: variant.tasks.map((task, idx) => {
        const slot = slots[idx];
        return slot?.pinnedTask ?? task;
      }),
    })));
  }, [variants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => { reset(); setCurrentWork(null); };

  // Печать КИМ-варианта с правильными полями A4
  const handleKimPrint = () => {
    const styleId = 'kim-print-page-style';
    document.getElementById(styleId)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    // A5 portrait — поля внутри .kim-page (padding: 5mm)
    style.textContent = '@page { size: A5 portrait; margin: 0; }';
    document.head.appendChild(style);
    const cleanup = () => {
      style.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  const handleSave = async (values) => {
    if (currentWork?.id) {
      await handleUpdateWork(currentWork.id, values, variants);
    } else {
      const work = await handleSaveWork(values, variants);
      if (work) setCurrentWork(work);
    }
    setSaveModalVisible(false);
  };

  const handleOpenLoadModal = async () => {
    setLoadModalVisible(true);
    setLoadingWorks(true);
    try {
      const works = await handleLoadWorks();
      setSavedWorks(works);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleLoad = async (workId) => {
    setLoadingWorks(true);
    try {
      const { work, variants: loaded } = await handleLoadWork(workId);
      setVariants(loaded);
      setCurrentWork(work);
      setLoadModalVisible(false);
      message.success(`Работа "${work.title}" загружена`);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleDelete = async (workId) => {
    await handleDeleteWork(workId);
    setSavedWorks(prev => prev.filter(w => w.id !== workId));
  };

  const topicForSlot = (slot) => egeBaseTopics.find(t => t.id === slot.topicId);

  // Рендер индикатора success_rate
  const renderSuccessRate = (topicId) => {
    const rate = successRateByTopic[topicId];
    if (rate === null || rate === undefined) {
      return <Text type="secondary" style={{ fontSize: 11 }}>нет данных</Text>;
    }
    const pct = Math.round(rate * 100);
    const color = pct >= 70 ? '#52c41a' : pct >= 40 ? '#faad14' : '#ff4d4f';
    return (
      <Tooltip title={`Средний процент правильных ответов по задачам этой темы: ${pct}%`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress
            percent={pct}
            size="small"
            strokeColor={color}
            showInfo={false}
            style={{ width: 60, margin: 0 }}
          />
          <Text style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}%</Text>
        </div>
      </Tooltip>
    );
  };

  // Колонки таблицы структуры
  const tableColumns = [
    {
      title: '№',
      dataIndex: 'num',
      width: 48,
      render: (_, __, index) => {
        const topic = topicForSlot(slots[index]);
        return (
          <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
            {topic?.ege_number ?? index + 1}
          </Tag>
        );
      },
    },
    {
      title: 'Тема',
      dataIndex: 'topic',
      width: 260,
      render: (_, __, index) => {
        const topic = topicForSlot(slots[index]);
        if (!topic) return null;
        const shortTitle = topic.title.replace(/^ЕГЭ-База\. №\d+\s+/, '');
        return <Text type="secondary" style={{ fontSize: 12 }}>{shortTitle}</Text>;
      },
    },
    {
      title: 'Успеваемость',
      dataIndex: 'stats',
      width: 120,
      render: (_, __, index) => {
        const slot = slots[index];
        return renderSuccessRate(slot.topicId);
      },
    },
    {
      title: 'Подтема',
      dataIndex: 'subtopics',
      width: 190,
      render: (_, __, index) => {
        const slot = slots[index];
        const topic = topicForSlot(slot);
        const topicSubs = topic ? (subtopicsByTopic[topic.id] || []) : [];
        if (topicSubs.length === 0) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        return (
          <Select
            mode="multiple"
            placeholder="Любая"
            value={slot.subtopics}
            onChange={v => updateSlot(index, 'subtopics', v)}
            size="small"
            style={{ width: '100%' }}
            maxTagCount={1}
          >
            {topicSubs.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
          </Select>
        );
      },
    },
    {
      title: 'Сложность',
      dataIndex: 'difficulty',
      width: 130,
      render: (_, __, index) => {
        const slot = slots[index];
        return (
          <Select
            mode="multiple"
            placeholder="Любая"
            value={slot.difficulty}
            onChange={v => updateSlot(index, 'difficulty', v)}
            size="small"
            style={{ width: '100%' }}
            maxTagCount={1}
          >
            <Option value={1}><Tag color="green">Лёгкая</Tag></Option>
            <Option value={2}><Tag color="orange">Средняя</Tag></Option>
            <Option value={3}><Tag color="red">Сложная</Tag></Option>
          </Select>
        );
      },
    },
    {
      title: 'Зафиксировать',
      dataIndex: 'pin',
      width: 160,
      render: (_, __, index) => {
        const slot = slots[index];
        if (slot.pinnedTask) {
          return (
            <Space size={4}>
              <Tag
                icon={<PushpinFilled />}
                color="gold"
                style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {slot.pinnedTask.code}
              </Tag>
              <Tooltip title="Снять фиксацию">
                <Button
                  size="small" type="text" danger
                  icon={<DeleteOutlined />}
                  onClick={() => unpinSlot(index)}
                />
              </Tooltip>
            </Space>
          );
        }
        return (
          <Button
            size="small" type="dashed" icon={<PushpinOutlined />}
            onClick={() => openPinModal(index)}
          >
            Выбрать
          </Button>
        );
      },
    },
  ];

  const tableData = slots.map((_, index) => ({ key: index }));
  const hasVariants = variants.length > 0;

  return (
    <div className="task-worksheet-container">
      <Alert
        message="Генератор вариантов ЕГЭ (базовый уровень)"
        description={
          <div>
            <div>📋 Полный вариант ЕГЭ — 21 задание с кратким ответом</div>
            <div>📊 Колонка «Успеваемость» показывает % правильных ответов учеников по теме</div>
            <div>📌 Фиксация конкретных задач по любому номеру</div>
            <div>🖨️ Обычная печать или в стиле КИМ (официальный бланк)</div>
          </div>
        }
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        className="no-print"
        style={{ marginBottom: 16 }}
      />

      {/* Настройки */}
      <Card
        title="Структура варианта ЕГЭ"
        className="no-print"
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {pinnedCount > 0 && `📌 Зафиксировано: ${pinnedCount}`}
            </Text>
            <Button icon={<FolderOpenOutlined />} onClick={handleOpenLoadModal} size="small">
              Загрузить
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {egeBaseTopics.length === 0 ? (
          <Spin tip="Загрузка тем ЕГЭ..." />
        ) : (
          <>
            <Alert
              message="Для каждого номера задания ЕГЭ можно ограничить подтему, сложность или зафиксировать конкретную задачу. Оставьте поля пустыми — задача выберется случайно."
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
            />
            <Table
              dataSource={tableData}
              columns={tableColumns}
              pagination={false}
              size="small"
              bordered
              rowKey="key"
              scroll={{ x: 900 }}
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16} align="middle" wrap>
              <Col>
                <Text strong>Вариантов:</Text>{' '}
                <InputNumber
                  min={1} max={30}
                  value={variantsCount}
                  onChange={v => setVariantsCount(v || 1)}
                  style={{ width: 70 }}
                  size="small"
                />
              </Col>
              <Col>
                <Text strong>Режим:</Text>{' '}
                <Select
                  value={variantsMode}
                  onChange={setVariantsMode}
                  size="small"
                  style={{ width: 210 }}
                >
                  <Option value="different">Разные задачи (рекомендовано)</Option>
                  <Option value="shuffled">Одни задачи, разный порядок</Option>
                  <Option value="same">Одинаковые варианты</Option>
                </Select>
              </Col>
              <Col>
                <Space>
                  <Text strong>Место для решения:</Text>
                  <Switch
                    checked={showSolutionSpace}
                    onChange={setShowSolutionSpace}
                    size="small"
                    disabled={kimStyle}
                  />
                </Space>
              </Col>
              <Col>
                <Space>
                  <Text strong>Стиль КИМ:</Text>
                  <Tooltip title="Печать в официальном формате: шапка с полями для ФИО, задания с ячейками ответов, лист ответов">
                    <Switch
                      checked={kimStyle}
                      onChange={v => { setKimStyle(v); if (v) setShowSolutionSpace(false); }}
                      size="small"
                      checkedChildren={<FileTextOutlined />}
                    />
                  </Tooltip>
                </Space>
              </Col>
              <Col flex="auto" />
              <Col>
                <Space>
                  {hasVariants && (
                    <Button onClick={handleReset} size="small">Сбросить</Button>
                  )}
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={loading}
                    onClick={handleGenerate}
                    size="middle"
                  >
                    {hasVariants ? 'Перегенерировать' : 'Сгенерировать'}
                  </Button>
                </Space>
              </Col>
            </Row>

            {/* Настройки КИМ — дополнительная строка */}
            {kimStyle && (
              <Row
                gutter={16}
                align="middle"
                wrap
                style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e8e8e8' }}
              >
                <Col>
                  <Space size={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Вариант №</Text>
                    <Input
                      value={kimVariantNumber}
                      onChange={e => setKimVariantNumber(e.target.value)}
                      placeholder="авто"
                      size="small"
                      style={{ width: 72 }}
                      maxLength={8}
                    />
                  </Space>
                </Col>
                <Col>
                  <Space size={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Класс</Text>
                    <Input
                      value={kimClass}
                      onChange={e => setKimClass(e.target.value)}
                      size="small"
                      style={{ width: 56 }}
                      maxLength={4}
                    />
                  </Space>
                </Col>
                <Col>
                  <Space size={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Дата</Text>
                    <DatePicker
                      value={kimDate}
                      onChange={setKimDate}
                      format="DD.MM.YYYY"
                      placeholder="сегодня"
                      size="small"
                      allowClear
                      style={{ width: 130 }}
                    />
                  </Space>
                </Col>
                <Col>
                  <Space size={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Год в подписи</Text>
                    <Switch
                      checked={kimShowYear}
                      onChange={setKimShowYear}
                      size="small"
                    />
                  </Space>
                </Col>
                {(kimVariantNumber || kimClass !== '11' || kimDate) && (
                  <Col>
                    <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                      → {kimDisplayDate} · {kimClass} кл. · Вар.&nbsp;{kimVariantNumber || '(авто)'}
                    </Text>
                  </Col>
                )}
              </Row>
            )}
          </>
        )}
      </Card>

      {/* Ожидание генерации */}
      {loading && (
        <Card className="no-print">
          <Spin tip={`Подбираем задачи для ${variantsCount} варианта(-ов)...`} size="large">
            <div style={{ padding: 40 }} />
          </Spin>
        </Card>
      )}

      {hasVariants && !loading && (
        <>
          {/* Статистика */}
          <Card className="no-print" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col>
                <Statistic title="Вариантов" value={variants.length} />
              </Col>
              <Col>
                <Statistic title="Заданий в варианте" value={variants[0]?.tasks.length ?? 0} />
              </Col>
              <Col>
                <Statistic
                  title="Всего задач"
                  value={variants.reduce((s, v) => s + v.tasks.length, 0)}
                />
              </Col>
              {kimStyle && (
                <Col>
                  <Statistic title="Формат" value="КИМ" valueStyle={{ color: '#1890ff' }} />
                </Col>
              )}
            </Row>
          </Card>

          {/* Кнопки действий */}
          <div className="no-print" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <ActionButtons
              hasVariants={hasVariants}
              onPrint={kimStyle ? null : () => handlePrint(printRef)}
              onExportPDF={kimStyle ? null : () => handleExportPDF(printRef, 'Вариант ЕГЭ базовый уровень')}
              onSave={() => setSaveModalVisible(true)}
              pdfMethod={pdfMethod}
              setPdfMethod={kimStyle ? null : setPdfMethod}
              puppeteerAvailable={puppeteerAvailable}
              saving={saving}
              exporting={exporting}
            />
            {kimStyle && (
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                size="large"
                onClick={handleKimPrint}
              >
                Распечатать КИМ
              </Button>
            )}
            {variants[0]?.tasks?.length > 0 && (
              <Button onClick={() => setParallelOpen(true)}>
                🧬 Параллельные варианты (по образцу)
              </Button>
            )}
          </div>
          <ParallelVariantsModal
            open={parallelOpen}
            onClose={() => setParallelOpen(false)}
            baseTasks={variants[0]?.tasks || []}
            baseTitle="Вариант ЕГЭ"
          />

          {/* Область печати */}
          <div ref={printRef}>
            {variants.map((variant, vi) => (
              <div key={variant.number}>
                {/* Заголовок на экране */}
                <div className="no-print" style={{
                  borderBottom: '2px solid #1890ff',
                  marginBottom: 8,
                  paddingBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <Tag color="blue" style={{ fontSize: 14, padding: '2px 10px' }}>
                    Вариант {variant.number}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {variant.tasks.length} заданий
                  </Text>
                  {kimStyle && <Tag color="geekblue" icon={<FileTextOutlined />}>КИМ</Tag>}
                </div>

                {/* Обычный вид (экран + обычная печать) */}
                {!kimStyle && (
                  <VariantRenderer
                    variant={variant}
                    variantIndex={vi}
                    compactMode={compactMode}
                    fontSize={fontSize}
                    columns={columns}
                    showStudentInfo={true}
                    showAnswersInline={false}
                    solutionSpace={showSolutionSpace ? solutionSpace : 'none'}
                    variantLabel="Вариант"
                    hideTaskPrefixes={false}
                    dragDropHandlers={dragDropHandlers}
                    onEditTask={taskEditing.handleEditTask}
                    onReplaceTask={taskEditing.handleReplaceTask}
                  />
                )}

                {/* КИМ-стиль: экран — редактируемый вид, печать — официальный КИМ */}
                {kimStyle && (
                  <>
                    {/* Экранный вид для редактирования */}
                    <div className="no-print">
                      <VariantRenderer
                        variant={variant}
                        variantIndex={vi}
                        compactMode={compactMode}
                        fontSize={fontSize}
                        columns={columns}
                        showStudentInfo={true}
                        showAnswersInline={false}
                        solutionSpace="none"
                        variantLabel="Вариант"
                        hideTaskPrefixes={false}
                        dragDropHandlers={dragDropHandlers}
                        onEditTask={taskEditing.handleEditTask}
                        onReplaceTask={taskEditing.handleReplaceTask}
                      />
                    </div>
                    {/* Печатный КИМ-вид — вне print-only, чтобы measure-фаза (offsetHeight)
                        работала корректно. На экране скрывается через .kim-booklet в CSS. */}
                    <KimVariantPrint variant={variant} kimMeta={kimMeta} />
                  </>
                )}

                {vi < variants.length - 1 && <div className="page-break" />}
              </div>
            ))}

            {/* Страница ответов — только для обычного стиля */}
            {!kimStyle && <AnswersPage variants={variants} variantLabel="Вариант" />}
          </div>

          {/* Онлайн-выдача */}
          {currentWork?.id && (
            <Card title="Онлайн-выдача варианта" className="no-print" style={{ marginTop: 16 }}>
              <SessionPanel workId={currentWork.id} />
            </Card>
          )}

          {!currentWork?.id && (
            <Alert
              className="no-print"
              style={{ marginTop: 16 }}
              message="Сохраните работу для онлайн-выдачи ученикам"
              description={
                <Button icon={<SaveOutlined />} type="primary" onClick={() => setSaveModalVisible(true)}>
                  Сохранить работу
                </Button>
              }
              type="warning"
              showIcon
            />
          )}
        </>
      )}

      {/* Модалы */}
      <SaveWorkModal
        visible={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onSave={handleSave}
        saving={saving}
        currentWork={currentWork}
        defaultTitle="Вариант ЕГЭ (база)"
      />
      <LoadWorkModal
        visible={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        onLoad={handleLoad}
        onDelete={handleDelete}
        works={savedWorks}
        loading={loadingWorks}
      />
      <TaskSelectModal
        visible={pinModalSlotIndex !== null}
        onCancel={() => setPinModalSlotIndex(null)}
        onSelect={handlePinTask}
        topics={egeBaseTopics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={[]}
      />

      <TaskReplaceModal
        visible={taskEditing.replaceModalVisible}
        taskToReplace={taskEditing.taskToReplace}
        onConfirm={taskEditing.handleConfirmReplace}
        onCancel={taskEditing.handleCancelReplace}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        currentVariantTasks={
          taskEditing.taskToReplace
            ? variants[taskEditing.taskToReplace.variantIndex]?.tasks || []
            : []
        }
      />

      {taskEditing.taskToEdit && (
        <TaskEditModal
          task={taskEditing.taskToEdit}
          visible={taskEditing.editModalVisible}
          onClose={taskEditing.handleCancelEdit}
          onSave={taskEditing.handleSaveEdit}
          onDelete={taskEditing.handleDeleteEdit}
          allTags={tags || []}
          allSources={sources || []}
          allYears={years || []}
          allSubtopics={subtopics || []}
          allTopics={topics || []}
        />
      )}
    </div>
  );
};

export default EgeVariantGenerator;
