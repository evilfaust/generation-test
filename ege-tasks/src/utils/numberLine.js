// Числовая прямая со штриховкой интервалов.
//
// Один модуль обслуживает ОБА конвейера рендеринга проекта:
//   • условия/решения задач → react-markdown (MathRenderer) ловит fenced-блок
//     ```numline и рендерит React-компонент <NumberLineSVG spec=…/>;
//   • теория → useMarkdownProcessor получает HTML-строку, postprocess подменяет
//     <pre><code class="language-numline">…</code></pre> на готовый <svg>-string.
//
// Чтобы обе ветки давали идентичную картинку, SVG всегда строит ОДНА функция
// numberLineSvg(model). SVG нарочно собран БЕЗ <defs>/<pattern>/<marker>:
// стрелка оси — это <path>, штриховка — аналитически обрезанные диагонали.
// Так разметка надёжно проходит DOMPurify (нет id-ссылок url(#…)) и корректно
// печатается в Chrome.
//
// API:
//   parseNumberLine(spec)        → model
//   numberLineSvg(model, opts?)  → '<svg>…</svg>'
//   numberLineSvgFromSpec(spec)  → '<svg>…</svg>'  (parse + render)
//   shapesToSpec({domain,shapes})→ текст DSL (для конструктора)
//
// DSL (по одной команде на строку; строки c # — комментарии):
//   domain 0 3            — диапазон оси (по умолчанию 0..5)
//   ray right 1 open      — луч вправо от 1, конец выколот (open|fill)
//   ray left 2 fill       — луч влево до 2, конец закрашен
//   seg 1 2 open open     — отрезок [1;2], концы open|fill
//   point 2 fill          — отдельная точка
//   tick 1.5 1,5          — подпись под осью (label опционален)

const DEFAULT_DOMAIN = [0, 5];
// Строгий монохромный стиль: чернильная ось, штриховка чуть светлее серым,
// никаких цветных акцентов — чисто и без потерь печатается в Ч/Б.
const COLORS = { axis: '#1f2937', hatch: '#4b5563', tick: '#374151', mark: '#1f2937' };

const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (n) => Math.round(n * 100) / 100;

// Обыкновенная дробь a/b в подписи (числитель/знаменатель, опц. минус)
const FRAC_RE = /^(-?)(\d+)\/(\d+)$/;

