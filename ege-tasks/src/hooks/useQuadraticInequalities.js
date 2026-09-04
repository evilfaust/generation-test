import { useState, useCallback } from 'react';

/**
 * Генератор квадратных неравенств (раздел «Уравнения»).
 *
 * Устроен как генератор квадратных уравнений: задание строится от корней
 * (`utils/quadraticForms`), печатается деревом узлов (`utils/quadraticExpr`),
 * а решение считает общая таблица «парабола ветвями вверх»
 * (`utils/quadraticInequality`) — категории не знают ни про разворот знака при
 * отрицательном старшем коэффициенте, ни про вырожденные случаи.
 *
 * Перед выдачей каждое задание проверяется численно: во всех пробных точках
 * «принадлежит ответу» обязано совпадать с «неравенство верно». Поэтому
 * ошибка в знаке или строгости границы не может доехать до листа.
 */

import {
  rat, negR, R1, rand, randInt, chance, coprimeNumerators,
} from '../utils/linearExpr';
import {
  sr, sRat, sInt, sRad, S0, S1, sIsRat, sNum, sNeg, sCompare,
} from '../utils/surd';
import {
  lin, qn, qx, qx2, qx4, qsq, qprod,
  renderQSide, polyOfEquation, polyPowers, evalPolyNum,
  solveRationalQuadratic,
} from '../utils/quadraticExpr';
import {
  quadPools, signed, twoRoots, fromRatRoots, fromSurdRoots,
} from '../utils/quadraticForms';
import { OPS, ALL_OPS, STRICT_OPS } from '../utils/inequalityCore';
import {
  solutionFromRoots, inequalityAnswerTex, verifySolution,
} from '../utils/quadraticInequality';
import { generateByCategories } from '../utils/questionPlan';
import { useApplySheet } from './useApplySheet';

const LOOSE_OPS = ['le', 'ge'];

/**
 * Знак неравенства для задания. `allowed` — что имеет смысл в этой категории
 * (у «x ≠ 8» знак обязан быть строгим), настройка листа сужает дальше.
 * null — категория и настройка несовместимы, задание не строится.
 */
function chooseOp(opts, allowed = ALL_OPS) {
  const pool = allowed.filter(o => opts.ops.includes(o));
  return pool.length ? rand(pool) : null;
}

const withOp = (built, op) => (built && op ? { ...built, op } : null);

// ─── Блок 1. Простейшие (устно) ──────────────────────────────────────────────

// x² > 9
function genPureSquare(P, opts) {
  const op = chooseOp(opts);
  const a = rand(P.roots);
  const k = chance(0.3) ? rand([2, 3, 4, 5]) : 1;
  if (k * a * a > 300) return null;
  return withOp({
    left: [qx2(sInt(k))],
    right: [qn(sInt(k * a * a))],
    roots: [sInt(-a), sInt(a)],
  }, op);
}

// x² − 7 ⩽ 0 → −√7 ⩽ x ⩽ √7
function genPureIrr(P, opts) {
  const op = chooseOp(opts);
  const m = rand([2, 3, 5, 6, 7, 10, 11, 13, 15, 17, 19]);
  const k = chance(0.3) ? rand([2, 3, 5]) : 1;
  const roots = [sRad(negR(R1), m), sRad(R1, m)];
  // Половину заданий печатаем как «x² ⩽ 7», половину как «x² − 7 ⩽ 0»
  return withOp(chance(0.5)
    ? { left: [qx2(sInt(k))], right: [qn(sInt(k * m))], roots }
    : { left: [qx2(sInt(k)), qn(sInt(-k * m))], right: [qn(S0)], roots }, op);
}

// x² > 0 · x² ⩽ 0 — вырожденные случаи на кратном корне
function genPureZero(P, opts) {
  const op = chooseOp(opts);
  const k = chance(0.4) ? 1 : rand([2, 3, 5, 7, 10]);
  return withOp({
    left: [qx2(sInt(k))],
    right: [qn(S0)],
    roots: [S0],
  }, op);
}

// x² > −4 → любое число; x² < −4 → решений нет
function genPureNegative(P, opts) {
  const op = chooseOp(opts);
  const k = chance(0.3) ? rand([2, 3, 5]) : 1;
  const c = randInt(1, P.konst);
  return withOp({
    left: [qx2(sInt(k))],
    right: [qn(sInt(-c))],
    roots: [],
  }, op);
}

