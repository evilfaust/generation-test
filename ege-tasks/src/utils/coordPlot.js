// Координатная плоскость: графики функций и векторы.
//
// Модуль-близнец numberLine.js и обслуживает ОБА конвейера рендеринга проекта:
//   • условия/решения задач → react-markdown (MathRenderer) ловит fenced-блок
//     ```plot (алиас ```vectors) и рендерит <CoordPlotSVG spec=…/>;
//   • теория → useMarkdownProcessor получает HTML-строку, postprocess подменяет
//     <pre><code class="language-plot">…</code></pre> на готовый <svg>-string.
//
// Чтобы обе ветки давали идентичную картинку, SVG всегда строит ОДНА функция
// coordPlotSvg(model). SVG нарочно собран БЕЗ <defs>/<pattern>/<marker>:
// стрелки осей и векторов — это <path>, клетка — обычные <line>. Так разметка
// надёжно проходит DOMPurify (нет id-ссылок url(#…)) и печатается вектором.
//
// API:
//   parseCoordPlot(spec)        → model
//   coordPlotSvg(model, opts?)  → '<svg>…</svg>'
//   coordPlotSvgFromSpec(spec)  → '<svg>…</svg>'  (parse + render)
//   compileExpr(src)            → { fn, error }   (безопасный калькулятор f(x))
//   plotToSpec(state)           → текст DSL (для конструктора)
//
// DSL (одна команда на строку; «;» тоже разделитель — для inline-формы
// в ячейках markdown-таблиц; строки с # — комментарии):
//   x -4 4               — диапазон по оси X (алиас: xrange)
//   y -3 5               — диапазон по оси Y (алиас: yrange)
//   grid 1 | grid off    — шаг клетки
//   size 280             — ширина картинки в px
//   axis x y             — буквы осей
//   units off            — не подписывать единичные отрезки «1»
//   f x^2-4              — график функции; модификаторы: color NAME,
//                          from A to B (частичная область), dash
//   vec a 1 4 3 1        — вектор из (1;4) в (3;1) с подписью a
//   vec b 2 3            — вектор из начала координат в (2;3)
//   point 1 3 fill       — точка на плоскости (fill|open)
//   seg 0 0 2 3 dash     — отрезок
//   label 2 3 A          — текстовая подпись у точки (2;3)
//   xtick -5             — засечка с подписью на оси X (алиас подписи вторым словом)
//   ytick 3 три          — засечка с подписью на оси Y

const DEFAULT_VIEW = { xrange: [-5, 5], yrange: [-5, 5], grid: 1 };
const DEFAULT_WIDTH = 280;
const MAX_HEIGHT = 320;
// Поля холста: слева/снизу больше — там живут подписи засечек и «1».
const PAD = { l: 18, r: 14, t: 12, b: 18 };

// Строгий монохром по умолчанию (как у числовой прямой) — печатается в Ч/Б.
// Цвет включается явно модификатором `color …` (как на картинках «Решу ЕГЭ»).
const COLORS = { axis: '#1f2937', grid: '#d6dae0', label: '#374151' };
const PALETTE = {
  ink: '#1f2937', black: '#1f2937', orange: '#c8772e', blue: '#2f6fb5',
  green: '#2f7a3f', red: '#b3403a', violet: '#6d4aa8', gray: '#6b7280',
};

export const PLOT_COLORS = Object.keys(PALETTE).filter((c) => c !== 'black');

