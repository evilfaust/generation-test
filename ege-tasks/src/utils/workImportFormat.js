/**
 * Формат импорта работы целиком (`.md`) — парсер, сериализатор и генератор
 * промпта для внешней LLM. Спецификация: WORK_IMPORT_FORMAT.md в корне репозитория.
 *
 * Отличие от markdownTaskParser (импорт пачки задач одной темы): здесь читается
 * ГОТОВАЯ РАБОТА — варианты, порядок задач, у каждой задачи своя тема. Поэтому
 * парсер отдельный, старые форматы (ege/mordkovich/sdamgia) не трогаются.
 *
 * Ключевое правило разбора: метастроки задачи («тема:», «ответ:», …) идут сразу
 * под заголовком `### N` и ДО условия. Так граница условия однозначна, и внутри
 * условия разрешено писать что угодно — абзацы, таблицы, ```numline/```plot и
 * даже строку, начинающуюся со слова «Ответ:».
 */

import { parseYamlFrontmatter, parseTags } from './markdownTaskParser';

// ── Словари ключей ───────────────────────────────────────────────────────────

// Метастроки задачи: ключ в файле → поле в разобранной задаче.
const TASK_META_KEYS = {
  'тема': 'topicName',
  'topic': 'topicName',
  'подтема': 'subtopicName',
  'subtopic': 'subtopicName',
  'ответ': 'answer',
  'answer': 'answer',
  'сложность': 'difficulty',
  'difficulty': 'difficulty',
  'теги': 'tags',
  'tags': 'tags',
  'баллы': 'maxScore',
  'score': 'maxScore',
  'max_score': 'maxScore',
  'часть': 'examPart',
  'part': 'examPart',
  'exam_part': 'examPart',
  'решу': 'sdamgiaId',
  'sdamgia': 'sdamgiaId',
  'sdamgia_id': 'sdamgiaId',
  'источник': 'source',
  'source': 'source',
  'год': 'year',
  'year': 'year',
};

// Ключи шапки работы (YAML frontmatter).
const WORK_META_KEYS = {
  'работа': 'title',
  'work': 'title',
  'название': 'title',
  'title': 'title',
  'класс': 'classNumber',
  'class': 'classNumber',
  'класс_работы': 'classNumber',
  'контекст': 'examType',
  'exam_type': 'examType',
  'тип': 'examType',
  'экзамен': 'examType',
  'тема': 'topicName',
  'topic': 'topicName',
  'подтема': 'subtopicName',
  'subtopic': 'subtopicName',
  'время': 'timeLimit',
  'time_limit': 'timeLimit',
  'время_мин': 'timeLimit',
  'источник': 'source',
  'source': 'source',
  'автор': 'source',
  'год': 'year',
  'year': 'year',
  'теги': 'tags',
  'tags': 'tags',
  'сложность': 'difficulty',
  'difficulty': 'difficulty',
};

// topics.exam_type — select с фиксированным списком значений. Новое значение
// из интерфейса не создать (нужна миграция схемы PB), поэтому здесь только
// сопоставление человеческих написаний с существующими вариантами.
export const EXAM_TYPES = ['ege_base', 'ege_profile', 'oge', 'vpr', 'trig', 'mordkovich', 'oral', 'other'];

const EXAM_TYPE_ALIASES = {
  'ege base': 'ege_base',
  'егэ база': 'ege_base',
  'егэ базовый': 'ege_base',
  'база': 'ege_base',
  'базовый': 'ege_base',
  'ege profile': 'ege_profile',
  'ege prof': 'ege_profile',
  'егэ профиль': 'ege_profile',
  'егэ профильный': 'ege_profile',
  'профиль': 'ege_profile',
  'профильный': 'ege_profile',
  'огэ': 'oge',
  'впр': 'vpr',
  'тригонометрия': 'trig',
  'триг': 'trig',
  'мордкович': 'mordkovich',
  'устный счет': 'oral',
  'устный': 'oral',
  'прочее': 'other',
  'другое': 'other',
};

// Подсекции задачи (`#### Решение`) → поле.
const TASK_SECTIONS = {
  'решение': 'solution_md',
  'solution': 'solution_md',
  'критерии': 'criteria_md',
  'criteria': 'criteria_md',
  'пояснение': 'explanation_md',
  'комментарий': 'explanation_md',
  'explanation': 'explanation_md',
};