// «1,5» / «-2» / «1/2» / «inf» / … → число (включая дроби и ±Infinity)
function parseCoord(tok) {
  const t = String(tok ?? '').trim().toLowerCase().replace(',', '.');
  if (t === 'inf' || t === '+inf' || t === '∞' || t === '+∞') return Infinity;
  if (t === '-inf' || t === '-∞') return -Infinity;
  const fm = t.replace(/\s+/g, '').match(FRAC_RE);
  if (fm) {
    const den = Number(fm[3]);
    if (den) return (fm[1] === '-' ? -1 : 1) * (Number(fm[2]) / den);
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// Для DSL: ±Infinity → inf/-inf, иначе исходный токен как есть (строка/число).
// Дроби «1/2» и десятичные сохраняются без преобразования.
function coordToken(v) {
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  const s = String(v ?? '').trim();
  return s || '0';
}

// Подпись по координатному токену: дробь «1/2» сохраняем (отрисуется дробью),
// десятичные — с запятой. Используется для авто-тиков лучей/отрезков/точек.
function coordLabel(tok) {
  const t = String(tok ?? '').trim().replace(/\s+/g, '');
  if (FRAC_RE.test(t)) return t;
  return t.replace('.', ',');
}

// Десятичная подпись по-русски (точка → запятая)
function fmtLabel(x) {
  return String(x).replace('.', ',');
}

// Зазор от оси до верха подписи. У обычного <text> (базовая линия axisY+15,
// кегль 11) он около 7; дроби даём чуть больше — её верхняя цифра стоит прямо
// под кружком точки и без запаса читается как приклеенная.
const LABEL_TOP_GAP = 8.5;

// SVG-подпись ПОД осью: дробь a/b — стопкой (числитель/черта/знаменатель),
// иначе обычный <text>. Возвращает строку SVG-элементов.
function belowLabelSvg(label, cx, axisY, fs, color) {
  const m = String(label).match(FRAC_RE);
  if (!m) {
    return `<text x="${round2(cx)}" y="${axisY + 15}" font-size="${fs}" text-anchor="middle" fill="${color}">${escapeXml(label)}</text>`;
  }
  const neg = m[1] === '-';
  const num = m[2];
  const den = m[3];
  const ffs = fs - 0.5;
  const half = Math.max(num.length, den.length) * ffs * 0.34 + 1.5;
  // Числитель начинается сразу под осью и налезал на кружок точки (r 3.4 +
  // обводка 1.3 → низ кружка ≈ axisY + 4): дробь «слипалась» с точкой. Держим
  // от оси тот же зазор, что у обычной подписи — 7 px до верха цифры.
  // Высота цифры ≈ 0.72 кегля, черта на 2.5 ниже базовой линии числителя.
  const barY = round2(axisY + LABEL_TOP_GAP + 0.72 * ffs + 2.5);
  const out = [];
  if (neg) {
    out.push(`<text x="${round2(cx - half - 2.5)}" y="${round2(barY + ffs * 0.36)}" font-size="${fs}" text-anchor="end" fill="${color}">−</text>`);
  }
  out.push(`<text x="${round2(cx)}" y="${round2(barY - 2.5)}" font-size="${ffs}" text-anchor="middle" fill="${color}">${num}</text>`);
  out.push(`<line x1="${round2(cx - half)}" y1="${round2(barY)}" x2="${round2(cx + half)}" y2="${round2(barY)}" stroke="${color}" stroke-width="1"/>`);
  out.push(`<text x="${round2(cx)}" y="${round2(barY + ffs)}" font-size="${ffs}" text-anchor="middle" fill="${color}">${den}</text>`);
  return out.join('');
}

const isFilledToken = (tok) => {
  const t = String(tok || '').toLowerCase();
  return t === 'fill' || t === 'closed';
};

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Разбор текстового DSL в модель.
 * @returns {{domain:[number,number], bars:Array, points:Array, ticks:Array}}
 */
export function parseNumberLine(spec) {
  const model = {
    domain: [...DEFAULT_DOMAIN], bars: [], points: [], ticks: [],
    axisLabel: 'x', scale: null, marks: [],
  };
  if (!spec || typeof spec !== 'string') return model;
  let domainSet = false;

  const tickAt = new Map(); // x → label (label=undefined → формат по значению)
  const addTick = (x, label) => {
    if (!Number.isFinite(x)) return;
    if (label != null) tickAt.set(x, label);
    else if (!tickAt.has(x)) tickAt.set(x, undefined);
  };
  const addPoint = (x, filled) => {
    if (!Number.isFinite(x)) return;
    model.points.push({ x, filled: !!filled });
  };

  // Команды разделяются переносом строки (блочная форма) ИЛИ «;» (inline-форма
  // для ячеек markdown-таблиц, где переносов нет).
  for (const rawLine of spec.split(/[\n;]/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const p = line.split(/\s+/);
    const cmd = p[0].toLowerCase();

    if (cmd === 'domain') {
      const a = parseCoord(p[1]);
      const b = parseCoord(p[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a < b) { model.domain = [a, b]; domainSet = true; }
    } else if (cmd === 'axis' || cmd === 'label') {
      if (p[1]) model.axisLabel = p.slice(1).join(' ');
    } else if (cmd === 'scale') {
      // Линейка с целыми засечками: scale FROM TO [STEP]
      const from = parseCoord(p[1]);
      const to = parseCoord(p[2]);
      const step = p[3] != null ? parseCoord(p[3]) : 1;
      if (Number.isFinite(from) && Number.isFinite(to) && from < to) {
        model.scale = { from, to, step: Number.isFinite(step) && step > 0 ? step : 1 };
        if (!domainSet) model.domain = [from, to];
      }
    } else if (cmd === 'mark') {
      // Помеченная точка над осью: mark LABEL X
      const label = p[1];
      const x = parseCoord(p[2]);
      if (label && Number.isFinite(x)) model.marks.push({ x, label });
    } else if (cmd === 'seg' || cmd === 'segment') {
      const a = parseCoord(p[1]);
      const b = parseCoord(p[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
        model.bars.push({ from: Math.min(a, b), to: Math.max(a, b) });
        addPoint(a, isFilledToken(p[3]));
        addPoint(b, isFilledToken(p[4]));
        addTick(a, coordLabel(p[1]));
        addTick(b, coordLabel(p[2]));
      }
    } else if (cmd === 'ray') {
      const dir = (p[1] || '').toLowerCase();
      const x = parseCoord(p[2]);
      if (Number.isFinite(x)) {
        if (dir === 'left') model.bars.push({ from: -Infinity, to: x });
        else model.bars.push({ from: x, to: Infinity });
        addPoint(x, isFilledToken(p[3]));
        addTick(x, coordLabel(p[2]));
      }
    } else if (cmd === 'point') {
      const x = parseCoord(p[1]);
      addPoint(x, isFilledToken(p[2]));
      addTick(x, coordLabel(p[1]));
    } else if (cmd === 'tick') {
      const x = parseCoord(p[1]);
      const label = p.slice(2).join(' ') || undefined;
      addTick(x, label);
    }
  }

  model.ticks = [...tickAt.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([x, label]) => ({ x, label }));
  return model;
}

// Аналитически обрезанные диагонали 45° (x+y=c) внутри полосы [x1..x2]×[yt..yb].
// Возвращает массив [x1,y1,x2,y2] — без выхода за границы полосы (важно для печати).
function hatchSegments(x1, yt, x2, yb, gap = 5) {
  const segs = [];
  const cMin = x1 + yt;
  const cMax = x2 + yb;
  for (let c = Math.ceil(cMin / gap) * gap; c <= cMax; c += gap) {
    const xlo = Math.max(x1, c - yb);
    const xhi = Math.min(x2, c - yt);
    if (xlo <= xhi) segs.push([xlo, c - xlo, xhi, c - xhi]);
  }
  return segs;
}

/**
 * Построить SVG-строку числовой прямой по модели.
 */
export function numberLineSvg(model, opts = {}) {
  const W = opts.width || 260;
  // Дробные подписи занимают больше места под осью → выше холст и больший отступ.
  const fracPresent = (model?.ticks || []).some((t) => t.label != null && FRAC_RE.test(String(t.label)));
  const H = opts.height || (fracPresent ? 64 : 48);
  const PAD = 14;
  // Дробь опущена ниже (не липнет к точке), поэтому знаменателю нужно больше
  // места. AXIS_Y при этом не меняется — растёт только поле под осью.
  const bottomPad = fracPresent ? 32 : 20;
  const AXIS_Y = H - bottomPad;
  const dom = (model && model.domain) || DEFAULT_DOMAIN;
  const [dmin, dmax] = dom;
  const span = dmax - dmin || 1;
  const sx = (v) => PAD + ((clampNum(v, dmin, dmax) - dmin) / span) * (W - 2 * PAD);

  const parts = [];

  // 1) Штриховка интервалов (полоска над осью)
  for (const b of model?.bars || []) {
    const lo = Math.min(sx(b.from), sx(b.to));
    const hi = Math.max(sx(b.from), sx(b.to));
    for (const [a1, c1, a2, c2] of hatchSegments(lo, AXIS_Y - 8, hi, AXIS_Y - 1)) {
      parts.push(
        `<line x1="${round2(a1)}" y1="${round2(c1)}" x2="${round2(a2)}" y2="${round2(c2)}" stroke="${COLORS.hatch}" stroke-width="1.15"/>`,
      );
    }
  }

  // 2) Ось + единственная правая стрелка (направление оси) + буква-подпись.
  //    Левую стрелку НЕ рисуем: уход в −∞ показывает сама штриховка до края.
  const axisLabel = (model && model.axisLabel) || 'x';
  parts.push(
    `<line x1="${PAD}" y1="${AXIS_Y}" x2="${W - PAD}" y2="${AXIS_Y}" stroke="${COLORS.axis}" stroke-width="1.3"/>`,
  );
  parts.push(
    `<path d="M${W - PAD},${AXIS_Y} L${W - PAD - 6.5},${AXIS_Y - 3} L${W - PAD - 6.5},${AXIS_Y + 3} Z" fill="${COLORS.axis}"/>`,
  );
  parts.push(
    `<text x="${W - 2}" y="${AXIS_Y + 4}" font-size="11" font-style="italic" text-anchor="end" fill="${COLORS.axis}">${escapeXml(axisLabel)}</text>`,
  );

  // 3) Линейка с целыми засечками (scale): короткие штрихи + числа под осью
  if (model?.scale) {
    const { from, to, step } = model.scale;
    for (let v = from; v <= to + 1e-9; v += step) {
      const x = round2(sx(v));
      parts.push(
        `<line x1="${x}" y1="${AXIS_Y - 3}" x2="${x}" y2="${AXIS_Y + 3}" stroke="${COLORS.axis}" stroke-width="1"/>`,
      );
      parts.push(belowLabelSvg(fmtLabel(Math.round(v * 1e6) / 1e6), x, AXIS_Y, 10, COLORS.tick));
    }
  }

  // 4) Помеченные точки над осью (mark): штрих + закрашенная точка + буква сверху
  for (const m of model?.marks || []) {
    const x = round2(sx(m.x));
    parts.push(
      `<line x1="${x}" y1="${AXIS_Y - 4}" x2="${x}" y2="${AXIS_Y + 4}" stroke="${COLORS.mark}" stroke-width="1.1"/>`,
    );
    parts.push(
      `<circle cx="${x}" cy="${AXIS_Y}" r="2.1" fill="${COLORS.mark}"/>`,
    );
    parts.push(
      `<text x="${x}" y="${AXIS_Y - 8}" font-size="11" font-style="italic" text-anchor="middle" fill="${COLORS.axis}">${escapeXml(m.label)}</text>`,
    );
  }

  // 5) Точки интервалов (выколотые ○ / закрашенные ●)
  for (const pt of model?.points || []) {
    parts.push(
      `<circle cx="${round2(sx(pt.x))}" cy="${AXIS_Y}" r="3.4" fill="${pt.filled ? COLORS.axis : '#fff'}" stroke="${COLORS.axis}" stroke-width="1.3"/>`,
    );
  }

  // 6) Подписи под осью (ticks интервалов; дроби — стопкой)
  for (const t of model?.ticks || []) {
    const label = t.label != null ? t.label : fmtLabel(t.x);
    parts.push(belowLabelSvg(label, round2(sx(t.x)), AXIS_Y, 11, COLORS.tick));
  }

  // max-width:100% — чтобы блочная прямая не вылезала в узкой печатной колонке.
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" class="numline-svg" role="img">${parts.join('')}</svg>`;
}

export function numberLineSvgFromSpec(spec, opts) {
  return numberLineSvg(parseNumberLine(spec), opts);
}

/**
 * Сериализация состояния конструктора в текст DSL.
 * @param {{domain:[number,number], shapes:Array}} state
 */
export function shapesToSpec({ domain = DEFAULT_DOMAIN, shapes = [], axisLabel = 'x' } = {}) {
  const lines = [`domain ${coordToken(domain[0])} ${coordToken(domain[1])}`];
  if (axisLabel && axisLabel !== 'x') lines.push(`axis ${axisLabel}`);
  for (const s of shapes) {
    if (s.type === 'ray') {
      lines.push(`ray ${s.dir === 'left' ? 'left' : 'right'} ${coordToken(s.x)} ${s.filled ? 'fill' : 'open'}`);
    } else if (s.type === 'seg') {
      lines.push(`seg ${coordToken(s.a)} ${coordToken(s.b)} ${s.ea ? 'fill' : 'open'} ${s.eb ? 'fill' : 'open'}`);
    } else if (s.type === 'point') {
      lines.push(`point ${coordToken(s.x)} ${s.filled ? 'fill' : 'open'}`);
    } else if (s.type === 'tick') {
      lines.push(`tick ${coordToken(s.x)}${s.label ? ` ${s.label}` : ''}`);
    }
  }
  return lines.join('\n');
}

/**
 * Сериализация «точечного» типа (линейка + помеченные точки A,B,C,D).
 * @param {{scale:{from,to,step}, marks:Array<{label,x}>, axisLabel?:string}} state
 */
export function pointsToSpec({ scale, marks = [], axisLabel = 'x' } = {}) {
  const lines = [];
  if (axisLabel && axisLabel !== 'x') lines.push(`axis ${axisLabel}`);
  if (scale) {
    lines.push(`scale ${coordToken(scale.from)} ${coordToken(scale.to)} ${scale.step || 1}`);
  }
  for (const m of marks) {
    if (m.label && m.x != null) lines.push(`mark ${m.label} ${coordToken(m.x)}`);
  }
  return lines.join('\n');
}
