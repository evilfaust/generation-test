import { useState, useCallback } from 'react';
import { generateByCategories } from '../utils/questionPlan';
import { isFiniteDecimalAnswer } from '../utils/oralAnswerFilter';

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ═════════════════════════════════════════════════════════════════════════════
// Все пулы подобраны под устный счёт: внутреннее действие даёт «круглое» число
// (часто кратное 0,5 или целое), потом одно простое умножение/деление.
// ═════════════════════════════════════════════════════════════════════════════

// 1. (a + b) · c
function genSumTimes() {
  const POOLS = [
    { expr: '(3{,}1 + 3{,}4) \\cdot 3{,}8',  ans: '24{,}7' },
    { expr: '(1{,}7 + 2{,}8) \\cdot 4{,}8',  ans: '21{,}6' },
    { expr: '(2{,}3 + 3{,}7) \\cdot 2{,}5',  ans: '15'     },
    { expr: '(1{,}2 + 0{,}8) \\cdot 3{,}6',  ans: '7{,}2'  },
    { expr: '(4{,}5 + 5{,}5) \\cdot 0{,}7',  ans: '7'      },
    { expr: '(0{,}3 + 0{,}7) \\cdot 2{,}4',  ans: '2{,}4'  },
    { expr: '(2{,}5 + 2{,}5) \\cdot 1{,}8',  ans: '9'      },
    { expr: '(1{,}6 + 2{,}4) \\cdot 1{,}5',  ans: '6'      },
    { expr: '(1{,}8 + 0{,}2) \\cdot 4{,}5',  ans: '9'      },
    { expr: '(4{,}7 + 5{,}3) \\cdot 0{,}6',  ans: '6'      },
    { expr: '(2{,}4 + 0{,}6) \\cdot 1{,}5',  ans: '4{,}5'  },
    { expr: '(3{,}2 + 0{,}8) \\cdot 2{,}5',  ans: '10'     },
    { expr: '(2{,}9 + 4{,}1) \\cdot 0{,}5',  ans: '3{,}5'  },
    { expr: '(0{,}6 + 1{,}4) \\cdot 3{,}5',  ans: '7'      },
    { expr: '(1{,}9 + 3{,}1) \\cdot 1{,}2',  ans: '6'      },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 2. (a - b) · c
function genDiffTimes() {
  const POOLS = [
    { expr: '(3{,}9 - 2{,}4) \\cdot 8{,}2',  ans: '12{,}3' },
    { expr: '(5{,}7 - 3{,}2) \\cdot 1{,}6',  ans: '4'      },
    { expr: '(8{,}3 - 6{,}8) \\cdot 4',       ans: '6'      },
    { expr: '(4{,}6 - 1{,}6) \\cdot 2{,}5',  ans: '7{,}5'  },
    { expr: '(7{,}2 - 5{,}7) \\cdot 0{,}6',  ans: '0{,}9'  },
    { expr: '(9{,}4 - 3{,}4) \\cdot 1{,}5',  ans: '9'      },
    { expr: '(6{,}8 - 4{,}3) \\cdot 0{,}8',  ans: '2'      },
    { expr: '(3{,}7 - 1{,}2) \\cdot 0{,}4',  ans: '1'      },
    { expr: '(5{,}5 - 3) \\cdot 1{,}2',       ans: '3'      },
    { expr: '(7{,}3 - 4{,}8) \\cdot 0{,}4',  ans: '1'      },
    { expr: '(8{,}6 - 6{,}1) \\cdot 1{,}6',  ans: '4'      },
    { expr: '(2{,}2 - 1{,}7) \\cdot 6{,}4',  ans: '3{,}2'  },
    { expr: '(4{,}1 - 1{,}1) \\cdot 1{,}5',  ans: '4{,}5'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 3. a · b - c
function genProdMinus() {
  const POOLS = [
    { expr: '8{,}5 \\cdot 2{,}6 - 1{,}7',  ans: '20{,}4' },
    { expr: '1{,}5 \\cdot 4 - 2',          ans: '4'      },
    { expr: '2{,}5 \\cdot 3 - 1{,}5',      ans: '6'      },
    { expr: '0{,}4 \\cdot 5 - 1',          ans: '1'      },
    { expr: '1{,}2 \\cdot 5 - 3',          ans: '3'      },
    { expr: '3{,}5 \\cdot 2 - 1',          ans: '6'      },
    { expr: '1{,}4 \\cdot 5 - 2',          ans: '5'      },
    { expr: '1{,}8 \\cdot 5 - 4',          ans: '5'      },
    { expr: '0{,}6 \\cdot 5 - 1',          ans: '2'      },
    { expr: '2{,}5 \\cdot 4 - 3',          ans: '7'      },
    { expr: '1{,}6 \\cdot 2{,}5 - 1',      ans: '3'      },
    { expr: '0{,}8 \\cdot 2{,}5 - 1',      ans: '1'      },
    { expr: '1{,}4 \\cdot 2{,}5 - 1{,}5',  ans: '2'      },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 4. a · b + c
function genProdPlus() {
  const POOLS = [
    { expr: '1{,}5 \\cdot 4 + 2',          ans: '8'      },
    { expr: '2{,}5 \\cdot 3 + 0{,}5',      ans: '8'      },
    { expr: '0{,}4 \\cdot 5 + 3',          ans: '5'      },
    { expr: '0{,}5 \\cdot 8 + 1{,}5',      ans: '5{,}5'  },
    { expr: '1{,}6 \\cdot 5 + 2',          ans: '10'     },
    { expr: '0{,}25 \\cdot 4 + 1{,}5',     ans: '2{,}5'  },
    { expr: '0{,}8 \\cdot 2 + 0{,}4',      ans: '2'      },
    { expr: '1{,}2 \\cdot 5 + 4',          ans: '10'     },
    { expr: '0{,}6 \\cdot 5 + 0{,}5',      ans: '3{,}5'  },
    { expr: '1{,}5 \\cdot 6 + 1',          ans: '10'     },
    { expr: '2{,}5 \\cdot 4 + 0{,}5',      ans: '10{,}5' },
    { expr: '0{,}8 \\cdot 5 + 2{,}5',      ans: '6{,}5'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 5. a + b : c  (порядок действий: сначала деление)
function genAddDivision() {
  const POOLS = [
    { expr: '3{,}8 + 1{,}08 : 0{,}9',  ans: '5'      },
    { expr: '2{,}2 + 1{,}04 : 1{,}3',  ans: '3'      },
    { expr: '1{,}5 + 2{,}4 : 0{,}6',   ans: '5{,}5'  },
    { expr: '0{,}5 + 1{,}8 : 0{,}3',   ans: '6{,}5'  },
    { expr: '2 + 4{,}8 : 1{,}2',       ans: '6'      },
    { expr: '1{,}3 + 1{,}5 : 0{,}5',   ans: '4{,}3'  },
    { expr: '0{,}4 + 0{,}6 : 0{,}2',   ans: '3{,}4'  },
    { expr: '2{,}5 + 2{,}4 : 0{,}8',   ans: '5{,}5'  },
    { expr: '4 + 0{,}6 : 0{,}3',       ans: '6'      },
    { expr: '1 + 0{,}9 : 0{,}3',       ans: '4'      },
    { expr: '3{,}5 + 4{,}8 : 1{,}6',   ans: '6{,}5'  },
    { expr: '2{,}1 + 1{,}2 : 0{,}4',   ans: '5{,}1'  },
    { expr: '0{,}5 + 2{,}1 : 0{,}7',   ans: '3{,}5'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 6. a - b : c
function genSubDivision() {
  const POOLS = [
    { expr: '5 - 1{,}2 : 0{,}4',       ans: '2'      },
    { expr: '7 - 4{,}8 : 1{,}6',       ans: '4'      },
    { expr: '3{,}5 - 1{,}5 : 0{,}5',   ans: '0{,}5'  },
    { expr: '8 - 1{,}4 : 0{,}7',       ans: '6'      },
    { expr: '4{,}5 - 1{,}6 : 0{,}4',   ans: '0{,}5'  },
    { expr: '6 - 2{,}7 : 0{,}9',       ans: '3'      },
    { expr: '5{,}5 - 2{,}4 : 0{,}6',   ans: '1{,}5'  },
    { expr: '10 - 2{,}1 : 0{,}7',      ans: '7'      },
    { expr: '4{,}8 - 1{,}2 : 0{,}5',   ans: '2{,}4'  },
    { expr: '3 - 0{,}6 : 0{,}3',       ans: '1'      },
    { expr: '7{,}5 - 1{,}6 : 0{,}4',   ans: '3{,}5'  },
    { expr: '6{,}2 - 2{,}4 : 0{,}8',   ans: '3{,}2'  },
    { expr: '5{,}3 - 0{,}9 : 0{,}3',   ans: '2{,}3'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 7. a / (b + c)
function genDivBySum() {
  const POOLS = [
    { expr: '\\dfrac{2{,}7}{1{,}4 + 0{,}1}',  ans: '1{,}8' },
    { expr: '\\dfrac{4{,}5}{0{,}5 + 1}',       ans: '3'     },
    { expr: '\\dfrac{6}{0{,}4 + 0{,}1}',       ans: '12'    },
    { expr: '\\dfrac{3{,}6}{0{,}2 + 0{,}4}',  ans: '6'     },
    { expr: '\\dfrac{7{,}5}{1{,}7 + 0{,}8}',  ans: '3'     },
    { expr: '\\dfrac{2{,}4}{0{,}6 + 0{,}6}',  ans: '2'     },
    { expr: '\\dfrac{1}{0{,}2 + 0{,}3}',       ans: '2'     },
    { expr: '\\dfrac{4{,}8}{0{,}6 + 0{,}6}',  ans: '4'     },
    { expr: '\\dfrac{3{,}6}{1{,}1 + 0{,}7}',  ans: '2'     },
    { expr: '\\dfrac{8{,}1}{1{,}5 + 1{,}2}',  ans: '3'     },
    { expr: '\\dfrac{1{,}5}{0{,}2 + 0{,}3}',  ans: '3'     },
    { expr: '\\dfrac{9}{1{,}3 + 0{,}2}',       ans: '6'     },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 8. a / (b - c)  — включая отрицательные результаты
function genDivByDiff() {
  const POOLS = [
    { expr: '\\dfrac{4{,}4}{5{,}8 - 5{,}3}',  ans: '8{,}8'  },
    { expr: '0{,}6 : (1{,}7 - 2{,}9)',         ans: '-0{,}5' },
    { expr: '\\dfrac{2{,}4}{3{,}7 - 1{,}7}',  ans: '1{,}2'  },
    { expr: '\\dfrac{1{,}8}{0{,}9 - 0{,}6}',  ans: '6'      },
    { expr: '\\dfrac{5{,}6}{1{,}4 - 0{,}6}',  ans: '7'      },
    { expr: '\\dfrac{4}{2{,}5 - 1{,}5}',       ans: '4'      },
    { expr: '\\dfrac{1{,}8}{0{,}6 - 1{,}2}',  ans: '-3'     },
    { expr: '\\dfrac{1{,}5}{0{,}5 - 1}',       ans: '-3'     },
    { expr: '\\dfrac{2{,}5}{1{,}3 - 0{,}8}',  ans: '5'      },
    { expr: '\\dfrac{3{,}9}{2{,}1 - 0{,}8}',  ans: '3'      },
    { expr: '0{,}8 : (1{,}2 - 2)',             ans: '-1'     },
    { expr: '\\dfrac{2{,}1}{1{,}5 - 0{,}8}',  ans: '3'      },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 9. (a - b) / c   — может быть отрицательным
function genDiffDiv() {
  const POOLS = [
    { expr: '\\dfrac{9{,}4 - 1{,}3}{1{,}8}',   ans: '4{,}5'   },
    { expr: '\\dfrac{0{,}5 - 1{,}5}{0{,}8}',   ans: '-1{,}25' },
    { expr: '\\dfrac{7{,}5 - 2{,}5}{2{,}5}',   ans: '2'       },
    { expr: '\\dfrac{4{,}8 - 1{,}2}{1{,}2}',   ans: '3'       },
    { expr: '\\dfrac{3 - 0{,}6}{0{,}4}',         ans: '6'       },
    { expr: '\\dfrac{10 - 2{,}5}{0{,}5}',        ans: '15'      },
    { expr: '\\dfrac{1 - 4}{0{,}5}',             ans: '-6'      },
    { expr: '\\dfrac{2{,}4 - 4{,}8}{0{,}8}',   ans: '-3'      },
    { expr: '\\dfrac{6{,}3 - 2{,}1}{0{,}6}',   ans: '7'       },
    { expr: '\\dfrac{8{,}1 - 1{,}8}{0{,}9}',   ans: '7'       },
    { expr: '\\dfrac{2{,}5 - 1{,}9}{0{,}3}',   ans: '2'       },
    { expr: '\\dfrac{4{,}5 - 1{,}5}{1{,}5}',   ans: '2'       },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 10. (a · b) / (c · d) — «хитрая дробь»: одинаковые цифры со сдвигом запятой
function genTrickFraction() {
  const POOLS = [
    { expr: '\\dfrac{1{,}92 \\cdot 0{,}244}{0{,}192 \\cdot 2{,}44}', ans: '1' },
    { expr: '\\dfrac{0{,}207 \\cdot 2{,}08}{2{,}07 \\cdot 0{,}208}', ans: '1' },
    { expr: '\\dfrac{3{,}6 \\cdot 0{,}52}{0{,}36 \\cdot 5{,}2}',     ans: '1' },
    { expr: '\\dfrac{4{,}5 \\cdot 0{,}18}{0{,}45 \\cdot 1{,}8}',     ans: '1' },
    { expr: '\\dfrac{7{,}2 \\cdot 0{,}34}{0{,}72 \\cdot 3{,}4}',     ans: '1' },
    { expr: '\\dfrac{6{,}5 \\cdot 0{,}18}{0{,}65 \\cdot 1{,}8}',     ans: '1' },
    { expr: '\\dfrac{8{,}4 \\cdot 0{,}15}{0{,}84 \\cdot 1{,}5}',     ans: '1' },
    { expr: '\\dfrac{0{,}36 \\cdot 2{,}5}{3{,}6 \\cdot 0{,}25}',     ans: '1' },
    { expr: '\\dfrac{6{,}3 \\cdot 0{,}24}{0{,}63 \\cdot 2{,}4}',     ans: '1' },
    { expr: '\\dfrac{0{,}54 \\cdot 1{,}8}{5{,}4 \\cdot 0{,}18}',     ans: '1' },
    { expr: '\\dfrac{2{,}5 \\cdot 0{,}144}{0{,}25 \\cdot 1{,}44}',   ans: '1' },
    { expr: '\\dfrac{0{,}48 \\cdot 1{,}6}{4{,}8 \\cdot 0{,}16}',     ans: '1' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// ─── Маппинг ─────────────────────────────────────────────────────────────────
const GENERATORS_EGE = {
  sumTimes:      genSumTimes,
  diffTimes:     genDiffTimes,
  prodMinus:     genProdMinus,
  prodPlus:      genProdPlus,
  addDivision:   genAddDivision,
  subDivision:   genSubDivision,
  divBySum:      genDivBySum,
  divByDiff:     genDivByDiff,
  diffDiv:       genDiffDiv,
  trickFraction: genTrickFraction,
};

export const CATEGORY_LABELS_EGE = {
  sumTimes:      '(a + b) · c',
  diffTimes:     '(a − b) · c',
  prodMinus:     'a · b − c',
  prodPlus:      'a · b + c',
  addDivision:   'a + b : c',
  subDivision:   'a − b : c',
  divBySum:      'a / (b + c)',
  divByDiff:     'a / (b − c)',
  diffDiv:       '(a − b) / c',
  trickFraction: 'Хитрая дробь (= 1)',
};

export const DEFAULT_SETTINGS_EGE = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  decimalOnly:    false,
  categories: {
    sumTimes:      true,
    diffTimes:     true,
    prodMinus:     true,
    prodPlus:      true,
    addDivision:   true,
    subDivision:   true,
    divBySum:      true,
    divByDiff:     true,
    diffDiv:       true,
    trickFraction: true,
  },
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateEgeBaseVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_EGE, ...settings };
  const { decimalOnly } = s;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS_EGE[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: decimalOnly ? 300 : 80,
    make: (cat) => {
      const q = GENERATORS_EGE[cat]();
      if (!q) return null;
      if (decimalOnly && !isFiniteDecimalAnswer(q.resultLatex)) return null;
      return { ...q, cat };
    },
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralEgeBase() {
  const [title, setTitle]         = useState('Устный счёт: действия с десятичными');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_EGE });
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
    const variants = generateEgeBaseVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт: действия с десятичными');
    setSettings({ ...DEFAULT_SETTINGS_EGE });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
  };
}
