import PocketBase from 'pocketbase';
import { shuffleArray } from '../utils/shuffle';
import { escapeFilter } from '../utils/escapeFilter';
import { PB_BASE_URL } from './pocketbaseUrl';

const pb = new PocketBase(PB_BASE_URL);

// Отключаем автоматическое обновление токена для анонимного доступа
pb.autoCancellation(false);

export const api = {
  // Получить все темы (опционально фильтр по exam_type)
  async getTopics(examType = null) {
    try {
      const options = { sort: 'order,ege_number' };
      if (examType) {
        options.filter = `exam_type = "${examType}"`;
      }
      const records = await pb.collection('topics').getFullList(options);
      return records;
    } catch (error) {
      console.error('Error fetching topics:', error);
      return [];
    }
  },

  // Получить темы ЕГЭ базового уровня, отсортированные по ege_number
  async getEgeBaseTopics() {
    try {
      const records = await pb.collection('topics').getFullList({
        filter: 'exam_type = "ege_base"',
        sort: 'ege_number',
      });
      return records;
    } catch (error) {
      console.error('Error fetching ege_base topics:', error);
      return [];
    }
  },

  // Получить темы ЕГЭ профильного уровня, отсортированные по part + ege_number
  async getEgeProfileTopics() {
    try {
      return await pb.collection('topics').getFullList({
        filter: 'exam_type = "ege_profile"',
        sort: 'exam_part,ege_number',
      });
    } catch (error) {
      console.error('Error fetching ege_profile topics:', error);
      return [];
    }
  },

  // Получить темы тригонометрических генераторов
  async getTrigTopics() {
    try {
      return await pb.collection('topics').getFullList({
        filter: 'exam_type = "trig"',
        sort: 'order',
      });
    } catch (error) {
      console.error('Error fetching trig topics:', error);
      return [];
    }
  },

  // Получить тему по ID
  async getTopic(id) {
    try {
      return await pb.collection('topics').getOne(id);
    } catch (error) {
      console.error('Error fetching topic:', error);
      return null;
    }
  },

  // Обновить тему
  async updateTopic(id, data) {
    try {
      return await pb.collection('topics').update(id, data);
    } catch (error) {
      console.error('Error updating topic:', error);
      throw error;
    }
  },

  // Создать тему
  async createTopic(data) {
    try {
      return await pb.collection('topics').create(data);
    } catch (error) {
      console.error('Error creating topic:', error);
      throw error;
    }
  },

  // Получить все теги
  async getTags() {
    try {
      const records = await pb.collection('tags').getFullList({
        sort: 'title',
      });
      return records;
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  },

  // Создать тег
  async createTag(data) {
    try {
      return await pb.collection('tags').create(data);
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  },

  // Обновить тег
  async updateTag(id, data) {
    try {
      return await pb.collection('tags').update(id, data);
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  },

  // Удалить тег
  async deleteTag(id) {
    try {
      return await pb.collection('tags').delete(id);
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  },

  // Получить задачи с фильтрами
  _buildTasksFilter(filters = {}) {
    const filterArr = [];

    if (filters.search) {
      const searchTerm = escapeFilter(filters.search);
      filterArr.push(`(code ~ "${searchTerm}" || statement_md ~ "${searchTerm}")`);
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
      return await pb.collection('tasks').create(data);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  // Обновить задачу
  async updateTask(id, data) {
    try {
      return await pb.collection('tasks').update(id, data);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Удалить задачу
  async deleteTask(id) {
    try {
      return await pb.collection('tasks').delete(id);
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

  // ============ КАРТОЧКИ ============

  // Создать карточку
  async createCard(data) {
    try {
      return await pb.collection('cards').create(data);
    } catch (error) {
      console.error('Error creating card:', error);
      throw error;
    }
  },

  // Получить все карточки
  async getCards() {
    try {
      const records = await pb.collection('cards').getFullList({
        sort: '-created',
        expand: 'tasks,tasks.topic',
      });
      return records;
    } catch (error) {
      console.error('Error fetching cards:', error);
      return [];
    }
  },

  // Получить карточку по ID
  async getCard(id) {
    try {
      return await pb.collection('cards').getOne(id, {
        expand: 'tasks,tasks.topic',
      });
    } catch (error) {
      console.error('Error fetching card:', error);
      return null;
    }
  },

  // Удалить карточку
  async deleteCard(id) {
    try {
      return await pb.collection('cards').delete(id);
    } catch (error) {
      console.error('Error deleting card:', error);
      throw error;
    }
  },

  // Обновить карточку
  async updateCard(id, data) {
    try {
      return await pb.collection('cards').update(id, data);
    } catch (error) {
      console.error('Error updating card:', error);
      throw error;
    }
  },

  // ============ ИМПОРТ ЗАДАЧ ============

  // Поиск тега по title
  async findTagByTitle(title) {
    try {
      const records = await pb.collection('tags').getFullList({
        filter: `title = "${escapeFilter(title)}"`,
      });
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      console.error('Error finding tag:', error);
      return null;
    }
  },

  // Получить statement_md и code всех задач темы (для проверки дубликатов и генерации кодов)
  async getTaskStatementsAndCodes(topicId) {
    try {
      const records = await pb.collection('tasks').getFullList({
        filter: `topic = "${escapeFilter(topicId)}"`,
        fields: 'statement_md,code',
      });
      return records;
    } catch (error) {
      console.error('Error fetching task statements:', error);
      return [];
    }
  },

  // ============ МЕТАДАННЫЕ ============

  // Получить уникальные годы из задач (legacy — используйте getTasksStatsSnapshot + extractYears)
  async getUniqueYears() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'year',
        batch: 500,
      });
      const years = [...new Set(records.map(r => r.year).filter(Boolean))];
      return years.sort((a, b) => b - a); // Сортируем по убыванию
    } catch (error) {
      console.error('Error fetching years:', error);
      return [];
    }
  },

  // Получить уникальные источники из задач (legacy — используйте getTasksStatsSnapshot + extractSources)
  async getUniqueSources() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'source',
        batch: 500,
      });
      const sources = [...new Set(records.map(r => r.source).filter(Boolean))];
      return sources.sort();
    } catch (error) {
      console.error('Error fetching sources:', error);
      return [];
    }
  },

  // Получить лёгкий snapshot задач для статистики (без тяжёлых текстовых полей)
  async getTasksStatsSnapshot() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'id,topic,subtopic,tags,difficulty,has_image,source,year,success_rate',
        batch: 500,
      });
      return records;
    } catch (error) {
      console.error('Error fetching tasks stats snapshot:', error);
      return [];
    }
  },

  // Количество задач с ответом (один лёгкий запрос вместо загрузки всех answer)
  async getWithAnswerCount() {
    try {
      const result = await pb.collection('tasks').getList(1, 1, {
        filter: 'answer != ""',
      });
      return result.totalItems;
    } catch (error) {
      console.error('Error fetching answer count:', error);
      return 0;
    }
  },

  // Количество задач с решением (один лёгкий запрос вместо загрузки всех solution_md)
  async getWithSolutionCount() {
    try {
      const result = await pb.collection('tasks').getList(1, 1, {
        filter: 'solution_md != ""',
      });
      return result.totalItems;
    } catch (error) {
      console.error('Error fetching solution count:', error);
      return 0;
    }
  },

  // Загрузить statement_md для поиска дубликатов (тяжёлый, вызывать лениво)
  async getTasksForDuplicateCheck() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'id,code,statement_md',
        filter: 'statement_md != ""',
        batch: 500,
      });
      return records;
    } catch (error) {
      console.error('Error fetching tasks for duplicate check:', error);
      return [];
    }
  },

  // Получить все подтемы
  async getSubtopics(topicId = null) {
    try {
      const filter = topicId ? `topic = "${escapeFilter(topicId)}"` : '';
      const records = await pb.collection('subtopics').getFullList({
        filter,
        sort: 'order,name',
        expand: 'topic',
      });
      return records;
    } catch (error) {
      console.error('Error fetching subtopics:', error);
      return [];
    }
  },

  // Создать подтему
  async createSubtopic(data) {
    try {
      return await pb.collection('subtopics').create(data);
    } catch (error) {
      console.error('Error creating subtopic:', error);
      throw error;
    }
  },

  // Обновить подтему
  async updateSubtopic(id, data) {
    try {
      return await pb.collection('subtopics').update(id, data);
    } catch (error) {
      console.error('Error updating subtopic:', error);
      throw error;
    }
  },

  // Удалить подтему
  async deleteSubtopic(id) {
    try {
      return await pb.collection('subtopics').delete(id);
    } catch (error) {
      console.error('Error deleting subtopic:', error);
      throw error;
    }
  },

  // ============ РАБОТЫ (WORKS) ============

  // Создать работу
  async createWork(data) {
    try {
      return await pb.collection('works').create(data);
    } catch (error) {
      console.error('Error creating work:', error);
      throw error;
    }
  },

  // Получить все работы
  async getWorks(options = {}) {
    const {
      includeArchived = false,
      archived = false,
      search = '',
      topic = null,
    } = options;

    try {
      const filterArr = [];

      if (!includeArchived) {
        if (archived) {
          filterArr.push('archived = true');
        } else {
          // Если поле archived ещё не проставлено (null), считаем как false
          filterArr.push('(archived = false || archived = null)');
        }
      }

      if (topic) {
        filterArr.push(`topic = "${escapeFilter(topic)}"`);
      }

      if (search) {
        filterArr.push(`title ~ "${escapeFilter(search)}"`);
      }

      const filterString = filterArr.length > 0 ? filterArr.join(' && ') : '';

      const records = await pb.collection('works').getFullList({
        sort: '-created',
        expand: 'topic',
        filter: filterString,
      });
      return records;
    } catch (error) {
      console.error('Error fetching works:', error);
      return [];
    }
  },

  // Получить работу по ID
  async getWork(id) {
    try {
      return await pb.collection('works').getOne(id, {
        expand: 'topic',
      });
    } catch (error) {
      console.error('Error fetching work:', error);
      return null;
    }
  },

  // Удалить работу
  async deleteWork(id) {
    try {
      return await pb.collection('works').delete(id);
    } catch (error) {
      console.error('Error deleting work:', error);
      throw error;
    }
  },

  // Обновить работу
  async updateWork(id, data) {
    try {
      return await pb.collection('works').update(id, data);
    } catch (error) {
      console.error('Error updating work:', error);
      throw error;
    }
  },

  // Архивировать работу
  async archiveWork(id) {
    return this.updateWork(id, { archived: true });
  },

  // Разархивировать работу
  async unarchiveWork(id) {
    return this.updateWork(id, { archived: false });
  },

  // ============ ВАРИАНТЫ (VARIANTS) ============

  // Создать вариант
  async createVariant(data) {
    try {
      return await pb.collection('variants').create(data);
    } catch (error) {
      console.error('Error creating variant:', error);
      throw error;
    }
  },

  // Получить все варианты работы
  async getVariantsByWork(workId) {
    try {
      const records = await pb.collection('variants').getFullList({
        filter: `work = "${escapeFilter(workId)}"`,
        sort: 'number',
        expand: 'tasks,tasks.topic',
      });
      return records;
    } catch (error) {
      console.error('Error fetching variants:', error);
      return [];
    }
  },

  // Получить вариант по ID
  async getVariant(id) {
    try {
      return await pb.collection('variants').getOne(id, {
        expand: 'work,tasks,tasks.topic',
      });
    } catch (error) {
      console.error('Error fetching variant:', error);
      return null;
    }
  },

  // Удалить вариант
  async deleteVariant(id) {
    try {
      return await pb.collection('variants').delete(id);
    } catch (error) {
      console.error('Error deleting variant:', error);
      throw error;
    }
  },

  // Обновить вариант
  async updateVariant(id, data) {
    try {
      return await pb.collection('variants').update(id, data);
    } catch (error) {
      console.error('Error updating variant:', error);
      throw error;
    }
  },

  // ============ ТЕОРИЯ: КАТЕГОРИИ ============

  // Получить все категории теории
  async getTheoryCategories() {
    try {
      const records = await pb.collection('theory_categories').getFullList({
        sort: 'order,title',
      });
      return records;
    } catch (error) {
      console.error('Error fetching theory categories:', error);
      return [];
    }
  },

  // Создать категорию теории
  async createTheoryCategory(data) {
    try {
      return await pb.collection('theory_categories').create(data);
    } catch (error) {
      console.error('Error creating theory category:', error);
      throw error;
    }
  },

  // Обновить категорию теории
  async updateTheoryCategory(id, data) {
    try {
      return await pb.collection('theory_categories').update(id, data);
    } catch (error) {
      console.error('Error updating theory category:', error);
      throw error;
    }
  },

  // Удалить категорию теории
  async deleteTheoryCategory(id) {
    try {
      return await pb.collection('theory_categories').delete(id);
    } catch (error) {
      console.error('Error deleting theory category:', error);
      throw error;
    }
  },

  // ============ ТЕОРИЯ: СТАТЬИ ============

  // Получить статьи теории (только метаданные для списка)
  async getTheoryArticles(filters = {}) {
    try {
      const filterArr = [];

      if (filters.category) {
        filterArr.push(`category = "${escapeFilter(filters.category)}"`);
      }

      if (filters.search) {
        filterArr.push(`title ~ "${escapeFilter(filters.search)}"`);
      }

      if (filters.tags && filters.tags.length > 0) {
        const tagFilters = filters.tags.map(tag => `tags ~ "${escapeFilter(tag)}"`);
        filterArr.push(`(${tagFilters.join(' || ')})`);
      }

      const filterString = filterArr.length > 0 ? filterArr.join(' && ') : '';

      const records = await pb.collection('theory_articles').getFullList({
        filter: filterString,
        fields: 'id,title,category,summary,tags,order,created,updated',
        expand: 'category',
        sort: filters.sort || 'order,title',
      });

      return records;
    } catch (error) {
      console.error('Error fetching theory articles:', error);
      return [];
    }
  },

  // Получить полную статью теории по ID
  async getTheoryArticle(id) {
    try {
      return await pb.collection('theory_articles').getOne(id, {
        expand: 'category',
      });
    } catch (error) {
      console.error('Error fetching theory article:', error);
      return null;
    }
  },

  // Создать статью теории
  async createTheoryArticle(data) {
    try {
      return await pb.collection('theory_articles').create(data);
    } catch (error) {
      console.error('Error creating theory article:', error);
      throw error;
    }
  },

  // Обновить статью теории
  async updateTheoryArticle(id, data) {
    try {
      return await pb.collection('theory_articles').update(id, data);
    } catch (error) {
      console.error('Error updating theory article:', error);
      throw error;
    }
  },

  // Удалить статью теории
  async deleteTheoryArticle(id) {
    try {
      return await pb.collection('theory_articles').delete(id);
    } catch (error) {
      console.error('Error deleting theory article:', error);
      throw error;
    }
  },

  // Получить количество статей по категориям
  async getTheoryArticleCountByCategory() {
    try {
      const records = await pb.collection('theory_articles').getFullList({
        fields: 'category',
      });
      const counts = {};
      records.forEach(r => {
        if (r.category) {
          counts[r.category] = (counts[r.category] || 0) + 1;
        }
      });
      return counts;
    } catch (error) {
      console.error('Error fetching article counts:', error);
      return {};
    }
  },

  // ============ СЕССИИ ВЫДАЧИ (WORK SESSIONS) ============

  async createSession(data) {
    try {
      return await pb.collection('work_sessions').create(data);
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  },

  async getSession(id) {
    try {
      return await pb.collection('work_sessions').getOne(id, {
        expand: 'work',
      });
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  },

  async getSessionByWork(workId) {
    try {
      const records = await pb.collection('work_sessions').getFullList({
        filter: `work = "${escapeFilter(workId)}"`,
        sort: '-created',
      });
      if (records.length === 0) return null;
      if (records.length === 1) return records[0];

      // Если есть дубликаты сессий для одной работы, выбираем сессию
      // с наибольшим числом попыток, затем самую новую.
      const sessionIds = records.map(r => r.id);
      const attempts = await this.getAttemptsBySessions(sessionIds);
      const attemptsBySession = attempts.reduce((acc, attempt) => {
        acc[attempt.session] = (acc[attempt.session] || 0) + 1;
        return acc;
      }, {});

      const sorted = [...records].sort((a, b) => {
        const attemptsA = attemptsBySession[a.id] || 0;
        const attemptsB = attemptsBySession[b.id] || 0;
        if (attemptsA !== attemptsB) return attemptsB - attemptsA;
        return new Date(b.created) - new Date(a.created);
      });

      return sorted[0];
    } catch (error) {
      console.error('Error fetching session by work:', error);
      return null;
    }
  },

  async getSessionsByWork(workId) {
    try {
      return await pb.collection('work_sessions').getFullList({
        filter: `work = "${escapeFilter(workId)}"`,
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching sessions by work:', error);
      return [];
    }
  },

  async getSessionsByWorks(workIds = []) {
    try {
      if (!workIds.length) return [];
      const filter = workIds.map(id => `work = "${escapeFilter(id)}"`).join(' || ');
      return await pb.collection('work_sessions').getFullList({
        filter,
        sort: '-created',
        fields: 'id,work,created',
      });
    } catch (error) {
      console.error('Error fetching sessions by works:', error);
      return [];
    }
  },

  async updateSession(id, data) {
    try {
      return await pb.collection('work_sessions').update(id, data);
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  },

  // ============ ПОПЫТКИ УЧЕНИКОВ (ATTEMPTS) ============

  async createAttempt(data) {
    try {
      return await pb.collection('attempts').create(data);
    } catch (error) {
      console.error('Error creating attempt:', error);
      throw error;
    }
  },

  async getAttemptByDevice(sessionId, deviceId) {
    try {
      const records = await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}" && device_id = "${escapeFilter(deviceId)}"`,
        sort: '-created',
        expand: 'variant,achievement,unlocked_achievements',
      });
      return records.length > 0 ? records[0] : null;
    } catch (error) {
      console.error('Error fetching attempt by device:', error);
      return null;
    }
  },

  async getAttemptsByDevice(sessionId, deviceId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}" && device_id = "${escapeFilter(deviceId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching attempts by device:', error);
      return [];
    }
  },

  async getAttemptsBySession(sessionId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}"`,
        sort: 'student_name,-created',
        expand: 'variant',
      });
    } catch (error) {
      console.error('Error fetching attempts:', error);
      return [];
    }
  },

  async getAttemptsBySessions(sessionIds = []) {
    try {
      if (!sessionIds.length) return [];
      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let i = 0; i < sessionIds.length; i += CHUNK_SIZE) {
        chunks.push(sessionIds.slice(i, i + CHUNK_SIZE));
      }
      const results = await Promise.all(
        chunks.map(chunk => {
          const filter = chunk.map(id => `session = "${escapeFilter(id)}"`).join(' || ');
          return pb.collection('attempts').getFullList({ filter, fields: 'id,session,score,total' });
        })
      );
      return results.flat();
    } catch (error) {
      console.error('Error fetching attempts by sessions:', error);
      return [];
    }
  },

  // Попытки по сессиям с именем ученика (для тепловой карты)
  async getAttemptsBySessionsWithStudent(sessionIds = []) {
    try {
      if (!sessionIds.length) return [];
      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let i = 0; i < sessionIds.length; i += CHUNK_SIZE) {
        chunks.push(sessionIds.slice(i, i + CHUNK_SIZE));
      }
      const results = await Promise.all(
        chunks.map(chunk => {
          const filter = chunk.map(id => `session = "${escapeFilter(id)}"`).join(' || ');
          return pb.collection('attempts').getFullList({
            filter,
            fields: 'id,session,student,student_name,status',
          });
        })
      );
      return results.flat();
    } catch (error) {
      console.error('Error fetching attempts by sessions (with student):', error);
      return [];
    }
  },

  async getAttemptsCountByWork(workId) {
    try {
      const sessions = await this.getSessionsByWork(workId);
      if (sessions.length === 0) return 0;

      const sessionFilters = sessions.map(s => `session = "${escapeFilter(s.id)}"`);
      const filter = sessionFilters.join(' || ');
      const attempts = await pb.collection('attempts').getFullList({
        filter,
        fields: 'id',
      });
      return attempts.length;
    } catch (error) {
      console.error('Error fetching attempts count by work:', error);
      return 0;
    }
  },

  async updateAttempt(id, data) {
    try {
      return await pb.collection('attempts').update(id, data);
    } catch (error) {
      console.error('Error updating attempt:', error);
      throw error;
    }
  },

  async deleteAttempt(id) {
    try {
      return await pb.collection('attempts').delete(id);
    } catch (error) {
      console.error('Error deleting attempt:', error);
      throw error;
    }
  },

  // ============ ОТВЕТЫ НА ЗАДАЧИ (ATTEMPT ANSWERS) ============

  async createAttemptAnswer(data) {
    try {
      return await pb.collection('attempt_answers').create(data);
    } catch (error) {
      console.error('Error creating attempt answer:', error);
      throw error;
    }
  },

  async getAttemptAnswers(attemptId) {
    try {
      return await pb.collection('attempt_answers').getFullList({
        filter: `attempt = "${escapeFilter(attemptId)}"`,
        expand: 'task',
      });
    } catch (error) {
      console.error('Error fetching attempt answers:', error);
      return [];
    }
  },

  // Batch-загрузка ответов для нескольких попыток (для статистики по темам)
  async getAttemptAnswersByAttempts(attemptIds) {
    try {
      if (!attemptIds || !attemptIds.length) return [];
      const CHUNK = 30;
      const results = [];
      for (let i = 0; i < attemptIds.length; i += CHUNK) {
        const chunk = attemptIds.slice(i, i + CHUNK);
        const filter = chunk.map(id => `attempt = "${escapeFilter(id)}"`).join(' || ');
        const records = await pb.collection('attempt_answers').getFullList({
          filter,
          expand: 'task.topic',
          fields: 'id,attempt,task,is_correct,expand',
        });
        results.push(...records);
      }
      return results;
    } catch (error) {
      console.error('Error batch fetching attempt answers:', error);
      return [];
    }
  },

  // Детальная загрузка ответов с полными данными задачи (для анализа проблемных задач учителем)
  async getAttemptAnswersByAttemptsDetailed(attemptIds) {
    try {
      if (!attemptIds || !attemptIds.length) return [];
      const CHUNK = 30;
      const results = [];
      for (let i = 0; i < attemptIds.length; i += CHUNK) {
        const chunk = attemptIds.slice(i, i + CHUNK);
        const filter = chunk.map(id => `attempt = "${escapeFilter(id)}"`).join(' || ');
        const records = await pb.collection('attempt_answers').getFullList({
          filter,
          expand: 'task,task.topic',
        });
        results.push(...records);
      }
      return results;
    } catch (error) {
      console.error('Error batch fetching detailed attempt answers:', error);
      return [];
    }
  },

  async updateAttemptAnswer(id, data) {
    try {
      return await pb.collection('attempt_answers').update(id, data);
    } catch (error) {
      console.error('Error updating attempt answer:', error);
      throw error;
    }
  },

  async batchCreateAttemptAnswers(answers) {
    const results = [];
    const failed = [];
    for (const answer of answers) {
      try {
        const result = await pb.collection('attempt_answers').create(answer);
        results.push(result);
      } catch (error) {
        console.error('Error creating attempt answer:', error);
        if (error?.data) {
          console.error('PocketBase validation errors:', JSON.stringify(error.data));
        }
        failed.push({ answer, error });
      }
    }
    if (failed.length > 0) {
      const err = new Error(`Failed to create ${failed.length} of ${answers.length} attempt answers`);
      err.failed = failed;
      throw err;
    }
    return results;
  },

  async batchUpdateAttemptAnswers(answers) {
    const results = [];
    const failed = [];
    for (const { id, ...data } of answers) {
      try {
        const result = await pb.collection('attempt_answers').update(id, data);
        results.push(result);
      } catch (error) {
        console.error('Error updating attempt answer:', error);
        failed.push({ id, data, error });
      }
    }
    if (failed.length > 0) {
      const err = new Error(`Failed to update ${failed.length} of ${answers.length} attempt answers`);
      err.failed = failed;
      throw err;
    }
    return results;
  },

  // ============ АЧИВКИ (ACHIEVEMENTS) ============

  async getAchievements() {
    try {
      return await pb.collection('achievements').getFullList({
        sort: 'order,title',
      });
    } catch (error) {
      console.error('Error fetching achievements:', error);
      return [];
    }
  },

  async getAchievement(id) {
    try {
      return await pb.collection('achievements').getOne(id);
    } catch (error) {
      console.error('Error fetching achievement:', error);
      return null;
    }
  },

  async getAchievementsByIds(ids = []) {
    try {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) return [];

      const filter = uniqueIds
        .map((id) => `id = "${escapeFilter(id)}"`)
        .join(' || ');

      return await pb.collection('achievements').getFullList({ filter });
    } catch (error) {
      console.error('Error fetching achievements by ids:', error);
      return [];
    }
  },

  async createAchievement(data) {
    try {
      return await pb.collection('achievements').create(data);
    } catch (error) {
      console.error('Error creating achievement:', error);
      throw error;
    }
  },

  async updateAchievement(id, data) {
    try {
      return await pb.collection('achievements').update(id, data);
    } catch (error) {
      console.error('Error updating achievement:', error);
      throw error;
    }
  },

  async deleteAchievement(id) {
    try {
      return await pb.collection('achievements').delete(id);
    } catch (error) {
      console.error('Error deleting achievement:', error);
      throw error;
    }
  },

  async getAttemptsWithAchievements() {
    try {
      return await pb.collection('attempts').getFullList({
        filter: 'achievement != "" || unlocked_achievements:length > 0',
        sort: '-created',
        fields: 'id,student,student_name,achievement,unlocked_achievements,created,score,total',
      });
    } catch (error) {
      console.error('Error fetching attempts with achievements:', error);
      return [];
    }
  },

  // ============ СТУДЕНТЫ (STUDENTS AUTH) ============

  async registerStudent(data) {
    try {
      return await pb.collection('students').create(data);
    } catch (error) {
      console.error('Error registering student:', error);
      throw error;
    }
  },

  async loginStudent(username, password) {
    try {
      return await pb.collection('students').authWithPassword(username, password);
    } catch (error) {
      console.error('Error logging in student:', error);
      throw error;
    }
  },

  async logoutStudent() {
    pb.authStore.clear();
  },

  getAuthStudent() {
    return pb.authStore.model;
  },

  isStudentAuthenticated() {
    return pb.authStore.isValid && pb.authStore.model?.collectionName === 'students';
  },

  async getAttemptsByStudent(sessionId, studentId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}" && student = "${escapeFilter(studentId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching student attempts:', error);
      return [];
    }
  },

  async getAttemptsByStudentAll(studentId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `student = "${escapeFilter(studentId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching all attempts by student:', error);
      return [];
    }
  },

  // Версия с expand session.work.topic — для экрана прогресса студента
  async getAttemptsByStudentAllWithWorks(studentId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `student = "${escapeFilter(studentId)}"`,
        expand: 'achievement,unlocked_achievements,session.work,session.work.topic,session.mc_test',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching all attempts with works by student:', error);
      return [];
    }
  },

  async getAttemptsByDeviceAll(deviceId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `device_id = "${escapeFilter(deviceId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching all attempts by device:', error);
      return [];
    }
  },

  // Версия с expand session.work.topic — для экрана прогресса студента
  async getAttemptsByDeviceAllWithWorks(deviceId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `device_id = "${escapeFilter(deviceId)}"`,
        expand: 'achievement,unlocked_achievements,session.work,session.work.topic,session.mc_test',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching all attempts with works by device:', error);
      return [];
    }
  },

  async getStudents() {
    try {
      return await pb.collection('students').getFullList({
        sort: '-created',
        fields: 'id,username,name,student_class,created,updated',
      });
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  },

  async updateStudent(id, data) {
    try {
      return await pb.collection('students').update(id, data);
    } catch (error) {
      console.error('Error updating student:', error);
      throw error;
    }
  },

  // Объединяет два аккаунта: переносит все попытки fromStudentId → toStudentId,
  // затем удаляет fromStudentId. Выполняется через серверный hook с правами суперпользователя.
  // Возвращает { moved, deletedUsername, targetUsername }.
  async mergeStudents(fromStudentId, toStudentId) {
    const response = await fetch(`${PB_BASE_URL}/api/students/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromStudentId, toStudentId }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  },

  async getAttemptsForRegisteredStudents() {
    try {
      return await pb.collection('attempts').getFullList({
        filter: 'student != ""',
        sort: '-created',
        expand: 'session,session.work,session.mc_test,variant',
      });
    } catch (error) {
      console.error('Error fetching attempts for registered students:', error);
      return [];
    }
  },

  // ─── Geometry Topics ──────────────────────────────────────────────────────

  async getGeometryTopics() {
    try {
      return await pb.collection('geometry_topics').getFullList({ sort: 'order,title' });
    } catch (error) {
      console.error('Error fetching geometry topics:', error);
      return [];
    }
  },

  async createGeometryTopic(data) {
    try {
      return await pb.collection('geometry_topics').create(data);
    } catch (error) {
      console.error('Error creating geometry topic:', error);
      throw error;
    }
  },

  async updateGeometryTopic(id, data) {
    try {
      return await pb.collection('geometry_topics').update(id, data);
    } catch (error) {
      console.error('Error updating geometry topic:', error);
      throw error;
    }
  },

  async deleteGeometryTopic(id) {
    try {
      return await pb.collection('geometry_topics').delete(id);
    } catch (error) {
      console.error('Error deleting geometry topic:', error);
      throw error;
    }
  },

  // ─── Geometry Subtopics ───────────────────────────────────────────────────

  async getGeometrySubtopics(topicId = null) {
    try {
      const filter = topicId ? `topic = "${escapeFilter(topicId)}"` : '';
      return await pb.collection('geometry_subtopics').getFullList({
        filter,
        sort: 'order,title',
        expand: 'topic',
      });
    } catch (error) {
      console.error('Error fetching geometry subtopics:', error);
      return [];
    }
  },

  async createGeometrySubtopic(data) {
    try {
      return await pb.collection('geometry_subtopics').create(data);
    } catch (error) {
      console.error('Error creating geometry subtopic:', error);
      throw error;
    }
  },

  async updateGeometrySubtopic(id, data) {
    try {
      return await pb.collection('geometry_subtopics').update(id, data);
    } catch (error) {
      console.error('Error updating geometry subtopic:', error);
      throw error;
    }
  },

  async deleteGeometrySubtopic(id) {
    try {
      return await pb.collection('geometry_subtopics').delete(id);
    } catch (error) {
      console.error('Error deleting geometry subtopic:', error);
      throw error;
    }
  },

  // ─── Geometry Tasks ───────────────────────────────────────────────────────

  /**
   * Возвращает URL PNG-чертежа задачи (файл из PocketBase storage).
   */
  getGeometryImageUrl(task) {
    const fileName = task?.geogebra_image_base64 || task?.drawing_image || '';

    if (task?.id && fileName && !String(fileName).startsWith('data:image/')) {
      return `${PB_BASE_URL}/api/files/geometry_tasks/${task.id}/${fileName}`;
    }
    // Для in-memory предпросмотра (до сохранения файла) допускаем data:image только из PNG-поля.
    return String(fileName).startsWith('data:image/') ? fileName : '';
  },

  async getGeometryTasks(filters = {}) {
    try {
      const filterArr = [];

      if (filters.topic) {
        filterArr.push(`topic = "${escapeFilter(filters.topic)}"`);
      }
      if (filters.subtopic) {
        filterArr.push(`subtopic = "${escapeFilter(filters.subtopic)}"`);
      }
      if (filters.difficulty) {
        filterArr.push(`difficulty = ${Number(filters.difficulty)}`);
      }
      if (filters.search) {
        const s = escapeFilter(filters.search);
        filterArr.push(`(code ~ "${s}" || title ~ "${s}" || statement_md ~ "${s}")`);
      }

      // Исключаем тяжёлые base64-поля из списка — они перенесены в файловое поле drawing_image.
      // geogebra_base64 (XML состояние, ~30-100KB) нужен только в редакторе → getGeometryTask().
      const LIGHT_FIELDS = [
        'id', 'code', 'title', 'topic', 'subtopic', 'difficulty',
        'statement_md',  // нужен для быстрого предпросмотра
        'answer', 'hints', 'geogebra_appname', 'drawing_view', 'drawing_svg', 'source', 'year',
        'preview_layout', 'geogebra_image_base64', 'drawing_image', 'created', 'updated',
        'expand.topic.id', 'expand.topic.title',
        'expand.subtopic.id', 'expand.subtopic.title',
        // geogebra_base64 (XML состояние, ~30-100KB) только в редакторе → getGeometryTask()
        // solution_md только в редакторе → getGeometryTask()
      ].join(',');

      return await pb.collection('geometry_tasks').getFullList({
        filter: filterArr.join(' && '),
        sort: 'code',
        expand: 'topic,subtopic',
        fields: LIGHT_FIELDS,
      });
    } catch (error) {
      console.error('Error fetching geometry tasks:', error);
      return [];
    }
  },

  async getGeometryTask(id) {
    try {
      // Полная запись со всеми полями (включая geogebra_base64 для редактора)
      return await pb.collection('geometry_tasks').getOne(id, {
        expand: 'topic,subtopic',
      });
    } catch (error) {
      console.error('Error fetching geometry task:', error);
      throw error;
    }
  },

  async createGeometryTask(data) {
    try {
      // PocketBase SDK автоматически создаёт FormData, если data содержит File/Blob.
      // drawing_image передаётся как File-объект из редактора.
      return await pb.collection('geometry_tasks').create(data);
    } catch (error) {
      console.error('Error creating geometry task:', error);
      throw error;
    }
  },

  async updateGeometryTask(id, data) {
    try {
      // Аналогично: если data.drawing_image — File, SDK сам сформирует FormData.
      return await pb.collection('geometry_tasks').update(id, data);
    } catch (error) {
      console.error('Error updating geometry task:', error);
      throw error;
    }
  },

  async duplicateGeometryTask(id) {
    try {
      // Полная запись (включая geogebra_base64 и solution_md)
      const task = await pb.collection('geometry_tasks').getOne(id);

      const formData = new FormData();

      // Текстовые поля — копируем как есть
      const TEXT_FIELDS = [
        'title', 'topic', 'subtopic', 'difficulty', 'statement_md',
        'answer', 'hints', 'geogebra_appname', 'drawing_view', 'drawing_svg',
        'source', 'year', 'preview_layout', 'solution_md', 'geogebra_base64',
      ];
      for (const field of TEXT_FIELDS) {
        if (task[field] != null && task[field] !== '') {
          formData.append(field, task[field]);
        }
      }

      // Код: добавляем суффикс «-копия»
      if (task.code) {
        formData.append('code', task.code + '-копия');
      }

      // Файл чертежа: скачиваем из PocketBase и перезаливаем
      const drawingFileName = task.drawing_image || task.geogebra_image_base64 || '';
      if (drawingFileName && !String(drawingFileName).startsWith('data:image/')) {
        const fileUrl = `${PB_BASE_URL}/api/files/geometry_tasks/${task.id}/${drawingFileName}`;
        try {
          const resp = await fetch(fileUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            formData.append('drawing_image', new File([blob], drawingFileName, { type: blob.type || 'image/png' }));
          }
        } catch {
          // Не смогли скопировать файл — продолжаем без него
        }
      }

      return await pb.collection('geometry_tasks').create(formData);
    } catch (error) {
      console.error('Error duplicating geometry task:', error);
      throw error;
    }
  },

  async deleteGeometryTask(id) {
    try {
      return await pb.collection('geometry_tasks').delete(id);
    } catch (error) {
      console.error('Error deleting geometry task:', error);
      throw error;
    }
  },

  // Импорт геометрических задач в обычные (tasks).
  // Возвращает { added, errors, details[] }.
  async importGeometryTasksToRegular(ids, { topicId, subtopicId } = {}) {
    const results = { added: 0, errors: 0, details: [] };
    for (const id of ids) {
      try {
        const geo = await pb.collection('geometry_tasks').getOne(id);

        const formData = new FormData();
        const TEXT_FIELDS = ['statement_md', 'answer', 'solution_md', 'title', 'source', 'year', 'difficulty'];
        for (const f of TEXT_FIELDS) {
          if (geo[f] != null && geo[f] !== '') formData.append(f, String(geo[f]));
        }
        if (geo.code) formData.append('code', geo.code);
        if (topicId) formData.append('topic', topicId);
        if (subtopicId) formData.append('subtopic', subtopicId);
        formData.append('has_image', 'false');

        // Копируем чертёж как image задачи
        const imgFileName = geo.drawing_image || geo.geogebra_image_base64;
        if (imgFileName && !String(imgFileName).startsWith('data:image/')) {
          const fileUrl = `${PB_BASE_URL}/api/files/geometry_tasks/${geo.id}/${imgFileName}`;
          try {
            const resp = await fetch(fileUrl);
            if (resp.ok) {
              const blob = await resp.blob();
              formData.append('image', new File([blob], imgFileName, { type: blob.type || 'image/png' }));
              formData.set('has_image', 'true');
            }
          } catch {
            // продолжаем без изображения
          }
        }

        await pb.collection('tasks').create(formData);
        results.added++;
        results.details.push({ status: 'added', message: `${geo.code || id} — импортирована` });
      } catch (e) {
        results.errors++;
        results.details.push({ status: 'error', message: `${id}: ${e?.message || 'неизвестная ошибка'}` });
      }
    }
    return results;
  },

  async createGeometryPrintTest(data) {
    try {
      return await pb.collection('geometry_print_tests').create(data);
    } catch (error) {
      console.error('Error creating geometry print test:', error);
      throw error;
    }
  },

  async getGeometryPrintTests() {
    try {
      return await pb.collection('geometry_print_tests').getFullList({
        sort: '-created',
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching geometry print tests:', error);
      return [];
    }
  },

  async getGeometryPrintTest(id) {
    try {
      return await pb.collection('geometry_print_tests').getOne(id, {
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching geometry print test:', error);
      throw error;
    }
  },

  async updateGeometryPrintTest(id, data) {
    try {
      return await pb.collection('geometry_print_tests').update(id, data);
    } catch (error) {
      console.error('Error updating geometry print test:', error);
      throw error;
    }
  },

  async deleteGeometryPrintTest(id) {
    try {
      return await pb.collection('geometry_print_tests').delete(id);
    } catch (error) {
      console.error('Error deleting geometry print test:', error);
      throw error;
    }
  },

  // ==================== ТДФ (Теоремы, Определения, Формулы) ====================

  // --- tdf_sets ---
  async getTdfSets() {
    try {
      return await pb.collection('tdf_sets').getFullList({ sort: 'order,title' });
    } catch (error) {
      console.error('Error fetching tdf_sets:', error);
      return [];
    }
  },

  async getTdfSet(id) {
    try {
      return await pb.collection('tdf_sets').getOne(id);
    } catch (error) {
      console.error('Error fetching tdf_set:', error);
      throw error;
    }
  },

  async createTdfSet(data) {
    try {
      return await pb.collection('tdf_sets').create(data);
    } catch (error) {
      console.error('Error creating tdf_set:', error);
      throw error;
    }
  },

  async updateTdfSet(id, data) {
    try {
      return await pb.collection('tdf_sets').update(id, data);
    } catch (error) {
      console.error('Error updating tdf_set:', error);
      throw error;
    }
  },

  async deleteTdfSet(id) {
    try {
      return await pb.collection('tdf_sets').delete(id);
    } catch (error) {
      console.error('Error deleting tdf_set:', error);
      throw error;
    }
  },

  // --- tdf_items ---
  async getTdfItems(setId) {
    try {
      return await pb.collection('tdf_items').getFullList({
        filter: `tdf_set="${setId}"`,
        sort: 'order',
      });
    } catch (error) {
      console.error('Error fetching tdf_items:', error);
      return [];
    }
  },

  async createTdfItem(data) {
    try {
      return await pb.collection('tdf_items').create(data);
    } catch (error) {
      console.error('Error creating tdf_item:', error);
      throw error;
    }
  },

  async updateTdfItem(id, data) {
    try {
      return await pb.collection('tdf_items').update(id, data);
    } catch (error) {
      console.error('Error updating tdf_item:', error);
      throw error;
    }
  },

  async deleteTdfItem(id) {
    try {
      return await pb.collection('tdf_items').delete(id);
    } catch (error) {
      console.error('Error deleting tdf_item:', error);
      throw error;
    }
  },

  getTdfItemDrawingUrl(item) {
    if (!item?.drawing_image) return null;
    return `${PB_BASE_URL}/api/files/tdf_items/${item.id}/${item.drawing_image}`;
  },

  getTdfItemControlDrawingUrl(item) {
    if (!item?.drawing_image_control) return null;
    return `${PB_BASE_URL}/api/files/tdf_items/${item.id}/${item.drawing_image_control}`;
  },

  // --- tdf_variants ---
  async getTdfVariants(setId) {
    try {
      return await pb.collection('tdf_variants').getFullList({
        filter: `tdf_set="${setId}"`,
        sort: 'number',
      });
    } catch (error) {
      console.error('Error fetching tdf_variants:', error);
      return [];
    }
  },

  async getTdfVariant(id) {
    try {
      return await pb.collection('tdf_variants').getOne(id);
    } catch (error) {
      console.error('Error fetching tdf_variant:', error);
      throw error;
    }
  },

  async createTdfVariant(data) {
    try {
      return await pb.collection('tdf_variants').create(data);
    } catch (error) {
      console.error('Error creating tdf_variant:', error);
      throw error;
    }
  },

  async updateTdfVariant(id, data) {
    try {
      return await pb.collection('tdf_variants').update(id, data);
    } catch (error) {
      console.error('Error updating tdf_variant:', error);
      throw error;
    }
  },

  async deleteTdfVariant(id) {
    try {
      return await pb.collection('tdf_variants').delete(id);
    } catch (error) {
      console.error('Error deleting tdf_variant:', error);
      throw error;
    }
  },

  // --- qr_worksheets ---

  async getQrWorksheets() {
    try {
      return await pb.collection('qr_worksheets').getFullList({
        sort: '-created',
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching qr_worksheets:', error);
      return [];
    }
  },

  async createQrWorksheet(data) {
    try {
      return await pb.collection('qr_worksheets').create(data);
    } catch (error) {
      console.error('Error creating qr_worksheet:', error);
      throw error;
    }
  },

  async updateQrWorksheet(id, data) {
    try {
      return await pb.collection('qr_worksheets').update(id, data);
    } catch (error) {
      console.error('Error updating qr_worksheet:', error);
      throw error;
    }
  },

  async deleteQrWorksheet(id) {
    try {
      return await pb.collection('qr_worksheets').delete(id);
    } catch (error) {
      console.error('Error deleting qr_worksheet:', error);
      throw error;
    }
  },

  // --- pixel_art_worksheets ---

  // Лёгкий список для модала загрузки (без matrix/grid и без expand задач)
  async getPixelArtWorksheets() {
    try {
      return await pb.collection('pixel_art_worksheets').getFullList({
        sort: '-created',
        fields: 'id,title,grid_cols,grid_rows,threshold,two_sheets,show_teacher_key,two_columns,custom_answers,created,tasks',
      });
    } catch (error) {
      console.error('Error fetching pixel_art_worksheets:', error);
      return [];
    }
  },

  // Полная загрузка одной записи (с matrix/grid и expand задач) — вызывается при клике «Загрузить»
  async getPixelArtWorksheet(id) {
    try {
      return await pb.collection('pixel_art_worksheets').getOne(id, {
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching pixel_art_worksheet:', error);
      throw error;
    }
  },

  async createPixelArtWorksheet(data) {
    try {
      return await pb.collection('pixel_art_worksheets').create(data);
    } catch (error) {
      console.error('Error creating pixel_art_worksheet:', error);
      throw error;
    }
  },

  async updatePixelArtWorksheet(id, data) {
    try {
      return await pb.collection('pixel_art_worksheets').update(id, data);
    } catch (error) {
      console.error('Error updating pixel_art_worksheet:', error);
      throw error;
    }
  },

  async deletePixelArtWorksheet(id) {
    try {
      return await pb.collection('pixel_art_worksheets').delete(id);
    } catch (error) {
      console.error('Error deleting pixel_art_worksheet:', error);
      throw error;
    }
  },

  // --- pixel_art_images (library) ---

  async getPixelArtImages() {
    try {
      return await pb.collection('pixel_art_images').getFullList({
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching pixel_art_images:', error);
      return [];
    }
  },

  async createPixelArtImage(data) {
    try {
      return await pb.collection('pixel_art_images').create(data);
    } catch (error) {
      console.error('Error creating pixel_art_image:', error);
      throw error;
    }
  },

  async updatePixelArtImage(id, data) {
    try {
      return await pb.collection('pixel_art_images').update(id, data);
    } catch (error) {
      console.error('Error updating pixel_art_image:', error);
      throw error;
    }
  },

  async deletePixelArtImage(id) {
    try {
      return await pb.collection('pixel_art_images').delete(id);
    } catch (error) {
      console.error('Error deleting pixel_art_image:', error);
      throw error;
    }
  },

  // --- pixel_art_team_sets + pixel_art_team_tiles ---

  async getPixelArtTeamSets() {
    try {
      return await pb.collection('pixel_art_team_sets').getFullList({ sort: '-created' });
    } catch (error) {
      console.error('Error fetching pixel_art_team_sets:', error);
      return [];
    }
  },

  async getPixelArtTeamSet(id) {
    try {
      return await pb.collection('pixel_art_team_sets').getOne(id);
    } catch (error) {
      console.error('Error fetching pixel_art_team_set:', error);
      throw error;
    }
  },

  async getTasksByIds(ids) {
    if (!ids.length) return [];
    try {
      const filter = ids.map(id => `id="${id}"`).join(' || ');
      return await pb.collection('tasks').getFullList({ filter });
    } catch (error) {
      console.error('Error fetching tasks by ids:', error);
      return [];
    }
  },

  async createPixelArtTeamSet(data) {
    try {
      return await pb.collection('pixel_art_team_sets').create(data);
    } catch (error) {
      console.error('Error creating pixel_art_team_set:', error);
      throw error;
    }
  },

  async updatePixelArtTeamSet(id, data) {
    try {
      return await pb.collection('pixel_art_team_sets').update(id, data);
    } catch (error) {
      console.error('Error updating pixel_art_team_set:', error);
      throw error;
    }
  },

  async deletePixelArtTeamSet(id) {
    try {
      return await pb.collection('pixel_art_team_sets').delete(id);
    } catch (error) {
      console.error('Error deleting pixel_art_team_set:', error);
      throw error;
    }
  },

  async getPixelArtTeamTiles(teamSetId) {
    try {
      return await pb.collection('pixel_art_team_tiles').getFullList({
        filter: `team_set="${teamSetId}"`,
        sort: 'tile_index',
      });
    } catch (error) {
      console.error('Error fetching pixel_art_team_tiles:', error);
      return [];
    }
  },

  async upsertPixelArtTeamTile(teamSetId, tileIndex, data) {
    try {
      const existing = await pb.collection('pixel_art_team_tiles').getFirstListItem(
        `team_set="${teamSetId}" && tile_index=${tileIndex}`
      ).catch(() => null);
      if (existing) {
        return await pb.collection('pixel_art_team_tiles').update(existing.id, data);
      }
      return await pb.collection('pixel_art_team_tiles').create({ team_set: teamSetId, tile_index: tileIndex, ...data });
    } catch (error) {
      console.error('Error upserting pixel_art_team_tile:', error);
      throw error;
    }
  },

  // --- route_sheets ---

  async getRouteSheets() {
    try {
      return await pb.collection('route_sheets').getFullList({
        sort: '-created',
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching route_sheets:', error);
      return [];
    }
  },

  async createRouteSheet(data) {
    try {
      return await pb.collection('route_sheets').create(data);
    } catch (error) {
      console.error('Error creating route_sheet:', error);
      throw error;
    }
  },

  async updateRouteSheet(id, data) {
    try {
      return await pb.collection('route_sheets').update(id, data);
    } catch (error) {
      console.error('Error updating route_sheet:', error);
      throw error;
    }
  },

  async deleteRouteSheet(id) {
    try {
      return await pb.collection('route_sheets').delete(id);
    } catch (error) {
      console.error('Error deleting route_sheet:', error);
      throw error;
    }
  },

  // --- unit_circle_worksheets ---

  async getUnitCircleWorksheets() {
    try {
      return await pb.collection('unit_circle_worksheets').getFullList({
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching unit_circle_worksheets:', error);
      return [];
    }
  },

  async createUnitCircleWorksheet(data) {
    try {
      return await pb.collection('unit_circle_worksheets').create(data);
    } catch (error) {
      console.error('Error creating unit_circle_worksheet:', error);
      throw error;
    }
  },

  async updateUnitCircleWorksheet(id, data) {
    try {
      return await pb.collection('unit_circle_worksheets').update(id, data);
    } catch (error) {
      console.error('Error updating unit_circle_worksheet:', error);
      throw error;
    }
  },

  async deleteUnitCircleWorksheet(id) {
    try {
      return await pb.collection('unit_circle_worksheets').delete(id);
    } catch (error) {
      console.error('Error deleting unit_circle_worksheet:', error);
      throw error;
    }
  },

  // --- trig_values_worksheets ---

  async getTrigValuesWorksheets() {
    try {
      return await pb.collection('trig_values_worksheets').getFullList({
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching trig_values_worksheets:', error);
      return [];
    }
  },

  async createTrigValuesWorksheet(data) {
    try {
      return await pb.collection('trig_values_worksheets').create(data);
    } catch (error) {
      console.error('Error creating trig_values_worksheet:', error);
      throw error;
    }
  },

  async updateTrigValuesWorksheet(id, data) {
    try {
      return await pb.collection('trig_values_worksheets').update(id, data);
    } catch (error) {
      console.error('Error updating trig_values_worksheet:', error);
      throw error;
    }
  },

  async deleteTrigValuesWorksheet(id) {
    try {
      return await pb.collection('trig_values_worksheets').delete(id);
    } catch (error) {
      console.error('Error deleting trig_values_worksheet:', error);
      throw error;
    }
  },

  // --- marathons ---

  async getMarathons() {
    try {
      return await pb.collection('marathons').getFullList({
        sort: '-created',
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching marathons:', error);
      return [];
    }
  },

  async getMarathon(id) {
    try {
      return await pb.collection('marathons').getOne(id, { expand: 'tasks' });
    } catch (error) {
      console.error('Error fetching marathon:', error);
      throw error;
    }
  },

  async createMarathon(data) {
    try {
      return await pb.collection('marathons').create(data);
    } catch (error) {
      console.error('Error creating marathon:', error);
      throw error;
    }
  },

  async updateMarathon(id, data) {
    try {
      return await pb.collection('marathons').update(id, data);
    } catch (error) {
      console.error('Error updating marathon:', error);
      throw error;
    }
  },

  async deleteMarathon(id) {
    try {
      return await pb.collection('marathons').delete(id);
    } catch (error) {
      console.error('Error deleting marathon:', error);
      throw error;
    }
  },

  subscribeMarathon(id, callback) {
    return pb.collection('marathons').subscribe(id, callback);
  },

  unsubscribeMarathon(id) {
    return pb.collection('marathons').unsubscribe(id);
  },

  // --- cryptograms ---

  async getCryptograms() {
    try {
      return await pb.collection('cryptograms').getFullList({
        sort: '-created',
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching cryptograms:', error);
      return [];
    }
  },

  async getCryptogram(id) {
    try {
      return await pb.collection('cryptograms').getOne(id, { expand: 'tasks' });
    } catch (error) {
      console.error('Error fetching cryptogram:', error);
      throw error;
    }
  },

  async createCryptogram(data) {
    try {
      return await pb.collection('cryptograms').create(data);
    } catch (error) {
      console.error('Error creating cryptogram:', error);
      throw error;
    }
  },

  async updateCryptogram(id, data) {
    try {
      return await pb.collection('cryptograms').update(id, data);
    } catch (error) {
      console.error('Error updating cryptogram:', error);
      throw error;
    }
  },

  async deleteCryptogram(id) {
    try {
      return await pb.collection('cryptograms').delete(id);
    } catch (error) {
      console.error('Error deleting cryptogram:', error);
      throw error;
    }
  },

  // --- mc_tests (тесты с выбором ответа) ---

  async getMCTests() {
    try {
      return await pb.collection('mc_tests').getFullList({ sort: '-created' });
    } catch (error) {
      console.error('Error fetching mc_tests:', error);
      return [];
    }
  },

  async getMCTest(id) {
    try {
      return await pb.collection('mc_tests').getOne(id);
    } catch (error) {
      console.error('Error fetching mc_test:', error);
      throw error;
    }
  },

  async createMCTest(data) {
    try {
      return await pb.collection('mc_tests').create(data);
    } catch (error) {
      console.error('Error creating mc_test:', error);
      throw error;
    }
  },

  async updateMCTest(id, data) {
    try {
      return await pb.collection('mc_tests').update(id, data);
    } catch (error) {
      console.error('Error updating mc_test:', error);
      throw error;
    }
  },

  async deleteMCTest(id) {
    try {
      return await pb.collection('mc_tests').delete(id);
    } catch (error) {
      console.error('Error deleting mc_test:', error);
      throw error;
    }
  },

  // Получить task-записи по списку id (для рендера mc_test, т.к. task_id хранится в variants.json)
  async getTasksByIds(ids) {
    if (!ids || !ids.length) return [];
    try {
      const unique = [...new Set(ids.filter(Boolean))];
      const filter = unique.map(id => `id = "${id}"`).join(' || ');
      return await pb.collection('tasks').getFullList({ filter, batch: 500 });
    } catch (error) {
      console.error('Error fetching tasks by ids:', error);
      return [];
    }
  },

  // Сессия для mc_test (без поля work)
  async createMCTestSession(mcTestId, extra = {}) {
    try {
      return await pb.collection('work_sessions').create({
        mc_test: mcTestId,
        is_open: true,
        achievements_enabled: true,
        ...extra,
      });
    } catch (error) {
      console.error('Error creating mc_test session:', error);
      throw error;
    }
  },

  async getSessionsByMCTest(mcTestId) {
    try {
      return await pb.collection('work_sessions').getFullList({
        filter: `mc_test = "${mcTestId}"`,
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching sessions by mc_test:', error);
      return [];
    }
  },

  // --- MC-тесты из генераторов: фильтр по generator_type ---

  async getMCTestsByGeneratorType(generatorType) {
    try {
      return await pb.collection('mc_tests').getFullList({
        filter: `source_type = "generator" && generator_type = "${generatorType}"`,
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching mc_tests by generator_type:', error);
      return [];
    }
  },

  // --- Аналитика по MC-тесту ---

  async getMCTestAnalytics(mcTestId) {
    try {
      const sessions = await pb.collection('work_sessions').getFullList({
        filter: `mc_test = "${mcTestId}"`,
        fields: 'id',
      });
      if (!sessions.length) return { attempts: [], answerStats: {} };

      const sessionFilter = sessions.map(s => `session = "${s.id}"`).join(' || ');
      const attempts = await pb.collection('attempts').getFullList({
        filter: `(${sessionFilter}) && status = "submitted"`,
        sort: '-created',
      });
      if (!attempts.length) return { attempts, answerStats: {} };

      const attemptFilter = attempts.map(a => `attempt = "${a.id}"`).join(' || ');
      const answers = await pb.collection('attempt_answers').getFullList({
        filter: attemptFilter,
      });

      const answerStats = {};
      for (const ans of answers) {
        const taskId = ans.task;
        if (!answerStats[taskId]) answerStats[taskId] = { choices: {}, correctCount: 0, total: 0 };
        const key = String(ans.answer_normalized ?? ans.answer_raw ?? '');
        answerStats[taskId].choices[key] = (answerStats[taskId].choices[key] || 0) + 1;
        answerStats[taskId].total++;
        if (ans.is_correct) answerStats[taskId].correctCount++;
      }

      return { attempts, answerStats };
    } catch (error) {
      console.error('Error fetching mc_test analytics:', error);
      return { attempts: [], answerStats: {} };
    }
  },

  // ─── Листы формул ────────────────────────────────────────────────────────────

  async getFormulaSheets() {
    try {
      return await pb.collection('formula_sheets').getFullList({ sort: '-id' });
    } catch (error) {
      console.error('Error fetching formula_sheets:', error);
      return [];
    }
  },

  async getFormulaSheet(id) {
    try {
      return await pb.collection('formula_sheets').getOne(id);
    } catch (error) {
      console.error('Error fetching formula_sheet:', error);
      throw error;
    }
  },

  async createFormulaSheet(data) {
    try {
      return await pb.collection('formula_sheets').create(data);
    } catch (error) {
      console.error('Error creating formula_sheet:', error);
      throw error;
    }
  },

  async updateFormulaSheet(id, data) {
    try {
      return await pb.collection('formula_sheets').update(id, data);
    } catch (error) {
      console.error('Error updating formula_sheet:', error);
      throw error;
    }
  },

  async deleteFormulaSheet(id) {
    try {
      return await pb.collection('formula_sheets').delete(id);
    } catch (error) {
      console.error('Error deleting formula_sheet:', error);
      throw error;
    }
  },
};

export default pb;
