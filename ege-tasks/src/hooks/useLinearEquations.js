import { useState, useCallback } from 'react';

/**
 * Генератор линейных уравнений (раздел «Уравнения»).
 *
 * Уравнение строится не строкой, а маленьким деревом узлов (см. `num`/`vr`/
 * `mul`/`dvd`): по одному и тому же дереву считаются и LaTeX, и коэффициенты
 * приведённой формы `a·x + b = c·x + d`. Поэтому ответ невозможно рассинхронить
 * с условием — корень всегда вычисляется из того же дерева, что и напечатано.
 */

import {
  rat, R1, negR, addR, subR, mulR, divR, isZero, toNum,
  niceDecimal, decTex, rand, randInt, chance,
  num, vr, mul, dvd, linearOfSide, renderSide, eq,
  INT_COEFS, ROOTS_INT, ROOTS_SMALL, DEC_COEFS, ROOTS_DEC, FRAC_DENS,
  coprimeNumerators, randFrac,
} from '../utils/linearExpr';
import {
  formBrackets, formBracketsBoth, formExpandTwo,
  formFracDenom, formFracTwoDen, formFracBothSides, formDegenerate,
} from '../utils/linearForms';
import { generateByCategories } from '../utils/questionPlan';
import { useApplySheet } from './useApplySheet';

// ─── Генераторы категорий ────────────────────────────────────────────────────

// 3x = 18 — целый коэффициент, целый корень
function genIntCoef() {
  const a = rand(INT_COEFS);
  const x = rand(ROOTS_INT);
  return eq([vr(rat(a))], [num(rat(a * x))]);
}

// 2x = 5 — целый коэффициент, дробный корень
function genIntFracAnswer() {
  const a = rand([2, 3, 4, 5, 6, 7, 8, 9]);
  const b = randInt(1, 20);
  if (b % a === 0) return null;
  return eq([vr(rat(a))], [num(rat(b))]);
}

// 1,2x = 2,4 — десятичный коэффициент
function genDecCoef() {
  const k = rand(DEC_COEFS);
  const x = chance(0.65) ? rat(rand(ROOTS_SMALL)) : rand(ROOTS_DEC);
  const b = mulR(k, x);
  if (!niceDecimal(b, 3)) return null;
  return eq([vr(k, 'dec')], [num(b, 'dec')], 'dec');
}

// (2/3)x = 5 — обыкновенная дробь как коэффициент
function genFracCoef() {
  const d = rand(FRAC_DENS);
  const n = chance(0.4) ? 1 : rand(coprimeNumerators(d));
  const k = rat(n, d);
  const b = randInt(1, 12);
  return eq([vr(k)], [num(rat(b))]);
}

// 9y = 2/3 — дробь в правой части
function genFracRhs() {
  const q = rand([2, 3, 4, 5, 6]);
  const a = rand([2, 3, 4, 5, 6, 9].filter(v => v * q <= 12 || v % q === 0));
  if (!a) return null;
  const p = rand(coprimeNumerators(q).concat(q + 1));
  return eq([vr(rat(a))], [num(rat(p, q))]);
}

// 64 = 8x — число слева
function genSwapped() {
  const base = rand([genIntCoef, genIntCoef, genDecCoef, genNegNumbers, genFracCoef])();
  if (!base) return null;
  return eq(base.right, base.left, base.prefer);
}

// -1,3y = 2,6 / 3x = -18 / -(3/4)x = 6 — отрицательные числа
function genNegNumbers() {
  const kind = rand(['negCoefDec', 'negRhs', 'bothNeg', 'negFrac']);

  if (kind === 'negCoefDec') {
    const k = negR(rand(DEC_COEFS));
    const x = chance(0.7) ? rat(rand(ROOTS_SMALL)) : rand(ROOTS_DEC);
    const b = mulR(k, x);
    if (!niceDecimal(b, 3)) return null;
    return eq([vr(k, 'dec')], [num(b, 'dec')], 'dec');
  }

  if (kind === 'negRhs') {
    const a = rand(INT_COEFS);
    const x = -rand(ROOTS_INT);
    return eq([vr(rat(a))], [num(rat(a * x))]);
  }

  if (kind === 'bothNeg') {
    const a = -rand(INT_COEFS);
    const x = -rand(ROOTS_SMALL);
    return eq([vr(rat(a))], [num(rat(a * x))]);
  }

  const k = negR(randFrac());
  const b = randInt(1, 12) * (chance(0.5) ? -1 : 1);
  return eq([vr(k)], [num(rat(b))]);
}

