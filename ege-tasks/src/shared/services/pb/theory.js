import { pb, _logAudit } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const theoryApi = {
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
      const rec = await pb.collection('theory_articles').create(data);
      _logAudit('create', 'theory_articles', rec.id, rec.title);
      return rec;
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
      let summary = id;
      try {
        const a = await pb.collection('theory_articles').getOne(id, { fields: 'id,title' });
        summary = a.title || id;
      } catch (_) {}
      const res = await pb.collection('theory_articles').delete(id);
      _logAudit('delete', 'theory_articles', id, summary);
      return res;
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

};
