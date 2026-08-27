import { useState, useMemo } from 'react';
import { Card, Upload, Button, Steps, Select, Space, Alert, Progress, Statistic, Collapse, Checkbox, Tag, Tabs, Input, Descriptions, Row, Col, Empty, Badge, Typography, Spin, Modal, InputNumber, App } from 'antd';
import {
  InboxOutlined, CheckCircleOutlined,
  WarningOutlined, CloseCircleOutlined, ReloadOutlined,
  FileTextOutlined, GlobalOutlined, DownloadOutlined, PlusOutlined,
} from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import ImportStep from './task-importer/ImportStep';
import { useTaskImport } from '../hooks/useTaskImport';
import { api, aiHeaders } from '../services/pocketbase';
import { useAuth } from '../contexts/AuthContext';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { SDAMGIA_SOURCE_LABELS } from '../utils/markdownTaskParser';

const { Dragger } = Upload;
const { TextArea } = Input;
const { Text } = Typography;

const PDF_SERVICE_URL = (() => {
  const envUrl = import.meta.env.VITE_PDF_SERVICE_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
})();

const DIFFICULTY_COLORS = {
  '1': '#52c41a',
  '2': '#faad14',
  '3': '#ff4d4f',
  '4': '#a8071a',
  '5': '#722ed1',
};

const DIFFICULTY_LABELS = {
  '1': 'Базовый',
  '2': 'Средний',
  '3': 'Повышенный',
  '4': 'Высокий',
  '5': 'Олимпиадный',
};

const FORMAT_TAG = {
  ege: { color: 'blue', label: 'ЕГЭ' },
  mordkovich: { color: 'purple', label: 'Мордкович' },
  sdamgia: { color: 'green', label: 'РЕШУ' },
};

const SDAMGIA_SOURCE_OPTIONS = Object.entries(SDAMGIA_SOURCE_LABELS).map(([value, label]) => ({ value, label }));

// Маппинг типа источника sdamgia → exam_type коллекции topics.
// У базового и профильного ЕГЭ независимые нумерации заданий — поэтому
// темы из разных экзаменов могут иметь одинаковый ege_number.
const SDAMGIA_TO_EXAM_TYPE = {
  ege_base: 'ege_base',
  ege_prof: 'ege_profile',
  oge:      'oge',
  vpr5:     'vpr',
  vpr6:     'vpr',
  vpr7:     'vpr',
  vpr8:     'vpr',
};

const EXAM_TYPE_OPTIONS = [
  { value: 'ege_base',    label: 'ЕГЭ базовый' },
  { value: 'ege_profile', label: 'ЕГЭ профильный' },
  { value: 'oge',         label: 'ОГЭ (9 кл.)' },
  { value: 'mordkovich',  label: 'Мордкович' },
  { value: 'oral',        label: 'Устный счёт' },
  { value: 'vpr',         label: 'ВПР' },
  { value: 'trig',        label: 'Тригонометрия' },
  { value: 'other',       label: 'Прочее' },
];