const MAX_VARIANTS = 4;

// ── Мелкие помощники ─────────────────────────────────────────────────────────

const normKey = (s) => String(s || '').trim().toLowerCase().replace(/ё/g, 'е');

// Нормализация значения под словарь алиасов: «ЕГЭ, профильный» → «егэ профильный».
const normAlias = (s) => normKey(s).replace(/[.,;:!?«»"'()\[\]]/g, ' ').replace(/№/g, ' ').replace(/\s+/g, ' ').trim();

// Номер задачи как ключ сопоставления с блоком ответов: «№1 а» → «1а».
const normTaskNumber = (s) => normKey(s).replace(/[№.,)\s]/g, '');

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
const CYRILLIC_ORDER = { 'а': 1, 'б': 2, 'в': 3, 'г': 4, 'д': 5 };

/** «2» / «II» / «Б» → 2. Вернёт null, если распознать не удалось. */
function toVariantNumber(raw) {
  const s = normKey(raw);
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (ROMAN[s]) return ROMAN[s];
  if (CYRILLIC_ORDER[s]) return CYRILLIC_ORDER[s];
  return null;
}

/** Приводит значение `контекст:` к одному из EXAM_TYPES. */
export function resolveExamType(raw) {
  if (!raw) return null;
  const direct = normKey(raw).replace(/\s+/g, '_');
  if (EXAM_TYPES.includes(direct)) return direct;
  const alias = EXAM_TYPE_ALIASES[normAlias(raw)];
  return alias || null;
}

// Границы слова: \b в JS считает кириллицу не-буквой, поэтому «Ответы» и
// «Вариант Б» через \b не ловятся — вместо неё lookahead на продолжение слова.
const NOT_WORD_AHEAD = '(?![0-9a-zа-яё])';
const RE_ANSWERS_HEADING = new RegExp(`^(ответы|ответ|ключи|ключ|answers)${NOT_WORD_AHEAD}`, 'i');
const RE_VARIANT_AFTER = new RegExp(`(?:вариант|variant)[а-яё]*\\s*(?:№\\s*)?([0-9]{1,2}|[ivx]{1,4}|[а-д])${NOT_WORD_AHEAD}`, 'i');
const RE_VARIANT_BEFORE = /([0-9]{1,2}|[ivx]{1,4}|[а-д])\s*[-—.)]?\s*(?:вариант|variant)/i;

/**
 * Заголовок `## …` → тип секции.
 * Порядок проверок важен: «Ответы к варианту 2» — это блок ответов, а не вариант.
 */
export function parseSectionHeading(text) {
  const t = String(text || '').trim();
  if (!t) return { type: 'other', title: t };

  if (RE_ANSWERS_HEADING.test(t)) {
    const m = t.match(RE_VARIANT_AFTER);
    return { type: 'answers', variantNumber: m ? toVariantNumber(m[1]) : null, title: t };
  }

  if (/вариант|variant/i.test(t)) {
    const m = t.match(RE_VARIANT_AFTER) || t.match(RE_VARIANT_BEFORE);
    return { type: 'variant', number: m ? toVariantNumber(m[1]) : null, title: t };
  }

  return { type: 'other', title: t };
}

/** Строка блока ответов: «1) 5», «2. -3», «3 — 12», «4 - x=2». */
function parseAnswerLine(line) {
  const m = String(line).match(/^\s*(?:№\s*)?(\d{1,3}[а-яa-z]?)\s*(?:[).:]|—|–|\s-\s)\s*(.+?)\s*$/i);
  if (!m) return null;
  return { number: m[1], answer: m[2].trim() };
}

/** Плейсхолдеры чертежей: markdown-картинки, чей адрес не http(s):// и не data:. */
export function extractImagePlaceholders(md) {
  const keys = [];
  const re = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(String(md || ''))) !== null) {
    const src = m[1].trim();
    if (/^(https?:|data:|\/|\.{1,2}\/)/i.test(src)) continue;
    if (!keys.includes(src)) keys.push(src);
  }
  return keys;
}