// 0,2x + 0,7x = 0,18 — приведение подобных (целые и десятичные)
function genLikeTerms() {
  const useDec = chance(0.6);
  const prefer = useDec ? 'dec' : 'frac';

  const k1 = useDec
    ? (chance(0.3) ? R1 : rand(DEC_COEFS))
    : rat(rand([1, 1, 2, 3, 4, 5, 6]));
  const k2raw = useDec
    ? rand(DEC_COEFS)
    : rat(rand([1, 2, 3, 4, 5, 7]));

  const k2 = chance(0.35) ? negR(k2raw) : k2raw;
  const sum = addR(k1, k2);
  if (isZero(sum)) return null;

  const x = useDec
    ? (chance(0.6) ? rat(rand(ROOTS_SMALL)) : rand(ROOTS_DEC))
    : rat(rand(ROOTS_SMALL));
  const c = mulR(sum, x);
  if (useDec && !niceDecimal(c, 3)) return null;

  return eq([vr(k1, prefer), vr(k2, prefer)], [num(c, prefer)], prefer);
}

// (2/3)x + (1/6)x = 5 — подобные с обыкновенными дробями
function genLikeTermsFrac() {
  const d1 = rand([2, 3, 4, 5, 6, 8]);
  const d2 = rand([2, 3, 4, 6, 8, 12]);
  const k1 = chance(0.25) ? R1 : rat(rand(coprimeNumerators(d1)), d1);
  const k2raw = rat(rand(coprimeNumerators(d2)), d2);
  const k2 = chance(0.4) ? negR(k2raw) : k2raw;
  const sum = addR(k1, k2);
  if (isZero(sum) || sum.d > 12) return null;

  // Правую часть считаем от корня, иначе ответы выходят вида 200/11
  const x = rat(rand(ROOTS_SMALL) * (chance(0.2) ? -1 : 1));
  const c = mulR(sum, x);
  if (c.d > 6 || Math.abs(toNum(c)) > 60) return null;
  return eq([vr(k1), vr(k2)], [num(c)]);
}

// 5x - 7 = 8 — двухшаговое уравнение
function genTwoStep() {
  const useDec = chance(0.4);
  const prefer = useDec ? 'dec' : 'frac';
  const a = useDec ? rand(DEC_COEFS) : rat(rand(INT_COEFS) * (chance(0.25) ? -1 : 1));
  const x = useDec
    ? (chance(0.6) ? rat(rand(ROOTS_SMALL)) : rand(ROOTS_DEC))
    : rat(rand(ROOTS_SMALL) * (chance(0.25) ? -1 : 1));
  const b = useDec ? rand(DEC_COEFS.concat([rat(3), rat(5)])) : rat(randInt(1, 15));
  const bSigned = chance(0.5) ? negR(b) : b;
  const c = addR(mulR(a, x), bSigned);
  if (useDec && !niceDecimal(c, 3)) return null;

  // Иногда меняем слагаемые местами: -7 + 5x = 8
  const left = chance(0.25)
    ? [num(bSigned, prefer), vr(a, prefer)]
    : [vr(a, prefer), num(bSigned, prefer)];
  return eq(left, [num(c, prefer)], prefer);
}

// 5x - 3 = 2x + 9 — переменная в обеих частях
function genBothSides() {
  const useDec = chance(0.3);
  const prefer = useDec ? 'dec' : 'frac';
  const a = useDec ? rand(DEC_COEFS) : rat(rand([2, 3, 4, 5, 6, 7, 8, 9, 10]));
  let c = useDec ? rand(DEC_COEFS) : rat(rand([1, 2, 3, 4, 5, 6]) * (chance(0.3) ? -1 : 1));
  if (isZero(subR(a, c))) return null;

  const x = useDec
    ? (chance(0.7) ? rat(rand(ROOTS_SMALL)) : rand(ROOTS_DEC))
    : rat(rand(ROOTS_SMALL) * (chance(0.2) ? -1 : 1));
  const b = useDec ? rand(DEC_COEFS.concat([rat(2), rat(4)])) : rat(randInt(1, 12));
  const bSigned = chance(0.5) ? negR(b) : b;

  // d подбираем так, чтобы корень был именно x: a·x + b = c·x + d
  const d = subR(addR(mulR(a, x), bSigned), mulR(c, x));
  if (useDec && !niceDecimal(d, 3)) return null;
  if (Math.abs(toNum(d)) > 200) return null;

  return eq(
    [vr(a, prefer), num(bSigned, prefer)],
    [vr(c, prefer), num(d, prefer)],
    prefer,
  );
}

// ─── Блок 3: скобки ──────────────────────────────────────────────────────────
// Сами выражения строит `utils/linearForms` — те же формы, что в неравенствах;
// категории здесь только ставят между сторонами знак «=».

const fromForm = (form, args) => {
  const f = form(args);
  return f && eq(f.left, f.right);
};

const genBrackets     = () => fromForm(formBrackets);
const genBracketsBoth = () => fromForm(formBracketsBoth);
const genExpandTwo    = () => fromForm(formExpandTwo);