// 3x² ⩾ 27
function genScaled(P, opts) {
  const op = chooseOp(opts);
  const k = rand([2, 3, 4, 5, 6, 7, 9, 10, 12]);
  const a = rand(P.roots);
  if (k * a * a > 200) return null;          // «6x² ⩽ 294» устно уже не считают
  return withOp({
    left: [qx2(sInt(k))],
    right: [qn(sInt(k * a * a))],
    roots: [sInt(-a), sInt(a)],
  }, op);
}

// x² + 8x ⩽ 0 — неполное, корни 0 и −b/a
function genNoC(P, opts) {
  const op = chooseOp(opts);
  const a = rand([1, 1, 1, ...P.lead]);
  const m = signed(randInt(1, 2 * P.spread));
  const r = rat(m, a);                        // второй корень; B = −a·r целое
  return withOp(fromRatRoots(rat(0), r, rat(a), { limit: 200 }), op);
}

// −2x² − 15x > 0 — неполное с отрицательным старшим коэффициентом
function genNegLeadNoC(P, opts) {
  const op = chooseOp(opts);
  const a = -rand([1, 2, 2, 3, 4, 5]);
  const m = signed(randInt(1, 2 * P.spread));
  const r = rat(m, Math.abs(a));
  return withOp(fromRatRoots(rat(0), r, rat(a), { limit: 200 }), op);
}

// 9 − x² < 0 — число слева, квадрат вычитается
function genSwapped(P, opts) {
  const op = chooseOp(opts);
  const a = rand(P.roots);
  const k = chance(0.25) ? rand([2, 3, 4]) : 1;
  if (k * a * a > 300) return null;
  return withOp({
    left: [qn(sInt(k * a * a)), qx2(sInt(-k))],
    right: [qn(S0)],
    roots: [sInt(-a), sInt(a)],
  }, op);
}

// (x − 3)² > 0 → x ≠ 3;  (2x + 1)² ⩽ 0 → x = −½
function genBinomSquare(P, opts) {
  const op = chooseOp(opts);
  const a = chance(0.7) ? 1 : rand([2, 3, 4, 5]);
  const b = signed(randInt(1, Math.min(P.spread, 10)));
  const k = chance(0.2) ? rand([2, 3]) : 1;
  return withOp({
    left: [qsq(sInt(k), lin(sInt(a), sInt(b)))],
    right: [qn(S0)],
    roots: [sRat(rat(-b, a))],
  }, op);
}

// (x − 2)(x + 5) < 0 — уже разложено, чистый метод интервалов
function genProductForm(P, opts) {
  const op = chooseOp(opts);
  const pair = twoRoots(P);
  if (!pair) return null;
  const [r1, r2] = pair;
  const k = chance(0.2) ? rand([2, 3]) * (chance(0.3) ? -1 : 1) : 1;
  return withOp({
    left: [qprod(sInt(k), lin(S1, sInt(-r1)), lin(S1, sInt(-r2)))],
    right: [qn(S0)],
    roots: [sInt(r1), sInt(r2)].sort(sCompare),
  }, op);
}

// ─── Блок 2. Приведённые (D > 0) ─────────────────────────────────────────────
const reduced = (P, opts, sign) => {
  const op = chooseOp(opts);
  const pair = twoRoots(P, { sign });
  if (!pair) return null;
  return withOp(fromRatRoots(rat(pair[0]), rat(pair[1]), R1, { limit: 300 }), op);
};

const genReducedPositive = (P, opts) => reduced(P, opts, 'positive');
const genReducedNegative = (P, opts) => reduced(P, opts, 'negative');
const genReducedMixed    = (P, opts) => {
  const built = reduced(P, opts, 'mixed');
  // r₁ = −r₂ свернулось бы в x² − a², а это уже категория «чистый квадрат»
  const b = built?.left?.[1]?.s;
  return b && sNum(b) === 0 ? null : built;
};

// x² − 23x + 132 ⩽ 0 — корни крупные, устно уже не подобрать
function genReducedLarge(P, opts) {
  const op = chooseOp(opts);
  const big = P.roots.filter(v => v >= 6);
  if (big.length < 2) return null;
  const r1 = rand(big);
  const r2 = rand(big.filter(v => v !== r1));
  if (r2 === undefined) return null;
  const flip = chance(0.3) ? -1 : 1;
  return withOp(fromRatRoots(rat(flip * r1), rat(flip * r2), R1, { limit: 400 }), op);
}

// −x² + 5x − 6 > 0 — приведённое с минусом: знак разворачивается
function genReducedNegLead(P, opts) {
  const op = chooseOp(opts);
  const pair = twoRoots(P);
  if (!pair) return null;
  return withOp(fromRatRoots(rat(pair[0]), rat(pair[1]), rat(-1), { limit: 300 }), op);
}