const r2 = (n) => Math.round(n * 100) / 100;
const colorOf = (name) => PALETTE[String(name || '').toLowerCase()] || PALETTE.ink;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** «1,5» / «-2» / «1/2» → число; иначе NaN. */
export function num(tok) {
  const t = String(tok ?? '').trim().replace(/[−–—]/g, '-').replace(',', '.');
  const fm = t.replace(/\s+/g, '').match(/^(-?)(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (fm) {
    const den = Number(fm[3]);
    if (den) return (fm[1] === '-' ? -1 : 1) * (Number(fm[2]) / den);
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Число → подпись по-русски: точка → запятая, минус → «−» (U+2212). */
function fmtNum(v) {
  const s = String(Math.round(v * 1e6) / 1e6).replace('.', ',');
  return s.replace(/^-/, '−');
}

// ───────────────────────────── калькулятор f(x) ─────────────────────────────
// Безопасный разбор арифметического выражения (без eval/Function): токенизация →
// рекурсивный спуск → AST → вычисление. Поддержаны неявное умножение (2x, 3(x+1)),
// степень с правой ассоциативностью, школьные функции и константы pi/e.

const FUNCS1 = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan,
  ctg: (v) => 1 / Math.tan(v), cot: (v) => 1 / Math.tan(v),
  asin: Math.asin, arcsin: Math.asin, acos: Math.acos, arccos: Math.acos,
  atan: Math.atan, arctg: Math.atan, arctan: Math.atan,
  ln: Math.log, lg: Math.log10, log10: Math.log10, log2: Math.log2,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sign: Math.sign,
};
const FUNCS2 = {
  log: (b, v) => Math.log(v) / Math.log(b), // log(основание, аргумент)
  pow: Math.pow, min: Math.min, max: Math.max, root: (n, v) => Math.pow(v, 1 / n),
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(src) {
  const s = String(src)
    .replace(/(\d)\s*,\s*(\d)/g, '$1.$2') // десятичная запятая (аргументы log(2,x) не задеты)
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/[·×]/g, '*')
    .replace(/[−–—]/g, '-')
    .replace(/[[{]/g, '(')
    .replace(/[\]}]/g, ')');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) throw new Error(`Непонятное число «${s.slice(i, j)}»`);
      out.push({ t: 'num', v });
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j += 1;
      out.push({ t: 'id', v: s.slice(i, j).toLowerCase() });
      i = j; continue;
    }
    if ('+-*/^(),'.includes(ch)) { out.push({ t: ch }); i += 1; continue; }
    throw new Error(`Недопустимый символ «${ch}»`);
  }
  return out;
}

function parseTokens(toks) {
  let p = 0;
  const peek = () => toks[p];
  const eat = (t) => {
    if (toks[p] && toks[p].t === t) { p += 1; return true; }
    return false;
  };
  const expect = (t) => { if (!eat(t)) throw new Error(`Ожидалось «${t}»`); };

  const startsPrimary = () => {
    const t = peek();
    return !!t && (t.t === 'num' || t.t === 'id' || t.t === '(');
  };

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('Выражение оборвалось');
    if (t.t === 'num') { p += 1; return { op: 'num', v: t.v }; }
    if (t.t === '(') { p += 1; const e = parseExpr(); expect(')'); return e; }
    if (t.t === 'id') {
      p += 1;
      const name = t.v;
      if (peek() && peek().t === '(') {
        p += 1;
        const args = [];
        if (!eat(')')) {
          args.push(parseExpr());
          while (eat(',')) args.push(parseExpr());
          expect(')');
        }
        return { op: 'call', name, args };
      }
      return { op: 'var', name };
    }
    throw new Error('Лишний символ в выражении');
  }
  function parsePower() {
    const base = parsePrimary();
    // ^ правоассоциативна, справа допускаем унарный минус: 2^-x
    if (eat('^')) return { op: '^', a: base, b: parseUnary() };
    return base;
  }
  function parseUnary() {
    if (eat('-')) return { op: 'neg', a: parseUnary() };
    if (eat('+')) return parseUnary();
    return parsePower();
  }
  function parseTerm() {
    let node = parseUnary();
    for (;;) {
      if (eat('*')) node = { op: '*', a: node, b: parseUnary() };
      else if (eat('/')) node = { op: '/', a: node, b: parseUnary() };
      else if (startsPrimary()) node = { op: '*', a: node, b: parseUnary() }; // 2x, 3(x+1)
      else return node;
    }
  }
  function parseExpr() {
    let node = parseTerm();
    for (;;) {
      if (eat('+')) node = { op: '+', a: node, b: parseTerm() };
      else if (eat('-')) node = { op: '-', a: node, b: parseTerm() };
      else return node;
    }
  }

  const ast = parseExpr();
  if (p !== toks.length) throw new Error('Лишний символ в выражении');
  return ast;
}

