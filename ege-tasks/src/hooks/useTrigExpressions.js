import { useState, useCallback } from 'react';

// ─── Вспомогательные функции ─────────────────────────────────────────────────
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Стандартные углы в пределах ±2π ─────────────────────────────────────────
const STD_ANGLES = [
  { num:  0, den: 1  }, // 0
  { num:  1, den: 6  }, // π/6
  { num:  1, den: 4  }, // π/4
  { num:  1, den: 3  }, // π/3
  { num:  1, den: 2  }, // π/2
  { num:  2, den: 3  }, // 2π/3
  { num:  3, den: 4  }, // 3π/4
  { num:  5, den: 6  }, // 5π/6
  { num:  1, den: 1  }, // π
  { num:  7, den: 6  }, // 7π/6
  { num:  5, den: 4  }, // 5π/4
  { num:  4, den: 3  }, // 4π/3
  { num:  3, den: 2  }, // 3π/2
  { num:  5, den: 3  }, // 5π/3
  { num:  7, den: 4  }, // 7π/4
  { num: 11, den: 6  }, // 11π/6
  { num:  2, den: 1  }, // 2π
  { num: -1, den: 6  }, // -π/6
  { num: -1, den: 4  }, // -π/4
  { num: -1, den: 3  }, // -π/3
  { num: -1, den: 2  }, // -π/2
  { num: -2, den: 3  }, // -2π/3
  { num: -3, den: 4  }, // -3π/4
  { num: -5, den: 6  }, // -5π/6
  { num: -1, den: 1  }, // -π
  { num: -7, den: 6  }, // -7π/6
  { num: -5, den: 4  }, // -5π/4
  { num: -4, den: 3  }, // -4π/3
  { num: -3, den: 2  }, // -3π/2
  { num: -5, den: 3  }, // -5π/3
  { num: -7, den: 4  }, // -7π/4
  { num:-11, den: 6  }, // -11π/6
  { num: -2, den: 1  }, // -2π
];

// ─── Вычисление значения тригонометрической функции ─────────────────────────
function evalFn(fn, num, den) {
  const theta = (num / den) * Math.PI;
  if (fn === 'sin') return Math.sin(theta);
  if (fn === 'cos') return Math.cos(theta);
  if (fn === 'tan') {
    const c = Math.cos(theta);
    return Math.abs(c) < 1e-9 ? null : Math.sin(theta) / c;
  }
  if (fn === 'cot') {
    const s = Math.sin(theta);
    return Math.abs(s) < 1e-9 ? null : Math.cos(theta) / s;
  }
  return null;
}

