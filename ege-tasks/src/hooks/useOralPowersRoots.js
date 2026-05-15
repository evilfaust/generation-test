import { useState, useCallback } from 'react';
import { isFiniteDecimalAnswer } from '../utils/oralAnswerFilter';

// ─── Вспомогательные ─────────────────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Пулы точных степеней ────────────────────────────────────────────────────
const PERFECT_SQUARES = [
  [4, 2], [9, 3], [16, 4], [25, 5], [36, 6], [49, 7], [64, 8], [81, 9],
  [100, 10], [121, 11], [144, 12], [169, 13], [196, 14], [225, 15],
  [256, 16], [289, 17], [324, 18], [361, 19], [400, 20],
];
const PERFECT_CUBES = [
  [8, 2], [27, 3], [64, 4], [125, 5], [216, 6], [343, 7], [512, 8], [729, 9], [1000, 10],
];
const PERFECT_4TH = [
  [16, 2], [81, 3], [256, 4], [625, 5],
];
const PERFECT_5TH = [
  [32, 2], [243, 3],
];
const PERFECT_6TH = [
  [64, 2], [729, 3],
];

// ─── Генераторы ──────────────────────────────────────────────────────────────

// 1. Простой квадратный корень: √N → целое
function genSimpleSqrt() {
  const [N, ans] = rand(PERFECT_SQUARES);
  return { exprLatex: `\\sqrt{${N}}`, resultLatex: String(ans) };
}

// 2. Корень n-й степени
function genNthRoot() {
  const POOLS = [
    { n: 3, pool: PERFECT_CUBES },
    { n: 4, pool: PERFECT_4TH },
    { n: 5, pool: PERFECT_5TH },
    { n: 6, pool: PERFECT_6TH },
  ];
  const p = rand(POOLS);
  const [N, ans] = rand(p.pool);
  return { exprLatex: `\\sqrt[${p.n}]{${N}}`, resultLatex: String(ans) };
}

// 3. Вложенный корень: √√N (N — точная 4-я степень)
function genNestedRoot() {
  const [N, ans] = rand(PERFECT_4TH);
  return { exprLatex: `\\sqrt{\\sqrt{${N}}}`, resultLatex: String(ans) };
}

