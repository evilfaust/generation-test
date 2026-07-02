import PocketBase from 'pocketbase';
import { PB_BASE_URL } from '../pocketbaseUrl';

export const pb = new PocketBase(PB_BASE_URL);

// Отключаем автоматическое обновление токена для анонимного доступа
pb.autoCancellation(false);

// ─── Мультиучительство: владелец записей (v3.9.117) ───
// В ученическом приложении teacher-auth нет → хелперы «прозрачны»
// (owner не подставляется, фильтр не накладывается) — student-фло не меняется.

export function currentTeacher() {
  const m = pb.authStore.model;
  return m && m.collectionName === 'teachers' ? m : null;
}

// Данные для create с проставленным владельцем-учителем.
export function withOwner(data = {}) {
  const t = currentTeacher();
  return t ? { ...data, owner: t.id } : data;
}

// Фильтр «только моё» для списков учительских разделов.
// superadmin видит всё (фильтр не накладывается).
export function andOwner(filter = '') {
  const t = currentTeacher();
  if (!t || t.role === 'superadmin') return filter;
  const own = `owner = "${t.id}"`;
  return filter ? `(${filter}) && ${own}` : own;
}

// Вариант для учеников: мои ИЛИ ничьи (саморегистрация из ученического
// приложения владельца не имеет — такие записи видны всем учителям,
// пока не привязаны; модель привязки — следующий этап).
export function andOwnerOrFree(filter = '') {
  const t = currentTeacher();
  if (!t || t.role === 'superadmin') return filter;
  const own = `(owner = "${t.id}" || owner = "")`;
  return filter ? `(${filter}) && ${own}` : own;
}

// То же «мои + ничьи», но через relation (напр. attempts → student.owner):
// скоуп записей, у которых владелец лежит на связанной записи.
export function andRelOwnerOrFree(relField, filter = '') {
  const t = currentTeacher();
  if (!t || t.role === 'superadmin') return filter;
  const own = `(${relField}.owner = "${t.id}" || ${relField}.owner = "")`;
  return filter ? `(${filter}) && ${own}` : own;
}

// Заголовок авторизации для ИИ-ручек pdf-service (/latex-fix, /scan-blank):
// сервер валидирует токен учителя через PB и проверяет teachers.ai_enabled
// (включается env REQUIRE_TEACHER_AI_AUTH=1 на VPS).
export function aiHeaders() {
  const t = currentTeacher();
  return t && pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {};
}

export function _logAudit(action, collectionName, recordId, summary) {
  try {
    const teacher = pb.authStore.model;
    if (!teacher || teacher.collectionName !== 'teachers') return;

    pb.collection('audit_log').create({
      teacher_id: teacher.id,
      teacher_name: teacher.name || teacher.username || '?',
      action,
      collection_name: collectionName,
      record_id: recordId || '',
      record_summary: (summary || '').slice(0, 500),
    }).catch((err) => {
      // Не шумим в консоль — журнал не критичен.
      if (err?.status && err.status !== 404) {
        console.debug('[audit] log failed:', err?.message);
      }
    });
  } catch (e) {
    // Пустой catch — журналирование не должно ронять приложение.
  }
}

