import { pb, _logAudit, withOwner, andOwner } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const worksApi = {
  // ============ РАБОТЫ (WORKS) ============

  // Создать работу
  async createWork(data) {
    try {
      const rec = await pb.collection('works').create(withOwner(data));
      _logAudit('create', 'works', rec.id, rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating work:', error);
      throw error;
    }
  },

  // Получить все работы
  async getWorks(options = {}) {
    const {
      includeArchived = false,
      archived = false,
      search = '',
      topic = null,
    } = options;

    try {
      const filterArr = [];

      if (!includeArchived) {
        if (archived) {
          filterArr.push('archived = true');
        } else {
          // Если поле archived ещё не проставлено (null), считаем как false
          filterArr.push('(archived = false || archived = null)');
        }
      }

      if (topic) {
        filterArr.push(`topic = "${escapeFilter(topic)}"`);
      }

      if (search) {
        filterArr.push(`title ~ "${escapeFilter(search)}"`);
      }

      const filterString = andOwner(filterArr.length > 0 ? filterArr.join(' && ') : '');

      const records = await pb.collection('works').getFullList({
        sort: '-created',
        expand: 'topic',
        filter: filterString,
      });
      return records;
    } catch (error) {
      console.error('Error fetching works:', error);
      return [];
    }
  },

  // ── Шаринг работ (v3.9.118) ──────────────────────────────────────────────

  // Общие работы всех учителей (вкладка «Общие работы»).
  // expand: owner → автор (teachers.viewRule открыт для учителей), topic → тема.
  async getSharedWorks() {
    try {
      return await pb.collection('works').getFullList({
        filter: 'visibility = "shared" && (archived = false || archived = null)',
        sort: '-created',
        expand: 'topic,owner',
      });
    } catch (error) {
      console.error('Error fetching shared works:', error);
      return [];
    }
  },

  // Поделиться / сделать личной. Правка только владельцем (правила PB).
  async setWorkVisibility(id, visibility) {
    const rec = await pb.collection('works').update(id, { visibility });
    _logAudit('update', 'works', id, `visibility → ${visibility}: ${rec.title || id}`);
    return rec;
  },

  // Передать работу другому учителю (владелец/superadmin — правила PB):
  // вместе с работой уходят все её выдачи, иначе новый владелец не увидит
  // результаты. Варианты/попытки привязаны к работе/выдаче — едут сами.
  async transferWork(workId, teacherId) {
    const rec = await pb.collection('works').update(workId, { owner: teacherId });
    const sessions = await pb.collection('work_sessions').getFullList({
      filter: `work = "${escapeFilter(workId)}"`,
      fields: 'id',
    });
    for (const s of sessions) {
      await pb.collection('work_sessions').update(s.id, { owner: teacherId });
    }
    _logAudit('update', 'works', workId, `передана учителю ${teacherId} (+${sessions.length} выдач): ${rec.title || workId}`);
    return rec;
  },

  // Клонировать работу себе (свою или общую чужую): копия работы + всех
  // вариантов (задачи и порядок). Выдачи/попытки/папки/пин не копируются.
  async cloneWork(workId) {
    const src = await pb.collection('works').getOne(workId);
    const variants = await pb.collection('variants').getFullList({
      filter: `work = "${escapeFilter(workId)}"`,
      sort: 'number',
    });
    const data = {
      title: `${src.title || 'Работа'} (копия)`,
      class: src.class,
      time_limit: src.time_limit,
    };
    if (src.topic) data.topic = src.topic;
    const rec = await pb.collection('works').create(withOwner(data));
    for (const v of variants) {
      await pb.collection('variants').create({
        work: rec.id,
        number: v.number,
        tasks: v.tasks,
        ...(v.order != null ? { order: v.order } : {}),
      });
    }
    _logAudit('create', 'works', rec.id, `клон работы ${src.title || workId} (${variants.length} вар.)`);
    return rec;
  },

  // Получить работу по ID
  async getWork(id) {
    try {
      return await pb.collection('works').getOne(id, {
        expand: 'topic',
      });
    } catch (error) {
      console.error('Error fetching work:', error);
      return null;
    }
  },

  // Удалить работу
  async deleteWork(id) {
    try {
      let summary = id;
      try {
        const w = await pb.collection('works').getOne(id, { fields: 'id,title' });
        summary = w.title || id;
      } catch (_) {}
      const res = await pb.collection('works').delete(id);
      _logAudit('delete', 'works', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting work:', error);
      throw error;
    }
  },

  // Обновить работу
  async updateWork(id, data) {
    try {
      return await pb.collection('works').update(id, data);
    } catch (error) {
      console.error('Error updating work:', error);
      throw error;
    }
  },

  // Архивировать работу
  async archiveWork(id) {
    return this.updateWork(id, { archived: true });
  },

  // Разархивировать работу
  async unarchiveWork(id) {
    return this.updateWork(id, { archived: false });
  },

  // ============ ВАРИАНТЫ (VARIANTS) ============

  // Создать вариант
  async createVariant(data) {
    try {
      return await pb.collection('variants').create(data);
    } catch (error) {
      console.error('Error creating variant:', error);
      throw error;
    }
  },

  // Варианты ДРУГИХ работ, содержащие любую из задач (для предупреждения
  // «задачи уже встречаются в других работах»). taskIds — состав одной работы,
  // фильтр строится OR-цепочкой.
  async getVariantsContainingTasks(taskIds = [], excludeWorkId = null) {
    try {
      if (!taskIds.length) return [];
      const orPart = '(' + taskIds.map(id => `tasks ~ "${escapeFilter(id)}"`).join(' || ') + ')';
      const filter = excludeWorkId
        ? `${orPart} && work != "${escapeFilter(excludeWorkId)}"`
        : orPart;
      return await pb.collection('variants').getFullList({
        filter,
        expand: 'work',
        fields: 'id,work,tasks,expand.work.id,expand.work.title,expand.work.archived',
      });
    } catch (error) {
      console.error('Error fetching variants containing tasks:', error);
      return [];
    }
  },

  // Получить все варианты работы
  async getVariantsByWork(workId) {
    try {
      const records = await pb.collection('variants').getFullList({
        filter: `work = "${escapeFilter(workId)}"`,
        sort: 'number',
        expand: 'tasks,tasks.topic',
      });
      return records;
    } catch (error) {
      console.error('Error fetching variants:', error);
      return [];
    }
  },

  // Получить вариант по ID
  async getVariant(id) {
    try {
      return await pb.collection('variants').getOne(id, {
        expand: 'work,tasks,tasks.topic',
      });
    } catch (error) {
      console.error('Error fetching variant:', error);
      return null;
    }
  },

  // Удалить вариант
  async deleteVariant(id) {
    try {
      return await pb.collection('variants').delete(id);
    } catch (error) {
      console.error('Error deleting variant:', error);
      throw error;
    }
  },

  // Обновить вариант
  async updateVariant(id, data) {
    try {
      return await pb.collection('variants').update(id, data);
    } catch (error) {
      console.error('Error updating variant:', error);
      throw error;
    }
  },

};
