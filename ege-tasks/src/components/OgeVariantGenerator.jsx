import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  BlockOutlined,
} from '@ant-design/icons';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useWorksheetActions,
  useTaskEditing,
} from '../hooks';
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
import { shuffleArray } from '../utils/shuffle';
import { KimOgeVariantPrint, OgeAnswersPage, PART1_LAST } from './OgeKimPrint';
import './TaskWorksheet.css';
import './EgeVariantGenerator.css';
import './EgeProfileVariantGenerator.css';

const { Text } = Typography;
const { Option } = Select;
const APP_BRAND = '© Лемма 2025–2026 уч. г.';

// Практический блок ОГЭ — задания 1–5 (общий план/ситуация = «сюжет»)
const BLOCK_LAST = 5;

/**
 * Генератор полных вариантов ОГЭ (9 класс, 25 заданий: №1–19 часть 1 краткий
 * ответ, №20–25 часть 2 развёрнутый ответ).
 *
 * Особенность ОГЭ — практический блок №1–5: пять заданий относятся к ОДНОЙ
 * ситуации (план/тариф/участок). Чтобы блок был связным, при включённом
 * тумблере «Связный блок 1–5» все пять заданий берутся из одного сюжета
 * (task_contexts) — см. api.getOgeContextBlocks().
 */