// ─── Блок 3. Полные (a ≠ 1) ──────────────────────────────────────────────────

// 2x² − 7x + 3 ⩽ 0 → ½ ⩽ x ⩽ 3
function genFullFracRoot(P, opts) {
  const op = chooseOp(opts);
  const d = rand(P.dens);
  const n = rand(coprimeNumerators(d)) * (chance(0.5) ? -1 : 1);
  const r = signed(rand(P.roots));
  return withOp(fromRatRoots(rat(r), rat(n, d), rat(d), { limit: 200 }), op);
}

// 6x² − 5x + 1 > 0 — обе границы дробные
function genFullTwoFrac(P, opts) {
  const op = chooseOp(opts);
  const d1 = rand(P.dens);
  const d2 = rand(P.dens.filter(v => v !== d1));
  if (!d2) return null;
  const n1 = rand(coprimeNumerators(d1)) * (chance(0.5) ? -1 : 1);
  const n2 = rand(coprimeNumerators(d2)) * (chance(0.5) ? -1 : 1);
  return withOp(fromRatRoots(rat(n1, d1), rat(n2, d2), rat(d1 * d2), { limit: 200 }), op);
}

// 5x² − 12x + 4 ⩾ 0 — чётный второй коэффициент
function genFullEvenB(P, opts) {
  const built = chance(0.5) ? genFullFracRoot(P, opts) : genFullTwoFrac(P, opts);
  if (!built) return null;
  const b = built.left[1].s;
  if (!sIsRat(b) || b.p.n === 0 || b.p.n % 2 !== 0) return null;
  return built;
}

// −2x² + 7x − 3 < 0 — отрицательный старший коэффициент
function genFullNegLead(P, opts) {
  const op = chooseOp(opts);
  const pair = twoRoots(P);
  if (!pair) return null;
  const a = chance(0.5) ? -1 : -rand(P.lead);
  return withOp(fromRatRoots(rat(pair[0]), rat(pair[1]), rat(a), { limit: 300 }), op);
}

// 0,5x² − 2x + 1,5 < 0 — десятичные коэффициенты
function genFullDecimal(P, opts) {
  const op = chooseOp(opts);
  const pair = twoRoots(P);
  if (!pair) return null;
  const scale = rand([rat(1, 2), rat(3, 2), rat(1, 4), rat(5, 2), rat(1, 5), rat(2, 5)]);
  return withOp(fromRatRoots(rat(pair[0]), rat(pair[1]), scale, {
    prefer: 'dec', requireInt: false, maxDen: 10, limit: 200,
  }), op);
}

// ½x² − x − 4 ⩾ 0 — обыкновенные дроби в коэффициентах
function genFullFracCoef(P, opts) {
  const op = chooseOp(opts);
  const pair = twoRoots(P);
  if (!pair) return null;
  const scale = rat(rand([1, 1, 2, 3]), rand([2, 3, 4, 6]));
  return withOp(fromRatRoots(rat(pair[0]), rat(pair[1]), scale, {
    requireInt: false, maxDen: 6, limit: 60,
  }), op);
}

// ─── Блок 4. Вырожденные случаи (D ⩽ 0) ──────────────────────────────────────
function doubleRootTrinomial(P, opts, allowed) {
  const op = chooseOp(opts, allowed);
  const d = rand([1, 1, 1, ...P.dens]);
  const n = rand(d === 1 ? P.roots : coprimeNumerators(d)) * (chance(0.4) ? -1 : 1);
  const r = rat(n, d);
  return withOp(fromRatRoots(r, r, rat(d * d), { limit: 300 }), op);
}

// x² − 16x + 64 > 0 → x ≠ 8 (или «решений нет» при знаке <)
const genDoubleRootStrict = (P, opts) => doubleRootTrinomial(P, opts, STRICT_OPS);
// x² − 16x + 64 ⩾ 0 → любое число (или единственное решение при ⩽)
const genDoubleRootLoose  = (P, opts) => doubleRootTrinomial(P, opts, LOOSE_OPS);

// x² + 2x + 5 > 0 — дискриминант отрицательный, ветви вверх
function genNoRoots(P, opts) {
  const op = chooseOp(opts);
  const a = rand([1, 1, ...P.lead]);
  const b = signed(randInt(0, P.spread));
  const need = Math.floor((b * b) / (4 * a)) + 1;
  const c = randInt(need, need + Math.max(4, P.konst / 4));
  return withOp({
    left: [qx2(sInt(a)), qx(sInt(b)), qn(sInt(c))],
    right: [qn(S0)],
    roots: [],
  }, op);
}

