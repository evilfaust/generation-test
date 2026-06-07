import { pb, _logAudit } from './client.js';

// Учительское фло, фаза 5: API заметок (teacher_notes). body = JSON-документ BlockNote.
export const notesApi = {
  async getNotes() {
    try {
      return await pb.collection('teacher_notes').getFullList({ sort: '-updated' });
    } catch (error) {
      console.error('Error fetching notes:', error);
      return [];
    }
  },

  async getNote(id) {
    try {
      return await pb.collection('teacher_notes').getOne(id);
    } catch (error) {
      console.error('Error fetching note:', error);
      throw error;
    }
  },

  async createNote(data = {}) {
    try {
      const owner = pb.authStore.model?.id;
      const rec = await pb.collection('teacher_notes').create({
        title: '',
        is_inbox: false,
        ...data,
        owner,
      });
      _logAudit('create', 'teacher_notes', rec.id, rec.title || '(без названия)');
      return rec;
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  },

  async updateNote(id, data) {
    try {
      const { owner, ...rest } = data;
      return await pb.collection('teacher_notes').update(id, rest);
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  },

  async deleteNote(id) {
    try {
      await pb.collection('teacher_notes').delete(id);
      _logAudit('delete', 'teacher_notes', id, '');
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  },
};
