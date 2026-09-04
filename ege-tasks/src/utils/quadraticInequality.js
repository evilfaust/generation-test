/**
 * Решение квадратного неравенства и запись ответа.
 *
 * Решение — множество промежутков (`pieces`), а не отдельный «случай»: у
 * квадратного неравенства ответ бывает интервалом, объединением двух лучей,
 * точкой, всей прямой, пустым множеством и «всё, кроме точки». Один список
 * промежутков покрывает их все, и биквадратное неравенство с четырьмя
 * границами тоже ложится сюда без новых форм.
 *
 * Границы — числа из Q(√m) (`utils/surd.js`), поэтому «x² − 7 ⩽ 0» честно
 * отвечает «−√7 ⩽ x ⩽ √7», а не десятичным приближением. `null` в границе
 * означает бесконечность.
 */

import { OPS } from './inequalityCore';
import { sNum, sTex, sEq, sCompare } from './surd';
import { evalPolyNum } from './quadraticExpr';

/**
 * Решение по РАЗЛИЧНЫМ корням многочлена: знак на самом правом промежутке
 * совпадает со знаком старшего коэффициента и дальше чередуется через каждый
 * корень. Тот же метод интервалов, которым решают на бумаге, — работает и для
 * двух корней (квадратное), и для четырёх (биквадратное).
 */
export function solutionFromSimpleRoots(roots, lead, op) {
  const xs = [...roots].sort(sCompare);
  const strict = OPS[op].strict;
  const wantPositive = op === 'gt' || op === 'ge';
  const n = xs.length;
  const pieces = [];

  for (let k = 0; k <= n; k++) {
    const positive = ((lead > 0) === ((n - k) % 2 === 0));
    if (positive !== wantPositive) continue;
    pieces.push(piece(
      k === 0 ? null : xs[k - 1],
      k === n ? null : xs[k],
      k === 0 ? true : strict,
      k === n ? true : strict,
    ));
  }
  return { pieces };
}

/** Промежуток: lo/hi = null — бесконечность; *Open — строгая ли граница */
export const piece = (lo, hi, loOpen = true, hiOpen = true) => ({ lo, hi, loOpen, hiOpen });

export const EMPTY_SET = { pieces: [] };
export const ALL_REAL  = { pieces: [piece(null, null)] };

/**
 * Решение `A·x² + B·x + C  OP  0` по корням трёхчлена.
 *
 * Знак старшего коэффициента разворачивает неравенство ровно один раз — здесь,
 * а не в категориях: автор категории не может об этом забыть, а тесты
 * проверяют одно место. Дальше работает школьная таблица «парабола ветвями
 * вверх»: два корня — между ними или снаружи, один — точка или всё без точки,
 * ни одного — всё или ничего.
 */
export function solutionFromRoots(roots, lead, op) {
  const sign = lead < 0 ? OPS[op].flip : op;
  const strict = OPS[sign].strict;
  const greater = sign === 'gt' || sign === 'ge';

  if (roots.length >= 2) return solutionFromSimpleRoots(roots, lead, op);

  if (roots.length === 1) {
    const x0 = roots[0];
    if (greater) {
      // ⩾ выполняется всюду (в самой точке — равенство), > всюду кроме точки
      return strict
        ? { pieces: [piece(null, x0, true, true), piece(x0, null, true, true)] }
        : ALL_REAL;
    }
    return strict ? EMPTY_SET : { pieces: [piece(x0, x0, false, false)] };
  }

  return greater ? ALL_REAL : EMPTY_SET;
}

// ─── Свойства решения ────────────────────────────────────────────────────────
export const isEmptySet = (sol) => sol.pieces.length === 0;

export const isAllReal = (sol) =>
  sol.pieces.length === 1 && sol.pieces[0].lo === null && sol.pieces[0].hi === null;

/** Единственная точка: [a; a] */
export const singlePoint = (sol) => {
  const p = sol.pieces[0];
  return sol.pieces.length === 1 && p.lo && p.hi && sEq(p.lo, p.hi) ? p.lo : null;
};

/** «Всё, кроме точки»: (−∞; a) ∪ (a; +∞) */
export function puncturedAt(sol) {
  if (sol.pieces.length !== 2) return null;
  const [a, b] = sol.pieces;
  return a.lo === null && b.hi === null && a.hi && b.lo && sEq(a.hi, b.lo)
    && a.hiOpen && b.loOpen ? a.hi : null;
}

