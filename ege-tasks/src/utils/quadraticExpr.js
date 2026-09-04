/**
 * Дерево квадратного уравнения: по одному и тому же дереву считаются и LaTeX
 * условия, и коэффициенты многочлена. Тот же приём, что в `linearExpr` для
 * линейных уравнений — условие и ответ физически не могут разойтись, потому
 * что берутся из одного источника.
 *
 * Коэффициенты — числа из `Q(√m)` (см. `surd.js`), поэтому одним деревом
 * описываются и `2x² − 7x + 3 = 0`, и `x² − 4√3·x + 9 = 0`.
 *
 * Сторона уравнения — массив узлов (сумма); знак слагаемого берётся из знака
 * его коэффициента, поэтому `[qx2(1), qn(-9)]` печатается как «x² − 9».
 */

import { rat, isZero, toNum, addR, subR, mulR, divR, negR } from './linearExpr';
import {
  sr, sRat, sInt, S0, S1, sIsRat, sIsZero, sNum, sSign, sNeg, sAbs,
  sAdd, sSub, sMul, sDiv, sTex, sCompare, squareFree,
} from './surd';

// ─── Узлы ────────────────────────────────────────────────────────────────────
// lin — линейный множитель { a, b } (числа Q(√m)), означает a·x + b
export const lin = (a, b) => ({ a, b });

export const qn    = (s, prefer = 'frac') => ({ t: 'num', s, prefer });
export const qx    = (s, prefer = 'frac') => ({ t: 'x',   s, prefer });
export const qx2   = (s, prefer = 'frac') => ({ t: 'x2',  s, prefer });
export const qx4   = (s, prefer = 'frac') => ({ t: 'x4',  s, prefer });
/** s·(a·x + b)² */
export const qsq   = (s, l, prefer = 'frac') => ({ t: 'sq', s, l, prefer });
/** s·(a₁x + b₁)(a₂x + b₂) */
export const qprod = (s, l1, l2, prefer = 'frac') => ({ t: 'prod', s, l1, l2, prefer });
/** s / x — дробь с переменной в знаменателе */
export const qinv  = (s, prefer = 'frac') => ({ t: 'inv', s, prefer });

export const eqQ = (left, right, prefer = 'frac') => ({ left, right, prefer });

// ─── Рендер ──────────────────────────────────────────────────────────────────
// Коэффициент перед степенью: x, -x, 3x, 2√3·x, (1 − √3)x
function coefTexS(s, suffix, prefer) {
  if (!suffix) return sTex(s, prefer);
  if (sIsRat(s)) {
    if (s.p.n === 1 && s.p.d === 1) return suffix;
    if (s.p.n === -1 && s.p.d === 1) return `-${suffix}`;
    return `${sTex(s, prefer)}${suffix}`;
  }
  // «1 − √3» рядом с x слиплось бы в «1 − √3x» — такое берём в скобки,
  // одночлен вида 2√3 обходится без них
  const body = sTex(s, prefer);
  return isZero(s.p) ? `${body}${suffix}` : `\\left(${body}\\right)${suffix}`;
}

function linTex(l, varTex, prefer) {
  const head = coefTexS(l.a, varTex, prefer);
  if (sIsZero(l.b)) return head;
  const neg = sSign(l.b) < 0;
  return `${head} ${neg ? '-' : '+'} ${sTex(sAbs(l.b), prefer)}`;
}

// Множитель перед скобкой: 1 и −1 не печатаем цифрой
function scaleTex(s, prefer) {
  if (sIsRat(s)) {
    if (s.p.n === 1 && s.p.d === 1) return '';
    if (s.p.n === -1 && s.p.d === 1) return '-';
  }
  return sTex(s, prefer);
}

export function renderQNode(node, varTex) {
  const p = node.prefer;
  switch (node.t) {
    case 'num':  return sTex(node.s, p);
    case 'x':    return coefTexS(node.s, varTex, p);
    case 'x2':   return coefTexS(node.s, `${varTex}^2`, p);
    case 'x4':   return coefTexS(node.s, `${varTex}^4`, p);
    case 'sq':   return `${scaleTex(node.s, p)}\\left(${linTex(node.l, varTex, p)}\\right)^2`;
    case 'prod':
      return `${scaleTex(node.s, p)}\\left(${linTex(node.l1, varTex, p)}\\right)`
           + `\\left(${linTex(node.l2, varTex, p)}\\right)`;
    case 'inv':  return `\\dfrac{${sTex(node.s, p)}}{${varTex}}`;
    default:     return '';
  }
}

export function qNodeSign(node) {
  return sSign(node.s) < 0 ? -1 : 1;
}

export function qAbsNode(node) {
  return sSign(node.s) < 0 ? { ...node, s: sNeg(node.s) } : node;
}

export const isZeroQNode = (node) => sIsZero(node.s);

export function renderQSide(side, varTex) {
  const visible = side.filter(n => !isZeroQNode(n));
  if (visible.length === 0) return '0';
  return visible.map((node, i) => {
    if (i === 0) return renderQNode(node, varTex);
    return qNodeSign(node) < 0
      ? ` - ${renderQNode(qAbsNode(node), varTex)}`
      : ` + ${renderQNode(node, varTex)}`;
  }).join('');
}