// −x² + 2x − 5 < 0 — корней нет, ветви вниз: ответ переворачивается
function genNoRootsNegLead(P, opts) {
  const built = genNoRoots(P, opts);
  if (!built) return null;
  return { ...built, left: built.left.map(node => ({ ...node, s: sNeg(node.s) })) };
}

// ─── Блок 5. Иррациональные границы ──────────────────────────────────────────

// x² − 5x + 3 > 0 → границы (5 ± √13)/2
function genIrrRoots(P, opts) {
  const op = chooseOp(opts);
  const p = signed(randInt(1, P.spread));
  const q = signed(randInt(1, Math.min(P.konst, 20)));
  const sol = solveRationalQuadratic(S1, sInt(p), sInt(q));
  if (!sol || sol.kind !== 'two' || sIsRat(sol.roots[0])) return null;
  return withOp({
    left: [qx2(S1), qx(sInt(p)), qn(sInt(q))],
    right: [qn(S0)],
    roots: sol.roots,
  }, op);
}

// x² − 4x + 1 ⩽ 0 → 2 − √3 ⩽ x ⩽ 2 + √3
function genConjugateBounds(P, opts) {
  const op = chooseOp(opts);
  const p = signed(randInt(1, Math.min(P.spread, 8)));
  const k = chance(0.75) ? 1 : rand([2, 3]);
  const m = rand([2, 3, 5, 6, 7, 10, 11, 13]);
  return withOp(fromSurdRoots(sr(rat(p), rat(k), m), sr(rat(p), rat(-k), m), S1), op);
}

// 2x² − 6x + 1 ⩽ 0 — полное с иррациональными границами
function genFullIrrational(P, opts) {
  const op = chooseOp(opts);
  const a = rand(P.lead) * (chance(0.25) ? -1 : 1);
  const b = signed(randInt(1, P.spread));
  const c = signed(randInt(1, Math.min(P.konst, 15)));
  const sol = solveRationalQuadratic(sInt(a), sInt(b), sInt(c));
  if (!sol || sol.kind !== 'two' || sIsRat(sol.roots[0])) return null;
  return withOp({
    left: [qx2(sInt(a)), qx(sInt(b)), qn(sInt(c))],
    right: [qn(S0)],
    roots: sol.roots,
  }, op);
}

// x² − 4√3·x + 9 ⩽ 0 → √3 ⩽ x ⩽ 3√3
function genIrrCoefB(P, opts) {
  const op = chooseOp(opts);
  const m = rand([2, 3, 5, 6, 7, 10, 11]);
  const k1 = rand([1, 1, 2, 3]);
  const k2 = rand([1, 2, 3, 4]);
  if (k1 === k2) return null;
  const sign = chance(0.3) ? -1 : 1;
  return withOp(fromSurdRoots(sRad(rat(sign * k1), m), sRad(rat(sign * k2), m), S1), op);
}

// ─── Блок 6. Приведение к квадратному ────────────────────────────────────────

// (x − 1)(x + 4) > 6 — раскрыть скобки и привести
function genBrackets(P, opts) {
  const op = chooseOp(opts);
  const pair = twoRoots(P, { allowEqual: true });
  if (!pair) return null;
  const [r1, r2] = pair;
  const u = signed(randInt(1, P.spread));
  const v = (r1 + r2) - u;
  const w = u * v - r1 * r2;
  // u = v дало бы «(x − 4)(x − 4)» — такое пишут квадратом, а не произведением
  if (u === v || w === 0 || Math.abs(v) > 25 || Math.abs(w) > 4 * P.konst) return null;
  return withOp({
    left: [qprod(S1, lin(S1, sInt(-u)), lin(S1, sInt(-v)))],
    right: [qn(sInt(w))],
    roots: r1 === r2 ? [sInt(r1)] : [sInt(r1), sInt(r2)].sort(sCompare),
  }, op);
}

// (x + 3)² ⩾ 9x + 15 — квадрат двучлена против линейного выражения
function genExpandSquare(P, opts) {
  const op = chooseOp(opts);
  const pair = twoRoots(P, { allowEqual: true });
  if (!pair) return null;
  const [r1, r2] = pair;
  const a = signed(randInt(1, P.spread));
  const b = 2 * a + (r1 + r2);
  const c = a * a - r1 * r2;
  if (b === 0 || Math.abs(c) > 4 * P.konst) return null;
  return withOp({
    left: [qsq(S1, lin(S1, sInt(a)))],
    right: [qx(sInt(b)), qn(sInt(c))],
    roots: r1 === r2 ? [sInt(r1)] : [sInt(r1), sInt(r2)].sort(sCompare),
  }, op);
}

