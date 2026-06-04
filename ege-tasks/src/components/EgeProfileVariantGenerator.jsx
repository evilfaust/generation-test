import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
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
import './EgeProfileVariantGenerator.css';

const { Text } = Typography;
const { Option } = Select;
const APP_BRAND = '© Лемма 2025–2026 уч. г.';

// Граница между частями: задания 1–12 — часть 1, 13–19 — часть 2
const PART1_LAST = 12;

// Размеры в px (при 96dpi: 1mm ≈ 3.78px)
const MM_TO_PX = 3.78;
const KIM_GAP_PX = 2.5 * MM_TO_PX; // 2.5mm gap

// Высоты доступной зоны под задачи на A5-странице (см. EgeVariantGenerator)
const PAGE_HEIGHT_PX = 188 * MM_TO_PX;        // обычная страница заданий
const PART1_FIRST_PX = 172 * MM_TO_PX;        // первая стр. части 1 (note-box)
const PART2_FIRST_PX = 150 * MM_TO_PX;        // первая стр. части 2 (блок «Часть 2»)

/**
 * Жадная пагинация уже пронумерованных задач (kimNumber выставлен заранее).
 * @param {Array} tasks      — задачи с полем kimNumber
 * @param {Map}   heights    — id → offsetHeight(px)
 * @param {number} firstCap  — ёмкость первой страницы (px)
 * @param {number} restCap   — ёмкость последующих страниц (px)
 */