// ─── Приведение к многочлену ─────────────────────────────────────────────────
// Многочлен — объект «степень → коэффициент». Степень −1 бывает у дробных
// уравнений (`x + 6/x = 5`), степень 4 — у биквадратных.
function addTerm(poly, power, s) {
  if (!s) return null;
  const prev = poly[power] || S0;
  const sum = sAdd(prev, s);
  if (!sum) return null;                    // разные радикалы в одном уравнении
  poly[power] = sum;
  return poly;
}

export function polyOfQNode(node) {
  const poly = {};
  switch (node.t) {
    case 'num': return addTerm(poly, 0, node.s);
    case 'x':   return addTerm(poly, 1, node.s);
    case 'x2':  return addTerm(poly, 2, node.s);
    case 'x4':  return addTerm(poly, 4, node.s);
    case 'inv': return addTerm(poly, -1, node.s);
    case 'sq': {
      const { a, b } = node.l;
      const two = sInt(2);
      return addTerm(poly, 2, sMul(node.s, sMul(a, a)))
          && addTerm(poly, 1, sMul(node.s, sMul(two, sMul(a, b))))
          && addTerm(poly, 0, sMul(node.s, sMul(b, b)))
          ? poly : null;
    }
    case 'prod': {
      const { a: a1, b: b1 } = node.l1;
      const { a: a2, b: b2 } = node.l2;
      const mid = sAdd(sMul(a1, b2), sMul(a2, b1));
      return mid
          && addTerm(poly, 2, sMul(node.s, sMul(a1, a2)))
          && addTerm(poly, 1, sMul(node.s, mid))
          && addTerm(poly, 0, sMul(node.s, sMul(b1, b2)))
          ? poly : null;
    }
    default: return null;
  }
}

export function polyOfQSide(side) {
  const total = {};
  for (const node of side) {
    const part = polyOfQNode(node);
    if (!part) return null;
    for (const [power, s] of Object.entries(part)) {
      if (!addTerm(total, Number(power), s)) return null;
    }
  }
  return total;
}

/** Многочлен «левая часть минус правая» — то, что приравнено нулю */
export function polyOfEquation(built) {
  const left = polyOfQSide(built.left);
  const right = polyOfQSide(built.right);
  if (!left || !right) return null;
  const out = { ...left };
  for (const [power, s] of Object.entries(right)) {
    if (!addTerm(out, Number(power), sNeg(s))) return null;
  }
  for (const [power, s] of Object.entries(out)) {
    if (sIsZero(s)) delete out[power];
  }
  return out;
}

export const polyDegree = (poly) =>
  Object.keys(poly).reduce((max, k) => Math.max(max, Number(k)), -Infinity);

export const polyPowers = (poly) => Object.keys(poly).map(Number).sort((a, b) => a - b);

/** Численное значение многочлена — общая проверка «корень решает уравнение» */
export function evalPolyNum(poly, x) {
  let sum = 0;
  for (const [power, s] of Object.entries(poly)) {
    sum += sNum(s) * Math.pow(x, Number(power));
  }
  return sum;
}

/** Насколько «крупный» многочлен — масштаб для допуска при проверке корня */
export function polyScale(poly) {
  return Object.values(poly).reduce((max, s) => Math.max(max, Math.abs(sNum(s))), 1);
}

// ─── Решение ─────────────────────────────────────────────────────────────────
/**
 * Корни `A·x² + B·x + C = 0` с рациональными коэффициентами.
 *
 * Возвращает `{ kind, roots, D }`: kind — 'none' | 'double' | 'two',
 * roots — числа из Q(√m) по возрастанию, D — дискриминант (рациональный).
 * null — если коэффициенты иррациональные (там уравнение строится от корней)
 * или старший коэффициент нулевой.
 */
export function solveRationalQuadratic(A, B, C) {
  if (!sIsRat(A) || !sIsRat(B) || !sIsRat(C) || sIsZero(A)) return null;
  const a = A.p, b = B.p, c = C.p;

  const disc = subR(mulR(b, b), mulR(rat(4), mulR(a, c)));   // D = b² − 4ac
  const half = divR(negR(b), mulR(rat(2), a));               // −b / (2a)

  if (toNum(disc) < 0) return { kind: 'none', roots: [], D: disc };
  if (isZero(disc)) return { kind: 'double', roots: [sRat(half)], D: disc };

  // √(n/d) = √(n·d)/d, числитель раскладываем на k²·m
  const { k, m } = squareFree(disc.n * disc.d);
  const spread = divR(rat(k, disc.d), mulR(rat(2), a));      // √D / (2a)
  const r1 = sr(half, spread, m);
  const r2 = sr(half, negR(spread), m);
  return { kind: 'two', roots: [r1, r2].sort(sCompare), D: disc };
}

/** Уравнение по корням: scale·(x − x₁)(x − x₂) → коэффициенты A, B, C */
export function quadFromRoots(x1, x2, scale = S1) {
  const sum = sAdd(x1, x2);
  const prod = sMul(x1, x2);
  if (!sum || !prod) return null;
  const A = scale;
  const B = sMul(scale, sNeg(sum));
  const C = sMul(scale, prod);
  return A && B && C ? { A, B, C } : null;
}

/** Стандартная запись `A·x² + B·x + C = 0` из готовых коэффициентов */
export function standardForm(A, B, C, prefer = 'frac') {
  return eqQ([qx2(A, prefer), qx(B, prefer), qn(C, prefer)], [qn(S0)], prefer);
}

export { S0, S1, sInt, sRat, sr };
