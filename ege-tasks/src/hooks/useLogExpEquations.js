import { useState, useCallback } from 'react';
import { generateByCategories } from '../utils/questionPlan';
import { isFiniteDecimalAnswer } from '../utils/oralAnswerFilter';
import { useApplySheet } from './useApplySheet';

// ─── Вспомогательные функции ──────────────────────────────────────────────────

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Генераторы по категориям ─────────────────────────────────────────────────
// Каждый возвращает { exprLatex, resultLatex }

// 1. Простые степени: a^x = a^n
function genBasicExp() {
  const POOLS = [
    { expr: '2^x = 2',    ans: '1' },
    { expr: '2^x = 4',    ans: '2' },
    { expr: '2^x = 8',    ans: '3' },
    { expr: '2^x = 16',   ans: '4' },
    { expr: '2^x = 32',   ans: '5' },
    { expr: '2^x = 1',    ans: '0' },
    { expr: '3^x = 3',    ans: '1' },
    { expr: '3^x = 9',    ans: '2' },
    { expr: '3^x = 27',   ans: '3' },
    { expr: '3^x = 81',   ans: '4' },
    { expr: '3^x = 1',    ans: '0' },
    { expr: '4^x = 4',    ans: '1' },
    { expr: '4^x = 16',   ans: '2' },
    { expr: '4^x = 64',   ans: '3' },
    { expr: '5^x = 5',    ans: '1' },
    { expr: '5^x = 25',   ans: '2' },
    { expr: '5^x = 125',  ans: '3' },
    { expr: '7^x = 1',    ans: '0' },
    { expr: '7^x = 7',    ans: '1' },
    { expr: '7^x = 49',   ans: '2' },
    { expr: '7^x = 7^0',  ans: '0' },
    { expr: '2^x = \\dfrac{1}{2}',  ans: '-1' },
    { expr: '2^x = \\dfrac{1}{4}',  ans: '-2' },
    { expr: '3^x = \\dfrac{1}{3}',  ans: '-1' },
    { expr: '3^x = \\dfrac{1}{9}',  ans: '-2' },
    { expr: '5^x = \\dfrac{1}{5}',  ans: '-1' },
    { expr: '4^x = \\dfrac{1}{4}',  ans: '-1' },
    { expr: '81^x = \\dfrac{1}{3}', ans: '-\\dfrac{1}{4}' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 2. Дробные основания равны: (p/q)^x = (r/s)^x → x = 0
function genFracBaseEqual() {
  const POOLS = [
    ['\\dfrac{1}{2}', '\\dfrac{1}{4}'],
    ['\\dfrac{1}{3}', '\\dfrac{1}{8}'],
    ['\\dfrac{2}{3}', '\\dfrac{1}{3}'],
    ['\\dfrac{1}{2}', '\\dfrac{1}{3}'],
    ['\\dfrac{2}{5}', '\\dfrac{1}{5}'],
    ['\\dfrac{3}{4}', '\\dfrac{1}{4}'],
    ['\\dfrac{3}{5}', '\\dfrac{2}{5}'],
  ];
  const [f1, f2] = rand(POOLS);
  return {
    exprLatex: `\\left(${f1}\\right)^x = \\left(${f2}\\right)^x`,
    resultLatex: '0',
  };
}

// 3. Сдвиг показателя: a^(x±k) = a^n → x = n∓k
function genShiftedExp() {
  const POOLS = [
    { base: 4, shift: '-1', val: 1,   ans: '1' },
    { base: 3, shift: '-2', val: 27,  ans: '5' },
    { base: 2, shift: '+1', val: 8,   ans: '2' },
    { base: 5, shift: '-1', val: 25,  ans: '3' },
    { base: 2, shift: '+2', val: 16,  ans: '2' },
    { base: 3, shift: '+1', val: 9,   ans: '1' },
    { base: 2, shift: '-1', val: 4,   ans: '3' },
    { base: 3, shift: '-1', val: 9,   ans: '3' },
    { base: 2, shift: '+3', val: 16,  ans: '1' },
    { base: 5, shift: '+1', val: 125, ans: '2' },
    { base: 2, shift: '-2', val: 32,  ans: '7' },
    { base: 3, shift: '+2', val: 27,  ans: '1' },
  ];
  const p = rand(POOLS);
  return {
    exprLatex: `${p.base}^{x${p.shift}} = ${p.val}`,
    resultLatex: p.ans,
  };
}

// 4. Отрицательный коэффициент: a^{-kx} = aⁿ → x = -n/k
function genNegCoeffExp() {
  const POOLS = [
    { expr: '2^{-3x} = 8',  ans: '-1' },
    { expr: '3^{-2x} = 9',  ans: '-1' },
    { expr: '2^{-2x} = 4',  ans: '-1' },
    { expr: '5^{-x} = 25',  ans: '-2' },
    { expr: '2^{-x} = 8',   ans: '-3' },
    { expr: '3^{-x} = 27',  ans: '-3' },
    { expr: '2^{-x} = 32',  ans: '-5' },
    { expr: '4^{-x} = 16',  ans: '-2' },
    { expr: '2^{-x} = 4',   ans: '-2' },
    { expr: '5^{-x} = 125', ans: '-3' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 5. Произведение степеней: a^x · (a^m)^x = aⁿ
function genProductExp() {
  const POOLS = [
    { expr: '2^x \\cdot 4^x = 8',     ans: '1' },
    { expr: '2^x \\cdot 4^x = 64',    ans: '2' },
    { expr: '2^x \\cdot 4^x = 512',   ans: '3' },
    { expr: '3^x \\cdot 9^x = 27',    ans: '1' },
    { expr: '3^x \\cdot 9^x = 729',   ans: '2' },
    { expr: '2^x \\cdot 8^x = 16',    ans: '1' },
    { expr: '2^x \\cdot 8^x = 256',   ans: '2' },
    { expr: '3^x \\cdot 27^x = 81',   ans: '1' },
    { expr: '5^x \\cdot 25^x = 125',  ans: '1' },
    { expr: '6^x \\cdot 36^x = 216',  ans: '1' },
    { expr: '2^x \\cdot 16^x = 32',   ans: '1' },
    { expr: '3^x \\cdot 9^x = 19683', ans: '3' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 6. Простой логарифм: log_a x = n → x = aⁿ
function genSimpleLog() {
  const POOLS = [
    { expr: '\\log_2 x = 3',  ans: '8' },
    { expr: '\\log_2 x = 0',  ans: '1' },
    { expr: '\\log_2 x = 1',  ans: '2' },
    { expr: '\\log_2 x = 2',  ans: '4' },
    { expr: '\\log_2 x = 4',  ans: '16' },
    { expr: '\\log_2 x = 5',  ans: '32' },
    { expr: '\\log_2 x = -1', ans: '\\dfrac{1}{2}' },
    { expr: '\\log_2 x = -2', ans: '\\dfrac{1}{4}' },
    { expr: '\\log_3 x = 2',  ans: '9' },
    { expr: '\\log_3 x = 3',  ans: '27' },
    { expr: '\\log_3 x = 0',  ans: '1' },
    { expr: '\\log_3 x = 1',  ans: '3' },
    { expr: '\\log_3 x = -1', ans: '\\dfrac{1}{3}' },
    { expr: '\\log_3 x = -2', ans: '\\dfrac{1}{9}' },
    { expr: '\\log_4 x = 2',  ans: '16' },
    { expr: '\\log_4 x = 1',  ans: '4' },
    { expr: '\\log_4 x = 0',  ans: '1' },
    { expr: '\\log_4 x = -1', ans: '\\dfrac{1}{4}' },
    { expr: '\\log_5 x = 2',  ans: '25' },
    { expr: '\\log_5 x = 1',  ans: '5' },
    { expr: '\\log_5 x = 0',  ans: '1' },
    { expr: '\\log_5 x = -1', ans: '0{,}2' },
    { expr: '\\log_{10} x = 2', ans: '100' },
    { expr: '\\log_{10} x = 1', ans: '10' },
    { expr: '\\log_{10} x = 3', ans: '1000' },
    { expr: '\\log_{10} x = 0', ans: '1' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 7. Основание неизвестно: log_x a = n → x = a^(1/n)
function genLogAsBase() {
  const POOLS = [
    { expr: '\\log_x 4 = 2',   ans: '2' },
    { expr: '\\log_x 8 = 3',   ans: '2' },
    { expr: '\\log_x 9 = 2',   ans: '3' },
    { expr: '\\log_x 27 = 3',  ans: '3' },
    { expr: '\\log_x 25 = 2',  ans: '5' },
    { expr: '\\log_x 16 = 2',  ans: '4' },
    { expr: '\\log_x 64 = 3',  ans: '4' },
    { expr: '\\log_x 64 = 6',  ans: '2' },
    { expr: '\\log_x 125 = 3', ans: '5' },
    { expr: '\\log_x 144 = 2', ans: '12' },
    { expr: '\\log_x 169 = 2', ans: '13' },
    { expr: '\\log_x 243 = 5', ans: '3' },
    { expr: '\\log_x 100 = 2', ans: '10' },
    { expr: '\\log_x 49 = 2',  ans: '7' },
    { expr: '\\log_x 32 = 5',  ans: '2' },
    { expr: '\\log_x 5 = 2',   ans: '\\sqrt{5}' },
  ];
  // Фильтруем нестандартные ответы для устного счёта
  const GOOD = POOLS.filter(p => !p.ans.includes('\\sqrt'));
  const p = rand(GOOD);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 8. Логарифм с линейным аргументом: log_a(kx) = n → x = aⁿ/k
function genLogLinear() {
  const POOLS = [
    { expr: '\\log_3 3x = 2',  ans: '3' },
    { expr: '\\log_7 14x = 2', ans: '3{,}5' },
    { expr: '\\log_3 2x = 2',  ans: '4{,}5' },
    { expr: '\\log_2 4x = 4',  ans: '4' },
    { expr: '\\log_5 5x = 3',  ans: '25' },
    { expr: '\\log_2 2x = 4',  ans: '8' },
    { expr: '\\log_3 3x = 3',  ans: '9' },
    { expr: '\\log_4 4x = 2',  ans: '4' },
    { expr: '\\log_2 8x = 4',  ans: '2' },
    { expr: '\\log_5 25x = 3', ans: '5' },
    { expr: '\\log_2 2x = 3',  ans: '4' },
    { expr: '\\log_3 9x = 3',  ans: '3' },
    { expr: '\\log_2 4x = 5',  ans: '8' },
    { expr: '\\log_3 3x = 4',  ans: '27' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 9. Сумма логарифмов: log_a x + log_a b = n → x = aⁿ/b
function genLogSumConst() {
  const POOLS = [
    { expr: '\\log_2 x + \\log_2 4 = 3',  ans: '2' },
    { expr: '\\log_5 x + \\log_5 5 = 3',  ans: '25' },
    { expr: '\\log_2 x + \\log_2 2 = 4',  ans: '8' },
    { expr: '\\log_4 x + \\log_4 4 = 3',  ans: '16' },
    { expr: '\\log_2 x + \\log_2 8 = 6',  ans: '8' },
    { expr: '\\log_2 x + \\log_2 16 = 6', ans: '4' },
    { expr: '\\log_3 x + \\log_3 3 = 4',  ans: '27' },
    { expr: '\\log_2 x + \\log_2 2 = 5',  ans: '16' },
    { expr: '\\log_5 x + \\log_5 1 = 2',  ans: '25' },
    { expr: '\\log_2 x + \\log_2 1 = 4',  ans: '16' },
    { expr: '\\log_3 x + \\log_3 9 = 4',  ans: '9' },
    { expr: '\\log_2 x + \\log_2 4 = 5',  ans: '8' },
    { expr: '\\log_3 x + \\log_3 27 = 5', ans: '9' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 10. Разность логарифмов: log_a x − log_a b = n → x = b·aⁿ
function genLogDiffConst() {
  const POOLS = [
    { expr: '\\log_3 x - \\log_3 3 = 2',  ans: '27' },
    { expr: '\\log_5 x - \\log_5 25 = -1', ans: '5' },
    { expr: '\\log_4 x - \\log_4 2 = 1',  ans: '8' },
    { expr: '\\log_3 x - \\log_3 9 = 0',  ans: '9' },
    { expr: '\\log_2 x - \\log_2 2 = 2',  ans: '8' },
    { expr: '\\log_3 x - \\log_3 1 = 2',  ans: '9' },
    { expr: '\\log_5 x - \\log_5 5 = 1',  ans: '25' },
    { expr: '\\log_2 x - \\log_2 4 = 2',  ans: '16' },
    { expr: '\\log_3 x - \\log_3 3 = 3',  ans: '81' },
    { expr: '\\log_2 x - \\log_2 2 = 3',  ans: '16' },
    { expr: '\\log_5 x - \\log_5 5 = 2',  ans: '125' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 11. Число плюс логарифм: k + log_a x = n → x = a^(n−k)
function genConstPlusLog() {
  const POOLS = [
    { expr: '2 + \\log_2 x = 5',  ans: '8' },
    { expr: '1 + \\log_5 x = 3',  ans: '25' },
    { expr: '1 + \\log_3 x = 3',  ans: '9' },
    { expr: '3 + \\log_2 x = 5',  ans: '4' },
    { expr: '1 + \\log_2 x = 4',  ans: '8' },
    { expr: '2 + \\log_5 x = 4',  ans: '25' },
    { expr: '2 + \\log_3 x = 5',  ans: '27' },
    { expr: '2 + \\log_2 x = 6',  ans: '16' },
    { expr: '1 + \\log_3 x = 4',  ans: '27' },
    { expr: '1 + \\log_5 x = 2',  ans: '5' },
    { expr: '3 + \\log_3 x = 5',  ans: '9' },
    { expr: '1 + \\log_2 x = 5',  ans: '16' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 12. Дробный аргумент: log_a(x/k) = n → x = k·aⁿ
function genLogFraction() {
  const POOLS = [
    { expr: '\\log_3 \\dfrac{x}{3} = 2',  ans: '27' },
    { expr: '\\log_2 \\dfrac{x}{2} = 3',  ans: '16' },
    { expr: '\\log_2 \\dfrac{x}{4} = 3',  ans: '32' },
    { expr: '\\log_3 \\dfrac{x}{9} = 2',  ans: '81' },
    { expr: '\\log_2 \\dfrac{x}{2} = 4',  ans: '32' },
    { expr: '\\log_5 \\dfrac{x}{5} = 2',  ans: '125' },
    { expr: '\\log_3 \\dfrac{x}{3} = 3',  ans: '81' },
    { expr: '\\log_2 \\dfrac{x}{8} = 3',  ans: '64' },
    { expr: '\\log_2 \\dfrac{x}{4} = 4',  ans: '64' },
    { expr: '\\log_5 \\dfrac{x}{25} = 1', ans: '125' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 13. Логарифм правой части: log_a x = log_a b + log_a c → x = b·c
function genLogRhsSum() {
  const POOLS = [
    { expr: '\\lg x = \\lg 6 + \\lg 9',                             ans: '54' },
    { expr: '\\lg x = \\lg 5 + \\lg 4',                             ans: '20' },
    { expr: '\\lg x = \\lg 2 + \\lg 50',                            ans: '100' },
    { expr: '\\lg x = \\lg 3 + \\lg 4',                             ans: '12' },
    { expr: '\\lg x = \\lg 5 + \\lg 8',                             ans: '40' },
    { expr: '\\lg x = \\lg 7 + \\lg 3',                             ans: '21' },
    { expr: '\\lg x = \\lg 4 + \\lg 25',                            ans: '100' },
    { expr: '\\log_3 x = \\log_3 10 + \\log_3 6',                   ans: '60' },
    { expr: '\\log_7 x = \\log_7 3 + \\log_7 5',                    ans: '15' },
    { expr: '\\log_2 x = \\log_2 4 + \\log_2 8',                    ans: '32' },
    { expr: '\\log_5 x = \\log_5 5 + \\log_5 5',                    ans: '25' },
    { expr: '\\log_3 x = \\log_3 3 + \\log_3 9',                    ans: '27' },
    { expr: '\\log_2 x = \\log_2 2 + \\log_2 4',                    ans: '8' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// ─── Маппинг категорий ────────────────────────────────────────────────────────
const GENERATORS_LOGEXP = {
  basicExp:      genBasicExp,
  fracBaseEqual: genFracBaseEqual,
  shiftedExp:    genShiftedExp,
  negCoeffExp:   genNegCoeffExp,
  productExp:    genProductExp,
  simpleLog:     genSimpleLog,
  logAsBase:     genLogAsBase,
  logLinear:     genLogLinear,
  logSumConst:   genLogSumConst,
  logDiffConst:  genLogDiffConst,
  constPlusLog:  genConstPlusLog,
  logFraction:   genLogFraction,
  logRhsSum:     genLogRhsSum,
};

export const CATEGORY_LABELS_LOGEXP = {
  basicExp:      'Степень: aˣ = aⁿ',
  fracBaseEqual: 'Дробные основания: (p/q)ˣ = (r/s)ˣ',
  shiftedExp:    'Сдвиг показателя: a^(x±k) = aⁿ',
  negCoeffExp:   'Отриц. коэффициент: a^(−kx) = aⁿ',
  productExp:    'Произведение степеней: aˣ · bˣ = c',
  simpleLog:     'Простой логарифм: logₐ x = n',
  logAsBase:     'Основание: log_x a = n',
  logLinear:     'Линейный аргумент: logₐ(kx) = n',
  logSumConst:   'Сумма: logₐ x + logₐ b = n',
  logDiffConst:  'Разность: logₐ x − logₐ b = n',
  constPlusLog:  'Число + лог: k + logₐ x = n',
  logFraction:   'Дробный аргумент: logₐ(x/k) = n',
  logRhsSum:     'Сумма в правой части: logₐ x = logₐ b + logₐ c',
};

export const DEFAULT_SETTINGS_LOGEXP = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  decimalOnly:    false,
  categories: {
    basicExp:      true,
    fracBaseEqual: true,
    shiftedExp:    true,
    negCoeffExp:   true,
    productExp:    true,
    simpleLog:     true,
    logAsBase:     true,
    logLinear:     true,
    logSumConst:   true,
    logDiffConst:  true,
    constPlusLog:  true,
    logFraction:   true,
    logRhsSum:     true,
  },
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateLogExpVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_LOGEXP, ...settings };
  const { decimalOnly } = s;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS_LOGEXP[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: decimalOnly ? 300 : 80,
    make: (cat) => {
      const q = GENERATORS_LOGEXP[cat]();
      if (!q) return null;
      if (decimalOnly && !isFiniteDecimalAnswer(q.resultLatex)) return null;
      return { ...q, cat };
    },
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useLogExpEquations() {
  const [title, setTitle]         = useState('Уравнения: степени и логарифмы');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_LOGEXP });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_LOGEXP });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateLogExpVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Уравнения: степени и логарифмы');
    setSettings({ ...DEFAULT_SETTINGS_LOGEXP });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
