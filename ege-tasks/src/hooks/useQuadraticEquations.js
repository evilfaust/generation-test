import { useState, useCallback } from 'react';

/**
 * Генератор квадратных уравнений (раздел «Уравнения»).
 *
 * Уравнение почти нигде не собирается «из коэффициентов наугад»: сначала
 * выбираются корни, потом из них считаются коэффициенты (`quadFromRoots`), и
 * только потом дерево узлов печатается в LaTeX. Поэтому ответ не может
 * разойтись с условием, а лишний подбор «а вдруг дискриминант окажется
 * полным квадратом» не нужен. Категории, где интереснее именно случайные
 * коэффициенты (нет корней, иррациональный ответ), наоборот, решаются честно
 * через дискриминант — `solveRationalQuadratic`.
 *
 * Корни живут в поле Q(√m) (см. `utils/surd.js`), поэтому одинаково
 * описываются и «x² − 5x + 6 = 0 → 2; 3», и «x² − 4√3x + 9 = 0 → √3; 3√3».
 */

import {
  rat, R1, negR, toNum, rand, randInt, chance, coprimeNumerators,
} from '../utils/linearExpr';
import {
  sr, sRat, sInt, sRad, S0, S1, sIsRat, sIsZero, sNum, sSub, sMul, sNeg,
  sTex, sPairTex, sCompare, sEq,
} from '../utils/surd';
import {
  lin, qn, qx, qx2, qx4, qsq, qprod, qinv,
  renderQSide, polyOfEquation, polyPowers, evalPolyNum, polyScale,
  solveRationalQuadratic, quadFromRoots,
} from '../utils/quadraticExpr';
import {
  quadPools, signed, twoRoots, fromRatRoots, fromSurdRoots,
} from '../utils/quadraticForms';
import { generateByCategories } from '../utils/questionPlan';
import { useApplySheet } from './useApplySheet';

// ─── Блок 1. Простейшие (устный счёт) ────────────────────────────────────────

// x² = 49
function genPureSquare(P) {
  const a = rand(P.roots);
  return { left: [qx2(S1)], right: [qn(sInt(a * a))], roots: [sInt(-a), sInt(a)] };
}