/**
 * Убирает плейсхолдер картинки из текста: файл уходит в поле tasks.image,
 * а ссылка в markdown стала бы битой картинкой.
 */
export function removeImagePlaceholder(md, key) {
  if (!md || !key) return md || '';
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(md)
    .replace(new RegExp(`!\\[[^\\]]*\\]\\(\\s*${escaped}\\s*(?:\\s+"[^"]*")?\\)`, 'g'), '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Убирает пустые строки по краям блока, сохраняя внутренние. */
function joinBlock(lines) {
  const out = [...lines];
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join('\n');
}

/** Проверяет, открывает/закрывает ли строка fenced-блок (``` или ~~~). */
function fenceToken(line) {
  const m = line.match(/^\s*(`{3,}|~{3,})/);
  return m ? m[1][0] : null;
}

function makeTask(number) {
  return {
    number: String(number || '').trim(),
    statement_md: '',
    answer: '',
    topicName: '',
    subtopicName: '',
    difficulty: '',
    tags: [],
    solution_md: '',
    criteria_md: '',
    explanation_md: '',
    maxScore: null,
    examPart: null,
    sdamgiaId: '',
    source: '',
    year: null,
    images: [],
  };
}

// ── Парсер ───────────────────────────────────────────────────────────────────

/**
 * Разбирает `.md` работы.
 *
 * @param {string} text — содержимое файла
 * @returns {{work: object, variants: Array, imagePlaceholders: string[], errors: string[], warnings: string[]}}
 */
export function parseWorkMarkdown(text) {
  const errors = [];
  const warnings = [];

  const { metadata, content, yamlError } = parseYamlFrontmatter(String(text || ''));
  if (yamlError) {
    errors.push(`Ошибка в YAML-шапке: ${yamlError}`);
    return { work: {}, variants: [], imagePlaceholders: [], errors, warnings };
  }

  // 1. Шапка работы
  const work = {
    title: '',
    classNumber: null,
    examType: null,
    topicName: '',
    subtopicName: '',
    timeLimit: null,
    source: '',
    year: null,
    tags: [],
    difficulty: '',
    instructions: '',
  };

  if (metadata && typeof metadata === 'object') {
    for (const [rawKey, rawValue] of Object.entries(metadata)) {
      const field = WORK_META_KEYS[normKey(rawKey)];
      if (!field) continue;
      if (field === 'tags') work.tags = parseTags(rawValue);
      else if (field === 'classNumber' || field === 'timeLimit' || field === 'year') {
        const n = parseInt(String(rawValue).replace(/[^\d-]/g, ''), 10);
        work[field] = Number.isFinite(n) ? n : null;
      } else if (field === 'examType') {
        const resolved = resolveExamType(rawValue);
        if (!resolved) warnings.push(`Неизвестный контекст «${rawValue}» — выберите тип экзамена в мастере`);
        work.examType = resolved;
      } else {
        work[field] = String(rawValue ?? '').trim();
      }
    }
  }

  // 2. Разбор тела
  const variants = [];
  const answerBlocks = [];
  const introLines = [];

  let currentVariant = null;
  let currentTask = null;
  let mode = 'intro';        // intro | meta | statement | section | answers
  let sectionField = null;   // куда пишем при mode === 'section'
  let buffer = [];
  let currentAnswers = null;
  let fence = null;

  const flushBuffer = () => {
    if (!currentTask) { buffer = []; return; }
    const value = joinBlock(buffer);
    if (mode === 'statement') currentTask.statement_md = value;
    else if (mode === 'section' && sectionField) currentTask[sectionField] = value;
    buffer = [];
  };

  const closeTask = () => {
    flushBuffer();
    currentTask = null;
    sectionField = null;
  };

  const ensureVariant = () => {
    if (currentVariant) return currentVariant;
    currentVariant = { number: variants.length + 1, title: '', tasks: [] };
    variants.push(currentVariant);
    return currentVariant;
  };

  const lines = String(content || '').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');

    // Fenced-блоки: внутри них заголовки — это текст, а не разделители.
    const token = fenceToken(line);
    if (token) {
      if (!fence) fence = token;
      else if (fence === token) fence = null;
    }

    if (!fence) {
      const h1 = line.match(/^#\s+(.*)$/);
      const h2 = line.match(/^##\s+(.*)$/);
      const h3 = line.match(/^###\s+(.*)$/);
      const h4 = line.match(/^####\s+(.*)$/);

      if (h4) {
        // Подсекция задачи: #### Решение / #### Критерии
        const field = TASK_SECTIONS[normKey(h4[1]).replace(/[:.]+$/, '')];
        if (!currentTask) {
          warnings.push(`Секция «${h4[1].trim()}» встретилась вне задачи — пропущена`);
          continue;
        }
        flushBuffer();
        if (!field) {
          warnings.push(`Неизвестная секция «${h4[1].trim()}» в задаче ${currentTask.number || '?'} — пропущена`);
          mode = 'section';
          sectionField = null;
        } else {
          mode = 'section';
          sectionField = field;
        }
        continue;
      }

      if (h3) {
        // Новая задача
        closeTask();
        const heading = h3[1].trim();
        const numMatch = heading.match(/(\d{1,3}\s*[а-яa-z]?)/i);
        const number = numMatch ? numMatch[1].replace(/\s+/g, '') : heading;
        currentTask = makeTask(number);
        ensureVariant().tasks.push(currentTask);
        mode = 'meta';
        currentAnswers = null;
        continue;
      }

      if (h2) {
        closeTask();
        const section = parseSectionHeading(h2[1]);
        if (section.type === 'variant') {
          const number = section.number || variants.length + 1;
          if (variants.some((v) => v.number === number)) {
            warnings.push(`Вариант ${number} встречается несколько раз — задачи объединены`);
            currentVariant = variants.find((v) => v.number === number);
          } else {
            currentVariant = { number, title: section.title, tasks: [] };
            variants.push(currentVariant);
          }
          mode = 'intro';
        } else if (section.type === 'answers') {
          currentAnswers = { variantNumber: section.variantNumber || currentVariant?.number || 1, items: [] };
          answerBlocks.push(currentAnswers);
          mode = 'answers';
        } else {
          introLines.push(`## ${section.title}`);
          mode = 'intro';
        }
        continue;
      }

      if (h1) {
        closeTask();
        if (!work.title) work.title = h1[1].trim();
        mode = 'intro';
        continue;
      }
    }

    // Не заголовок — обычная строка
    if (mode === 'answers') {
      if (!line.trim()) continue;
      const parsed = parseAnswerLine(line);
      if (parsed) currentAnswers.items.push(parsed);
      else warnings.push(`Строка блока ответов не разобрана: «${line.trim()}»`);
      continue;
    }

    if (mode === 'intro') {
      if (line.trim() || introLines.length) introLines.push(line);
      continue;
    }

    if (mode === 'meta') {
      if (!line.trim()) continue; // пустые строки между метастроками допустимы
      const metaMatch = line.match(/^\s*([A-Za-zА-Яа-яЁё_]+)\s*:\s*(.*)$/);
      const field = metaMatch ? TASK_META_KEYS[normKey(metaMatch[1])] : null;
      if (field) {
        applyTaskMeta(currentTask, field, metaMatch[2], warnings);
        continue;
      }
      // Первая не-метастрока начинает условие
      mode = 'statement';
      buffer = [line];
      continue;
    }

    if (mode === 'statement' && !fence && currentTask) {
      // Метастрока после условия: значение не подхватываем (правило формата),
      // но текст сохраняем и предупреждаем — иначе он потеряется молча.
      const late = line.match(/^\s*([A-Za-zА-Яа-яЁё_]+)\s*:\s*(.+)$/);
      if (late && TASK_META_KEYS[normKey(late[1])]) {
        warnings.push(`Задача ${currentTask.number || '?'}: «${late[1].trim()}:» стоит после условия — перенесите строку под заголовок задачи`);
      }
    }

    buffer.push(line);
  }

  closeTask();

  // 3. Общая часть работы (текст и секции вне вариантов)
  work.instructions = joinBlock(introLines);

  // 4. Ответы из блоков `## Ответы`
  for (const block of answerBlocks) {
    const variant = variants.find((v) => v.number === block.variantNumber) || variants[0];
    if (!variant) {
      warnings.push('Блок ответов есть, а вариантов с задачами нет');
      continue;
    }
    for (const item of block.items) {
      const task = variant.tasks.find((t) => normTaskNumber(t.number) === normTaskNumber(item.number));
      if (!task) {
        warnings.push(`Ответ «${item.number}» из блока ответов не нашёл задачу в варианте ${variant.number}`);
        continue;
      }
      if (task.answer && task.answer !== item.answer) {
        warnings.push(`Задача ${task.number} (вариант ${variant.number}): ответ в задаче «${task.answer}» не совпал с блоком ответов «${item.answer}» — оставлен ответ задачи`);
        continue;
      }
      if (!task.answer) task.answer = item.answer;
    }
  }

  // 5. Значения по умолчанию из шапки + чертежи + валидация
  const placeholders = [];
  variants.forEach((variant, vIdx) => {
    variant.tasks.forEach((task, tIdx) => {
      task.position = tIdx;

      if (!task.topicName) task.topicName = work.topicName;
      if (!task.subtopicName) task.subtopicName = work.subtopicName;
      if (!task.difficulty) task.difficulty = work.difficulty || '1';
      if (!task.source) task.source = work.source;
      if (task.year == null) task.year = work.year;
      if (work.tags.length) task.tags = [...new Set([...work.tags, ...task.tags])];

      const condition = extractImagePlaceholders(task.statement_md).map((key) => ({ key, role: 'condition' }));
      const solution = extractImagePlaceholders(task.solution_md).map((key) => ({ key, role: 'solution' }));
      task.images = [...condition, ...solution];
      task.images.forEach((img) => { if (!placeholders.includes(img.key)) placeholders.push(img.key); });

      const where = `вариант ${variant.number}, задача ${task.number || tIdx + 1}`;
      if (!task.statement_md.trim()) errors.push(`Пустое условие (${where})`);
      if (!task.answer.trim()) warnings.push(`Нет ответа (${where})`);
      if (!task.topicName) warnings.push(`Не указана тема (${where})`);
    });

    // Дубли номеров внутри варианта
    const seen = new Set();
    variant.tasks.forEach((task) => {
      const key = normTaskNumber(task.number);
      if (key && seen.has(key)) warnings.push(`Вариант ${variant.number}: номер задачи «${task.number}» повторяется`);
      seen.add(key);
    });

    if (vIdx > 0 && variant.tasks.length !== variants[0].tasks.length) {
      warnings.push(`В варианте ${variant.number} задач ${variant.tasks.length}, а в варианте ${variants[0].number} — ${variants[0].tasks.length}`);
    }
  });

  if (variants.length > MAX_VARIANTS) {
    warnings.push(`Вариантов ${variants.length} — больше ${MAX_VARIANTS}; проверьте разметку «## Вариант N»`);
  }

  const totalTasks = variants.reduce((sum, v) => sum + v.tasks.length, 0);
  if (totalTasks === 0) {
    errors.push('Задачи не найдены. Каждая задача начинается с заголовка «### 1»');
  }

  if (!work.title) work.title = 'Импортированная работа';

  return { work, variants, imagePlaceholders: placeholders, errors, warnings };
}