// 3x² + 2x < x² + 8 — квадраты в обеих частях
function genBothSides(P, opts) {
  const op = chooseOp(opts);
  const pair = twoRoots(P);
  if (!pair) return null;
  const a = rand([1, ...P.lead]);
  const A = a;
  const B = -a * (pair[0] + pair[1]);
  const C = a * pair[0] * pair[1];
  const t = rand([1, 1, 2, 3]);
  const b2 = signed(randInt(0, P.spread));
  const c2 = signed(randInt(1, Math.min(P.konst / 2, 12)));
  if (Math.abs(A + t) > 20 || Math.abs(B + b2) > 4 * P.konst) return null;
  return withOp({
    left:  [qx2(sInt(A + t)), qx(sInt(B + b2)), qn(sInt(C + c2))],
    right: [qx2(sInt(t)),     qx(sInt(b2)),     qn(sInt(c2))],
    roots: [sInt(pair[0]), sInt(pair[1])].sort(sCompare),
  }, op);
}

// x² + 3x > 2x + 12 — квадрат слева, линейное справа
function genCompareLinear(P, opts) {
  const op = chooseOp(opts);
  const pair = twoRoots(P);
  if (!pair) return null;
  const [r1, r2] = pair;
  const b2 = signed(randInt(1, P.spread));
  const c2 = signed(randInt(1, Math.min(P.konst, 20)));
  const b1 = -(r1 + r2) + b2;
  const c1 = r1 * r2 + c2;
  if (Math.abs(b1) > 4 * P.konst || Math.abs(c1) > 4 * P.konst) return null;
  return withOp({
    left:  [qx2(S1), qx(sInt(b1)), qn(sInt(c1))],
    right: [qx(sInt(b2)), qn(sInt(c2))],
    roots: [sInt(r1), sInt(r2)].sort(sCompare),
  }, op);
}

// x⁴ − 5x² + 4 < 0 → −2 < x < −1 или 1 < x < 2
function genBiquadratic(P, opts) {
  const op = chooseOp(opts);
  const small = P.roots.filter(v => v <= 5);
  const a = rand(small);
  const b = rand(small.filter(v => v !== a));
  if (b === undefined) return null;
  const k = chance(0.2) ? rand([2, 3]) : 1;
  const p = -(a * a + b * b);
  const q = a * a * b * b;
  if (Math.abs(k * q) > 900) return null;
  return withOp({
    left: [qx4(sInt(k)), qx2(sInt(k * p)), qn(sInt(k * q))],
    right: [qn(S0)],
    roots: [sInt(-b), sInt(-a), sInt(a), sInt(b)].sort(sCompare),
  }, op);
}

// ─── Блок 7. Другие постановки ───────────────────────────────────────────────
/**
 * Трёхчлен с целыми корнями и знаком «меньше»: решение — отрезок, а значит у
 * вопросов «сколько целых» и «наименьшее целое» есть конечный ответ.
 */
function boundedTrinomial(P, opts) {
  const op = chooseOp(opts, ['lt', 'le']);
  if (!op) return null;
  const pair = twoRoots(P);
  if (!pair) return null;
  const [r1, r2] = [...pair].sort((x, y) => x - y);
  if (r2 - r1 < 2) return null;                 // иначе целых решений почти нет
  return withOp(fromRatRoots(rat(r1), rat(r2), R1, { limit: 300 }), op);
}

const genCountIntegers   = (P, opts) => {
  const b = boundedTrinomial(P, opts);
  return b && { ...b, ask: { kind: 'count' } };
};
const genLeastInteger    = (P, opts) => {
  const b = boundedTrinomial(P, opts);
  return b && { ...b, ask: { kind: 'least' } };
};
const genGreatestInteger = (P, opts) => {
  const b = boundedTrinomial(P, opts);
  return b && { ...b, ask: { kind: 'greatest' } };
};

/**
 * Область определения √(трёхчлен). Знак здесь не выбирается настройкой листа:
 * подкоренное выражение неотрицательно по определению корня, это часть
 * постановки задачи, а не оформление неравенства.
 */
function genDomainSqrt(P, opts) {
  const pair = twoRoots(P);
  if (!pair) return null;
  const built = chance(0.25)
    ? fromRatRoots(rat(pair[0]), rat(pair[1]), rat(-1), { limit: 300 })
    : fromRatRoots(rat(pair[0]), rat(pair[1]), R1, { limit: 300 });
  return built && { ...built, op: 'ge', ask: { kind: 'domain' } };
}

