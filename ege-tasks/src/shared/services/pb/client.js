import PocketBase from 'pocketbase';
import { PB_BASE_URL } from '../pocketbaseUrl';

export const pb = new PocketBase(PB_BASE_URL);

// Отключаем автоматическое обновление токена для анонимного доступа
pb.autoCancellation(false);

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

