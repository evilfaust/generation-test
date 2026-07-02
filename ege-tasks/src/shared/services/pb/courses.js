import { pb, _logAudit, andOwner } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Курсы (онлайн-интенсивы в малых группах) — надстройка над teaching_groups
// (kind='course'), членство (course_members) и витрина уроков для учеников
// (lesson_publications, проекция урока). См. корневой CLAUDE.md § Курсы.

// Собрать student-facing items витрины из lessons.materials.
// Показываем только элементы с visible !== false и типов material/session/text.
// type='work' (работа для учительской петли план→результаты) ученику НЕ уходит —
// для ДЗ-теста учитель добавляет ссылку на уже выданную сессию (type='session').
export function buildPublicationItems(materials) {
  const arr = Array.isArray(materials) ? materials : [];
  const out = [];
  for (const m of arr) {
    if (!m || m.visible === false) continue;
    const role = m.role === 'homework' ? 'homework' : 'class';
    if (m.type === 'material') {
      out.push({ kind: 'file', role, title: m.title || 'Материал', file_url: m.url || '' });
    } else if (m.type === 'session') {
      out.push({ kind: 'work', role, title: m.title || 'Работа', session_id: m.id || '' });
    } else if (m.type === 'text') {
      out.push({ kind: 'text', role, title: m.title || '', description: m.text || '' });
    }
  }
  return out;
}

export const coursesApi = {
  // ── Курсы (teaching_groups с kind='course') ──────────────────────────────
  async getCourses({ includeArchived = false } = {}) {
    try {
      const parts = ['kind = "course"'];
      if (!includeArchived) parts.push('archived != true');
      return await pb.collection('teaching_groups').getFullList({
        filter: andOwner(parts.join(' && ')),
        sort: 'sort_order,-created',
      });
    } catch (error) {
      console.error('Error fetching courses:', error);
      return [];
    }
  },

  // ── Членство в курсе (course_members) ────────────────────────────────────
  async getCourseMembers(courseId) {
    try {
      return await pb.collection('course_members').getFullList({
        filter: `course = "${escapeFilter(courseId)}"`,
        expand: 'student',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching course members:', error);
      return [];
    }
  },

  // Добавить учеников в курс (пропускает уже добавленных). studentIds — массив id.
  async addCourseMembers(courseId, studentIds = []) {
    const owner = pb.authStore.model?.id;
    const existing = await this.getCourseMembers(courseId);
    const have = new Set(existing.map((m) => m.student));
    const toAdd = (studentIds || []).filter((id) => id && !have.has(id));
    const created = [];
    for (const student of toAdd) {
      try {
        const rec = await pb.collection('course_members').create({
          owner, course: courseId, student, active: true,
        });
        created.push(rec);
      } catch (e) {
        console.error('addCourseMember failed', student, e?.message);
      }
    }
    if (created.length) _logAudit('create', 'course_members', courseId, `+${created.length} уч.`);
    return created;
  },

  async setCourseMemberActive(memberId, active) {
    return pb.collection('course_members').update(memberId, { active: !!active });
  },

  async removeCourseMember(memberId) {
    await pb.collection('course_members').delete(memberId);
    _logAudit('delete', 'course_members', memberId, '');
    return true;
  },

  // Ученики курса как записи students (для ростера посещаемости и т.п.).
  // Имена берём list-запросом по id — students.viewRule=self ломает getOne/expand,
  // но listRule публичен, поэтому фильтр по id возвращает имена.
  async getCourseStudents(courseId) {
    try {
      const members = (await this.getCourseMembers(courseId)).filter((m) => m.active !== false);
      const ids = members.map((m) => m.student).filter(Boolean);
      if (!ids.length) return [];
      const filter = ids.map((id) => `id = "${escapeFilter(id)}"`).join(' || ');
      const studs = await pb.collection('students').getFullList({ filter, sort: 'name' });
      return studs;
    } catch (error) {
      console.error('Error fetching course students:', error);
      return [];
    }
  },

  // Ученик: его активные курсы (для кабинета). Открытое правило чтения self.
  async getMyCourseMemberships(studentId) {
    try {
      return await pb.collection('course_members').getFullList({
        filter: `student = "${escapeFilter(studentId)}" && active != false`,
        expand: 'course',
      });
    } catch (error) {
      console.error('Error fetching my course memberships:', error);
      return [];
    }
  },

  // ── Витрина уроков (lesson_publications) ─────────────────────────────────
  async getLessonPublication(lessonId) {
    try {
      return await pb.collection('lesson_publications').getFirstListItem(
        `lesson = "${escapeFilter(lessonId)}"`,
      );
    } catch (error) {
      if (error?.status === 404) return null;
      console.error('Error fetching lesson publication:', error);
      return null;
    }
  },

  // Учитель: все витрины курса (для обзора «что видят ученики»).
  async getPublicationsByGroup(groupId) {
    try {
      return await pb.collection('lesson_publications').getFullList({
        filter: `group = "${escapeFilter(groupId)}"`,
        sort: 'date_plan',
      });
    } catch (error) {
      console.error('Error fetching publications by group:', error);
      return [];
    }
  },

  // Ученик: опубликованные занятия его курсов.
  async getPublicationsForCourses(courseIds = []) {
    const ids = (courseIds || []).filter(Boolean);
    if (!ids.length) return [];
    try {
      const groupFilter = ids.map((id) => `group = "${escapeFilter(id)}"`).join(' || ');
      return await pb.collection('lesson_publications').getFullList({
        filter: `published = true && (${groupFilter})`,
        sort: 'date_plan',
      });
    } catch (error) {
      console.error('Error fetching publications for courses:', error);
      return [];
    }
  },

  // Пересобрать витрину урока из самого урока. Вызывается после сохранения урока
  // курса. Если группа урока — не курс, удаляет витрину (урок «разжаловали»).
  // opts.published — показывать ли занятие ученикам (по умолчанию true).
  async syncLessonPublication(lessonId, { published = true } = {}) {
    if (!lessonId) return null;
    let lesson;
    try {
      lesson = await pb.collection('lessons').getOne(lessonId, { expand: 'group' });
    } catch (e) {
      console.error('syncLessonPublication: lesson not found', lessonId, e?.message);
      return null;
    }
    const group = lesson.expand?.group;
    const existing = await this.getLessonPublication(lessonId);

    // Урок не принадлежит курсу → витрина не нужна.
    if (!group || group.kind !== 'course') {
      if (existing) {
        try { await pb.collection('lesson_publications').delete(existing.id); } catch { /* noop */ }
      }
      return null;
    }

    const payload = {
      owner: pb.authStore.model?.id,
      group: group.id,
      lesson: lessonId,
      title: lesson.title || '',
      date_plan: lesson.date_plan || '',
      time_slot: lesson.time_slot || '',
      conference_url: lesson.conference_url || group.conference_url || '',
      items: buildPublicationItems(lesson.materials),
      published: !!published,
    };

    if (existing) {
      return pb.collection('lesson_publications').update(existing.id, payload);
    }
    return pb.collection('lesson_publications').create(payload);
  },

  async deleteLessonPublication(lessonId) {
    const existing = await this.getLessonPublication(lessonId);
    if (existing) {
      try { await pb.collection('lesson_publications').delete(existing.id); } catch { /* noop */ }
    }
    return true;
  },
};