// ─── Реестр категорий ────────────────────────────────────────────────────────
const GENERATORS = {
  // Блок 1
  pureSquare:        genPureSquare,
  pureIrr:           genPureIrr,
  pureZero:          genPureZero,
  pureNegative:      genPureNegative,
  scaled:            genScaled,
  noC:               genNoC,
  negLeadNoC:        genNegLeadNoC,
  swapped:           genSwapped,
  binomSquare:       genBinomSquare,
  productForm:       genProductForm,
  // Блок 2
  reducedPositive:   genReducedPositive,
  reducedNegative:   genReducedNegative,
  reducedMixed:      genReducedMixed,
  reducedLarge:      genReducedLarge,
  reducedNegLead:    genReducedNegLead,
  // Блок 3
  fullFracRoot:      genFullFracRoot,
  fullTwoFrac:       genFullTwoFrac,
  fullEvenB:         genFullEvenB,
  fullNegLead:       genFullNegLead,
  fullDecimal:       genFullDecimal,
  fullFracCoef:      genFullFracCoef,
  // Блок 4
  doubleRootStrict:  genDoubleRootStrict,
  doubleRootLoose:   genDoubleRootLoose,
  noRoots:           genNoRoots,
  noRootsNegLead:    genNoRootsNegLead,
  // Блок 5
  irrRoots:          genIrrRoots,
  conjugateBounds:   genConjugateBounds,
  fullIrrational:    genFullIrrational,
  irrCoefB:          genIrrCoefB,
  // Блок 6
  brackets:          genBrackets,
  expandSquare:      genExpandSquare,
  bothSides:         genBothSides,
  compareLinear:     genCompareLinear,
  biquadratic:       genBiquadratic,
  // Блок 7
  countIntegers:     genCountIntegers,
  leastInteger:      genLeastInteger,
  greatestInteger:   genGreatestInteger,
  domainSqrt:        genDomainSqrt,
};

export const CATEGORY_LABELS_QINEQ = {
  pureSquare:      'Чистый квадрат: x² > 9',
  pureIrr:         'Иррациональные границы: x² − 7 ⩽ 0',
  pureZero:        'Сравнение с нулём: x² > 0',
  pureNegative:    'Сравнение с отрицательным: x² > −4',
  scaled:          'С коэффициентом: 3x² ⩾ 27',
  noC:             'Неполное ax² + bx: x² + 8x ⩽ 0',
  negLeadNoC:      'Неполное с минусом: −2x² − 15x > 0',
  swapped:         'Число слева: 9 − x² < 0',
  binomSquare:     'Квадрат двучлена: (x − 3)² > 0',
  productForm:     'Уже разложено: (x − 2)(x + 5) < 0',

  reducedPositive: 'Приведённое, корни > 0: x² − 7x + 12 > 0',
  reducedNegative: 'Приведённое, корни < 0: x² + 12x + 20 ⩾ 0',
  reducedMixed:    'Приведённое, разные знаки: x² + x − 12 < 0',
  reducedLarge:    'Приведённое, крупные корни: x² − 23x + 132 ⩽ 0',
  reducedNegLead:  'Приведённое с минусом: −x² + 5x − 6 > 0',

  fullFracRoot:    'Полное, дробная граница: 2x² − 7x + 3 ⩽ 0',
  fullTwoFrac:     'Полное, две дробные: 6x² − 5x + 1 > 0',
  fullEvenB:       'Чётный второй коэффициент: 5x² − 12x + 4 ⩾ 0',
  fullNegLead:     'Отрицательный старший: −2x² + 7x − 3 < 0',
  fullDecimal:     'Десятичные коэффициенты: 0,5x² − 2x + 1,5 < 0',
  fullFracCoef:    'Дробные коэффициенты: ½x² − x − 4 ⩾ 0',

  doubleRootStrict: 'D = 0, строгий знак: x² − 16x + 64 > 0',
  doubleRootLoose:  'D = 0, нестрогий знак: x² − 16x + 64 ⩾ 0',
  noRoots:          'D < 0, ветви вверх: x² + 2x + 5 > 0',
  noRootsNegLead:   'D < 0, ветви вниз: −x² + 2x − 5 < 0',

  irrRoots:        'Границы с корнем: x² − 5x + 3 > 0',
  conjugateBounds: 'Сопряжённые границы: x² − 4x + 1 ⩽ 0',
  fullIrrational:  'Полное с корнем: 2x² − 6x + 1 ⩽ 0',
  irrCoefB:        'Корень в коэффициенте: x² − 4√3·x + 9 ⩽ 0',

  brackets:        'Произведение скобок: (x − 1)(x + 4) > 6',
  expandSquare:    'Квадрат и линейное: (x + 3)² ⩾ 9x + 15',
  bothSides:       'x² в обеих частях: 3x² + 2x < x² + 8',
  compareLinear:   'Квадрат против линейного: x² + 3x > 2x + 12',
  biquadratic:     'Биквадратное: x⁴ − 5x² + 4 < 0',

  countIntegers:   'Сколько целых решений',
  leastInteger:    'Наименьшее целое решение',
  greatestInteger: 'Наибольшее целое решение',
  domainSqrt:      'Область определения корня: √(x² − 4x + 3)',
};

