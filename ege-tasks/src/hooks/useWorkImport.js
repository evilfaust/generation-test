/**
 * Импорт работы целиком из `.md` (формат — WORK_IMPORT_FORMAT.md).
 *
 * Отвечает за сетевую часть: подбор дублей в базе, создание задач с картинками,
 * создание работы с вариантами и порядком задач, загрузка фото оригинала.
 * Чистая логика разбора и плана — в utils/workImportFormat.js и
 * utils/workImportPlan.js (покрыты юнит-тестами).
 */

import { useCallback, useState } from 'react';
import { api } from '../services/pocketbase';
import { parseWorkMarkdown, removeImagePlaceholder } from '../utils/workImportFormat';
import {
  buildImportRows,
  applyDuplicates,
  findInternalDuplicates,
} from '../utils/workImportPlan';
import { taskCodePrefix, nextCodeFromCodes } from '../utils/taskCodeGenerator';
import { katexDiagnostics } from '../utils/katexLint';
import { rewriteImageUrls } from '../components/TaskStatementRenderer';

/** PocketBase не принимает null в number-полях — такие ключи не отправляем. */
function toFormData(data, imageFile) {
  const fd = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) value.forEach((item) => fd.append(key, item));
    else fd.append(key, value);
  });
  if (imageFile) fd.append('image', imageFile);
  return fd;
}

const hasBrokenLatex = (text) => katexDiagnostics(text || '').some((d) => d.severity === 'error');