// ─── Блок 4: дроби ───────────────────────────────────────────────────────────
const genFracDenom     = () => fromForm(formFracDenom);
const genFracTwoDen    = () => fromForm(formFracTwoDen);
const genFracBothSides = () => fromForm(formFracBothSides);

// ─── Блок 5: особые случаи ───────────────────────────────────────────────────
// Коэффициенты при переменной по обе стороны равны: остаётся сравнение чисел.
// Разные константы — корней нет, одинаковые — тождество, подходит любое число.
function genDegenerateEq(equalConst) {
  const f = formDegenerate({ equalConst });
  return f && { ...eq(f.left, f.right), degenerate: true };
}

const genNoSolution = () => genDegenerateEq(false);
const genAllReal    = () => genDegenerateEq(true);

// x/6 = 5/3 — пропорция
function genProportion() {
  const a = rat(rand([2, 3, 4, 5, 6, 8, 9, 10, 12]));
  const q = rand([2, 3, 4, 5, 6]);
  const right = chance(0.4)
    ? rat(rand(ROOTS_SMALL))                             // x/6 = 4
    : rat(rand(coprimeNumerators(q).concat(q + 1, q + 2, 2 * q + 1)), q);
  return eq([dvd([vr(R1)], a)], [num(right)]);
}

const GENERATORS = {
  intCoef:        genIntCoef,
  intFracAnswer:  genIntFracAnswer,
  decCoef:        genDecCoef,
  fracCoef:       genFracCoef,
  fracRhs:        genFracRhs,
  swapped:        genSwapped,
  negNumbers:     genNegNumbers,
  likeTerms:      genLikeTerms,
  likeTermsFrac:  genLikeTermsFrac,
  twoStep:        genTwoStep,
  bothSides:      genBothSides,
  brackets:       genBrackets,
  bracketsBoth:   genBracketsBoth,
  expandTwo:      genExpandTwo,
  fracDenom:      genFracDenom,
  fracTwoDen:     genFracTwoDen,
  fracBothSides:  genFracBothSides,
  proportion:     genProportion,
  noSolution:     genNoSolution,
  allReal:        genAllReal,
};

export const CATEGORY_LABELS_LINEQ = {
  intCoef:       'Целый коэффициент: 3x = 18',
  intFracAnswer: 'Дробный корень: 2x = 5',
  decCoef:       'Десятичный коэффициент: 1,2x = 2,4',
  fracCoef:      'Дробь как коэффициент: ⅔x = 5',
  fracRhs:       'Дробь справа: 9y = ⅔',
  swapped:       'Число слева: 64 = 8x',
  negNumbers:    'Отрицательные числа: −1,3y = 2,6',
  likeTerms:     'Подобные слагаемые: 0,2x + 0,7x = 0,18',
  likeTermsFrac: 'Подобные с дробями: ⅔x + ⅙x = 5',
  twoStep:       'Два шага: 5x − 7 = 8',
  bothSides:     'Переменная в обеих частях: 5x − 3 = 2x + 9',
  brackets:      'Скобки: 2(x − 3) = 10',
  bracketsBoth:  'Скобки с двух сторон: 3(x − 1) = 2(x + 4)',
  expandTwo:     'Две скобки: 2(x − 1) − 3(x + 2) = 4',
  fracDenom:     'Дробь с переменной: (x + 1)/3 = 2',
  fracTwoDen:    'Разные знаменатели: x/2 − x/3 = 1',
  fracBothSides: 'Дроби с двух сторон: (2x − 1)/4 = (x + 3)/2',
  proportion:    'Пропорция: x/6 = 5/3',
  noSolution:    'Нет корней: 2(x + 1) = 2x + 5',
  allReal:       'Любое число: 3(x − 2) = 3x − 6',
};

// Блоки по нарастанию сложности — они же порядок чекбоксов в UI
export const CATEGORY_GROUPS_LINEQ = [
  {
    label: 'Блок 1. Простейшие (устно)',
    keys: ['intCoef', 'intFracAnswer', 'decCoef', 'fracCoef', 'fracRhs', 'swapped', 'negNumbers'],
  },
  {
    label: 'Блок 2. Два шага и подобные',
    keys: ['likeTerms', 'likeTermsFrac', 'twoStep', 'bothSides'],
  },
  {
    label: 'Блок 3. Скобки',
    keys: ['brackets', 'bracketsBoth', 'expandTwo'],
  },
  {
    label: 'Блок 4. Дроби',
    keys: ['fracDenom', 'fracTwoDen', 'fracBothSides', 'proportion'],
  },
  {
    label: 'Блок 5. Особые случаи',
    keys: ['noSolution', 'allReal'],
  },
];

