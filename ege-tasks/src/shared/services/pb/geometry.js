import { pb, _logAudit, withOwner, andOwner } from './client.js';
import { PB_BASE_URL } from '../pocketbaseUrl';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';
import { searchCaseVariants, MIN_SEARCH_LENGTH } from '../../utils/searchVariants';

export const geometryApi = {
  // ─── Geometry Topics ──────────────────────────────────────────────────────

  async getGeometryTopics() {
    try {
      return await pb.collection('geometry_topics').getFullList({ sort: 'order,title' });
    } catch (error) {
      console.error('Error fetching geometry topics:', error);
      return [];
    }
  },

  async createGeometryTopic(data) {
    try {
      return await pb.collection('geometry_topics').create(data);
    } catch (error) {
      console.error('Error creating geometry topic:', error);
      throw error;
    }
  },

  async updateGeometryTopic(id, data) {
    try {
      return await pb.collection('geometry_topics').update(id, data);
    } catch (error) {
      console.error('Error updating geometry topic:', error);
      throw error;
    }
  },

  async deleteGeometryTopic(id) {
    try {
      return await pb.collection('geometry_topics').delete(id);
    } catch (error) {
      console.error('Error deleting geometry topic:', error);
      throw error;
    }
  },

  // ─── Geometry Subtopics ───────────────────────────────────────────────────

  async getGeometrySubtopics(topicId = null) {
    try {
      const filter = topicId ? `topic = "${escapeFilter(topicId)}"` : '';
      return await pb.collection('geometry_subtopics').getFullList({
        filter,
        sort: 'order,title',
        expand: 'topic',
      });
    } catch (error) {
      console.error('Error fetching geometry subtopics:', error);
      return [];
    }
  },

  async createGeometrySubtopic(data) {
    try {
      return await pb.collection('geometry_subtopics').create(data);
    } catch (error) {
      console.error('Error creating geometry subtopic:', error);
      throw error;
    }
  },

  async updateGeometrySubtopic(id, data) {
    try {
      return await pb.collection('geometry_subtopics').update(id, data);
    } catch (error) {
      console.error('Error updating geometry subtopic:', error);
      throw error;
    }
  },

  async deleteGeometrySubtopic(id) {
    try {
      return await pb.collection('geometry_subtopics').delete(id);
    } catch (error) {
      console.error('Error deleting geometry subtopic:', error);
      throw error;
    }
  },

  // ─── Geometry Tasks ───────────────────────────────────────────────────────

  /**
   * Возвращает URL PNG-чертежа задачи (файл из PocketBase storage).
   */
  getGeometryImageUrl(task) {
    const fileName = task?.geogebra_image_base64 || task?.drawing_image || '';

    if (task?.id && fileName && !String(fileName).startsWith('data:image/')) {
      return `${PB_BASE_URL}/api/files/geometry_tasks/${task.id}/${fileName}`;
    }
    // Для in-memory предпросмотра (до сохранения файла) допускаем data:image только из PNG-поля.
    return String(fileName).startsWith('data:image/') ? fileName : '';
  },

  async getGeometryTasks(filters = {}) {
    try {
      const filterArr = [];

      if (filters.topic) {
        filterArr.push(`topic = "${escapeFilter(filters.topic)}"`);
      }
      if (filters.subtopic) {
        filterArr.push(`subtopic = "${escapeFilter(filters.subtopic)}"`);
      }
      if (filters.difficulty) {
        filterArr.push(`difficulty = ${Number(filters.difficulty)}`);
      }
      if (filters.source) {
        filterArr.push(`source = "${escapeFilter(filters.source)}"`);
      }
      // origin: 'manual' — свои задачи (пустой origin у старых = свои); 'mccme' — банк МЦНМО
      if (filters.origin === 'mccme') {
        filterArr.push(`origin = "mccme"`);
      } else if (filters.origin === 'manual') {
        filterArr.push(`(origin = "" || origin = "manual")`);
      }
      // tags: массив id фасетных тегов (geometry_tags) — AND по каждому выбранному
      if (Array.isArray(filters.tags) && filters.tags.length) {
        for (const t of filters.tags) {
          filterArr.push(`tags ~ "${escapeFilter(t)}"`);
        }
      }
      // Кириллица в SQLite регистрозависима — перебираем написания
      // (см. searchCaseVariants), иначе «Треугольник» не находит «треугольник».
      const search = String(filters.search || '').trim();
      if (search.length >= MIN_SEARCH_LENGTH) {
        const conds = searchCaseVariants(search).flatMap((v) => {
          const t = escapeFilter(v);
          return [`code ~ "${t}"`, `title ~ "${t}"`, `statement_md ~ "${t}"`, `answer ~ "${t}"`, `source ~ "${t}"`];
        });
        filterArr.push(`(${conds.join(' || ')})`);
      }

      // Исключаем тяжёлые base64-поля из списка — они перенесены в файловое поле drawing_image.
      // geogebra_base64 (XML состояние, ~30-100KB) нужен только в редакторе → getGeometryTask().
      const LIGHT_FIELDS = [
        'id', 'code', 'title', 'topic', 'subtopic', 'difficulty',
        'statement_md',  // нужен для быстрого предпросмотра
        'answer', 'hints', 'geogebra_appname', 'drawing_view', 'drawing_svg', 'source', 'year',
        'origin', 'mccme_id', 'tags',
        'preview_layout', 'geogebra_image_base64', 'drawing_image', 'created', 'updated',
        'expand.topic.id', 'expand.topic.title',
        'expand.subtopic.id', 'expand.subtopic.title',
        // geogebra_base64 (XML состояние, ~30-100KB) только в редакторе → getGeometryTask()
        // solution_md только в редакторе → getGeometryTask()
      ].join(',');

      return await pb.collection('geometry_tasks').getFullList({
        filter: filterArr.join(' && '),
        sort: 'code',
        expand: 'topic,subtopic',
        fields: LIGHT_FIELDS,
      });
    } catch (error) {
      console.error('Error fetching geometry tasks:', error);
      return [];
    }
  },

  // Фасетные теги банка МЦНМО (geometry_tags). kind: object|method|fact|named|source.
  // Возвращает сгруппированно по kind: { object: [...], method: [...], fact: [...] }.
  async getGeometryTags() {
    try {
      const rows = await pb.collection('geometry_tags').getFullList({
        sort: 'name',
        fields: 'id,kind,name,mccme_id',
      });
      const byKind = { object: [], method: [], fact: [], named: [], source: [] };
      for (const r of rows) (byKind[r.kind] ||= []).push(r);
      return byKind;
    } catch (error) {
      console.error('Error fetching geometry tags:', error);
      return { object: [], method: [], fact: [], named: [], source: [] };
    }
  },

  async updateGeometryTag(id, data) {
    try {
      return await pb.collection('geometry_tags').update(id, data);
    } catch (error) {
      console.error('Error updating geometry tag:', error);
      throw error;
    }
  },

  async deleteGeometryTag(id) {
    try {
      return await pb.collection('geometry_tags').delete(id);
    } catch (error) {
      console.error('Error deleting geometry tag:', error);
      throw error;
    }
  },

  // Уникальные непустые источники из всех задач геометрии — для фильтра по источнику.
  async getGeometrySources() {
    try {
      const rows = await pb.collection('geometry_tasks').getFullList({
        fields: 'source',
        sort: 'source',
      });
      const set = new Set();
      for (const r of rows) {
        const s = (r.source || '').trim();
        if (s) set.add(s);
      }
      return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
    } catch (error) {
      console.error('Error fetching geometry sources:', error);
      return [];
    }
  },

  async getGeometryTask(id) {
    try {
      // Полная запись со всеми полями (включая geogebra_base64 для редактора)
      return await pb.collection('geometry_tasks').getOne(id, {
        expand: 'topic,subtopic',
      });
    } catch (error) {
      console.error('Error fetching geometry task:', error);
      throw error;
    }
  },

  async createGeometryTask(data) {
    try {
      // PocketBase SDK автоматически создаёт FormData, если data содержит File/Blob.
      // drawing_image передаётся как File-объект из редактора.
      const rec = await pb.collection('geometry_tasks').create(data);
      _logAudit('create', 'geometry_tasks', rec.id, rec.code || rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating geometry task:', error);
      throw error;
    }
  },

  async updateGeometryTask(id, data) {
    try {
      // Аналогично: если data.drawing_image — File, SDK сам сформирует FormData.
      return await pb.collection('geometry_tasks').update(id, data);
    } catch (error) {
      console.error('Error updating geometry task:', error);
      throw error;
    }
  },

  async duplicateGeometryTask(id) {
    try {
      // Полная запись (включая geogebra_base64 и solution_md)
      const task = await pb.collection('geometry_tasks').getOne(id);

      const formData = new FormData();

      // Текстовые поля — копируем как есть
      const TEXT_FIELDS = [
        'title', 'topic', 'subtopic', 'difficulty', 'statement_md',
        'answer', 'hints', 'geogebra_appname', 'drawing_view', 'drawing_svg',
        'source', 'year', 'preview_layout', 'solution_md', 'geogebra_base64',
      ];
      for (const field of TEXT_FIELDS) {
        if (task[field] != null && task[field] !== '') {
          formData.append(field, task[field]);
        }
      }

      // Код: добавляем суффикс «-копия»
      if (task.code) {
        formData.append('code', task.code + '-копия');
      }

      // Вложения решения (json-массив ссылок на pb-files) — сериализуем явно,
      // иначе FormData.append превратит массив в "[object Object]".
      if (Array.isArray(task.solution_files) && task.solution_files.length) {
        formData.append('solution_files', JSON.stringify(task.solution_files));
      }

      // Файл чертежа: скачиваем из PocketBase и перезаливаем
      const drawingFileName = task.drawing_image || task.geogebra_image_base64 || '';
      if (drawingFileName && !String(drawingFileName).startsWith('data:image/')) {
        const fileUrl = `${PB_BASE_URL}/api/files/geometry_tasks/${task.id}/${drawingFileName}`;
        try {
          const resp = await fetch(fileUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            formData.append('drawing_image', new File([blob], drawingFileName, { type: blob.type || 'image/png' }));
          }
        } catch {
          // Не смогли скопировать файл — продолжаем без него
        }
      }

      return await pb.collection('geometry_tasks').create(formData);
    } catch (error) {
      console.error('Error duplicating geometry task:', error);
      throw error;
    }
  },

  async deleteGeometryTask(id) {
    try {
      let summary = id;
      try {
        const t = await pb.collection('geometry_tasks').getOne(id, { fields: 'id,code,title' });
        summary = t.code || t.title || id;
      } catch (_) {}
      const res = await pb.collection('geometry_tasks').delete(id);
      _logAudit('delete', 'geometry_tasks', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting geometry task:', error);
      throw error;
    }
  },

  // Импорт геометрических задач в обычные (tasks).
  // Возвращает { added, errors, details[] }.
  async importGeometryTasksToRegular(ids, { topicId, subtopicId } = {}) {
    const results = { added: 0, errors: 0, details: [] };
    for (const id of ids) {
      try {
        const geo = await pb.collection('geometry_tasks').getOne(id);

        const formData = new FormData();
        const TEXT_FIELDS = ['statement_md', 'answer', 'solution_md', 'title', 'source', 'year', 'difficulty'];
        for (const f of TEXT_FIELDS) {
          if (geo[f] != null && geo[f] !== '') formData.append(f, String(geo[f]));
        }
        if (geo.code) formData.append('code', geo.code);
        if (topicId) formData.append('topic', topicId);
        if (subtopicId) formData.append('subtopic', subtopicId);
        formData.append('has_image', 'false');

        // Копируем чертёж как image задачи
        const imgFileName = geo.drawing_image || geo.geogebra_image_base64;
        if (imgFileName && !String(imgFileName).startsWith('data:image/')) {
          const fileUrl = `${PB_BASE_URL}/api/files/geometry_tasks/${geo.id}/${imgFileName}`;
          try {
            const resp = await fetch(fileUrl);
            if (resp.ok) {
              const blob = await resp.blob();
              formData.append('image', new File([blob], imgFileName, { type: blob.type || 'image/png' }));
              formData.set('has_image', 'true');
            }
          } catch {
            // продолжаем без изображения
          }
        }

        await pb.collection('tasks').create(formData);
        results.added++;
        results.details.push({ status: 'added', message: `${geo.code || id} — импортирована` });
      } catch (e) {
        results.errors++;
        results.details.push({ status: 'error', message: `${id}: ${e?.message || 'неизвестная ошибка'}` });
      }
    }
    return results;
  },

  async createGeometryPrintTest(data) {
    try {
      return await pb.collection('geometry_print_tests').create(withOwner(data));
    } catch (error) {
      console.error('Error creating geometry print test:', error);
      throw error;
    }
  },

  async getGeometryPrintTests() {
    try {
      return await pb.collection('geometry_print_tests').getFullList({
        sort: '-created',
        expand: 'tasks',
        filter: andOwner(),
      });
    } catch (error) {
      console.error('Error fetching geometry print tests:', error);
      return [];
    }
  },

  async getGeometryPrintTest(id) {
    try {
      return await pb.collection('geometry_print_tests').getOne(id, {
        expand: 'tasks',
      });
    } catch (error) {
      console.error('Error fetching geometry print test:', error);
      throw error;
    }
  },

  async updateGeometryPrintTest(id, data) {
    try {
      return await pb.collection('geometry_print_tests').update(id, data);
    } catch (error) {
      console.error('Error updating geometry print test:', error);
      throw error;
    }
  },

  async deleteGeometryPrintTest(id) {
    try {
      return await pb.collection('geometry_print_tests').delete(id);
    } catch (error) {
      console.error('Error deleting geometry print test:', error);
      throw error;
    }
  },

};
