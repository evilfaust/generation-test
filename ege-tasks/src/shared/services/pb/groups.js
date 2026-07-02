import { pb, _logAudit, andOwner, andOwnerOrFree, currentTeacher } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Учительское фло, фаза 1: API классов/групп (коллекция `teaching_groups`).
// `owner` подставляется автоматически из токена залогиненного учителя.
export const groupsApi = {
  // ── Классы/группы (teaching_groups) ───────────────────────────────────────
  async getTeachingGroups({ includeArchived = false } = {}) {
    try {
      const filter = andOwner(includeArchived ? '' : 'archived != true');
      return await pb.collection('teaching_groups').getFullList({
        ...(filter ? { filter } : {}),
        // Ручной порядок (sort_order), затем — новые сверху для одинакового sort_order.
        sort: 'sort_order,-created',
      });
    } catch (error) {
      console.error('Error fetching teaching groups:', error);
      throw error;
    }
  },

  async getTeachingGroup(id) {
    try {
      return await pb.collection('teaching_groups').getOne(id);
    } catch (error) {
      console.error('Error fetching teaching group:', error);
      throw error;
    }
  },

  // data: { name, subject?, grade?, hours_per_week?, umk?, year?, schedule? }
  async createTeachingGroup(data) {
    try {
      const owner = pb.authStore.model?.id;
      const rec = await pb.collection('teaching_groups').create({ ...data, owner });
      _logAudit('create', 'teaching_groups', rec.id, rec.name);
      return rec;
    } catch (error) {
      console.error('Error creating teaching group:', error);
      throw error;
    }
  },

  async updateTeachingGroup(id, data) {
    try {
      // owner не перезаписываем при апдейте — он закреплён при создании.
      const { owner, ...rest } = data;
      return await pb.collection('teaching_groups').update(id, rest);
    } catch (error) {
      console.error('Error updating teaching group:', error);
      throw error;
    }
  },

  // Переупорядочить группы: orderedIds — желаемый порядок (сверху вниз).
  // Пишем sort_order = индекс*10 только тем, у кого значение изменилось.
  async reorderTeachingGroups(orderedIds = [], current = []) {
    try {
      const byId = new Map(current.map((g) => [g.id, g]));
      await Promise.all(
        orderedIds.map((id, idx) => {
          const want = idx * 10;
          if (byId.get(id)?.sort_order === want) return null;
          return pb.collection('teaching_groups').update(id, { sort_order: want });
        }),
      );
    } catch (error) {
      console.error('Error reordering teaching groups:', error);
      throw error;
    }
  },

  async archiveTeachingGroup(id, archived = true) {
    try {
      return await pb.collection('teaching_groups').update(id, { archived });
    } catch (error) {
      console.error('Error archiving teaching group:', error);
      throw error;
    }
  },

  async deleteTeachingGroup(id) {
    try {
      // Сначала читаем имя для журнала, потом удаляем.
      let summary = '';
      try {
        const rec = await pb.collection('teaching_groups').getOne(id);
        summary = rec?.name || '';
      } catch { /* запись могла быть уже удалена */ }
      await pb.collection('teaching_groups').delete(id);
      _logAudit('delete', 'teaching_groups', id, summary);
      return true;
    } catch (error) {
      console.error('Error deleting teaching group:', error);
      throw error;
    }
  },

  // ── Привязка учеников к группе ────────────────────────────────────────────
  // Ученики, привязанные к группе через relation `teaching_group`.
  async getStudentsByGroup(groupId) {
    try {
      return await pb.collection('students').getFullList({
        filter: `teaching_group = "${escapeFilter(groupId)}"`,
        sort: 'name',
      });
    } catch (error) {
      console.error('Error fetching students by group:', error);
      throw error;
    }
  },

  // Лёгкий список всех учеников для пикера привязки: включает teaching_group
  // и student_class (для предложения «привязать по совпадению названия»).
  async getStudentsForGroupPicker() {
    try {
      return await pb.collection('students').getFullList({
        sort: 'name',
        fields: 'id,name,username,student_class,teaching_group',
        // мои ученики + «ничьи» (саморегистрация) — до модели привязки учеников
        filter: andOwnerOrFree(),
      });
    } catch (error) {
      console.error('Error fetching students for picker:', error);
      return [];
    }
  },

  async setStudentGroup(studentId, groupId) {
    try {
      // groupId === null → отвязать (владелец при этом сохраняется).
      const data = { teaching_group: groupId || '' };
      // Привязка к группе «забирает» ничейного ученика (саморегистрация)
      // текущему учителю — это и есть модель привязки учеников.
      const t = currentTeacher();
      if (groupId && t) {
        try {
          const found = await pb.collection('students').getFullList({
            filter: `id = "${escapeFilter(studentId)}"`,
            fields: 'id,owner',
          });
          if (found[0] && !found[0].owner) {
            data.owner = t.id;
            _logAudit('update', 'students', studentId, 'привязан к учителю (claim при добавлении в группу)');
          }
        } catch (_) { /* не смогли прочитать — просто не claim'им */ }
      }
      return await pb.collection('students').update(studentId, data);
    } catch (error) {
      console.error('Error setting student group:', error);
      throw error;
    }
  },

  // ── Журнал сдачи (GradeJournal) ───────────────────────────────────────────
  // Для группы: её ученики + их попытки (с сессией/работой) для сборки сетки
  // «ученик × выдача». Лёгкий expand (без achievements).
  async getGroupJournal(groupId) {
    try {
      // Внешних (вписанных вручную, без тестов) в журнал сдачи не показываем.
      const students = (await this.getStudentsByGroup(groupId)).filter((s) => !s.external);
      const perStudent = await Promise.all(
        students.map(async (s) => {
          let attempts = [];
          try {
            attempts = await pb.collection('attempts').getFullList({
              filter: `student = "${escapeFilter(s.id)}"`,
              expand: 'session,session.work,session.mc_test,session.trig_mc_test',
              sort: '-created',
            });
          } catch (e) {
            console.error('journal: attempts for student failed', s.id, e?.message);
          }
          return { student: s, attempts };
        }),
      );
      return { students, perStudent };
    } catch (error) {
      console.error('Error building group journal:', error);
      throw error;
    }
  },
};
