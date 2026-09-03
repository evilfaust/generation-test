/**
 * Общее ядро линейных выражений: рациональная арифметика + маленькое дерево
 * узлов, из которого считаются И LaTeX, И коэффициенты приведённой формы
 * `a·x + b`. Общее для генераторов линейных уравнений и неравенств — держать
 * рендер и вычисление в одном месте важно: иначе напечатанное условие и
 * напечатанный ответ могут разойтись.
 *
 * Сторона выражения — массив узлов (сумма); знак слагаемого берётся из его
 * коэффициента, поэтому `[vr(1), num(-3)]` печатается как «x - 3».
 */

// ─── Рациональная арифметика ─────────────────────────────────────────────────
export function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

export function rat(n, d = 1) {
  if (d === 0) return null;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export const R0 = rat(0);
export const R1 = rat(1);

export const negR   = (x) => rat(-x.n, x.d);
export const addR   = (x, y) => rat(x.n * y.d + y.n * x.d, x.d * y.d);
export const subR   = (x, y) => addR(x, negR(y));
export const mulR   = (x, y) => rat(x.n * y.n, x.d * y.d);
export const divR   = (x, y) => (y.n === 0 ? null : rat(x.n * y.d, x.d * y.n));
export const isZero = (x) => x.n === 0;
export const isOne  = (x) => x.n === 1 && x.d === 1;
export const isNegOne = (x) => x.n === -1 && x.d === 1;
export const absR   = (x) => (x.n < 0 ? negR(x) : x);
export const toNum  = (x) => x.n / x.d;

// Конечная десятичная запись? (знаменатель раскладывается только на 2 и 5)
export function isTerminating(d) {
  let x = Math.abs(d);
  while (x % 2 === 0) x /= 2;
  while (x % 5 === 0) x /= 5;
  return x === 1;
}

// Сколько знаков после запятой в десятичной записи (null — записи нет)
export function decimalDigits(r) {
  if (!isTerminating(r.d)) return null;
  let d = r.d, k = 0;
  while (d % 2 === 0) { d /= 2; k++; }
  let f = r.d, m = 0;
  while (f % 5 === 0) { f /= 5; m++; }
  return Math.max(k, m);
}

// «Круглое» десятичное число: конечная запись не длиннее maxDigits знаков
export function niceDecimal(r, maxDigits = 3) {
  const dd = decimalDigits(r);
  return dd !== null && dd <= maxDigits;
}

// ─── Случайные величины ──────────────────────────────────────────────────────
export function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
export function chance(p) { return Math.random() < p; }

// ─── Форматирование чисел ────────────────────────────────────────────────────
// prefer: 'dec' — по возможности десятичная запись, 'frac' — обыкновенная дробь
export function decTex(r) {
  const dd = decimalDigits(r);
  if (dd === null) return null;
  const s = toNum(r).toFixed(dd);
  return s.replace('.', '{,}');
}

export function fmtNum(r, prefer = 'frac') {
  if (r.d === 1) return String(r.n);
  if (prefer === 'dec') {
    const s = decTex(r);
    if (s) return s;
  }
  return r.n < 0 ? `-\\dfrac{${-r.n}}{${r.d}}` : `\\dfrac{${r.n}}{${r.d}}`;
}

// Коэффициент перед переменной: 3x, -x, 0{,}4x, \dfrac{2}{3}x
export function coefTex(k, varTex, prefer) {
  if (isOne(k)) return varTex;
  if (isNegOne(k)) return `-${varTex}`;
  return `${fmtNum(k, prefer)}${varTex}`;
}

// ─── Дерево уравнения ────────────────────────────────────────────────────────
// Сторона уравнения — массив узлов (сумма). Знак слагаемого берётся из его
// коэффициента: `[vr(1), num(-3)]` печатается как «x - 3».
export const num = (r, prefer = 'frac') => ({ t: 'num', r, prefer });
export const vr  = (k, prefer = 'frac') => ({ t: 'var', k, prefer });
export const mul = (k, inner, prefer = 'frac') => ({ t: 'mul', k, inner, prefer });
export const dvd = (inner, d, prefer = 'frac') => ({ t: 'div', inner, d, prefer });

export function nodeSign(node) {
  switch (node.t) {
    case 'num': return node.r.n < 0 ? -1 : 1;
    case 'var': return node.k.n < 0 ? -1 : 1;
    case 'mul': return node.k.n < 0 ? -1 : 1;
    // У дроби с одночленом в числителе минус выносим наружу: «- x/6», а не
    // «+ (-x)/6». Из суммы в числителе выносить нечего.
    case 'div': return node.inner.length === 1 ? nodeSign(node.inner[0]) : 1;
    default:    return 1;
  }
}

export function absNode(node) {
  switch (node.t) {
    case 'num': return { ...node, r: absR(node.r) };
    case 'var': return { ...node, k: absR(node.k) };
    case 'mul': return { ...node, k: absR(node.k) };
    case 'div': return node.inner.length === 1
      ? { ...node, inner: [absNode(node.inner[0])] }
      : node;
    default:    return node;
  }
}

// Приведение стороны к виду a·x + b
export function linearOfNode(node) {
  switch (node.t) {
    case 'num': return { a: R0, b: node.r };
    case 'var': return { a: node.k, b: R0 };
    case 'mul': {
      const { a, b } = linearOfSide(node.inner);
      return { a: mulR(node.k, a), b: mulR(node.k, b) };
    }
    case 'div': {
      const { a, b } = linearOfSide(node.inner);
      return { a: divR(a, node.d), b: divR(b, node.d) };
    }
    default: return { a: R0, b: R0 };
  }
}

export function linearOfSide(side) {
  return side.reduce((acc, node) => {
    const { a, b } = linearOfNode(node);
    return { a: addR(acc.a, a), b: addR(acc.b, b) };
  }, { a: R0, b: R0 });
}

export function renderNode(node, varTex) {
  switch (node.t) {
    case 'num': return fmtNum(node.r, node.prefer);
    case 'var': return coefTex(node.k, varTex, node.prefer);
    case 'mul': {
      const inner = renderSide(node.inner, varTex);
      if (isOne(node.k))    return `\\left(${inner}\\right)`;
      if (isNegOne(node.k)) return `-\\left(${inner}\\right)`;
      return `${fmtNum(node.k, node.prefer)}\\left(${inner}\\right)`;
    }
    case 'div':
      return `\\dfrac{${renderSide(node.inner, varTex)}}{${fmtNum(node.d, node.prefer)}}`;
    default: return '';
  }
}

export function isZeroNode(node) {
  if (node.t === 'num') return isZero(node.r);
  if (node.t === 'var') return isZero(node.k);
  if (node.t === 'mul') return isZero(node.k);
  return false;
}

export function renderSide(side, varTex) {
  // Нулевые слагаемые не печатаем: «x + 0» → «x» (но одинокий 0 остаётся)
  const visible = side.filter(n => !isZeroNode(n));
  if (visible.length === 0) return '0';
  return visible.map((node, i) => {
    if (i === 0) return renderNode(node, varTex);
    return nodeSign(node) < 0
      ? ` - ${renderNode(absNode(node), varTex)}`
      : ` + ${renderNode(node, varTex)}`;
  }).join('');
}

// Готовое уравнение от категории
export const eq = (left, right, prefer = 'frac') => ({ left, right, prefer });

// ─── Пулы чисел ──────────────────────────────────────────────────────────────
export const INT_COEFS   = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const ROOTS_INT   = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20];
export const ROOTS_SMALL = [2, 3, 4, 5, 6, 7, 8, 9, 10];
// Десятичные коэффициенты — как в тетради: 0,1 … 2,5
export const DEC_COEFS = [
  [1, 10], [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [8, 10], [9, 10],
  [12, 10], [13, 10], [15, 10], [16, 10], [24, 10], [25, 10],
].map(([n, d]) => rat(n, d));
// Десятичные корни
export const ROOTS_DEC = [
  [1, 2], [3, 2], [5, 2], [1, 5], [2, 5], [3, 5], [4, 5], [6, 5],
  [1, 4], [3, 4], [1, 10], [3, 10], [7, 10], [9, 10], [12, 5],
].map(([n, d]) => rat(n, d));
export const FRAC_DENS = [2, 3, 4, 5, 6, 8, 9];

export function coprimeNumerators(d) {
  const res = [];
  for (let a = 1; a < d; a++) if (gcd(a, d) === 1) res.push(a);
  return res.length ? res : [1];
}

// Случайная обыкновенная дробь 0 < a/b < 1 (иногда неправильная: 3/2, 5/3)
export function randFrac({ improper = false } = {}) {
  const d = rand(FRAC_DENS);
  const n = improper && chance(0.35)
    ? d + rand(coprimeNumerators(d))
    : rand(coprimeNumerators(d));
  return rat(n, d);
}

