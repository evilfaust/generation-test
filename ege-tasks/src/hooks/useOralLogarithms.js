import { useState, useCallback } from 'react';
import { generateByCategories } from '../utils/questionPlan';
import { isFiniteDecimalAnswer } from '../utils/oralAnswerFilter';

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ═════════════════════════════════════════════════════════════════════════════
// Группа A — Простые логарифмы
// ═════════════════════════════════════════════════════════════════════════════

// 1. log_a N, где N = a^k  →  k
function genBasicLog() {
  const POOLS = [
    { expr: '\\log_2 2',   ans: '1' },
    { expr: '\\log_2 4',   ans: '2' },
    { expr: '\\log_2 8',   ans: '3' },
    { expr: '\\log_2 16',  ans: '4' },
    { expr: '\\log_2 32',  ans: '5' },
    { expr: '\\log_2 64',  ans: '6' },
    { expr: '\\log_2 128', ans: '7' },
    { expr: '\\log_3 3',   ans: '1' },
    { expr: '\\log_3 9',   ans: '2' },
    { expr: '\\log_3 27',  ans: '3' },
    { expr: '\\log_3 81',  ans: '4' },
    { expr: '\\log_3 243', ans: '5' },
    { expr: '\\log_4 16',  ans: '2' },
    { expr: '\\log_4 64',  ans: '3' },
    { expr: '\\log_4 256', ans: '4' },
    { expr: '\\log_5 5',   ans: '1' },
    { expr: '\\log_5 25',  ans: '2' },
    { expr: '\\log_5 125', ans: '3' },
    { expr: '\\log_5 625', ans: '4' },
    { expr: '\\log_6 36',  ans: '2' },
    { expr: '\\log_7 49',  ans: '2' },
    { expr: '\\log_7 343', ans: '3' },
    { expr: '\\log_8 64',  ans: '2' },
    { expr: '\\log_8 512', ans: '3' },
    { expr: '\\log_{11} 121', ans: '2' },
    { expr: '\\log_{13} 169', ans: '2' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 2. log_a (1/N), где N = a^k  →  -k
function genLogReciprocal() {
  const POOLS = [
    { expr: '\\log_2 \\dfrac{1}{2}',   ans: '-1' },
    { expr: '\\log_2 \\dfrac{1}{4}',   ans: '-2' },
    { expr: '\\log_2 \\dfrac{1}{8}',   ans: '-3' },
    { expr: '\\log_2 \\dfrac{1}{16}',  ans: '-4' },
    { expr: '\\log_2 \\dfrac{1}{32}',  ans: '-5' },
    { expr: '\\log_3 \\dfrac{1}{3}',   ans: '-1' },
    { expr: '\\log_3 \\dfrac{1}{9}',   ans: '-2' },
    { expr: '\\log_3 \\dfrac{1}{27}',  ans: '-3' },
    { expr: '\\log_3 \\dfrac{1}{81}',  ans: '-4' },
    { expr: '\\log_5 \\dfrac{1}{5}',   ans: '-1' },
    { expr: '\\log_5 \\dfrac{1}{25}',  ans: '-2' },
    { expr: '\\log_5 \\dfrac{1}{125}', ans: '-3' },
    { expr: '\\log_4 \\dfrac{1}{16}',  ans: '-2' },
    { expr: '\\log_4 \\dfrac{1}{64}',  ans: '-3' },
    { expr: '\\log_7 \\dfrac{1}{49}',  ans: '-2' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 3. log_a 1 = 0
function genLogOne() {
  const BASES = [2, 3, 4, 5, 6, 7, 8, 10, 11, 13];
  const a = rand(BASES);
  return { exprLatex: `\\log_{${a}} 1`, resultLatex: '0' };
}

// 4. log_a (√a, ∛a, корни) — дробный ответ
function genLogOfRoot() {
  const POOLS = [
    { expr: '\\log_3 \\sqrt{3}',       ans: '0{,}5' },
    { expr: '\\log_2 \\sqrt{2}',       ans: '0{,}5' },
    { expr: '\\log_5 \\sqrt{5}',       ans: '0{,}5' },
    { expr: '\\log_7 \\sqrt{7}',       ans: '0{,}5' },
    { expr: '\\log_2 \\sqrt[3]{2}',    ans: '\\dfrac{1}{3}' },
    { expr: '\\log_3 \\sqrt[3]{3}',    ans: '\\dfrac{1}{3}' },
    { expr: '\\log_2 \\sqrt[4]{2}',    ans: '0{,}25' },
    { expr: '\\log_5 \\sqrt[3]{5}',    ans: '\\dfrac{1}{3}' },
    { expr: '\\log_3 \\sqrt[4]{3}',    ans: '0{,}25' },
    { expr: '\\log_2 \\sqrt{8}',       ans: '1{,}5' },
    { expr: '\\log_3 \\sqrt{27}',      ans: '1{,}5' },
    { expr: '\\log_2 \\sqrt{32}',      ans: '2{,}5' },
    { expr: '\\log_5 \\sqrt{125}',     ans: '1{,}5' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 5. lg (десятичные)
function genLgPower() {
  const POOLS = [
    { expr: '\\lg 10',          ans: '1'  },
    { expr: '\\lg 100',         ans: '2'  },
    { expr: '\\lg 1000',        ans: '3'  },
    { expr: '\\lg 10000',       ans: '4'  },
    { expr: '\\lg 100000',      ans: '5'  },
    { expr: '\\lg 10^3',        ans: '3'  },
    { expr: '\\lg 10^5',        ans: '5'  },
    { expr: '\\lg 10^7',        ans: '7'  },
    { expr: '\\lg 10^{-2}',     ans: '-2' },
    { expr: '\\lg \\dfrac{1}{10}',    ans: '-1' },
    { expr: '\\lg \\dfrac{1}{100}',   ans: '-2' },
    { expr: '\\lg \\dfrac{1}{1000}',  ans: '-3' },
    { expr: '\\lg \\sqrt{10}',  ans: '0{,}5' },
    { expr: '\\lg 1',           ans: '0'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// ═════════════════════════════════════════════════════════════════════════════
// Группа B — Тождества
// ═════════════════════════════════════════════════════════════════════════════

// 6. a^{log_a b} = b
function genBasicIdentity() {
  const POOLS = [
    { expr: '2^{\\log_2 5}',     ans: '5'  },
    { expr: '2^{\\log_2 7}',     ans: '7'  },
    { expr: '3^{\\log_3 4}',     ans: '4'  },
    { expr: '3^{\\log_3 8}',     ans: '8'  },
    { expr: '5^{\\log_5 11}',    ans: '11' },
    { expr: '5^{\\log_5 7}',     ans: '7'  },
    { expr: '6^{\\log_6 13}',    ans: '13' },
    { expr: '7^{\\log_7 12}',    ans: '12' },
    { expr: '9^{\\log_9 7}',     ans: '7'  },
    { expr: '10^{\\lg 6}',       ans: '6'  },
    { expr: '10^{\\lg 25}',      ans: '25' },
    { expr: '4^{\\log_4 9}',     ans: '9'  },
    { expr: '8^{\\log_8 17}',    ans: '17' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 7. Сложные тождества: a^{k·log_a b} = b^k, c^{log_a b} где упрощается
function genComplexIdentity() {
  const POOLS = [
    { expr: '6^{\\frac{1}{2}\\log_6 64}',   ans: '8'  },   // 64^(1/2) = 8
    { expr: '2^{\\frac{1}{2}\\log_2 36}',   ans: '6'  },   // 36^(1/2) = 6
    { expr: '3^{\\frac{1}{2}\\log_3 25}',   ans: '5'  },   // 25^(1/2) = 5
    { expr: '5^{\\frac{1}{2}\\log_5 49}',   ans: '7'  },
    { expr: '7^{\\frac{1}{2}\\log_7 81}',   ans: '9'  },
    { expr: '2^{2\\log_2 3}',                ans: '9'  },   // 3² = 9
    { expr: '3^{2\\log_3 5}',                ans: '25' },
    { expr: '5^{2\\log_5 2}',                ans: '4'  },
    { expr: '9^{\\lg 10}',                   ans: '9'  },   // lg 10 = 1
    { expr: '4^{\\lg 10}',                   ans: '4'  },
    { expr: '7^{\\lg 10}',                   ans: '7'  },
    { expr: '2^{\\frac{1}{3}\\log_2 27}',   ans: '3'  },   // 27^(1/3) = 3
    { expr: '3^{\\frac{1}{3}\\log_3 8}',    ans: '2'  },
    { expr: '5^{\\frac{1}{3}\\log_5 125}',  ans: '5'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 8. log_a a^k = k (включая отрицательные и дробные)
function genLogOfSameBasePower() {
  const POOLS = [
    { expr: '\\log_4 4^4',         ans: '4'    },
    { expr: '\\log_4 4^{-8}',      ans: '-8'   },
    { expr: '\\log_3 3^5',         ans: '5'    },
    { expr: '\\log_3 3^{-2}',      ans: '-2'   },
    { expr: '\\log_2 2^{10}',      ans: '10'   },
    { expr: '\\log_2 2^{-5}',      ans: '-5'   },
    { expr: '\\log_5 5^7',         ans: '7'    },
    { expr: '\\log_5 5^{-3}',      ans: '-3'   },
    { expr: '\\log_7 7^4',         ans: '4'    },
    { expr: '\\log_2 2^{\\frac{1}{2}}', ans: '0{,}5'        },
    { expr: '\\log_3 3^{\\frac{1}{3}}', ans: '\\dfrac{1}{3}' },
    { expr: '\\lg 10^4',           ans: '4'    },
    { expr: '\\lg 10^{-3}',        ans: '-3'   },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// ═════════════════════════════════════════════════════════════════════════════
// Группа C — Суммы и разности
// ═════════════════════════════════════════════════════════════════════════════

// 9. log_a x + log_a y = log_a(xy)  где xy — степень a
function genLogSum() {
  const POOLS = [
    { expr: '\\log_2 4 + \\log_2 2',     ans: '3' },   // log_2 8 = 3
    { expr: '\\log_2 2 + \\log_2 8',     ans: '4' },
    { expr: '\\log_2 8 + \\log_2 4',     ans: '5' },
    { expr: '\\log_3 9 + \\log_3 3',     ans: '3' },   // log_3 27
    { expr: '\\log_3 3 + \\log_3 27',    ans: '4' },
    { expr: '\\log_5 5 + \\log_5 25',    ans: '3' },
    { expr: '\\log_5 25 + \\log_5 25',   ans: '4' },
    { expr: '\\log_2 32 + \\log_2 2',    ans: '6' },
    { expr: '\\log_2 16 + \\log_2 4',    ans: '6' },
    { expr: '\\log_3 27 + \\log_3 9',    ans: '5' },
    { expr: '\\log_4 4 + \\log_4 16',    ans: '3' },
    { expr: '\\log_7 7 + \\log_7 49',    ans: '3' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 10. log_a x - log_a y = log_a(x/y)  где x/y — степень a
function genLogDiff() {
  const POOLS = [
    { expr: '\\log_5 75 - \\log_5 3',    ans: '2' },   // log_5 25
    { expr: '\\log_2 64 - \\log_2 8',    ans: '3' },   // log_2 8 = 3
    { expr: '\\log_3 9 - \\log_3 3',     ans: '1' },
    { expr: '\\log_3 27 - \\log_3 9',    ans: '1' },
    { expr: '\\log_3 81 - \\log_3 9',    ans: '2' },
    { expr: '\\log_2 16 - \\log_2 2',    ans: '3' },
    { expr: '\\log_2 32 - \\log_2 2',    ans: '4' },
    { expr: '\\log_2 64 - \\log_2 4',    ans: '4' },
    { expr: '\\log_5 125 - \\log_5 5',   ans: '2' },
    { expr: '\\log_5 625 - \\log_5 25',  ans: '2' },
    { expr: '\\log_4 64 - \\log_4 4',    ans: '2' },
    { expr: '\\log_2 100 - \\log_2 25',  ans: '2' },   // log_2 4 = 2
    { expr: '\\log_3 36 - \\log_3 4',    ans: '2' },   // log_3 9 = 2
    { expr: '\\log_5 50 - \\log_5 2',    ans: '2' },   // log_5 25 = 2
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 11. lg + lg / lg - lg
function genLgSumDiff() {
  const POOLS = [
    { expr: '\\lg 5 + \\lg 2',           ans: '1' },   // lg 10
    { expr: '\\lg 4 + \\lg 25',          ans: '2' },   // lg 100
    { expr: '\\lg 2 + \\lg 50',          ans: '2' },
    { expr: '\\lg 5 + \\lg 20',          ans: '2' },
    { expr: '\\lg 8 + \\lg 125',         ans: '3' },   // lg 1000
    { expr: '\\lg 25 + \\lg 4',          ans: '2' },
    { expr: '\\lg 50 - \\lg 5',          ans: '1' },   // lg 10
    { expr: '\\lg 500 - \\lg 5',         ans: '2' },
    { expr: '\\lg 200 - \\lg 2',         ans: '2' },
    { expr: '\\lg 7000 - \\lg 7',        ans: '3' },
    { expr: '\\lg 2 + \\lg 5',           ans: '1' },
    { expr: '\\lg 40 - \\lg 4',          ans: '1' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// ═════════════════════════════════════════════════════════════════════════════
// Группа D — Сложные
// ═════════════════════════════════════════════════════════════════════════════

// 12. Смена основания: log_{a^k} a^m = m/k
function genChangeBase() {
  const POOLS = [
    { expr: '\\log_9 27',     ans: '\\dfrac{3}{2}' },   // log_(3²) 3³ = 3/2
    { expr: '\\log_4 8',      ans: '\\dfrac{3}{2}' },   // log_(2²) 2³
    { expr: '\\log_4 2',      ans: '0{,}5'         },   // log_(2²) 2¹
    { expr: '\\log_8 2',      ans: '\\dfrac{1}{3}' },
    { expr: '\\log_8 4',      ans: '\\dfrac{2}{3}' },
    { expr: '\\log_8 16',     ans: '\\dfrac{4}{3}' },
    { expr: '\\log_9 3',      ans: '0{,}5'         },
    { expr: '\\log_9 81',     ans: '2'             },
    { expr: '\\log_{16} 4',   ans: '0{,}5'         },
    { expr: '\\log_{16} 8',   ans: '\\dfrac{3}{4}' },
    { expr: '\\log_{16} 2',   ans: '0{,}25'        },
    { expr: '\\log_{25} 5',   ans: '0{,}5'         },
    { expr: '\\log_{25} 125', ans: '1{,}5'         },
    { expr: '\\log_{27} 9',   ans: '\\dfrac{2}{3}' },
    { expr: '\\log_{27} 3',   ans: '\\dfrac{1}{3}' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 13. Вложенный логарифм: log_a (log_b N)
function genNestedLog() {
  const POOLS = [
    { expr: '\\log_3 \\log_{10} 1000',  ans: '1' },   // log_3 3 = 1
    { expr: '\\log_5 \\log_6 6',        ans: '0' },   // log_5 1 = 0
    { expr: '\\log_2 \\log_3 9',        ans: '1' },   // log_2 2 = 1
    { expr: '\\log_2 \\log_3 81',       ans: '2' },   // log_2 4 = 2
    { expr: '\\log_3 \\log_2 8',        ans: '1' },
    { expr: '\\log_5 \\log_2 32',       ans: '1' },   // log_5 5 = 1
    { expr: '\\log_2 \\log_5 625',      ans: '2' },   // log_2 4 = 2
    { expr: '\\log_4 \\log_2 16',       ans: '1' },   // log_4 4 = 1
    { expr: '\\log_3 \\log_4 64',       ans: '1' },
    { expr: '\\log_2 \\log_{10} 10000', ans: '2' },   // log_2 4 = 2
    { expr: '\\log_7 \\log_3 3',        ans: '0' },
    { expr: '\\log_3 \\log_5 125',      ans: '1' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 14. Отношение логарифмов: lg a / lg b  где b = a^k
function genLogRatio() {
  const POOLS = [
    { expr: '\\dfrac{\\lg 5}{\\lg 25}',     ans: '0{,}5' },
    { expr: '\\dfrac{\\lg 2}{\\lg 8}',      ans: '\\dfrac{1}{3}' },
    { expr: '\\dfrac{\\lg 2}{\\lg 4}',      ans: '0{,}5' },
    { expr: '\\dfrac{\\lg 3}{\\lg 9}',      ans: '0{,}5' },
    { expr: '\\dfrac{\\lg 3}{\\lg 27}',     ans: '\\dfrac{1}{3}' },
    { expr: '\\dfrac{\\lg 7}{\\lg 49}',     ans: '0{,}5' },
    { expr: '\\dfrac{\\lg 16}{\\lg 2}',     ans: '4' },
    { expr: '\\dfrac{\\lg 27}{\\lg 3}',     ans: '3' },
    { expr: '\\dfrac{\\lg 125}{\\lg 5}',    ans: '3' },
    { expr: '\\dfrac{\\lg 64}{\\lg 4}',     ans: '3' },
    { expr: '\\dfrac{\\lg 81}{\\lg 9}',     ans: '2' },
    { expr: '\\dfrac{\\log_2 16}{\\log_2 4}', ans: '2' },
    { expr: '\\dfrac{\\log_3 81}{\\log_3 27}', ans: '\\dfrac{4}{3}' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// ─── Маппинг ─────────────────────────────────────────────────────────────────
const GENERATORS_LOG = {
  basicLog:              genBasicLog,
  logReciprocal:         genLogReciprocal,
  logOne:                genLogOne,
  logOfRoot:             genLogOfRoot,
  lgPower:               genLgPower,
  basicIdentity:         genBasicIdentity,
  complexIdentity:       genComplexIdentity,
  logOfSameBasePower:    genLogOfSameBasePower,
  logSum:                genLogSum,
  logDiff:               genLogDiff,
  lgSumDiff:             genLgSumDiff,
  changeBase:            genChangeBase,
  nestedLog:             genNestedLog,
  logRatio:              genLogRatio,
};

export const CATEGORY_LABELS_LOG = {
  basicLog:              'log_a N (целое N)',
  logReciprocal:         'log_a (1/N)',
  logOne:                'log_a 1 = 0',
  logOfRoot:             'Логарифм корня',
  lgPower:               'lg от степеней 10',
  basicIdentity:         'a^{log_a b} = b',
  complexIdentity:       'a^{k·log_a b}',
  logOfSameBasePower:    'log_a a^k',
  logSum:                'log_a x + log_a y',
  logDiff:               'log_a x − log_a y',
  lgSumDiff:             'lg x ± lg y',
  changeBase:            'log_{a^k} a^m',
  nestedLog:             'Вложенный логарифм',
  logRatio:              'Отношение логарифмов',
};

export const DEFAULT_SETTINGS_LOG = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  decimalOnly:    false,
  categories: {
    basicLog:           true,
    logReciprocal:      true,
    logOne:             true,
    logOfRoot:          true,
    lgPower:            true,
    basicIdentity:      true,
    complexIdentity:    true,
    logOfSameBasePower: true,
    logSum:             true,
    logDiff:            true,
    lgSumDiff:          true,
    changeBase:         true,
    nestedLog:          true,
    logRatio:           true,
  },
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateLogarithmsVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_LOG, ...settings };
  const { decimalOnly } = s;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS_LOG[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: decimalOnly ? 300 : 80,
    make: (cat) => {
      const q = GENERATORS_LOG[cat]();
      if (!q) return null;
      if (decimalOnly && !isFiniteDecimalAnswer(q.resultLatex)) return null;
      return { ...q, cat };
    },
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralLogarithms() {
  const [title, setTitle]         = useState('Устный счёт: логарифмы');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_LOG });
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
    const variants = generateLogarithmsVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт: логарифмы');
    setSettings({ ...DEFAULT_SETTINGS_LOG });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
  };
}