/** Записывает значение метастроки в задачу с приведением типов. */
function applyTaskMeta(task, field, rawValue, warnings) {
  const value = String(rawValue ?? '').trim();
  switch (field) {
    case 'tags':
      task.tags = parseTags(value);
      break;
    case 'difficulty': {
      const n = parseInt(value, 10);
      if (n >= 1 && n <= 5) task.difficulty = String(n);
      else warnings.push(`Задача ${task.number || '?'}: сложность «${value}» вне диапазона 1–5 — оставлена по умолчанию`);
      break;
    }
    case 'maxScore': {
      const n = parseInt(value, 10);
      task.maxScore = Number.isFinite(n) ? n : null;
      break;
    }
    case 'examPart': {
      const n = parseInt(value, 10);
      if (n === 1 || n === 2) task.examPart = n;
      else warnings.push(`Задача ${task.number || '?'}: часть «${value}» — ожидалось 1 или 2`);
      break;
    }
    case 'year': {
      const n = parseInt(value, 10);
      task.year = Number.isFinite(n) ? n : null;
      break;
    }
    default:
      task[field] = value;
  }
}

// ── Сериализация: работа → `.md` ─────────────────────────────────────────────

/** Экранирует значение метастроки: перевод строки сломал бы формат. */
const metaValue = (v) => String(v ?? '').replace(/\s*\n\s*/g, ' ').trim();