export function useWorkImport({ topics = [], subtopics = [] } = {}) {
  const [parsed, setParsed] = useState(null);
  const [rows, setRows] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [result, setResult] = useState(null);

  /** Разбор текста файла → строки плана (темы подбираются автоматически). */
  const parse = useCallback((text) => {
    const data = parseWorkMarkdown(text);
    const nextRows = buildImportRows(data, { topics, subtopics });
    const internal = findInternalDuplicates(nextRows);
    setParsed({ ...data, internalDuplicates: internal });
    setRows(nextRows);
    setResult(null);
    return { ...data, internalDuplicates: internal, rows: nextRows };
  }, [topics, subtopics]);

  const updateRow = useCallback((key, patch) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }, []);

  /** Массовое назначение темы: «поставить эту тему всем задачам без темы». */
  const setTopicForRows = useCallback((keys, topicId) => {
    const keySet = new Set(keys);
    setRows((prev) => prev.map((row) => (keySet.has(row.key) ? { ...row, topicId, subtopicId: null } : row)));
  }, []);

  /**
   * Поиск дублей: задачи назначенных тем читаются лёгким запросом
   * (id/code/statement/answer) и сравниваются нормализованным текстом.
   */
  const scanDuplicates = useCallback(async () => {
    const topicIds = [...new Set(rows.filter((r) => r.mode !== 'skip' && r.topicId).map((r) => r.topicId))];
    if (topicIds.length === 0) return { checked: 0, found: 0 };

    setScanning(true);
    try {
      const byTopic = new Map();
      for (const topicId of topicIds) {
        byTopic.set(topicId, await api.getTasksForDedup(topicId));
      }
      const next = applyDuplicates(rows, byTopic);
      setRows(next);
      return { checked: topicIds.length, found: next.filter((r) => r.duplicate).length };
    } finally {
      setScanning(false);
    }
  }, [rows]);

  /**
   * Создание задач, работы и вариантов.
   *
   * @param {object} params
   * @param {object} params.workMeta — { title, classNumber, timeLimit, source }
   * @param {object} params.placeholderFiles — { 'рис1': File }
   * @param {Array}  params.originalFiles — фото/скан оригинала работы
   */
  const runImport = useCallback(async ({ workMeta = {}, placeholderFiles = {}, originalFiles = [] } = {}) => {
    const activeRows = rows.filter((row) => row.mode !== 'skip');
    if (activeRows.length === 0) throw new Error('Нет задач для импорта');

    setImporting(true);
    const warnings = [];
    const stats = { created: 0, reused: 0, images: 0, failed: 0 };
    const taskIdByRow = new Map();

    try {
      // 1. Коды задач: по одному запросу на тему, дальше счётчик крутится локально
      setProgress({ current: 0, total: activeRows.length, label: 'Читаю темы' });
      const codeState = new Map();
      const createTopicIds = [...new Set(activeRows.filter((r) => r.mode === 'create').map((r) => r.topicId))];
      for (const topicId of createTopicIds) {
        const topic = topics.find((t) => t.id === topicId) || await api.getTopic(topicId);
        const existing = await api.getTasksForDedup(topicId);
        codeState.set(topicId, {
          topic,
          prefix: taskCodePrefix(topic),
          codes: existing.map((t) => t.code).filter(Boolean),
        });
      }

      // 2. Задачи
      const tagCache = new Map();
      const subtopicCache = new Map();

      for (let i = 0; i < activeRows.length; i++) {
        const row = activeRows[i];
        const task = row.task;
        const label = `Вариант ${row.variantNumber}, задача ${task.number || row.position + 1}`;
        setProgress({ current: i + 1, total: activeRows.length, label });

        // Переиспользование найденного дубля
        if (row.mode === 'reuse' && row.reuseTaskId) {
          taskIdByRow.set(row.key, row.reuseTaskId);
          stats.reused += 1;
          continue;
        }

        // Задача из «Решу ЕГЭ» уже может быть в базе — надёжнее текста
        if (task.sdamgiaId) {
          const found = await api.findTaskBySdamgiaId(task.sdamgiaId).catch(() => null);
          if (found) {
            taskIdByRow.set(row.key, found.id);
            stats.reused += 1;
            continue;
          }
        }

        const state = codeState.get(row.topicId);
        if (!state) {
          warnings.push(`${label}: не выбрана тема — задача пропущена`);
          stats.failed += 1;
          continue;
        }

        const code = nextCodeFromCodes(state.codes, state.prefix);
        state.codes.push(code);

        // Теги
        const tagIds = [];
        for (const title of task.tags || []) {
          const id = await api.getOrCreateTag(title, tagCache);
          if (id) tagIds.push(id);
        }

        // Подтема: выбранная в мастере либо новая из файла
        let subtopicId = row.subtopicId;
        if (!subtopicId && row.newSubtopicName) {
          const cacheKey = `${row.topicId}|${row.newSubtopicName}`;
          if (subtopicCache.has(cacheKey)) subtopicId = subtopicCache.get(cacheKey);
          else {
            subtopicId = await api.getOrCreateSubtopic(row.newSubtopicName, row.topicId, subtopics);
            subtopicCache.set(cacheKey, subtopicId);
          }
        }

        // Чертежи: ключи плейсхолдеров, к которым учитель приложил файлы
        const conditionKeys = (task.images || [])
          .filter((img) => img.role === 'condition' && placeholderFiles[img.key])
          .map((img) => img.key);
        const solutionKeys = (task.images || [])
          .filter((img) => img.role === 'solution' && placeholderFiles[img.key])
          .map((img) => img.key);

        (task.images || []).forEach((img) => {
          if (!placeholderFiles[img.key]) warnings.push(`${label}: к плейсхолдеру «${img.key}» не приложен файл`);
        });

        // Одна картинка условия → legacy-поле tasks.image: именно оно рисуется
        // в карточках и печати. Две и больше — только task_images + inline-ссылки.
        const useLegacyImage = conditionKeys.length === 1;
        let statementMd = task.statement_md;
        if (useLegacyImage) statementMd = removeImagePlaceholder(statementMd, conditionKeys[0]);

        const recordData = {
          code,
          topic: row.topicId,
          difficulty: task.difficulty || '1',
          statement_md: statementMd,
          answer: task.answer || '',
          solution_md: task.solution_md || '',
          criteria_md: task.criteria_md || '',
          explanation_md: task.explanation_md || '',
          source: workMeta.source || task.source || '',
          year: task.year ?? undefined,
          exam_part: task.examPart || 1,
          max_score: task.maxScore ?? undefined,
          sdamgia_id: task.sdamgiaId || '',
          has_image: useLegacyImage,
          latex_needs_review: hasBrokenLatex(statementMd) || hasBrokenLatex(task.solution_md),
        };
        if (subtopicId) recordData.subtopic = [subtopicId];
        if (tagIds.length) recordData.tags = tagIds;

        try {
          const imageFile = useLegacyImage ? placeholderFiles[conditionKeys[0]] : null;
          const created = imageFile
            ? await api.createTask(toFormData(recordData, imageFile))
            : await api.createTask(recordData);

          taskIdByRow.set(row.key, created.id);
          stats.created += 1;
          if (imageFile) stats.images += 1;

          // Остальные чертежи — в task_images. `original_url` = ключ плейсхолдера,
          // по нему rewriteImageUrls подменит ссылку на локальную.
          const uploaded = [];
          const upload = async (keys, role) => {
            for (let idx = 0; idx < keys.length; idx++) {
              const key = keys[idx];
              try {
                const record = await api.createTaskImage({
                  task: created.id,
                  role,
                  order: idx + 1,
                  fileBlob: placeholderFiles[key],
                  fileName: placeholderFiles[key]?.name || `${role}_${idx + 1}.png`,
                  original_url: key,
                });
                if (record) { uploaded.push(record); stats.images += 1; }
              } catch (e) {
                warnings.push(`${label}: не удалось загрузить «${key}» (${e.message})`);
              }
            }
          };
          if (!useLegacyImage) await upload(conditionKeys, 'condition');
          await upload(solutionKeys, 'solution');

          // «Роды локальными»: ссылки в markdown сразу указывают на файлы в PB,
          // чтобы рендер и печать не зависели от исходных плейсхолдеров.
          if (uploaded.length) {
            const patch = {};
            const newStatement = rewriteImageUrls(statementMd, uploaded);
            if (newStatement !== statementMd) patch.statement_md = newStatement;
            const newSolution = rewriteImageUrls(task.solution_md || '', uploaded);
            if (task.solution_md && newSolution !== task.solution_md) patch.solution_md = newSolution;
            if (Object.keys(patch).length) await api.updateTask(created.id, patch).catch(() => null);
          }
        } catch (e) {
          console.error('[work-import] createTask:', e);
          warnings.push(`${label}: не удалось создать задачу (${e.message})`);
          stats.failed += 1;
        }
      }

      // 3. Работа и варианты
      setProgress({ current: activeRows.length, total: activeRows.length, label: 'Сохраняю работу' });

      // Тема работы — самая частая среди её задач (в карточке работы и фильтрах
      // показывается одна тема, задачи при этом остаются в своих).
      const topicCounts = new Map();
      activeRows.forEach((row) => {
        if (!row.topicId) return;
        topicCounts.set(row.topicId, (topicCounts.get(row.topicId) || 0) + 1);
      });
      const mainTopic = [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      const work = await api.createWork({
        title: workMeta.title || parsed?.work?.title || 'Импортированная работа',
        class: workMeta.classNumber ?? parsed?.work?.classNumber ?? undefined,
        topic: mainTopic,
        time_limit: workMeta.timeLimit ?? parsed?.work?.timeLimit ?? undefined,
        source: workMeta.source || parsed?.work?.source || '',
        import_meta: {
          imported_at: new Date().toISOString(),
          format: 'work-md',
          tasks_created: stats.created,
          tasks_reused: stats.reused,
          tasks_failed: stats.failed,
          instructions: parsed?.work?.instructions || '',
          parse_warnings: (parsed?.warnings || []).slice(0, 50),
          import_warnings: warnings.slice(0, 50),
        },
      });

      const variantNumbers = [...new Set(activeRows.map((row) => row.variantNumber))].sort((a, b) => a - b);
      for (const number of variantNumbers) {
        const variantRows = activeRows
          .filter((row) => row.variantNumber === number && taskIdByRow.has(row.key))
          .sort((a, b) => a.position - b.position);
        if (variantRows.length === 0) continue;

        await api.createVariant({
          work: work.id,
          number,
          tasks: variantRows.map((row) => taskIdByRow.get(row.key)),
          order: variantRows.map((row, idx) => ({ taskId: taskIdByRow.get(row.key), position: idx })),
        });
      }

      // 4. Оригинал работы (фото/скан листка)
      if (originalFiles.length) {
        const uploaded = await api.uploadWorkOriginals(work.id, originalFiles);
        if (!uploaded) warnings.push('Не удалось прикрепить фото оригинала — работа и задачи сохранены');
      }

      const summary = { work, ...stats, variants: variantNumbers.length, warnings };
      setResult(summary);
      return summary;
    } finally {
      setImporting(false);
    }
  }, [rows, topics, subtopics, parsed]);

  const reset = useCallback(() => {
    setParsed(null);
    setRows([]);
    setResult(null);
    setProgress({ current: 0, total: 0, label: '' });
  }, []);

  return {
    parsed,
    rows,
    scanning,
    importing,
    progress,
    result,
    parse,
    updateRow,
    setTopicForRows,
    scanDuplicates,
    runImport,
    reset,
  };
}
