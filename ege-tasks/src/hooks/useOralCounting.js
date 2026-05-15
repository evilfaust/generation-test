import { useState, useCallback } from 'react';
import { isFiniteDecimalAnswer } from '../utils/oralAnswerFilter';

// ─── Вспомогательные функции ──────────────────────────────────────────────────
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

function reduceFrac(n, d) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d);
  return [n / g, d / g];
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

// Форматирование дроби в выражении: 2/5 → \dfrac{2}{5}, -2/5 → -\dfrac{2}{5}
function fmtFrac(n, d) {
  const [rn, rd] = reduceFrac(n, d);
  if (rd === 1) return String(rn);
  if (rn < 0) return `-\\dfrac{${-rn}}{${rd}}`;
  return `\\dfrac{${rn}}{${rd}}`;
}

// Форматирование ответа: поддерживает смешанные числа
// -9/5 → -1\dfrac{4}{5},  9/2 → 4\dfrac{1}{2},  6/1 → 6
function fmtAnswer(n, d) {
  const [rn, rd] = reduceFrac(n, d);
  if (rd === 1) return String(rn);
  const isNeg = rn < 0;
  const absN = Math.abs(rn);
  const whole = Math.floor(absN / rd);
  const rem = absN % rd;
  if (rem === 0) return String(isNeg ? -whole : whole);
  if (whole === 0) return isNeg ? `-\\dfrac{${absN}}{${rd}}` : `\\dfrac{${rn}}{${rd}}`;
  return isNeg ? `-${whole}\\dfrac{${rem}}{${rd}}` : `${whole}\\dfrac{${rem}}{${rd}}`;
}

// Проверка "красивости" ответа: знаменатель ≤ 12, значение < 200
function isNice(n, d) {
  const [rn, rd] = reduceFrac(n, d);
  return rd <= 12 && Math.abs(rn / rd) < 200;
}

// ─── Пулы чисел ───────────────────────────────────────────────────────────────
const DENOMS     = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const SMALL_DENS = [2, 3, 4, 5, 6, 7];
const INTS       = [2, 3, 4, 5, 6, 7, 8, 9, 10];

function coprimeNumerators(d) {
  const res = [];
  for (let a = 1; a < d; a++) if (gcd(a, d) === 1) res.push(a);
  return res.length ? res : [1];
}

// ─── Генераторы задач по категориям ──────────────────────────────────────────

