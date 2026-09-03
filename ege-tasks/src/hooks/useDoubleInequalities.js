import { useState, useCallback } from 'react';
import {
  rat, R1, negR, addR, subR, mulR, divR, isZero, toNum,
  niceDecimal, rand, randInt, chance,
  num, vr, mul, dvd, renderSide, linearOfSide,
  FRAC_DENS, coprimeNumerators,
} from '../utils/linearExpr';
import { OPS, solveDouble, answerTex } from '../utils/inequalityCore';
import { generateByCategories } from '../utils/questionPlan';
import { useApplySheet } from './useApplySheet';

/**
 * Генератор двойных неравенств вида `lo ⩽ f(x) < hi`.
 *
 * В отличие от генератора линейных неравенств, задание строится НЕ от корня, а
 * от границ: на листе слева и справа стоят круглые числа (−10, 3,6, 5), а
 * решение уже может оказаться дробным (−17 ⩽ 2x → x ⩾ −8,5). Поэтому категории
 * задают середину и границы, а `solveDouble` из общего ядра делит на
 * коэффициент — там же живёт разворот знаков при отрицательном коэффициенте.
 */

// В двойном неравенстве оба знака — «меньше» (строгий или нестрогий)
const LESS_OPS        = ['lt', 'le'];
const LESS_OPS_STRICT = ['lt'];

const randLess = (strictOnly) => rand(strictOnly ? LESS_OPS_STRICT : LESS_OPS);

// ─── Границы ─────────────────────────────────────────────────────────────────
// Левая граница почти всегда отрицательная — как в тетради.
function randBoundPair({ decimals = false, span = [3, 24] } = {}) {
  const lo = rat(chance(0.85) ? -randInt(2, 20) : randInt(0, 6));
  let hi = rat(toNum(lo) + randInt(span[0], span[1]));

  if (decimals) {
    // одна из границ — десятичная с одним знаком: 3,6 / 5,6 / 4,5
    const tenths = randInt(1, 9);
    if (chance(0.7)) hi = rat(hi.n * 10 + tenths, 10);
    else             return { lo: rat(lo.n * 10 - tenths, 10), hi };
  }
  return { lo, hi };
}

/**
 * Границы для готовой середины. Часть заданий строится «от круглых границ»
 * (как в тетради: −17 ⩽ 2x ⩽ 5,6 — ответ дробный), часть — от целых решений:
 * иначе на составных серединах (3(x + 7) + 12) почти всегда выходят ответы
 * вида −49/3, в устной работе бесполезные.
 */
function makeBounds(middle, { decimals = false, fromRoots = 0.55, span } = {}) {
  if (chance(fromRoots)) {
    const M = linearOfSide(middle);
    if (isZero(M.a)) return null;
    // корни берём кратными знаменателю коэффициента: у x/6 это даёт целые границы
    const step = M.a.d;
    const x1 = rat(randInt(-10, 5) * step);
    const x2 = addR(x1, rat(randInt(2, 9) * step));
    const v1 = addR(mulR(M.a, x1), M.b);
    const v2 = addR(mulR(M.a, x2), M.b);
    const [lo, hi] = M.a.n > 0 ? [v1, v2] : [v2, v1];
    // На листе слева и справа стоят круглые числа. Если середина сдвинута
    // дробью ((3x + 8)/3), корни дают дробные границы — тогда берём круглые,
    // а дробным пусть окажется ответ.
    if (!niceDecimal(lo, 2) || !niceDecimal(hi, 2)) return randBoundPair({ decimals, span });
    return { lo, hi };
  }
  return randBoundPair({ decimals, span });
}

const dbl = (middle, bounds, ctx) => bounds && ({
  middle,
  lo: bounds.lo,
  hi: bounds.hi,
  opLeft:  randLess(ctx.strictOnly),
  opRight: randLess(ctx.strictOnly),
});

// ─── Блок 1: ax в середине ───────────────────────────────────────────────────

// -10 ⩽ 5x < 5
function genIntCoef(ctx) {
  const middle = [vr(rat(rand([2, 3, 4, 5, 6, 7, 8, 9])))];
  return dbl(middle, makeBounds(middle, { fromRoots: 0.45 }), ctx);
}

// -12 ⩽ 3x ⩽ 3,6 — круглые десятичные границы, ответ обычно дробный
function genDecBounds(ctx) {
  const middle = [vr(rat(rand([2, 3, 4, 5, 6])), 'dec')];
  return dbl(middle, randBoundPair({ decimals: true }), ctx);
}

// -18 ⩽ -6x ⩽ 12 — коэффициент отрицательный, границы решения меняются местами
function genNegCoef(ctx) {
  const middle = [vr(negR(rat(rand([2, 3, 4, 5, 6, 8]))))];
  return dbl(middle, makeBounds(middle, { fromRoots: 0.5 }), ctx);
}

// ─── Блок 2: со сдвигом ──────────────────────────────────────────────────────

