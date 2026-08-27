import { useState, useMemo } from 'react';
import {
  Form, Input, InputNumber, Button, Segmented, Collapse, Alert, Spin, Tag,
  Select, Switch, Row, Col, Space, Typography, App, Tooltip,
} from 'antd';
import {
  PlusOutlined, PrinterOutlined, ThunderboltOutlined, SettingOutlined,
  UnorderedListOutlined, ProfileOutlined, FontSizeOutlined, FolderOpenOutlined,
  SaveOutlined, DeleteOutlined, BookOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { v4 as uuid } from 'uuid';
import { PageHeader } from '../ui';
import FilterBlock from './worksheet/FilterBlock';
import SaveWorkModal from './worksheet/SaveWorkModal';
import LoadWorkModal from './worksheet/LoadWorkModal';
import TaskReplaceModal from './TaskReplaceModal';
import TaskEditModal from './TaskEditModal';
import EntranceTestPrint from './entrance-test/EntranceTestPrint';
import EntranceTaskListEditor from './entrance-test/EntranceTaskListEditor';
import {
  ENTRANCE_PRESETS, DEFAULT_PRESET_ID, getPreset,
  SOLUTION_SPACE_OPTIONS, SOLUTION_FILL_OPTIONS,
} from './entrance-test/presets';
import {
  useWorksheetGeneration,
  useWorksheetActions,
  useTaskEditing,
} from '../hooks';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useAuth } from '../contexts/AuthContext';

const { Text } = Typography;

const LAYOUT_OPTIONS = [
  {
    value: 'sheet',
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
        <FileTextOutlined /> Набор задач
      </span>
    ),
  },
  {
    value: 'workbook',
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
        <BookOutlined /> Рабочая тетрадь
      </span>
    ),
  },
];

const emptyBlock = () => ({
  id: uuid(),
  topic: null,
  subtopics: [],
  difficulty: [],
  tags: [],
  source: null,
  year: null,
  count: 1,
});

const todayLabel = () =>
  new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * Генератор входной контрольной работы.
 *
 * Отличие от «Контрольных работ» — оформление печатного листа: шапка с
 * названием/классом/временем, инструкция и произвольная доп. информация,
 * два макета (набор задач / рабочая тетрадь с местом для решения).
 */
