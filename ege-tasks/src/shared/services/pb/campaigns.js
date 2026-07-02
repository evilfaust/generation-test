import { pb, _logAudit, andOwner } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Кампании каникулярных заданий (vacation_campaigns).
export const campaignsApi = {
  async getCampaigns({ group, year, status } = {}) {
    try {
      const parts = [];
      if (group)  parts.push(`group = "${escapeFilter(group)}"`);
      if (year)   parts.push(`year = ${Number(year)}`);
      if (status) parts.push(`status = "${escapeFilter(status)}"`);
      return await pb.collection('vacation_campaigns').getFullList({
        filter: andOwner(parts.join(' && ')) || '',
        sort: '-year,-created',
        expand: 'group',
      });
    } catch (err) {
      console.error('getCampaigns:', err);
      return [];
    }
  },

  async getCampaign(id) {
    return pb.collection('vacation_campaigns').getOne(id, { expand: 'group' });
  },

  async createCampaign(data) {
    const owner = pb.authStore.model?.id;
    const rec = await pb.collection('vacation_campaigns').create({
      owner,
      status: 'draft',
      mode: 'individual',
      year: new Date().getFullYear(),
      ...data,
    });
    _logAudit('create', 'vacation_campaigns', rec.id, rec.title || rec.id);
    return rec;
  },

  async updateCampaign(id, data) {
    return pb.collection('vacation_campaigns').update(id, data);
  },

  async deleteCampaign(id) {
    let summary = id;
    try { const r = await pb.collection('vacation_campaigns').getOne(id); summary = r.title || id; } catch { /* noop */ }
    await pb.collection('vacation_campaigns').delete(id);
    _logAudit('delete', 'vacation_campaigns', id, summary);
    return true;
  },

  // Программы, привязанные к кампании (indexed по student id).
  async getCampaignPrograms(campaignId) {
    try {
      const list = await pb.collection('study_programs').getFullList({
        filter: `campaign = "${escapeFilter(campaignId)}"`,
        sort: '-created',
        expand: 'student',
      });
      return Object.fromEntries(list.map((p) => [p.student, p]));
    } catch (err) {
      console.error('getCampaignPrograms:', err);
      return {};
    }
  },

  // Пометить программу «проверена».
  async markReviewed(programId, reviewed) {
    return pb.collection('study_programs').update(programId, {
      reviewed_at: reviewed ? new Date().toISOString() : null,
    });
  },
};
