import { pb, _logAudit, andOwner } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Учительское фло, фаза 3: API КТП (courses + ktp_entries).
// owner подставляется из токена; правки строк — по course.
export const ktpApi = {
  // ── Courses (КТП-документы) ────────────────────────────────────────────────
  async getCourses({ includeArchived = false } = {}) {
    try {
      const filter = andOwner(includeArchived ? '' : 'archived != true');
      return await pb.collection('courses').getFullList({
        ...(filter ? { filter } : {}),
        sort: '-created',
        expand: 'group',
      });
    } catch (error) {
      console.error('Error fetching courses:', error);
      throw error;
    }
  },

  async getCourse(id) {
    try {
      return await pb.collection('courses').getOne(id, { expand: 'group' });
    } catch (error) {
      console.error('Error fetching course:', error);
      throw error;
    }
  },

  // data: { title, group?, year? }
  async createCourse(data) {
    try {
      const owner = pb.authStore.model?.id;
      const rec = await pb.collection('courses').create({ ...data, owner });
      _logAudit('create', 'courses', rec.id, rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating course:', error);
      throw error;
    }
  },

  async updateCourse(id, data) {
    try {
      const { owner, ...rest } = data;
      return await pb.collection('courses').update(id, rest);
    } catch (error) {
      console.error('Error updating course:', error);
      throw error;
    }
  },

  async archiveCourse(id, archived = true) {
    try {
      return await pb.collection('courses').update(id, { archived });
    } catch (error) {
      console.error('Error archiving course:', error);
      throw error;
    }
  },

  async deleteCourse(id) {
    try {
      let summary = '';
      try {
        const rec = await pb.collection('courses').getOne(id);
        summary = rec?.title || '';
      } catch { /* уже удалён */ }
      await pb.collection('courses').delete(id); // cascade удалит ktp_entries
      _logAudit('delete', 'courses', id, summary);
      return true;
    } catch (error) {
      console.error('Error deleting course:', error);
      throw error;
    }
  },

  // ── KTP entries (строки КТП) ───────────────────────────────────────────────
  async getKtpEntries(courseId) {
    try {
      return await pb.collection('ktp_entries').getFullList({
        filter: `course = "${escapeFilter(courseId)}"`,
        sort: 'order',
        expand: 'topic',
      });
    } catch (error) {
      console.error('Error fetching ktp entries:', error);
      return [];
    }
  },

  // data: { course, title, topic?, hours?, week_no?, planned_date?, planned_results?, is_section?, order? }
  async createKtpEntry(data) {
    try {
      return await pb.collection('ktp_entries').create(data);
    } catch (error) {
      console.error('Error creating ktp entry:', error);
      throw error;
    }
  },

  async updateKtpEntry(id, data) {
    try {
      return await pb.collection('ktp_entries').update(id, data);
    } catch (error) {
      console.error('Error updating ktp entry:', error);
      throw error;
    }
  },

  async deleteKtpEntry(id) {
    try {
      await pb.collection('ktp_entries').delete(id);
      return true;
    } catch (error) {
      console.error('Error deleting ktp entry:', error);
      throw error;
    }
  },

  // Пакетное обновление порядка: orderedIds — массив id в нужном порядке.
  async reorderKtpEntries(orderedIds = []) {
    try {
      await Promise.all(
        orderedIds.map((id, idx) =>
          pb.collection('ktp_entries').update(id, { order: idx }),
        ),
      );
      return true;
    } catch (error) {
      console.error('Error reordering ktp entries:', error);
      throw error;
    }
  },
};
