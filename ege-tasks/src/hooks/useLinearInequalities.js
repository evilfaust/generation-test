import { useState, useCallback } from 'react';
import {
  rat, R1, negR, addR, subR, mulR, divR, isZero, toNum,
  niceDecimal, decTex, rand, randInt, chance,
  num, vr, linearOfSide, renderSide,
  INT_COEFS, ROOTS_SMALL, DEC_COEFS, ROOTS_DEC, FRAC_DENS,
  coprimeNumerators,
} from '../utils/linearExpr';
import {
  formBrackets, formBracketsBoth, formExpandTwo,
  formFracDenom, formFracTwoDen, formFracBothSides, formDegenerate,
} from '../utils/linearForms';
import { generateByCategories } from '../utils/questionPlan';

/**
 * Генератор линейных неравенств (раздел «Уравнения»).
 *
 * Условие строится деревом узлов из `utils/linearExpr` — тем же, что у
 * генератора уравнений, поэтому напечатанное условие и ответ считаются из
 * одного источника. Главная методическая точка темы — деление на отрицательное
 * число разворачивает знак: это делает `solveSimple`, а не автор категории.
 */

// ─── Знаки неравенств ────────────────────────────────────────────────────────
import {
  OPS, ALL_OPS, STRICT_OPS, randOp, solveSimple, solveDouble, answerTex,
} from '../utils/inequalityCore';

export { OPS };

// ─── Конструкторы заданий для категорий ──────────────────────────────────────
const ineq = (left, right, op, opts = {}) => ({ kind: 'simple', left, right, op, ...opts });

// ─── Блок 1: простейшие ──────────────────────────────────────────────────────

// 3x > 18
function genSimpleInt(ctx) {
  const a = rand(INT_COEFS);
  const x = rand(ROOTS_SMALL);
  const b = chance(0.75) ? a * x : randInt(2, 60);   // иногда дробная граница
  return ineq([vr(rat(a))], [num(rat(b))], randOp(ctx.strictOnly));
}

// -4x > 12 — знак переворачивается
function genNegCoef(ctx) {
  const a = -rand(INT_COEFS);
  const x = rand(ROOTS_SMALL) * (chance(0.4) ? -1 : 1);
  return ineq([vr(rat(a))], [num(rat(a * x))], randOp(ctx.strictOnly));
}

// 0,5x < 2,5
function genDecCoef(ctx) {
  const k = rand(DEC_COEFS);
  const kSigned = chance(0.3) ? negR(k) : k;
  const x = chance(0.7) ? rat(rand(ROOTS_SMALL)) : rand(ROOTS_DEC);
  const b = mulR(kSigned, x);
  if (!niceDecimal(b, 3)) return null;
  return ineq([vr(kSigned, 'dec')], [num(b, 'dec')], randOp(ctx.strictOnly), { prefer: 'dec' });
}

// (2/3)x ⩽ 4
function genFracCoef(ctx) {
  const d = rand(FRAC_DENS);
  const n = chance(0.4) ? 1 : rand(coprimeNumerators(d));
  const k = rat(n, d);
  const kSigned = chance(0.25) ? negR(k) : k;
  const b = rat(randInt(1, 12) * (chance(0.2) ? -1 : 1));
  return ineq([vr(kSigned)], [num(b)], randOp(ctx.strictOnly));
}

// x + 5 > 12 / 7 - x ⩽ 2
function genAddConst(ctx) {
  const b = rat(randInt(1, 20) * (chance(0.45) ? -1 : 1));
  const x = rat(rand(ROOTS_SMALL) * (chance(0.3) ? -1 : 1));
  const flipVar = chance(0.3);                         // 7 - x: коэффициент -1
  const k = flipVar ? rat(-1) : R1;
  const c = addR(mulR(k, x), b);
  const left = flipVar ? [num(b), vr(k)] : [vr(k), num(b)];
  return ineq(left, [num(c)], randOp(ctx.strictOnly));
}

// 18 < 3x — число слева
function genSwapped(ctx) {
  const base = rand([genSimpleInt, genDecCoef, genNegCoef, genFracCoef])(ctx);
  if (!base) return null;
  // Смена сторон разворачивает знак: a < b ⟺ b > a
  return ineq(base.right, base.left, OPS[base.op].flip, { prefer: base.prefer });
}

