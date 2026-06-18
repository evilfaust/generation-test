import { pb, _logAudit } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const answersApi = {
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

  // Внутренняя статистика решаемости по каждой задаче (для колонки «Успеваемость»).
  // Один лёгкий проход по всем attempt_answers (fields task,is_correct) →
  // { [taskId]: { c: верных, n: всего } }. Задачи без ответов в карту не попадают
  // (на фронте это трактуется как «нет данных», в отличие от фейкового success_rate=0).
  async getInternalTaskStats() {
    try {
      const records = await pb.collection('attempt_answers').getFullList({
        fields: 'task,is_correct',
        batch: 500,
      });
      const byTask = {};
      for (const r of records) {
        if (!r.task) continue;
        const s = byTask[r.task] || (byTask[r.task] = { c: 0, n: 0 });
        s.n += 1;
        if (r.is_correct) s.c += 1;
      }
      return byTask;
    } catch (error) {
      console.error('Error fetching internal task stats:', error);
      return {};
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

};
