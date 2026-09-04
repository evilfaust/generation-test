/**
 * Общие заготовки квадратных заданий: уровни сложности, выбор корней и сборка
 * стандартного вида `A·x² + B·x + C` по корням.
 *
 * Общее для генераторов квадратных уравнений и квадратных неравенств — как
 * `linearForms` для линейных. Форма задания (какие корни, какой старший
 * коэффициент, насколько крупные числа) от знака между частями не зависит:
 * уравнение приравнивает левую часть к нулю, неравенство ставит знак.
 *
 * Возвращают `{ left, right, roots }` либо `null`, если случайные числа дали
 * некрасивые коэффициенты — вызывающий на этом просто пробует ещё раз.
 */

import { rat, R1, niceDecimal, rand, chance } from './linearExpr';
import { sRat, S0, S1, sIsZero, sNum, sCompare, sEq } from './surd';
import { qn, qx, qx2, quadFromRoots } from './quadraticExpr';

// ─── Уровни сложности ────────────────────────────────────────────────────────
// «Растяжка» одного и того же типа задания: на первом уровне корни и
// коэффициенты помещаются в таблицу умножения, на третьем — уже нет.
export const QUAD_LEVELS = {
  1: { roots: [1, 2, 3, 4, 5, 6],                     lead: [2, 3],             dens: [2],          konst: 20,  spread: 6 },
  2: { roots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],    lead: [2, 3, 4, 5, 6],    dens: [2, 3, 4],    konst: 40,  spread: 9 },
  3: { roots: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 20],
       lead: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12],        dens: [2, 3, 4, 5, 6],    konst: 90,  spread: 14 },
};

export const quadPools = (level) => QUAD_LEVELS[level] || QUAD_LEVELS[2];

export const signed = (v) => (chance(0.5) ? -v : v);

/** Два целых корня; `sign` — 'any' | 'positive' | 'negative' | 'mixed' */
export function twoRoots(P, { allowEqual = false, sign = 'any' } = {}) {
  for (let i = 0; i < 40; i++) {
    let r1 = rand(P.roots);
    let r2 = rand(P.roots);
    if (sign === 'positive') { /* оба как есть */ }
    else if (sign === 'negative') { r1 = -r1; r2 = -r2; }
    else if (sign === 'mixed') { r1 = -r1; }
    else { r1 = signed(r1); r2 = signed(r2); }
    if (!allowEqual && r1 === r2) continue;
    return [r1, r2];
  }
  return null;
}

/**
 * Стандартный вид `A·x² + B·x + C` по рациональным корням.
 * `scale` — старший коэффициент: он превращает дробные корни в целые
 * коэффициенты (корни 3 и ½ при scale = 2 дают 2x² − 7x + 3).
 */
export function fromRatRoots(r1, r2, scale = R1, opts = {}) {
  const { prefer = 'frac', requireInt = true, limit = 400, maxDen = 10 } = opts;
  const q = quadFromRoots(sRat(r1), sRat(r2), sRat(scale));
  if (!q) return null;
  const { A, B, C } = q;
  if (sIsZero(A)) return null;
  const coefs = [A, B, C];
  if (requireInt && coefs.some(s => s.p.d !== 1)) return null;
  if (coefs.some(s => s.p.d > maxDen)) return null;
  if (coefs.some(s => Math.abs(sNum(s)) > limit)) return null;
  if (prefer === 'dec' && coefs.some(s => !niceDecimal(s.p, 2))) return null;

  const roots = r1.n * r2.d === r2.n * r1.d
    ? [sRat(r1)]                                   // кратный корень печатаем один раз
    : [sRat(r1), sRat(r2)].sort(sCompare);
  return {
    left: [qx2(A, prefer), qx(B, prefer), qn(C, prefer)],
    right: [qn(S0)],
    roots,
  };
}

/** Стандартный вид по корням из Q(√m) — для блока иррациональностей */
export function fromSurdRoots(x1, x2, scale = S1, prefer = 'frac') {
  const q = quadFromRoots(x1, x2, scale);
  if (!q) return null;
  const { A, B, C } = q;
  if (!A || !B || !C || sIsZero(A)) return null;
  for (const s of [A, B, C]) {
    if (s.p.d > 6 || s.q.d > 6) return null;
    if (Math.abs(sNum(s)) > 300) return null;
  }
  const roots = sEq(x1, x2) ? [x1] : [x1, x2].sort(sCompare);
  return {
    left: [qx2(A, prefer), qx(B, prefer), qn(C, prefer)],
    right: [qn(S0)],
    roots,
  };
}

/** Знак старшего коэффициента собранной задачи (+1 / −1); 0 — если его нет */
export function leadSign(built) {
  const node = built?.left?.find(n => n.t === 'x2' || n.t === 'x4');
  if (!node) return 0;
  return sNum(node.s) < 0 ? -1 : 1;
}

export { rat };