// ─── Красивые значения для ответа ────────────────────────────────────────────
const S2 = Math.SQRT2;
const S3 = Math.sqrt(3);
const NICE = [
  [0, '0'],
  [1, '1'],   [-1, '-1'],
  [2, '2'],   [-2, '-2'],
  [3, '3'],   [-3, '-3'],
  [4, '4'],   [-4, '-4'],
  [0.5, '\\dfrac{1}{2}'],          [-0.5, '-\\dfrac{1}{2}'],
  [1.5, '\\dfrac{3}{2}'],          [-1.5, '-\\dfrac{3}{2}'],
  [2.5, '\\dfrac{5}{2}'],          [-2.5, '-\\dfrac{5}{2}'],
  [0.25, '\\dfrac{1}{4}'],         [-0.25, '-\\dfrac{1}{4}'],
  [0.75, '\\dfrac{3}{4}'],         [-0.75, '-\\dfrac{3}{4}'],
  [S2 / 2, '\\dfrac{\\sqrt{2}}{2}'],       [-S2 / 2, '-\\dfrac{\\sqrt{2}}{2}'],
  [S2, '\\sqrt{2}'],               [-S2, '-\\sqrt{2}'],
  [2 * S2, '2\\sqrt{2}'],          [-2 * S2, '-2\\sqrt{2}'],
  [3 * S2 / 2, '\\dfrac{3\\sqrt{2}}{2}'],  [-3 * S2 / 2, '-\\dfrac{3\\sqrt{2}}{2}'],
  [S2 / 4, '\\dfrac{\\sqrt{2}}{4}'],       [-S2 / 4, '-\\dfrac{\\sqrt{2}}{4}'],
  [S3 / 2, '\\dfrac{\\sqrt{3}}{2}'],       [-S3 / 2, '-\\dfrac{\\sqrt{3}}{2}'],
  [S3, '\\sqrt{3}'],               [-S3, '-\\sqrt{3}'],
  [2 * S3, '2\\sqrt{3}'],          [-2 * S3, '-2\\sqrt{3}'],
  [S3 / 3, '\\dfrac{\\sqrt{3}}{3}'],       [-S3 / 3, '-\\dfrac{\\sqrt{3}}{3}'],
  [2 * S3 / 3, '\\dfrac{2\\sqrt{3}}{3}'],  [-2 * S3 / 3, '-\\dfrac{2\\sqrt{3}}{3}'],
  [S3 * S2 / 2, '\\dfrac{\\sqrt{6}}{2}'],  [-S3 * S2 / 2, '-\\dfrac{\\sqrt{6}}{2}'],
  [S3 * S2 / 4, '\\dfrac{\\sqrt{6}}{4}'],  [-S3 * S2 / 4, '-\\dfrac{\\sqrt{6}}{4}'],
  [S3 / 4, '\\dfrac{\\sqrt{3}}{4}'],       [-S3 / 4, '-\\dfrac{\\sqrt{3}}{4}'],
];

function formatResult(val) {
  if (!isFinite(val) || isNaN(val)) return null;
  for (const [v, latex] of NICE) {
    if (Math.abs(val - v) < 1e-6) return latex;
  }
  return null;
}

// ─── Форматирование угла в теле выражения ────────────────────────────────────
function formatAngleInExpr(num, den, useDegrees) {
  if (num === 0) return { body: useDegrees ? '0^{\\circ}' : '0', isNeg: false };
  const isNeg = num < 0;
  const absN = Math.abs(num);
  if (useDegrees) {
    const deg = Math.round(absN * 180 / den);
    return { body: `${deg}^{\\circ}`, isNeg };
  }
  const g = gcd(absN, den);
  const n = absN / g;
  const d = den / g;
  let body;
  if (d === 1) body = n === 1 ? '\\pi' : `${n}\\pi`;
  else if (n === 1) body = `\\dfrac{\\pi}{${d}}`;
  else body = `\\dfrac{${n}\\pi}{${d}}`;
  return { body, isNeg };
}

// ─── Форматирование одного терма ─────────────────────────────────────────────
function formatTermLatex(fn, num, den, useDegrees) {
  const fnTex = fn === 'sin' ? '\\sin'
              : fn === 'cos' ? '\\cos'
              : fn === 'tan' ? '\\operatorname{tg}'
              : '\\operatorname{ctg}';
  const { body, isNeg } = formatAngleInExpr(num, den, useDegrees);
  if (isNeg) return `${fnTex}\\!\\left(-${body}\\right)`;
  return `${fnTex}\\,${body}`;
}

// ─── Ключ терма для дедупликации ─────────────────────────────────────────────
function termKey(fn, num, den) {
  const g = gcd(Math.abs(num), den);
  return `${fn}_${num / g}_${den / g}`;
}