// ─── Блок 2: два шага ────────────────────────────────────────────────────────

// 3x - 7 > 8
function genTwoStep(ctx) {
  const useDec = chance(0.35);
  const prefer = useDec ? 'dec' : 'frac';
  const a = useDec ? rand(DEC_COEFS) : rat(rand(INT_COEFS));
  const aSigned = chance(0.3) ? negR(a) : a;
  const x = useDec
    ? (chance(0.6) ? rat(rand(ROOTS_SMALL)) : rand(ROOTS_DEC))
    : rat(rand(ROOTS_SMALL) * (chance(0.25) ? -1 : 1));
  const b = useDec ? rand(DEC_COEFS.concat([rat(2), rat(5)])) : rat(randInt(1, 15));
  const bSigned = chance(0.5) ? negR(b) : b;
  const c = addR(mulR(aSigned, x), bSigned);
  if (useDec && !niceDecimal(c, 3)) return null;

  return ineq(
    [vr(aSigned, prefer), num(bSigned, prefer)],
    [num(c, prefer)],
    randOp(ctx.strictOnly),
    { prefer },
  );
}

// 0,4x + 0,6x ⩾ 2 / 5x - 8x < 9
function genLikeTerms(ctx) {
  const useDec = chance(0.5);
  const prefer = useDec ? 'dec' : 'frac';
  const k1 = useDec ? rand(DEC_COEFS) : rat(rand([1, 2, 3, 4, 5, 6]));
  const k2raw = useDec ? rand(DEC_COEFS) : rat(rand([1, 2, 3, 4, 5, 8]));
  const k2 = chance(0.45) ? negR(k2raw) : k2raw;
  const sum = addR(k1, k2);
  if (isZero(sum)) return null;

  const x = useDec
    ? (chance(0.6) ? rat(rand(ROOTS_SMALL)) : rand(ROOTS_DEC))
    : rat(rand(ROOTS_SMALL) * (chance(0.2) ? -1 : 1));
  const c = mulR(sum, x);
  if (useDec && !niceDecimal(c, 3)) return null;
  if (!useDec && c.d > 4) return null;

  return ineq(
    [vr(k1, prefer), vr(k2, prefer)],
    [num(c, prefer)],
    randOp(ctx.strictOnly),
    { prefer },
  );
}

// 5x - 3 > 2x + 9
function genBothSides(ctx) {
  const a = rat(rand([2, 3, 4, 5, 6, 7, 8, 9, 10]) * (chance(0.25) ? -1 : 1));
  const c = rat(rand([1, 2, 3, 4, 5, 6]) * (chance(0.35) ? -1 : 1));
  if (isZero(subR(a, c))) return null;

  const x = rat(rand(ROOTS_SMALL) * (chance(0.25) ? -1 : 1));
  const b = rat(randInt(1, 14) * (chance(0.5) ? -1 : 1));
  const d = subR(addR(mulR(a, x), b), mulR(c, x));
  if (Math.abs(toNum(d)) > 200) return null;

  return ineq([vr(a), num(b)], [vr(c), num(d)], randOp(ctx.strictOnly));
}

// ─── Блок 3: скобки ──────────────────────────────────────────────────────────
// Сами выражения строит `utils/linearForms` — те же формы, что в уравнениях;
// категории здесь только надевают на них знак неравенства.

const fromForm = (form, ctx) => {
  const f = form();
  return f && ineq(f.left, f.right, randOp(ctx.strictOnly));
};

const genBrackets      = (ctx) => fromForm(formBrackets, ctx);
const genBracketsBoth  = (ctx) => fromForm(formBracketsBoth, ctx);
const genExpandTwo     = (ctx) => fromForm(formExpandTwo, ctx);

// ─── Блок 4: дроби ───────────────────────────────────────────────────────────
const genFracDenom     = (ctx) => fromForm(formFracDenom, ctx);
const genFracTwoDen    = (ctx) => fromForm(formFracTwoDen, ctx);
const genFracBothSides = (ctx) => fromForm(formFracBothSides, ctx);

// ─── Блок 5: особые случаи ───────────────────────────────────────────────────

