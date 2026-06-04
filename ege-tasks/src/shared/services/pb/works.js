import { pb, _logAudit } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const worksApi = {
  // ============ РАБОТЫ (WORKS) ============

  // Создать работу
  async createWork(data) {
    try {
      const rec = await pb.collection('works').create(data);
      _logAudit('create', 'works', rec.id, rec.title);
      return rec;
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
      let summary = id;
      try {
        const w = await pb.collection('works').getOne(id, { fields: 'id,title' });
        summary = w.title || id;
      } catch (_) {}
      const res = await pb.collection('works').delete(id);
      _logAudit('delete', 'works', id, summary);
      return res;
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

};