// ─── Генерация одного выражения ──────────────────────────────────────────────
function generateExpression(type, termsCount, fns, anglePool, maxTries = 400, useDegrees = false) {
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const terms = [];
    const usedKeys = new Set();
    let valid = true;

    for (let i = 0; i < termsCount; i++) {
      const fn = rand(fns);
      let angle, val, t = 0, key;
      do {
        angle = rand(anglePool);
        val = evalFn(fn, angle.num, angle.den);
        key = termKey(fn, angle.num, angle.den);
        t++;
      } while ((val === null || usedKeys.has(key)) && t < 40);

      if (val === null) { valid = false; break; }
      usedKeys.add(key);
      terms.push({ fn, num: angle.num, den: angle.den, val });
    }

    if (!valid) continue;

    let total, exprLatex;

    if (type === 'product') {
      total = terms.reduce((acc, t) => acc * t.val, 1);
      exprLatex = terms.map(t => formatTermLatex(t.fn, t.num, t.den, useDegrees)).join(' \\cdot ');
    } else {
      // sum: первый терм со знаком «+» (т.е. без знака), остальные случайно
      const signs = [1, ...Array.from({ length: termsCount - 1 }, () => rand([1, -1]))];
      total = terms.reduce((acc, t, i) => acc + signs[i] * t.val, 0);
      exprLatex = terms
        .map((t, i) => {
          const termLatex = formatTermLatex(t.fn, t.num, t.den, useDegrees);
          if (i === 0) return termLatex;
          return signs[i] === 1 ? ` + ${termLatex}` : ` - ${termLatex}`;
        })
        .join('');
    }

    const resultLatex = formatResult(total);
    if (!resultLatex) continue;

    return { exprLatex, resultLatex };
  }
  return null;
}

// ─── Настройки по умолчанию ──────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount:   4,
  questionsCount:  6,
  taskType:        'sum',      // 'sum' | 'product' | 'mixed'
  termsCount:      3,
  useSin:          true,
  useCos:          true,
  useTan:          false,
  useCot:          false,
  useNegAngles:    true,
  useDegrees:      false,      // градусная мера угла
  showTeacherKey:  true,
  twoPerPage:      false,      // 2 варианта на одной A4
  showWorkSpace:   false,
  workSpaceSize:   20,
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateTrigExpressionsVariants(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const {
    variantsCount, questionsCount, taskType, termsCount,
    useSin, useCos, useTan, useCot, useNegAngles, useDegrees,
  } = s;
  const fns = [useSin && 'sin', useCos && 'cos', useTan && 'tan', useCot && 'cot'].filter(Boolean);
  if (fns.length === 0) return [];
  const anglePool = useNegAngles ? STD_ANGLES : STD_ANGLES.filter(a => a.num >= 0);
  return Array.from({ length: variantsCount }, () => {
    const questions = [];
    let failCount = 0;
    while (questions.length < questionsCount && failCount < 60) {
      let type = taskType;
      if (type === 'mixed') type = questions.length % 2 === 0 ? 'sum' : 'product';
      const expr = generateExpression(type, termsCount, fns, anglePool, 400, useDegrees);
      if (expr) questions.push(expr);
      else failCount++;
    }
    return questions;
  });
}

// ─── Хук ─────────────────────────────────────────────────────────────────────
export function useTrigExpressions() {
  const [title, setTitle] = useState('Вычислите значения выражений');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null);

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const {
      variantsCount, questionsCount, taskType, termsCount,
      useSin, useCos, useTan, useCot, useNegAngles, useDegrees,
    } = s;

    const fns = [useSin && 'sin', useCos && 'cos', useTan && 'tan', useCot && 'cot'].filter(Boolean);
    if (fns.length === 0) return;

    const anglePool = useNegAngles
      ? STD_ANGLES
      : STD_ANGLES.filter(a => a.num >= 0);

    const variants = Array.from({ length: variantsCount }, () => {
      const questions = [];
      let failCount = 0;

      while (questions.length < questionsCount && failCount < 60) {
        let type = taskType;
        if (type === 'mixed') {
          // чередуем: чётные — сумма, нечётные — произведение
          type = questions.length % 2 === 0 ? 'sum' : 'product';
        }
        const expr = generateExpression(type, termsCount, fns, anglePool, 400, useDegrees);
        if (expr) questions.push(expr);
        else failCount++;
      }

      return questions;
    });

    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Вычислите значения выражений');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting,
    tasksData,
    generate, reset,
  };
}