// Проверка имён (переменных и функций) до вычисления — чтобы конструктор мог
// показать внятную ошибку, а не «пустой график».
function validate(node) {
  if (node.op === 'var') {
    if (node.name !== 'x' && !(node.name in CONSTS)) {
      throw new Error(`Неизвестное обозначение «${node.name}» (переменная только x)`);
    }
    return;
  }
  if (node.op === 'call') {
    const n = node.args.length;
    const ok = (n === 1 && (node.name in FUNCS1 || node.name === 'log'))
      || (n === 2 && node.name in FUNCS2);
    if (!ok) throw new Error(`Неизвестная функция «${node.name}» от ${n} арг.`);
    node.args.forEach(validate);
    return;
  }
  if (node.a) validate(node.a);
  if (node.b) validate(node.b);
}

function evalNode(node, x) {
  switch (node.op) {
    case 'num': return node.v;
    case 'var': return node.name === 'x' ? x : CONSTS[node.name];
    case 'neg': return -evalNode(node.a, x);
    case '+': return evalNode(node.a, x) + evalNode(node.b, x);
    case '-': return evalNode(node.a, x) - evalNode(node.b, x);
    case '*': return evalNode(node.a, x) * evalNode(node.b, x);
    case '/': return evalNode(node.a, x) / evalNode(node.b, x);
    case '^': return Math.pow(evalNode(node.a, x), evalNode(node.b, x));
    case 'call': {
      const args = node.args.map((a) => evalNode(a, x));
      if (args.length === 1) {
        if (node.name === 'log') return Math.log(args[0]); // log(x) = ln x
        return FUNCS1[node.name](args[0]);
      }
      return FUNCS2[node.name](args[0], args[1]);
    }
    default: return NaN;
  }
}

/**
 * Скомпилировать выражение f(x) в функцию. Без eval — только свой разбор.
 * @returns {{fn: ((x:number)=>number)|null, error: string|null}}
 */
export function compileExpr(src) {
  const text = String(src ?? '').trim().replace(/^y\s*=\s*/i, '').replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, '');
  if (!text) return { fn: null, error: 'Пустая формула' };
  try {
    const ast = parseTokens(tokenize(text));
    validate(ast);
    return {
      fn: (x) => {
        const v = evalNode(ast, x);
        return typeof v === 'number' ? v : NaN;
      },
      error: null,
    };
  } catch (e) {
    return { fn: null, error: e.message || 'Ошибка в формуле' };
  }
}

// ───────────────────────────────── парсер DSL ───────────────────────────────

// Вырезает из хвоста команды модификаторы (color/dash/from…to/width) и
// возвращает остаток строки + разобранные модификаторы.
function extractMods(rest) {
  const mods = {};
  let s = String(rest || '');
  s = s.replace(/\bcolor\s+([a-zA-Zа-яА-Я]+)/i, (_, c) => { mods.color = c.toLowerCase(); return ' '; });
  s = s.replace(/\bfrom\s+(\S+)\s+to\s+(\S+)/i, (_, a, b) => {
    const fa = num(a); const fb = num(b);
    if (Number.isFinite(fa) && Number.isFinite(fb)) mods.from = Math.min(fa, fb);
    if (Number.isFinite(fa) && Number.isFinite(fb)) mods.to = Math.max(fa, fb);
    return ' ';
  });
  s = s.replace(/\bdash\b/i, () => { mods.dash = true; return ' '; });
  s = s.replace(/\bside\s+(left|right)\b/i, (_, v) => { mods.side = v.toLowerCase(); return ' '; });
  return { rest: s.trim(), mods };
}

const isFilled = (tok) => {
  const t = String(tok || '').toLowerCase();
  return t !== 'open' && t !== 'hollow' && t !== 'o';
};

