import { pb, _logAudit } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Индивидуальные летние программы (study_programs + study_program_items).
// owner ставится из токена учителя; мутации значимых записей логируются в audit_log.
export const programsApi = {
  // ── study_programs ──
  async getStudyPrograms({ group, student, year, season } = {}) {
    try {
      const parts = [];
      if (group) parts.push(`group = "${escapeFilter(group)}"`);
      if (student) parts.push(`student = "${escapeFilter(student)}"`);
      if (year) parts.push(`year = ${Number(year)}`);
      if (season) parts.push(`season = "${escapeFilter(season)}"`);
      return await pb.collection('study_programs').getFullList({
        filter: parts.join(' && '),
        sort: '-created',
        expand: 'student,group',
      });
    } catch (error) {
      console.error('Error fetching study programs:', error);
      return [];
    }
  },

  async getStudyProgram(id) {
    return pb.collection('study_programs').getOne(id, { expand: 'student,group' });
  },

  // Программа конкретного ученика (последняя по сезону/году). null если нет.
  async getStudyProgramForStudent(studentId, { season = 'summer', year } = {}) {
    try {
      const parts = [`student = "${escapeFilter(studentId)}"`, `season = "${escapeFilter(season)}"`];
      if (year) parts.push(`year = ${Number(year)}`);
      const list = await pb.collection('study_programs').getList(1, 1, {
        filter: parts.join(' && '),
        sort: '-created',
      });
      return list.items[0] || null;
    } catch (error) {
      console.error('Error fetching student study program:', error);
      return null;
    }
  },

  // Программа конкретного ученика в рамках кампании. null если нет.
  async getStudyProgramForCampaign(studentId, campaignId) {
    try {
      const list = await pb.collection('study_programs').getList(1, 1, {
        filter: `student = "${escapeFilter(studentId)}" && campaign = "${escapeFilter(campaignId)}"`,
        sort: '-created',
      });
      return list.items[0] || null;
    } catch (error) {
      console.error('Error fetching campaign program for student:', error);
      return null;
    }
  },

  async createStudyProgram(data) {
    const owner = pb.authStore.model?.id;
    const rec = await pb.collection('study_programs').create({ owner, season: 'summer', ...data });
    _logAudit('create', 'study_programs', rec.id, rec.title || rec.id);
    return rec;
  },

  async updateStudyProgram(id, data) {
    return pb.collection('study_programs').update(id, data);
  },

  async deleteStudyProgram(id) {
    let summary = id;
    try { const rec = await pb.collection('study_programs').getOne(id); summary = rec.title || id; } catch { /* noop */ }
    await pb.collection('study_programs').delete(id); // items уходят каскадом
    _logAudit('delete', 'study_programs', id, summary);
    return true;
  },

  // ── study_program_items ──
  async getProgramItems(programId) {
    try {
      return await pb.collection('study_program_items').getFullList({
        filter: `program = "${escapeFilter(programId)}"`,
        sort: 'order',
        expand: 'topic,session',
      });
    } catch (error) {
      console.error('Error fetching program items:', error);
      return [];
    }
  },

  async createProgramItem(data) {
    return pb.collection('study_program_items').create(data);
  },

  async updateProgramItem(id, data) {
    return pb.collection('study_program_items').update(id, data);
  },

  async deleteProgramItem(id) {
    return pb.collection('study_program_items').delete(id);
  },
};
