import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Modal, Form, Select, Input, InputNumber, Button, Space, Popconfirm, Spin, Divider, Alert, Segmented, Upload, App, Tooltip, Tag, Collapse } from 'antd';
import { EditOutlined, SaveOutlined, DeleteOutlined, ExclamationCircleOutlined, PlusOutlined, LinkOutlined, HighlightOutlined, UploadOutlined, ScissorOutlined, CloseCircleOutlined, ExportOutlined, TableOutlined, ReloadOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';
import TaskStatementRenderer from './TaskStatementRenderer';
import RefreshFromSdamgiaModal from './RefreshFromSdamgiaModal';
import SimilarTasksPanel from './SimilarTasksPanel';
import GeoGebraDrawingPanel from './GeoGebraDrawingPanel';
import CropModal from './shared/CropModal';
import { generateTaskCode } from '../utils/taskCodeGenerator';
import { dataUrlToFile } from '../utils/cropImage';
import { api } from '../services/pocketbase';
import { useImageUpload } from '../hooks';
import { parseMatchingTask } from '../utils/parseMatchingTask';

const DEFINE_API_BASE = import.meta.env.VITE_DEFINE_API_URL?.replace('/define', '') || 'https://l.oipav.ru';

// URL pdf-service (та же логика, что в TaskImporter): VITE override или
// production-домен через window.location.hostname, fallback на localhost:3001.
const PDF_SERVICE_URL = (() => {
  const envUrl = import.meta.env.VITE_PDF_SERVICE_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (window.location.hostname.includes('localhost')) return 'http://localhost:3001';
    // Прод через nginx proxy /pdf на тот же домен
    return `${window.location.protocol}//${window.location.hostname}/pdf`;
  }
  return 'http://localhost:3001';
})();

const { Option } = Select;
const { TextArea } = Input;

