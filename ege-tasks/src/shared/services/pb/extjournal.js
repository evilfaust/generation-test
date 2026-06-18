import { pb } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Интеграция ege-journal: ЧТЕНИЕ внешних результатов решу.ЕГЭ (вкладка «Решу» в журнале).
// Запись делает sync из репозитория ege-journal под отдельным sync-аккаунтом.
export const extJournalApi = {
  async getExtExams() {
    try {
      return await pb.collection('ext_journal_exams').getFullList({ sort: '-date' });
    } catch (error) {
      console.error('Error fetching ext exams:', error);
      return [];
    }
  },

  async getExtResults() {
    try {
      return await pb.collection('ext_journal_results').getFullList({ sort: 'student_name' });
    } catch (error) {
      console.error('Error fetching ext results:', error);
      return [];
    }
  },

  // Внешняя решаемость, агрегированная по problem_id (решу-id):
  // { [problem_id]: { c: верных, n: всего } }. Мост problem_id → tasks.sdamgia_id
  // делается выше по стеку (в хуке через api.getTaskIdsBySdamgiaIds).
  // Эти данные менее смещены, чем внутренние (ученики решают на Решу разное),
  // и служат вторым свидетельством решаемости задачи.
  async getExternalTaskStatsByProblem() {
    try {
      const records = await pb.collection('ext_journal_task_results').getFullList({
        fields: 'problem_id,is_correct',
        batch: 1000,
      });
      const byProblem = {};
      for (const r of records) {
        if (!r.problem_id) continue;
        const s = byProblem[r.problem_id] || (byProblem[r.problem_id] = { c: 0, n: 0 });
        s.n += 1;
        if (r.is_correct) s.c += 1;
      }
      return byProblem;
    } catch (error) {
      console.error('Error aggregating external task stats:', error);
      return {};
    }
  },

  // Все потасковые результаты (для тепловой карты по темам/заданиям).
  async getExtTaskResultsAll() {
    try {
      return await pb.collection('ext_journal_task_results').getFullList({ batch: 1000 });
    } catch (error) {
      console.error('Error fetching all ext task results:', error);
      return [];
    }
  },

  // Потасковые результаты по конкретной внешней работе (для разбора по заданиям).
  async getExtTaskResults(examId) {
    try {
      return await pb.collection('ext_journal_task_results').getFullList({
        filter: `exam_id = "${escapeFilter(examId)}"`,
        sort: 'student_name,task_number',
      });
    } catch (error) {
      console.error('Error fetching ext task results:', error);
      return [];
    }
  },
};