function serializeTask(task, ctx) {
  const { topicTitleById, subtopicTitleById, tagTitleById, imageUrl, workDefaults } = ctx;
  const out = [];
  out.push(`### ${task.number ?? task.position + 1}`);

  const topicTitle = topicTitleById.get(task.topic) || task.topicName || '';
  if (topicTitle && topicTitle !== workDefaults.topicTitle) out.push(`тема: ${metaValue(topicTitle)}`);

  const subtopicIds = Array.isArray(task.subtopic) ? task.subtopic : (task.subtopic ? [task.subtopic] : []);
  const subtopicTitle = subtopicIds.map((id) => subtopicTitleById.get(id)).filter(Boolean).join(', ');
  if (subtopicTitle) out.push(`подтема: ${metaValue(subtopicTitle)}`);

  if (task.answer) out.push(`ответ: ${metaValue(task.answer)}`);
  if (task.difficulty && String(task.difficulty) !== '1') out.push(`сложность: ${task.difficulty}`);

  const tagIds = Array.isArray(task.tags) ? task.tags : (task.tags ? [task.tags] : []);
  const tagTitles = tagIds.map((id) => tagTitleById.get(id) || id).filter(Boolean);
  if (tagTitles.length) out.push(`теги: [${tagTitles.join(', ')}]`);

  if (task.max_score) out.push(`баллы: ${task.max_score}`);
  if (task.exam_part) out.push(`часть: ${task.exam_part}`);
  if (task.sdamgia_id) out.push(`решу: ${task.sdamgia_id}`);

  let statement = String(task.statement_md || '').trim();
  const url = imageUrl ? imageUrl(task) : null;
  // Чертёж из legacy-поля tasks.image в тексте условия не упомянут — дописываем
  // ссылкой, иначе при обратном импорте картинка потеряется.
  if (url && !statement.includes(url)) statement = statement ? `${statement}\n\n![](${url})` : `![](${url})`;

  out.push('', statement);

  if (task.solution_md) out.push('', '#### Решение', task.solution_md.trim());
  if (task.criteria_md) out.push('', '#### Критерии', task.criteria_md.trim());
  if (task.explanation_md) out.push('', '#### Пояснение', task.explanation_md.trim());

  return out.join('\n');
}