// Блоки по нарастанию сложности — они же порядок чекбоксов в панели
export const CATEGORY_GROUPS_QINEQ = [
  {
    label: 'Блок 1. Простейшие (устно)',
    keys: ['pureSquare', 'pureIrr', 'pureZero', 'pureNegative', 'scaled',
           'noC', 'negLeadNoC', 'swapped', 'binomSquare', 'productForm'],
  },
  {
    label: 'Блок 2. Приведённые (D > 0)',
    keys: ['reducedPositive', 'reducedNegative', 'reducedMixed', 'reducedLarge',
           'reducedNegLead'],
  },
  {
    label: 'Блок 3. Полные (a ≠ 1)',
    keys: ['fullFracRoot', 'fullTwoFrac', 'fullEvenB', 'fullNegLead',
           'fullDecimal', 'fullFracCoef'],
  },
  {
    label: 'Блок 4. Особые случаи (D ⩽ 0)',
    keys: ['doubleRootStrict', 'doubleRootLoose', 'noRoots', 'noRootsNegLead'],
  },
  {
    label: 'Блок 5. Иррациональные границы',
    keys: ['irrRoots', 'conjugateBounds', 'fullIrrational', 'irrCoefB'],
  },
  {
    label: 'Блок 6. Приведение к квадратному',
    keys: ['brackets', 'expandSquare', 'bothSides', 'compareLinear', 'biquadratic'],
  },
  {
    label: 'Блок 7. Другие постановки',
    keys: ['countIntegers', 'leastInteger', 'greatestInteger', 'domainSqrt'],
  },
];

const ASK_CATS = new Set(CATEGORY_GROUPS_QINEQ[6].keys);

/** Строка над списком заданий: зависит от того, что попало на лист */
export function qineqInstruction(categories = {}) {
  const on = Object.entries(categories).filter(([, v]) => v).map(([k]) => k);
  return on.some(k => ASK_CATS.has(k)) ? 'Выполните задания:' : 'Решите неравенство:';
}

// ─── Переменные и настройки ──────────────────────────────────────────────────
const VAR_POOLS = {
  x:     ['x'],
  xy:    ['x', 'y'],
  mixed: ['x', 'y', 'a', 'b', 'z', 't', 'm', 'n'],
};

const OPS_MODES = {
  any:    ALL_OPS,
  strict: STRICT_OPS,
  loose:  LOOSE_OPS,
};

const ALL_CATS = Object.keys(CATEGORY_LABELS_QINEQ);
const DEFAULT_ON = new Set([
  ...CATEGORY_GROUPS_QINEQ[0].keys,
  'reducedPositive', 'reducedNegative', 'reducedMixed',
]);

export const DEFAULT_SETTINGS_QINEQ = {
  variantsCount:  4,
  questionsCount: 13,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  showWorkSpace:  false,
  columnsCount:   2,
  fontSize:       's',
  level:          2,             // 1 | 2 | 3 — размах чисел внутри одного приёма
  opsMode:        'any',         // any | strict | loose — какие знаки неравенства
  answerForm:     'interval',    // interval «[−3; 5]» | inequality «−3 ⩽ x ⩽ 5»
  boundKind:      'any',         // any | rational | integer — какие границы
  varsMode:       'x',
  categories: Object.fromEntries(ALL_CATS.map(k => [k, DEFAULT_ON.has(k)])),
};

// ─── Проверка задания ────────────────────────────────────────────────────────
function boundAllowed(b, boundKind) {
  const v = sNum(b);
  if (!Number.isFinite(v) || Math.abs(v) > 100) return false;
  if (boundKind === 'integer')  return sIsRat(b) && b.p.d === 1;
  if (boundKind === 'rational') return sIsRat(b) && b.p.d <= 12;
  if (sIsRat(b)) return b.p.d <= 12;
  return b.m <= 60 && b.p.d <= 6 && b.q.d <= 6;
}