// -4 ⩽ x + 3 < 5
function genVarPlusConst(ctx) {
  const b = rat(randInt(1, 12) * (chance(0.45) ? -1 : 1));
  const middle = [vr(R1), num(b)];
  return dbl(middle, randBoundPair(), ctx);
}

// -7 ⩽ 2x + 1 ⩽ 5
function genCoefPlusConst(ctx) {
  const a = rat(rand([2, 3, 4, 5, 6]));
  const b = rat(randInt(1, 12) * (chance(0.5) ? -1 : 1));
  const middle = [vr(a), num(b)];
  return dbl(middle, makeBounds(middle, { decimals: chance(0.25), fromRoots: 0.6 }), ctx);
}

// -8 ⩽ 3 - 2x ⩽ 7 — минус перед переменной
function genConstMinusVar(ctx) {
  const a = negR(rat(rand([1, 2, 3, 4, 5])));
  const b = rat(randInt(1, 9));
  const middle = [num(b), vr(a)];
  return dbl(middle, makeBounds(middle, { fromRoots: 0.6 }), ctx);
}

// ─── Блок 3: дроби ───────────────────────────────────────────────────────────

// 0,5 < x/2 < 4,5
function genVarOverN(ctx) {
  const d = rat(rand([2, 3, 4, 5, 6]));
  const middle = [dvd([vr(R1)], d)];
  return dbl(middle, randBoundPair({ decimals: chance(0.5), span: [2, 8] }), ctx);
}

// -1 ⩽ (6 + 2x)/4 ⩽ 4
function genExprOverN(ctx) {
  const d = rat(rand([2, 3, 4, 5, 6]));
  const a = rat(rand([1, 2, 3, 4]) * (chance(0.2) ? -1 : 1));
  const b = rat(randInt(1, 12) * (chance(0.4) ? -1 : 1));
  const inner = chance(0.5) ? [num(b), vr(a)] : [vr(a), num(b)];
  const middle = [dvd(inner, d)];
  return dbl(middle, makeBounds(middle, { fromRoots: 0.6, span: [2, 10] }), ctx);
}

// -2 ⩽ (2/3)x ⩽ 4 — обыкновенная дробь как коэффициент
function genFracCoef(ctx) {
  const d = rand(FRAC_DENS);
  const n = chance(0.4) ? 1 : rand(coprimeNumerators(d));
  const k = rat(n, d);
  const middle = [vr(chance(0.2) ? negR(k) : k)];
  return dbl(middle, makeBounds(middle, { fromRoots: 0.6, span: [2, 10] }), ctx);
}

// ─── Блок 4: скобки и составное ──────────────────────────────────────────────

// -6 ⩽ 2(x - 1) < 10
function genBrackets(ctx) {
  const k = rat(rand([2, 3, 4, 5]) * (chance(0.25) ? -1 : 1));
  const inner = rat(rand([1, 1, 2]));
  const shift = rat(randInt(1, 9) * (chance(0.5) ? -1 : 1));
  const middle = [mul(k, [vr(inner), num(shift)])];
  return dbl(middle, makeBounds(middle, { fromRoots: 0.6 }), ctx);
}

// -5 < 3(x + 2) - 4 ⩽ 10 — скобка плюс свободный член
function genBracketsShift(ctx) {
  const k = rat(rand([2, 3, 4, 5]));
  const shift = rat(randInt(1, 8) * (chance(0.5) ? -1 : 1));
  const tail = rat(randInt(1, 12) * (chance(0.6) ? -1 : 1));
  const middle = [mul(k, [vr(R1), num(shift)]), num(tail)];
  return dbl(middle, makeBounds(middle, { fromRoots: 0.65 }), ctx);
}

// -3 ⩽ (5 - 2x)/3 < 1 — дробь с минусом перед переменной
function genNegFracExpr(ctx) {
  const d = rat(rand([2, 3, 4, 5]));
  const a = negR(rat(rand([1, 2, 3, 4])));
  const b = rat(randInt(1, 12));
  const middle = [dvd([num(b), vr(a)], d)];
  return dbl(middle, makeBounds(middle, { fromRoots: 0.6, span: [2, 10] }), ctx);
}

const GENERATORS = {
  intCoef:        genIntCoef,
  decBounds:      genDecBounds,
  negCoef:        genNegCoef,
  varPlusConst:   genVarPlusConst,
  coefPlusConst:  genCoefPlusConst,
  constMinusVar:  genConstMinusVar,
  varOverN:       genVarOverN,
  exprOverN:      genExprOverN,
  fracCoef:       genFracCoef,
  brackets:       genBrackets,
  bracketsShift:  genBracketsShift,
  negFracExpr:    genNegFracExpr,
};

