/**
 * Числа вида `p + q·√m` — всё, что может дать квадратное уравнение.
 *
 * Корни квадратного уравнения с рациональными коэффициентами всегда лежат в
 * поле `Q(√m)`: рациональная часть плюс кратное одному корню. Такие числа
 * замкнуты относительно четырёх действий, поэтому уравнение можно строить
 * «от корней» — перемножить `(x − x₁)(x − x₂)` и получить точные коэффициенты,
 * а не подбирать их и надеяться, что дискриминант окажется красивым.
 *
 * Инварианты: `m` — натуральное, свободное от квадратов; при `q = 0` всегда
 * `m = 1`. Нормализацию держит конструктор `sr` — вручную объект не собирать.
 *
 * Операции возвращают `null`, если аргументы несовместимы (разные радикалы:
 * √2 + √3 из поля выходит) или делитель нулевой. Вызывающий код это проверяет —
 * категории генератора на таком просто возвращают null и пробуют другие числа.
 */

import {
  rat, R0, gcd, addR, subR, mulR, divR, negR, isZero, toNum, fmtNum,
} from './linearExpr';

const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);

/** n = k²·m, где m свободно от квадратов: 12 → {k: 2, m: 3} */
export function squareFree(n) {
  let k = 1;
  let m = Math.abs(Math.trunc(n));
  if (m === 0) return { k: 0, m: 1 };
  for (let d = 2; d * d <= m; d++) {
    while (m % (d * d) === 0) { m /= d * d; k *= d; }
  }
  return { k, m };
}

/**
 * Конструктор: `sr(p, q, m)` = p + q·√m.
 * Приводит радикал к свободному от квадратов (√12 → 2√3) и сливает
 * вырожденные случаи в рациональное число.
 */
export function sr(p, q = R0, m = 1) {
  if (!Number.isInteger(m) || m < 1) return null;
  const { k, m: mm } = squareFree(m);
  const qq = k === 1 ? q : mulR(q, rat(k));
  if (mm === 1) return { p: addR(p, qq), q: R0, m: 1 };
  if (isZero(qq)) return { p, q: R0, m: 1 };
  return { p, q: qq, m: mm };
}

export const sRat = (r) => sr(r);
export const sInt = (n) => sr(rat(n));
/** k·√m — самый частый иррациональный корень (√3, 2√5, √7/2) */
export const sRad = (k, m) => sr(R0, k, m);

export const S0 = sInt(0);
export const S1 = sInt(1);

export const sIsRat  = (s) => isZero(s.q);
export const sIsZero = (s) => isZero(s.p) && isZero(s.q);
export const sNum    = (s) => toNum(s.p) + toNum(s.q) * Math.sqrt(s.m);
export const sSign   = (s) => (sIsZero(s) ? 0 : (sNum(s) < 0 ? -1 : 1));
export const sNeg    = (s) => sr(negR(s.p), negR(s.q), s.m);
export const sAbs    = (s) => (sSign(s) < 0 ? sNeg(s) : s);
export const sConj   = (s) => sr(s.p, negR(s.q), s.m);

// Общий радикал двух чисел: рациональное подстраивается под любой
function joinM(a, b) {
  if (sIsRat(a)) return b.m;
  if (sIsRat(b)) return a.m;
  return a.m === b.m ? a.m : null;
}

export function sAdd(a, b) {
  const m = joinM(a, b);
  return m === null ? null : sr(addR(a.p, b.p), addR(a.q, b.q), m);
}

export function sSub(a, b) {
  const m = joinM(a, b);
  return m === null ? null : sr(subR(a.p, b.p), subR(a.q, b.q), m);
}

export function sMul(a, b) {
  const m = joinM(a, b);
  if (m === null) return null;
  // (p₁ + q₁√m)(p₂ + q₂√m) = p₁p₂ + q₁q₂m + (p₁q₂ + p₂q₁)√m
  const p = addR(mulR(a.p, b.p), mulR(mulR(a.q, b.q), rat(m)));
  const q = addR(mulR(a.p, b.q), mulR(a.q, b.p));
  return sr(p, q, m);
}

export function sDiv(a, b) {
  const m = joinM(a, b);
  if (m === null || sIsZero(b)) return null;
  // Домножаем на сопряжённое: знаменатель становится рациональным
  const den = subR(mulR(b.p, b.p), mulR(mulR(b.q, b.q), rat(m)));
  if (isZero(den)) return null;
  const numer = sMul(a, sConj(b));
  if (!numer) return null;
  return sr(divR(numer.p, den), divR(numer.q, den), m);
}

export const sEq = (a, b) => {
  const d = sSub(a, b);
  return d !== null && sIsZero(d);
};

export const sCompare = (a, b) => sNum(a) - sNum(b);

/** Квадратный корень из числа, если он тоже лежит в Q(√m): √12 → 2√3, √5 → √5 */
export function sSqrt(s) {
  if (!sIsRat(s) || toNum(s.p) < 0) return null;
  const { n, d } = s.p;
  // √(n/d) = √(nd)/d
  const { k, m } = squareFree(n * d);
  return sr(R0, rat(k, d), m);
}

// ─── LaTeX ───────────────────────────────────────────────────────────────────
const coefStr = (n) => (Math.abs(n) === 1 ? (n < 0 ? '-' : '') : String(n));

// k·√m: √3, 2√3, -√3, √3/2
function radTex(q, m) {
  const root = `\\sqrt{${m}}`;
  if (q.d === 1) return `${coefStr(q.n)}${root}`;
  const sign = q.n < 0 ? '-' : '';
  const n = Math.abs(q.n);
  return `${sign}\\dfrac{${n === 1 ? '' : n}${root}}{${q.d}}`;
}

// p + q√m одной дробью: 2 + √3, (5 - √13)/2 — так корень читается привычнее,
// чем «5/2 - √13/2»
function combinedTex(p, q, m) {
  const d = lcm(p.d, q.d);
  const P = p.n * (d / p.d);
  const Q = q.n * (d / q.d);
  const absQ = Math.abs(Q);
  const body = `${P} ${Q < 0 ? '-' : '+'} ${absQ === 1 ? '' : absQ}\\sqrt{${m}}`;
  return d === 1 ? body : `\\dfrac{${body}}{${d}}`;
}

export function sTex(s, prefer = 'frac') {
  if (sIsRat(s)) return fmtNum(s.p, prefer);
  if (isZero(s.p)) return radTex(s.q, s.m);
  return combinedTex(s.p, s.q, s.m);
}

/**
 * Пара сопряжённых корней одной записью: `2 \pm \sqrt{3}`, `(5 \pm \sqrt{13})/2`.
 * Возвращает null, если корни не сопряжены — тогда их печатают порознь.
 */
export function sPairTex(a, b) {
  if (sIsRat(a) || sIsRat(b) || a.m !== b.m) return null;
  if (!isZero(subR(a.p, b.p)) || !isZero(addR(a.q, b.q))) return null;
  const p = a.p;
  const q = a.q.n < 0 ? b.q : a.q;          // берём положительную половину
  const d = lcm(p.d, q.d);
  const P = p.n * (d / p.d);
  const Q = Math.abs(q.n * (d / q.d));
  const radical = `${Q === 1 ? '' : Q}\\sqrt{${a.m}}`;
  const body = isZero(p) ? `\\pm ${radical}` : `${P} \\pm ${radical}`;
  return d === 1 ? body : `\\dfrac{${body}}{${d}}`;
}