/**
 * Собирает `.md` из сохранённой работы — обратная операция к parseWorkMarkdown.
 * Позволяет отдать работу коллеге текстом и импортировать её обратно.
 *
 * @param {object} params
 * @param {object} params.work — запись works
 * @param {Array}  params.variants — [{ number, tasks: [запись tasks] }]
 * @param {Array}  [params.topics] / [params.subtopics] / [params.tags] — справочники для названий
 * @param {Function} [params.imageUrl] — (task) => URL картинки задачи (обычно api.getTaskImageUrl)
 */
export function buildWorkMarkdown({ work = {}, variants = [], topics = [], subtopics = [], tags = [], imageUrl = null } = {}) {
  const topicTitleById = new Map(topics.map((t) => [t.id, t.title]));
  const subtopicTitleById = new Map(subtopics.map((st) => [st.id, st.name]));
  const tagTitleById = new Map(tags.map((t) => [t.id, t.title]));

  const workTopic = topicTitleById.get(work.topic) || '';
  const examType = topics.find((t) => t.id === work.topic)?.exam_type || null;

  const header = ['---'];
  header.push(`работа: ${metaValue(work.title || 'Работа')}`);
  if (work.class) header.push(`класс: ${work.class}`);
  if (examType) header.push(`контекст: ${examType}`);
  if (workTopic) header.push(`тема: ${metaValue(workTopic)}`);
  if (work.time_limit) header.push(`время: ${work.time_limit}`);
  if (work.source) header.push(`источник: ${metaValue(work.source)}`);
  header.push('---');

  const ctx = {
    topicTitleById,
    subtopicTitleById,
    tagTitleById,
    imageUrl,
    workDefaults: { topicTitle: workTopic },
  };

  const body = [];
  const multi = variants.length > 1;
  variants.forEach((variant, idx) => {
    if (multi) body.push('', `## Вариант ${variant.number ?? idx + 1}`);
    (variant.tasks || []).forEach((task, tIdx) => {
      body.push('', serializeTask({ ...task, position: tIdx, number: task.number ?? tIdx + 1 }, ctx));
    });
  });

  return `${header.join('\n')}\n${body.join('\n')}\n`.replace(/\n{3,}/g, '\n\n');
}

