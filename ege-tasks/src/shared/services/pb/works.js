import { pb, _logAudit, withOwner, andOwner } from './client.js';
import { getFullListByOr } from './chunked.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

// Название работы хранится копией в двух местах: в плане каникулярной программы
// (study_program_items.title) и в заголовке выдачи (work_sessions.student_title).
// После переименования работы подтягиваем те копии, которые совпадали со старым
// названием — то есть были снимком, а не своей меткой, заданной учителем.
async function syncWorkTitleSnapshots(workId, prevTitle, nextTitle) {
  try {
    const [items, sessions] = await Promise.all([
      pb.collection('study_program_items').getFullList({
        filter: `title = "${escapeFilter(prevTitle)}"`,
      }).catch(() => []),
      pb.collection('work_sessions').getFullList({
        filter: `work = "${escapeFilter(workId)}" && student_title = "${escapeFilter(prevTitle)}"`,
      }).catch(() => []),
    ]);

    await Promise.all([
      ...items
        .filter((it) => it.params?.workId === workId)
        .map((it) => pb.collection('study_program_items').update(it.id, { title: nextTitle })),
      ...sessions.map((s) => pb.collection('work_sessions').update(s.id, { student_title: nextTitle })),
    ]);
  } catch (error) {
    // Не роняем переименование работы из-за синхронизации копий.
    console.error('Error syncing work title snapshots:', error);
  }
}

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

  // Обновить работу. Название работы копируется в план каникулярной программы
  // (study_program_items.title) и в заголовок выдачи (work_sessions.student_title) —
  // при переименовании подтягиваем эти снимки, см. syncWorkTitleSnapshots.
  async updateWork(id, data) {
    try {
      let prevTitle = null;
      if ('title' in data) {
        const before = await pb.collection('works').getOne(id, { fields: 'id,title' }).catch(() => null);
        prevTitle = before?.title || null;
      }
      const rec = await pb.collection('works').update(id, data);
      if (prevTitle && rec.title && rec.title !== prevTitle) {
        await syncWorkTitleSnapshots(id, prevTitle, rec.title);
      }
      return rec;
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
      return await getFullListByOr(
        'variants',
        'tasks',
        taskIds,
        {
          expand: 'work',
          fields: 'id,work,tasks,expand.work.id,expand.work.title,expand.work.archived',
        },
        {
          op: '~',
          extraFilter: excludeWorkId ? `work != "${escapeFilter(excludeWorkId)}"` : '',
        },
      );
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

  // Только id последних работ (для эталонов новизны и т.п.) — вместо полного
  // getWorks с expand: список работ у учителя доходит до сотен записей.
  async getRecentWorkIds(limit = 5, excludeId = null) {
    try {
      const filterArr = ['(archived = false || archived = null)'];
      if (excludeId) filterArr.push(`id != "${escapeFilter(excludeId)}"`);
      const res = await pb.collection('works').getList(1, limit, {
        filter: andOwner(filterArr.join(' && ')),
        sort: '-created',
        fields: 'id',
        skipTotal: true,
      });
      return res.items.map((w) => w.id);
    } catch (error) {
      console.error('Error fetching recent work ids:', error);
      return [];
    }
  },

  // Варианты сразу нескольких работ, без expand — когда нужны только составы
  // (оценка новизны, эталонные наборы). Один запрос вместо N последовательных.
  async getVariantsByWorks(workIds = [], { fields = 'id,work,number,tasks' } = {}) {
    try {
      return await getFullListByOr('variants', 'work', workIds, { fields, sort: 'number' });
    } catch (error) {
      console.error('Error fetching variants by works:', error);
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