const OgeVariantGenerator = () => {
  const { message } = App.useApp();
  const { ogeTopics, subtopics, tags, topics, years, sources, tasksSnapshot } = useReferenceData();
  const printRef = useRef();

  // Темы ОГЭ по порядку заданий 1→25 (по ege_number)
  const orderedTopics = useMemo(
    () => [...ogeTopics].sort((a, b) => (a.ege_number || 0) - (b.ege_number || 0)),
    [ogeTopics]
  );

  // Настройки каждого слота (25 строк)
  const [slots, setSlots] = useState([]);

  // Настройки генерации
  const [variantsCount, setVariantsCount] = useState(1);
  const [variantsMode, setVariantsMode] = useState('different');

  // Связный блок 1–5 (один сюжет) + загруженные сюжеты
  const [coherentBlock, setCoherentBlock] = useState(true);
  const [contextBlocks, setContextBlocks] = useState([]);
  const [contextLoading, setContextLoading] = useState(false);
  // Выбранный учителем сюжет блока 1–5 ('random' = случайный)
  const [selectedContextId, setSelectedContextId] = useState('random');

  // Настройки формата
  const [columns] = useState(1);
  const [fontSize] = useState(13);
  const [solutionSpace] = useState('medium');
  const [showSolutionSpace, setShowSolutionSpace] = useState(true);
  const [compactMode] = useState(false);
  const [kimStyle, setKimStyle] = useState(false);
  const [kimVariantNumber, setKimVariantNumber] = useState('');
  const [kimClass, setKimClass] = useState('9');
  const [kimDate, setKimDate] = useState(null); // null = сегодня, dayjs-объект когда задана
  const [kimShowYear, setKimShowYear] = useState(true);

  // Вычисляемые значения для КИМ-печати
  const kimDisplayDate = (kimDate ? kimDate.toDate() : new Date())
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(' г.', ' года');
  const kimBrand = kimShowYear ? APP_BRAND : '© Лемма';
  const kimMeta = {
    variantNumberOverride: kimVariantNumber.trim(),
    classNum: kimClass || '9',
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

  // Инициализируем слоты как только загрузятся темы ОГЭ
  useEffect(() => {
    if (orderedTopics.length === 0) return;
    if (slots.length > 0) return;
    setSlots(
      orderedTopics.map(topic => ({
        topicId: topic.id,
        pinnedTask: null,
        subtopics: [],
        difficulty: [],
        tags: [],
      }))
    );
  }, [orderedTopics]); // eslint-disable-line react-hooks/exhaustive-deps

  // Пока активен стиль КИМ — держим @page A5 с НУЛЕВЫМИ полями последним
  // правилом в <head>. Иначе глобальный `@page { margin: 10mm 8mm }` из
  // TaskWorksheet.css (безымянные @page решаются по ПОРЯДКУ, а не специфичности;
  // именованные @page Chrome для полей игнорирует) даёт боковые поля 8мм и
  // обрезает правый край длинных задач. Инъекция в конец <head> гарантированно
  // перебивает его при ЛЮБОМ способе печати — и кнопкой, и Cmd+P.
  useEffect(() => {
    if (!kimStyle) return undefined;
    const style = document.createElement('style');
    style.setAttribute('data-kim-page', 'oge');
    style.textContent = '@page { size: A5 portrait; margin: 0; }';
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [kimStyle]);

  // Загружаем сюжеты практического блока 1–5
  useEffect(() => {
    let cancelled = false;
    setContextLoading(true);
    api.getOgeContextBlocks()
      .then(blocks => { if (!cancelled) setContextBlocks(blocks); })
      .catch(() => { if (!cancelled) setContextBlocks([]); })
      .finally(() => { if (!cancelled) setContextLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
    orderedTopics.forEach(topic => {
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
  }, [orderedTopics, tasksSnapshot]);

  // Подсчёт зафиксированных слотов
  const pinnedCount = useMemo(() => slots.filter(s => s.pinnedTask).length, [slots]);

  const topicForSlot = (slot) => orderedTopics.find(t => t.id === slot.topicId);

  // Слот относится к практическому блоку 1–5, который собирается из сюжета
  const isBlockSlot = (index) => {
    if (!coherentBlock) return false;
    const topic = topicForSlot(slots[index]);
    return (topic?.ege_number ?? index + 1) <= BLOCK_LAST;
  };

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
    const num = orderedTopics[pinModalSlotIndex]?.ege_number;
    setPinModalSlotIndex(null);
    message.success(`Задача ${task.code} зафиксирована в слоте №${num}`);
  };

  const unpinSlot = (index) => updateSlot(index, 'pinnedTask', null);

  // Подменяем задания 1–5 на связный блок из одного сюжета (мутирует копии).
  // Если учитель выбрал конкретный сюжет — все варианты используют его;
  // иначе сюжеты раздаются случайно (в режиме «разные» — по одному на вариант).
  const applyCoherentBlock = (vars) => {
    if (contextBlocks.length === 0) {
      message.warning('Нет полных сюжетов 1–5 — практический блок собран из независимых задач');
      return;
    }
    const fixed = selectedContextId !== 'random'
      ? contextBlocks.find(b => b.id === selectedContextId)
      : null;
    if (selectedContextId !== 'random' && !fixed) {
      message.warning('Выбранный сюжет недоступен — берётся случайный');
    }
    if (!fixed && variantsMode === 'different' && variantsCount > contextBlocks.length) {
      message.warning(
        `Полных сюжетов 1–5 всего ${contextBlocks.length}, а вариантов ${variantsCount} — сюжеты будут повторяться`
      );
    }
    const order = fixed ? null : shuffleArray(contextBlocks);
    vars.forEach((variant, vi) => {
      const ctx = fixed || order[vi % order.length];
      const block = [];
      for (let num = 1; num <= BLOCK_LAST; num++) {
        const pool = ctx.byNum[num] || [];
        if (pool.length === 0) {
          // нет задачи этого номера в сюжете — оставляем подобранную ранее
          block.push(variant.tasks[num - 1]);
          continue;
        }
        // фиксированный сюжет: чередуем задачи по номеру варианта (вариативность,
        // если на номер несколько задач); случайный сюжет — случайная задача
        const idx = fixed ? (vi % pool.length) : Math.floor(Math.random() * pool.length);
        block.push(pool[idx]);
      }
      variant.tasks = [...block, ...variant.tasks.slice(BLOCK_LAST)];
    });
  };

  // Применяем зафиксированные задачи (блок 1–5 при coherent не трогаем)
  const applyPins = (vars) => {
    const hasPinned = slots.some(s => s.pinnedTask);
    if (!hasPinned) return;
    vars.forEach(variant => {
      variant.tasks = variant.tasks.map((task, idx) => {
        if (coherentBlock && idx < BLOCK_LAST) return task;
        return slots[idx]?.pinnedTask ?? task;
      });
    });
  };

  const handleGenerate = async () => {
    if (slots.length === 0) {
      message.warning('Темы ОГЭ ещё загружаются...');
      return;
    }
    const structure = slots.map(slot => ({
      topic: slot.topicId,
      subtopics: slot.subtopics,
      difficulty: slot.difficulty,
      tags: slot.tags,
      count: 1,
    }));
    const generated = await generateFromStructure(structure, {
      variantsMode,
      variantsCount,
      sortType: 'structured',
      progressiveDifficulty: false,
    });
    if (!generated || generated.length === 0) return;

    // Свежие копии, чтобы не мутировать объекты в state
    const finalVariants = generated.map(v => ({ ...v, tasks: [...v.tasks] }));
    if (coherentBlock) applyCoherentBlock(finalVariants);
    applyPins(finalVariants);
    setVariants(finalVariants);
  };

  const handleReset = () => { reset(); setCurrentWork(null); };

  // Размер чертежа в КИМ-печати per-задача (S/M/L/XL) → task.kimImageSize.
  const handleSetImageSize = (vIdx, tIdx, size) => {
    setVariants(prev => prev.map((variant, vi) => (
      vi !== vIdx ? variant : {
        ...variant,
        tasks: variant.tasks.map((task, ti) => (
          ti !== tIdx ? task : { ...task, kimImageSize: size }
        )),
      }
    )));
  };

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
        const num = topic?.ege_number ?? index + 1;
        const isPart2 = num > PART1_LAST;
        const isBlock = coherentBlock && num <= BLOCK_LAST;
        return (
          <Tag color={isBlock ? 'volcano' : isPart2 ? 'purple' : 'blue'} style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
            {num}
          </Tag>
        );
      },
    },
    {
      title: 'Тема',
      dataIndex: 'topic',
      width: 280,
      render: (_, __, index) => {
        const topic = topicForSlot(slots[index]);
        if (!topic) return null;
        const shortTitle = topic.title.replace(/^ОГЭ\.?\s*№\d+\s*/, '');
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
        if (isBlockSlot(index)) {
          return <Text type="secondary" style={{ fontSize: 11 }}>из сюжета</Text>;
        }
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
        if (isBlockSlot(index)) {
          return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        }
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
        if (isBlockSlot(index)) {
          return (
            <Tooltip title="Задания 1–5 собираются единым сюжетом — фиксация по одному недоступна">
              <Tag icon={<BlockOutlined />} color="volcano">сюжет</Tag>
            </Tooltip>
          );
        }
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
        message="Генератор вариантов ОГЭ (9 класс)"
        description={
          <div>
            <div>📋 Полный вариант ОГЭ — 25 заданий: №1–19 краткий ответ, №20–25 развёрнутый</div>
            <div>🧩 Практический блок №1–5 собирается из одного сюжета (общий план/ситуация)</div>
            <div>📌 Фиксация конкретных задач по любому номеру части 1 (6–19) и части 2</div>
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
        title="Структура варианта ОГЭ"
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
        {orderedTopics.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin /> <Text type="secondary" style={{ marginLeft: 8 }}>Загрузка тем ОГЭ…</Text>
          </div>
        ) : (
          <>
            <Alert
              message="Для каждого номера задания ОГЭ можно ограничить подтему, сложность или зафиксировать конкретную задачу. Оставьте поля пустыми — задача выберется случайно. Задания 1–5 (практический блок) собираются единым сюжетом."
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
                  <Tooltip title={
                    contextLoading
                      ? 'Загрузка сюжетов…'
                      : `Задания 1–5 берутся из одного сюжета (общий план/ситуация). Доступно полных сюжетов: ${contextBlocks.length}`
                  }>
                    <Text strong>Связный блок 1–5:</Text>
                  </Tooltip>
                  <Switch
                    checked={coherentBlock}
                    onChange={setCoherentBlock}
                    size="small"
                    loading={contextLoading}
                    checkedChildren={<BlockOutlined />}
                  />
                </Space>
              </Col>
              {coherentBlock && contextBlocks.length > 0 && (
                <Col>
                  <Space size={6}>
                    <Text strong>Сюжет 1–5:</Text>
                    <Select
                      value={selectedContextId}
                      onChange={setSelectedContextId}
                      size="small"
                      showSearch
                      optionFilterProp="label"
                      style={{ width: 260 }}
                      popupMatchSelectWidth={360}
                      options={[
                        { value: 'random', label: '🎲 Случайный сюжет' },
                        ...contextBlocks.map(b => ({
                          value: b.id,
                          label: b.title || 'Сюжет без названия',
                        })),
                      ]}
                    />
                  </Space>
                </Col>
              )}
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
                  <Tooltip title="Печать в официальном формате: обложка, часть 1 с полями ответа, часть 2 с инструкцией про отдельный лист">
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

            {coherentBlock && !contextLoading && contextBlocks.length === 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 10 }}
                message="Полных сюжетов 1–5 не найдено — задания 1–5 будут подобраны независимо."
              />
            )}

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
                {(kimVariantNumber || kimClass !== '9' || kimDate) && (
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
              onExportPDF={kimStyle ? null : () => handleExportPDF(printRef, 'Вариант ОГЭ')}
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
            baseTitle="Вариант ОГЭ"
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
                        onSetImageSize={handleSetImageSize}
                      />
                    </div>
                    <KimOgeVariantPrint variant={variant} kimMeta={kimMeta} />
                  </>
                )}

                {vi < variants.length - 1 && <div className="page-break" />}
              </div>
            ))}

            {/* Лист ответов и решений — только для обычного стиля */}
            {!kimStyle && <OgeAnswersPage variants={variants} />}
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
        defaultTitle="Вариант ОГЭ"
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
        topics={orderedTopics}
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

export default OgeVariantGenerator;
