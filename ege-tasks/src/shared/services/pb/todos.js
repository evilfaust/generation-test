import { pb, _logAudit } from './client.js';
import { escapeFilter } from '../../utils/escapeFilter';

const TODO_EXPAND = 'group,source_note,folder,student,lesson,work';

// Сдвиг даты для повтора (plain Date, без dayjs в API-слое).
function shiftDate(iso, repeat) {
  const d = iso ? new Date(iso) : new Date();
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeat === 'monthly') d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// Папки-списки для «Дел» (todo_folders).
export const todoFoldersApi = {
  async getTodoFolders() {
    try {
      return await pb.collection('todo_folders').getFullList({ sort: 'sort_order,created' });
    } catch (error) {
      console.error('Error fetching todo folders:', error);
      return [];
    }
  },

  async createTodoFolder(data = {}) {
    const owner = pb.authStore.model?.id;
    return pb.collection('todo_folders').create({ color: 'neutral', ...data, owner });
  },

  async updateTodoFolder(id, data) {
    const { owner, ...rest } = data;
    return pb.collection('todo_folders').update(id, rest);
  },

  // Удаление папки: дела внутри не трогаем (cascadeDelete=false) — они уходят
  // во «Входящие» (folder становится пустым автоматически на стороне PB).
  async deleteTodoFolder(id) {
    await pb.collection('todo_folders').delete(id);
    return true;
  },

  async reorderTodoFolders(orderedIds) {
    await Promise.all(orderedIds.map((id, i) =>
      pb.collection('todo_folders').update(id, { sort_order: i * 10 })));
  },
};

// Учительские «Дела» (teacher_todos). НЕ путать с банком математических задач.
export const todosApi = {
  async getTodos() {
    try {
      return await pb.collection('teacher_todos').getFullList({
        sort: 'done,sort_order,-created',
        expand: TODO_EXPAND,
      });
    } catch (error) {
      console.error('Error fetching todos:', error);
      return [];
    }
  },

  async createTodo(data = {}) {
    try {
      const owner = pb.authStore.model?.id;
      const rec = await pb.collection('teacher_todos').create({
        done: false,
        priority: 'normal',
        ...data,
        owner,
      }, { expand: TODO_EXPAND });
      _logAudit('create', 'teacher_todos', rec.id, rec.title || '');
      return rec;
    } catch (error) {
      console.error('Error creating todo:', error);
      throw error;
    }
  },

  async updateTodo(id, data) {
    try {
      const { owner, ...rest } = data;
      return await pb.collection('teacher_todos').update(id, rest, { expand: TODO_EXPAND });
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  },

  async deleteTodo(id) {
    try {
      await pb.collection('teacher_todos').delete(id);
      _logAudit('delete', 'teacher_todos', id, '');
      return true;
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  },

  // Отметить дело сделанным. Если у него задан repeat — создаёт следующий
  // экземпляр со сдвинутым сроком (та же папка/привязки/повтор). Возвращает
  // { updated, next } (next=null, если не повторяющееся).
  async completeTodo(todo) {
    const updated = await this.updateTodo(todo.id, { done: true });
    let next = null;
    if (todo.repeat) {
      next = await this.createTodo({
        title: todo.title,
        folder: todo.folder || '',
        priority: todo.priority || 'normal',
        group: todo.group || '',
        student: todo.student || '',
        lesson: todo.lesson || '',
        work: todo.work || '',
        repeat: todo.repeat,
        due_date: shiftDate(todo.due_date, todo.repeat),
      });
    }
    return { updated, next };
  },

  async reorderTodos(orderedIds) {
    await Promise.all(orderedIds.map((id, i) =>
      pb.collection('teacher_todos').update(id, { sort_order: i * 10 })));
  },

  // Выгрузка незакрытых пунктов чек-листа заметки в «Дела».
  async exportNoteTasks(note, items, folder) {
    try {
      if (!note?.id || !Array.isArray(items) || !items.length) return [];
      const existing = await pb.collection('teacher_todos').getFullList({
        filter: `source_note = "${escapeFilter(note.id)}"`,
      });
      const seen = new Set(existing.map((t) => t.source_block).filter(Boolean));
      const created = [];
      for (const it of items) {
        const title = (it.text || '').trim();
        if (!title) continue;
        if (it.blockId && seen.has(it.blockId)) continue;
        const rec = await this.createTodo({
          title,
          source_note: note.id,
          source_block: it.blockId || '',
          group: note.group || '',
          folder: folder || '',
        });
        created.push(rec);
      }
      return created;
    } catch (error) {
      console.error('Error exporting note tasks:', error);
      throw error;
    }
  },
};