// Коэффициенты при переменной равны, поэтому всё сводится к сравнению чисел.
// Знак подбираем так, чтобы вышло задуманное: «нет решений» или «любое число».
function genDegenerate(ctx, wantAll) {
  const f = formDegenerate({ equalConst: chance(0.4) });
  if (!f) return null;

  const l = toNum(f.lConst);
  const r = toNum(f.rConst);
  const ops = (ctx.strictOnly ? STRICT_OPS : ALL_OPS)
    .filter(op => OPS[op].test(l, r) === wantAll);
  if (ops.length === 0) return null;

  return ineq(f.left, f.right, rand(ops), { degenerate: true });
}

const genNoSolution = (ctx) => genDegenerate(ctx, false);
const genAllReal    = (ctx) => genDegenerate(ctx, true);

// -3 < 2x - 1 ⩽ 7 — двойное неравенство
function genDoubleIneq(ctx) {
  const a = rat(rand([1, 2, 3, 4, 5]) * (chance(0.25) ? -1 : 1));
  const b = rat(randInt(0, 12) * (chance(0.5) ? -1 : 1));
  const x1 = rat(rand(ROOTS_SMALL) * (chance(0.3) ? -1 : 1));
  const x2 = addR(x1, rat(randInt(1, 8)));

  const middle = isZero(b) ? [vr(a)] : [vr(a), num(b)];
  const v1 = addR(mulR(a, x1), b);
  const v2 = addR(mulR(a, x2), b);
  const lo = a.n > 0 ? v1 : v2;
  const hi = a.n > 0 ? v2 : v1;
  if (Math.abs(toNum(lo)) > 100 || Math.abs(toNum(hi)) > 100) return null;

  const opLeft  = ctx.strictOnly ? 'lt' : rand(['lt', 'le']);
  const opRight = ctx.strictOnly ? 'lt' : rand(['lt', 'le']);
  return { kind: 'double', lo, opLeft, middle, opRight, hi };
}

const GENERATORS = {
  simpleInt:     genSimpleInt,
  negCoef:       genNegCoef,
  decCoef:       genDecCoef,
  fracCoef:      genFracCoef,
  addConst:      genAddConst,
  swapped:       genSwapped,
  twoStep:       genTwoStep,
  likeTerms:     genLikeTerms,
  bothSides:     genBothSides,
  brackets:      genBrackets,
  bracketsBoth:  genBracketsBoth,
  expandTwo:     genExpandTwo,
  fracDenom:     genFracDenom,
  fracTwoDen:    genFracTwoDen,
  fracBothSides: genFracBothSides,
  noSolution:    genNoSolution,
  allReal:       genAllReal,
  doubleIneq:    genDoubleIneq,
};

export const CATEGORY_LABELS_INEQ = {
  simpleInt:     'Целый коэффициент: 3x > 18',
  negCoef:       'Отрицательный коэффициент: −4x > 12',
  decCoef:       'Десятичный коэффициент: 0,5x < 2,5',
  fracCoef:      'Дробь как коэффициент: ⅔x ⩽ 4',
  addConst:      'Перенос числа: x + 5 > 12',
  swapped:       'Число слева: 18 < 3x',
  twoStep:       'Два шага: 3x − 7 > 8',
  likeTerms:     'Подобные слагаемые: 0,4x + 0,6x ⩾ 2',
  bothSides:     'Переменная в обеих частях: 5x − 3 > 2x + 9',
  brackets:      'Скобки: 2(x − 3) > 10',
  bracketsBoth:  'Скобки с двух сторон: 3(x − 1) > 2(x + 4)',
  expandTwo:     'Две скобки: 2(x − 1) − 3(x + 2) ⩾ 4',
  fracDenom:     'Дробь с переменной: (x + 1)/3 ⩽ 2',
  fracTwoDen:    'Разные знаменатели: x/2 − x/3 < 1',
  fracBothSides: 'Дроби с двух сторон: (2x − 1)/4 > (x + 3)/2',
  noSolution:    'Нет решений: 2(x + 1) > 2x + 5',
  allReal:       'Любое число: 3(x − 2) ⩽ 3x + 1',
  doubleIneq:    'Двойное: −3 < 2x − 1 ⩽ 7',
};

