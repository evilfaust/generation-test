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
