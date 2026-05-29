// Общие настройки бенчмарка. Меняй здесь.
import fs from 'node:fs';

export const PB_URL = process.env.PB_URL || 'https://task-ege.oipav.ru';
export const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
export const MODEL = process.env.EMBED_MODEL || 'bge-m3';

// Куда пушить векторы при index.mjs --push (pdf-service на VPS).
export const PDF_URL = process.env.PDF_URL || 'https://task-ege.oipav.ru/pdf';
// Токен: из env (launchd-агент) ИЛИ из локального файла .index-token (для ручных
// запусков `npm run dedup` без ввода токена). Файл gitignored, плейнтекст.
function readTokenFile() {
  try { return fs.readFileSync(new URL('../.index-token', import.meta.url).pathname, 'utf8').trim(); }
  catch { return ''; }
}
export const INDEX_TOKEN = process.env.INDEX_TOKEN || readTokenFile();

// Сколько задач затягиваем в пул для бенчмарка (из ~11k).
// Чем больше — тем выше шанс найти реальные дубли, но дольше эмбеддинг.
export const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE || 1500);

// Сколько пар отдаём на ручную разметку.
export const PAIRS_TO_LABEL = Number(process.env.PAIRS_TO_LABEL || 90);

// Файлы артефактов
export const F_TASKS = new URL('../data/tasks-sample.json', import.meta.url).pathname;
export const F_VECTORS = new URL('../data/vectors.json', import.meta.url).pathname;
export const F_PAIRS = new URL('../data/pairs-to-label.csv', import.meta.url).pathname;
export const F_LABELED = new URL('../data/pairs-labeled.csv', import.meta.url).pathname;
