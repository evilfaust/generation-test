import { pb, _logAudit } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Учительское фло, фаза 5: API заметок (teacher_notes). body = JSON-документ BlockNote.
// «Общие заметки»: заметка может быть свободной или привязанной к группе/дате/уроку.
export const notesApi = {
  async getNotes() {
    try {
      return await pb.collection('teacher_notes').getFullList({ sort: '-updated', expand: 'group' });
    } catch (error) {
      console.error('Error fetching notes:', error);
      return [];
    }
  },

  // Заметка урока, если есть (read-only, БЕЗ создания) — для модалки календаря.
  async getLessonNote(lessonId) {
    try {
      const found = await pb.collection('teacher_notes').getFullList({
        filter: `lesson = "${escapeFilter(lessonId)}"`,
        sort: '-updated',
      });
      return found[0] || null;
    } catch (error) {
      console.error('Error fetching lesson note:', error);
      return null;
    }
  },

  // Найти или создать заметку урока (связь lesson + копия группы/даты урока).
  async getOrCreateLessonNote(lesson) {
    try {
      const found = await pb.collection('teacher_notes').getFullList({
        filter: `lesson = "${escapeFilter(lesson.id)}"`,
        sort: '-updated',
      });
      if (found.length) return found[0];
      return await this.createNote({
        title: lesson.title || 'Заметка урока',
        lesson: lesson.id,
        group: lesson.group || '',
        note_date: lesson.date_plan || '',
      });
    } catch (error) {
      console.error('Error get/create lesson note:', error);
      throw error;
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

  // Бэклинки: заметки, ссылающиеся на текущую через links ({type:'note', id}).
  // `~` грубо ловит подстроку id в сериализованном json, уточняем в JS.
  async getNoteBacklinks(noteId) {
    try {
      if (!noteId) return [];
      const all = await pb.collection('teacher_notes').getFullList({
        filter: `links ~ "${escapeFilter(noteId)}"`,
        sort: '-updated',
        expand: 'group',
      });
      return all.filter((n) => n.id !== noteId && Array.isArray(n.links)
        && n.links.some((l) => l.type === 'note' && l.id === noteId));
    } catch (error) {
      console.error('Error fetching note backlinks:', error);
      return [];
    }
  },

  // Заметки, где ученик отмечен в links ({type:'student', id}) — для секции
  // «Заметки уроков» в карточке ученика. `~` ловит подстроку id в сериализованном
  // json, дальше уточняем в JS (чтобы не словить ложное совпадение с file id).
  async getNotesByStudent(studentId) {
    try {
      if (!studentId) return [];
      const all = await pb.collection('teacher_notes').getFullList({
        filter: `links ~ "${escapeFilter(studentId)}"`,
        sort: '-updated',
        expand: 'group,lesson',
      });
      return all.filter((n) => Array.isArray(n.links)
        && n.links.some((l) => l.type === 'student' && l.id === studentId));
    } catch (error) {
      console.error('Error fetching notes by student:', error);
      return [];
    }
  },
};
