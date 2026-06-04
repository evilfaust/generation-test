import { pb, _logAudit } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const topicsApi = {
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

  // Получить темы ОГЭ (9 класс), отсортированные по ege_number
  async getOgeTopics() {
    try {
      return await pb.collection('topics').getFullList({
        filter: 'exam_type = "oge"',
        sort: 'ege_number',
      });
    } catch (error) {
      console.error('Error fetching oge topics:', error);
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
};