const TaskEditModal = ({ task, visible, onClose, onSave, onDelete, allTags = [], allSources = [], allYears = [], allSubtopics = [], allTopics = [] }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copyingToGeo, setCopyingToGeo] = useState(false);
  const [previewStatement, setPreviewStatement] = useState('');
  const [previewAnswer, setPreviewAnswer] = useState('');
  const [previewSolution, setPreviewSolution] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [filteredSubtopics, setFilteredSubtopics] = useState([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [tags, setTags] = useState([]);
  const [creatingTag, setCreatingTag] = useState(false);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [creatingSubtopic, setCreatingSubtopic] = useState(false);
  const [newTopicNumber, setNewTopicNumber] = useState(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newSubtopicName, setNewSubtopicName] = useState('');

  const [selectedExamType, setSelectedExamType] = useState(null);

  const img = useImageUpload('url');
  const [imageDeleted, setImageDeleted] = useState(false);
  const [convertingTable, setConvertingTable] = useState(false);
  const statementTextAreaRef = useRef(null);

  // Картинки задачи из коллекции task_images, сгруппированы по ролям.
  // Используются для подмены ![image](внешний_url) на локальный в превью.
  const [taskImages, setTaskImages] = useState({ condition: [], solution: [], criteria: [] });

  // LLM-fix состояние: loading + локальный override critериев (поле не в форме,
  // а в task — после fix храним новую версию здесь, при handleSave передаём в API).
  const [latexFixLoading, setLatexFixLoading] = useState(false);
  const [criteriaOverride, setCriteriaOverride] = useState(null);
  // Модал «Перепарсить с Решу ЕГЭ» (Уровень 2)
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  // Сбрасываем criteriaOverride при смене task
  useEffect(() => {
    if (visible) setCriteriaOverride(null);
  }, [visible, task?.id]);

  /**
   * Прогнать текущие statement/solution/criteria через /latex-fix и
   * автоматически подставить результат в форму. Сохранение делает учитель
   * обычной кнопкой Save — это даёт ему возможность вручную доправить или
   * откатить.
   */
  const handleLatexFix = async () => {
    setLatexFixLoading(true);
    try {
      const values = form.getFieldsValue();
      const fields = [
        ['statement_md', values.statement_md, (v) => { form.setFieldValue('statement_md', v); setPreviewStatement(v); }],
        ['solution_md',  values.solution_md,  (v) => { form.setFieldValue('solution_md', v);  setPreviewSolution(v); }],
        ['criteria_md',  criteriaOverride ?? task?.criteria_md, (v) => setCriteriaOverride(v)],
      ];
      let changedCount = 0;
      for (const [field, text, setter] of fields) {
        if (!text || !String(text).trim()) continue;
        const role = field.replace('_md', '');
        const resp = await fetch(`${PDF_SERVICE_URL}/latex-fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, role }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(`${field}: ${err.error || resp.status}`);
        }
        const data = await resp.json();
        if (data.text && data.text !== text) {
          setter(data.text);
          changedCount++;
        }
      }
      if (changedCount === 0) {
        message.info('LLM не нашёл что исправить — поля уже корректны');
      } else {
        message.success(`Поля обновлены (${changedCount}). Не забудь «Сохранить».`);
      }
    } catch (e) {
      message.error(`Ошибка LLM-fix: ${e.message}`);
    } finally {
      setLatexFixLoading(false);
    }
  };

  const isCreateMode = !task;

  const EXAM_TYPE_OPTIONS = [
    { value: 'ege_base',    label: 'ЕГЭ базовый' },
    { value: 'ege_profile', label: 'ЕГЭ профильный' },
    { value: 'mordkovich',  label: 'Мордкович' },
    { value: 'oral',        label: 'Устный счёт' },
    { value: 'vpr',         label: 'ВПР' },
    { value: 'trig',        label: 'Тригонометрия' },
    { value: 'other',       label: 'Прочее' },
  ];

  const filteredTopicsList = useMemo(() => {
    if (!selectedExamType) return topics;
    return topics.filter(t => t.exam_type === selectedExamType);
  }, [topics, selectedExamType]);

  // Функция генерации кода задачи
  const handleGenerateCode = async (topicId) => {
    if (!topicId) return;
    setGeneratingCode(true);
    try {
      const topic = Array.isArray(allTopics) ? allTopics.find(t => t.id === topicId) : null;
      const code = await generateTaskCode(topicId, topic);
      setGeneratedCode(code);
    } catch (error) {
      console.error('[TaskEditModal] Error generating code:', error);
      message.error(`Ошибка при генерации кода: ${error.message}`);
    } finally {
      setGeneratingCode(false);
    }
  };

  // Синхронизация списков с props
  useEffect(() => { setTags(allTags); }, [allTags]);
  useEffect(() => { setTopics(allTopics); }, [allTopics]);
  useEffect(() => { setSubtopics(allSubtopics); }, [allSubtopics]);

  const normalizeTitle = (value) => (value || '').trim().toLowerCase();

  const handleCreateTag = async (newTagTitle) => {
    if (!newTagTitle?.trim()) return;
    const trimmedTitle = newTagTitle.trim();
    const existingTag = tags.find(t => t.title.toLowerCase() === trimmedTitle.toLowerCase());
    if (existingTag) {
      message.warning(`Тег "${trimmedTitle}" уже существует`);
      return existingTag.id;
    }
    setCreatingTag(true);
    try {
      const colors = ['#f50', '#2db7f5', '#87d068', '#108ee9', '#faad14', '#722ed1', '#eb2f96', '#52c41a'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const newTag = await api.createTag({ title: trimmedTitle, color: randomColor });
      setTags([...tags, newTag]);
      message.success(`Тег "${trimmedTitle}" создан`);
      return newTag.id;
    } catch (error) {
      console.error('Error creating tag:', error);
      message.error('Ошибка при создании тега');
      return null;
    } finally {
      setCreatingTag(false);
    }
  };

  useEffect(() => {
    if (visible) {
      if (task) {
        const topicData = allTopics.find(t => t.id === task.topic);
        setSelectedTopic(topicData);
        setSelectedExamType(topicData?.exam_type || null);
        if (task.topic) {
          setFilteredSubtopics(allSubtopics.filter(st => st.topic === task.topic));
        }
        // Подгружаем картинки task_images для подмены URL'ов в md-предпросмотре.
        // Используем sdamgia_id как индикатор — у обычных задач (часть 1) этого
        // обычно нет, и запрос вернёт пустые группы.
        api.getTaskImages(task.id).then(setTaskImages).catch(() => {
          setTaskImages({ condition: [], solution: [], criteria: [] });
        });
        form.setFieldsValue({
          topic: task.topic || undefined,
          subtopic: task.subtopic || undefined,
          difficulty: task.difficulty,
          answer: task.answer || '',
          statement_md: task.statement_md || '',
          solution_md: task.solution_md || '',
          source: task.source || '',
          year: task.year || undefined,
          tags: task.tags || [],
          image_url: task.image_url || '',
        });
        setPreviewStatement(task.statement_md || '');
        setPreviewAnswer(task.answer || '');
        setPreviewSolution(task.solution_md || '');
        if (task.image && !task.image_url) {
          img.setImageSource('upload');
        } else {
          img.setImageSource('url');
        }
        img.setDrawingImageDataUrl(null);
        img.setUploadedFile(null);
        img.setUploadPreviewUrl('');
        setImageDeleted(false);
      } else {
        setTaskImages({ condition: [], solution: [], criteria: [] });
        form.resetFields();
        setGeneratedCode('');
        setPreviewStatement('');
        setPreviewAnswer('');
        setPreviewSolution('');
        setSelectedTopic(null);
        setFilteredSubtopics([]);
        setSelectedExamType(null);
        img.resetImage();
        setImageDeleted(false);
      }
    }
  }, [task, visible, form, allTopics, allSubtopics]);

  const handleTopicChange = (topicId) => {
    const topicData = topics.find(t => t.id === topicId);
    setSelectedTopic(topicData);
    setFilteredSubtopics(subtopics.filter(st => st.topic === topicId));
    form.setFieldValue('subtopic', undefined);
    if (isCreateMode) handleGenerateCode(topicId);
  };

  const handleCreateTopic = async () => {
    const trimmedTitle = (newTopicTitle || '').trim();
    if (!trimmedTitle) { message.warning('Введите название темы'); return; }

    const isEgeType = selectedExamType === 'ege_base' || selectedExamType === 'ege_profile';
    if (isEgeType && (newTopicNumber == null || newTopicNumber === '')) {
      message.warning('Укажите номер ЕГЭ'); return;
    }

    if (newTopicNumber != null && newTopicNumber !== '') {
      const existingByNumber = topics.find(t => String(t.ege_number) === String(newTopicNumber));
      if (existingByNumber) {
        message.warning(`Тема с номером ${newTopicNumber} уже существует`);
        form.setFieldValue('topic', existingByNumber.id);
        handleTopicChange(existingByNumber.id);
        return;
      }
    }
    const existingByTitle = topics.find(t => normalizeTitle(t.title) === normalizeTitle(trimmedTitle));
    if (existingByTitle) {
      message.warning(`Тема "${trimmedTitle}" уже существует`);
      form.setFieldValue('topic', existingByTitle.id);
      handleTopicChange(existingByTitle.id);
      return;
    }

    setCreatingTopic(true);
    try {
      const topicPayload = { title: trimmedTitle };
      if (newTopicNumber != null && newTopicNumber !== '') {
        topicPayload.ege_number = Number(newTopicNumber);
        topicPayload.order = Number(newTopicNumber);
      }
      if (selectedExamType) topicPayload.exam_type = selectedExamType;
      const newTopic = await api.createTopic(topicPayload);
      setTopics([...topics, newTopic]);
      message.success(`Тема "${trimmedTitle}" создана`);
      setNewTopicTitle('');
      setNewTopicNumber(null);
      form.setFieldValue('topic', newTopic.id);
      handleTopicChange(newTopic.id);
    } catch (error) {
      console.error('Error creating topic:', error);
      message.error('Ошибка при создании темы');
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleCreateSubtopic = async () => {
    const topicId = form.getFieldValue('topic');
    if (!topicId) { message.warning('Сначала выберите тему'); return; }
    const trimmedName = (newSubtopicName || '').trim();
    if (!trimmedName) { message.warning('Введите название подтемы'); return; }

    const existing = subtopics.find(st => st.topic === topicId && normalizeTitle(st.name) === normalizeTitle(trimmedName));
    if (existing) {
      message.warning(`Подтема "${trimmedName}" уже существует`);
      form.setFieldValue('subtopic', existing.id);
      return;
    }

    setCreatingSubtopic(true);
    try {
      const newSubtopic = await api.createSubtopic({ name: trimmedName, topic: topicId });
      const updated = [...subtopics, newSubtopic];
      setSubtopics(updated);
      setFilteredSubtopics(updated.filter(st => st.topic === topicId));
      message.success(`Подтема "${trimmedName}" создана`);
      setNewSubtopicName('');
      form.setFieldValue('subtopic', newSubtopic.id);
    } catch (error) {
      console.error('Error creating subtopic:', error);
      message.error('Ошибка при создании подтемы');
    } finally {
      setCreatingSubtopic(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const taskData = {
        topic: values.topic,
        subtopic: values.subtopic || null,
        difficulty: values.difficulty,
        answer: values.answer || '',
        statement_md: values.statement_md || '',
        solution_md: values.solution_md || '',
        source: values.source || '',
        year: values.year || null,
        tags: values.tags || [],
      };

      // Critерии не в форме — переносим из override, если был LLM-fix.
      if (criteriaOverride != null && criteriaOverride !== task?.criteria_md) {
        taskData.criteria_md = criteriaOverride;
      }
      // Если хоть одно поле было исправлено LLM, сбрасываем флаг needs_review.
      const latexChanged =
        (criteriaOverride != null && criteriaOverride !== task?.criteria_md) ||
        (task && values.statement_md !== task.statement_md) ||
        (task && values.solution_md !== task.solution_md);
      if (task?.latex_needs_review && latexChanged) {
        taskData.latex_needs_review = false;
      }

      if (imageDeleted) {
        // Явное удаление изображения пользователем
        taskData.image = null;
        taskData.image_url = '';
        taskData.has_image = false;
      } else if (img.imageSource === 'drawing' && img.drawingImageDataUrl) {
        taskData.image = dataUrlToFile(img.drawingImageDataUrl);
        taskData.image_url = '';
        taskData.has_image = true;
      } else if (img.imageSource === 'upload' && img.uploadedFile) {
        taskData.image = img.uploadedFile;
        taskData.image_url = '';
        taskData.has_image = true;
      } else if (img.imageSource === 'url') {
        taskData.image_url = values.image_url || '';
        taskData.has_image = !!values.image_url;
      } else {
        taskData.image_url = '';
        taskData.has_image = !!(task?.image);
      }

      if (isCreateMode) {
        if (!generatedCode) {
          message.error('Код задачи не сгенерирован. Выберите тему.');
          setLoading(false);
          return;
        }
        taskData.code = generatedCode;
      }

      await onSave(isCreateMode ? null : task.id, taskData);
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      setDeleting(true);
      await onDelete(task.id);
      message.success('Задача удалена');
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      message.error('Ошибка при удалении задачи');
    } finally {
      setDeleting(false);
    }
  };

  // Вспомогательная: достаёт выделенный текст (или весь) из textarea
  const getSourceText = useCallback(() => {
    const el = statementTextAreaRef.current?.resizableTextArea?.textArea;
    const fullValue = form.getFieldValue('statement_md') || '';
    const selStart = el?.selectionStart ?? 0;
    const selEnd = el?.selectionEnd ?? 0;
    const hasSelection = el && selStart !== selEnd;
    return {
      fullValue,
      selStart,
      selEnd,
      hasSelection,
      sourceText: hasSelection ? fullValue.slice(selStart, selEnd) : fullValue,
    };
  }, [form]);

  // Применяет результат конвертации в поле
  const applyConversionResult = useCallback((result, { fullValue, selStart, selEnd, hasSelection }) => {
    const newValue = hasSelection
      ? fullValue.slice(0, selStart) + result + fullValue.slice(selEnd)
      : result;
    form.setFieldValue('statement_md', newValue);
    setPreviewStatement(newValue);
  }, [form]);

  // Кнопка 1: эвристика
  const handleConvertHeuristic = useCallback(() => {
    const ctx = getSourceText();
    if (!ctx.sourceText.trim()) return;
    const result = parseMatchingTask(ctx.sourceText);
    if (result) {
      applyConversionResult(result, ctx);
      message.success('Таблица построена');
    } else {
      message.warning('Не удалось распознать структуру — попробуйте кнопку «AI»');
    }
  }, [getSourceText, applyConversionResult, message]);

  // Кнопка 2: LLM
  const handleConvertAI = useCallback(async () => {
    const ctx = getSourceText();
    if (!ctx.sourceText.trim()) return;
    setConvertingTable(true);
    try {
      const resp = await fetch(`${DEFINE_API_BASE}/parse-matching`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ctx.sourceText }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const result = data.markdown || '';
      if (!result) {
        message.warning('AI не смог распознать структуру задачи.');
        return;
      }
      applyConversionResult(result, ctx);
      message.success('Таблица построена через AI');
    } catch {
      message.error('Ошибка при обращении к AI. Проверьте подключение.');
    } finally {
      setConvertingTable(false);
    }
  }, [getSourceText, applyConversionResult, message]);

  const handleCopyToGeometry = async () => {
    setCopyingToGeo(true);
    try {
      const values = form.getFieldsValue();
      const statement = values.statement_md || task.statement_md || '';
      const solution = values.solution_md || task.solution_md || '';
      const solutionWithRef = [`*Аналогична задаче ${task.code}.*`, solution].filter(Boolean).join('\n\n');

      const sourceVal = values.source;
      const source = Array.isArray(sourceVal) ? (sourceVal[0] || '') : (sourceVal || task.source || '');

      const titleRaw = statement.replace(/\$\$[\s\S]*?\$\$/g, '…').replace(/\$[^$]*\$/g, '…').replace(/[*_#]/g, '').trim();
      const title = titleRaw.slice(0, 80) || task.code;

      const geoTasks = await api.getGeometryTasks();
      const n = String(geoTasks.length + 1).padStart(3, '0');
      const code = `GEO-${n}`;

      const payload = {
        code,
        title,
        difficulty: values.difficulty || task.difficulty,
        statement_md: statement,
        answer: values.answer || task.answer || '',
        solution_md: solutionWithRef,
        source,
        year: values.year || task.year || null,
      };

      // Копируем изображение из задачи, если оно есть
      const imageUrl = api.getTaskImageUrl(task);
      if (imageUrl) {
        try {
          const resp = await fetch(imageUrl);
          const blob = await resp.blob();
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          payload.geogebra_image_base64 = new File([blob], `${code}.${ext}`, { type: blob.type });
          payload.drawing_view = 'image';
        } catch {
          message.warning('Не удалось скопировать изображение — задача создана без чертежа');
        }
      }

      const created = await api.createGeometryTask(payload);
      message.success(`Задача скопирована в геометрию как ${created.code}`);
    } catch (error) {
      console.error('Error copying to geometry:', error);
      message.error('Ошибка при копировании в геометрию');
    } finally {
      setCopyingToGeo(false);
    }
  };

  const handleCropped = (croppedDataUrl) => {
    img.setUploadPreviewUrl(croppedDataUrl);
    img.setUploadedFile(dataUrlToFile(croppedDataUrl, img.uploadedFile?.name || 'image.png'));
    img.setCropModalOpen(false);
  };

  // ESC закрывает модал только если фокус НЕ внутри GeoGebra-апплета (iframe)
  const handleEscClose = useCallback(() => onClose(), [onClose]);
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      const active = document.activeElement;
      if (active && active.tagName === 'IFRAME') return;
      handleEscClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, handleEscClose]);

  return (
    <>
    <Modal
      title={
        <Space wrap>
          {isCreateMode ? <PlusOutlined /> : <EditOutlined />}
          <span>
            {isCreateMode
              ? `Создание новой задачи${generatedCode ? ` - ${generatedCode}` : ''}`
              : `Редактирование задачи ${task?.code}`
            }
          </span>
          {isCreateMode && generatingCode && <Spin size="small" />}
          {/* Бейджи и ссылки для задач из «Решу ЕГЭ» (часть 2) */}
          {task?.exam_part === 2 && <Tag color="purple">Часть 2</Tag>}
          {task?.max_score != null && <Tag color="gold">{task.max_score} б.</Tag>}
          {task?.latex_needs_review && <Tag color="warning">⚠ Проверить LaTeX</Tag>}
          {task?.sdamgia_url && (
            <Button
              type="link"
              size="small"
              icon={<ExportOutlined />}
              href={task.sdamgia_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Решу ЕГЭ (id {task.sdamgia_id})
            </Button>
          )}
          {/* Кнопка LLM-fix LaTeX — для уже сохранённых задач.
              Берёт текущее из формы, прогоняет через /latex-fix, подставляет
              результат в форму. Учитель сохраняет обычной кнопкой Save. */}
          {!isCreateMode && (
            <Button
              size="small"
              type="default"
              loading={latexFixLoading}
              onClick={handleLatexFix}
              title="Прогнать текст задачи через LLM, чтобы починить разметку LaTeX"
            >
              🤖 Починить LaTeX
            </Button>
          )}
          {!isCreateMode && task?.sdamgia_url && (
            <Button
              size="small"
              type="default"
              icon={<ReloadOutlined />}
              onClick={() => setRefreshModalOpen(true)}
              title="Перепарсить задачу с sdamgia актуальным парсером + LLM"
            >
              Перепарсить с Решу ЕГЭ
            </Button>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      keyboard={false}
      width="100vw"
      style={{ top: 0, paddingBottom: 0, maxWidth: '100vw', margin: 0 }}
      styles={{
        content: { borderRadius: 0 },
        body: { maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', padding: '16px 24px' },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {!isCreateMode ? (
            <Space>
              <Popconfirm
                title="Удаление задачи"
                description={`Вы уверены, что хотите удалить задачу ${task?.code}?`}
                onConfirm={handleDelete}
                okText="Удалить"
                cancelText="Отмена"
                okButtonProps={{ danger: true }}
                icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              >
                <Button danger icon={<DeleteOutlined />} loading={deleting}>Удалить</Button>
              </Popconfirm>
              <Tooltip title="Скопировать задачу в базу геометрических задач">
                <Button icon={<ExportOutlined />} loading={copyingToGeo} onClick={handleCopyToGeometry}>
                  В геометрию
                </Button>
              </Tooltip>
            </Space>
          ) : <div />}
          <Space>
            <Button onClick={onClose}>Отмена</Button>
            <Button type="primary" icon={isCreateMode ? <PlusOutlined /> : <SaveOutlined />} loading={loading} onClick={handleSave}>
              {isCreateMode ? 'Создать' : 'Сохранить'}
            </Button>
          </Space>
        </div>
      }
    >
      {!isCreateMode && (
        <Alert
          type="warning"
          showIcon
          message="Изменения будут применены ко всем работам, где используется эта задача."
          style={{ marginBottom: 16 }}
        />
      )}
      <Form form={form} layout="vertical">
        {/* Уровень сложности */}
        <Form.Item name="difficulty" label="Уровень сложности" rules={[{ required: true, message: 'Выберите уровень сложности' }]}>
          <Select>
            <Option value="1">1 - Базовый</Option>
            <Option value="2">2 - Средний</Option>
            <Option value="3">3 - Повышенный</Option>
            <Option value="4">4 - Высокий</Option>
            <Option value="5">5 - Олимпиадный</Option>
          </Select>
        </Form.Item>

        {/* Контекст */}
        <Form.Item label="Контекст">
          <Select
            placeholder="Все темы"
            allowClear
            value={selectedExamType}
            onChange={(val) => {
              setSelectedExamType(val || null);
              form.setFieldsValue({ topic: undefined, subtopic: undefined });
              setSelectedTopic(null);
              setFilteredSubtopics([]);
            }}
          >
            {EXAM_TYPE_OPTIONS.map(o => (
              <Option key={o.value} value={o.value}>{o.label}</Option>
            ))}
          </Select>
        </Form.Item>

        {/* Тема */}
        <Form.Item name="topic" label="Тема" rules={[{ required: true, message: 'Выберите тему' }]}>
          <Select
            placeholder="Выберите тему"
            showSearch
            optionFilterProp="children"
            onChange={handleTopicChange}
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ padding: '0 8px 8px' }}>
                  <Space style={{ display: 'flex' }}>
                    {(selectedExamType === 'ege_base' || selectedExamType === 'ege_profile' || !selectedExamType) && (
                      <InputNumber placeholder="№ ЕГЭ" min={0} style={{ width: 100 }} value={newTopicNumber} onChange={setNewTopicNumber} />
                    )}
                    <Input placeholder="Новая тема" value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} />
                    <Button type="text" icon={<PlusOutlined />} loading={creatingTopic} onClick={handleCreateTopic}>Добавить</Button>
                  </Space>
                </div>
              </>
            )}
          >
            {filteredTopicsList.map(topic => (
              <Option key={topic.id} value={topic.id}>{topic.ege_number ? `№${topic.ege_number} — ` : ''}{topic.title}</Option>
            ))}
          </Select>
        </Form.Item>

        {/* Подтема */}
        <Form.Item name="subtopic" label="Подтема">
          <Select
            placeholder="Выберите подтему"
            allowClear
            showSearch
            optionFilterProp="children"
            disabled={!form.getFieldValue('topic')}
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ padding: '0 8px 8px' }}>
                  <Space style={{ display: 'flex' }}>
                    <Input placeholder="Новая подтема" value={newSubtopicName} onChange={(e) => setNewSubtopicName(e.target.value)} />
                    <Button type="text" icon={<PlusOutlined />} loading={creatingSubtopic} onClick={handleCreateSubtopic} disabled={!form.getFieldValue('topic')}>Добавить</Button>
                  </Space>
                </div>
              </>
            )}
          >
            {filteredSubtopics.map(st => (
              <Option key={st.id} value={st.id}>{st.name}</Option>
            ))}
          </Select>
        </Form.Item>

        {/* Источник */}
        <Form.Item name="source" label="Источник">
          <Select placeholder="Выберите или введите источник" allowClear showSearch mode="tags" maxTagCount={1}>
            {allSources.map(s => (<Option key={s} value={s}>{s}</Option>))}
          </Select>
        </Form.Item>

        {/* Год */}
        <Form.Item name="year" label="Год">
          <Select placeholder="Выберите год" allowClear showSearch>
            {allYears.map(y => (<Option key={y} value={y}>{y}</Option>))}
          </Select>
        </Form.Item>

        {/* Теги */}
        <Form.Item name="tags" label="Теги" help="Введите название нового тега и нажмите Enter для создания">
          <Select
            mode="tags"
            placeholder="Выберите или создайте теги"
            allowClear
            showSearch
            loading={creatingTag}
            optionFilterProp="children"
            onSelect={async (value) => {
              const isExistingTag = tags.some(t => t.id === value);
              if (!isExistingTag) {
                const newTagId = await handleCreateTag(value);
                const currentTags = form.getFieldValue('tags') || [];
                if (newTagId) {
                  form.setFieldValue('tags', currentTags.map(t => t === value ? newTagId : t));
                } else {
                  form.setFieldValue('tags', currentTags.filter(t => t !== value));
                }
              }
            }}
          >
            {tags.map(tag => (<Option key={tag.id} value={tag.id}>{tag.title}</Option>))}
          </Select>
        </Form.Item>

        {/* Изображение */}
        <Form.Item label="Изображение (опционально)">
          {/* Индикатор текущего изображения с кнопкой удаления */}
          {!isCreateMode && (task?.image || task?.image_url) && !imageDeleted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              padding: '6px 10px', background: '#f6ffed', borderRadius: 6,
              border: '1px solid #b7eb8f', fontSize: 12,
            }}>
              <span style={{ color: '#52c41a', flex: 1 }}>
                ✓ Изображение прикреплено
                {task.image_url ? ` (ссылка)` : ` (файл)`}
              </span>
              <Tooltip title="Удалить изображение из задачи">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    setImageDeleted(true);
                    img.resetImage();
                    form.setFieldValue('image_url', '');
                  }}
                >
                  Удалить
                </Button>
              </Tooltip>
            </div>
          )}

          {/* Уведомление о том, что изображение будет удалено */}
          {imageDeleted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              padding: '6px 10px', background: '#fff1f0', borderRadius: 6,
              border: '1px solid #ffa39e', fontSize: 12,
            }}>
              <span style={{ color: '#ff4d4f', flex: 1 }}>
                ✕ Изображение будет удалено при сохранении
              </span>
              <Button
                size="small"
                onClick={() => {
                  setImageDeleted(false);
                  // Восстанавливаем исходный режим
                  if (task?.image && !task?.image_url) {
                    img.setImageSource('upload');
                  } else {
                    img.setImageSource('url');
                    form.setFieldValue('image_url', task?.image_url || '');
                  }
                }}
              >
                Отменить
              </Button>
            </div>
          )}

          <Segmented
            value={img.imageSource}
            onChange={img.setImageSource}
            options={[
              { value: 'url', label: 'По ссылке', icon: <LinkOutlined /> },
              { value: 'upload', label: 'Загрузить', icon: <UploadOutlined /> },
              { value: 'drawing', label: 'Нарисовать', icon: <HighlightOutlined /> },
            ]}
            style={{ marginBottom: 12 }}
          />

          {img.imageSource === 'url' && (
            <Form.Item name="image_url" noStyle>
              <Input placeholder="https://example.com/image.png" />
            </Form.Item>
          )}

          {img.imageSource === 'upload' && (
            <div>
              {(img.uploadPreviewUrl || (task?.image && !img.uploadedFile)) && (
                <div style={{ marginBottom: 12, border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <img
                    src={img.uploadPreviewUrl || api.getTaskImageUrl(task)}
                    alt="Изображение"
                    style={{ maxWidth: '100%', maxHeight: 200, display: 'block', margin: '0 auto' }}
                  />
                </div>
              )}
              <Space wrap>
                <Upload
                  accept="image/*"
                  maxCount={1}
                  showUploadList={false}
                  beforeUpload={(file) => {
                    img.setUploadedFile(file);
                    const reader = new FileReader();
                    reader.onload = (e) => img.setUploadPreviewUrl(e.target.result);
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>Выбрать файл</Button>
                </Upload>
                <Button
                  icon={<ScissorOutlined />}
                  disabled={!img.uploadPreviewUrl}
                  onClick={() => img.setCropModalOpen(true)}
                >
                  Обрезать
                </Button>
              </Space>
              {img.uploadedFile && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>{img.uploadedFile.name}</div>
              )}
            </div>
          )}

          {img.imageSource === 'drawing' && (
            <>
              {task?.image && !img.drawingImageDataUrl && (
                <div style={{ marginBottom: 12, border: '1px solid #e8e8e8', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Текущий чертёж:</div>
                  <img
                    src={api.getTaskImageUrl(task)}
                    alt="Текущий чертёж"
                    style={{ maxWidth: '100%', maxHeight: 150, display: 'block', margin: '0 auto' }}
                  />
                </div>
              )}
              <GeoGebraDrawingPanel
                imageDataUrl={img.drawingImageDataUrl}
                onImageChange={img.setDrawingImageDataUrl}
              />
            </>
          )}
        </Form.Item>

        {/* Текст задания */}
        <Form.Item
          name="statement_md"
          label={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              Текст задания (поддерживает LaTeX: $x^2$)
              <Tooltip title="Быстрое преобразование алгоритмом — мгновенно, без сети">
                <Button
                  size="small"
                  icon={<TableOutlined />}
                  onClick={handleConvertHeuristic}
                  style={{ fontWeight: 400 }}
                >
                  → Таблица
                </Button>
              </Tooltip>
              <Tooltip title="Преобразование через AI — медленнее, но справляется с нестандартными форматами">
                <Button
                  size="small"
                  icon={<TableOutlined />}
                  loading={convertingTable}
                  onClick={handleConvertAI}
                  style={{ fontWeight: 400 }}
                >
                  → Таблица (AI)
                </Button>
              </Tooltip>
            </span>
          }
          rules={[{ required: isCreateMode, message: 'Введите текст задания' }]}
        >
          <TextArea
            ref={statementTextAreaRef}
            rows={4}
            placeholder="Введите текст задания..."
            onChange={(e) => setPreviewStatement(e.target.value)}
          />
        </Form.Item>

        {previewStatement && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, border: '1px solid #d9d9d9' }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 'bold' }}>Предпросмотр задания:</div>
            <TaskStatementRenderer text={previewStatement} images={taskImages.condition} answerBoxes />
          </div>
        )}

        {/* Ответ */}
        <Form.Item name="answer" label="Ответ (поддерживает LaTeX)">
          <Input placeholder="Введите ответ..." onChange={(e) => setPreviewAnswer(e.target.value)} />
        </Form.Item>

        {previewAnswer && (
          <div style={{ marginBottom: 16, padding: 12, background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 'bold' }}>Предпросмотр ответа:</div>
            <MathRenderer text={previewAnswer} />
          </div>
        )}

        {/* Решение */}
        <Form.Item name="solution_md" label="Решение (опционально, поддерживает LaTeX)">
          <TextArea rows={5} placeholder="Введите решение задачи..." onChange={(e) => setPreviewSolution(e.target.value)} />
        </Form.Item>

        {previewSolution && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 4, border: '1px solid #b7eb8f' }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 'bold' }}>Предпросмотр решения:</div>
            <TaskStatementRenderer text={previewSolution} images={taskImages.solution} />
          </div>
        )}

        {/* Критерии оценивания + max_score — только для задач части 2.
            После LLM-fix используем criteriaOverride, до сохранения task
            не меняется, но превью обновлено. */}
        {(() => {
          const currentCriteria = criteriaOverride ?? task?.criteria_md;
          if (!currentCriteria && task?.exam_part !== 2) return null;
          return (
            <Collapse
              ghost
              style={{ marginBottom: 16 }}
              items={[{
                key: 'criteria',
                label: (
                  <Space>
                    <strong>Критерии оценивания</strong>
                    {task?.max_score != null && <Tag color="gold">{task.max_score} б.</Tag>}
                    {task?.exam_part === 2 && <Tag color="purple">Часть 2</Tag>}
                    {criteriaOverride != null && criteriaOverride !== task?.criteria_md && (
                      <Tag color="processing">⚡ Изменено LLM — сохрани</Tag>
                    )}
                  </Space>
                ),
                children: currentCriteria ? (
                  <div style={{ padding: 12, background: '#fffbe6', borderRadius: 4, border: '1px solid #ffe58f' }}>
                    <TaskStatementRenderer text={currentCriteria} images={taskImages.criteria} />
                  </div>
                ) : (
                  <Alert type="info" message="Критерии не загружены" />
                ),
              }]}
            />
          );
        })()}

        {/* Похожие задачи (sqlite-vec) — только для сохранённых задач */}
        {!isCreateMode && task?.id && (
          <Collapse
            ghost
            style={{ marginBottom: 16 }}
            items={[{
              key: 'similar',
              label: <strong>🔎 Похожие задачи</strong>,
              children: <SimilarTasksPanel taskId={task.id} />,
            }]}
          />
        )}

        {/* Подсказка по LaTeX */}
        <div style={{ fontSize: 12, color: '#666', background: '#fff7e6', padding: 8, borderRadius: 4, border: '1px solid #ffd591' }}>
          <strong>Примеры LaTeX:</strong><br />
          • Степени: <code>x^2</code>, <code>a^{10}</code><br />
          • Дроби: <code>\frac{'{'}a{'}'}{'{'} b{'}'}</code><br />
          • Корни: <code>\sqrt{'{'}x{'}'}</code>, <code>\sqrt[3]{'{'}x{'}'}</code><br />
          • Знаки: <code>\cdot</code> (умножение), <code>\leq</code>, <code>\geq</code><br />
          • Скобки: <code>\left( ... \right)</code>
        </div>
      </Form>

      <CropModal
        open={img.cropModalOpen}
        onCancel={() => img.setCropModalOpen(false)}
        onCropped={handleCropped}
        imageUrl={img.uploadPreviewUrl}
        title="Обрезка изображения"
        messageApi={message}
      />
    </Modal>

    {/* Модал «Перепарсить с Решу ЕГЭ» — вне основного Modal чтобы избежать
        конфликтов z-index и focus-trap. */}
    {task && task.sdamgia_url && (
      <RefreshFromSdamgiaModal
        task={task}
        open={refreshModalOpen}
        onClose={() => setRefreshModalOpen(false)}
        onApplied={() => { onClose?.(); }}
      />
    )}
    </>
  );
};

export default TaskEditModal;
