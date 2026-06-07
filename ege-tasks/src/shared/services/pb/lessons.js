import { pb, _logAudit } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Учительское фло, фаза 4: API уроков (lessons) + источники событий календаря.
export const lessonsApi = {
  // ── Lessons (уроки) ────────────────────────────────────────────────────────
  // opts: { from?, to? (ISO), groupId? }
  async getLessons({ from, to, groupId } = {}) {
    try {
      const parts = [];
      if (from) parts.push(`date_plan >= "${escapeFilter(from)}"`);
      if (to) parts.push(`date_plan <= "${escapeFilter(to)}"`);
      if (groupId) parts.push(`group = "${escapeFilter(groupId)}"`);
      const filter = parts.join(' && ');
      return await pb.collection('lessons').getFullList({
        ...(filter ? { filter } : {}),
        sort: 'date_plan',
        expand: 'group,ktp_entry',
      });
    } catch (error) {
      console.error('Error fetching lessons:', error);
      return [];
    }
  },

  async getLesson(id) {
    try {
      return await pb.collection('lessons').getOne(id, { expand: 'group,ktp_entry' });
    } catch (error) {
      console.error('Error fetching lesson:', error);
      throw error;
    }
  },

  // data: { title, date_plan, group?, ktp_entry?, status?, note_md?, date_fact? }
  async createLesson(data) {
    try {
      const owner = pb.authStore.model?.id;
      const rec = await pb.collection('lessons').create({
        status: 'planned',
        ...data,
        owner,
      });
      _logAudit('create', 'lessons', rec.id, rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating lesson:', error);
      throw error;
    }
  },

  async updateLesson(id, data) {
    try {
      const { owner, ...rest } = data;
      return await pb.collection('lessons').update(id, rest);
    } catch (error) {
      console.error('Error updating lesson:', error);
      throw error;
    }
  },

  async deleteLesson(id) {
    try {
      await pb.collection('lessons').delete(id);
      _logAudit('delete', 'lessons', id, '');
      return true;
    } catch (error) {
      console.error('Error deleting lesson:', error);
      throw error;
    }
  },

  // Сессии выдачи с дедлайном — для событий календаря (дедлайны выдач).
  async getSessionsWithDeadline() {
    try {
      return await pb.collection('work_sessions').getFullList({
        filter: 'deadline != ""',
        sort: 'deadline',
        expand: 'work,mc_test,trig_mc_test',
      });
    } catch (error) {
      console.error('Error fetching sessions with deadline:', error);
      return [];
    }
  },
};
