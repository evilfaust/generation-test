import PocketBase from 'pocketbase';

const pb = new PocketBase(import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8090');

// Отключаем автоматическое обновление токена для анонимного доступа
pb.autoCancellation(false);

export const api = {
  // Получить все темы
  async getTopics() {
    try {
      const records = await pb.collection('topics').getFullList({
        sort: 'order,ege_number',
      });
      return records;
    } catch (error) {
      console.error('Error fetching topics:', error);
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

  // Получить задачи с фильтрами
  async getTasks(filters = {}) {
    try {
      const filterArr = [];

      if (filters.topic) {
        filterArr.push(`topic = "${filters.topic}"`);
      }

      // Фильтрация по подтеме - это Multiple relation (массив)
      // Используем оператор ~ для проверки наличия ID в массиве
      if (filters.subtopic) {
        filterArr.push(`subtopic ~ "${filters.subtopic}"`);
      }

      if (filters.difficulty) {
        filterArr.push(`difficulty = "${filters.difficulty}"`);
      }

      if (filters.hasAnswer !== undefined) {
        filterArr.push(filters.hasAnswer ? `answer != ""` : `answer = ""`);
      }

      if (filters.hasSolution !== undefined) {
        filterArr.push(filters.hasSolution ? `solution_md != ""` : `solution_md = ""`);
      }

      if (filters.source) {
        filterArr.push(`source ~ "${filters.source}"`);
      }

      if (filters.year) {
        filterArr.push(`year = ${filters.year}`);
      }

      const filterString = filterArr.length > 0 ? filterArr.join(' && ') : '';

      const records = await pb.collection('tasks').getFullList({
        filter: filterString,
        expand: 'topic,tags,subtopic',
        sort: filters.sort || 'code',
      });

      return records;
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
      const shuffled = [...allTasks].sort(() => Math.random() - 0.5);
      
      // Берем первые count элементов
      return shuffled.slice(0, count);
    } catch (error) {
      console.error('Error fetching random tasks:', error);
      return [];
    }
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

  // Обновить задачу
  async updateTask(id, data) {
    try {
      return await pb.collection('tasks').update(id, data);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Получить URL изображения
  getImageUrl(record, filename) {
    return pb.files.getUrl(record, filename);
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

  // ============ МЕТАДАННЫЕ ============

  // Получить уникальные годы из задач
  async getUniqueYears() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'year',
      });
      const years = [...new Set(records.map(r => r.year).filter(Boolean))];
      return years.sort((a, b) => b - a); // Сортируем по убыванию
    } catch (error) {
      console.error('Error fetching years:', error);
      return [];
    }
  },

  // Получить уникальные источники из задач
  async getUniqueSources() {
    try {
      const records = await pb.collection('tasks').getFullList({
        fields: 'source',
      });
      const sources = [...new Set(records.map(r => r.source).filter(Boolean))];
      return sources.sort();
    } catch (error) {
      console.error('Error fetching sources:', error);
      return [];
    }
  },

  // Получить все подтемы
  async getSubtopics(topicId = null) {
    try {
      const filter = topicId ? `topic = "${topicId}"` : '';
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
  async getWorks() {
    try {
      const records = await pb.collection('works').getFullList({
        sort: '-created',
        expand: 'topic',
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
        filter: `work = "${workId}"`,
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
};

export default pb;