// 7x² = 0 — единственный корень
function genZeroRoot() {
  const k = chance(0.35) ? 1 : rand([2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
  return { left: [qx2(sInt(k))], right: [qn(S0)], roots: [S0] };
}

// 2x² = 18
function genScaledSquare(P) {
  const k = rand([2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
  const a = rand(P.roots);
  if (k * a * a > 200) return null;          // «6x² = 384» устно уже не считают
  return { left: [qx2(sInt(k))], right: [qn(sInt(k * a * a))], roots: [sInt(-a), sInt(a)] };
}

// x² = 7 → ±√7 (устно, но ответ иррациональный)
function genPureSquareIrr() {
  const m = rand([2, 3, 5, 6, 7, 10, 11, 13, 15, 17, 19]);
  const k = chance(0.3) ? rand([2, 3, 5]) : 1;
  return {
    left: [qx2(sInt(k))],
    right: [qn(sInt(k * m))],
    roots: [sRad(negR(R1), m), sRad(R1, m)],
  };
}

// x² = −7 — корней нет
function genPureNegative(P) {
  const k = chance(0.3) ? rand([2, 3, 5]) : 1;
  const a = randInt(1, P.konst);
  return { left: [qx2(sInt(k))], right: [qn(sInt(-k * a))], roots: [], kind: 'none' };
}

// x² + 2 = 0 — корней нет (сумма неотрицательного и положительного)
function genSumPositive(P) {
  const k = chance(0.3) ? rand([2, 3, 5]) : 1;
  const a = randInt(1, P.konst);
  return { left: [qx2(sInt(k)), qn(sInt(a))], right: [qn(S0)], roots: [], kind: 'none' };
}

// 3x² − 27 = 0 — неполное без слагаемого с x
function genNoBx(P) {
  const a = rand([1, ...P.lead]);
  if (chance(0.25)) {                       // 3x² − 9 = 0 → ±√3
    const m = rand([2, 3, 5, 6, 7, 10, 11, 13]);
    return {
      left: [qx2(sInt(a)), qn(sInt(-a * m))],
      right: [qn(S0)],
      roots: [sRad(negR(R1), m), sRad(R1, m)],
    };
  }
  const r = rand(P.roots);
  if (a * r * r > 900) return null;
  return {
    left: [qx2(sInt(a)), qn(sInt(-a * r * r))],
    right: [qn(S0)],
    roots: [sInt(-r), sInt(r)],
  };
}

// x² − 5x = 0 — вынесение общего множителя
function genNoC(P) {
  const a = rand([1, 1, ...P.lead]);
  const r = signed(rand(P.roots));
  const b = -a * r;
  const roots = [S0, sInt(r)].sort(sCompare);
  // Половину заданий печатаем как «x² = 5x» — тот же приём, другая запись
  if (chance(0.3)) {
    return { left: [qx2(sInt(a))], right: [qx(sInt(-b))], roots };
  }
  return { left: [qx2(sInt(a)), qx(sInt(b))], right: [qn(S0)], roots };
}

// (x + 2)² = 4
function genBinomSquare(P) {
  const a = signed(randInt(1, P.spread));
  if (chance(0.15)) {                       // (x + 2)² = −4
    return {
      left: [qsq(S1, lin(S1, sInt(a)))],
      right: [qn(sInt(-randInt(1, P.konst)))],
      roots: [], kind: 'none',
    };
  }
  const b = rand(P.roots);
  const k = chance(0.25) ? rand([2, 3, 4]) : 1;
  if (k * b * b > 400) return null;
  return {
    left: [qsq(sInt(k), lin(S1, sInt(a)))],
    right: [qn(sInt(k * b * b))],
    roots: [sInt(-a - b), sInt(-a + b)].sort(sCompare),
  };
}

// (2x − 3)² = 0 — квадрат двучлена равен нулю: корень один, дробный
function genBinomSquareZero(P) {
  // a = 1 оставляем редким: смысл категории в делении на коэффициент при x
  const a = rand([1, 2, 2, 3, 3, 4, 5, 6]);
  const b = signed(randInt(1, Math.min(P.spread, 12)));
  // Внешний множитель на корень не влияет — полезная устная проверка
  const k = chance(0.2) ? rand([2, 3, 5]) : 1;
  return {
    left: [qsq(sInt(k), lin(sInt(a), sInt(b)))],
    right: [qn(S0)],
    roots: [sRat(rat(-b, a))],
  };
}

// x² + 2x + 1 = 0 — свёрнутый квадрат двучлена
function genPerfectSquare(P) {
  const a = signed(randInt(1, Math.min(P.spread, 10)));
  return {
    left: [qx2(S1), qx(sInt(2 * a)), qn(sInt(a * a))],
    right: [qn(S0)],
    roots: [sInt(-a)],
  };
}

// ─── Блок 2. Приведённые: теорема Виета ──────────────────────────────────────
function vietaEq(r1, r2) {
  const roots = r1 === r2 ? [sInt(r1)] : [sInt(r1), sInt(r2)].sort(sCompare);
  return {
    left: [qx2(S1), qx(sInt(-(r1 + r2))), qn(sInt(r1 * r2))],
    right: [qn(S0)],
    roots,
  };
}

const genVietaPositive = (P) => { const r = twoRoots(P, { sign: 'positive' }); return r && vietaEq(r[0], r[1]); };
const genVietaNegative = (P) => { const r = twoRoots(P, { sign: 'negative' }); return r && vietaEq(r[0], r[1]); };
const genVietaMixed    = (P) => {
  const r = twoRoots(P, { sign: 'mixed' });
  // r₁ = −r₂ свернулось бы в x² − a² = 0 — приём другой, категория тоже
  return r && r[0] !== -r[1] ? vietaEq(r[0], r[1]) : null;
};

// x² − 23x + 132 = 0 — корни подобрать труднее, Виета всё ещё быстрее дискриминанта
function genVietaLarge(P) {
  const big = P.roots.filter(v => v >= 6);
  if (big.length < 2) return null;
  const r1 = rand(big);
  const r2 = rand(big.filter(v => v !== r1));
  if (r2 === undefined) return null;
  return chance(0.3) ? vietaEq(-r1, -r2) : vietaEq(r1, r2);
}

// x² + 2x + 5 = 0 — дискриминант отрицательный
function genReducedNoRoots(P) {
  const p = signed(randInt(0, P.spread));
  const base = Math.floor((p * p) / 4) + 1;
  const q = randInt(base, base + P.konst / 2);
  return { left: [qx2(S1), qx(sInt(p)), qn(sInt(q))], right: [qn(S0)], roots: [], kind: 'none' };
}

// x² − 5x + 3 = 0 → (5 ± √13)/2
function genReducedIrrational(P) {
  const p = signed(randInt(1, P.spread));
  const q = signed(randInt(1, Math.min(P.konst, 20)));
  const sol = solveRationalQuadratic(S1, sInt(p), sInt(q));
  if (!sol || sol.kind !== 'two' || sIsRat(sol.roots[0])) return null;
  return { left: [qx2(S1), qx(sInt(p)), qn(sInt(q))], right: [qn(S0)], roots: sol.roots };
}

// ─── Блок 3. Полные уравнения: дискриминант ──────────────────────────────────

// 2x² − 7x + 3 = 0 → 3; ½ — один корень целый, второй дробный
function genFullFracRoot(P) {
  const d = rand(P.dens);
  const n = rand(coprimeNumerators(d)) * (chance(0.5) ? -1 : 1);
  const r = signed(rand(P.roots));
  return fromRatRoots(rat(r), rat(n, d), rat(d), { limit: 200 });
}

// 6x² − 5x + 1 = 0 → ½; ⅓ — оба корня дробные
function genFullTwoFrac(P) {
  const d1 = rand(P.dens);
  const d2 = rand(P.dens.filter(v => v !== d1));
  if (!d2) return null;
  const n1 = rand(coprimeNumerators(d1)) * (chance(0.5) ? -1 : 1);
  const n2 = rand(coprimeNumerators(d2)) * (chance(0.5) ? -1 : 1);
  return fromRatRoots(rat(n1, d1), rat(n2, d2), rat(d1 * d2), { limit: 200 });
}

// 5x² − 12x + 4 = 0 — второй коэффициент чётный, удобно считать D/4
function genFullEvenB(P) {
  const built = chance(0.5) ? genFullFracRoot(P) : genFullTwoFrac(P);
  if (!built) return null;
  const b = built.left[1].s;
  if (!sIsRat(b) || sIsZero(b) || b.p.n % 2 !== 0) return null;
  return built;
}

// −x² + 5x − 6 = 0 — отрицательный старший коэффициент
function genFullNegLead(P) {
  const [r1, r2] = twoRoots(P) || [];
  if (r1 === undefined) return null;
  const a = chance(0.6) ? -1 : -rand(P.lead);
  return fromRatRoots(rat(r1), rat(r2), rat(a), { limit: 300 });
}

// 4x² − 12x + 9 = 0 — дискриминант равен нулю
function genFullDouble(P) {
  const d = rand([1, ...P.dens]);
  const n = rand(d === 1 ? P.roots : coprimeNumerators(d)) * (chance(0.4) ? -1 : 1);
  const r = rat(n, d);
  return fromRatRoots(r, r, rat(d * d), { limit: 300 });
}

// 3x² + x + 5 = 0 — корней нет
function genFullNoRoots(P) {
  const a = rand(P.lead) * (chance(0.2) ? -1 : 1);
  const b = signed(randInt(0, P.spread));
  const need = Math.floor((b * b) / (4 * Math.abs(a))) + 1;
  const c = Math.sign(a) * randInt(need, need + Math.max(4, P.konst / 4));
  return { left: [qx2(sInt(a)), qx(sInt(b)), qn(sInt(c))], right: [qn(S0)], roots: [], kind: 'none' };
}

// 2x² − 6x + 1 = 0 → (3 ± √7)/2
function genFullIrrational(P) {
  const a = rand(P.lead);
  const b = signed(randInt(1, P.spread));
  const c = signed(randInt(1, Math.min(P.konst, 15)));
  const sol = solveRationalQuadratic(sInt(a), sInt(b), sInt(c));
  if (!sol || sol.kind !== 'two' || sIsRat(sol.roots[0])) return null;
  return { left: [qx2(sInt(a)), qx(sInt(b)), qn(sInt(c))], right: [qn(S0)], roots: sol.roots };
}

// 0,5x² − 2x + 1,5 = 0 — десятичные коэффициенты
function genFullDecimal(P) {
  const [r1, r2] = twoRoots(P, { allowEqual: true }) || [];
  if (r1 === undefined) return null;
  const scale = rand([rat(1, 2), rat(3, 2), rat(1, 4), rat(5, 2), rat(1, 5), rat(2, 5), rat(1, 10)]);
  return fromRatRoots(rat(r1), rat(r2), scale, {
    prefer: 'dec', requireInt: false, maxDen: 10, limit: 200,
  });
}

// ½x² − x − 4 = 0 — обыкновенные дроби в коэффициентах
function genFullFracCoef(P) {
  const [r1, r2] = twoRoots(P) || [];
  if (r1 === undefined) return null;
  const scale = rat(rand([1, 1, 2, 3]), rand([2, 3, 4, 6]));
  return fromRatRoots(rat(r1), rat(r2), scale, {
    requireInt: false, maxDen: 6, limit: 60,
  });
}

// ─── Блок 4. Иррациональности ────────────────────────────────────────────────

// x² − 4x + 1 = 0 → 2 ± √3 — коэффициенты целые, корни сопряжённые
function genConjugateRoots(P) {
  const p = signed(randInt(1, Math.min(P.spread, 8)));
  const k = chance(0.75) ? 1 : rand([2, 3]);
  const m = rand([2, 3, 5, 6, 7, 10, 11, 13]);
  const x1 = sr(rat(p), rat(k), m);
  const x2 = sr(rat(p), rat(-k), m);
  return fromSurdRoots(x1, x2, S1);
}

// x² − 4√3·x + 9 = 0 → √3; 3√3 — иррационален средний коэффициент
function genIrrCoefB() {
  const m = rand([2, 3, 5, 6, 7, 10, 11]);
  const k1 = rand([1, 1, 2, 3]);
  const k2 = rand([1, 2, 3, 4]);
  const s = chance(0.3) ? -1 : 1;
  const x1 = sRad(rat(s * k1), m);
  const x2 = sRad(rat(s * k2), m);
  if (k1 === k2) return null;
  return fromSurdRoots(x1, x2, S1);
}

// √2·x² − 3x + √2 = 0 → √2; √2/2 — иррационален старший коэффициент
function genIrrCoefA() {
  const m = rand([2, 3, 5, 6, 7]);
  const d = rand([2, 3]);
  const k1 = rat(rand([1, 1, 2]));
  const k2 = rat(rand(coprimeNumerators(d)), d);
  const x1 = sRad(k1, m);
  const x2 = sRad(k2, m);
  if (sEq(x1, x2)) return null;
  return fromSurdRoots(x1, x2, sRad(R1, m));
}

// x² − (2 + √3)x + 2√3 = 0 → 2; √3 — один корень рациональный, второй нет
function genIrrMixedRoots(P) {
  const p = signed(rand(P.roots.filter(v => v <= 9)));
  const m = rand([2, 3, 5, 6, 7, 10, 11]);
  const k = chance(0.75) ? 1 : rand([2, 3]);
  const x1 = sInt(p);
  const x2 = sRad(rat(chance(0.25) ? -k : k), m);
  return fromSurdRoots(x1, x2, S1);
}

// ─── Блок 5. Приведение к квадратному ────────────────────────────────────────

// (x − 1)(x + 4) = 6 — раскрыть скобки и привести
function genBracketsProduct(P) {
  const [r1, r2] = twoRoots(P, { allowEqual: true }) || [];
  if (r1 === undefined) return null;
  const sum = r1 + r2;
  const prod = r1 * r2;
  const u = signed(randInt(1, P.spread));
  const v = sum - u;
  const w = u * v - prod;
  if (w === 0 || Math.abs(v) > 25 || Math.abs(w) > 4 * P.konst) return null;
  return {
    left: [qprod(S1, lin(S1, sInt(-u)), lin(S1, sInt(-v)))],
    right: [qn(sInt(w))],
    roots: r1 === r2 ? [sInt(r1)] : [sInt(r1), sInt(r2)].sort(sCompare),
  };
}

// (x + 3)² = 9x + 7 — квадрат двучлена против линейного выражения
function genExpandSquare(P) {
  const [r1, r2] = twoRoots(P, { allowEqual: true }) || [];
  if (r1 === undefined) return null;
  const B = -(r1 + r2);
  const C = r1 * r2;
  const a = signed(randInt(1, P.spread));
  const b = 2 * a - B;
  const c = a * a - C;
  if (b === 0 || Math.abs(c) > 4 * P.konst) return null;
  return {
    left: [qsq(S1, lin(S1, sInt(a)))],
    right: [qx(sInt(b)), qn(sInt(c))],
    roots: r1 === r2 ? [sInt(r1)] : [sInt(r1), sInt(r2)].sort(sCompare),
  };
}

// 3x² + 2x = x² + 8 — квадраты в обеих частях
function genBothSides(P) {
  const [r1, r2] = twoRoots(P) || [];
  if (r1 === undefined) return null;
  const a = rand([1, ...P.lead]);
  const q = quadFromRoots(sInt(r1), sInt(r2), sInt(a));
  if (!q) return null;
  const A = q.A.p.n, B = q.B.p.n, C = q.C.p.n;
  const t = rand([1, 1, 2, 3]);
  const b2 = signed(randInt(0, P.spread));
  const c2 = signed(randInt(1, Math.min(P.konst / 2, 12)));
  if (Math.abs(A + t) > 20 || Math.abs(B + b2) > 4 * P.konst) return null;
  return {
    left:  [qx2(sInt(A + t)), qx(sInt(B + b2)), qn(sInt(C + c2))],
    right: [qx2(sInt(t)),     qx(sInt(b2)),     qn(sInt(c2))],
    roots: [sInt(r1), sInt(r2)].sort(sCompare),
  };
}

// x⁴ − 5x² + 4 = 0 — биквадратное
function genBiquadratic(P) {
  const small = P.roots.filter(v => v <= 5);
  const roll = Math.random();
  const a = rand(small);

  if (roll < 0.2) {                          // оба корня по t отрицательны
    const n1 = randInt(1, 9);
    const n2 = randInt(1, 9);
    return {
      left: [qx4(S1), qx2(sInt(n1 + n2)), qn(sInt(n1 * n2))],
      right: [qn(S0)],
      roots: [], kind: 'none',
    };
  }
  if (roll < 0.45) {                         // один корень по t отрицателен → ±a
    const n = randInt(1, 9);
    return {
      left: [qx4(S1), qx2(sInt(n - a * a)), qn(sInt(-a * a * n))],
      right: [qn(S0)],
      roots: [sInt(-a), sInt(a)],
    };
  }
  const b = rand(small.filter(v => v !== a));
  if (b === undefined) return null;
  const k = chance(0.2) ? rand([2, 3]) : 1;  // 2x⁴ − 10x² + 8 = 0
  const p = -(a * a + b * b);
  const q = a * a * b * b;
  if (Math.abs(k * q) > 900) return null;
  return {
    left: [qx4(sInt(k)), qx2(sInt(k * p)), qn(sInt(k * q))],
    right: [qn(S0)],
    roots: [sInt(-b), sInt(-a), sInt(a), sInt(b)].sort(sCompare),
  };
}

// x + 6/x = 5 — переменная в знаменателе (ОДЗ: x ≠ 0)
function genFracVarDenom(P) {
  const [r1, r2] = twoRoots(P) || [];
  if (r1 === undefined || r1 === 0 || r2 === 0) return null;
  const sum = r1 + r2;
  const prod = r1 * r2;
  if (Math.abs(prod) > 4 * P.konst) return null;
  return {
    left: [qx(S1), qinv(sInt(prod))],
    right: [qn(sInt(sum))],
    roots: [sInt(r1), sInt(r2)].sort(sCompare),
    excludeZero: true,
  };
}

// ─── Блок 6. Теорема Виета без решения уравнения ─────────────────────────────
/**
 * Задание другого рода: уравнение решать не нужно, нужно назвать значение
 * симметричного выражения от корней. Ответ считается по теореме Виета
 * (S = −b/a, P = c/a), а проверяется потом честно — подстановкой настоящих
 * корней (см. `checkAsk` в buildQuestion).
 */
function askEquation(P, { needProduct = false } = {}) {
  const a = rand([1, 1, 1, ...P.lead]);
  const b = signed(randInt(1, P.spread));
  const c = signed(randInt(1, Math.min(P.konst, 18)));
  if (needProduct && c === 0) return null;
  const sol = solveRationalQuadratic(sInt(a), sInt(b), sInt(c));
  if (!sol || sol.kind === 'none') return null;
  return {
    left: [qx2(sInt(a)), qx(sInt(b)), qn(sInt(c))],
    right: [qn(S0)],
    roots: sol.roots,
    S: rat(-b, a),          // x₁ + x₂
    P: rat(c, a),           // x₁ · x₂
  };
}

function genAskSum(P) {
  const e = askEquation(P);
  return e && { ...e, ask: { kind: 'sum', value: e.S } };
}

function genAskProduct(P) {
  const e = askEquation(P);
  return e && { ...e, ask: { kind: 'product', value: e.P } };
}

// x₁² + x₂² = S² − 2P
function genAskSumSquares(P) {
  const e = askEquation(P);
  if (!e) return null;
  const value = sSub(sMul(sRat(e.S), sRat(e.S)), sMul(sInt(2), sRat(e.P)));
  if (!value || Math.abs(sNum(value)) > 400) return null;
  return { ...e, ask: { kind: 'sumSquares', value: value.p } };
}

// 1/x₁ + 1/x₂ = S / P
function genAskInverses(P) {
  const e = askEquation(P, { needProduct: true });
  if (!e || e.P.n === 0) return null;
  const value = rat(e.S.n * e.P.d, e.S.d * e.P.n);
  if (!value || value.d > 12) return null;
  return { ...e, ask: { kind: 'inverses', value } };
}

// Обратная задача: по корням составить приведённое уравнение
function genBuildByRoots(P) {
  const [r1, r2] = twoRoots(P, { allowEqual: true }) || [];
  if (r1 === undefined) return null;
  const built = vietaEq(r1, r2);
  return { ...built, ask: { kind: 'byRoots', pair: [r1, r2] } };
}

// ─── Реестр категорий ────────────────────────────────────────────────────────
const GENERATORS = {
  // Блок 1
  pureSquare:        genPureSquare,
  zeroRoot:          genZeroRoot,
  scaledSquare:      genScaledSquare,
  pureSquareIrr:     genPureSquareIrr,
  pureNegative:      genPureNegative,
  sumPositive:       genSumPositive,
  noBx:              genNoBx,
  noC:               genNoC,
  binomSquare:       genBinomSquare,
  binomSquareZero:   genBinomSquareZero,
  perfectSquare:     genPerfectSquare,
  // Блок 2
  vietaPositive:     genVietaPositive,
  vietaNegative:     genVietaNegative,
  vietaMixed:        genVietaMixed,
  vietaLarge:        genVietaLarge,
  reducedNoRoots:    genReducedNoRoots,
  reducedIrrational: genReducedIrrational,
  // Блок 3
  fullFracRoot:      genFullFracRoot,
  fullTwoFrac:       genFullTwoFrac,
  fullEvenB:         genFullEvenB,
  fullNegLead:       genFullNegLead,
  fullDouble:        genFullDouble,
  fullNoRoots:       genFullNoRoots,
  fullIrrational:    genFullIrrational,
  fullDecimal:       genFullDecimal,
  fullFracCoef:      genFullFracCoef,
  // Блок 4
  conjugateRoots:    genConjugateRoots,
  irrCoefB:          genIrrCoefB,
  irrCoefA:          genIrrCoefA,
  irrMixedRoots:     genIrrMixedRoots,
  // Блок 5
  bracketsProduct:   genBracketsProduct,
  expandSquare:      genExpandSquare,
  bothSides:         genBothSides,
  biquadratic:       genBiquadratic,
  fracVarDenom:      genFracVarDenom,
  // Блок 6
  askSum:            genAskSum,
  askProduct:        genAskProduct,
  askSumSquares:     genAskSumSquares,
  askInverses:       genAskInverses,
  buildByRoots:      genBuildByRoots,
};

export const CATEGORY_LABELS_QUAD = {
  pureSquare:        'Чистый квадрат: x² = 49',
  zeroRoot:          'Единственный корень 0: 7x² = 0',
  scaledSquare:      'С коэффициентом: 2x² = 18',
  pureSquareIrr:     'Иррациональный ответ: x² = 7',
  pureNegative:      'Нет корней: x² = −7',
  sumPositive:       'Нет корней: x² + 2 = 0',
  noBx:              'Неполное ax² + c = 0: 3x² − 27 = 0',
  noC:               'Неполное ax² + bx = 0: x² − 5x = 0',
  binomSquare:       'Квадрат двучлена: (x + 2)² = 4',
  binomSquareZero:   'Двучлен в квадрате = 0: (2x − 3)² = 0',
  perfectSquare:     'Свёрнутый квадрат: x² + 2x + 1 = 0',

  vietaPositive:     'Виета, корни > 0: x² − 5x + 6 = 0',
  vietaNegative:     'Виета, корни < 0: x² + 7x + 10 = 0',
  vietaMixed:        'Виета, разные знаки: x² + x − 12 = 0',
  vietaLarge:        'Виета, крупные корни: x² − 23x + 132 = 0',
  reducedNoRoots:    'Приведённое без корней: x² + 2x + 5 = 0',
  reducedIrrational: 'Приведённое, D не квадрат: x² − 5x + 3 = 0',

  fullFracRoot:      'Полное, дробный корень: 2x² − 7x + 3 = 0',
  fullTwoFrac:       'Полное, два дробных: 6x² − 5x + 1 = 0',
  fullEvenB:         'Чётный второй коэффициент: 5x² − 12x + 4 = 0',
  fullNegLead:       'Отрицательный старший: −x² + 5x − 6 = 0',
  fullDouble:        'Дискриминант равен нулю: 4x² − 12x + 9 = 0',
  fullNoRoots:       'Полное без корней: 3x² + x + 5 = 0',
  fullIrrational:    'Иррациональные корни: 2x² − 6x + 1 = 0',
  fullDecimal:       'Десятичные коэффициенты: 0,5x² − 2x + 1,5 = 0',
  fullFracCoef:      'Дробные коэффициенты: ½x² − x − 4 = 0',

  conjugateRoots:    'Сопряжённые корни: x² − 4x + 1 = 0',
  irrCoefB:          'Корень в коэффициенте: x² − 4√3·x + 9 = 0',
  irrCoefA:          'Корень при x²: √2·x² − 3x + √2 = 0',
  irrMixedRoots:     'Смешанные корни: x² − (2 + √3)x + 2√3 = 0',

  bracketsProduct:   'Произведение скобок: (x − 1)(x + 4) = 6',
  expandSquare:      'Квадрат и линейное: (x + 3)² = 9x + 7',
  bothSides:         'x² в обеих частях: 3x² + 2x = x² + 8',
  biquadratic:       'Биквадратное: x⁴ − 5x² + 4 = 0',
  fracVarDenom:      'Переменная в знаменателе: x + 6/x = 5',

  askSum:            'Виета: найти x₁ + x₂',
  askProduct:        'Виета: найти x₁ · x₂',
  askSumSquares:     'Виета: найти x₁² + x₂²',
  askInverses:       'Виета: найти 1/x₁ + 1/x₂',
  buildByRoots:      'Составить уравнение по корням',
};

// Блоки по нарастанию сложности — они же порядок чекбоксов в панели
export const CATEGORY_GROUPS_QUAD = [
  {
    label: 'Блок 1. Простейшие (устно)',
    keys: ['pureSquare', 'zeroRoot', 'scaledSquare', 'pureSquareIrr', 'pureNegative',
           'sumPositive', 'noBx', 'noC', 'binomSquare', 'binomSquareZero', 'perfectSquare'],
  },
  {
    label: 'Блок 2. Приведённые: теорема Виета',
    keys: ['vietaPositive', 'vietaNegative', 'vietaMixed', 'vietaLarge',
           'reducedNoRoots', 'reducedIrrational'],
  },
  {
    label: 'Блок 3. Полные: дискриминант',
    keys: ['fullFracRoot', 'fullTwoFrac', 'fullEvenB', 'fullNegLead', 'fullDouble',
           'fullNoRoots', 'fullIrrational', 'fullDecimal', 'fullFracCoef'],
  },
  {
    label: 'Блок 4. Иррациональности',
    keys: ['conjugateRoots', 'irrCoefB', 'irrCoefA', 'irrMixedRoots'],
  },
  {
    label: 'Блок 5. Приведение к квадратному',
    keys: ['bracketsProduct', 'expandSquare', 'bothSides', 'biquadratic', 'fracVarDenom'],
  },
  {
    label: 'Блок 6. Виета без решения',
    keys: ['askSum', 'askProduct', 'askSumSquares', 'askInverses', 'buildByRoots'],
  },
];

// Категории блока 6 — не «решите уравнение», от них зависит строка-инструкция
const ASK_CATS = new Set(CATEGORY_GROUPS_QUAD[5].keys);

/** Строка над списком заданий: зависит от того, что попало на лист */
export function quadInstruction(categories = {}) {
  const on = Object.entries(categories).filter(([, v]) => v).map(([k]) => k);
  // Достаточно одного задания «найдите x₁ + x₂», чтобы «Решите уравнение»
  // перестало быть правдой для всего листа
  return on.some(k => ASK_CATS.has(k)) ? 'Выполните задания:' : 'Решите уравнение:';
}

// ─── Переменные ──────────────────────────────────────────────────────────────
const VAR_POOLS = {
  x:     ['x'],
  xy:    ['x', 'y'],
  mixed: ['x', 'y', 'a', 'b', 'z', 't', 'm', 'n'],
};

// ─── Настройки по умолчанию ──────────────────────────────────────────────────
const ALL_CATS = Object.keys(CATEGORY_LABELS_QUAD);
const DEFAULT_ON = new Set([
  ...CATEGORY_GROUPS_QUAD[0].keys,
  'vietaPositive', 'vietaMixed',
]);

export const DEFAULT_SETTINGS_QUAD = {
  variantsCount:  4,
  questionsCount: 12,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  showWorkSpace:  false,
  columnsCount:   2,
  fontSize:       's',
  level:          2,        // 1 | 2 | 3 — размах чисел внутри одного типа
  rootKind:       'any',    // any | rational | integer — какие корни допускаем
  answerStyle:    'list',   // list («−3; 5») | indexed («x₁ = −3, x₂ = 5»)
  usePm:          true,     // ±7 вместо «−7; 7»
  varsMode:       'x',
  categories: Object.fromEntries(ALL_CATS.map(k => [k, DEFAULT_ON.has(k)])),
};

// ─── Ответ ───────────────────────────────────────────────────────────────────
const rootTex = (r) => sTex(r);

// Симметричный набор корней (±a, ±b) печатается короче: «±1; ±2»
function symmetricTex(roots) {
  if (roots.length < 2 || roots.length % 2 !== 0) return null;
  const positive = roots.filter(r => sNum(r) > 0);
  if (positive.length * 2 !== roots.length) return null;
  for (const r of positive) {
    if (!roots.some(other => sEq(other, sNeg(r)))) return null;
  }
  return positive.sort(sCompare).map(r => `\\pm ${rootTex(r)}`).join(';\\ ');
}

export function answerTex(roots, { varTex = 'x', style = 'list', usePm = true } = {}) {
  if (roots.length === 0) return '\\varnothing';
  if (roots.length === 1) {
    return style === 'indexed' ? `${varTex} = ${rootTex(roots[0])}` : rootTex(roots[0]);
  }
  if (style !== 'indexed') {
    if (usePm) {
      const sym = symmetricTex(roots);
      if (sym) return sym;
    }
    if (roots.length === 2) {
      const pair = sPairTex(roots[0], roots[1]);
      if (pair) return pair;
    }
    return roots.map(rootTex).join(';\\ ');
  }
  return roots.map((r, i) => `${varTex}_{${i + 1}} = ${rootTex(r)}`).join(',\\ ');
}

// ─── Проверка задания ────────────────────────────────────────────────────────
/** Нет ли у многочлена вещественных корней — сторож для категорий «нет корней» */
function hasNoRealRoots(poly) {
  const powers = polyPowers(poly);
  const at = (p) => (poly[p] ? sNum(poly[p]) : 0);

  if (powers.every(p => p >= 0 && p <= 2)) {
    const a = at(2);
    if (a === 0) return false;                       // линейное — корень всегда есть
    return at(1) ** 2 - 4 * a * at(0) < 0;
  }
  if (powers.every(p => p === 0 || p === 2 || p === 4)) {
    const a = at(4), b = at(2), c = at(0);
    if (a === 0) return b !== 0 ? -c / b < 0 : c !== 0;
    const D = b * b - 4 * a * c;
    if (D < 0) return true;
    const t1 = (-b + Math.sqrt(D)) / (2 * a);
    const t2 = (-b - Math.sqrt(D)) / (2 * a);
    return t1 < -1e-12 && t2 < -1e-12;               // оба квадрата отрицательны
  }
  return false;
}

function rootAllowed(r, rootKind) {
  const v = sNum(r);
  if (!Number.isFinite(v) || Math.abs(v) > 100) return false;
  if (rootKind === 'integer')  return sIsRat(r) && r.p.d === 1;
  if (rootKind === 'rational') return sIsRat(r) && r.p.d <= 12;
  if (sIsRat(r)) return r.p.d <= 12;
  return r.m <= 60 && r.p.d <= 6 && r.q.d <= 6;
}

// Вопрос блока 6: как он выглядит и чему равен на настоящих корнях
const ASK_RENDER = {
  sum:         (v) => `${v}_{1} + ${v}_{2}`,
  product:     (v) => `${v}_{1} \\cdot ${v}_{2}`,
  sumSquares:  (v) => `${v}_{1}^2 + ${v}_{2}^2`,
  inverses:    (v) => `\\dfrac{1}{${v}_{1}} + \\dfrac{1}{${v}_{2}}`,
};

const ASK_EVAL = {
  sum:        ([a, b]) => a + b,
  product:    ([a, b]) => a * b,
  sumSquares: ([a, b]) => a * a + b * b,
  inverses:   ([a, b]) => 1 / a + 1 / b,
};

/**
 * Одно задание: строит уравнение категории, проверяет, что заявленные корни
 * действительно обращают его в ноль, и оформляет ответ.
 * Возвращает null, если случайные числа не подошли — тогда пробуют ещё раз.
 */
function buildQuestion(cat, varTex, opts) {
  const gen = GENERATORS[cat];
  if (!gen) return null;
  const built = gen(opts.P, opts);
  if (!built) return null;

  const roots = built.roots || [];
  const poly = polyOfEquation(built);
  if (!poly) return null;

  // Заявленный корень обязан обращать уравнение в ноль — это и есть страховка
  // от рассинхронизации условия с ответом
  const scale = polyScale(poly);
  const numeric = [];
  for (const r of roots) {
    const x = sNum(r);
    if (!Number.isFinite(x)) return null;
    if (built.excludeZero && Math.abs(x) < 1e-9) return null;
    if (Math.abs(evalPolyNum(poly, x)) > 1e-6 * scale) return null;
    if (!rootAllowed(r, opts.rootKind)) return null;
    numeric.push(x);
  }
  if (roots.length === 0 && !hasNoRealRoots(poly)) return null;

  const exprBase = `${renderQSide(built.left, varTex)} = ${renderQSide(built.right, varTex)}`;

  // ── Блок 6: вопрос о корнях вместо «решите уравнение»
  if (built.ask) {
    if (built.ask.kind === 'byRoots') {
      const [r1, r2] = built.ask.pair;
      const list = r1 === r2
        ? `${varTex}_{1} = ${varTex}_{2} = ${r1}`
        : `${varTex}_{1} = ${r1},\\ ${varTex}_{2} = ${r2}`;
      return {
        exprLatex: `${list} \\;\\Rightarrow\\; ${varTex}^2 + p${varTex} + q = 0`,
        resultLatex: exprBase,
        varLatex: varTex,
        solution: { kind: 'equation', roots: numeric },
        cat,
      };
    }
    if (roots.length < 2) return null;              // симметричные выражения нужны от двух корней
    const expected = ASK_EVAL[built.ask.kind](numeric);
    const value = built.ask.value;
    if (!value || Math.abs(toNum(value) - expected) > 1e-6) return null;
    if (value.d > 12 || Math.abs(toNum(value)) > 400) return null;
    return {
      exprLatex: `${exprBase},\\quad ${ASK_RENDER[built.ask.kind](varTex)} = {?}`,
      resultLatex: sTex(sRat(value)),
      varLatex: varTex,
      solution: { kind: 'value', value, roots: numeric },
      cat,
    };
  }

  return {
    exprLatex: exprBase,
    resultLatex: answerTex(roots, {
      varTex, style: opts.answerStyle, usePm: opts.usePm,
    }),
    varLatex: varTex,
    // Численные корни пригодятся для проверки ответа и разбора ошибок
    solution: { kind: roots.length ? 'roots' : 'empty', roots: numeric },
    cat,
  };
}

// ─── Чистая функция генерации (для смешанных работ и сохранённых листов) ─────
export function generateQuadraticVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_QUAD, ...settings };
  const vars = VAR_POOLS[s.varsMode] || VAR_POOLS.x;
  const opts = {
    P: quadPools(s.level),
    rootKind: s.rootKind,
    answerStyle: s.answerStyle,
    usePm: s.usePm !== false,
  };

  // Пул корней у категории небольшой, поэтому одно и то же уравнение легко
  // выпадает дважды. Повтор отклоняем и пробуем ещё — но не бесконечно:
  // у узких категорий («x² = 0») повторы неизбежны, и лист не должен
  // оказаться короче заказанного.
  const seen = new Set();
  let repeats = 0;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: s.rootKind === 'integer' ? 250 : 120,
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
export function useQuadraticEquations() {
  const [title, setTitle] = useState('Квадратные уравнения');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_QUAD });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_QUAD,
  });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateQuadraticVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Квадратные уравнения');
    setSettings({ ...DEFAULT_SETTINGS_QUAD });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