// 4. Корень из степени: ⁿ√(aᵐ)
function genRootOfPower() {
  const POOLS = [
    { expr: '\\sqrt[3]{2^6}',     ans: '4'  },
    { expr: '\\sqrt[3]{2^9}',     ans: '8'  },
    { expr: '\\sqrt[3]{3^6}',     ans: '9'  },
    { expr: '\\sqrt[3]{3^9}',     ans: '27' },
    { expr: '\\sqrt[3]{5^6}',     ans: '25' },
    { expr: '\\sqrt[4]{2^8}',     ans: '4'  },
    { expr: '\\sqrt[4]{3^8}',     ans: '9'  },
    { expr: '\\sqrt[5]{2^{10}}',  ans: '4'  },
    { expr: '\\sqrt[5]{3^{10}}',  ans: '9'  },
    { expr: '\\sqrt[6]{2^{12}}',  ans: '4'  },
    { expr: '\\sqrt[6]{16^3}',    ans: '4'  },
    { expr: '\\sqrt[9]{3^{27}}',  ans: '27' },
    { expr: '\\sqrt[6]{64^3}',    ans: '8'  },
    { expr: '\\sqrt[4]{16^2}',    ans: '4'  },
    { expr: '\\sqrt[6]{27^2}',    ans: '3'  },
    { expr: '\\sqrt[6]{8^4}',     ans: '4'  },
    { expr: '\\sqrt[4]{81^2}',    ans: '9'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 5. Степень корня: (ⁿ√a)ᵐ
function genPowerOfRoot() {
  const POOLS = [
    { expr: '\\left(\\sqrt[3]{3}\\right)^{6}',   ans: '9'  },
    { expr: '\\left(\\sqrt[4]{2}\\right)^{8}',   ans: '4'  },
    { expr: '\\left(\\sqrt[3]{2}\\right)^{6}',   ans: '4'  },
    { expr: '\\left(\\sqrt[3]{4}\\right)^{3}',   ans: '4'  },
    { expr: '\\left(\\sqrt{5}\\right)^{4}',      ans: '25' },
    { expr: '\\left(\\sqrt{3}\\right)^{4}',      ans: '9'  },
    { expr: '\\left(\\sqrt{2}\\right)^{6}',      ans: '8'  },
    { expr: '\\left(\\sqrt{2}\\right)^{8}',      ans: '16' },
    { expr: '\\left(\\sqrt[5]{2}\\right)^{10}',  ans: '4'  },
    { expr: '\\left(\\sqrt[3]{5}\\right)^{6}',   ans: '25' },
    { expr: '\\left(\\sqrt[3]{7}\\right)^{3}',   ans: '7'  },
    { expr: '\\left(\\sqrt{6}\\right)^{4}',      ans: '36' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 6. Произведение корней одной степени: ⁿ√a · ⁿ√b
function genProductOfRoots() {
  const POOLS = [
    { expr: '\\sqrt[3]{2} \\cdot \\sqrt[3]{4}',   ans: '2'  },
    { expr: '\\sqrt[3]{9} \\cdot \\sqrt[3]{3}',   ans: '3'  },
    { expr: '\\sqrt[3]{16} \\cdot \\sqrt[3]{4}',  ans: '4'  },
    { expr: '\\sqrt[3]{25} \\cdot \\sqrt[3]{5}',  ans: '5'  },
    { expr: '\\sqrt[4]{8} \\cdot \\sqrt[4]{2}',   ans: '2'  },
    { expr: '\\sqrt[4]{27} \\cdot \\sqrt[4]{3}',  ans: '3'  },
    { expr: '\\sqrt[5]{8} \\cdot \\sqrt[5]{4}',   ans: '2'  },
    { expr: '\\sqrt{2} \\cdot \\sqrt{8}',          ans: '4'  },
    { expr: '\\sqrt{3} \\cdot \\sqrt{12}',         ans: '6'  },
    { expr: '\\sqrt{5} \\cdot \\sqrt{20}',         ans: '10' },
    { expr: '\\sqrt{2} \\cdot \\sqrt{18}',         ans: '6'  },
    { expr: '\\sqrt{2} \\cdot \\sqrt{50}',         ans: '10' },
    { expr: '\\sqrt{3} \\cdot \\sqrt{27}',         ans: '9'  },
    { expr: '\\sqrt{5} \\cdot \\sqrt{45}',         ans: '15' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 7. Корень из дроби (в т.ч. отрицательной)
function genRootOfFraction() {
  const POOLS = [
    { expr: '\\sqrt[3]{-\\dfrac{1}{8}}',     ans: '-0{,}5' },
    { expr: '\\sqrt[3]{-\\dfrac{1}{27}}',    ans: '-\\dfrac{1}{3}' },
    { expr: '\\sqrt[3]{-\\dfrac{1}{64}}',    ans: '-0{,}25' },
    { expr: '\\sqrt[3]{-\\dfrac{1}{125}}',   ans: '-0{,}2' },
    { expr: '\\sqrt[3]{-\\dfrac{1}{1000}}',  ans: '-0{,}1' },
    { expr: '\\sqrt[3]{\\dfrac{1}{27}}',     ans: '\\dfrac{1}{3}' },
    { expr: '\\sqrt[3]{\\dfrac{1}{125}}',    ans: '0{,}2' },
    { expr: '\\sqrt[3]{\\dfrac{8}{27}}',     ans: '\\dfrac{2}{3}' },
    { expr: '\\sqrt[3]{-\\dfrac{8}{125}}',   ans: '-0{,}4' },
    { expr: '\\sqrt[3]{\\dfrac{625}{5}}',    ans: '5' },
    { expr: '\\sqrt{\\dfrac{49}{4}}',        ans: '3{,}5' },
    { expr: '\\sqrt{\\dfrac{1}{4}}',         ans: '0{,}5' },
    { expr: '\\sqrt{\\dfrac{1}{9}}',         ans: '\\dfrac{1}{3}' },
    { expr: '\\sqrt{\\dfrac{1}{16}}',        ans: '0{,}25' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 8. Дробная степень: aᵖ/ᵠ
function genFractionalPower() {
  const POOLS = [
    { expr: '8^{\\frac{2}{3}}',    ans: '4' },
    { expr: '8^{\\frac{1}{3}}',    ans: '2' },
    { expr: '27^{\\frac{1}{3}}',   ans: '3' },
    { expr: '27^{\\frac{2}{3}}',   ans: '9' },
    { expr: '16^{\\frac{1}{2}}',   ans: '4' },
    { expr: '16^{\\frac{1}{4}}',   ans: '2' },
    { expr: '16^{\\frac{3}{4}}',   ans: '8' },
    { expr: '25^{\\frac{1}{2}}',   ans: '5' },
    { expr: '25^{\\frac{3}{2}}',   ans: '125' },
    { expr: '32^{\\frac{1}{5}}',   ans: '2' },
    { expr: '32^{\\frac{3}{5}}',   ans: '8' },
    { expr: '64^{\\frac{1}{2}}',   ans: '8' },
    { expr: '64^{\\frac{1}{3}}',   ans: '4' },
    { expr: '64^{\\frac{1}{6}}',   ans: '2' },
    { expr: '64^{\\frac{2}{3}}',   ans: '16' },
    { expr: '81^{\\frac{1}{2}}',   ans: '9' },
    { expr: '81^{\\frac{1}{4}}',   ans: '3' },
    { expr: '125^{\\frac{1}{3}}',  ans: '5' },
    { expr: '125^{\\frac{2}{3}}',  ans: '25' },
    { expr: '36^{\\frac{1}{2}}',   ans: '6' },
    { expr: '49^{\\frac{1}{2}}',   ans: '7' },
    { expr: '100^{\\frac{1}{2}}',  ans: '10' },
    { expr: '0{,}25^{\\frac{1}{2}}', ans: '0{,}5' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 9. Степень дроби: (a/b)^x
function genFractionPower() {
  const POOLS = [
    { expr: '\\left(\\dfrac{9}{25}\\right)^{\\frac{1}{2}}',  ans: '0{,}6' },
    { expr: '\\left(\\dfrac{4}{9}\\right)^{\\frac{1}{2}}',   ans: '\\dfrac{2}{3}' },
    { expr: '\\left(\\dfrac{16}{25}\\right)^{\\frac{1}{2}}', ans: '0{,}8' },
    { expr: '\\left(\\dfrac{1}{4}\\right)^{\\frac{1}{2}}',   ans: '0{,}5' },
    { expr: '\\left(\\dfrac{1}{9}\\right)^{\\frac{1}{2}}',   ans: '\\dfrac{1}{3}' },
    { expr: '\\left(\\dfrac{1}{16}\\right)^{\\frac{1}{2}}',  ans: '0{,}25' },
    { expr: '\\left(\\dfrac{1}{25}\\right)^{\\frac{1}{2}}',  ans: '0{,}2' },
    { expr: '\\left(\\dfrac{1}{8}\\right)^{\\frac{1}{3}}',   ans: '0{,}5' },
    { expr: '\\left(\\dfrac{1}{27}\\right)^{\\frac{1}{3}}',  ans: '\\dfrac{1}{3}' },
    { expr: '\\left(\\dfrac{8}{27}\\right)^{\\frac{1}{3}}',  ans: '\\dfrac{2}{3}' },
    { expr: '\\left(\\dfrac{25}{36}\\right)^{\\frac{1}{2}}', ans: '\\dfrac{5}{6}' },
    { expr: '\\left(\\dfrac{1}{32}\\right)^{\\frac{1}{5}}',  ans: '0{,}5' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 10. Отрицательная степень
function genNegPower() {
  const POOLS = [
    { expr: '\\left(\\dfrac{3}{7}\\right)^{-1}', ans: '\\dfrac{7}{3}' },
    { expr: '\\left(\\dfrac{2}{5}\\right)^{-1}', ans: '\\dfrac{5}{2}' },
    { expr: '\\left(\\dfrac{5}{8}\\right)^{-1}', ans: '\\dfrac{8}{5}' },
    { expr: '\\left(\\dfrac{4}{9}\\right)^{-1}', ans: '\\dfrac{9}{4}' },
    { expr: '\\left(\\dfrac{1}{4}\\right)^{-1}', ans: '4' },
    { expr: '\\left(\\dfrac{1}{5}\\right)^{-1}', ans: '5' },
    { expr: '\\left(\\dfrac{1}{10}\\right)^{-1}', ans: '10' },
    { expr: '2^{-3}',  ans: '\\dfrac{1}{8}'  },
    { expr: '2^{-4}',  ans: '\\dfrac{1}{16}' },
    { expr: '3^{-2}',  ans: '\\dfrac{1}{9}'  },
    { expr: '4^{-1}',  ans: '0{,}25' },
    { expr: '5^{-2}',  ans: '0{,}04' },
    { expr: '10^{-2}', ans: '0{,}01' },
    { expr: '10^{-3}', ans: '0{,}001' },
    { expr: '5^{-1}',  ans: '0{,}2'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 11. Произведение степеней с одинаковым основанием
function genSameBaseProduct() {
  const POOLS = [
    { expr: '5^{\\frac{1}{4}}\\cdot 5^{\\frac{3}{4}}',   ans: '5' },
    { expr: '2^{\\frac{1}{3}}\\cdot 2^{\\frac{2}{3}}',   ans: '2' },
    { expr: '3^{\\frac{1}{2}}\\cdot 3^{\\frac{3}{2}}',   ans: '9' },
    { expr: '2^{\\frac{1}{2}}\\cdot 2^{\\frac{3}{2}}',   ans: '4' },
    { expr: '5^{\\frac{3}{4}}\\cdot 5^{\\frac{1}{4}}',   ans: '5' },
    { expr: '3^{\\frac{2}{5}}\\cdot 3^{\\frac{3}{5}}',   ans: '3' },
    { expr: '7^{\\frac{1}{2}}\\cdot 7^{\\frac{1}{2}}',   ans: '7' },
    { expr: '4^{\\frac{1}{2}}\\cdot 4^{\\frac{3}{2}}',   ans: '16' },
    { expr: '10^{\\frac{1}{3}}\\cdot 10^{\\frac{2}{3}}', ans: '10' },
    { expr: '6^{\\frac{1}{2}}\\cdot 6^{\\frac{1}{2}}',   ans: '6' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 12. Частное степеней с одинаковым основанием
function genSameBaseQuotient() {
  const POOLS = [
    { expr: '3^{\\frac{7}{3}} : 3^{\\frac{1}{3}}',     ans: '9'  },
    { expr: '5^{\\frac{5}{2}} : 5^{\\frac{1}{2}}',     ans: '25' },
    { expr: '2^{\\frac{7}{3}} : 2^{\\frac{1}{3}}',     ans: '4'  },
    { expr: '7^{\\frac{3}{2}} : 7^{\\frac{1}{2}}',     ans: '7'  },
    { expr: '3^{\\frac{5}{2}} : 3^{\\frac{1}{2}}',     ans: '9'  },
    { expr: '2^{\\frac{9}{4}} : 2^{\\frac{1}{4}}',     ans: '4'  },
    { expr: '5^{\\frac{7}{3}} : 5^{\\frac{1}{3}}',     ans: '25' },
    { expr: '4^{\\frac{5}{2}} : 4^{\\frac{1}{2}}',     ans: '16' },
    { expr: '10^{\\frac{3}{2}} : 10^{\\frac{1}{2}}',   ans: '10' },
    { expr: '2^{\\frac{5}{3}} : 2^{\\frac{2}{3}}',     ans: '2'  },
    { expr: '3^{\\frac{7}{4}} : 3^{\\frac{3}{4}}',     ans: '3'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 13. Степень степени: (aᵖ)ᵠ
function genPowerOfPower() {
  const POOLS = [
    { expr: '\\left(5^{\\frac{2}{3}}\\right)^{3}',                                ans: '25' },
    { expr: '\\left(2^{\\frac{3}{4}}\\right)^{4}',                                ans: '8'  },
    { expr: '\\left(3^{\\frac{2}{3}}\\right)^{3}',                                ans: '9'  },
    { expr: '\\left(16^{\\frac{1}{3}}\\right)^{\\frac{9}{4}}',                    ans: '8'  },
    { expr: '\\left(2^{\\frac{5}{6}}\\right)^{6}',                                ans: '32' },
    { expr: '\\left(7^{\\frac{1}{2}}\\right)^{4}',                                ans: '49' },
    { expr: '\\left(8^{\\frac{1}{2}}\\right)^{\\frac{2}{3}}',                     ans: '2'  },
    { expr: '\\left(27^{\\frac{4}{9}}\\right)^{\\frac{3}{4}}',                    ans: '3'  },
    { expr: '\\left(\\left(\\dfrac{1}{3}\\right)^{\\sqrt{3}}\\right)^{\\sqrt{3}}', ans: '\\dfrac{1}{27}' },
    { expr: '\\left(\\left(\\dfrac{1}{2}\\right)^{\\sqrt{2}}\\right)^{\\sqrt{8}}', ans: '\\dfrac{1}{4}'  },
    { expr: '\\left(3^{\\frac{4}{3}}\\right)^{\\frac{3}{2}}',                     ans: '9'  },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 14. Иррациональные показатели (формулы (a+b)(a−b) = a²−b²)
function genIrrationalExp() {
  const POOLS = [
    { expr: '\\left(4^{2+\\sqrt{3}}\\right)^{2-\\sqrt{3}}', ans: '4'  },  // 4¹
    { expr: '\\left(5^{2+\\sqrt{3}}\\right)^{2-\\sqrt{3}}', ans: '5'  },
    { expr: '\\left(3^{2+\\sqrt{2}}\\right)^{2-\\sqrt{2}}', ans: '9'  },  // 3²
    { expr: '\\left(2^{3+\\sqrt{5}}\\right)^{3-\\sqrt{5}}', ans: '16' },  // 2⁴
    { expr: '\\left(5^{3+\\sqrt{6}}\\right)^{3-\\sqrt{6}}', ans: '125' }, // 5³
    { expr: '3^{2-\\sqrt{2}} : 3^{1-\\sqrt{2}}',             ans: '3'  },
    { expr: '2^{3+\\sqrt{3}} : 2^{1+\\sqrt{3}}',             ans: '4'  },
    { expr: '5^{3-\\sqrt{2}} : 5^{1-\\sqrt{2}}',             ans: '25' },
    { expr: '7^{2+\\sqrt{5}} : 7^{1+\\sqrt{5}}',             ans: '7'  },
    { expr: '2^{4+\\sqrt{3}} \\cdot 2^{1-\\sqrt{3}}',        ans: '32' },
    { expr: '3^{2+\\sqrt{5}} \\cdot 3^{1-\\sqrt{5}}',        ans: '27' },
    { expr: '5^{1+\\sqrt{2}} \\cdot 5^{1-\\sqrt{2}}',        ans: '25' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// 15. Десятичная дробь × корень
function genDecimalTimesRoot() {
  const POOLS = [
    { expr: '0{,}25 \\cdot \\sqrt{16}',  ans: '1'  },
    { expr: '0{,}5 \\cdot \\sqrt{16}',   ans: '2'  },
    { expr: '0{,}5 \\cdot \\sqrt{36}',   ans: '3'  },
    { expr: '0{,}5 \\cdot \\sqrt{100}',  ans: '5'  },
    { expr: '0{,}25 \\cdot \\sqrt{64}',  ans: '2'  },
    { expr: '0{,}1 \\cdot \\sqrt{100}',  ans: '1'  },
    { expr: '0{,}2 \\cdot \\sqrt{25}',   ans: '1'  },
    { expr: '0{,}2 \\cdot \\sqrt{100}',  ans: '2'  },
    { expr: '0{,}1 \\cdot \\sqrt{400}',  ans: '2'  },
    { expr: '2 \\cdot \\sqrt{49}',       ans: '14' },
    { expr: '3 \\cdot \\sqrt{25}',       ans: '15' },
    { expr: '4 \\cdot \\sqrt{16}',       ans: '16' },
    { expr: '0{,}1 \\cdot \\sqrt{81}',   ans: '0{,}9' },
  ];
  const p = rand(POOLS);
  return { exprLatex: p.expr, resultLatex: p.ans };
}

// ─── Маппинг категорий ────────────────────────────────────────────────────────
const GENERATORS_PR = {
  simpleSqrt:       genSimpleSqrt,
  nthRoot:          genNthRoot,
  nestedRoot:       genNestedRoot,
  rootOfPower:      genRootOfPower,
  powerOfRoot:      genPowerOfRoot,
  productOfRoots:   genProductOfRoots,
  rootOfFraction:   genRootOfFraction,
  fractionalPower:  genFractionalPower,
  fractionPower:    genFractionPower,
  negPower:         genNegPower,
  sameBaseProduct:  genSameBaseProduct,
  sameBaseQuotient: genSameBaseQuotient,
  powerOfPower:     genPowerOfPower,
  irrationalExp:    genIrrationalExp,
  decimalTimesRoot: genDecimalTimesRoot,
};

export const CATEGORY_LABELS_PR = {
  simpleSqrt:       'Квадратный корень: √N',
  nthRoot:          'Корень n-й степени',
  nestedRoot:       'Вложенный корень: √√N',
  rootOfPower:      'Корень из степени',
  powerOfRoot:      'Степень корня',
  productOfRoots:   'Произведение корней',
  rootOfFraction:   'Корень из дроби',
  fractionalPower:  'Дробная степень',
  fractionPower:    'Степень дроби',
  negPower:         'Отрицательная степень',
  sameBaseProduct:  'aᵖ · aᵠ',
  sameBaseQuotient: 'aᵖ : aᵠ',
  powerOfPower:     '(aᵖ)ᵠ',
  irrationalExp:    'Иррациональные показатели',
  decimalTimesRoot: 'Дес. дробь × корень',
};

export const DEFAULT_SETTINGS_PR = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  decimalOnly:    false,
  categories: {
    simpleSqrt:       true,
    nthRoot:          true,
    nestedRoot:       true,
    rootOfPower:      true,
    powerOfRoot:      true,
    productOfRoots:   true,
    rootOfFraction:   true,
    fractionalPower:  true,
    fractionPower:    true,
    negPower:         true,
    sameBaseProduct:  true,
    sameBaseQuotient: true,
    powerOfPower:     true,
    irrationalExp:    true,
    decimalTimesRoot: true,
  },
};

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralPowersRoots() {
  const [title, setTitle]         = useState('Устный счёт: степени и корни');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_PR });
  const [tasksData, setTasksData] = useState(null);

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override
      ? { ...DEFAULT_SETTINGS_PR, ...settings, ...override }
      : settings;
    const { variantsCount, questionsCount, categories, decimalOnly } = s;

    const enabledCats = Object.entries(categories)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (enabledCats.length === 0) return;

    const maxAttempts = decimalOnly ? questionsCount * 30 : questionsCount * 5;

    const variants = Array.from({ length: variantsCount }, () => {
      const questions = [];
      let catIdx = 0;
      while (questions.length < questionsCount && catIdx < maxAttempts) {
        const cat = enabledCats[catIdx % enabledCats.length];
        catIdx++;
        const gen = GENERATORS_PR[cat];
        if (!gen) continue;
        const q = gen();
        if (q && (!decimalOnly || isFiniteDecimalAnswer(q.resultLatex))) {
          questions.push({ ...q, cat });
        }
      }
      return questions;
    });

    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт: степени и корни');
    setSettings({ ...DEFAULT_SETTINGS_PR });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
  };
}