export const CATEGORY_LABELS_DBL = {
  intCoef:       'Целый коэффициент: −10 ⩽ 5x < 5',
  decBounds:     'Десятичные границы: −12 ⩽ 3x ⩽ 3,6',
  negCoef:       'Отрицательный коэффициент: −18 ⩽ −6x ⩽ 12',
  varPlusConst:  'Со сдвигом: −4 ⩽ x + 3 < 5',
  coefPlusConst: 'Коэффициент и сдвиг: −7 ⩽ 2x + 1 ⩽ 5',
  constMinusVar: 'Минус перед x: −8 ⩽ 3 − 2x ⩽ 7',
  varOverN:      'Дробь: 0,5 < x/2 < 4,5',
  exprOverN:     'Дробь с суммой: −1 ⩽ (6 + 2x)/4 ⩽ 4',
  fracCoef:      'Дробный коэффициент: −2 ⩽ ⅔x ⩽ 4',
  brackets:      'Скобки: −6 ⩽ 2(x − 1) < 10',
  bracketsShift: 'Скобки и сдвиг: −5 < 3(x + 2) − 4 ⩽ 10',
  negFracExpr:   'Дробь с минусом: −3 ⩽ (5 − 2x)/3 < 1',
};

// Блоки по нарастанию сложности — они же порядок чекбоксов в UI
export const CATEGORY_GROUPS_DBL = [
  { label: 'Блок 1. ax в середине',   keys: ['intCoef', 'decBounds', 'negCoef'] },
  { label: 'Блок 2. Со сдвигом',      keys: ['varPlusConst', 'coefPlusConst', 'constMinusVar'] },
  { label: 'Блок 3. Дроби',           keys: ['varOverN', 'exprOverN', 'fracCoef'] },
  { label: 'Блок 4. Скобки',          keys: ['brackets', 'bracketsShift', 'negFracExpr'] },
];

const VAR_POOLS = {
  x:     ['x'],
  xy:    ['x', 'y'],
  mixed: ['x', 'y', 'a', 'b', 'z', 't', 'm', 'n'],
};

export const DEFAULT_SETTINGS_DBL = {
  variantsCount:  4,
  questionsCount: 10,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   1,        // строки длиннее обычных — по умолчанию одна колонка
  fontSize:       's',
  answerForm:     'ineq',   // ineq — «−2 ⩽ x < 1» | interval — «[−2; 1)»
  answerStyle:    'auto',   // auto | frac | dec — вид дробной границы
  strictOnly:     false,
  integerOnly:    false,    // только целые границы решения
  varsMode:       'xy',
  categories: {
    intCoef:       true,
    decBounds:     true,
    negCoef:       true,
    varPlusConst:  true,
    coefPlusConst: true,
    constMinusVar: true,
    varOverN:      true,
    exprOverN:     true,
    fracCoef:      false,
    brackets:      false,
    bracketsShift: false,
    negFracExpr:   false,
  },
};

function boundsOk({ lo, hi }, { integerOnly, answerStyle }) {
  for (const v of [lo, hi]) {
    if (!v || v.d > 12 || Math.abs(toNum(v)) > 100) return false;
    if (integerOnly && v.d !== 1) return false;
    if (answerStyle === 'dec' && !niceDecimal(v, 2)) return false;
  }
  // Промежуток из одной точки («−4 ⩽ 2x ⩽ −4») — вырожденный, не печатаем
  return toNum(lo) < toNum(hi);
}

function buildQuestion(cat, varTex, opts) {
  const gen = GENERATORS[cat];
  if (!gen) return null;
  const built = gen(opts);
  if (!built) return null;

  // Границы условия всегда круглые — иначе получается «-4/3 ⩽ (3x + 8)/3»
  if (!niceDecimal(built.lo, 2) || !niceDecimal(built.hi, 2)) return null;

  const solution = solveDouble(built);
  if (!solution || !boundsOk(solution, opts)) return null;

  const exprLatex = [
    renderSide([num(built.lo, 'dec')], varTex),
    OPS[built.opLeft].tex,
    renderSide(built.middle, varTex),
    OPS[built.opRight].tex,
    renderSide([num(built.hi, 'dec')], varTex),
  ].join(' ');

  return {
    exprLatex,
    resultLatex: answerTex(solution, varTex, opts),
    varLatex: varTex,
    solution,
    cat,
  };
}

// ─── Чистая функция генерации (для смешанных работ и тестов) ─────────────────
export function generateDoubleInequalityVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_DBL, ...settings };
  const opts = {
    answerForm:  s.answerForm,
    answerStyle: s.decimalOnly ? 'dec' : s.answerStyle,
    strictOnly:  s.strictOnly,
    integerOnly: s.integerOnly,
  };
  const vars = VAR_POOLS[s.varsMode] || VAR_POOLS.xy;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: opts.integerOnly || opts.answerStyle === 'dec' ? 300 : 120,
    make: (cat) => buildQuestion(cat, rand(vars), opts),
  });
}

// ─── Хук ─────────────────────────────────────────────────────────────────────
export function useDoubleInequalities() {
  const [title, setTitle] = useState('Двойные неравенства');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_DBL });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_DBL });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateDoubleInequalityVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Двойные неравенства');
    setSettings({ ...DEFAULT_SETTINGS_DBL });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
