/**
 * PDF Generation Service using Puppeteer
 * Standalone Node.js service for high-quality PDF generation
 */

import express from 'express';
// Поддержка puppeteer-core (VPS с системным Chromium) и puppeteer (локально)
let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  puppeteer = (await import('puppeteer-core')).default;
}
import cors from 'cors';
import * as cheerio from 'cheerio';
import { fixLatex } from './latex-fixer.js';
// Семантический поиск похожих задач (sqlite-vec). Грузим мягко: если модуль/vec.db
// недоступны — сервис всё равно стартует, /similar вернёт 503.
let findSimilar = null, vecHealth = null, getDuplicateClusters = null, findPairs = null;
try {
  ({ findSimilar, vecHealth, getDuplicateClusters, findPairs } = await import('./vec-search.js'));
} catch (e) {
  console.warn('[pdf-service] vec-search недоступен:', e.message);
}
// KaTeX — серверный рендер для валидации формул (latex_needs_review)
let katex = null;
try {
  katex = (await import('katex')).default;
} catch {
  console.warn('[pdf-service] katex недоступен, валидация формул отключена');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Глобальная переменная для браузера (переиспользование)
let browser = null;

/**
 * Получить или создать браузер
 */
async function getBrowser() {
  if (browser && browser.connected) {
    return browser;
  }

  console.log('[PDF] Запуск Chromium...');
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  };

  // На VPS используем системный Chromium через env
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    console.log(`[PDF] Используется системный Chromium: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
  }

  browser = await puppeteer.launch(launchOptions);

  browser.on('disconnected', () => {
    console.log('[PDF] Браузер отключен');
    browser = null;
  });

  return browser;
}

/**
 * POST /generate
 * Генерация PDF из HTML
 */
app.post('/generate', async (req, res) => {
  const startTime = Date.now();
  let page = null;

  try {
    const { html, filename = 'document.pdf', options = {} } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    console.log(`[PDF] Генерация: ${filename}`);

    // Получаем браузер
    const browserInstance = await getBrowser();

    // Создаём новую страницу
    page = await browserInstance.newPage();

    // Устанавливаем viewport
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    });

    // Загружаем HTML
    await page.setContent(html, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 30000,
    });

    // Ждём загрузки шрифтов
    await page.evaluateHandle('document.fonts.ready');

    // Небольшая задержка для KaTeX (новый синтаксис)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Генерируем PDF
    const pdf = await page.pdf({
      format: options.format || 'A4',
      landscape: options.landscape || false,
      printBackground: true,
      preferCSSPageSize: options.preferCSSPageSize || false,
      margin: {
        top: options.marginTop || '7mm',
        bottom: options.marginBottom || '7mm',
        left: options.marginLeft || '7mm',
        right: options.marginRight || '7mm',
      },
      displayHeaderFooter: false,
    });

    // Закрываем страницу
    await page.close();

    const duration = Date.now() - startTime;
    console.log(`[PDF] Готово: ${filename} (${pdf.length} bytes, ${duration}ms)`);

    // Отправляем PDF
    // Кодируем имя файла для поддержки кириллицы
    const encodedFilename = encodeURIComponent(filename);

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      'Content-Length': pdf.length,
    });
    res.end(pdf, 'binary');

  } catch (error) {
    console.error('[PDF] Ошибка:', error);

    // Закрываем страницу при ошибке
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // ignore
      }
    }

    res.status(500).json({
      error: 'PDF generation failed',
      message: error.message,
    });
  }
});

// ============================================================
// SDAMGIA PARSER — порт логики из par.py
// ============================================================

const SDAMGIA_BASE_URL = 'https://mathb-ege.sdamgia.ru';
const NEWLINE_MARKER = '___BR___';

/**
 * Очистка LaTeX формул от русских слов (alt-текст из SVG формул sdamgia)
 * Порт clean_latex_formula из par.py
 */
function cleanLatexFormula(text) {
  // Убираем точки в конце
  text = text.replace(/\.+$/, '');

  // Нормализация невидимых символов и Unicode-математики сразу —
  // упрощает все последующие регулярки (не нужно ставить ? в каждом паттерне).
  text = text.replace(/­/g, ''); // soft hyphen
  text = text.replace(/​/g, ''); // zero-width space
  text = text.replace(/ /g, ' '); // nbsp → обычный пробел
  // Unicode-символы √ и ∛/∜ → LaTeX (sdamgia иногда ставит их вместо слова «корень из»)
  text = text.replace(/√/g, '\\sqrt ');  // √ → \sqrt
  text = text.replace(/∛/g, '\\sqrt[3]'); // ∛ → \sqrt[3]
  text = text.replace(/∜/g, '\\sqrt[4]'); // ∜ → \sqrt[4]

  // Словарные замены русских слов на LaTeX команды
  const replacements = [
    // Тригонометрия (обрабатываем ДО греческих букв!)
    ['тан\u00ADгенс', '\\tan'],
    ['тангенс', '\\tan'],
    ['ко\u00ADтан\u00ADгенс', '\\cot'],
    ['котангенс', '\\cot'],
    ['ко\u00ADси\u00ADнус', '\\cos'],
    ['косинус', '\\cos'],
    ['си\u00ADнус', '\\sin'],
    ['синус', '\\sin'],

    // Греческие буквы
    ['альфа', '\\alpha'],
    ['аль\u00ADфа', '\\alpha'],
    ['бета', '\\beta'],
    ['бе\u00ADта', '\\beta'],
    ['гамма', '\\gamma'],
    ['гам\u00ADма', '\\gamma'],
    ['дельта', '\\delta'],
    ['дель\u00ADта', '\\delta'],
    // 'пи' / 'Пи' обрабатываются отдельно через regex с границами слов,
    // потому что эта подстрока встречается внутри множества других слов
    // (правая, приведём, верхняя и т.п.) и replaceAll бы их испортил.

    // Скобки и знаки
    ['левая круг\u00ADлая скоб\u00ADка', '('],
    ['пра\u00ADвая круг\u00ADлая скоб\u00ADка', ')'],
    ['плюс', '+'],
    ['минус', '-'],
    ['умно\u00ADжить на', '\\cdot'],
    ['де\u00ADлить на', '/'],

    // Степени
    ['в квад\u00ADра\u00ADте', '^{2}'],
    ['в кубе', '^{3}'],
    ['в сте\u00ADпе\u00ADни', '^'],

    // Логарифмы
    ['ло\u00ADга\u00ADрифм по ос\u00ADно\u00ADва\u00ADнию', '\\log'],
    ['на\u00ADту\u00ADраль\u00ADный ло\u00ADга\u00ADрифм', '\\ln'],

    // Системы
    ['си\u00ADсте\u00ADма вы\u00ADра\u00ADже\u00ADний', ''],
    ['новая стро\u00ADка', ''],
    ['конец си\u00ADсте\u00ADмы', ''],

    // Неравенства
    ['рав\u00ADно\u00ADсиль\u00ADно', '\\Leftrightarrow'],
    ['боль\u00ADше или равно', '\\geq'],
    ['мень\u00ADше или равно', '\\leq'],
    ['боль\u00ADше', '>'],
    ['мень\u00ADше', '<'],

    // Специальные слова
    ['ра\u00ADду\u00ADсов', ''], // убираем "радусов" (артефакт парсинга углов)
    ['радусов', ''],

    // Квадратные и фигурные скобки (alt MathML без soft-hyphens — новые задачи)
    ['леваяквадратнаяскобка', '\\left['],
    ['праваяквадратнаяскобка', '\\right]'],
    ['левая квадратная скобка', '\\left['],
    ['правая квадратная скобка', '\\right]'],
    ['леваяфигурнаяскобка', '\\left\\{'],
    ['праваяфигурнаяскобка', '\\right\\}'],
    ['левая фигурная скобка', '\\left\\{'],
    ['правая фигурная скобка', '\\right\\}'],

    // Множества и отношения (тригонометрия, теория чисел)
    ['не принадлежит', '\\notin'],
    ['принадлежит', '\\in'],
    ['множество целых чисел', '\\mathbb{Z}'],
    ['множество натуральных чисел', '\\mathbb{N}'],
    ['множество рациональных чисел', '\\mathbb{Q}'],
    ['множество действительных чисел', '\\mathbb{R}'],

    // ± / ∓ (часто в тригонометрии)
    ['плюс минус', '\\pm'],
    ['плюс-минус', '\\pm'],
    ['минус плюс', '\\mp'],
    ['минус-плюс', '\\mp'],

    // Бесконечность
    ['бесконечность', '\\infty'],
  ];

  // text уже нормализован (без soft-hyphens) выше — нормализуем и ключи словаря,
  // чтобы старые записи продолжали работать.
  //
  // ВАЖНО: новый формат alt MathML sdamgia слепляет слова без пробелов
  // («кореньиз», «леваякруглаяскобка», «началоаргумента», ...). Поэтому
  // ПЕРЕД основным циклом делаем pass-1: для каждой многословной записи
  // словаря пробуем concat-вариант (все пробелы вырезаны). Это покрывает
  // десятки фраз разом, без ручного дублирования каждой строки.
  for (const [old, rep] of replacements) {
    const normalizedKey = old.replace(/­/g, '').replace(/​/g, '');
    if (/\s/.test(normalizedKey)) {
      const concatKey = normalizedKey.replace(/\s+/g, '');
      // concat-форма должна быть достаточно длинной чтобы не задеть
      // случайные подстроки (например 'минусплюс' = 9 символов).
      if (concatKey.length >= 8) {
        text = text.replaceAll(concatKey, rep);
      }
    }
  }

  for (const [old, rep] of replacements) {
    const normalizedKey = old.replace(/­/g, '').replace(/​/g, '');
    text = text.replaceAll(normalizedKey, rep);
  }

  // Короткие слова — отдельно через regex с не-буквенными границами,
  // чтобы не задеть подстроки внутри обычных слов («пи» в «правая», «приведём»).
  text = text.replace(/(?<![а-яА-Я])(?:пи|Пи)(?![а-яА-Я])/g, '\\pi');

  // Корни N-ой степени: корень N степени из: начало аргумента: X конец аргумента
  text = text.replace(
    /ко\u00ADрень\s+(\d+)\s+сте\u00ADпе\u00ADни\s+из:\s*на\u00ADча\u00ADло ар\u00ADгу\u00ADмен\u00ADта:\s*(.*?)\s*конец ар\u00ADгу\u00ADмен\u00ADта/g,
    (_, n, arg) => `\\sqrt[${n}]{${arg.trim()}}`
  );

  // Корни с аргументами: корень из: начало аргумента: X конец аргумента
  text = text.replace(
    /ко\u00ADрень из:\s*на\u00ADча\u00ADло ар\u00ADгу\u00ADмен\u00ADта:\s*(.*?)\s*конец ар\u00ADгу\u00ADмен\u00ADта/g,
    (_, arg) => `\\sqrt{${arg.trim()}}`
  );

  // LaTeX sqrt с аргументами: \sqrt: начало аргумента: X конец аргумента
  text = text.replace(
    /\\sqrt:\s*на\u00ADча\u00ADло ар\u00ADгу\u00ADмен\u00ADта:\s*(.*?)\s*конец ар\u00ADгу\u00ADмен\u00ADта/g,
    (_, arg) => `\\sqrt{${arg.trim()}}`
  );

  // ─── Те же шаблоны для alt MathML без пробелов (новый формат sdamgia) ───
  // Пример: «(2 sin x + кореньиз : началоаргумента : 3 конецаргумента)»

  // Корни N-ой степени: кореньN степени из : началоаргумента : X конецаргумента
  text = text.replace(
    /корень\s*(\d+)\s*степени\s+из\s*:?\s*началоаргумента\s*:?\s*(.*?)\s*конецаргумента/gi,
    (_, n, arg) => `\\sqrt[${n}]{${arg.trim()}}`
  );

  // Корни с аргументом: кореньиз : началоаргумента : X конецаргумента
  text = text.replace(
    /корень\s*из\s*:?\s*началоаргумента\s*:?\s*(.*?)\s*конецаргумента/gi,
    (_, arg) => `\\sqrt{${arg.trim()}}`
  );

  // LaTeX sqrt: \\sqrt или \\sqrt[N] + :началоаргумента: X конецаргумента
  text = text.replace(
    /\\sqrt((?:\[\d+\])?)\s*:?\s*началоаргумента\s*:?\s*(.*?)\s*конецаргумента/gi,
    (_, degree, arg) => `\\sqrt${degree}{${arg.trim()}}`
  );

  // Простой корень без аргументов
  text = text.replaceAll('ко\u00ADрень из', '\\sqrt');
  text = text.replace(/корень\s*из(?![а-яА-Я])/gi, '\\sqrt');

  // Убираем оставшиеся маркеры аргументов (старый и новый форматы)
  text = text.replaceAll('на\u00ADча\u00ADло ар\u00ADгу\u00ADмен\u00ADта:', '');
  text = text.replaceAll('конец ар\u00ADгу\u00ADмен\u00ADта', '');
  text = text.replace(/началоаргумента\s*:?/gi, '');
  text = text.replace(/конецаргумента/gi, '');

  // Обработка дробей (рекурсивно, от внутренних к внешним).
  // Терпимо к: пробелам вокруг ':', концевому 'конецдроби'/'конец дроби'.
  // Soft-hyphens срезаны в начале функции, поэтому их в regex нет.
  for (let i = 0; i < 10; i++) {
    const fractionRegex = /дробь\s*:\s*числитель\s*:\s*(.*?)\s*,?\s*знаменатель\s*:\s*(.*?)\s*конец\s*дроби/i;
    const match = text.match(fractionRegex);
    if (!match) break;
    const numerator = match[1].trim();
    const denominator = match[2].trim();
    text = text.slice(0, match.index) + `\\frac{${numerator}}{${denominator}}` + text.slice(match.index + match[0].length);
  }

  // ─── Новые шаблоны alt MathML без soft-hyphens (актуальные задачи sdamgia) ───

  // «дробная часть : числитель : A, знаменатель : B» → \frac{A}{B}
  for (let i = 0; i < 10; i++) {
    const m = text.match(
      /дробная\s+часть\s*:?\s*числитель\s*:?\s*([^,;]+?)\s*,\s*знаменатель\s*:?\s*([^.,;]+?)(?=[\s,.;]|$)/i
    );
    if (!m) break;
    text = text.slice(0, m.index) + `\\frac{${m[1].trim()}}{${m[2].trim()}}` + text.slice(m.index + m[0].length);
  }

  // «целая часть : N» → _{N} (alt MathML подстрочного индекса для log/lg/ln).
  // Берём одно число или одну букву как индекс. Опциональная завершающая
  // запятая поглощается — alt вида «log целая часть : 2, дробная часть : ...»
  // должен превратиться в «\log_{2} \frac{...}», без лишней «,» посередине.
  text = text.replace(
    /целая\s+часть\s*:?\s*(\d+|[A-Za-zА-Яа-я])\s*,?(?=\s*(?:дробная|\\frac|$|[^,]))/gi,
    '_{$1}'
  );
  // Простой fallback на случай если контекст не подошёл lookahead'у
  text = text.replace(/целая\s+часть\s*:?\s*(\d+|[A-Za-zА-Яа-я])/gi, '_{$1}');

  // «совокупность выражений X1, X2 ... конец совокупности» → квадратная скобка.
  text = text.replace(
    /совокупность\s+выражений\s+(.+?)\s+конец\s+совокупности/gi,
    (_, content) => {
      const lines = content.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
      return `\\left[\\begin{array}{l} ${lines.join(' \\\\ ')} \\end{array}\\right.`;
    }
  );

  // «система выражений X1, X2 ... конец системы» → \begin{cases} (старый словарь
  // просто убирал эти слова в '', получалась каша без структуры).
  text = text.replace(
    /система\s+выражений\s+(.+?)\s+конец\s+системы/gi,
    (_, content) => {
      const lines = content.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
      return `\\begin{cases} ${lines.join(' \\\\ ')} \\end{cases}`;
    }
  );

  // Убираем множественные пробелы
  text = text.replace(/\s+/g, ' ').trim();

  // Финальная нормализация под KaTeX (см. latex-fixer.js):
  // \angleABC → \angle{ABC}, 90 г → 90^{\circ}, log a 2 → \log_{a} 2, 0,5 → 0{,}5 и т.п.
  text = fixLatex(text);

  return text;
}

/**
 * Проверка валидности LaTeX-формулы через KaTeX (для latex_needs_review).
 * Возвращает true если рендерится без ошибок.
 */
function validateLatex(formula) {
  if (!katex) return true; // если KaTeX не подгружен — считаем валидным
  try {
    katex.renderToString(formula, { throwOnError: true, strict: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Извлечь sdamgia file_id из URL вида /get_file?id=145381 или /get_file?id=145381&...
 */
function extractSdamgiaFileId(url) {
  const m = String(url || '').match(/[?&]id=(\d+)/);
  return m ? m[1] : '';
}

/**
 * Конвертирует HTML таблицу в Markdown таблицу
 */
function tableToMarkdown($, tableEl) {
  const rows = [];

  $(tableEl).find('tr').each(function () {
    const cells = [];
    $(this).find('th, td').each(function () {
      // Получаем текст ячейки (может содержать формулы через img alt)
      let cellText = $(this).text().trim();
      // Убираем переносы строк внутри ячейки
      cellText = cellText.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      // Артефакты типографики sdamgia (как в processCondition):
      cellText = cellText.replace(/­/g, ''); // soft hyphen
      cellText = cellText.replace(/​/g, ''); // zero-width space
      cells.push(cellText);
    });
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  if (rows.length === 0) return '';

  // Формируем markdown таблицу
  const lines = [];

  // Первая строка (заголовки)
  if (rows.length > 0) {
    lines.push('| ' + rows[0].join(' | ') + ' |');
    // Разделитель
    lines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');
  }

  // Остальные строки (данные)
  for (let i = 1; i < rows.length; i++) {
    lines.push('| ' + rows[i].join(' | ') + ' |');
  }

  return '\n\n' + lines.join('\n') + '\n\n';
}

/**
 * Конвертирует HTML список (ol/ul) в Markdown список
 * Обрабатывает только прямые дочерние li (> li), игнорируя вложенные списки
 */
function listToMarkdown($, listEl, ordered = true) {
  const items = [];
  let index = 1;

  $(listEl).children('li').each(function () {
    // Клонируем элемент для обработки
    const $li = $(this).clone();

    // Удаляем вложенные списки (если есть)
    $li.find('ol, ul').remove();

    let itemText = $li.text().trim();
    // Убираем лишние пробелы
    itemText = itemText.replace(/\s+/g, ' ');

    if (itemText) {
      if (ordered) {
        items.push(`${index}) ${itemText}`);
        index++;
      } else {
        items.push(`- ${itemText}`);
      }
    }
  });

  if (items.length === 0) return '';
  return '\n\n' + items.join('\n') + '\n\n';
}

/**
 * Обработка условия задачи — извлечение текста, формул, таблиц и изображений
 * Порт process_condition из par.py + поддержка таблиц
 */
function processCondition($, conditionEl, baseUrl = SDAMGIA_BASE_URL, role = 'condition') {
  if (!conditionEl) return { text: '', images: [], formulas: [] };

  // images — массив объектов { url, file_id, original_url } в порядке появления
  const images = [];
  // formulas — все LaTeX-формулы из этого блока, для валидации через KaTeX
  const formulas = [];
  let formulaIndex = 0;
  let imgIndex = 0;
  let tableIndex = 0;
  const formulaReplacements = {};
  const imageReplacements = {};
  const tableReplacements = {};

  // Клонируем элемент чтобы не менять оригинал
  const $el = $(conditionEl).clone();

  // Сначала обрабатываем формулы внутри таблиц (чтобы alt-текст попал в ячейки)
  $el.find('table img').each(function () {
    const imgUrl = $(this).attr('src') || '';
    if (imgUrl.includes('formula') || imgUrl.includes('/formula/')) {
      const altText = $(this).attr('alt') || '';
      if (altText) {
        const cleanedLatex = cleanLatexFormula(altText);
        formulas.push(cleanedLatex);
        const marker = `___FORMULA_${formulaIndex}___`;
        formulaReplacements[marker] = `$${cleanedLatex}$`;
        formulaIndex++;
        $(this).replaceWith(marker);
      } else {
        $(this).remove();
      }
    }
  });

  // Обрабатываем таблицы — конвертируем в markdown
  $el.find('table').each(function () {
    const markdownTable = tableToMarkdown($, this);
    if (markdownTable) {
      const marker = `___TABLE_${tableIndex}___`;
      tableReplacements[marker] = markdownTable;
      tableIndex++;
      $(this).replaceWith(marker);
    } else {
      $(this).remove();
    }
  });

  // Обрабатываем "фейковые" списки в параграфах (специфика sdamgia)
  // Обычно <p class="left_margin">1) ...</p>
  $el.find('p').each(function () {
    const $p = $(this);
    let text = $p.text().trim();

    // Проверяем, похоже ли это на элемент списка "1) ..." или "a) ..." или "- ..."
    // Мы хотим убедиться, что он начинается с новой строки
    if (/^\d+\)/.test(text) || /^[a-zа-я]\)/.test(text) || /^-\s/.test(text)) {
      $p.prepend(NEWLINE_MARKER);
    } else {
      // Обычный параграф - двойной перенос для разделения
      $p.prepend(NEWLINE_MARKER + NEWLINE_MARKER);
    }
  });

  // Обрабатываем нумерованные списки (ol)
  $el.find('ol').each(function () {
    let index = 1;
    const $ol = $(this);

    // Добавляем маркеры переноса
    $ol.before(NEWLINE_MARKER + NEWLINE_MARKER);

    $ol.children('li').each(function () {
      const $li = $(this);
      // Добавляем маркер и конвертируем в формат 1. для markdown
      $li.prepend(`${NEWLINE_MARKER}${index}. `);
      index++;
    });

    $ol.after(NEWLINE_MARKER + NEWLINE_MARKER);
  });

  // Обрабатываем маркированные списки (ul)
  $el.find('ul').each(function () {
    const $ul = $(this);

    $ul.before(NEWLINE_MARKER + NEWLINE_MARKER);

    $ul.children('li').each(function () {
      const $li = $(this);
      $li.prepend(`${NEWLINE_MARKER}- `);
    });

    $ul.after(NEWLINE_MARKER + NEWLINE_MARKER);
  });

  // Обрабатываем изображения (формулы и картинки вне таблиц).
  // Для формул держим Set дедупа: sdamgia на одну формулу может вставить
  // несколько <img class="tex"> с идентичным alt — оставляем только первое.
  const seenFormulaAlts = new Set();
  $el.find('img').each(function () {
    const imgUrl = $(this).attr('src') || '';
    if (!imgUrl) {
      $(this).remove();
      return;
    }

    if (imgUrl.includes('formula') || imgUrl.includes('/formula/')) {
      // SVG формула — берём alt-текст
      const altText = $(this).attr('alt') || '';
      if (altText) {
        // Ключ дедупа — нормализованный alt без невидимых символов и
        // схлопнутыми пробелами. Идентичные формулы пропускаем.
        const dedupKey = altText.replace(/[­​\s]+/g, ' ').trim();
        if (dedupKey && seenFormulaAlts.has(dedupKey)) {
          $(this).remove();
          return;
        }
        if (dedupKey) seenFormulaAlts.add(dedupKey);

        const cleanedLatex = cleanLatexFormula(altText);
        formulas.push(cleanedLatex);
        const marker = `___FORMULA_${formulaIndex}___`;
        formulaReplacements[marker] = `$${cleanedLatex}$`;
        formulaIndex++;
        $(this).replaceWith(marker);
      } else {
        $(this).remove();
      }
    } else {
      // Обычное изображение (чертёж и т.п.)
      let fullUrl = imgUrl;
      if (!fullUrl.startsWith('http')) {
        fullUrl = new URL(imgUrl, baseUrl).href;
      }
      const fileId = extractSdamgiaFileId(fullUrl);
      const order = imgIndex + 1;
      // Структурированно: фронт качает и заливает в task_images по role+order.
      images.push({ url: fullUrl, file_id: fileId, order, role });
      const marker = `___IMAGE_${imgIndex}___`;
      // ИЗМЕНЕНО v3.9.33: НЕ оставляем ![image](url) в тексте условия.
      // Картинка хранится отдельно (file-поле tasks.image + коллекция task_images);
      // все рендереры (TaskCard, EgeVariantGenerator, PrintableWorksheet и т.п.)
      // ожидают чистый текст + отдельный <Image>. Inline ![image] в statement_md
      // приводил к двойному отображению (см. v3.9.31 баг). Просто удаляем маркер.
      imageReplacements[marker] = '';
      imgIndex++;
      $(this).replaceWith(marker);
    }
  });

  // Получаем текст с маркерами и чистим пробелы (схлопываем множественные пробелы)
  let text = $el.text().replace(/\s+/g, ' ').trim();

  // Восстанавливаем переносы строк из маркеров
  text = text.replaceAll(NEWLINE_MARKER, '\n');

  // Убираем артефакты типографики SDAMGIA
  text = text.replace(/\u00AD/g, ''); // soft hyphen
  text = text.replace(/\u200B/g, ''); // zero-width space

  // Чистим множественные переносы (больше 2)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Заменяем маркеры таблиц на markdown
  for (const [marker, mdTable] of Object.entries(tableReplacements)) {
    text = text.replace(marker, mdTable);
  }

  // Заменяем маркеры формул на LaTeX
  for (const [marker, latex] of Object.entries(formulaReplacements)) {
    text = text.replace(marker, ` ${latex} `);
  }

  // Заменяем маркеры изображений на плейсхолдеры
  for (const [marker, imgMarkdown] of Object.entries(imageReplacements)) {
    text = text.replace(marker, imgMarkdown);
  }

  // Дедупликация подряд идущих одинаковых $...$ блоков: sdamgia иногда
  // вставляет 5 копий одной формулы (для retina/печати/мобильного рендера).
  // Заменяем `$X$ $X$ $X$` → `$X$`. Сравниваем content внутри $.$ (trim'нутый).
  text = text.replace(/(\$([^$]+)\$)((?:\s*\$\2\$)+)/g, '$1');

  return { text: text.trim(), images, formulas };
}

/**
 * Извлечение данных задачи из div.prob_maindiv
 * Порт parse_problem_from_div из par.py
 */
function parseProblemFromDiv($, probDiv, baseUrl) {
  try {
    const problem = {
      id: '',
      sdamgia_url: '',
      condition: '',
      answer: '',
      solution: '',
      criteria_md: '',
      max_score: null,
      condition_images: [],
      solution_images: [],
      criteria_images: [],
      latex_needs_review: false,
      // BACKWARD-COMPAT: старые поля для уже подключённого фронта (импорт части 1)
      images: [],
      solution_images_legacy: [],
    };

    // Все формулы со всех блоков — для финальной валидации флага needs_review
    const allFormulas = [];

    // ID задачи + ссылка на «Решу ЕГЭ»
    const probNums = $(probDiv).find('.prob_nums');
    if (probNums.length) {
      const link = probNums.find('a');
      if (link.length) {
        problem.id = link.text().trim();
        let href = link.attr('href') || '';
        if (href) {
          if (!href.startsWith('http')) href = new URL(href, baseUrl).href;
          problem.sdamgia_url = href;
        }
      }
    }

    // Условие задачи
    const pbody = $(probDiv).find('.pbody');
    if (pbody.length) {
      const { text, images, formulas } = processCondition($, pbody.get(0), baseUrl, 'condition');
      problem.condition = text;
      problem.condition_images = images;
      problem.images = images.map(img => img.url); // backward-compat (старый фронт)
      allFormulas.push(...formulas);
    }

    // Ответ
    const answerDiv = $(probDiv).find('.answer');
    if (answerDiv.length) {
      let answerText = answerDiv.text().trim();
      answerText = answerText.replace(/^Ответ:\s*/i, '').replace(/^ответ:\s*/i, '').trim();
      // На массовой странице (?category_id=...) для задач части 2 .answer
      // иногда содержит только маркер пункта без значения («б)», «а)»).
      // Считаем такой ответ мусорным — попробуем достать из решения ниже.
      if (/^[абвгде]\)\s*$/i.test(answerText) || answerText.length < 2) {
        answerText = '';
      }
      problem.answer = answerText;
    }

    // Решение (опционально — присутствует в ВПР и некоторых ЕГЭ задачах + всегда в части 2)
    const solutionDiv = $(probDiv).find('.solution');
    if (solutionDiv.length) {
      // Клонируем, чтобы не трогать оригинал
      const $sol = $(solutionDiv).clone();
      // ВАЖНО: критерии вынимаем ДО processCondition, чтобы не попали в решение,
      // но не удаляем — парсим отдельным проходом дальше из исходного solutionDiv.
      $sol.find('.prob_crits').remove();
      const { text: solRaw, images: solImages, formulas: solFormulas } =
        processCondition($, $sol.get(0), baseUrl, 'solution');
      // Убираем «Решение.» в начале (с возможными мягкими переносами, уже удалены processCondition)
      let solText = solRaw.replace(/^Решение\.?\s*/i, '').trim();

      // Если ответ ещё не найден (нет .answer div или там мусор типа «б)»),
      // извлекаем из решения. Sdamgia ставит «Ответ: N.» в первом решении ДО
      // блока «Приведём другое решение…». Для части 2 ищем первое вхождение.
      if (!problem.answer) {
        // Сначала пробуем найти «Ответ: …» где значение не «а)/б)/в)» одиночное
        const allAnswers = [...solText.matchAll(/Ответ:?\s*([^.\n]+?)\s*\.?(?=\s*(?:Прив[её]д[её]м|\n\n|$))/gi)];
        for (const m of allAnswers) {
          const candidate = m[1].trim().replace(/\.$/, '').trim();
          if (candidate && candidate.length > 1 && !/^[абвгде]\)\s*$/i.test(candidate)) {
            problem.answer = candidate;
            break;
          }
        }
        // Fallback — последний шанс, простой паттерн как было раньше
        if (!problem.answer) {
          const answerInSol = solText.match(/\s*Ответ:?\s*(.+?)\s*\.?\s*$/i);
          if (answerInSol) {
            problem.answer = answerInSol[1].trim().replace(/\.$/, '').trim();
          }
        }
      }

      // Sdamgia вставляет альтернативные решения в тот же .solution как обычные
      // параграфы: «Приведём другое решение пункта а).» / «Приведём ещё одно
      // решение пункта б).» Превращаем эти параграфы в markdown-подзаголовки,
      // чтобы они визуально отделялись и не выглядели как часть основного текста.
      solText = solText.replace(
        /Прив[её]д[её]м\s+(?:ещё\s+одно|другое|еще\s+одно|еще\s+один)\s+решение\s+пунк[та]+\s*([абвгде])\)\.?/gi,
        '\n\n---\n\n### Другое решение пункта $1)\n\n'
      );

      // Убираем встроенный «Ответ: X.» в начале (он повторяется в самом конце
      // основного решения), но НЕ трогаем ответы внутри альтернатив (после ---).
      // Берём только первое появление до первого ---.
      const sepIdx = solText.indexOf('\n---\n');
      const beforeSep = sepIdx >= 0 ? solText.slice(0, sepIdx) : solText;
      const afterSep = sepIdx >= 0 ? solText.slice(sepIdx) : '';
      const cleanedMain = beforeSep.replace(/\s*Ответ:?\s*[^\n]+\.?\s*$/i, '').trim();
      solText = (cleanedMain + (afterSep ? '\n' + afterSep : '')).trim();

      if (solText) {
        problem.solution = solText;
        problem.solution_images = solImages;
        problem.solution_images_legacy = solImages.map(img => img.url);
        allFormulas.push(...solFormulas);
      }
    }

    // Критерии оценивания (часть 2): div.prob_crits на уровне .prob_maindiv
    // (НЕ внутри .solution — у sdamgia это соседний блок).
    // Содержит <b>Критерии проверки:</b> + <div class="pbody"> с таблицей.
    const critsDiv = $(probDiv).find('.prob_crits').first();
    if (critsDiv.length) {
      const { text: critText, images: critImages, formulas: critFormulas } =
        processCondition($, critsDiv.get(0), baseUrl, 'criteria');
      if (critText) {
        // Убираем «Критерии проверки.» в начале (если осталось от <b>)
        let cleanCrit = critText.replace(/^Кри[терии]+\s*проверки\.?\s*:?\s*/i, '').trim();
        problem.criteria_md = cleanCrit;
        problem.criteria_images = critImages;
        allFormulas.push(...critFormulas);

        // max_score: ищем явное «Максимальный балл»;
        // если нет — берём максимум из правой колонки таблицы баллов.
        const maxBallMatch = cleanCrit.match(/Максимальный\s+балл\s*[|:]?\s*(\d+)/i);
        if (maxBallMatch) {
          problem.max_score = parseInt(maxBallMatch[1], 10);
        } else {
          // Md-таблица после tableToMarkdown имеет формат | колонка | число |.
          // Берём все числа из ячеек правой колонки (после второй `|`).
          const lines = cleanCrit.split('\n');
          const scoreCandidates = [];
          for (const line of lines) {
            const m = line.match(/\|\s*(\d+)\s*\|\s*$/);
            if (m) scoreCandidates.push(parseInt(m[1], 10));
          }
          if (scoreCandidates.length) {
            problem.max_score = Math.max(...scoreCandidates);
          }
        }
      }
    }

    // Валидация всех формул задачи — флаг latex_needs_review
    for (const f of allFormulas) {
      if (!validateLatex(f)) {
        problem.latex_needs_review = true;
        break;
      }
    }

    // Проверяем что есть условие (ответ опционален — он может быть внутри решения)
    if (!problem.condition) {
      return null;
    }

    return problem;
  } catch (e) {
    console.error('[Sdamgia] Ошибка парсинга задачи:', e.message);
    return null;
  }
}

/**
 * POST /parse-sdamgia
 * Парсинг задач с sdamgia.ru
 */
app.post('/parse-sdamgia', async (req, res) => {
  const startTime = Date.now();

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL обязателен' });
    }

    // Валидация URL
    if (!url.includes('sdamgia.ru')) {
      return res.status(400).json({ error: 'URL должен быть с сайта sdamgia.ru' });
    }

    // Добавляем print=true если нет
    let fetchUrl = url;
    if (!fetchUrl.includes('print=true')) {
      fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + 'print=true';
    }
    // crit=true — sdamgia по умолчанию скрывает критерии оценивания (часть 2).
    // Безопасно для части 1 — там блока .prob_crits просто нет.
    if (!fetchUrl.includes('crit=true')) {
      fetchUrl += '&crit=true';
    }

    console.log(`[Sdamgia] Загрузка: ${fetchUrl}`);

    // Загружаем страницу
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Ошибка загрузки: HTTP ${response.status}`,
      });
    }

    const html = await response.text();

    // Парсим HTML через cheerio
    const $ = cheerio.load(html);
    const baseUrl = (() => { try { const u = new URL(fetchUrl); return u.origin; } catch(e) { return SDAMGIA_BASE_URL; } })();
    const probDivs = $('.prob_maindiv');

    console.log(`[Sdamgia] Найдено задач на странице: ${probDivs.length}`);

    const problems = [];
    probDivs.each(function () {
      const problem = parseProblemFromDiv($, this, baseUrl);
      if (problem) {
        problems.push(problem);
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[Sdamgia] Распарсено: ${problems.length} задач за ${duration}ms`);

    res.json({
      problems,
      count: problems.length,
      totalOnPage: probDivs.length,
    });

  } catch (error) {
    console.error('[Sdamgia] Ошибка:', error.message);
    res.status(500).json({
      error: 'Ошибка парсинга',
      message: error.message,
    });
  }
});

/**
 * POST /fetch-image
 * Прокси-загрузка картинки (для импорта задач без CORS-зависимости в браузере)
 */
app.post('/fetch-image', async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL обязателен' });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Некорректный URL' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Поддерживаются только http/https URL' });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        Referer: `${parsed.protocol}//${parsed.host}/`,
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Ошибка загрузки изображения: HTTP ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (error) {
    console.error('[ImageProxy] Ошибка:', error.message);
    return res.status(500).json({ error: 'Ошибка прокси-загрузки изображения', message: error.message });
  }
});

/**
 * POST /latex-fix
 * Нормализация LaTeX-формул через LLM. Дёргается вручную учителем для задач
 * с latex_needs_review=true в предпросмотре импорта. Не вызывается автоматически.
 *
 * Принимает:
 *   { text: string, role?: 'condition'|'solution'|'criteria' }
 *
 * Возвращает:
 *   { text: string, cached: bool }                — успех, исправленный markdown
 *   { error: string }                              — провал
 *
 * Конфиг (env):
 *   TIMEWEB_AI_URL     — endpoint AI gateway (OpenAI-compatible /chat/completions)
 *   TIMEWEB_AI_KEY     — Bearer-токен
 *   TIMEWEB_AI_MODEL   — модель (default: deepseek-chat)
 *
 * Кэш — in-memory, ключ sha256(text). Сбрасывается при рестарте сервиса.
 */
import crypto from 'node:crypto';
const latexFixCache = new Map();
const MAX_CACHE_SIZE = 500;

const LATEX_FIX_SYSTEM_PROMPT = `Ты конвертируешь математические формулы в LaTeX, совместимый с KaTeX-рендерером.

ПРАВИЛА СИНТАКСИСА:
- Аргументы команд (\\sin, \\cos, \\sqrt, \\log, \\frac, \\angle, \\widehat и т.п.) — ВСЕГДА в {фигурных}, не (круглых).
- Многосимвольные индексы/степени — в {фигурных}: x^{12}, a_{ij}, S_{ABC}.
- Десятичная запятая → {,}: 0{,}5.
- Градусы → ^{\\circ}: 30^{\\circ}.
- Русские нотации: \\tg → \\operatorname{tg}, \\ctg → \\operatorname{ctg}, \\arctg → \\operatorname{arctg}.
- Команды БЕЗ \\: sin → \\sin, cos → \\cos.
- НЕ менять смысл формулы. Только синтаксис.

🚨 ОБЁРТКИ ФОРМУЛ — КРИТИЧЕСКИ ВАЖНО:
- Используй ТОЛЬКО долларовые обёртки: \`$...$\` для inline и \`$$...$$\` для блочных формул.
- НИКОГДА не используй \`\\(...\\)\` или \`\\[...\\]\` — KaTeX-рендерер в markdown ИХ НЕ ВИДИТ.
- Если во входе есть \`\\(...\\)\` — замени на \`$...$\`.
- Если во входе есть \`\\[...\\]\` — замени на \`$$...$$\`.
- Если формула уже обёрнута в \`$...$\` — оставь так, не меняй на \`\\(...\\)\`.

ВХОД: markdown-текст задачи/решения с формулами (могут быть в $...$, в \\(...\\), в \\[...\\] или вообще без обёрток).
ВЫХОД: тот же markdown, но ВСЕ формулы обёрнуты ИСКЛЮЧИТЕЛЬНО в $...$ или $$...$$ и сами формулы — валидный KaTeX.
Ничего, кроме исправленного текста. Никаких пояснений, комментариев, преамбул, тройных бэктиков.`;

/**
 * Safety net: если модель всё-таки вернула \\(...\\) или \\[...\\] — конвертируем.
 * Аккуратно: НЕ трогаем экранированные скобки внутри уже корректных $...$ блоков.
 * Подход: проходим по тексту, пропуская содержимое $...$/$$...$$ как есть.
 */
function normalizeLatexDelimiters(text) {
  if (!text || typeof text !== 'string') return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    // Пропускаем уже корректные $$...$$ блоки
    if (text.startsWith('$$', i)) {
      const end = text.indexOf('$$', i + 2);
      if (end === -1) { out += text.slice(i); break; }
      out += text.slice(i, end + 2);
      i = end + 2;
      continue;
    }
    // Пропускаем корректные $...$ (но не валюту: $5 без закрывающего)
    if (text[i] === '$' && text[i - 1] !== '\\') {
      const end = text.indexOf('$', i + 1);
      if (end === -1 || end - i > 500) { out += text[i]; i++; continue; }
      out += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    // \[...\] → $$...$$
    if (text.startsWith('\\[', i)) {
      const end = text.indexOf('\\]', i + 2);
      if (end !== -1) {
        out += '$$' + text.slice(i + 2, end) + '$$';
        i = end + 2;
        continue;
      }
    }
    // \(...\) → $...$
    if (text.startsWith('\\(', i)) {
      const end = text.indexOf('\\)', i + 2);
      if (end !== -1) {
        out += '$' + text.slice(i + 2, end) + '$';
        i = end + 2;
        continue;
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

app.post('/latex-fix', async (req, res) => {
  const { text, role } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Поле text обязательно (string)' });
  }
  if (text.length > 20000) {
    return res.status(400).json({ error: 'text слишком длинный (>20000 символов)' });
  }

  const aiUrl = process.env.TIMEWEB_AI_URL;
  const aiKey = process.env.TIMEWEB_AI_KEY;
  const aiModel = process.env.TIMEWEB_AI_MODEL || 'deepseek-chat';
  if (!aiUrl || !aiKey) {
    return res.status(503).json({
      error: 'LLM endpoint не настроен на сервере (TIMEWEB_AI_URL / TIMEWEB_AI_KEY)',
    });
  }

  // Кэш по sha256(text)
  const cacheKey = crypto.createHash('sha256').update(text).digest('hex');
  if (latexFixCache.has(cacheKey)) {
    return res.json({ text: latexFixCache.get(cacheKey), cached: true });
  }

  try {
    const llmReq = {
      model: aiModel,
      temperature: 0.2,
      max_tokens: Math.min(4000, Math.ceil(text.length * 1.5)),
      messages: [
        { role: 'system', content: LATEX_FIX_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    };

    const resp = await fetch(aiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(llmReq),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error('[latex-fix] upstream:', resp.status, body.slice(0, 200));
      return res.status(502).json({
        error: `AI gateway HTTP ${resp.status}`,
        details: body.slice(0, 300),
      });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return res.status(502).json({ error: 'AI gateway вернул пустой ответ', upstream: data });
    }

    // Safety net: модель иногда игнорирует промпт и оборачивает формулы
    // в \(...\) / \[...\]. KaTeX-плагин react-markdown их не видит — нормализуем
    // в $...$ / $$...$$ обязательно, даже если промпт нарушен.
    const fixed = normalizeLatexDelimiters(raw);

    // LRU-чистка кэша: если перебрали лимит, удаляем самый старый.
    if (latexFixCache.size >= MAX_CACHE_SIZE) {
      const firstKey = latexFixCache.keys().next().value;
      latexFixCache.delete(firstKey);
    }
    latexFixCache.set(cacheKey, fixed);

    console.log(`[latex-fix] role=${role || '?'} len_in=${text.length} len_out=${fixed.length}`);
    res.json({ text: fixed, cached: false });
  } catch (error) {
    console.error('[latex-fix] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'puppeteer-pdf',
    puppeteer: 'installed',
    browser: browser?.connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /similar — похожие задачи (sqlite-vec).
 * body: { task_id, limit?, same_topic_only?, min_cos? }
 */
app.post('/similar', (req, res) => {
  if (!findSimilar) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { task_id, limit, same_topic_only, min_cos } = req.body || {};
  if (!task_id) return res.status(400).json({ error: 'task_id обязателен' });
  try {
    const r = findSimilar({
      taskId: task_id,
      limit: Number(limit) || 8,
      sameTopicOnly: same_topic_only !== false,
      minCos: Number(min_cos) || 0,
    });
    res.json(r);
  } catch (e) {
    console.error('[similar]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /similar/health — состояние индекса
 */
app.get('/similar/health', (req, res) => {
  if (!vecHealth) return res.status(503).json({ ok: false, error: 'vec-search не инициализирован' });
  res.json(vecHealth());
});

/**
 * POST /pairs — похожие пары внутри набора задач (A2).
 * body: { task_ids: [...], min_cos? }
 */
app.post('/pairs', (req, res) => {
  if (!findPairs) return res.status(503).json({ error: 'vec-search не инициализирован' });
  const { task_ids, min_cos } = req.body || {};
  if (!Array.isArray(task_ids) || task_ids.length < 2) return res.json({ pairs: [], missing: [] });
  try {
    res.json(findPairs(task_ids, Number(min_cos) || 0.7));
  } catch (e) {
    console.error('[pairs]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /duplicates — дедуп-кластеры на ревью (B2).
 * query: type (exact_dup|param_family), page, perPage
 */
app.get('/duplicates', (req, res) => {
  if (!getDuplicateClusters) return res.status(503).json({ error: 'vec-search не инициализирован' });
  try {
    const r = getDuplicateClusters({
      type: req.query.type === 'param_family' ? 'param_family' : 'exact_dup',
      page: Number(req.query.page) || 1,
      perPage: Math.min(Number(req.query.perPage) || 20, 50),
    });
    res.json(r);
  } catch (e) {
    console.error('[duplicates]', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Shutdown handler
 */
process.on('SIGINT', async () => {
  console.log('\n[PDF] Завершение работы...');

  if (browser) {
    await browser.close();
  }

  process.exit(0);
});

/**
 * Запуск сервера
 */
app.listen(PORT, () => {
  console.log(`[PDF] Сервис запущен на http://localhost:${PORT}`);
  console.log(`[PDF] Health check: http://localhost:${PORT}/health`);
});