export default function TaskImporter() {
  const { message } = App.useApp();
  const { aiEnabled } = useAuth(); // ИИ-тумблер: гейт LLM-контролов импорта
  const { topics: ctxTopics, tags, subtopics: ctxSubtopics, reloadData } = useReferenceData();
  const [currentStep, setCurrentStep] = useState(0);
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'text' | 'sdamgia'
  const [textInput, setTextInput] = useState('');
  const [fileName, setFileName] = useState('');

  // Темы/подтемы, созданные прямо здесь: контекст узнает о них только после
  // reloadData(), поэтому держим их отдельно и подмешиваем к спискам контекста.
  // 🚨 Копию контекста в useState класть НЕЛЬЗЯ: синхронизация «по разной длине»
  // затирала только что созданную тему (список снова становился контекстным),
  // после чего импорт падал с «У темы не указан номер ЕГЭ» — темы просто не
  // было в списке, по которому ищут ege_number.
  const [extraTopics, setExtraTopics] = useState([]);
  const [extraSubtopics, setExtraSubtopics] = useState([]);

  const localTopics = useMemo(() => {
    if (extraTopics.length === 0) return ctxTopics;
    const known = new Set(ctxTopics.map(t => t.id));
    return [...ctxTopics, ...extraTopics.filter(t => !known.has(t.id))];
  }, [ctxTopics, extraTopics]);

  const localSubtopics = useMemo(() => {
    if (extraSubtopics.length === 0) return ctxSubtopics;
    const known = new Set(ctxSubtopics.map(st => st.id));
    return [...ctxSubtopics, ...extraSubtopics.filter(st => !known.has(st.id))];
  }, [ctxSubtopics, extraSubtopics]);

  // Состояние создания темы
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicNumber, setNewTopicNumber] = useState(null);
  // Тип экзамена для создаваемой темы: ege_base/ege_profile/oge/vpr/other.
  // У ege_base и ege_profile независимая нумерация — поэтому дубли проверяем
  // по паре (exam_type, ege_number), а не только по ege_number.
  const [newTopicExamType, setNewTopicExamType] = useState('ege_base');
  // Для ege_profile — часть экзамена (1 = краткий ответ, 2 = развёрнутое решение).
  const [newTopicExamPart, setNewTopicExamPart] = useState(1);
  const [creatingTopic, setCreatingTopic] = useState(false);

  // Состояние создания подтемы
  const [showNewSubtopic, setShowNewSubtopic] = useState(false);
  const [newSubtopicName, setNewSubtopicName] = useState('');
  const [creatingSubtopic, setCreatingSubtopic] = useState(false);
  // Для какой темы создаём подтему (sdamgia-форма или шаг 2)
  const [newSubtopicContext, setNewSubtopicContext] = useState(null); // 'sdamgia' | 'preview'

  // Состояние для sdamgia
  const [sdamgiaSourceType, setSdamgiaSourceType] = useState('ege_base');
  const [sdamgiaUrl, setSdamgiaUrl] = useState('');
  const [sdamgiaTopicId, setSdamgiaTopicId] = useState(null);
  const [sdamgiaSubtopic, setSdamgiaSubtopic] = useState('');
  const [sdamgiaDifficulty, setSdamgiaDifficulty] = useState('1');
  const [sdamgiaTags, setSdamgiaTags] = useState('');
  const [sdamgiaLoading, setSdamgiaLoading] = useState(false);
  const [sdamgiaError, setSdamgiaError] = useState('');
  // Часть ЕГЭ — 1 (default) или 2; селектор балла появляется только для части 2
  const [sdamgiaExamPart, setSdamgiaExamPart] = useState(1);

  const {
    parsedData,
    selectedTasks,
    llmTasks,
    topicId,
    subtopicId,
    importing,
    importProgress,
    importResults,
    setTopicId,
    setSubtopicId,
    handleParse,
    handleParseSdamgia,
    toggleTask,
    selectAll,
    deselectAll,
    toggleLlmTask,
    selectAllLlm,
    selectAllLlmNeedsReview,
    deselectAllLlm,
    handleImport,
    applyLatexFix,
    reset,
  } = useTaskImport({ topics: localTopics, tags, subtopics: localSubtopics });

  // LLM-fix состояние: per-index loading flag
  const [llmFixLoading, setLlmFixLoading] = useState({});

  // Вызвать LLM-fix для задачи по индексу: исправляет statement/solution/criteria
  // через /latex-fix endpoint на pdf-service. Дёргается только по клику учителя
  // для задач с latex_needs_review=true.
  const handleLlmFix = async (taskIndex) => {
    const task = parsedData?.tasks?.[taskIndex];
    if (!task) return;
    setLlmFixLoading(prev => ({ ...prev, [taskIndex]: true }));
    try {
      const fields = ['statement_md', 'solution_md', 'criteria_md'];
      const updates = {};
      for (const field of fields) {
        if (!task[field]) continue;
        const resp = await fetch(`${PDF_SERVICE_URL}/latex-fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...aiHeaders() },
          body: JSON.stringify({ text: task[field], role: field.replace('_md', '') }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(`${field}: ${err.error || resp.status}`);
        }
        const data = await resp.json();
        if (data.text) updates[field] = data.text;
      }
      applyLatexFix(taskIndex, updates);
      message.success(`Задача #${task.number}: LaTeX исправлен`);
    } catch (e) {
      message.error(`Ошибка LLM-fix: ${e.message}`);
    } finally {
      setLlmFixLoading(prev => ({ ...prev, [taskIndex]: false }));
    }
  };

  // Подтемы для выбранной темы (шаг 2 — предпросмотр)
  const filteredSubtopics = useMemo(() => {
    if (!topicId) return [];
    return localSubtopics.filter(st => st.topic === topicId);
  }, [topicId, localSubtopics]);

  // Подтемы для sdamgia-формы (шаг 1)
  const sdamgiaFilteredSubtopics = useMemo(() => {
    if (!sdamgiaTopicId) return [];
    return localSubtopics.filter(st => st.topic === sdamgiaTopicId);
  }, [sdamgiaTopicId, localSubtopics]);

  // Нормализация названия для проверки дубликатов
  const normalize = (s) => (s || '').trim().toLowerCase();

  // Угадываем тип экзамена для новой темы по метаданным файла: в YAML пишут
  // «Профиль», «База», «ОГЭ» — поля exam_type там нет.
  const guessExamTypeFromMeta = (meta) => {
    const hay = [meta?.topic, meta?.subtopic, meta?.source, ...(meta?.tags || [])]
      .filter(Boolean).join(' ').toLowerCase();
    if (/огэ/.test(hay)) return 'oge';
    if (/впр/.test(hay)) return 'vpr';
    if (/профил/.test(hay)) return 'ege_profile';
    if (/базов|егэ-база|\bбаза\b/.test(hay)) return 'ege_base';
    if (/тригонометр/.test(hay)) return 'trig';
    return 'other';
  };

  // Открыть модалку создания темы. Из шага 2 подставляем название, тип экзамена
  // и номер (если он есть в заголовке) из YAML — иначе тему, которую Лемма уже
  // прочитала из файла, приходится перепечатывать руками.
  const openNewTopicModal = (context) => {
    if (context === 'preview' && parsedData?.metadata) {
      const meta = parsedData.metadata;
      const numMatch = (meta.topic || '').match(/№\s*(\d+)/);
      setNewTopicTitle(meta.topic || '');
      // Есть «№N» в заголовке — это тема каталога ЕГЭ/ОГЭ; нет — тема вне
      // нумерации (входной тест, зачёт): номер 0 + тип «Прочее», иначе она
      // лишней строкой полезет в генератор вариантов.
      setNewTopicNumber(numMatch ? Number(numMatch[1]) : 0);
      setNewTopicExamType(numMatch ? guessExamTypeFromMeta(meta) : 'other');
      setNewTopicExamPart(1);
    } else {
      // Preselect типа экзамена из контекста sdamgia-формы.
      setNewTopicExamType(SDAMGIA_TO_EXAM_TYPE[sdamgiaSourceType] || 'ege_base');
      setNewTopicExamPart(sdamgiaExamPart || 1);
    }
    setShowNewTopic(true);
  };

  // Создание новой темы
  const handleCreateTopic = async () => {
    const trimmedTitle = (newTopicTitle || '').trim();
    if (!trimmedTitle) {
      message.warning('Введите название темы');
      return;
    }
    if (newTopicNumber === null || newTopicNumber === undefined || newTopicNumber === '') {
      message.warning('Укажите номер ЕГЭ');
      return;
    }

    // Дубль ищем по паре (exam_type, ege_number) — у разных экзаменов
    // независимая нумерация. Темы без exam_type считаем легаси-базовыми.
    const examTypeForCheck = newTopicExamType || 'ege_base';
    // Номер 0 = тема вне нумерации ЕГЭ (входной тест, марафон, летнее ДЗ) —
    // таких тем может быть сколько угодно, дубль по номеру для них не проверяем.
    const existingByNumber = Number(newTopicNumber) === 0 ? null : localTopics.find(t =>
      String(t.ege_number) === String(newTopicNumber) &&
      (t.exam_type || 'ege_base') === examTypeForCheck
    );
    if (existingByNumber) {
      const typeLabel = EXAM_TYPE_OPTIONS.find(o => o.value === examTypeForCheck)?.label || examTypeForCheck;
      message.warning(`Тема с номером ${newTopicNumber} уже существует в "${typeLabel}": "${existingByNumber.title}"`);
      return;
    }

    const existingByTitle = localTopics.find(t => normalize(t.title) === normalize(trimmedTitle));
    if (existingByTitle) {
      message.warning(`Тема "${trimmedTitle}" уже существует`);
      return;
    }

    setCreatingTopic(true);
    try {
      const topicData = {
        title: trimmedTitle,
        ege_number: Number(newTopicNumber),
        order: Number(newTopicNumber),
        exam_type: examTypeForCheck,
      };
      // exam_part имеет смысл только для профильного ЕГЭ
      if (examTypeForCheck === 'ege_profile' && newTopicExamPart) {
        topicData.exam_part = Number(newTopicExamPart);
      }
      const newTopic = await api.createTopic(topicData);
      setExtraTopics(prev => [...prev, newTopic]);
      message.success(`Тема "${trimmedTitle}" создана`);
      setNewTopicTitle('');
      setNewTopicNumber(null);
      setShowNewTopic(false);
      // Автоматически выбираем в зависимости от контекста
      if (currentStep === 0) {
        setSdamgiaTopicId(newTopic.id);
      } else {
        handleTopicChange(newTopic.id);
      }
    } catch (error) {
      console.error('Error creating topic:', error);
      message.error('Ошибка при создании темы');
    } finally {
      setCreatingTopic(false);
    }
  };

  // Создание новой подтемы
  const handleCreateSubtopic = async (forTopicId) => {
    if (!forTopicId) {
      message.warning('Сначала выберите тему');
      return;
    }
    const trimmedName = (newSubtopicName || '').trim();
    if (!trimmedName) {
      message.warning('Введите название подтемы');
      return;
    }

    const existing = localSubtopics.find(st =>
      st.topic === forTopicId && normalize(st.name) === normalize(trimmedName)
    );
    if (existing) {
      message.warning(`Подтема "${trimmedName}" уже существует`);
      return;
    }

    setCreatingSubtopic(true);
    try {
      const newSub = await api.createSubtopic({
        name: trimmedName,
        topic: forTopicId,
      });
      setExtraSubtopics(prev => [...prev, newSub]);
      message.success(`Подтема "${trimmedName}" создана`);
      setNewSubtopicName('');
      setShowNewSubtopic(false);
      // Автоматически выбираем
      if (newSubtopicContext === 'sdamgia') {
        setSdamgiaSubtopic(newSub.name);
      } else {
        setSubtopicId(newSub.id);
      }
    } catch (error) {
      console.error('Error creating subtopic:', error);
      message.error('Ошибка при создании подтемы');
    } finally {
      setCreatingSubtopic(false);
    }
  };

  // Обработка загрузки файла
  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setFileName(file.name);
      handleParse(text);
      setCurrentStep(1);
    };
    reader.onerror = () => {
      message.error('Ошибка чтения файла');
    };
    reader.readAsText(file, 'UTF-8');
    return false;
  };

  // Обработка вставки текста
  const handleTextParse = () => {
    if (!textInput.trim()) {
      message.warning('Вставьте текст для парсинга');
      return;
    }
    setFileName('(вставленный текст)');
    handleParse(textInput);
    setCurrentStep(1);
  };

  // Загрузка задач с sdamgia.ru
  const handleSdamgiaFetch = async () => {
    if (!sdamgiaUrl.trim()) {
      message.warning('Введите URL страницы');
      return;
    }

    if (!sdamgiaUrl.includes('sdamgia.ru')) {
      setSdamgiaError('URL должен быть с сайта sdamgia.ru');
      return;
    }

    setSdamgiaLoading(true);
    setSdamgiaError('');

    try {
      const response = await fetch(`${PDF_SERVICE_URL}/parse-sdamgia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sdamgiaUrl }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.problems || data.problems.length === 0) {
        setSdamgiaError('Задачи не найдены на странице. Проверьте URL.');
        setSdamgiaLoading(false);
        return;
      }

      // Конвертируем через хук
      const sourceLabel = SDAMGIA_SOURCE_LABELS[sdamgiaSourceType] || 'РЕШУ';
      setFileName(`${sourceLabel} (${data.count} задач)`);
      // Находим тему для передачи названия в metadata
      const selectedTopic = localTopics.find(t => t.id === sdamgiaTopicId);
      const topicName = selectedTopic
        ? `${selectedTopic.ege_number ? `ЕГЭ-База №${selectedTopic.ege_number}` : selectedTopic.title}`
        : '';
      handleParseSdamgia(data.problems, {
        taskNumber: selectedTopic?.ege_number ? String(selectedTopic.ege_number) : '',
        subtopic: sdamgiaSubtopic,
        difficulty: sdamgiaDifficulty,
        tagsStr: sdamgiaTags,
        sourceType: sdamgiaSourceType,
        examPart: sdamgiaExamPart,
      });
      // Устанавливаем тему и подтему напрямую (перезаписываем автоматический маппинг)
      if (sdamgiaTopicId) {
        setTopicId(sdamgiaTopicId);
      }
      if (sdamgiaSubtopic && sdamgiaTopicId) {
        // Подтема выбрана по имени — ищем её id
        const matchedSub = localSubtopics.find(st =>
          st.topic === sdamgiaTopicId && st.name === sdamgiaSubtopic
        );
        if (matchedSub) {
          setSubtopicId(matchedSub.id);
        }
      }
      setCurrentStep(1);

    } catch (e) {
      if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        setSdamgiaError(`PDF-сервис недоступен (${PDF_SERVICE_URL}). Проверьте соединение с VPS или обратитесь к администратору сервера.`);
      } else {
        setSdamgiaError(e.message);
      }
    } finally {
      setSdamgiaLoading(false);
    }
  };

  // Запуск импорта
  const handleStartImport = async () => {
    if (!topicId) {
      message.error('Выберите тему');
      return;
    }
    if (selectedTasks.size === 0) {
      message.warning('Выберите хотя бы одну задачу');
      return;
    }
    setCurrentStep(2);
    const results = await handleImport();
    if (results) {
      reloadData();
    }
  };

  // Начать заново
  const handleReset = () => {
    reset();
    setCurrentStep(0);
    setTextInput('');
    setFileName('');
    setSdamgiaError('');
    setSdamgiaUrl('');
  };

  // Обработка смены темы — сбрасываем подтему
  const handleTopicChange = (value) => {
    setTopicId(value);
    setSubtopicId(null);
  };

  // ===== Шаг 1: Загрузка =====
  const renderUploadStep = () => (
    <div>
      <Tabs
        activeKey={inputMode}
        onChange={setInputMode}
        items={[
          {
            key: 'file',
            label: 'Загрузить файл',
            children: (
              <Dragger
                accept=".md,.txt"
                beforeUpload={handleFileUpload}
                showUploadList={false}
                style={{ padding: '20px 0' }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  Перетащите .md файл сюда или нажмите для выбора
                </p>
                <p className="ant-upload-hint">
                  Поддерживаются форматы ЕГЭ и Мордкович
                </p>
              </Dragger>
            ),
          },
          {
            key: 'text',
            label: 'Вставить текст',
            children: (
              <div>
                <TextArea
                  rows={12}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`---\ntopic: ЕГЭ-База №14 Вычисления\nsubtopic: Дроби\ndifficulty: 1\ntags: Вычисления\n---\n\n**1** [1] Найдите значение выражения $2^{10} \\cdot 3^{6} : 6^{5}$\nответ: 96\ntags: [База, Вычисления]`}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
                <Button
                  type="primary"
                  onClick={handleTextParse}
                  style={{ marginTop: 12 }}
                  icon={<FileTextOutlined />}
                >
                  Разобрать
                </Button>
              </div>
            ),
          },
          {
            key: 'sdamgia',
            label: (
              <span>
                <GlobalOutlined style={{ marginRight: 4 }} />
                Импорт с сайта
              </span>
            ),
            children: (
              <div>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="Импорт задач с сайтов РЕШУ (sdamgia.ru)"
                  description={
                    <span>
                      Выберите тип работы, откройте нужную категорию на сайте, в URL добавьте <Text code>&print=true</Text> и вставьте ссылку ниже.
                      Требуется запущенный PDF-сервис.
                    </span>
                  }
                />

                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 4, fontWeight: 500 }}>Тип работы</div>
                  <Select
                    style={{ width: '100%' }}
                    value={sdamgiaSourceType}
                    onChange={setSdamgiaSourceType}
                    options={SDAMGIA_SOURCE_OPTIONS}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 4, fontWeight: 500 }}>URL страницы</div>
                  <Input
                    size="large"
                    placeholder={
                      sdamgiaSourceType.startsWith('vpr')
                        ? `https://math${sdamgiaSourceType.replace('vpr', '')}-vpr.sdamgia.ru/test?category_id=25&filter=all&print=true`
                        : sdamgiaSourceType === 'oge'
                        ? 'https://math-oge.sdamgia.ru/test?category_id=5&filter=all_a&print=true'
                        : 'https://mathb-ege.sdamgia.ru/test?category_id=12&filter=all_a&print=true'
                    }
                    value={sdamgiaUrl}
                    onChange={(e) => setSdamgiaUrl(e.target.value)}
                    prefix={<GlobalOutlined style={{ color: '#999' }} />}
                  />
                </div>

                <Card size="small" title="Метаданные задач" style={{ marginBottom: 16 }}>
                  {/* Часть ЕГЭ — определяет, нужно ли парсить критерии и max_score */}
                  <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
                    <Col span={12}>
                      <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Часть экзамена</div>
                      <Select
                        style={{ width: '100%' }}
                        value={sdamgiaExamPart}
                        onChange={setSdamgiaExamPart}
                        options={[
                          { value: 1, label: 'Часть 1 (краткий ответ)' },
                          { value: 2, label: 'Часть 2 (развёрнутое решение)' },
                        ]}
                      />
                    </Col>
                    {sdamgiaExamPart === 2 && (
                      <Col span={12}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          Подсказка
                        </div>
                        <Alert
                          type="info"
                          showIcon
                          message="Критерии и макс. балл будут извлечены автоматически"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                        />
                      </Col>
                    )}
                  </Row>
                  <Row gutter={[16, 12]}>
                    <Col span={12}>
                      <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                        Тема <span style={{ color: '#ff4d4f' }}>*</span>
                      </div>
                      <Space.Compact style={{ width: '100%' }}>
                        <Select
                          style={{ flex: 1 }}
                          value={sdamgiaTopicId}
                          onChange={(value) => {
                            setSdamgiaTopicId(value);
                            setSdamgiaSubtopic('');
                          }}
                          placeholder="Выберите тему"
                          showSearch
                          optionFilterProp="label"
                          options={localTopics.map(t => ({
                            value: t.id,
                            label: `${t.ege_number ? `№${t.ege_number} ` : ''}${t.title}`,
                          }))}
                        />
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => openNewTopicModal('sdamgia')}
                          title="Создать тему"
                        />
                      </Space.Compact>
                    </Col>
                    <Col span={6}>
                      <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Сложность</div>
                      <Select
                        style={{ width: '100%' }}
                        value={sdamgiaDifficulty}
                        onChange={setSdamgiaDifficulty}
                        options={[
                          { value: '1', label: '1 — Базовый' },
                          { value: '2', label: '2 — Средний' },
                          { value: '3', label: '3 — Повышенный' },
                          { value: '4', label: '4 — Высокий' },
                          { value: '5', label: '5 — Олимпиадный' },
                        ]}
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Подтема</div>
                      <Space.Compact style={{ width: '100%' }}>
                        <Select
                          style={{ flex: 1 }}
                          value={sdamgiaSubtopic || undefined}
                          onChange={setSdamgiaSubtopic}
                          placeholder="Подтема"
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          disabled={!sdamgiaTopicId}
                          options={sdamgiaFilteredSubtopics.map(st => ({
                            value: st.name,
                            label: st.name,
                          }))}
                        />
                        <Button
                          icon={<PlusOutlined />}
                          disabled={!sdamgiaTopicId}
                          onClick={() => {
                            setNewSubtopicContext('sdamgia');
                            setShowNewSubtopic(true);
                          }}
                          title="Создать подтему"
                        />
                      </Space.Compact>
                    </Col>
                    <Col span={24}>
                      <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Теги (через запятую)</div>
                      <Input
                        value={sdamgiaTags}
                        onChange={(e) => setSdamgiaTags(e.target.value)}
                        placeholder="Например: База, Вычисления"
                      />
                    </Col>
                  </Row>
                </Card>

                {sdamgiaError && (
                  <Alert
                    type="error"
                    message={sdamgiaError}
                    showIcon
                    closable
                    onClose={() => setSdamgiaError('')}
                    style={{ marginBottom: 16 }}
                  />
                )}

                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleSdamgiaFetch}
                  loading={sdamgiaLoading}
                  disabled={!sdamgiaUrl.trim()}
                  size="large"
                >
                  Загрузить задачи
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );

  // ===== Шаг 2: Предпросмотр =====
  const renderPreviewStep = () => {
    if (!parsedData) return null;

    const hasErrors = parsedData.errors.length > 0;
    const fmt = FORMAT_TAG[parsedData.format] || FORMAT_TAG.ege;

    return (
      <div>
        {/* Ошибки */}
        {parsedData.errors.map((err, i) => (
          <Alert key={`err-${i}`} type="error" message={err} showIcon style={{ marginBottom: 8 }} />
        ))}

        {/* Предупреждения */}
        {parsedData.warnings.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={`${parsedData.warnings.length} предупреждений`}
            description={
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {parsedData.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {parsedData.warnings.length > 5 && (
                  <li>...и ещё {parsedData.warnings.length - 5}</li>
                )}
              </ul>
            }
          />
        )}

        {/* Метаданные */}
        <Card size="small" title="Метаданные" style={{ marginBottom: 16 }}>
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="Источник">{fileName}</Descriptions.Item>
            <Descriptions.Item label="Формат">
              <Tag color={fmt.color}>{fmt.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Тема">{parsedData.metadata.topic || '—'}</Descriptions.Item>
            <Descriptions.Item label="Подтема">{parsedData.metadata.subtopic || '—'}</Descriptions.Item>
            <Descriptions.Item label="Источник данных">{parsedData.metadata.source || '—'}</Descriptions.Item>
            <Descriptions.Item label="Год">{parsedData.metadata.year || '—'}</Descriptions.Item>
            <Descriptions.Item label="Глобальные теги">
              {parsedData.metadata.tags.length > 0
                ? parsedData.metadata.tags.map(t => <Tag key={t}>{t}</Tag>)
                : '—'
              }
            </Descriptions.Item>
            <Descriptions.Item label="Задач найдено">
              <Badge count={parsedData.tasks.length} showZero style={{ backgroundColor: '#1890ff' }} />
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Маппинг на БД */}
        <Card size="small" title="Привязка к базе данных" style={{ marginBottom: 16 }}>
          {/* Тему из YAML в базе не нашли — предлагаем создать её одним кликом,
              с уже подставленными названием и типом экзамена. */}
          {parsedData.metadata.topic && !topicId && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`Тема «${parsedData.metadata.topic}» не найдена в базе`}
              description="Выберите похожую тему из списка или создайте новую — название и тип экзамена подставятся из файла."
              action={
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => openNewTopicModal('preview')}
                >
                  Создать тему
                </Button>
              }
            />
          )}
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>
                Тема <span style={{ color: '#ff4d4f' }}>*</span>
              </div>
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  style={{ flex: 1 }}
                  value={topicId}
                  onChange={handleTopicChange}
                  placeholder="Выберите тему"
                  showSearch
                  optionFilterProp="label"
                  status={!topicId ? 'error' : undefined}
                  options={localTopics.map(t => ({
                    value: t.id,
                    label: `${t.ege_number ? `№${t.ege_number} ` : ''}${t.title}`,
                  }))}
                />
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => openNewTopicModal('preview')}
                  title="Создать тему"
                />
              </Space.Compact>
              {!topicId && (
                <Text type="danger" style={{ fontSize: 12 }}>Тема обязательна для импорта</Text>
              )}
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>Подтема</div>
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  style={{ flex: 1 }}
                  value={subtopicId}
                  onChange={setSubtopicId}
                  placeholder="Выберите подтему (необязательно)"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  disabled={!topicId}
                  options={filteredSubtopics.map(st => ({
                    value: st.id,
                    label: st.name,
                  }))}
                />
                <Button
                  icon={<PlusOutlined />}
                  disabled={!topicId}
                  onClick={() => {
                    setNewSubtopicContext('preview');
                    setNewSubtopicName(parsedData.metadata.subtopic || '');
                    setShowNewSubtopic(true);
                  }}
                  title="Создать подтему"
                />
              </Space.Compact>
            </Col>
          </Row>
        </Card>

        {/* Список задач */}
        <Card
          size="small"
          title={
            <Space wrap>
              <span>Задачи для импорта</span>
              <Tag color="blue">{selectedTasks.size} из {parsedData.tasks.length}</Tag>
              {llmTasks.size > 0 && (
                <Tag color="purple">🤖 LLM: {llmTasks.size}</Tag>
              )}
            </Space>
          }
          extra={
            <Space wrap>
              <Button size="small" onClick={selectAll}>Выбрать все</Button>
              <Button size="small" onClick={deselectAll}>Снять выбор</Button>
              {aiEnabled && (
                <>
                  <Button
                    size="small"
                    onClick={selectAllLlmNeedsReview}
                    title="Отметить 🤖 для всех выбранных задач с пометкой «Проверить LaTeX»"
                  >
                    🤖 для проблемных
                  </Button>
                  <Button size="small" onClick={selectAllLlm} title="Отметить 🤖 для всех выбранных">
                    🤖 для всех
                  </Button>
                  {llmTasks.size > 0 && (
                    <Button size="small" onClick={deselectAllLlm}>Снять 🤖</Button>
                  )}
                </>
              )}
            </Space>
          }
        >
          {parsedData.tasks.length === 0 ? (
            <Empty description="Задачи не найдены" />
          ) : (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {parsedData.tasks.map((task, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    background: selectedTasks.has(index) ? '#f6ffed' : 'transparent',
                    opacity: selectedTasks.has(index) ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Checkbox
                      checked={selectedTasks.has(index)}
                      onChange={() => toggleTask(index)}
                      style={{ marginTop: 3 }}
                    />
                    {aiEnabled && (
                      <Checkbox
                        checked={llmTasks.has(index)}
                        disabled={!selectedTasks.has(index)}
                        onChange={() => toggleLlmTask(index)}
                        style={{ marginTop: 3 }}
                        title="Прогнать через LLM (/latex-fix) при импорте"
                      >
                        <span style={{ fontSize: 12, color: llmTasks.has(index) ? '#722ed1' : '#999' }}>
                          🤖
                        </span>
                      </Checkbox>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: 4 }}>
                        <Text strong>#{task.number}</Text>
                        {task.sdamgiaId && (
                          <Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>
                            (id: {task.sdamgiaId})
                          </Text>
                        )}
                        <Tag
                          color={DIFFICULTY_COLORS[task.difficulty] || '#999'}
                          style={{ marginLeft: 8 }}
                        >
                          {DIFFICULTY_LABELS[task.difficulty] || `Сложность ${task.difficulty}`}
                        </Tag>
                        {task.exam_part === 2 && (
                          <Tag color="purple">Часть 2</Tag>
                        )}
                        {task.max_score != null && (
                          <Tag color="gold">{task.max_score} б.</Tag>
                        )}
                        {(() => {
                          const totalImgs = (task.condition_images?.length || 0)
                            + (task.solution_images?.length || 0)
                            + (task.criteria_images?.length || 0);
                          if (totalImgs > 0) {
                            return <Tag color="cyan">📷 {totalImgs}</Tag>;
                          }
                          if (task.imageUrl) return <Tag color="cyan">Изображение</Tag>;
                          return null;
                        })()}
                        {task.latex_needs_review && (
                          <>
                            <Tag color="warning">⚠ Проверить LaTeX</Tag>
                            {aiEnabled && (
                              <Button
                                size="small"
                                type="link"
                                loading={!!llmFixLoading[index]}
                                onClick={() => handleLlmFix(index)}
                                style={{ padding: 0, marginLeft: 4 }}
                              >
                                🤖 LLM-fix
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>
                        <MathRenderer text={task.statement_md} />
                      </div>
                      {task.answer && (
                        <div style={{ fontSize: 12, color: '#666' }}>
                          <Text type="secondary">Ответ: </Text>
                          <MathRenderer text={task.answer} />
                        </div>
                      )}
                      {task.tags.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {task.tags.map((t, i) => (
                            <Tag key={i} style={{ fontSize: 11 }}>{t}</Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Кнопки */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Button onClick={() => { handleReset(); }}>
            Назад
          </Button>
          <Button
            type="primary"
            onClick={handleStartImport}
            disabled={hasErrors || !topicId || selectedTasks.size === 0}
          >
            Импортировать {selectedTasks.size} задач
            {llmTasks.size > 0 && ` (🤖 LLM для ${llmTasks.size})`}
          </Button>
        </div>
      </div>
    );
  };

  // ===== Шаг 3: Импорт =====

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Steps
        current={currentStep}
        style={{ marginBottom: 24 }}
        items={[
          { title: 'Загрузка', description: 'Файл, текст или сайт' },
          { title: 'Предпросмотр', description: 'Проверка и настройки' },
          { title: 'Импорт', description: 'Загрузка в базу' },
        ]}
      />

      {currentStep === 0 && renderUploadStep()}
      {currentStep === 1 && renderPreviewStep()}
      {currentStep === 2 && <ImportStep importing={importing} importProgress={importProgress} importResults={importResults} onReset={handleReset} />}

      {/* Модальное окно создания темы */}
      <Modal
        title="Создать новую тему"
        open={showNewTopic}
        onOk={handleCreateTopic}
        onCancel={() => {
          setShowNewTopic(false);
          setNewTopicTitle('');
          setNewTopicNumber(null);
        }}
        confirmLoading={creatingTopic}
        okText="Создать"
        cancelText="Отмена"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Тип экзамена</div>
          <Select
            style={{ width: '100%' }}
            value={newTopicExamType}
            onChange={setNewTopicExamType}
            options={EXAM_TYPE_OPTIONS}
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            У базового и профильного ЕГЭ независимая нумерация — № 17 может
            существовать в обоих как разные темы.
          </div>
        </div>
        {newTopicExamType === 'ege_profile' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>Часть экзамена</div>
            <Select
              style={{ width: '100%' }}
              value={newTopicExamPart}
              onChange={setNewTopicExamPart}
              options={[
                { value: 1, label: 'Часть 1 (краткий ответ, № 1–12)' },
                { value: 2, label: 'Часть 2 (развёрнутое решение, № 13–19)' },
              ]}
            />
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Название темы</div>
          <Input
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
            placeholder="Например: Вычисления и преобразования"
            onPressEnter={handleCreateTopic}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Номер задания ЕГЭ</div>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={27}
            value={newTopicNumber}
            onChange={setNewTopicNumber}
            placeholder="Например: 14"
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            Поставьте 0, если тема вне нумерации ЕГЭ (входной тест, зачёт,
            повторение) — номер нужен только для кодов задач вида «14-001».
          </div>
        </div>
      </Modal>

      {/* Модальное окно создания подтемы */}
      <Modal
        title="Создать новую подтему"
        open={showNewSubtopic}
        onOk={() => {
          const forTopicId = newSubtopicContext === 'sdamgia' ? sdamgiaTopicId : topicId;
          handleCreateSubtopic(forTopicId);
        }}
        onCancel={() => {
          setShowNewSubtopic(false);
          setNewSubtopicName('');
        }}
        confirmLoading={creatingSubtopic}
        okText="Создать"
        cancelText="Отмена"
      >
        <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
          Тема: <strong>
            {(() => {
              const tid = newSubtopicContext === 'sdamgia' ? sdamgiaTopicId : topicId;
              const t = localTopics.find(t => t.id === tid);
              return t ? `${t.ege_number ? `№${t.ege_number} ` : ''}${t.title}` : '—';
            })()}
          </strong>
        </div>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Название подтемы</div>
          <Input
            value={newSubtopicName}
            onChange={(e) => setNewSubtopicName(e.target.value)}
            placeholder="Например: Логарифмические уравнения"
            onPressEnter={() => {
              const forTopicId = newSubtopicContext === 'sdamgia' ? sdamgiaTopicId : topicId;
              handleCreateSubtopic(forTopicId);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