const EntranceTestGenerator = () => {
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const {
    topics, subtopics, tags, sources, years,
    egeBaseTopics, egeProfileTopics, ogeTopics,
  } = useReferenceData();

  const [form] = Form.useForm();

  const { variants, setVariants, loading, generateFromStructure, reset } = useWorksheetGeneration();
  const {
    saving, handleSaveWork, handleUpdateWork,
    handleLoadWorks, handleLoadWork, handleDeleteWork,
  } = useWorksheetActions();
  const taskEditing = useTaskEditing(variants, setVariants);

  // ── Шаблон и структура ────────────────────────────────────────────────────
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [workBlocks, setWorkBlocks] = useState([]);

  // ── Шапка листа ───────────────────────────────────────────────────────────
  const [meta, setMeta] = useState(() => ({
    ...getPreset(DEFAULT_PRESET_ID).meta,
    dateLabel: todayLabel(),
    footerNote: '',
    showStudentFields: true,
    alwaysShowVariant: true,
  }));

  // ── Варианты ──────────────────────────────────────────────────────────────
  const [variantsCount, setVariantsCount] = useState(2);
  const [variantsMode, setVariantsMode] = useState('different');
  const [sortType, setSortType] = useState('blocks');
  const [variantLabel, setVariantLabel] = useState('Вариант');

  // ── Оформление ────────────────────────────────────────────────────────────
  const [layout, setLayout] = useState('sheet');
  const [fontFamily, setFontFamily] = useState('sans');
  const [fontScale, setFontScale] = useState(1);
  const [answerLine, setAnswerLine] = useState(true);
  const [solutionSpace, setSolutionSpace] = useState('m');
  const [solutionFill, setSolutionFill] = useState('grid');
  const [showTaskCode, setShowTaskCode] = useState(false);
  const [hideTaskPrefixes, setHideTaskPrefixes] = useState(false);
  const [showAnswersPage, setShowAnswersPage] = useState(true);
  const [showFooter, setShowFooter] = useState(true);

  // ── Сохранение / загрузка ─────────────────────────────────────────────────
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [savedWorks, setSavedWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [currentWork, setCurrentWork] = useState(null);

  const preset = getPreset(presetId);

  const examTopics = useMemo(() => {
    switch (preset.examType) {
      case 'oge':         return ogeTopics;
      case 'ege_base':    return egeBaseTopics;
      case 'ege_profile': return egeProfileTopics;
      default:            return [];
    }
  }, [preset.examType, ogeTopics, egeBaseTopics, egeProfileTopics]);

  const totalTasks = workBlocks.reduce((sum, b) => sum + (b.count || 0), 0);

  const applyPreset = (id) => {
    setPresetId(id);
    const p = getPreset(id);
    setMeta(prev => ({ ...prev, ...p.meta, dateLabel: prev.dateLabel }));
  };

  const fillFromExam = () => {
    if (!examTopics.length) {
      message.warning('Для этого шаблона не найдено тем экзамена — добавьте блоки вручную');
      return;
    }
    const blocks = examTopics.slice(0, preset.tasksCount).map(t => ({
      ...emptyBlock(),
      topic: t.id,
    }));
    setWorkBlocks(blocks);
    message.success(`Добавлено блоков: ${blocks.length}`);
  };

  const addBlock = () => setWorkBlocks(prev => [...prev, emptyBlock()]);

  const updateBlock = (index, field, value) => {
    setWorkBlocks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'topic') next[index].subtopics = [];
      return next;
    });
  };

  const removeBlock = (index) => setWorkBlocks(prev => prev.filter((_, i) => i !== index));

  const setMetaField = (field) => (value) =>
    setMeta(prev => ({ ...prev, [field]: value?.target ? value.target.value : value }));

  const topicTitle = (topicId) => {
    const t = topics.find(x => x.id === topicId);
    if (!t) return 'Не выбрана';
    return t.ege_number ? `№${t.ege_number} — ${t.title}` : t.title;
  };

  // ── Генерация ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!workBlocks.length) {
      message.warning('Добавьте хотя бы один блок задач');
      return;
    }
    for (let i = 0; i < workBlocks.length; i++) {
      if (!workBlocks[i].topic) {
        message.error(`Блок ${i + 1}: выберите тему`);
        return;
      }
      if (!workBlocks[i].count || workBlocks[i].count < 1) {
        message.error(`Блок ${i + 1}: укажите количество задач`);
        return;
      }
    }
    await generateFromStructure(workBlocks, { variantsMode, variantsCount, sortType });
  };

  const moveTask = (variantIndex, from, to) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex) return v;
      const tasks = [...v.tasks];
      if (to < 0 || to >= tasks.length) return v;
      const [moved] = tasks.splice(from, 1);
      tasks.splice(to, 0, moved);
      return { ...v, tasks };
    }));
  };

  const setImageSize = (variantIndex, taskIndex, size) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex) return v;
      const tasks = v.tasks.map((t, j) => (j === taskIndex ? { ...t, kimImageSize: size } : t));
      return { ...v, tasks };
    }));
  };

  const handleReset = () => {
    reset();
    setWorkBlocks([]);
    setCurrentWork(null);
  };

  // ── Печать ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (typeof document === 'undefined') return;
    const id = 'entrance-test-page-style';
    document.getElementById(id)?.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1500);
  };

  // ── Работы ────────────────────────────────────────────────────────────────
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
      setSavedWorks(await handleLoadWorks());
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
      setMeta(prev => ({ ...prev, title: work.title || prev.title }));
      setLoadModalVisible(false);
      message.success(`Работа «${work.title}» загружена`);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleDelete = async (workId) => {
    await handleDeleteWork(workId);
    setSavedWorks(prev => prev.filter(w => w.id !== workId));
  };

  // Число заданий в шапке синхронизируем с фактическим набором
  const printMeta = useMemo(() => ({ ...meta }), [meta]);

  const printOptions = useMemo(() => ({
    answerLine,
    solutionSpace,
    solutionFill,
    hideTaskPrefixes,
    showTaskCode,
    fontScale,
    fontFamily,
    showFooter,
  }), [answerLine, solutionSpace, solutionFill, hideTaskPrefixes, showTaskCode, fontScale, fontFamily, showFooter]);

  const hasVariants = variants.length > 0;

  return (
    <div className="entrance-test-page">
      <div className="no-print">
        <PageHeader
          title="Входная контрольная работа"
          lede="Диагностика в начале года: оформленный лист с шапкой, инструкцией и местом для решения"
          actions={
            <Button icon={<FolderOpenOutlined />} onClick={handleOpenLoadModal}>
              Мои работы
            </Button>
          }
        />

        <div style={{ marginBottom: 16 }}>
          <Segmented size="large" value={layout} onChange={setLayout} options={LAYOUT_OPTIONS} />
        </div>

        <Form form={form} layout="vertical" onFinish={handleGenerate}>
          <Collapse
            defaultActiveKey={['preset', 'structure']}
            items={[
              {
                key: 'preset',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ProfileOutlined />
                    <span>Шаблон работы</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 400 }}>
                      {preset.label}
                    </span>
                  </span>
                ),
                children: (
                  <>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                      {ENTRANCE_PRESETS.map(p => {
                        const active = p.id === presetId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applyPreset(p.id)}
                            style={{
                              flex: '1 1 180px',
                              textAlign: 'left',
                              padding: '10px 14px',
                              borderRadius: 'var(--radius-lg)',
                              border: `1px solid ${active ? 'var(--accent)' : 'var(--rule)'}`,
                              background: active ? 'var(--accent-soft)' : 'var(--bg-raised)',
                              cursor: 'pointer',
                              transition: 'border-color .15s, background .15s',
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{p.label}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{p.hint}</div>
                          </button>
                        );
                      })}
                    </div>

                    <Space wrap>
                      <Button
                        icon={<ThunderboltOutlined />}
                        onClick={fillFromExam}
                        disabled={!examTopics.length}
                      >
                        Заполнить темами экзамена ({Math.min(preset.tasksCount, examTopics.length)})
                      </Button>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Создаст по блоку на каждое задание экзамена — темы и количество можно поправить ниже
                      </Text>
                    </Space>
                  </>
                ),
              },
              {
                key: 'header',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileTextOutlined />
                    <span>Шапка и инструкция</span>
                  </span>
                ),
                children: (
                  <>
                    <Row gutter={12}>
                      <Col xs={24} md={8}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Надзаголовок</Text>
                          <Input value={meta.eyebrow} onChange={setMetaField('eyebrow')} placeholder="Входная контрольная работа" />
                        </div>
                      </Col>
                      <Col xs={24} md={8}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Название</Text>
                          <Input value={meta.title} onChange={setMetaField('title')} placeholder="Математика" />
                        </div>
                      </Col>
                      <Col xs={24} md={8}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Подзаголовок</Text>
                          <Input value={meta.subtitle} onChange={setMetaField('subtitle')} placeholder="Диагностика на входе в 10 класс" />
                        </div>
                      </Col>
                      <Col xs={12} md={6}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Класс</Text>
                          <Input value={meta.classLabel} onChange={setMetaField('classLabel')} placeholder="10 класс" />
                        </div>
                      </Col>
                      <Col xs={12} md={6}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Дата</Text>
                          <Input value={meta.dateLabel} onChange={setMetaField('dateLabel')} placeholder="1 сентября 2026" />
                        </div>
                      </Col>
                      <Col xs={12} md={6}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Время, мин</Text>
                          <InputNumber
                            min={5}
                            max={300}
                            value={meta.duration}
                            onChange={setMetaField('duration')}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </Col>
                      <Col xs={12} md={6}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Подпись варианта</Text>
                          <Input value={variantLabel} onChange={e => setVariantLabel(e.target.value)} placeholder="Вариант" />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Подпись в подвале листа
                            {!showFooter && ' — подвал выключен в «Оформлении»'}
                          </Text>
                          <Input
                            value={meta.footerNote}
                            onChange={setMetaField('footerNote')}
                            disabled={!showFooter}
                            placeholder="МБОУ «Школа №…» · кабинет математики"
                          />
                        </div>
                      </Col>
                    </Row>

                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Инструкция по выполнению</Text>
                      <Input.TextArea
                        value={meta.instruction}
                        onChange={setMetaField('instruction')}
                        autoSize={{ minRows: 2, maxRows: 6 }}
                        placeholder="Работа состоит из 10 заданий…"
                      />
                    </div>

                    <Row gutter={12}>
                      <Col xs={24} md={8}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Заголовок доп. блока</Text>
                          <Input value={meta.notesTitle} onChange={setMetaField('notesTitle')} placeholder="Дополнительная информация" />
                        </div>
                      </Col>
                      <Col xs={24} md={16}>
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Дополнительная информация</Text>
                          <Input.TextArea
                            value={meta.notes}
                            onChange={setMetaField('notes')}
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            placeholder="Критерии оценивания, напоминания, контакты — всё, что нужно на листе"
                          />
                        </div>
                      </Col>
                    </Row>

                    <Space size={20} wrap>
                      <Space size={8}>
                        <Switch
                          size="small"
                          checked={meta.showStudentFields}
                          onChange={v => setMeta(prev => ({ ...prev, showStudentFields: v }))}
                        />
                        <Text style={{ fontSize: 13 }}>Поля «Фамилия, имя · Класс · Дата»</Text>
                      </Space>
                      <Space size={8}>
                        <Switch
                          size="small"
                          checked={meta.alwaysShowVariant}
                          onChange={v => setMeta(prev => ({ ...prev, alwaysShowVariant: v }))}
                        />
                        <Text style={{ fontSize: 13 }}>Плашка с номером варианта</Text>
                      </Space>
                    </Space>
                  </>
                ),
              },
              {
                key: 'structure',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UnorderedListOutlined />
                    <span>Структура работы</span>
                    {workBlocks.length > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 400 }}>
                        {workBlocks.length} бл. · {totalTasks} задач
                      </span>
                    )}
                  </span>
                ),
                children: (
                  <>
                    {workBlocks.length === 0 && (
                      <Alert
                        type="info"
                        style={{ marginBottom: 16 }}
                        message="Соберите работу из блоков"
                        description="Кнопка «Заполнить темами экзамена» в шаблоне создаст блоки автоматически, либо добавьте их вручную."
                      />
                    )}

                    {workBlocks.map((block, index) => (
                      <FilterBlock
                        key={block.id}
                        block={block}
                        index={index}
                        topics={topics}
                        subtopics={subtopics}
                        tags={tags}
                        sources={sources}
                        years={years}
                        onChange={updateBlock}
                        onRemove={removeBlock}
                      />
                    ))}

                    <Button type="dashed" block icon={<PlusOutlined />} onClick={addBlock} style={{ marginBottom: 12 }}>
                      Добавить блок задач
                    </Button>

                    {workBlocks.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {workBlocks.map(b => (
                          <Tag key={b.id} color="blue" style={{ fontSize: 12 }}>
                            {topicTitle(b.topic)} · {b.count}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </>
                ),
              },
              {
                key: 'variants',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SettingOutlined />
                    <span>Варианты</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 400 }}>
                      {variantsCount} × {totalTasks}
                    </span>
                  </span>
                ),
                children: (
                  <Row gutter={12}>
                    <Col xs={12} md={6}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Количество</Text>
                      <InputNumber min={1} max={30} value={variantsCount} onChange={v => setVariantsCount(v || 1)} style={{ width: '100%' }} />
                    </Col>
                    <Col xs={12} md={9}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Режим</Text>
                      <Select
                        value={variantsMode}
                        onChange={setVariantsMode}
                        style={{ width: '100%' }}
                        options={[
                          { value: 'different', label: 'Разные задачи' },
                          { value: 'shuffled', label: 'Одинаковые, разный порядок' },
                          { value: 'same', label: 'Одинаковые задачи' },
                        ]}
                      />
                    </Col>
                    <Col xs={24} md={9}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Порядок задач</Text>
                      <Select
                        value={sortType}
                        onChange={setSortType}
                        style={{ width: '100%' }}
                        options={[
                          { value: 'blocks', label: 'По порядку блоков (как в КИМ)' },
                          { value: 'difficulty', label: 'По нарастанию сложности' },
                          { value: 'code', label: 'По коду задачи' },
                          { value: 'random', label: 'Случайный' },
                        ]}
                      />
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'design',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FontSizeOutlined />
                    <span>Оформление листа</span>
                  </span>
                ),
                children: (
                  <>
                    <Alert
                      type="info"
                      showIcon={false}
                      style={{ marginBottom: 12, fontSize: 12 }}
                      message="Лист монохромный — рассчитан на ч/б печать. Иерархию держат кегль и толщина линеек, цветных заливок нет."
                    />

                    <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                      <Col xs={12} md={8}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Шрифт условий</Text>
                        <Segmented
                          block
                          value={fontFamily}
                          onChange={setFontFamily}
                          options={[
                            { label: 'Гротеск', value: 'sans' },
                            { label: 'Антиква', value: 'serif' },
                          ]}
                        />
                      </Col>
                      <Col xs={12} md={8}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Кегль условий</Text>
                        <Segmented
                          block
                          value={fontScale}
                          onChange={setFontScale}
                          options={[
                            { label: '10 pt', value: 0.9 },
                            { label: '11 pt', value: 1 },
                            { label: '12 pt', value: 1.12 },
                          ]}
                        />
                      </Col>
                    </Row>

                    {layout === 'workbook' && (
                      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                        <Col xs={12} md={8}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Место для решения</Text>
                          <Segmented block value={solutionSpace} onChange={setSolutionSpace} options={SOLUTION_SPACE_OPTIONS} />
                        </Col>
                        <Col xs={12} md={8}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Разлиновка</Text>
                          <Segmented block value={solutionFill} onChange={setSolutionFill} options={SOLUTION_FILL_OPTIONS} />
                        </Col>
                      </Row>
                    )}

                    <Space size={20} wrap>
                      <Space size={8}>
                        <Switch size="small" checked={answerLine} onChange={setAnswerLine} />
                        <Text style={{ fontSize: 13 }}>Строка «Ответ»</Text>
                      </Space>
                      <Space size={8}>
                        <Switch size="small" checked={showFooter} onChange={setShowFooter} />
                        <Tooltip title="Подпись слева и номер страницы справа. Без подвала задачам достаётся ещё 8 мм на листе.">
                          <Text style={{ fontSize: 13 }}>Нижний колонтитул</Text>
                        </Tooltip>
                      </Space>
                      <Space size={8}>
                        <Switch size="small" checked={showAnswersPage} onChange={setShowAnswersPage} />
                        <Text style={{ fontSize: 13 }}>Лист ответов для учителя</Text>
                      </Space>
                      <Space size={8}>
                        <Switch size="small" checked={hideTaskPrefixes} onChange={setHideTaskPrefixes} />
                        <Text style={{ fontSize: 13 }}>Убирать типовые вступления</Text>
                      </Space>
                      <Space size={8}>
                        <Switch size="small" checked={showTaskCode} onChange={setShowTaskCode} />
                        <Text style={{ fontSize: 13 }}>Код задачи</Text>
                      </Space>
                    </Space>
                  </>
                ),
              },
            ]}
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={loading}
              disabled={!workBlocks.length}
            >
              Сформировать работу
            </Button>

            {hasVariants && (
              <>
                <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                  Печать
                </Button>
                {canEdit && (
                  <Button icon={<SaveOutlined />} loading={saving} onClick={() => setSaveModalVisible(true)}>
                    Сохранить
                  </Button>
                )}
                <Tooltip title="Сбросить">
                  <Button danger icon={<DeleteOutlined />} onClick={handleReset} />
                </Tooltip>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  PDF — через «Печать» → «Сохранить как PDF»
                </Text>
              </>
            )}
          </div>
        </Form>

        {hasVariants && (
          <EntranceTaskListEditor
            variants={variants}
            variantLabel={variantLabel}
            onEditTask={taskEditing.handleEditTask}
            onReplaceTask={taskEditing.handleReplaceTask}
            onMove={moveTask}
            onSetImageSize={setImageSize}
          />
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin size="large" tip="Подбираем задачи…" />
        </div>
      )}

      {hasVariants && (
        <div style={{ marginTop: 20 }}>
          <EntranceTestPrint
            variants={variants}
            meta={printMeta}
            layout={layout}
            options={printOptions}
            variantLabel={variantLabel}
            showAnswersPage={showAnswersPage}
          />
        </div>
      )}

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

      <SaveWorkModal
        visible={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onSave={handleSave}
        saving={saving}
        variantsCount={variants.length}
        tasksCount={variants.reduce((sum, v) => sum + v.tasks.length, 0)}
        initialTitle={currentWork?.title || meta.title || 'Входная контрольная работа'}
        initialTimeLimit={currentWork?.time_limit ?? meta.duration ?? null}
        isEdit={!!currentWork?.id}
      />

      <LoadWorkModal
        visible={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        works={savedWorks}
        loading={loadingWorks}
        onLoad={handleLoad}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default EntranceTestGenerator;
