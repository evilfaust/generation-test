import { pb, _logAudit, withOwner, andOwner } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

// Сохранённые листы генераторов (коллекция `generator_sheets`, миграция 1784200000).
//
// Запись = лист целиком: настройки генератора + все варианты заданий + порядок
// заданий на листе. В банк задач (`tasks`) при этом ничего не пишется — лист
// живёт отдельной сущностью, чтобы каталог экзаменационных задач не раздувался.
//
// Список отдаётся БЕЗ tasks_data: снимок заданий весит до сотен килобайт,
// а в списке нужны только название, тип и размер листа. Полную запись
// (с заданиями) отдаёт getGeneratorSheet(id).
const LIST_FIELDS = [
  'id', 'title', 'generator', 'kind', 'variants_count', 'questions_count',
  'class_number', 'folder', 'is_pinned', 'note', 'created', 'updated', 'owner',
].join(',');

export const sheetsApi = {
  // Список сохранённых листов. generator — фильтр по типу генератора
  // ('linear_equations'), search — по названию.
  async getGeneratorSheets(options = {}) {
    const { generator = null, search = '', folder = null } = options;

    try {
      const filterArr = [];
      if (generator) filterArr.push(`generator = "${escapeFilter(generator)}"`);
      if (folder)    filterArr.push(`folder = "${escapeFilter(folder)}"`);
      if (search)    filterArr.push(`title ~ "${escapeFilter(search)}"`);

      return await pb.collection('generator_sheets').getFullList({
        // Закреплённые сверху, дальше — свежие
        sort: '-is_pinned,-created',
        fields: LIST_FIELDS,
        filter: andOwner(filterArr.join(' && ')),
      });
    } catch (error) {
      console.error('Error fetching generator_sheets:', error);
      return [];
    }
  },

  // Полная запись — с заданиями и настройками (для загрузки в генератор)
  async getGeneratorSheet(id) {
    try {
      return await pb.collection('generator_sheets').getOne(id);
    } catch (error) {
      console.error('Error fetching generator_sheet:', error);
      throw error;
    }
  },

  async createGeneratorSheet(data) {
    try {
      const rec = await pb.collection('generator_sheets').create(withOwner(data));
      _logAudit('create', 'generator_sheets', rec.id, rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating generator_sheet:', error);
      throw error;
    }
  },

  async updateGeneratorSheet(id, data) {
    try {
      return await pb.collection('generator_sheets').update(id, data);
    } catch (error) {
      console.error('Error updating generator_sheet:', error);
      throw error;
    }
  },

  async deleteGeneratorSheet(id) {
    try {
      // Сводку читаем до удаления — после записи уже не будет
      let summary = '';
      try {
        const rec = await pb.collection('generator_sheets').getOne(id, { fields: 'title' });
        summary = rec?.title || '';
      } catch { /* сводка не критична */ }

      const res = await pb.collection('generator_sheets').delete(id);
      _logAudit('delete', 'generator_sheets', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting generator_sheet:', error);
      throw error;
    }
  },

  // Папки-ярлыки, которые уже встречались у листов — для подсказок в поле «Папка»
  async getGeneratorSheetFolders() {
    try {
      const records = await pb.collection('generator_sheets').getFullList({
        fields: 'folder',
        filter: andOwner('folder != ""'),
      });
      return [...new Set(records.map((r) => r.folder).filter(Boolean))].sort();
    } catch (error) {
      console.error('Error fetching generator_sheet folders:', error);
      return [];
    }
  },
};

export default sheetsApi;