const boundsAllowed = (sol, boundKind) =>
  sol.pieces.every(p => [p.lo, p.hi].every(b => !b || boundAllowed(b, boundKind)));

/** Целые решения неравенства — честным перебором, для блока 7 */
function integerSolutions(poly, op, limit = 200) {
  const out = [];
  for (let x = -limit; x <= limit; x++) {
    if (OPS[op].test(evalPolyNum(poly, x), 0)) out.push(x);
  }
  return out;
}

const ASK_TAIL = {
  count:    '\\;\\text{— сколько целых решений?}',
  least:    '\\;\\text{— наименьшее целое решение}',
  greatest: '\\;\\text{— наибольшее целое решение}',
};

/**
 * Одно задание: строит неравенство категории, считает решение общей таблицей и
 * проверяет его численно. Возвращает null, если числа не подошли.
 */
function buildQuestion(cat, varTex, opts) {
  const gen = GENERATORS[cat];
  if (!gen) return null;
  const built = gen(opts.P, opts);
  if (!built || !built.op) return null;

  const poly = polyOfEquation(built);
  if (!poly) return null;
  const powers = polyPowers(poly);
  const degree = powers.length ? Math.max(...powers) : 0;
  if (degree !== 2 && degree !== 4) return null;      // выродилось в линейное
  if (powers.some(p => p < 0)) return null;

  const lead = sNum(poly[degree]);
  const solution = solutionFromRoots(built.roots || [], lead, built.op);
  // Главная страховка: ответ обязан совпасть с самим неравенством в пробных точках
  if (!verifySolution(poly, built.op, solution)) return null;
  if (!boundsAllowed(solution, opts.boundKind)) return null;

  const leftTex = renderQSide(built.left, varTex);
  const ineqTex = `${leftTex} ${OPS[built.op].tex} ${renderQSide(built.right, varTex)}`;

  // ── Блок 7: вопрос вместо «решите неравенство»
  if (built.ask) {
    if (built.ask.kind === 'domain') {
      return {
        exprLatex: `D\\left(\\sqrt{${leftTex}}\\right) = {?}`,
        resultLatex: inequalityAnswerTex(solution, varTex, { form: opts.answerForm }),
        varLatex: varTex,
        solution,
        cat,
      };
    }
    const ints = integerSolutions(poly, built.op);
    if (!ints.length || ints.length > 30) return null;
    const value = built.ask.kind === 'count' ? ints.length
      : built.ask.kind === 'least' ? ints[0]
      : ints[ints.length - 1];
    return {
      exprLatex: `${ineqTex} ${ASK_TAIL[built.ask.kind]}`,
      resultLatex: String(value),
      varLatex: varTex,
      solution: { ...solution, value },
      cat,
    };
  }

  return {
    exprLatex: ineqTex,
    resultLatex: inequalityAnswerTex(solution, varTex, { form: opts.answerForm }),
    varLatex: varTex,
    solution,
    cat,
  };
}

// ─── Чистая функция генерации (для смешанных работ и сохранённых листов) ─────
export function generateQuadraticInequalityVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_QINEQ, ...settings };
  const vars = VAR_POOLS[s.varsMode] || VAR_POOLS.x;
  const opts = {
    P: quadPools(s.level),
    ops: OPS_MODES[s.opsMode] || ALL_OPS,
    answerForm: s.answerForm,
    boundKind: s.boundKind,
  };

  // Повторы отклоняем, но не бесконечно: у узких категорий («x² > 0») их
  // не избежать, а лист не должен оказаться короче заказанного
  const seen = new Set();
  let repeats = 0;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: s.boundKind === 'integer' ? 250 : 120,
    make: (cat) => {
      const q = buildQuestion(cat, rand(vars), opts);
      if (!q) return null;
      if (seen.has(q.exprLatex)) {
        repeats += 1;
        if (repeats < 25) return null;
      }
      repeats = 0;
      seen.add(q.exprLatex);
      return q;
    },
  });
}

// ─── Хук ─────────────────────────────────────────────────────────────────────
export function useQuadraticInequalities() {
  const [title, setTitle] = useState('Квадратные неравенства');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_QINEQ });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_QINEQ,
  });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateQuadraticInequalityVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Квадратные неравенства');
    setSettings({ ...DEFAULT_SETTINGS_QINEQ });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