// ─── Переменные ──────────────────────────────────────────────────────────────
const VAR_POOLS = {
  x:     ['x'],
  xy:    ['x', 'y'],
  mixed: ['x', 'y', 'a', 'b', 'z', 't', 'm', 'n'],
};

// ─── Настройки по умолчанию ──────────────────────────────────────────────────
export const DEFAULT_SETTINGS_LINEQ = {
  variantsCount:  4,
  questionsCount: 10,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  showWorkSpace:  false,
  columnsCount:   2,
  fontSize:       's',
  answerStyle:    'auto',   // auto | frac | dec — вид дробного корня
  integerOnly:    false,    // только целые корни
  varsMode:       'xy',     // x | xy | mixed
  categories: {
    intCoef:       true,
    intFracAnswer: true,
    decCoef:       true,
    fracCoef:      true,
    fracRhs:       true,
    swapped:       true,
    negNumbers:    true,
    likeTerms:     true,
    likeTermsFrac: true,
    twoStep:       true,
    bothSides:     true,
    brackets:      true,
    bracketsBoth:  true,
    expandTwo:     true,
    fracDenom:     false,
    fracTwoDen:    false,
    fracBothSides: false,
    proportion:    false,
    noSolution:    false,
    allReal:       false,
  },
};

// Корень «красивый»: знаменатель ≤ 12 и модуль ≤ 100
function isNiceRoot(x) {
  return x && x.d <= 12 && Math.abs(toNum(x)) <= 100;
}

function fmtRoot(x, answerStyle) {
  if (x.d === 1) return String(x.n);
  // В авто-режиме десятичная запись уместна, пока она короткая: 12,8 — да,
  // 5,625 — уже хуже обыкновенной дроби.
  if (answerStyle === 'dec' || (answerStyle !== 'frac' && niceDecimal(x, 2))) {
    const s = decTex(x);
    if (s) return s;
  }
  return x.n < 0 ? `-\\dfrac{${-x.n}}{${x.d}}` : `\\dfrac{${x.n}}{${x.d}}`;
}

/**
 * Одно задание: строит уравнение категории, решает его и проверяет ограничения.
 * Возвращает null, если уравнение не подошло (вырожденное или некрасивый корень).
 */
function buildQuestion(cat, varTex, { answerStyle, integerOnly }) {
  const gen = GENERATORS[cat];
  if (!gen) return null;
  const built = gen();
  if (!built) return null;

  const L = linearOfSide(built.left);
  const Rt = linearOfSide(built.right);
  const a = subR(L.a, Rt.a);          // коэффициент при переменной
  const b = subR(Rt.b, L.b);          // свободный член справа
  const exprLatex =
    `${renderSide(built.left, varTex)} = ${renderSide(built.right, varTex)}`;

  // 0·x = b — корней нет либо подходит любое число. Такой ответ допустим
  // только там, где он задуман (блок «особые случаи»).
  if (isZero(a)) {
    if (!built.degenerate) return null;
    const solution = isZero(b) ? { kind: 'all' } : { kind: 'empty' };
    return {
      exprLatex,
      resultLatex: solution.kind === 'all' ? `${varTex} \\in \\mathbb{R}` : '\\varnothing',
      varLatex: varTex,
      // В листе учителя «x = ∅» читалось бы неверно — печатаем только ответ.
      // В листе ученика подсказка «x =» остаётся у всех заданий одинаковой,
      // иначе особые случаи выдавали бы себя ещё до решения.
      hideKeyPrompt: true,
      solution,
      cat,
    };
  }
  if (built.degenerate) return null;

  const x = divR(b, a);
  if (!isNiceRoot(x)) return null;
  if (integerOnly && x.d !== 1) return null;
  if (answerStyle === 'dec' && !niceDecimal(x, 3)) return null;

  return {
    exprLatex,
    resultLatex: fmtRoot(x, answerStyle),
    varLatex: varTex,
    solution: { kind: 'root', value: x },
    cat,
  };
}

// ─── Чистая функция генерации (для смешанных работ и тестов) ─────────────────
export function generateLinearEquationVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_LINEQ, ...settings };
  const { integerOnly, varsMode } = s;
  // Смешанная работа передаёт общий для всех разделов флаг decimalOnly
  const answerStyle = s.decimalOnly ? 'dec' : s.answerStyle;
  const vars = VAR_POOLS[varsMode] || VAR_POOLS.xy;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: integerOnly || answerStyle === 'dec' ? 200 : 80,
    make: (cat) => buildQuestion(cat, rand(vars), { answerStyle, integerOnly }),
  });
}

// ─── Хук ─────────────────────────────────────────────────────────────────────
export function useLinearEquations() {
  const [title, setTitle] = useState('Линейные уравнения');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_LINEQ });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_LINEQ });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateLinearEquationVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Линейные уравнения');
    setSettings({ ...DEFAULT_SETTINGS_LINEQ });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