/** Принадлежит ли число решению (с допуском на границе) */
export function contains(sol, x, eps = 1e-9) {
  return sol.pieces.some(({ lo, hi, loOpen, hiOpen }) => {
    if (lo !== null) {
      const d = x - sNum(lo);
      if (loOpen ? d <= eps : d < -eps) return false;
    }
    if (hi !== null) {
      const d = sNum(hi) - x;
      if (hiOpen ? d <= eps : d < -eps) return false;
    }
    return true;
  });
}

/** Все конечные границы решения — точки, вокруг которых его и проверяют */
export const boundaries = (sol) =>
  sol.pieces.flatMap(p => [p.lo, p.hi]).filter(Boolean).map(sNum);

// ─── Запись ответа ───────────────────────────────────────────────────────────
const INF = '\\infty';

function pieceIntervalTex(p) {
  const lo = p.lo === null ? `-${INF}` : sTex(p.lo);
  const hi = p.hi === null ? `+${INF}`  : sTex(p.hi);
  // У бесконечности скобка всегда круглая, независимо от строгости знака
  const open  = p.lo === null || p.loOpen ? '\\left(' : '\\left[';
  const close = p.hi === null || p.hiOpen ? '\\right)' : '\\right]';
  return `${open}${lo}; ${hi}${close}`;
}

function pieceInequalityTex(p, varTex) {
  if (p.lo === null && p.hi === null) return `${varTex} \\in \\mathbb{R}`;
  if (p.lo === null) return `${varTex} ${OPS[p.hiOpen ? 'lt' : 'le'].tex} ${sTex(p.hi)}`;
  if (p.hi === null) return `${varTex} ${OPS[p.loOpen ? 'gt' : 'ge'].tex} ${sTex(p.lo)}`;
  if (sEq(p.lo, p.hi)) return `${varTex} = ${sTex(p.lo)}`;
  const left  = OPS[p.loOpen ? 'lt' : 'le'].tex;
  const right = OPS[p.hiOpen ? 'lt' : 'le'].tex;
  return `${sTex(p.lo)} ${left} ${varTex} ${right} ${sTex(p.hi)}`;
}

/**
 * Ответ строкой. `form`:
 *   'inequality' — «−3 ⩽ x ⩽ 5», «x < 2 или x > 7», «x ≠ 8»
 *   'interval'   — «[−3; 5]», «(−∞; 2) ∪ (7; +∞)» — запись методом интервалов
 */
export function inequalityAnswerTex(sol, varTex = 'x', { form = 'inequality' } = {}) {
  if (isEmptySet(sol)) return '\\varnothing';

  if (form === 'interval') {
    const point = singlePoint(sol);
    if (point) return `\\left\\{${sTex(point)}\\right\\}`;
    return sol.pieces.map(pieceIntervalTex).join(' \\cup ');
  }

  if (isAllReal(sol)) return `${varTex} \\in \\mathbb{R}`;
  const hole = puncturedAt(sol);
  if (hole) return `${varTex} \\neq ${sTex(hole)}`;
  return sol.pieces.map(p => pieceInequalityTex(p, varTex)).join(' \\;\\text{или}\\; ');
}

// ─── Проверка ────────────────────────────────────────────────────────────────
/**
 * Сверяет заявленное решение с самим неравенством численно: во всех пробных
 * точках «точка принадлежит ответу» обязано совпадать с «неравенство верно».
 *
 * Точки берутся вокруг границ (снаружи, внутри, между соседними) — именно там
 * ошибаются знаком и строгостью. Сами границы проверяются отдельно: подстановка
 * даёт ноль, и всё решает строгость знака.
 */
export function verifySolution(poly, op, sol, { span = 40 } = {}) {
  const test = (x) => OPS[op].test(evalPolyNum(poly, x), 0);
  const bounds = boundaries(sol).sort((a, b) => a - b);

  const probes = [-span, span, 0.5, -0.5];
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i];
    probes.push(b - 1, b - 0.01, b + 0.01, b + 1);
    if (i + 1 < bounds.length) probes.push((b + bounds[i + 1]) / 2);
  }

  for (const x of probes) {
    // Вблизи корня знак многочлена тонет в погрешности — такие точки
    // ничего не доказывают, их проверяет отдельная ветка ниже
    if (Math.abs(evalPolyNum(poly, x)) < 1e-7) continue;
    if (!Number.isFinite(x)) continue;
    if (test(x) !== contains(sol, x)) return false;
  }

  // Граница входит в ответ ровно тогда, когда знак нестрогий
  for (const b of bounds) {
    if (Math.abs(evalPolyNum(poly, b)) > 1e-6) return false;   // не корень — не граница
    if (contains(sol, b, 0) !== !OPS[op].strict) return false;
  }
  return true;
}
