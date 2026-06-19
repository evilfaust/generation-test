import { pb } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Учительское фло: посещаемость уроков (коллекция `lesson_attendance`).
// По строке на (урок, ученик). Список учеников урока берётся из группы урока,
// здесь хранится только состояние: present|absent|late|excused.
// `owner` подставляется из токена. Аудит не пишем — отметки высокочастотны и
// не критичны (как заметки).
export const attendanceApi = {
  // Отметки конкретного урока (с учеником в expand).
  async getLessonAttendance(lessonId) {
    try {
      if (!lessonId) return [];
      return await pb.collection('lesson_attendance').getFullList({
        filter: `lesson = "${escapeFilter(lessonId)}"`,
        expand: 'student',
      });
    } catch (error) {
      console.error('Error fetching lesson attendance:', error);
      return [];
    }
  },

  // Upsert отметки для (урок, ученик). status пустой/null → удалить строку
  // (вернуться к состоянию «не отмечен»). Возвращает запись или null (при очистке).
  async setAttendance(lessonId, studentId, status) {
    try {
      let existing = null;
      try {
        existing = await pb.collection('lesson_attendance').getFirstListItem(
          `lesson = "${escapeFilter(lessonId)}" && student = "${escapeFilter(studentId)}"`,
        );
      } catch { /* 404 — отметки ещё нет */ }

      if (!status) {
        if (existing) await pb.collection('lesson_attendance').delete(existing.id);
        return null;
      }
      if (existing) {
        return await pb.collection('lesson_attendance').update(existing.id, { status });
      }
      const owner = pb.authStore.model?.id;
      return await pb.collection('lesson_attendance').create({
        lesson: lessonId, student: studentId, status, owner,
      });
    } catch (error) {
      console.error('Error setting attendance:', error);
      throw error;
    }
  },

  // Отметки конкретного ученика (с уроком в expand) — для ленты в карточке ученика.
  async getAttendanceByStudent(studentId) {
    try {
      if (!studentId) return [];
      return await pb.collection('lesson_attendance').getFullList({
        filter: `student = "${escapeFilter(studentId)}"`,
        expand: 'lesson',
      });
    } catch (error) {
      console.error('Error fetching attendance by student:', error);
      return [];
    }
  },
};