// Категория 1: дробь × целое (и целое × дробь)
function genFracTimesInt() {
  const b = rand(DENOMS);
  const coprime = coprimeNumerators(b);
  const a = rand(coprime);
  const n = rand(INTS);
  const sign = Math.random() < 0.35 ? -1 : 1;
  const signedN = sign * n;

  const fracTex = `\\dfrac{${a}}{${b}}`;
  const nTex = signedN < 0 ? `(${signedN})` : String(signedN);
  const exprLatex = Math.random() < 0.5
    ? `${fracTex} \\cdot ${nTex}`
    : `${nTex} \\cdot ${fracTex}`;

  const [rn, rd] = reduceFrac(a * signedN, b);
  if (!isNice(rn, rd)) return null;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 2: целое ÷ дробь  (n : a/b = n*b/a)
function genIntDivFrac() {
  const b = rand(SMALL_DENS);
  const coprime = coprimeNumerators(b);
  const a = rand(coprime);
  const n = rand(INTS);
  const sign = Math.random() < 0.4 ? -1 : 1;
  const signedN = sign * n;

  const fracTex = `\\dfrac{${a}}{${b}}`;
  const nTex = signedN < 0 ? `(${signedN})` : String(signedN);
  const exprLatex = `${nTex} : ${fracTex}`;

  const [rn, rd] = reduceFrac(signedN * b, a);
  if (!isNice(rn, rd)) return null;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 3: дробь ÷ целое  (a/b : n = a/(b*n))
function genFracDivInt() {
  const b = rand(SMALL_DENS);
  const coprime = coprimeNumerators(b);
  const a = rand(coprime);
  const n = rand([2, 3, 4, 5, 6]);

  const fracTex = `\\dfrac{${a}}{${b}}`;
  const exprLatex = `${fracTex} : ${n}`;

  const [rn, rd] = reduceFrac(a, b * n);
  if (!isNice(rn, rd)) return null;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 4: дробь ÷ дробь
function genFracDivFrac() {
  // Вариант А: одинаковый знаменатель → a/b ÷ c/b = a/c (целое или дробь)
  // Вариант Б: разные знаменатели, но красивый результат
  const mode = Math.random() < 0.6 ? 'sameDen' : 'diffDen';

  if (mode === 'sameDen') {
    const b = rand(SMALL_DENS);
    const nums = [];
    for (let x = 1; x < b * 3; x++) nums.push(x);
    const a = rand(nums.filter(x => x <= b * 2));
    const c = rand(nums.filter(x => x < a && x > 0));
    if (!c) return null;

    const frac1 = fmtFrac(a, b);
    const frac2 = fmtFrac(c, b);
    const exprLatex = `${frac1} : ${frac2}`;
    const [rn, rd] = reduceFrac(a, c);
    if (!isNice(rn, rd)) return null;
    return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
  } else {
    // разные знаменатели
    const b1 = rand(SMALL_DENS);
    const b2 = rand(SMALL_DENS.filter(x => x !== b1));
    const a1 = rand(coprimeNumerators(b1));
    const a2 = rand(coprimeNumerators(b2));
    const exprLatex = `\\dfrac{${a1}}{${b1}} : \\dfrac{${a2}}{${b2}}`;
    const [rn, rd] = reduceFrac(a1 * b2, b1 * a2);
    if (!isNice(rn, rd) || rd > 10) return null;
    return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
  }
}

// Категория 5: целое × (1/n) или (1/n) × целое
function genTimesReciprocal() {
  const n = rand([2, 3, 4, 5, 6, 7, 8, 9]);
  const k = randInt(1, n * 3);
  const sign = Math.random() < 0.4 ? -1 : 1;
  const signedK = sign * k;
  const fracTex = `\\dfrac{1}{${n}}`;
  const kTex = signedK < 0 ? `(${signedK})` : String(signedK);
  const exprLatex = Math.random() < 0.5
    ? `${fracTex} \\cdot ${kTex}`
    : `${kTex} \\cdot ${fracTex}`;
  const [rn, rd] = reduceFrac(signedK, n);
  if (!isNice(rn, rd)) return null;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 6: целое ± смешанное число
function genMixedArith() {
  const b = rand(SMALL_DENS);
  const a = rand(coprimeNumerators(b));
  const whole2 = randInt(1, 8);  // целая часть смешанного
  const whole1 = randInt(1, 10); // целое число

  // вычитание: whole1 - (whole2 + a/b)
  const op = Math.random() < 0.4 ? 'add' : 'sub';

  // результат: op=sub → whole1 - whole2 - a/b
  const [rn, rd] = op === 'sub'
    ? reduceFrac(whole1 * b - whole2 * b - a, b)
    : reduceFrac(whole1 * b + whole2 * b + a, b);

  if (!isNice(rn, rd)) return null;

  const mixedTex = `${whole2}\\dfrac{${a}}{${b}}`;
  const sign = op === 'sub' ? '-' : '+';
  const exprLatex = `${whole1} ${sign} ${mixedTex}`;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 7: степень десятичной дроби
// Пулы: основание 0.1–0.5, степень 2 или 3
const DECIMAL_BASES = [
  { val: 0.1, tex: '0{,}1' },
  { val: 0.2, tex: '0{,}2' },
  { val: 0.3, tex: '0{,}3' },
  { val: 0.4, tex: '0{,}4' },
  { val: 0.5, tex: '0{,}5' },
];

function fmtDecimal(v) {
  // Убираем хвостовые нули, показываем красиво
  if (v === 0) return '0';
  const s = v.toFixed(10).replace(/\.?0+$/, '');
  return s.replace('.', '{,}');
}

function genDecimalPower() {
  const base = rand(DECIMAL_BASES);
  const pow = rand([2, 3]);
  const withNeg = Math.random() < 0.6; // отрицательное основание

  const result = Math.pow(base.val, pow) * (withNeg && pow % 2 === 1 ? -1 : 1);
  const baseTex = withNeg ? `(-${base.tex})` : base.tex;
  const exprLatex = `${baseTex}^${pow}`;
  const resultLatex = fmtDecimal(result);
  return { exprLatex, resultLatex };
}

// Категория 8: умножение/деление на степень 10
const POW10_BASES = [
  '1{,}2', '2{,}4', '3{,}5', '4{,}8', '7{,}3', '5{,}6',
  '0{,}7', '0{,}36', '1{,}25', '2{,}7', '6{,}4', '3{,}2',
];
const POW10_BASES_NEG = ['-2{,}4', '-1{,}5', '-3{,}6', '-0{,}8'];

function genMulPow10() {
  const isPow10 = Math.random() < 0.5; // умножение или деление
  const useNeg  = Math.random() < 0.3;
  const bases   = useNeg ? POW10_BASES_NEG : POW10_BASES;
  const baseTex = rand(bases);
  // Степень: 10, 100, 1000, 10000 или 0.1, 0.01
  const pows = isPow10
    ? [{ tex: '10',   val: 10 }, { tex: '100',  val: 100 }, { tex: '1000', val: 1000 }]
    : [{ tex: '0{,}1', val: 0.1 }, { tex: '0{,}01', val: 0.01 }];
  const pow = rand(pows);

  // Получаем числовое значение из строки-шаблона
  const numVal = parseFloat(baseTex.replace('{,}', '.').replace('−', '-'));
  const result = isPow10 ? numVal * pow.val : numVal / pow.val;

  const exprLatex = isPow10
    ? `${baseTex} \\cdot ${pow.tex}`
    : `${baseTex} : ${pow.tex}`;
  const resultLatex = fmtDecimal(result);
  return { exprLatex, resultLatex };
}

// Категория 9: деление десятичных дробей
// Пул готовых комбинаций (dividend, divisor) с красивыми результатами
const DECIMAL_DIV_POOL = [
  ['0{,}28', '0{,}4',  0.7],
  ['3{,}5',  '0{,}5',  7],
  ['0{,}24', '6',      0.04],
  ['0{,}36', '0{,}1',  3.6],
  ['7{,}2',  '9',      0.8],
  ['3{,}2',  '0{,}4',  8],
  ['7{,}7',  '7',      1.1],
  ['1{,}6',  '0{,}4',  4],
  ['2{,}4',  '0{,}3',  8],
  ['4{,}5',  '0{,}9',  5],
  ['0{,}48', '0{,}6',  0.8],
  ['1{,}8',  '0{,}6',  3],
  ['0{,}6',  '0{,}15', 4],
  ['2{,}7',  '0{,}9',  3],
  ['0{,}56', '0{,}7',  0.8],
  ['1{,}44', '1{,}2',  1.2],
  ['6{,}3',  '0{,}7',  9],
  ['0{,}35', '0{,}7',  0.5],
  ['4{,}8',  '0{,}8',  6],
  ['0{,}12', '0{,}3',  0.4],
];

function genDecimalDiv() {
  const [a, b, res] = rand(DECIMAL_DIV_POOL);
  const sign = Math.random() < 0.3 ? -1 : 1;
  const aTex = sign < 0 ? `(${sign < 0 ? '-' : ''}${a})` : a;
  const exprLatex = `${aTex} : ${b}`;
  const resultLatex = fmtDecimal(sign * res);
  return { exprLatex, resultLatex };
}

// Категория 10: десятичное ± целое
const DECIMAL_SIMPLE_POOL = [
  ['-10', '+', '2{,}8',  -7.2],
  ['4{,}2', '-', '8',   -3.8],
  ['-5{,}3', '+', '8',   2.7],
  ['3{,}7', '+', '(-6)', -2.3],
  ['12', '-', '4{,}6',   7.4],
  ['-7', '+', '3{,}5',  -3.5],
  ['8{,}4', '-', '12',  -3.6],
  ['-1{,}6', '+', '5',   3.4],
  ['6', '-', '8{,}3',   -2.3],
  ['-4{,}5', '+', '9',   4.5],
  ['15', '-', '6{,}4',   8.6],
  ['-3{,}2', '+', '7',   3.8],
  ['0{,}5', '-', '4',   -3.5],
  ['11', '-', '2{,}7',   8.3],
  ['-8{,}1', '+', '10',  1.9],
];

function genDecimalSimple() {
  const [a, op, b, res] = rand(DECIMAL_SIMPLE_POOL);
  const exprLatex = `${a} ${op} ${b}`;
  const resultLatex = fmtDecimal(res);
  return { exprLatex, resultLatex };
}

// ─── Маппинг категорий ────────────────────────────────────────────────────────
const GENERATORS = {
  fracTimesInt:     genFracTimesInt,
  intDivFrac:       genIntDivFrac,
  fracDivInt:       genFracDivInt,
  fracDivFrac:      genFracDivFrac,
  timesReciprocal:  genTimesReciprocal,
  mixedArith:       genMixedArith,
  decimalPower:     genDecimalPower,
  mulPow10:         genMulPow10,
  decimalDiv:       genDecimalDiv,
  decimalSimple:    genDecimalSimple,
};

export const CATEGORY_LABELS = {
  fracTimesInt:    'Дробь × целое',
  intDivFrac:      'Целое ÷ дробь',
  fracDivInt:      'Дробь ÷ целое',
  fracDivFrac:     'Дробь ÷ дробь',
  timesReciprocal: 'Целое × (1/n)',
  mixedArith:      'Целое ± смешанное',
  decimalPower:    'Степень десятичной',
  mulPow10:        '× / ÷ степень 10',
  decimalDiv:      'Деление десятичных',
  decimalSimple:   'Десятичные ± целое',
};

// ─── Настройки по умолчанию ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,  // 2 варианта на листе A4 (верх/низ)
  sideBySide:     true,   // 2 варианта рядом (лево/право)
  showTeacherKey: true,
  showWorkSpace:  false,
  columnsCount:   2,      // 2 колонки заданий на листе
  fontSize:       's',    // размер шрифта: s | m | l
  decimalOnly:    false,  // только целые / конечные десятичные ответы
  categories: {
    fracTimesInt:    true,
    intDivFrac:      true,
    fracDivInt:      true,
    fracDivFrac:     true,
    timesReciprocal: true,
    mixedArith:      true,
    decimalPower:    true,
    mulPow10:        true,
    decimalDiv:      true,
    decimalSimple:   true,
  },
};

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralCounting() {
  const [title, setTitle]       = useState('Устный счёт');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null);

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...DEFAULT_SETTINGS, ...settings, ...override } : settings;
    const { variantsCount, questionsCount, categories, decimalOnly } = s;

    const enabledCats = Object.entries(categories)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (enabledCats.length === 0) return;

    // При decimalOnly требуется больше попыток — многие категории дают дробные ответы
    const maxFails = decimalOnly ? 600 : 120;

    const variants = Array.from({ length: variantsCount }, () => {
      const questions = [];
      let failCount = 0;
      let catIdx = 0;

      while (questions.length < questionsCount && failCount < maxFails) {
        const cat = enabledCats[catIdx % enabledCats.length];
        catIdx++;
        const gen = GENERATORS[cat];
        if (!gen) { failCount++; continue; }
        const q = gen();
        if (q && (!decimalOnly || isFiniteDecimalAnswer(q.resultLatex))) {
          questions.push({ ...q, cat });
        } else {
          failCount++;
        }
      }
      return questions;
    });

    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
  };
}