// ── Промпт для внешней LLM ───────────────────────────────────────────────────

/**
 * Собирает промпт, который учитель копирует во внешнюю модель вместе с фото
 * листка. В промпт вшит актуальный каталог тем — модель проставляет темы,
 * которые уже есть в базе, а не выдумывает свои.
 *
 * @param {object} params
 * @param {Array}  params.topics — записи topics (id, title, exam_type, ege_number)
 * @param {string} [params.examType] — сузить каталог до одного контекста
 * @param {number} [params.classNumber]
 * @param {number} [params.maxTopics=400]
 */
export function buildAiPrompt({ topics = [], examType = null, classNumber = null, maxTopics = 400 } = {}) {
  const filtered = examType ? topics.filter((t) => t.exam_type === examType) : topics;
  const list = filtered.slice(0, maxTopics).map((t) => {
    const num = t.ege_number ? ` (№${t.ege_number})` : '';
    return `- ${t.title}${num}`;
  });
  const truncated = filtered.length > maxTopics;

  return [
    'Ты помогаешь перенести школьную работу по математике с фото/скана в текстовый формат.',
    '',
    'Верни ОДИН markdown-файл строго по формату ниже. Без пояснений до и после, без ```-ограждений вокруг всего файла.',
    '',
    '=== ФОРМАТ ===',
    '',
    '---',
    'работа: <название работы>',
    `класс: <число>${classNumber ? ` (здесь: ${classNumber})` : ''}`,
    'время: <минуты, если указано>',
    'источник: <автор/откуда, если известно>',
    '---',
    '',
    '## Вариант 1',
    '',
    '### 1',
    'тема: <тема из списка ниже>',
    'ответ: <ответ, если он есть на листке>',
    'сложность: <1-5, если явно понятно; иначе не пиши>',
    '',
    '<условие задачи>',
    '',
    '### 2',
    'тема: ...',
    '',
    '<условие задачи>',
    '',
    '## Вариант 2',
    '',
    '### 1',
    '...',
    '',
    '=== ПРАВИЛА ===',
    '',
    '1. Метастроки («тема:», «ответ:», «сложность:», «теги:», «баллы:», «часть:») идут СРАЗУ под заголовком задачи и ДО условия. После условия их писать нельзя.',
    '2. Условие — это всё после метастрок до следующего заголовка. В нём можно писать абзацы, списки, таблицы.',
    '3. Формулы — в LaTeX внутри $…$ (KaTeX): дроби \\frac{a}{b}, корни \\sqrt{x}, степени x^{2}, индексы x_{0}. Десятичный разделитель — запятая: $0{,}5$.',
    '4. Если на листке есть чертёж/график/рисунок — вставь в условие плейсхолдер вида ![](рис1), ![](рис2), нумеруя подряд по всей работе. Сам чертёж описывать словами не нужно.',
    '5. Ничего не выдумывай: нет ответа на листке — не пиши строку «ответ:». Не решай задачи за автора.',
    '6. Сохраняй нумерацию и разбивку на варианты как на листке. Если вариант один — секцию «## Вариант» можно не писать.',
    '7. Если ответы напечатаны общим списком, вынеси их в конец варианта секцией «## Ответы» строками вида «1) 5».',
    '8. Тему бери ТОЛЬКО из списка ниже, копируя название точно. Не подходит ни одна — напиши свою короткую тему, её проверят вручную.',
    '',
    '=== ТЕМЫ В БАЗЕ ===',
    '',
    ...(list.length ? list : ['(список тем не передан — пиши свои короткие названия тем)']),
    ...(truncated ? ['', `(показаны первые ${maxTopics} тем из ${filtered.length})`] : []),
  ].join('\n');
}