// Блоки по нарастанию сложности — они же порядок чекбоксов в UI
export const CATEGORY_GROUPS_INEQ = [
  {
    label: 'Блок 1. Простейшие (устно)',
    keys: ['simpleInt', 'negCoef', 'decCoef', 'fracCoef', 'addConst', 'swapped'],
  },
  {
    label: 'Блок 2. Два шага',
    keys: ['twoStep', 'likeTerms', 'bothSides'],
  },
  {
    label: 'Блок 3. Скобки',
    keys: ['brackets', 'bracketsBoth', 'expandTwo'],
  },
  {
    label: 'Блок 4. Дроби',
    keys: ['fracDenom', 'fracTwoDen', 'fracBothSides'],
  },
  {
    label: 'Блок 5. Особые случаи',
    keys: ['noSolution', 'allReal', 'doubleIneq'],
  },
];

const VAR_POOLS = {
  x:     ['x'],
  xy:    ['x', 'y'],
  mixed: ['x', 'y', 'a', 'b', 'z', 't', 'm', 'n'],
};

export const DEFAULT_SETTINGS_INEQ = {
  variantsCount:  4,
  questionsCount: 10,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  answerForm:     'ineq',   // ineq — «x > 5» | interval — «(5; +∞)»
  answerStyle:    'auto',   // auto | frac | dec — вид дробной границы
  strictOnly:     false,    // только строгие знаки < >
  integerOnly:    false,    // только целые границы
  varsMode:       'xy',
  categories: {
    simpleInt:     true,
    negCoef:       true,
    decCoef:       true,
    fracCoef:      true,
    addConst:      true,
    swapped:       true,
    twoStep:       true,
    likeTerms:     true,
    bothSides:     true,
    brackets:      true,
    bracketsBoth:  true,
    expandTwo:     true,
    fracDenom:     false,
    fracTwoDen:    false,
    fracBothSides: false,
    noSolution:    false,
    allReal:       false,
    doubleIneq:    false,
  },
};

function isNiceBound(v) {
  return v && v.d <= 12 && Math.abs(toNum(v)) <= 100;
}

function boundsOk(solution, { integerOnly, answerStyle }) {
  const values = solution.kind === 'ray' ? [solution.value]
    : solution.kind === 'between' ? [solution.lo, solution.hi]
    : [];
  for (const v of values) {
    if (!isNiceBound(v)) return false;
    if (integerOnly && v.d !== 1) return false;
    if (answerStyle === 'dec' && !niceDecimal(v, 3)) return false;
  }
  return true;
}

/**
 * Одно задание: строит неравенство категории, решает его и проверяет
 * ограничения. Возвращает null, если оно не подошло.
 */
function buildQuestion(cat, varTex, opts) {
  const gen = GENERATORS[cat];
  if (!gen) return null;
  const built = gen(opts);
  if (!built) return null;

  let solution;
  let exprLatex;

  if (built.kind === 'double') {
    solution = solveDouble(built);
    if (!solution) return null;
    exprLatex = [
      renderSide([num(built.lo)], varTex),
      OPS[built.opLeft].tex,
      renderSide(built.middle, varTex),
      OPS[built.opRight].tex,
      renderSide([num(built.hi)], varTex),
    ].join(' ');
  } else {
    solution = solveSimple(built.left, built.right, built.op);
    // Вырожденный ответ («нет решений» / «любое число») — только там, где он задуман
    const degenerate = solution.kind === 'empty' || solution.kind === 'all';
    if (degenerate !== Boolean(built.degenerate)) return null;
    exprLatex =
      `${renderSide(built.left, varTex)} ${OPS[built.op].tex} ${renderSide(built.right, varTex)}`;
  }

  if (!boundsOk(solution, opts)) return null;

  return {
    exprLatex,
    resultLatex: answerTex(solution, varTex, opts),
    varLatex: varTex,
    solution,
    cat,
  };
}

// ─── Чистая функция генерации (для смешанных работ и тестов) ─────────────────
export function generateLinearInequalityVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_INEQ, ...settings };
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
    attempts: opts.integerOnly || opts.answerStyle === 'dec' ? 250 : 100,
    make: (cat) => buildQuestion(cat, rand(vars), opts),
  });
}

// ─── Хук ─────────────────────────────────────────────────────────────────────
export function useLinearInequalities() {
  const [title, setTitle] = useState('Линейные неравенства');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_INEQ });
  const [tasksData, setTasksData] = useState(null);

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateLinearInequalityVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Линейные неравенства');
    setSettings({ ...DEFAULT_SETTINGS_INEQ });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
  };
}
