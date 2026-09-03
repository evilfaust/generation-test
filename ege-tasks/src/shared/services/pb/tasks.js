import { pb, _logAudit } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';
import { searchCaseVariants, MIN_SEARCH_LENGTH } from '../../utils/searchVariants';
import { parseSdamgiaSearch } from '../../utils/sdamgiaSearch';

export const tasksApi = {
  _buildTasksFilter(filters = {}) {
    const filterArr = [];

    // Поиск по коду, тексту и номеру с «Решу ЕГЭ/ОГЭ». Кириллица в SQLite
    // регистрозависима, поэтому перебираем написания — см. searchCaseVariants.
    const search = String(filters.search || '').trim();
    const sdamgia = parseSdamgiaSearch(search);
    if (sdamgia.exact) {
      // Ссылка или «№ 311151» — по тексту такое искать нечего.
      // `!= ""` обязательно: PocketBase создаёт индекс необязательного поля
      // частичным (WHERE sdamgia_id != ''), а SQLite берёт такой индекс только
      // если это условие есть и в запросе — иначе скан 25 тыс. строк.
      filterArr.push(`(sdamgia_id != "" && sdamgia_id = "${escapeFilter(sdamgia.id)}")`);
    } else if (search.length >= MIN_SEARCH_LENGTH) {
      const conds = searchCaseVariants(search).flatMap((v) => {
        const term = escapeFilter(v);
        return [`code ~ "${term}"`, `statement_md ~ "${term}"`];
      });
      // Голое число могло быть и куском условия — номер решу добавляем как
      // ещё один вариант, а не вместо текстового поиска.
      if (sdamgia.id) conds.push(`sdamgia_id = "${escapeFilter(sdamgia.id)}"`);
      filterArr.push(`(${conds.join(' || ')})`);
    }

    if (filters.topic) {
      filterArr.push(`topic = "${escapeFilter(filters.topic)}"`);
    }

    // Фильтрация по подтеме - это Multiple relation (массив)
    // Используем оператор ~ для проверки наличия ID в массиве
    if (filters.subtopic) {
      filterArr.push(`subtopic ~ "${escapeFilter(filters.subtopic)}"`);
    }

    // Фильтрация по массиву подтем (несколько подтем)
    if (filters.subtopics && filters.subtopics.length > 0) {
      const subtopicFilters = filters.subtopics.map(stId => `subtopic ~ "${escapeFilter(stId)}"`);
      filterArr.push(`(${subtopicFilters.join(' || ')})`);
    }

    // Фильтрация по тегам (несколько тегов)
    if (filters.tags && filters.tags.length > 0) {
      const tagFilters = filters.tags.map(tagId => `tags ~ "${escapeFilter(tagId)}"`);
      filterArr.push(`(${tagFilters.join(' || ')})`);
    }

    if (filters.difficulty) {
      filterArr.push(`difficulty = "${escapeFilter(filters.difficulty)}"`);
    }

    if (filters.hasAnswer !== undefined) {
      filterArr.push(filters.hasAnswer ? `answer != ""` : `answer = ""`);
    }

    if (filters.hasSolution !== undefined) {
      filterArr.push(filters.hasSolution ? `solution_md != ""` : `solution_md = ""`);
    }

    if (filters.hasImage !== undefined) {
      filterArr.push(filters.hasImage ? `has_image = true` : `has_image = false`);
    }

    if (filters.source) {
      filterArr.push(`source ~ "${escapeFilter(filters.source)}"`);
    }

    if (filters.year) {
      filterArr.push(`year = ${Number(filters.year) || 0}`);
    }

    // Фильтрация по контексту (exam_type темы).
    // Для trig дополнительно включаем задачи с source='trig_generator' без темы (легаси).
    if (filters.exam_type) {
      if (filters.exam_type === 'trig') {
        filterArr.push(`(topic.exam_type = "trig" || source = "trig_generator")`);
      } else {
        filterArr.push(`topic.exam_type = "${escapeFilter(filters.exam_type)}"`);
      }
    }

    return filterArr.length > 0 ? filterArr.join(' && ') : '';
  },

  _buildTasksSort(sortBy) {
    switch (sortBy) {
      case 'difficulty':
        return 'difficulty,code';
      case 'created':
        return '-created';
      case 'updated':
        return '-updated';
      case 'code':
      default:
        return 'code';
    }
  },

  async getTasksPage({ page = 1, perPage = 20, filters = {} } = {}) {
    try {
      const filterString = this._buildTasksFilter(filters);
      const sort = this._buildTasksSort(filters.sortBy);

      return await pb.collection('tasks').getList(page, perPage, {
        filter: filterString,
        expand: 'topic,tags,subtopic',
        sort,
      });
    } catch (error) {
      console.error('Error fetching tasks page:', error);
      return {
        items: [],
        page,
        perPage,
        totalItems: 0,
        totalPages: 0,
      };
    }
  },

  async getTasks(filters = {}) {
    try {
      const filterString = this._buildTasksFilter(filters);
      const sort = this._buildTasksSort(filters.sortBy);

      return await pb.collection('tasks').getFullList({
        filter: filterString,
        expand: 'topic,tags,subtopic',
        sort,
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  },

  /**
   * Сюжеты ОГЭ для практического блока заданий 1–5.
   *
   * Задания 1–5 ОГЭ самодостаточны (вводная + план вшиты в текст), но
   * сгруппированы в «сюжеты» через relation tasks.context → task_contexts
   * (один план/ситуация = один контекст). Чтобы собрать связный блок 1–5
   * с ОБЩИМ планом, генератор берёт все 5 заданий из одного сюжета.
   *
   * Возвращает только ПОЛНЫЕ сюжеты (есть хотя бы по одной задаче каждого
   * из номеров 1..5). Внутри — задачи сгруппированы по номеру задания.
   * Поле `title` — название сюжета (из task_contexts) для выбора учителем.
   *
   * @returns {Promise<Array<{ id: string, title: string, byNum: Object<number, Array> }>>}
   */
  async getOgeContextBlocks() {
    try {
      const tasks = await pb.collection('tasks').getFullList({
        filter: 'context != "" && topic.exam_type = "oge"',
        expand: 'topic,context,tags,subtopic',
        sort: 'code',
      });

      const blocks = new Map();
      for (const t of tasks) {
        const num = t.expand?.topic?.ege_number;
        if (!num || num < 1 || num > 5) continue;
        if (!blocks.has(t.context)) {
          blocks.set(t.context, {
            id: t.context,
            title: t.expand?.context?.title || '',
            byNum: {},
          });
        }
        const b = blocks.get(t.context);
        if (!b.title && t.expand?.context?.title) b.title = t.expand.context.title;
        (b.byNum[num] ||= []).push(t);
      }

      // Только полные сюжеты — где есть все номера 1..5
      return [...blocks.values()]
        .filter(b => [1, 2, 3, 4, 5].every(n => (b.byNum[n] || []).length > 0))
        .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
    } catch (error) {
      console.error('Error fetching OGE context blocks:', error);
      return [];
    }
  },

  // Получить случайные задачи
  async getRandomTasks(count, filters = {}) {
    try {
      const allTasks = await this.getTasks(filters);

      // Перемешиваем массив
      const shuffled = shuffleArray(allTasks);

      // Берем первые count элементов
      return shuffled.slice(0, count);
    } catch (error) {
      console.error('Error fetching random tasks:', error);
      return [];
    }
  },

  // Получить задачи БЕЗ ПОВТОРЕНИЙ (исключая уже использованные)
  async getRandomTasksWithoutRepetition(count, filters = {}, excludeTaskIds = []) {
    try {
      const allTasks = await this.getTasks(filters);

      // Фильтруем, исключая уже использованные задачи
      const availableTasks = allTasks.filter(task => !excludeTaskIds.includes(task.id));

      if (availableTasks.length < count) {
        console.warn(`Доступно только ${availableTasks.length} неиспользованных задач из ${count} запрошенных`);
      }

      // Перемешиваем массив
      const shuffled = shuffleArray(availableTasks);

      // Берем первые count элементов
      return shuffled.slice(0, count);
    } catch (error) {
      console.error('Error fetching tasks without repetition:', error);
      return [];
    }
  },

  // Получить задачи с ПРОГРЕССИВНОЙ СЛОЖНОСТЬЮ
  async getTasksWithProgressiveDifficulty(count, filters = {}, excludeTaskIds = []) {
    try {
      const allTasks = await this.getTasks(filters);

      // Фильтруем, исключая уже использованные задачи
      const availableTasks = allTasks.filter(task => !excludeTaskIds.includes(task.id));

      // Группируем задачи по сложности
      const tasksByDifficulty = {
        '1': [],
        '2': [],
        '3': [],
        '4': [],
        '5': []
      };

      availableTasks.forEach(task => {
        const difficulty = task.difficulty || '1';
        if (tasksByDifficulty[difficulty]) {
          tasksByDifficulty[difficulty].push(task);
        }
      });

      // Перемешиваем задачи в каждой группе сложности
      Object.keys(tasksByDifficulty).forEach(diff => {
        tasksByDifficulty[diff] = shuffleArray(tasksByDifficulty[diff]);
      });

      // Рассчитываем распределение по сложности (прогрессивное)
      // Например, для 10 задач: 4 легких, 3 средних, 2 сложных, 1 очень сложная
      const distribution = this._calculateProgressiveDistribution(count);

      // Собираем задачи согласно распределению
      const result = [];
      distribution.forEach(({ difficulty, taskCount }) => {
        const tasks = tasksByDifficulty[difficulty].slice(0, taskCount);
        result.push(...tasks);
      });

      return result;
    } catch (error) {
      console.error('Error fetching tasks with progressive difficulty:', error);
      return [];
    }
  },

  // Вспомогательный метод для расчета прогрессивного распределения
  _calculateProgressiveDistribution(totalCount) {
    // Распределение: 40% сложность 1, 30% сложность 2, 20% сложность 3, 10% сложность 4+5
    const dist = [
      { difficulty: '1', taskCount: Math.ceil(totalCount * 0.4) },
      { difficulty: '2', taskCount: Math.ceil(totalCount * 0.3) },
      { difficulty: '3', taskCount: Math.ceil(totalCount * 0.2) },
      { difficulty: '4', taskCount: Math.ceil(totalCount * 0.07) },
      { difficulty: '5', taskCount: Math.ceil(totalCount * 0.03) }
    ];

    // Корректируем, чтобы сумма была ровно totalCount
    let currentSum = dist.reduce((sum, d) => sum + d.taskCount, 0);
    while (currentSum > totalCount) {
      // Уменьшаем с конца
      for (let i = dist.length - 1; i >= 0 && currentSum > totalCount; i--) {
        if (dist[i].taskCount > 0) {
          dist[i].taskCount--;
          currentSum--;
        }
      }
    }

    return dist.filter(d => d.taskCount > 0);
  },

  // Получить задачу по ID
  async getTask(id) {
    try {
      return await pb.collection('tasks').getOne(id, {
        expand: 'topic,tags,subtopic',
      });
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  },

  // Создать задачу
  async createTask(data) {
    try {
      const rec = await pb.collection('tasks').create(data);
      _logAudit('create', 'tasks', rec.id, rec.code || rec.statement_md?.slice(0, 80));
      return rec;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  // Лёгкий индекс задач темы для поиска дублей при импорте работы целиком
  // (WORK_IMPORT_FORMAT.md). Отличается от getTaskStatementsAndCodes наличием
  // id и answer: найденную задачу нужно не только опознать, но и подставить
  // в вариант вместо создания копии.
  async getTasksForDedup(topicId) {
    if (!topicId) return [];
    try {
      return await pb.collection('tasks').getFullList({
        filter: `topic = "${escapeFilter(topicId)}"`,
        fields: 'id,code,statement_md,answer',
      });
    } catch (error) {
      console.error('Error fetching tasks for dedup:', error);
      return [];
    }
  },

  // Карта sdamgia_id → task.id для набора решу-id (для связки внешних результатов).
  async getTaskIdsBySdamgiaIds(sdamgiaIds = []) {
    const map = {};
    try {
      const ids = [...new Set(sdamgiaIds.map(String).filter(Boolean))];
      if (!ids.length) return map;
      const CHUNK = 40;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        // `!= ""` снаружи — иначе частичный индекс idx_tasks_sdamgia_id не берётся.
        const ors = chunk.map((s) => `sdamgia_id = "${escapeFilter(s)}"`).join(' || ');
        const filter = `sdamgia_id != "" && (${ors})`;
        const recs = await pb.collection('tasks').getFullList({ filter, fields: 'id,sdamgia_id' });
        for (const r of recs) if (r.sdamgia_id) map[r.sdamgia_id] = r.id;
      }
    } catch (error) {
      console.error('Error mapping sdamgia ids:', error);
    }
    return map;
  },

  // Обновить задачу
  async updateTask(id, data) {
    try {
      const rec = await pb.collection('tasks').update(id, data);
      _logAudit('update', 'tasks', rec.id, rec.code || rec.statement_md?.slice(0, 80));
      return rec;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Удалить задачу
  async deleteTask(id) {
    try {
      // Заранее получаем code для журнала (после delete уже не достанем).
      let summary = id;
      try {
        const t = await pb.collection('tasks').getOne(id, { fields: 'id,code' });
        summary = t.code || id;
      } catch (_) {}
      const res = await pb.collection('tasks').delete(id);
      _logAudit('delete', 'tasks', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  // Удалить задачу принудительно: сначала убрать из всех связанных записей
  async forceDeleteTask(taskId) {
    const refs = [
      'variants',
      'cards',
      'qr_worksheets',
      'pixel_art_worksheets',
      'marathons',
    ];
    for (const col of refs) {
      try {
        const records = await pb.collection(col).getFullList({
          filter: `tasks ~ "${taskId}"`,
        });
        for (const rec of records) {
          const ids = Array.isArray(rec.tasks) ? rec.tasks : [];
          const next = ids.filter(id => id !== taskId);
          try {
            await pb.collection(col).update(rec.id, { tasks: next });
          } catch {
            // если поле обязательно и стало пустым — удаляем всю запись
            try { await pb.collection(col).delete(rec.id); } catch {}
          }
        }
      } catch {}
    }
    return await pb.collection('tasks').delete(taskId);
  },

  // Получить URL изображения
  getImageUrl(record, filename) {
    return pb.files.getUrl(record, filename);
  },

  // Получить универсальный URL изображения задачи (локальный файл или внешний URL)
  getTaskImageUrl(task) {
    if (!task) return '';
    if (task.image_url) return task.image_url;
    if (task.image) return pb.files.getUrl(task, task.image);
    return '';
  },

  // ============ ИЗОБРАЖЕНИЯ ЗАДАЧ (task_images, для ЕГЭ часть 2) ============

  /**
   * Получить все картинки задачи, сгруппированные по ролям и упорядоченные.
   * Возвращает { condition: [rec, ...], solution: [...], criteria: [...] }.
   */
  async getTaskImages(taskId) {
    if (!taskId) return { condition: [], solution: [], criteria: [] };
    try {
      const items = await pb.collection('task_images').getFullList({
        filter: `task = "${taskId}"`,
        sort: 'role,order',
      });
      const grouped = { condition: [], solution: [], criteria: [] };
      for (const it of items) {
        const role = it.role || 'condition';
        if (!grouped[role]) grouped[role] = [];
        grouped[role].push(it);
      }
      return grouped;
    } catch (error) {
      console.error('Error fetching task_images:', error);
      return { condition: [], solution: [], criteria: [] };
    }
  },

  /**
   * URL файла из task_images record. role/order игнорируются — берём `file` напрямую.
   */
  getTaskImageRecordUrl(record) {
    if (!record || !record.file) return '';
    return pb.files.getUrl(record, record.file);
  },

  /**
   * Поиск задачи по sdamgia_id — для идемпотентности импорта.
   * Возвращает запись или null.
   */
  async findTaskBySdamgiaId(sdamgiaId) {
    if (!sdamgiaId) return null;
    try {
      const safe = String(sdamgiaId).replace(/"/g, '');
      const items = await pb.collection('tasks').getList(1, 1, {
        filter: `sdamgia_id != "" && sdamgia_id = "${safe}"`,
      });
      return items.items[0] || null;
    } catch (error) {
      console.error('Error finding task by sdamgia_id:', error);
      return null;
    }
  },

  /**
   * Создать запись task_images. `fileBlob` — File или Blob с изображением.
   * Поля null/undefined опускаются (PB не принимает null в text/url).
   */
  async createTaskImage({ task, role, order, fileBlob, fileName, sdamgia_file_id, original_url, width, height }) {
    if (!task) throw new Error('createTaskImage: task обязателен');
    const fd = new FormData();
    fd.append('task', task);
    fd.append('role', role || 'condition');
    if (order != null) fd.append('order', String(order));
    if (fileBlob) {
      const name = fileName || `img_${role}_${order || 1}.png`;
      const file = fileBlob instanceof File ? fileBlob : new File([fileBlob], name, { type: fileBlob.type || 'image/png' });
      fd.append('file', file);
    }
    if (sdamgia_file_id) fd.append('sdamgia_file_id', String(sdamgia_file_id));
    if (original_url) fd.append('original_url', original_url);
    if (width != null) fd.append('width', String(width));
    if (height != null) fd.append('height', String(height));
    try {
      return await pb.collection('task_images').create(fd);
    } catch (error) {
      console.error('Error creating task_image:', error);
      throw error;
    }
  },

  /**
   * Удалить запись task_images. Каскад не нужен — это лист дерева.
   */
  async deleteTaskImage(id) {
    try {
      return await pb.collection('task_images').delete(id);
    } catch (error) {
      console.error('Error deleting task_image:', error);
      throw error;
    }
  },

  /**
   * Скачать картинку с внешнего URL и залить в task_images.
   * Возвращает созданную запись или null при ошибке.
   * Идемпотентность по sdamgia_file_id — если запись для этой (task, file_id) уже
   * существует, она НЕ создаётся повторно (возвращается существующая).
   */
  async uploadTaskImageFromUrl({ task, role, order, url, sdamgia_file_id }) {
    if (!task || !url) return null;
    try {
      // Дедуп по (task, role, order): защита от повторного импорта той же задачи.
      // Не дедупим по file_id — одна и та же картинка sdamgia может встретиться
      // в задаче на разных позициях (напр., чертёж и в условии, и в решении,
      // или один чертёж дважды в длинном решении).
      if (order != null) {
        const found = await pb.collection('task_images').getList(1, 1, {
          filter: `task = "${task}" && role = "${role}" && order = ${order}`,
        });
        if (found.items[0]) return found.items[0];
      }

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      // Имя файла из URL (?id=145381 → 145381.png)
      const idMatch = String(url).match(/[?&]id=(\d+)/);
      const ext = (blob.type || '').includes('svg') ? 'svg'
                 : (blob.type || '').includes('jpeg') ? 'jpg'
                 : 'png';
      const fileName = `${sdamgia_file_id || idMatch?.[1] || `img_${role}_${order}`}.${ext}`;

      return await this.createTaskImage({
        task,
        role,
        order,
        fileBlob: blob,
        fileName,
        sdamgia_file_id,
        original_url: url,
      });
    } catch (error) {
      console.error(`Error uploading image from ${url}:`, error);
      return null;
    }
  },

};
