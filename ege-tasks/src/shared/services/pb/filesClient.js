// Второй PocketBase — файловое хранилище (pb-files на малине, files.l.oipav.ru).
// Отдельный клиент со СВОИМ authStore (ключ 'pbf_auth'), чтобы токен хранилища не
// конфликтовал с учительским токеном основного pb (ключ 'pocketbase_auth').
//
// Архитектура: pb-files владеет файлами (коллекция `materials`), боевой VPS-PB
// хранит только ссылки. Запись закрыта логином в auth-коллекцию `users`
// (identity=email, токен 60 дней). Чтение публичное. См. memory/pb_files_storage.
import PocketBase, { LocalAuthStore } from 'pocketbase';

const DEFAULT_FILES_URL = 'https://files.l.oipav.ru';
const trimTrailingSlash = (url) => String(url || '').replace(/\/+$/, '');

const resolveFilesUrl = () => {
  const envUrl = trimTrailingSlash(import.meta.env.VITE_PB_FILES_URL);
  if (!envUrl) return DEFAULT_FILES_URL;
  try {
    const parsed = new URL(envUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return envUrl;
  } catch {
    /* invalid → fallback */
  }
  console.warn('[pb-files] Invalid VITE_PB_FILES_URL, fallback to default');
  return DEFAULT_FILES_URL;
};

export const FILES_BASE_URL = resolveFilesUrl();

export const pbFiles = new PocketBase(FILES_BASE_URL, new LocalAuthStore('pbf_auth'));
pbFiles.autoCancellation(false);

// Запоминаем последний email подключения для предзаполнения формы.
const LAST_EMAIL_KEY = 'pbf_last_email';

export const CATEGORY_LABELS = {
  textbook: 'Учебник',
  worksheet: 'Рабочий лист',
  generated: 'Сгенерировано в Лемме',
  methodical: 'Методичка',
  reference: 'Справочник',
  other: 'Прочее',
};

export const materialsApi = {
  // ── Подключение (логин в `users`) ──────────────────────────────────────────
  isConnected() {
    return pbFiles.authStore.isValid && pbFiles.authStore.model?.collectionName === 'users';
  },
  connectedEmail() {
    return pbFiles.authStore.model?.email || '';
  },
  lastEmail() {
    try { return localStorage.getItem(LAST_EMAIL_KEY) || ''; } catch { return ''; }
  },
  async connect(email, password) {
    const res = await pbFiles.collection('users').authWithPassword(email, password);
    try { localStorage.setItem(LAST_EMAIL_KEY, email); } catch { /* no-op */ }
    return res;
  },
  disconnect() {
    pbFiles.authStore.clear();
  },

  // ── CRUD материалов ─────────────────────────────────────────────────────────
  async listMaterials({ page = 1, perPage = 40, category = '', search = '', sort = '-created' } = {}) {
    const parts = [];
    if (category) parts.push(pbFiles.filter('category = {:c}', { c: category }));
    if (search) {
      parts.push(pbFiles.filter(
        '(title ~ {:q} || original_name ~ {:q} || subject ~ {:q} || description ~ {:q})',
        { q: search },
      ));
    }
    const filter = parts.join(' && ');
    return pbFiles.collection('materials').getList(page, perPage, {
      sort,
      ...(filter ? { filter } : {}),
    });
  },

  async uploadMaterial({ file, title, category = 'other', subject = '', tags = [], description = '' }) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title || file.name);
    fd.append('original_name', file.name);
    fd.append('category', category);
    fd.append('size', String(file.size || 0));
    fd.append('mime', file.type || '');
    if (subject) fd.append('subject', subject);
    if (description) fd.append('description', description);
    fd.append('tags', JSON.stringify(Array.isArray(tags) ? tags : []));
    return pbFiles.collection('materials').create(fd);
  },

  async updateMaterial(id, data) {
    return pbFiles.collection('materials').update(id, data);
  },

  async deleteMaterial(id) {
    return pbFiles.collection('materials').delete(id);
  },

  // Прямая ссылка на файл (чтение публичное — токен не нужен).
  fileUrl(record) {
    if (!record?.id || !record?.file) return '';
    return `${FILES_BASE_URL}/api/files/materials/${record.id}/${encodeURIComponent(record.file)}`;
  },
};
