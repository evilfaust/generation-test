import { pb, _logAudit } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Фича «Листки»: листки Гордина (kind=official) + свои листки учителя (kind=teacher).
// Задачи — в общем банке `tasks` (source='listok_gordin'); элементы листа в
// listok_items (type task|heading). См. CLAUDE.md + memory listki_57_feature.

const LIB_FIELDS = 'id,kind,course,part_order,title,slug,source_url,pdf_url,owner,folder,is_pinned,published,cloned_from,updated';

export const listkiApi = {
  // ---- Чтение ----
  async getOfficialSheets() {
    return pb.collection('listok_sheets').getFullList({
      filter: "kind='official'", sort: 'course,part_order', fields: LIB_FIELDS,
    });
  },
  async getTeacherSheets() {
    return pb.collection('listok_sheets').getFullList({
      filter: "kind='teacher'", sort: '-is_pinned,-updated', fields: LIB_FIELDS,
    });
  },
  async getListokSheet(id) {
    return pb.collection('listok_sheets').getOne(id);
  },
  async getListokItems(sheetId) {
    return pb.collection('listok_items').getFullList({
      filter: `sheet='${escapeFilter(sheetId)}'`, sort: 'order', expand: 'task',
    });
  },

  // ---- CRUD листа учителя ----
  async createListok(data) {
    const rec = await pb.collection('listok_sheets').create({ kind: 'teacher', published: true, ...data });
    _logAudit('create', 'listok_sheets', rec.id, rec.title);
    return rec;
  },
  async updateListok(id, data) {
    return pb.collection('listok_sheets').update(id, data);
  },
  async deleteListok(id) {
    let title = '';
    try { title = (await pb.collection('listok_sheets').getOne(id, { fields: 'title' })).title; } catch { /* ignore */ }
    await pb.collection('listok_sheets').delete(id); // listok_items удалятся каскадом
    _logAudit('delete', 'listok_sheets', id, title);
  },

  // ---- Элементы листа ----
  async addListokItem(data) {
    return pb.collection('listok_items').create(data);
  },
  async updateListokItem(id, data) {
    return pb.collection('listok_items').update(id, data);
  },
  async removeListokItem(id) {
    return pb.collection('listok_items').delete(id);
  },
  // items: [{ id, order }]
  async reorderListokItems(items) {
    for (const it of items) await pb.collection('listok_items').update(it.id, { order: it.order });
  },

  // ---- Клонирование официального листа в свой ----
  async cloneListok(sourceId, { title = null, owner = null } = {}) {
    const src = await this.getListokSheet(sourceId);
    const items = await this.getListokItems(sourceId);
    const sheet = await this.createListok({
      course: src.course || null,
      title: title || `${src.title} (моя копия)`,
      intro_md: src.intro_md || '',
      owner: owner || null,
      cloned_from: sourceId,
    });
    let order = 0;
    for (const it of items) {
      await this.addListokItem({
        sheet: sheet.id, type: it.type, task: it.task || null,
        heading_text: it.heading_text || '', order: order++,
        flag: it.flag || null, section: it.section || 'main',
      });
    }
    return sheet;
  },

  // ---- Выдать ученику: создать работу из задач листа (далее — флоу «Мои работы») ----
  async createWorkFromListok(sheet, items = null) {
    const list = items || (await this.getListokItems(sheet.id));
    const taskIds = list.filter((i) => i.type === 'task' && i.task).map((i) => i.task);
    const work = await pb.collection('works').create({ title: sheet.title || 'Листок' });
    await pb.collection('variants').create({
      work: work.id, number: 1, tasks: taskIds,
      order: taskIds.map((id, idx) => ({ taskId: id, position: idx })),
    });
    _logAudit('create', 'works', work.id, sheet.title);
    return work;
  },
};

export default listkiApi;
