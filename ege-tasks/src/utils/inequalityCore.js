import {
  subR, divR, isZero, toNum, niceDecimal, decTex, rand,
  linearOfSide,
} from './linearExpr';

/**
 * Общее ядро неравенств: знаки, решатель и запись ответа. Используют оба
 * генератора — линейных неравенств и двойных.
 *
 * Разворот знака при делении на отрицательное живёт здесь, а не в категориях:
 * автор категории не может его забыть, а тесты проверяют одно место.
 */

export const OPS = {
  lt: { tex: '<',            flip: 'gt', strict: true,  test: (a, b) => a <  b },
  gt: { tex: '>',            flip: 'lt', strict: true,  test: (a, b) => a >  b },
  le: { tex: '\\leqslant',   flip: 'ge', strict: false, test: (a, b) => a <= b },
  ge: { tex: '\\geqslant',   flip: 'le', strict: false, test: (a, b) => a >= b },
};

export const ALL_OPS    = ['lt', 'gt', 'le', 'ge'];
export const STRICT_OPS = ['lt', 'gt'];

export function randOp(strictOnly) {
  return rand(strictOnly ? STRICT_OPS : ALL_OPS);
}

// Знак «меньше» любого вида — нужен, чтобы строить двойные неравенства
export const isLess = (op) => op === 'lt' || op === 'le';

// ─── Решение ─────────────────────────────────────────────────────────────────
// k·x OP m  →  луч; при k < 0 знак переворачивается, при k = 0 — вырожденный
// случай: «нет решений» или «любое число».
export function solveSimple(left, right, op) {
  const L = linearOfSide(left);
  const R = linearOfSide(right);
  const k = subR(L.a, R.a);
  const m = subR(R.b, L.b);

  if (isZero(k)) {
    return OPS[op].test(0, toNum(m)) ? { kind: 'all' } : { kind: 'empty' };
  }
  const value = divR(m, k);
  return { kind: 'ray', op: k.n < 0 ? OPS[op].flip : op, value };
}

// lo OP1 (a·x + b) OP2 hi  →  двойное неравенство
export function solveDouble({ lo, opLeft, middle, opRight, hi }) {
  const M = linearOfSide(middle);
  if (isZero(M.a)) return null;
  const loBound = divR(subR(lo, M.b), M.a);
  const hiBound = divR(subR(hi, M.b), M.a);

  // При a < 0 границы меняются местами. Знаки при этом НЕ переворачиваются:
  // деление на отрицательное разворачивает их один раз, а перестановка сторон
  // («x > a» → «a < x») — второй. Меняется только порядок, строгость та же.
  return M.a.n > 0
    ? { kind: 'between', opLo: opLeft,  lo: loBound, opHi: opRight, hi: hiBound }
    : { kind: 'between', opLo: opRight, lo: hiBound, opHi: opLeft,  hi: loBound };
}

// ─── Запись ответа ───────────────────────────────────────────────────────────
export function fmtValue(v, answerStyle) {
  if (v.d === 1) return String(v.n);
  if (answerStyle === 'dec' || (answerStyle !== 'frac' && niceDecimal(v, 2))) {
    const s = decTex(v);
    if (s) return s;
  }
  return v.n < 0 ? `-\\dfrac{${-v.n}}{${v.d}}` : `\\dfrac{${v.n}}{${v.d}}`;
}

// Скобка промежутка: строгий знак — круглая, нестрогий — квадратная
export const openBr  = (op) => (OPS[op].strict ? '\\left(' : '\\left[');
export const closeBr = (op) => (OPS[op].strict ? '\\right)' : '\\right]');

export function answerTex(solution, varTex, { answerForm, answerStyle }) {
  if (solution.kind === 'empty') return '\\varnothing';
  if (solution.kind === 'all')   return `${varTex} \\in \\mathbb{R}`;

  if (solution.kind === 'ray') {
    const { op, value } = solution;
    const v = fmtValue(value, answerStyle);
    if (answerForm === 'interval') {
      return isLess(op)
        ? `\\left(-\\infty; ${v}${closeBr(op)}`
        : `${openBr(op)}${v}; +\\infty\\right)`;
    }
    return `${varTex} ${OPS[op].tex} ${v}`;
  }

  // between
  const { opLo, lo, opHi, hi } = solution;
  const loTex = fmtValue(lo, answerStyle);
  const hiTex = fmtValue(hi, answerStyle);
  if (answerForm === 'interval') {
    return `${openBr(opLo)}${loTex}; ${hiTex}${closeBr(opHi)}`;
  }
  return `${loTex} ${OPS[opLo].tex} ${varTex} ${OPS[opHi].tex} ${hiTex}`;
}

