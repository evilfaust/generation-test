import { pb, _logAudit, withOwner, andOwnerOrFree, andRelOwnerOrFree, authHeaders } from './client.js';
import { PB_BASE_URL } from '../pocketbaseUrl';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const studentsApi = {
  // ============ СТУДЕНТЫ (STUDENTS AUTH) ============

  async registerStudent(data) {
    try {
      return await pb.collection('students').create(data);
    } catch (error) {
      console.error('Error registering student:', error);
      throw error;
    }
  },

  async loginStudent(username, password) {
    try {
      return await pb.collection('students').authWithPassword(username, password);
    } catch (error) {
      console.error('Error logging in student:', error);
      throw error;
    }
  },

  async logoutStudent() {
    pb.authStore.clear();
  },

  getAuthStudent() {
    return pb.authStore.model;
  },

  isStudentAuthenticated() {
    return pb.authStore.isValid && pb.authStore.model?.collectionName === 'students';
  },

  // ── Teachers (auth collection, только для superadmin) ─────────────────────
  async getTeachers() {
    try {
      return await pb.collection('teachers').getFullList({
        sort: 'role,username',
      });
    } catch (error) {
      console.error('Error fetching teachers:', error);
      throw error;
    }
  },

  async getTeacher(id) {
    try {
      return await pb.collection('teachers').getOne(id);
    } catch (error) {
      console.error('Error fetching teacher:', error);
      throw error;
    }
  },

  // data: { username, name, password, role, allowed_sections }
  async createTeacher(data) {
    try {
      const payload = {
        username: data.username,
        name: data.name,
        role: data.role,
        allowed_sections: data.allowed_sections || [],
        password: data.password,
        passwordConfirm: data.password,
      };
      const rec = await pb.collection('teachers').create(payload);
      _logAudit('create', 'teachers', rec.id, `${rec.username} (${rec.role})`);
      return rec;
    } catch (error) {
      console.error('Error creating teacher:', error);
      throw error;
    }
  },

  // data: { name, role, allowed_sections, password?, avatar? (File или null для удаления) }
  // Если есть avatar (File) — отправляем как FormData, PB SDK сделает это автоматически.
  async updateTeacher(id, data) {
    try {
      const hasFile = data.avatar instanceof File || data.avatar === null;

      let payload;
      if (hasFile) {
        // FormData для загрузки файла
        payload = new FormData();
        if (data.name !== undefined) payload.append('name', data.name);
        if (data.role !== undefined) payload.append('role', data.role);
        if (data.allowed_sections !== undefined) {
          payload.append('allowed_sections', JSON.stringify(data.allowed_sections));
        }
        if (data.password) {
          payload.append('password', data.password);
          payload.append('passwordConfirm', data.password);
        }
        if (data.avatar instanceof File) {
          payload.append('avatar', data.avatar);
        } else if (data.avatar === null) {
          // Удалить аватар
          payload.append('avatar', '');
        }
      } else {
        payload = {};
        if (data.name !== undefined) payload.name = data.name;
        if (data.role !== undefined) payload.role = data.role;
        if (data.allowed_sections !== undefined) payload.allowed_sections = data.allowed_sections;
        if (data.password) {
          payload.password = data.password;
          payload.passwordConfirm = data.password;
        }
      }

      const rec = await pb.collection('teachers').update(id, payload);
      const summary = `${rec.username} (${rec.role})${data.password ? ' [password changed]' : ''}${hasFile ? ' [avatar updated]' : ''}`;
      _logAudit('update', 'teachers', rec.id, summary);
      return rec;
    } catch (error) {
      console.error('Error updating teacher:', error);
      throw error;
    }
  },

  // Возвращает URL аватарки учителя (или null если нет).
  // size: 'small' (64x64) | 'medium' (120x120) | null (оригинал)
  getTeacherAvatarUrl(teacher, size = null) {
    if (!teacher || !teacher.avatar) return null;
    const base = pb.files.getUrl(teacher, teacher.avatar);
    if (size === 'small') return `${base}?thumb=64x64`;
    if (size === 'medium') return `${base}?thumb=120x120`;
    return base;
  },

  async deleteTeacher(id) {
    try {
      let summary = id;
      try {
        const t = await pb.collection('teachers').getOne(id, { fields: 'id,username,role' });
        summary = `${t.username} (${t.role})`;
      } catch (_) {}
      const res = await pb.collection('teachers').delete(id);
      _logAudit('delete', 'teachers', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting teacher:', error);
      throw error;
    }
  },

  async getAttemptsByStudent(sessionId, studentId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `session = "${escapeFilter(sessionId)}" && student = "${escapeFilter(studentId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching student attempts:', error);
      return [];
    }
  },

  async getAttemptsByStudentAll(studentId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `student = "${escapeFilter(studentId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching all attempts by student:', error);
      return [];
    }
  },

  // Версия с expand session.work.topic — для экрана прогресса студента
  async getAttemptsByStudentAllWithWorks(studentId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `student = "${escapeFilter(studentId)}"`,
        expand: 'achievement,unlocked_achievements,session.work,session.work.topic,session.mc_test',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching all attempts with works by student:', error);
      return [];
    }
  },

  async getAttemptsByDeviceAll(deviceId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `device_id = "${escapeFilter(deviceId)}"`,
        expand: 'achievement,unlocked_achievements',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching all attempts by device:', error);
      return [];
    }
  },

  // Версия с expand session.work.topic — для экрана прогресса студента
  async getAttemptsByDeviceAllWithWorks(deviceId) {
    try {
      return await pb.collection('attempts').getFullList({
        filter: `device_id = "${escapeFilter(deviceId)}"`,
        expand: 'achievement,unlocked_achievements,session.work,session.work.topic,session.mc_test',
        sort: '-created',
      });
    } catch (error) {
      console.error('Error fetching all attempts with works by device:', error);
      return [];
    }
  },

  async getStudents() {
    try {
      return await pb.collection('students').getFullList({
        sort: '-created',
        fields: 'id,username,name,student_class,external,owner,created,updated',
        // мои ученики + «ничьи» (саморегистрация до привязки)
        filter: andOwnerOrFree(),
      });
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  },

  // Ученик «без аккаунта» — вписанный вручную для разовых/внешних занятий.
  // Создаём обычную students-запись с external=true + авто-логином/паролем
  // (ими ученик не пользуется). Привязываем к группе. createRule students
  // открыт (само-регистрация), поэтому учитель может создавать.
  async createManualStudent({ name, groupId } = {}) {
    const nm = (name || '').trim();
    if (!nm) throw new Error('Имя обязательно');
    const password = `x${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    let lastErr;
    for (let i = 0; i < 3; i += 1) {
      try {
        const rec = await pb.collection('students').create(withOwner({
          name: nm,
          username: `ext_${Math.random().toString(36).slice(2, 10)}`,
          password,
          passwordConfirm: password,
          external: true,
          ...(groupId ? { teaching_group: groupId } : {}),
        }));
        _logAudit('create', 'students', rec.id, `внешний: ${nm}`);
        return rec;
      } catch (e) {
        lastErr = e;
        // повтор только при коллизии username, иначе сразу наружу
        if (!String(e?.message || '').toLowerCase().includes('username')) break;
      }
    }
    console.error('Error creating manual student:', lastErr);
    throw lastErr;
  },

  // Полноценный аккаунт ученика, созданный учителем (v3.9.120): логин и пароль
  // генерируются и возвращаются наружу — показать учителю ОДИН раз (в БД
  // хранится только хэш). owner = создавший учитель.
  async createStudentAccount({ name, groupId = null, studentClass = '' } = {}) {
    const nm = (name || '').trim();
    if (!nm) throw new Error('Имя обязательно');
    let lastErr;
    for (let i = 0; i < 3; i += 1) {
      const username = `st_${Math.random().toString(36).slice(2, 8)}`;
      const password = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
      try {
        const rec = await pb.collection('students').create(withOwner({
          name: nm,
          username,
          password,
          passwordConfirm: password,
          ...(studentClass ? { student_class: studentClass } : {}),
          ...(groupId ? { teaching_group: groupId } : {}),
        }));
        _logAudit('create', 'students', rec.id, `аккаунт учителем: ${nm} (@${username})`);
        return { record: rec, username, password };
      } catch (e) {
        lastErr = e;
        // повтор только при коллизии username
        if (!String(e?.message || '').toLowerCase().includes('username')) break;
      }
    }
    console.error('Error creating student account:', lastErr);
    throw lastErr;
  },

  // Передать ученика другому учителю (владелец или superadmin — правила PB).
  async transferStudent(studentId, teacherId) {
    const rec = await pb.collection('students').update(studentId, { owner: teacherId });
    _logAudit('update', 'students', studentId, `передан учителю ${teacherId}`);
    return rec;
  },

  // Полная запись одного ученика (включая telegram_id — нужен для матча профиля слабостей).
  // Через getFullList с фильтром по id: getOne у students блокируется viewRule
  // (self-only) → учитель получал бы 404. listRule же разрешает чтение.
  async getStudent(id) {
    try {
      const list = await pb.collection('students').getFullList({
        filter: `id = "${escapeFilter(id)}"`,
      });
      return list[0] || null;
    } catch (error) {
      console.error('Error fetching student:', error);
      return null;
    }
  },

  async updateStudent(id, data) {
    try {
      return await pb.collection('students').update(id, data);
    } catch (error) {
      console.error('Error updating student:', error);
      throw error;
    }
  },

  // Объединяет два аккаунта: переносит на toStudentId ВСЁ, что ссылается на
  // fromStudentId (попытки, учебные программы, курсы, посещаемость, дела), плюс
  // пустые поля профиля (группа, класс, telegram, владелец), затем удаляет
  // fromStudentId. Выполняется серверным hook'ом в одной транзакции.
  //
  // opts.keepCredentials — оставшийся аккаунт получает логин и пароль удаляемого
  // (ученик помнит именно их, когда сливаем новый аккаунт в старый).
  // opts.renameAttempts — переписать student_name в перенесённых попытках
  // именем целевого ученика (по умолчанию да).
  //
  // Возвращает { moved, movedByCollection, droppedByCollection, profileFields,
  //              deletedUsername, targetUsername, resultUsername }.
  async mergeStudents(fromStudentId, toStudentId, opts = {}) {
    const { keepCredentials = false, renameAttempts = true, dryRun = false } = opts;
    const response = await fetch(`${PB_BASE_URL}/api/students/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ fromStudentId, toStudentId, keepCredentials, renameAttempts, dryRun }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  },

  // Что именно переедет при слиянии — ничего не меняет, только считает.
  async previewMergeStudents(fromStudentId, toStudentId, opts = {}) {
    return this.mergeStudents(fromStudentId, toStudentId, { ...opts, dryRun: true });
  },

  async getAttemptsForRegisteredStudents() {
    try {
      return await pb.collection('attempts').getFullList({
        // скоуп аналитики: попытки моих учеников (+ «ничьих» до привязки)
        filter: andRelOwnerOrFree('student', 'student != ""'),
        sort: '-created',
        expand: 'session,session.work,session.mc_test,variant',
      });
    } catch (error) {
      console.error('Error fetching attempts for registered students:', error);
      return [];
    }
  },

};