/**
 * Разбор текстового DSL в модель координатной плоскости.
 */
export function parseCoordPlot(spec) {
  const model = {
    xrange: [...DEFAULT_VIEW.xrange],
    yrange: [...DEFAULT_VIEW.yrange],
    grid: DEFAULT_VIEW.grid,
    width: null,
    axisX: 'x',
    axisY: 'y',
    units: true,
    curves: [],
    vectors: [],
    points: [],
    segments: [],
    labels: [],
    xticks: [],
    yticks: [],
  };
  if (!spec || typeof spec !== 'string') return model;

  for (const rawLine of String(spec).split(/[\n;]/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const p = line.split(/\s+/);
    const cmd = p[0].toLowerCase();

    if (cmd === 'x' || cmd === 'xrange') {
      const a = num(p[1]); const b = num(p[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a < b) model.xrange = [a, b];
    } else if (cmd === 'y' || cmd === 'yrange') {
      const a = num(p[1]); const b = num(p[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a < b) model.yrange = [a, b];
    } else if (cmd === 'grid') {
      const t = String(p[1] || '').toLowerCase();
      if (t === 'off' || t === 'no' || t === '0') model.grid = 0;
      else { const g = num(p[1]); if (Number.isFinite(g) && g > 0) model.grid = g; }
    } else if (cmd === 'size' || cmd === 'width') {
      const w = num(p[1]);
      if (Number.isFinite(w) && w >= 80) model.width = Math.min(w, 900);
    } else if (cmd === 'axis') {
      if (p[1]) model.axisX = p[1];
      if (p[2]) model.axisY = p[2];
    } else if (cmd === 'units') {
      model.units = !/^(off|no|0|false)$/i.test(p[1] || '');
    } else if (cmd === 'f' || cmd === 'plot' || cmd === 'func') {
      const { rest, mods } = extractMods(line.slice(p[0].length));
      const { fn, error } = compileExpr(rest);
      model.curves.push({
        expr: rest, fn, error, color: mods.color || 'ink',
        from: mods.from, to: mods.to, dash: !!mods.dash,
      });
    } else if (cmd === 'vec' || cmd === 'vector') {
      const { rest, mods } = extractMods(line.slice(p[0].length));
      const parts = rest.split(/\s+/).filter(Boolean);
      // Первый токен — подпись, если он не число: «vec a 1 4 3 1» / «vec 1 4 3 1»
      const label = Number.isFinite(num(parts[0])) ? '' : (parts.shift() || '');
      const nums = parts.map(num).filter(Number.isFinite);
      let coords = null;
      if (nums.length >= 4) coords = nums.slice(0, 4);
      else if (nums.length === 2) coords = [0, 0, nums[0], nums[1]]; // из начала координат
      if (coords) {
        model.vectors.push({
          label, x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3],
          color: mods.color || 'ink', side: mods.side || 'left', dash: !!mods.dash,
        });
      }
    } else if (cmd === 'point' || cmd === 'dot') {
      const { rest, mods } = extractMods(line.slice(p[0].length));
      const parts = rest.split(/\s+/).filter(Boolean);
      const x = num(parts[0]); const y = num(parts[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        model.points.push({ x, y, filled: isFilled(parts[2]), color: mods.color || 'ink' });
      }
    } else if (cmd === 'seg' || cmd === 'segment') {
      const { rest, mods } = extractMods(line.slice(p[0].length));
      const nums = rest.split(/\s+/).map(num).filter(Number.isFinite);
      if (nums.length >= 4) {
        model.segments.push({
          x1: nums[0], y1: nums[1], x2: nums[2], y2: nums[3],
          color: mods.color || 'ink', dash: !!mods.dash,
        });
      }
    } else if (cmd === 'label' || cmd === 'text') {
      const { rest, mods } = extractMods(line.slice(p[0].length));
      const parts = rest.split(/\s+/).filter(Boolean);
      const x = num(parts[0]); const y = num(parts[1]);
      const text = parts.slice(2).join(' ');
      if (Number.isFinite(x) && Number.isFinite(y) && text) {
        model.labels.push({ x, y, text, color: mods.color || 'ink' });
      }
    } else if (cmd === 'xtick' || cmd === 'ytick') {
      const v = num(p[1]);
      if (Number.isFinite(v)) {
        const label = p.slice(2).join(' ') || fmtNum(v);
        (cmd === 'xtick' ? model.xticks : model.yticks).push({ v, label });
      }
    }
  }
  return model;
}

// ─────────────────────────────────── рендер ─────────────────────────────────

// Треугольная стрелка остриём в (x,y) вдоль единичного вектора (ux,uy).
function arrowHead(x, y, ux, uy, color, len = 7, half = 3.1) {
  const bx = x - ux * len; const by = y - uy * len;
  const px = -uy * half; const py = ux * half;
  return `<path d="M${r2(x)},${r2(y)} L${r2(bx + px)},${r2(by + py)} L${r2(bx - px)},${r2(by - py)} Z" fill="${color}"/>`;
}

// Подпись вектора: буква курсивом + стрелочка над ней (аналог \vec{a}).
function vecLabel(text, cx, cy, color) {
  const t = escapeXml(text);
  const barY = cy - 10.5;
  return [
    `<text x="${r2(cx)}" y="${r2(cy)}" font-size="12" font-style="italic" text-anchor="middle" fill="${color}">${t}</text>`,
    `<line x1="${r2(cx - 4.5)}" y1="${r2(barY)}" x2="${r2(cx + 3.5)}" y2="${r2(barY)}" stroke="${color}" stroke-width="1"/>`,
    arrowHead(cx + 4.8, barY, 1, 0, color, 3.2, 1.6),
  ].join('');
}

/**
 * Построить SVG-строку координатной плоскости по модели.
 */
export function coordPlotSvg(model, opts = {}) {
  const m = model || parseCoordPlot('');
  const [x0, x1] = m.xrange || DEFAULT_VIEW.xrange;
  const [y0, y1] = m.yrange || DEFAULT_VIEW.yrange;
  const spanX = (x1 - x0) || 1;
  const spanY = (y1 - y0) || 1;

  // Клетка квадратная: один и тот же масштаб по обеим осям (иначе векторы врут).
  const wantW = opts.width || m.width || DEFAULT_WIDTH;
  const maxH = opts.maxHeight || MAX_HEIGHT;
  let cell = (wantW - PAD.l - PAD.r) / spanX;
  if (PAD.t + PAD.b + spanY * cell > maxH) cell = (maxH - PAD.t - PAD.b) / spanY;
  cell = Math.max(cell, 4);
  const W = Math.round(PAD.l + PAD.r + spanX * cell);
  const H = Math.round(PAD.t + PAD.b + spanY * cell);

  const sx = (v) => PAD.l + (v - x0) * cell;
  const sy = (v) => PAD.t + (y1 - v) * cell;
  const inX = 0 >= x0 && 0 <= x1;
  const inY = 0 >= y0 && 0 <= y1;
  // Если начало координат вне окна — ось прижимаем к краю, картинка остаётся читаемой.
  const axisX0 = sy(Math.min(Math.max(0, y0), y1)); // экранный Y горизонтальной оси
  const axisY0 = sx(Math.min(Math.max(0, x0), x1)); // экранный X вертикальной оси

  const parts = [];

  // 1) Клетка
  if (m.grid > 0) {
    const g = m.grid;
    for (let v = Math.ceil(x0 / g) * g; v <= x1 + 1e-9; v += g) {
      const px = r2(sx(v));
      parts.push(`<line x1="${px}" y1="${r2(PAD.t)}" x2="${px}" y2="${r2(H - PAD.b)}" stroke="${COLORS.grid}" stroke-width="1"/>`);
    }
    for (let v = Math.ceil(y0 / g) * g; v <= y1 + 1e-9; v += g) {
      const py = r2(sy(v));
      parts.push(`<line x1="${r2(PAD.l)}" y1="${py}" x2="${r2(W - PAD.r)}" y2="${py}" stroke="${COLORS.grid}" stroke-width="1"/>`);
    }
  }

  // 2) Оси со стрелками и буквами
  parts.push(`<line x1="${r2(PAD.l)}" y1="${r2(axisX0)}" x2="${r2(W - PAD.r + 4)}" y2="${r2(axisX0)}" stroke="${COLORS.axis}" stroke-width="1.4"/>`);
  parts.push(arrowHead(W - PAD.r + 4, axisX0, 1, 0, COLORS.axis));
  parts.push(`<text x="${r2(W - 1)}" y="${r2(axisX0 + 12)}" font-size="12" font-style="italic" text-anchor="end" fill="${COLORS.axis}">${escapeXml(m.axisX || 'x')}</text>`);

  parts.push(`<line x1="${r2(axisY0)}" y1="${r2(H - PAD.b)}" x2="${r2(axisY0)}" y2="${r2(PAD.t - 4)}" stroke="${COLORS.axis}" stroke-width="1.4"/>`);
  parts.push(arrowHead(axisY0, PAD.t - 4, 0, -1, COLORS.axis));
  parts.push(`<text x="${r2(axisY0 - 5)}" y="${r2(PAD.t + 2)}" font-size="12" font-style="italic" text-anchor="end" fill="${COLORS.axis}">${escapeXml(m.axisY || 'y')}</text>`);

  // 3) Единичные отрезки и начало координат (как на бланках «Решу ЕГЭ»)
  const xtickAt = new Set(m.xticks.map((t) => t.v));
  const ytickAt = new Set(m.yticks.map((t) => t.v));
  if (m.units) {
    if (inY && 1 >= x0 && 1 <= x1 && !xtickAt.has(1)) {
      parts.push(`<text x="${r2(sx(1))}" y="${r2(axisX0 + 13)}" font-size="11" text-anchor="middle" fill="${COLORS.label}">1</text>`);
    }
    if (inX && 1 >= y0 && 1 <= y1 && !ytickAt.has(1)) {
      parts.push(`<text x="${r2(axisY0 - 5)}" y="${r2(sy(1) + 4)}" font-size="11" text-anchor="end" fill="${COLORS.label}">1</text>`);
    }
    if (inX && inY) {
      parts.push(`<text x="${r2(axisY0 - 4)}" y="${r2(axisX0 + 13)}" font-size="11" font-style="italic" text-anchor="end" fill="${COLORS.label}">O</text>`);
    }
  }

  // 4) Явные засечки с подписями
  for (const t of m.xticks) {
    if (t.v < x0 || t.v > x1) continue;
    const px = r2(sx(t.v));
    parts.push(`<line x1="${px}" y1="${r2(axisX0 - 3)}" x2="${px}" y2="${r2(axisX0 + 3)}" stroke="${COLORS.axis}" stroke-width="1.2"/>`);
    parts.push(`<text x="${px}" y="${r2(axisX0 + 13)}" font-size="11" text-anchor="middle" fill="${COLORS.label}">${escapeXml(t.label)}</text>`);
  }
  for (const t of m.yticks) {
    if (t.v < y0 || t.v > y1) continue;
    const py = r2(sy(t.v));
    parts.push(`<line x1="${r2(axisY0 - 3)}" y1="${py}" x2="${r2(axisY0 + 3)}" y2="${py}" stroke="${COLORS.axis}" stroke-width="1.2"/>`);
    parts.push(`<text x="${r2(axisY0 - 5)}" y="${r2(py + 4)}" font-size="11" text-anchor="end" fill="${COLORS.label}">${escapeXml(t.label)}</text>`);
  }

  // 5) Графики функций
  for (const c of m.curves) {
    if (!c.fn) continue;
    const d = curvePath(c, { x0, x1, y0, y1, sx, sy });
    if (!d) continue;
    const dash = c.dash ? ' stroke-dasharray="5 4"' : '';
    parts.push(`<path d="${d}" fill="none" stroke="${colorOf(c.color)}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${dash}/>`);
  }

  // 6) Отрезки
  for (const s of m.segments) {
    const dash = s.dash ? ' stroke-dasharray="5 4"' : '';
    parts.push(`<line x1="${r2(sx(s.x1))}" y1="${r2(sy(s.y1))}" x2="${r2(sx(s.x2))}" y2="${r2(sy(s.y2))}" stroke="${colorOf(s.color)}" stroke-width="1.5"${dash}/>`);
  }

  // 7) Векторы: линия + стрелка + подпись со стрелочкой сверху
  for (const v of m.vectors) {
    const col = colorOf(v.color);
    const ax = sx(v.x1); const ay = sy(v.y1);
    const bx = sx(v.x2); const by = sy(v.y2);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / len; const uy = (by - ay) / len;
    const dash = v.dash ? ' stroke-dasharray="5 4"' : '';
    // Линию не доводим до острия — иначе стрелка выглядит «раздутой».
    const tipBack = Math.min(6, len * 0.5);
    parts.push(`<line x1="${r2(ax)}" y1="${r2(ay)}" x2="${r2(bx - ux * tipBack)}" y2="${r2(by - uy * tipBack)}" stroke="${col}" stroke-width="1.7"${dash}/>`);
    parts.push(arrowHead(bx, by, ux, uy, col, 8, 3.4));
    if (v.label) {
      const sgn = v.side === 'right' ? -1 : 1;
      const nx = -uy * sgn; const ny = ux * sgn; // нормаль к вектору
      parts.push(vecLabel(v.label, (ax + bx) / 2 + nx * 13, (ay + by) / 2 + ny * 13 + 4, col));
    }
  }

  // 8) Точки и подписи
  for (const pt of m.points) {
    parts.push(`<circle cx="${r2(sx(pt.x))}" cy="${r2(sy(pt.y))}" r="3.3" fill="${pt.filled ? colorOf(pt.color) : '#fff'}" stroke="${colorOf(pt.color)}" stroke-width="1.4"/>`);
  }
  for (const l of m.labels) {
    parts.push(`<text x="${r2(sx(l.x) + 6)}" y="${r2(sy(l.y) - 6)}" font-size="12" font-style="italic" fill="${colorOf(l.color)}">${escapeXml(l.text)}</text>`);
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" class="coordplot-svg" role="img">${parts.join('')}</svg>`;
}

/**
 * Путь графика: плотная выборка + аналитическая обрезка по окну Y.
 * Разрывы (асимптоты, вне области определения) рвут путь на подпути «M…L…».
 */
function curvePath(curve, { x0, x1, y0, y1, sx, sy }) {
  const from = Number.isFinite(curve.from) ? Math.max(curve.from, x0) : x0;
  const to = Number.isFinite(curve.to) ? Math.min(curve.to, x1) : x1;
  if (!(to > from)) return '';
  const spanY = y1 - y0;
  const N = 600;
  const step = (to - from) / N;
  const d = [];
  let open = false; // начат ли подпуть
  let prev = null;

  const moveTo = (x, y) => { d.push(`M${r2(sx(x))},${r2(sy(y))}`); open = true; };
  const lineTo = (x, y) => { d.push(`L${r2(sx(x))},${r2(sy(y))}`); };
  // Точка пересечения отрезка с горизонталью y = edge
  const cross = (p, q, edge) => {
    const t = (edge - p.y) / (q.y - p.y);
    return { x: p.x + (q.x - p.x) * t, y: edge };
  };
  const clampEdge = (y) => (y > y1 ? y1 : y0);

  for (let i = 0; i <= N; i += 1) {
    const x = i === N ? to : from + i * step;
    const y = curve.fn(x);
    const cur = Number.isFinite(y) ? { x, y } : null;
    if (!cur) { open = false; prev = null; continue; }
    if (prev) {
      const pIn = prev.y >= y0 && prev.y <= y1;
      const cIn = cur.y >= y0 && cur.y <= y1;
      const jump = Math.abs(cur.y - prev.y) > spanY * 4; // скачок через асимптоту
      if (pIn && cIn) {
        if (!open) moveTo(prev.x, prev.y);
        lineTo(cur.x, cur.y);
      } else if (pIn && !cIn) {
        if (!open) moveTo(prev.x, prev.y);
        const c = cross(prev, cur, clampEdge(cur.y));
        lineTo(c.x, c.y);
        open = false;
      } else if (!pIn && cIn) {
        const c = cross(prev, cur, clampEdge(prev.y));
        moveTo(c.x, c.y);
        lineTo(cur.x, cur.y);
      } else if (!jump && ((prev.y < y0 && cur.y > y1) || (prev.y > y1 && cur.y < y0))) {
        // Крутой участок, пересекающий всё окно насквозь
        const a = cross(prev, cur, clampEdge(prev.y));
        const b = cross(prev, cur, clampEdge(cur.y));
        moveTo(a.x, a.y);
        lineTo(b.x, b.y);
        open = false;
      } else {
        open = false;
      }
    }
    prev = cur;
  }
  return d.join('');
}

export function coordPlotSvgFromSpec(spec, opts) {
  return coordPlotSvg(parseCoordPlot(spec), opts);
}

// ─────────────────────────── сериализация конструктора ──────────────────────

const numToken = (v) => {
  const s = String(v ?? '').trim().replace(/[−–—]/g, '-');
  return s === '' ? '0' : s.replace(',', '.');
};

/**
 * Состояние конструктора → текст DSL.
 * @param {{view:object, curves?:Array, vectors?:Array, points?:Array, labels?:Array}} state
 */
export function plotToSpec({ view = {}, curves = [], vectors = [], points = [], labels = [] } = {}) {
  const xr = view.xrange || DEFAULT_VIEW.xrange;
  const yr = view.yrange || DEFAULT_VIEW.yrange;
  const lines = [
    `x ${numToken(xr[0])} ${numToken(xr[1])}`,
    `y ${numToken(yr[0])} ${numToken(yr[1])}`,
  ];
  if (view.grid != null && Number(view.grid) !== 1) {
    lines.push(`grid ${Number(view.grid) > 0 ? numToken(view.grid) : 'off'}`);
  }
  if ((view.axisX && view.axisX !== 'x') || (view.axisY && view.axisY !== 'y')) {
    lines.push(`axis ${view.axisX || 'x'} ${view.axisY || 'y'}`);
  }
  if (view.units === false) lines.push('units off');
  if (view.width) lines.push(`size ${Math.round(view.width)}`);

  for (const c of curves) {
    const expr = String(c.expr || '').trim();
    if (!expr) continue;
    let s = `f ${expr}`;
    if (c.color && c.color !== 'ink') s += ` color ${c.color}`;
    if (c.from !== undefined && c.from !== null && c.from !== ''
      && c.to !== undefined && c.to !== null && c.to !== '') {
      s += ` from ${numToken(c.from)} to ${numToken(c.to)}`;
    }
    if (c.dash) s += ' dash';
    lines.push(s);
  }
  for (const v of vectors) {
    const label = String(v.label || '').trim();
    let s = `vec${label ? ` ${label}` : ''} ${numToken(v.x1)} ${numToken(v.y1)} ${numToken(v.x2)} ${numToken(v.y2)}`;
    if (v.color && v.color !== 'ink') s += ` color ${v.color}`;
    if (v.side === 'right') s += ' side right';
    if (v.dash) s += ' dash';
    lines.push(s);
  }
  for (const p of points) {
    let s = `point ${numToken(p.x)} ${numToken(p.y)} ${p.filled === false ? 'open' : 'fill'}`;
    if (p.color && p.color !== 'ink') s += ` color ${p.color}`;
    lines.push(s);
    if (p.label) lines.push(`label ${numToken(p.x)} ${numToken(p.y)} ${p.label}`);
  }
  for (const l of labels) {
    if (l.text) lines.push(`label ${numToken(l.x)} ${numToken(l.y)} ${l.text}`);
  }
  return lines.join('\n');
}