const paginateTasks = (tasks, heights, firstCap, restCap) => {
  if (tasks.length === 0) return [];
  const pages = [];
  let current = [];
  let usedPx = 0;

  for (const task of tasks) {
    const h = heights.get(task.id) || 60;
    const capacity = pages.length === 0 ? firstCap : restCap;

    if (current.length > 0 && usedPx + KIM_GAP_PX + h > capacity) {
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

const KimProfileCoverPage = ({ variant, kimMeta }) => (
  <div className="kim-page kim-page-cover">
    <div className="kim-cover-body">
      <div className="kim-cover-title">Тренировочная работа по МАТЕМАТИКЕ</div>
      <div className="kim-cover-class">{kimMeta.classNum} класс</div>
      <div className="kim-cover-date">{kimMeta.displayDate}</div>
      <div className="kim-cover-variant">Вариант {kimMeta.variantNumberOverride || variant.number}</div>
      <div className="kim-cover-level">(профильный уровень)</div>

      <div className="kim-cover-student-row">
        <span>Выполнена: ФИО</span>
        <span className="kim-cover-line kim-cover-line-name" />
        <span>класс</span>
        <span className="kim-cover-line kim-cover-line-class" />
      </div>

      <div className="kim-cover-instruction-title">Инструкция по выполнению работы</div>

      <div className="kim-cover-text">
        <p>Экзаменационная работа состоит из двух частей, включающих в себя 19 заданий. Часть 1 содержит 12 заданий с кратким ответом базового и повышенного уровней сложности. Часть 2 содержит 7 заданий с развёрнутым ответом повышенного и высокого уровней сложности.</p>
        <p>На выполнение работы по математике отводится 3 часа 55 минут (235 минут).</p>
        <p>Ответы к заданиям 1–12 записываются в виде целого числа или конечной десятичной дроби. Запишите ответы в поля ответов в тексте работы.</p>
        <p>При выполнении заданий 13–19 требуется записать полное обоснованное решение и ответ.</p>
        <p>При выполнении заданий можно пользоваться черновиком. Записи в черновике не учитываются при оценивании работы. Баллы, полученные Вами за выполненные задания, суммируются. Постарайтесь выполнить как можно больше заданий и набрать наибольшее количество баллов.</p>
      </div>

      <div className="kim-cover-wish">Желаем успеха!</div>
    </div>
    <div className="kim-page-footer">{kimMeta.brand}</div>
  </div>
);

const KimProfileTask = ({ task, withAnswer }) => {
  const taskImageUrl = api.getTaskImageUrl(task);
  return (
    <div className={`kim-book-task${withAnswer ? '' : ' kim-book-task--part2'}`}>
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
        {withAnswer && (
          <div className="kim-book-answer">
            <span>Ответ:</span>
            <span className="kim-book-answer-line" />
            <span className="kim-book-answer-dot">.</span>
          </div>
        )}
      </div>
    </div>
  );
};

const KimProfileTaskPage = ({ variant, pageNumber, tasks, kimMeta, part, isPartStart }) => (
  <div className="kim-page kim-page-task">
    <div className="kim-page-header">
      <span>Математика. Профильный уровень. {kimMeta.classNum} класс. Вариант {kimMeta.variantNumberOverride || variant.number}</span>
      <span>{pageNumber}</span>
    </div>

    {part === 1 && isPartStart && (
      <div className="kim-page-note">
        <em>Ответом к каждому из заданий 1–12 является целое число
        или конечная десятичная дробь. Запишите ответы к заданиям
        в поле ответа в тексте работы.</em>
      </div>
    )}

    {part === 2 && isPartStart && (
      <div className="kim-part2-intro">
        <div className="kim-part2-title">Часть 2</div>
        <div className="kim-part2-instruction">
          Для записи решений и ответов на задания 13–19 используйте БЛАНК
          ОТВЕТОВ № 2. Запишите сначала номер выполняемого задания
          (13, 14 и т.д.), а затем полное обоснованное решение и ответ.
          Ответы записывайте чётко и разборчиво.
        </div>
      </div>
    )}

    <div className="kim-book-tasks">
      {tasks.map((task) => (
        <KimProfileTask key={task.id} task={task} withAnswer={part === 1} />
      ))}
    </div>

    <div className="kim-page-footer">{kimMeta.brand}</div>
  </div>
);

/**
 * Печатный профильный КИМ — плоский список A5-страниц.
 * Двухфазный рендер (см. EgeVariantGenerator): сперва скрытый блок для измерения
 * высот всех задач, затем раздельная пагинация части 1 (1–12) и части 2 (13–19).
 * Часть 2 всегда стартует с новой страницы.
 */
const KimProfileVariantPrint = ({ variant, kimMeta }) => {
  const allTasks = useMemo(
    () => (variant.tasks || []).map((t, i) => ({ ...t, kimNumber: i + 1 })),
    [variant.tasks]
  );
  const part1 = useMemo(() => allTasks.filter(t => t.kimNumber <= PART1_LAST), [allTasks]);
  const part2 = useMemo(() => allTasks.filter(t => t.kimNumber > PART1_LAST), [allTasks]);

  const [state, setState] = useState({ taskKey: null, pages: null });
  const taskRefs = useRef([]);

  // Ключ measure-фазы включает СОДЕРЖИМОЕ, а не только id — иначе правка
  // задачи через редактор (id не меняется) не триггерит перерасчёт пагинации
  // и КИМ печатает устаревший текст. solution_md важен для части 2.
  const taskKey = allTasks
    .map((t) => `${t.id}|${t.statement_md || ''}|${t.solution_md || ''}|${t.image || ''}|${t.has_image ? 1 : 0}`)
    .join('§');
  const needsMeasure = state.taskKey !== taskKey;

  useLayoutEffect(() => {
    if (!needsMeasure) return;
    if (allTasks.length === 0) { setState({ taskKey, pages: [] }); return; }

    const heights = new Map();
    allTasks.forEach((task, index) => {
      const el = taskRefs.current[index];
      if (el) heights.set(task.id, el.offsetHeight);
    });

    const part1Pages = paginateTasks(part1, heights, PART1_FIRST_PX, PAGE_HEIGHT_PX);
    const part2Pages = paginateTasks(part2, heights, PART2_FIRST_PX, PAGE_HEIGHT_PX);

    const pages = [
      ...part1Pages.map((tasks, i) => ({ part: 1, tasks, isPartStart: i === 0 })),
      ...part2Pages.map((tasks, i) => ({ part: 2, tasks, isPartStart: i === 0 })),
    ];
    setState({ taskKey, pages });
  });

  // ── Фаза 1: скрытый рендер для измерения ──
  if (needsMeasure) {
    return (
      <div className="kim-measure-root">
        <div className="kim-measure-page">
          <div className="kim-measure-tasks">
            {allTasks.map((task, index) => (
              <div
                key={task.id}
                ref={(el) => { taskRefs.current[index] = el; }}
              >
                <KimProfileTask task={task} withAnswer={task.kimNumber <= PART1_LAST} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Фаза 2: плоский список A5-страниц ──
  const pages = state.pages || [];
  if (pages.length === 0) return null;

  return (
    <div className="kim-booklet">
      <KimProfileCoverPage variant={variant} kimMeta={kimMeta} />
      {pages.map((page, index) => (
        <KimProfileTaskPage
          key={index}
          variant={variant}
          pageNumber={index + 2}
          tasks={page.tasks}
          kimMeta={kimMeta}
          part={page.part}
          isPartStart={page.isPartStart}
        />
      ))}
    </div>
  );
};

/**
 * Лист ответов профильного варианта (обычная печать):
 * часть 1 (1–12) — краткие ответы, часть 2 (13–19) — развёрнутые решения с баллами.
 */
const ProfileAnswersPage = ({ variants }) => {
  if (variants.length === 0) return null;
  return (
    <div className="answers-page">
      <h2>Ответы и решения</h2>
      {variants.map((variant) => {
        const tasks = (variant.tasks || []).map((t, i) => ({ ...t, kimNumber: i + 1 }));
        const part1 = tasks.filter(t => t.kimNumber <= PART1_LAST);
        const part2 = tasks.filter(t => t.kimNumber > PART1_LAST);
        return (
          <div key={variant.number} className="variant-answers">
            <h3>Вариант {variant.number}</h3>

            {part1.length > 0 && (
              <>
                <div className="profile-answers-part1-title">Часть 1</div>
                <div className="answers-grid">
                  {part1.map((task) => (
                    <div key={task.id} className="answer-item">
                      <span className="answer-number">{task.kimNumber}.</span>
                      <span className="answer-value">
                        {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {part2.length > 0 && (
              <div className="profile-answers-part2">
                <div className="profile-answers-part2-title">Часть 2</div>
                {part2.map((task) => (
                  <div key={task.id} className="profile-answer-solution">
                    <div className="profile-answer-solution-head">
                      Задание {task.kimNumber}
                      {task.max_score ? (
                        <span className="profile-answer-solution-score"> ({task.max_score} б.)</span>
                      ) : null}
                    </div>
                    {task.solution_md ? (
                      <MathRenderer text={task.solution_md} />
                    ) : task.answer ? (
                      <div>Ответ: <MathRenderer text={task.answer} /></div>
                    ) : (
                      <Text type="secondary">— решение не задано —</Text>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Генератор полных вариантов ЕГЭ профильного уровня (19 заданий: 1–12 краткий
 * ответ, 13–19 развёрнутый ответ).
 */
const EgeProfileVariantGenerator = () => {
  const { message } = App.useApp();
  const { egeProfileTopics, subtopics, tags, topics, years, sources, tasksSnapshot } = useReferenceData();
  const printRef = useRef();

  // Темы профиля по порядку заданий 1→19 (exam_part, затем ege_number)
  const profileTopics = useMemo(
    () => [...egeProfileTopics].sort(
      (a, b) => (a.exam_part || 0) - (b.exam_part || 0) || a.ege_number - b.ege_number
    ),
    [egeProfileTopics]
  );

  // Настройки каждого слота (19 строк)
  const [slots, setSlots] = useState([]);

  // Настройки генерации
  const [variantsCount, setVariantsCount] = useState(1);
  const [variantsMode, setVariantsMode] = useState('different');

  // Настройки формата
  const [columns] = useState(1);
  const [fontSize] = useState(13);
  const [solutionSpace] = useState('medium');
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
  } = useWorksheetActions();
  const taskEditing = useTaskEditing(variants, setVariants);

  // Инициализируем слоты как только загрузятся профильные темы
  useEffect(() => {
    if (profileTopics.length === 0) return;
    if (slots.length > 0) return;
    setSlots(
      profileTopics.map(topic => ({
        topicId: topic.id,
        pinnedTask: null,
        subtopics: [],
        difficulty: [],
        tags: [],
      }))
    );
  }, [profileTopics]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const successRateByTopic = useMemo(() => {
    const map = {};
    profileTopics.forEach(topic => {
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
  }, [profileTopics, tasksSnapshot]);

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
    message.success(`Задача ${task.code} зафиксирована в слоте №${profileTopics[pinModalSlotIndex]?.ege_number}`);
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

  const topicForSlot = (slot) => profileTopics.find(t => t.id === slot.topicId);

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
      width: 56,
      render: (_, __, index) => {
        const topic = topicForSlot(slots[index]);
        const isPart2 = (topic?.ege_number ?? 0) > PART1_LAST;
        return (
          <Tag color={isPart2 ? 'purple' : 'blue'} style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
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
        const shortTitle = topic.title.replace(/^ЕГЭ-Проф(?:иль)?\.?\s*№\d+\s+/, '');
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
        message="Генератор вариантов ЕГЭ (профильный уровень)"
        description={
          <div>
            <div>📋 Полный вариант ЕГЭ — 19 заданий: №1–12 краткий ответ, №13–19 развёрнутый</div>
            <div>📊 Колонка «Успеваемость» показывает % правильных ответов учеников по теме</div>
            <div>📌 Фиксация конкретных задач по любому номеру</div>
            <div>🖨️ Обычная печать (с листом решений) или в стиле КИМ (официальный бланк)</div>
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
        title="Структура варианта ЕГЭ (профиль)"
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
        {profileTopics.length === 0 ? (
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
                  <Tooltip title="Печать в официальном формате: обложка, часть 1 с полями ответа, часть 2 (бланк № 2)">
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
              onExportPDF={kimStyle ? null : () => handleExportPDF(printRef, 'Вариант ЕГЭ профильный уровень')}
              onSave={() => setSaveModalVisible(true)}
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
            baseTitle="Вариант ЕГЭ профиль"
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
                    <KimProfileVariantPrint variant={variant} kimMeta={kimMeta} />
                  </>
                )}

                {vi < variants.length - 1 && <div className="page-break" />}
              </div>
            ))}

            {/* Лист ответов и решений — только для обычного стиля */}
            {!kimStyle && <ProfileAnswersPage variants={variants} />}
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
        defaultTitle="Вариант ЕГЭ (профиль)"
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
        topics={profileTopics}
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

export default EgeProfileVariantGenerator;
