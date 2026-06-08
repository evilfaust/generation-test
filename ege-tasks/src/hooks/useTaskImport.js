import { useState, useCallback, useRef } from 'react';
import pb, { api } from '../services/pocketbase';
import { parseMarkdownFile, parseSdamgiaResult, getRandomTagColor } from '../utils/markdownTaskParser';
import { rewriteImageUrls } from '../components/TaskStatementRenderer';

const getPdfServiceUrl = () => {
  const envUrl = import.meta.env.VITE_PDF_SERVICE_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

const PDF_SERVICE_URL = getPdfServiceUrl();

/**
 * Хук для импорта задач из markdown файлов.
 * Управляет состоянием парсинга, маппинга на БД и процессом импорта.
 */
export function useTaskImport({ topics = [], tags: existingTags = [], subtopics: existingSubtopics = [] } = {}) {
  const [parsedData, setParsedData] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  // Индексы задач, которые во время импорта нужно дополнительно прогнать
  // через LLM (/latex-fix) — учитель отмечает галочкой «🤖» в превью.
  // По умолчанию пусто: импорт без LLM работает как раньше.
  const [llmTasks, setLlmTasks] = useState(new Set());
  const [topicId, setTopicId] = useState(null);
  const [subtopicId, setSubtopicId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResults, setImportResults] = useState(null);

  // Кэш тегов: title -> id (для избежания повторных запросов)
  const tagCacheRef = useRef(new Map());
  // Ссылка на актуальные теги (обновляется при создании новых)
  const tagsRef = useRef(existingTags);

  // Обновить ссылку на теги при изменении props
  if (existingTags !== tagsRef.current && existingTags.length > 0) {
    tagsRef.current = existingTags;
    // Перестраиваем кэш
    tagCacheRef.current = new Map();
    existingTags.forEach(t => tagCacheRef.current.set(t.title, t.id));
  }

  /**
   * Ищет тему по названию из YAML.
   * Сначала точное совпадение, затем частичное.
   */
  const matchTopic = useCallback((topicName) => {
    if (!topicName || topics.length === 0) return null;

    // Точное совпадение
    const exact = topics.find(t => t.title === topicName);
    if (exact) return exact.id;

    // Частичное совпадение (содержит подстроку)
    const partial = topics.filter(t =>
      t.title.toLowerCase().includes(topicName.toLowerCase()) ||
      topicName.toLowerCase().includes(t.title.toLowerCase())
    );
    if (partial.length === 1) return partial[0].id;

    // Если несколько — вернём null, пользователь выберет сам
    return null;
  }, [topics]);

  /**
   * Ищет подтему по названию для указанной темы.
   */
  const matchSubtopic = useCallback((subtopicName, forTopicId) => {
    if (!subtopicName || !forTopicId) return null;

    const topicSubtopics = existingSubtopics.filter(st => st.topic === forTopicId);
    const exact = topicSubtopics.find(st => st.name === subtopicName);
    if (exact) return exact.id;

    const partial = topicSubtopics.filter(st =>
      st.name.toLowerCase().includes(subtopicName.toLowerCase())
    );
    if (partial.length === 1) return partial[0].id;

    return null;
  }, [existingSubtopics]);

  /**
   * Устанавливает parsedData и автоматически подбирает тему/подтему.
   * Общая логика для handleParse и handleParseSdamgia.
   */
  const applyParsedData = useCallback((result) => {
    setParsedData(result);
    setImportResults(null);

    // Выбираем все задачи с непустым условием
    const selected = new Set();
    result.tasks.forEach((task, i) => {
      if (task.statement_md && task.statement_md.trim()) {
        selected.add(i);
      }
    });
    setSelectedTasks(selected);

    // Автоматический маппинг темы
    const matchedTopicId = matchTopic(result.metadata.topic);
    setTopicId(matchedTopicId);

    // Автоматический маппинг подтемы
    if (matchedTopicId && result.metadata.subtopic) {
      setSubtopicId(matchSubtopic(result.metadata.subtopic, matchedTopicId));
    } else {
      setSubtopicId(null);
    }

    return result;
  }, [matchTopic, matchSubtopic]);

  /**
   * Парсит текст markdown и устанавливает начальное состояние.
   */
  const handleParse = useCallback((text) => {
    const result = parseMarkdownFile(text);
    return applyParsedData(result);
  }, [applyParsedData]);

  /**
   * Парсит результат загрузки с sdamgia.ru.
   * @param {Array} problems — массив от сервера [{ id, condition, answer, images }]
   * @param {Object} sdamgiaMetadata — { taskNumber, subtopic, difficulty, tagsStr }
   */
  const handleParseSdamgia = useCallback((problems, sdamgiaMetadata) => {
    const result = parseSdamgiaResult(problems, sdamgiaMetadata);
    return applyParsedData(result);
  }, [applyParsedData]);

  /**
   * Переключает выбор задачи.
   */
  const toggleTask = useCallback((index) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!parsedData) return;
    const all = new Set();
    parsedData.tasks.forEach((task, i) => {
      if (task.statement_md && task.statement_md.trim()) {
        all.add(i);
      }
    });
    setSelectedTasks(all);
  }, [parsedData]);

  const deselectAll = useCallback(() => {
    setSelectedTasks(new Set());
  }, []);

  /** Переключает «прогнать через LLM» для задачи. */
  const toggleLlmTask = useCallback((index) => {
    setLlmTasks(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  /** Отметить LLM для всех выбранных задач, у которых latex_needs_review. */
  const selectAllLlmNeedsReview = useCallback(() => {
    if (!parsedData) return;
    const set = new Set();
    parsedData.tasks.forEach((task, i) => {
      if (selectedTasks.has(i) && task.latex_needs_review) set.add(i);
    });
    setLlmTasks(set);
  }, [parsedData, selectedTasks]);

  /** Отметить LLM для всех выбранных задач. */
  const selectAllLlm = useCallback(() => {
    setLlmTasks(new Set(selectedTasks));
  }, [selectedTasks]);

  const deselectAllLlm = useCallback(() => {
    setLlmTasks(new Set());
  }, []);

  const fetchImageAsFile = useCallback(async (imageUrl, fileBaseName) => {
    if (!imageUrl) return null;

    const response = await fetch(`${PDF_SERVICE_URL}/fetch-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки изображения: HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || blob.type || 'image/png';
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
      ? 'gif'
      : 'png';

    const safeName = String(fileBaseName || 'task-image').replace(/[^a-zA-Z0-9_-]/g, '_');
    return new File([blob], `${safeName}.${ext}`, { type: contentType });
  }, []);

  /**
   * Получает или создаёт тег по title.
   * Использует кэш для минимизации запросов.
   */
  const getOrCreateTag = async (title) => {
    const trimmed = title.trim();
    if (!trimmed) return null;

    // Проверяем кэш
    if (tagCacheRef.current.has(trimmed)) {
      return tagCacheRef.current.get(trimmed);
    }

    // Ищем через API
    const existing = await api.findTagByTitle(trimmed);
    if (existing) {
      tagCacheRef.current.set(trimmed, existing.id);
      return existing.id;
    }

    // Создаём новый тег
    try {
      const newTag = await api.createTag({
        title: trimmed,
        color: getRandomTagColor(),
      });
      tagCacheRef.current.set(trimmed, newTag.id);
      return newTag.id;
    } catch (e) {
      console.error(`Ошибка создания тега "${trimmed}":`, e);
      return null;
    }
  };

  /**
   * Получает или создаёт подтему.
   */
  const getOrCreateSubtopic = async (name, forTopicId) => {
    if (!name || !forTopicId) return null;

    // Ищем среди существующих
    const topicSubtopics = existingSubtopics.filter(st => st.topic === forTopicId);
    const existing = topicSubtopics.find(st => st.name === name);
    if (existing) return existing.id;

    // Создаём
    try {
      const newSubtopic = await api.createSubtopic({
        name,
        topic: forTopicId,
        order: 0,
      });
      return newSubtopic.id;
    } catch (e) {
      console.error(`Ошибка создания подтемы "${name}":`, e);
      return null;
    }
  };

  /**
   * Основная функция импорта.
   * Последовательно создаёт задачи в PocketBase.
   */
  const handleImport = useCallback(async () => {
    if (!parsedData || !topicId || selectedTasks.size === 0) return null;

    setImporting(true);
    const total = selectedTasks.size;
    setImportProgress({ current: 0, total });

    // Хелпер: прогон одной задачи через LLM (/latex-fix) перед записью в БД.
    // Возвращает новый объект задачи с правленными полями. Любая ошибка LLM —
    // не блокирует импорт, задача уходит в БД с оригинальным текстом + warning.
    const runLlmFixOnTask = async (task) => {
      const fields = ['statement_md', 'solution_md', 'criteria_md'];
      const fixed = { ...task };
      for (const field of fields) {
        if (!task[field]) continue;
        try {
          const resp = await fetch(`${PDF_SERVICE_URL}/latex-fix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: task[field], role: field.replace('_md', '') }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (data.text) fixed[field] = data.text;
        } catch (e) {
          console.warn(`[import] LLM-fix ${field} #${task.number}: ${e.message}`);
        }
      }
      fixed.latex_needs_review = false;
      return fixed;
    };

    const results = { added: 0, skipped: 0, errors: 0, details: [] };

    try {
      // 1. Загружаем существующие данные одним запросом
      const existingRecords = await api.getTaskStatementsAndCodes(topicId);
      const existingStatements = new Set(
        existingRecords.map(r => (r.statement_md || '').trim())
      );

      // 2. Определяем следующий код задачи
      const topic = topics.find(t => t.id === topicId);
      const egeNumber = topic?.ege_number;
      if (!egeNumber && egeNumber !== 0) {
        results.errors = total;
        results.details.push({ status: 'error', message: 'У темы не указан номер ЕГЭ (ege_number)' });
        setImportResults(results);
        setImporting(false);
        return results;
      }

      const prefix = `${egeNumber}-`;
      const existingNumbers = existingRecords
        .map(r => r.code)
        .filter(code => code && code.startsWith(prefix))
        .map(code => {
          const parts = code.split('-');
          return parts.length === 2 ? parseInt(parts[1], 10) : 0;
        })
        .filter(n => !isNaN(n));

      let nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

      // 3. Получаем или создаём подтему
      let importSubtopicId = subtopicId;
      if (!importSubtopicId && parsedData.metadata.subtopic) {
        importSubtopicId = await getOrCreateSubtopic(parsedData.metadata.subtopic, topicId);
      }

      // 4. Импортируем задачи. Сохраняем оригинальный индекс — он нужен для
      // сверки с llmTasks (галочка «🤖» ставится на исходных индексах).
      const tasksToImport = parsedData.tasks
        .map((task, originalIndex) => ({ task, originalIndex }))
        .filter(({ originalIndex }) => selectedTasks.has(originalIndex));

      for (let i = 0; i < tasksToImport.length; i++) {
        let { task, originalIndex } = tasksToImport[i];
        setImportProgress({ current: i + 1, total });

        // Если задача отмечена для LLM-фикса — прогоняем перед сохранением.
        if (llmTasks.has(originalIndex)) {
          task = await runLlmFixOnTask(task);
        }

        // Дедуп №1: по sdamgia_id (надёжнее, чем по тексту — устойчив к мелким правкам)
        if (task.sdamgiaId) {
          const existing = await api.findTaskBySdamgiaId(task.sdamgiaId);
          if (existing) {
            results.skipped++;
            results.details.push({
              status: 'skipped',
              number: task.number,
              message: `#${task.number}: пропущено (sdamgia_id=${task.sdamgiaId} уже в базе)`,
            });
            continue;
          }
        }

        // Дедуп №2: по тексту условия
        if (existingStatements.has(task.statement_md.trim())) {
          results.skipped++;
          results.details.push({
            status: 'skipped',
            number: task.number,
            message: `#${task.number}: пропущено (дубликат по тексту)`,
          });
          continue;
        }

        // Создаём/находим теги
        const tagIds = [];
        for (const tagTitle of task.tags) {
          const tagId = await getOrCreateTag(tagTitle);
          if (tagId) tagIds.push(tagId);
        }

        // Генерируем код
        const code = `${egeNumber}-${String(nextNumber).padStart(3, '0')}`;
        nextNumber++;

        // Загружаем изображение локально (через PDF-сервис), если оно есть
        let imageFile = null;
        if (task.imageUrl) {
          try {
            imageFile = await fetchImageAsFile(task.imageUrl, `task_${code}`);
          } catch (e) {
            results.details.push({
              status: 'warning',
              number: task.number,
              message: `#${task.number}: не удалось скачать изображение, сохранена внешняя ссылка`,
            });
          }
        }

        // Формируем данные задачи
        const recordData = {
          code,
          topic: topicId,
          difficulty: task.difficulty || parsedData.metadata.difficulty || '1',
          statement_md: task.statement_md,
          answer: task.answer || '',
          solution_md: task.solution_md || '',
          explanation_md: '',
          source: parsedData.metadata.source || '',
          year: parsedData.metadata.year || null,
          // Мультикартиночное условие (2+ картинки, напр. «сопоставь график↔формулу»):
          // картинки идут INLINE в statement_md (born-local подменит на локальные),
          // отдельное поле отключаем — иначе первая картинка задвоится.
          has_image: ((task.condition_images?.length || 0) >= 2)
            ? false
            : Boolean(task.imageUrl || imageFile),
          image_url: (imageFile || (task.condition_images?.length || 0) >= 2) ? '' : (task.imageUrl || ''),
          // Поля для ЕГЭ часть 2 (sdamgia). Пустые значения безопасны для части 1.
          sdamgia_id: task.sdamgiaId || '',
          sdamgia_url: task.sdamgia_url || '',
          exam_part: task.exam_part || 1,
          criteria_md: task.criteria_md || '',
          max_score: task.max_score ?? undefined, // undefined → поле не отправится (PB не любит null в number)
          latex_needs_review: !!task.latex_needs_review,
        };

        if (importSubtopicId) {
          recordData.subtopic = [importSubtopicId];
        }

        if (tagIds.length > 0) {
          recordData.tags = tagIds;
        }

        try {
          let payload = recordData;
          if (imageFile) {
            const formData = new FormData();
            Object.entries(recordData).forEach(([key, value]) => {
              if (value === null || value === undefined) return;
              if (Array.isArray(value)) {
                value.forEach((item) => formData.append(key, item));
              } else {
                formData.append(key, value);
              }
            });
            formData.append('image', imageFile);
            payload = formData;
          }

          const createdTask = await api.createTask(payload);
          results.added++;

          // Загрузка картинок задачи в коллекцию task_images по ролям.
          // Делаем это после createTask (нужен id записи); провал по картинкам
          // не откатывает создание задачи — просто warning в логе.
          const imageRoles = [
            ['condition', task.condition_images || []],
            ['solution', task.solution_images || []],
            ['criteria', task.criteria_images || []],
          ];
          let uploadedCount = 0;
          let failedCount = 0;
          const uploadedImages = []; // записи task_images для born-local rewrite
          for (const [role, imgs] of imageRoles) {
            for (const img of imgs) {
              try {
                // Дедуп по (task, role, order): защита от повторного импорта.
                if (img.order != null) {
                  const found = await pb.collection('task_images').getList(1, 1, {
                    filter: `task = "${createdTask.id}" && role = "${role}" && order = ${img.order}`,
                  }).catch(() => ({ items: [] }));
                  if (found.items?.[0]) { uploadedImages.push(found.items[0]); uploadedCount++; continue; }
                }
                // sdamgia блокирует прямые fetch из браузера (DDoS-guard, CORS),
                // поэтому качаем через серверный прокси /fetch-image — он
                // подставит правильный User-Agent + Referer.
                const fileObj = await fetchImageAsFile(
                  img.url,
                  img.file_id || `${role}_${img.order || 1}`
                );
                if (!fileObj) throw new Error('пустой ответ от прокси');
                const rec = await api.createTaskImage({
                  task: createdTask.id,
                  role,
                  order: img.order,
                  fileBlob: fileObj,
                  fileName: fileObj.name,
                  sdamgia_file_id: img.file_id,
                  original_url: img.url,
                });
                if (rec) { uploadedImages.push(rec); uploadedCount++; } else failedCount++;
              } catch (e) {
                console.warn(`[import] img ${img.url}: ${e.message}`);
                failedCount++;
              }
            }
          }

          // «Роды локальными»: сразу переписываем markdown созданной задачи на
          // локальные URL task_images, чтобы НЕ зависеть от sdamgia при рендере/печати.
          if (uploadedImages.length > 0) {
            try {
              const patch = {};
              for (const field of ['statement_md', 'solution_md', 'criteria_md']) {
                const src = createdTask[field];
                if (!src) continue;
                const next = rewriteImageUrls(src, uploadedImages);
                if (next !== src) patch[field] = next;
              }
              if (Object.keys(patch).length > 0) {
                await api.updateTask(createdTask.id, patch);
              }
            } catch (e) {
              console.warn(`[import] born-local rewrite ${createdTask.id}: ${e.message}`);
            }
          }

          let detailMsg = `#${task.number}: добавлено с кодом ${code}`;
          if (uploadedCount) detailMsg += `, картинок: ${uploadedCount}`;
          if (failedCount) detailMsg += ` (не загружено: ${failedCount})`;
          results.details.push({
            status: 'added',
            number: task.number,
            code,
            message: detailMsg,
          });
          // Добавляем в set чтобы не было дублей внутри одного файла
          existingStatements.add(task.statement_md.trim());
        } catch (e) {
          results.errors++;
          results.details.push({
            status: 'error',
            number: task.number,
            message: `#${task.number}: ошибка — ${e.message}`,
          });
        }
      }
    } catch (e) {
      results.errors++;
      results.details.push({
        status: 'error',
        message: `Общая ошибка: ${e.message}`,
      });
    }

    setImportResults(results);
    setImporting(false);
    return results;
  }, [parsedData, topicId, subtopicId, selectedTasks, llmTasks, topics, existingSubtopics, fetchImageAsFile]);

  /**
   * Применить LLM-исправление LaTeX для задачи по индексу.
   * Принимает объект с полями { statement_md?, solution_md?, criteria_md? } —
   * любое подмножество. Сбрасывает latex_needs_review на этой задаче.
   */
  const applyLatexFix = useCallback((index, fixedFields) => {
    setParsedData(prev => {
      if (!prev || !prev.tasks[index]) return prev;
      const newTasks = prev.tasks.map((t, i) => {
        if (i !== index) return t;
        return {
          ...t,
          ...(fixedFields.statement_md !== undefined ? { statement_md: fixedFields.statement_md } : {}),
          ...(fixedFields.solution_md !== undefined ? { solution_md: fixedFields.solution_md } : {}),
          ...(fixedFields.criteria_md !== undefined ? { criteria_md: fixedFields.criteria_md } : {}),
          latex_needs_review: false,
        };
      });
      return { ...prev, tasks: newTasks };
    });
  }, []);

  /**
   * Сброс состояния для нового импорта.
   */
  const reset = useCallback(() => {
    setParsedData(null);
    setSelectedTasks(new Set());
    setLlmTasks(new Set());
    setTopicId(null);
    setSubtopicId(null);
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportResults(null);
  }, []);

  return {
    // Состояние
    parsedData,
    selectedTasks,
    llmTasks,
    topicId,
    subtopicId,
    importing,
    importProgress,
    importResults,

    // Сеттеры
    setTopicId,
    setSubtopicId,

    // Действия
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
  };
}
