import { useState, useCallback } from 'react';

// ─── Форматирование результата (угол) ─────────────────────────────────────────
const P = Math.PI;
const ARC_RESULTS = [
  [0,        '0'],
  [P / 6,    '\\dfrac{\\pi}{6}'],
  [P / 4,    '\\dfrac{\\pi}{4}'],
  [P / 3,    '\\dfrac{\\pi}{3}'],
  [P / 2,    '\\dfrac{\\pi}{2}'],
  [2 * P / 3,'\\dfrac{2\\pi}{3}'],
  [3 * P / 4,'\\dfrac{3\\pi}{4}'],
  [5 * P / 6,'\\dfrac{5\\pi}{6}'],
  [P,        '\\pi'],
  [-P / 6,   '-\\dfrac{\\pi}{6}'],
  [-P / 4,   '-\\dfrac{\\pi}{4}'],
  [-P / 3,   '-\\dfrac{\\pi}{3}'],
  [-P / 2,   '-\\dfrac{\\pi}{2}'],
  [3 * P / 2,'\\dfrac{3\\pi}{2}'],
  [5 * P / 4,'\\dfrac{5\\pi}{4}'],
  [7 * P / 6,'\\dfrac{7\\pi}{6}'],
  [4 * P / 3,'\\dfrac{4\\pi}{3}'],
];

// Форматирование тригонометрических значений (для вложенных)
const S2 = Math.SQRT2;
const S3 = Math.sqrt(3);
const TRIG_RESULTS = [
  [0, '0'], [1, '1'], [-1, '-1'], [2, '2'], [-2, '-2'],
  [0.5, '\\dfrac{1}{2}'], [-0.5, '-\\dfrac{1}{2}'],
  [S2 / 2, '\\dfrac{\\sqrt{2}}{2}'], [-S2 / 2, '-\\dfrac{\\sqrt{2}}{2}'],
  [S3 / 2, '\\dfrac{\\sqrt{3}}{2}'], [-S3 / 2, '-\\dfrac{\\sqrt{3}}{2}'],
  [S3, '\\sqrt{3}'], [-S3, '-\\sqrt{3}'],
  [S3 / 3, '\\dfrac{\\sqrt{3}}{3}'], [-S3 / 3, '-\\dfrac{\\sqrt{3}}{3}'],
];

function formatArcResult(val, useDegrees) {
  if (!isFinite(val)) return null;
  for (const [v, tex] of ARC_RESULTS) {
    if (Math.abs(val - v) < 1e-7) {
      if (useDegrees) {
        const deg = Math.round(v * 180 / Math.PI);
        return deg === 0 ? '0^{\\circ}' : `${deg}^{\\circ}`;
      }
      return tex;
    }
  }
  return null;
}

function formatTrigResult(val) {
  if (!isFinite(val)) return null;
  for (const [v, tex] of TRIG_RESULTS) {
    if (Math.abs(val - v) < 1e-7) return tex;
  }
  return null;
}

// ─── Данные: таблица значений arcsin/arccos ───────────────────────────────────
// { argNum, argTex, isNeg }
const SINCOS_ARGS = [
  { argNum:  0,      argTex: '0' },
  { argNum:  0.5,    argTex: '\\dfrac{1}{2}' },
  { argNum:  S2 / 2, argTex: '\\dfrac{\\sqrt{2}}{2}' },
  { argNum:  S3 / 2, argTex: '\\dfrac{\\sqrt{3}}{2}' },
  { argNum:  1,      argTex: '1' },
  { argNum: -0.5,    argTex: '-\\dfrac{1}{2}' },
  { argNum: -S2 / 2, argTex: '-\\dfrac{\\sqrt{2}}{2}' },
  { argNum: -S3 / 2, argTex: '-\\dfrac{\\sqrt{3}}{2}' },
  { argNum: -1,      argTex: '-1' },
];

// Таблица значений arctg/arcctg
const TAN_ARGS = [
  { argNum:  0,      argTex: '0' },
  { argNum:  S3 / 3, argTex: '\\dfrac{\\sqrt{3}}{3}' },
  { argNum:  1,      argTex: '1' },
  { argNum:  S3,     argTex: '\\sqrt{3}' },
  { argNum: -S3 / 3, argTex: '-\\dfrac{\\sqrt{3}}{3}' },
  { argNum: -1,      argTex: '-1' },
  { argNum: -S3,     argTex: '-\\sqrt{3}' },
];

// ─── Вычисление значений ──────────────────────────────────────────────────────
function arcsinVal(x) { return Math.asin(x); }
function arccosVal(x) { return Math.acos(x); }
function arctanVal(x) { return Math.atan(x); }
function arccotVal(x) { return Math.PI / 2 - Math.atan(x); }

function evalOuter(fn, angle) {
  if (fn === 'sin') return Math.sin(angle);
  if (fn === 'cos') return Math.cos(angle);
  if (fn === 'tan') {
    const c = Math.cos(angle);
    return Math.abs(c) < 1e-9 ? null : Math.sin(angle) / c;
  }
  if (fn === 'cot') {
    const s = Math.sin(angle);
    return Math.abs(s) < 1e-9 ? null : Math.cos(angle) / s;
  }
  return null;
}

// ─── LaTeX форматирование ─────────────────────────────────────────────────────
function arcFnTex(fn) {
  if (fn === 'arcsin') return '\\arcsin';
  if (fn === 'arccos') return '\\arccos';
  if (fn === 'arctan') return '\\operatorname{arctg}';
  return '\\operatorname{arcctg}';
}

function outerFnTex(fn) {
  if (fn === 'sin') return '\\sin';
  if (fn === 'cos') return '\\cos';
  if (fn === 'tan') return '\\operatorname{tg}';
  return '\\operatorname{ctg}';
}

function formatArcArg(argTex) {
  const isNeg = argTex.startsWith('-');
  if (isNeg) return `\\!\\left(${argTex}\\right)`;
  return `\\,${argTex}`;
}

// ─── Рандом ───────────────────────────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Генераторы заданий ───────────────────────────────────────────────────────

// Тип basic: arcsin(a), arccos(a), arctg(a), arcctg(a)
function genBasic(fns, useDegrees) {
  const tasks = [];
  for (const fn of fns) {
    const pool = (fn === 'arctan' || fn === 'arccot') ? TAN_ARGS : SINCOS_ARGS;
    for (const { argNum, argTex } of pool) {
      let val;
      if (fn === 'arcsin')  val = arcsinVal(argNum);
      else if (fn === 'arccos') val = arccosVal(argNum);
      else if (fn === 'arctan') val = arctanVal(argNum);
      else val = arccotVal(argNum);

      const resultLatex = formatArcResult(val, useDegrees);
      if (!resultLatex) continue;

      const exprLatex = `${arcFnTex(fn)}${formatArcArg(argTex)}`;
      tasks.push({ exprLatex, resultLatex });
    }
  }
  return tasks;
}

// Тип sum: arcfn1(a) ± arcfn2(b)
function genSum(fns, useDegrees, maxTries = 200) {
  const results = [];
  for (let t = 0; t < maxTries; t++) {
    const fn1 = rand(fns);
    const fn2 = rand(fns);
    const pool1 = (fn1 === 'arctan' || fn1 === 'arccot') ? TAN_ARGS : SINCOS_ARGS;
    const pool2 = (fn2 === 'arctan' || fn2 === 'arccot') ? TAN_ARGS : SINCOS_ARGS;
    const a1 = rand(pool1);
    const a2 = rand(pool2);
    const sign = rand([1, -1]);

    let v1, v2;
    if (fn1 === 'arcsin')  v1 = arcsinVal(a1.argNum);
    else if (fn1 === 'arccos') v1 = arccosVal(a1.argNum);
    else if (fn1 === 'arctan') v1 = arctanVal(a1.argNum);
    else v1 = arccotVal(a1.argNum);

    if (fn2 === 'arcsin')  v2 = arcsinVal(a2.argNum);
    else if (fn2 === 'arccos') v2 = arccosVal(a2.argNum);
    else if (fn2 === 'arctan') v2 = arctanVal(a2.argNum);
    else v2 = arccotVal(a2.argNum);

    const total = v1 + sign * v2;
    const resultLatex = formatArcResult(total, useDegrees);
    if (!resultLatex) continue;

    // Не брать тривиальные: fn1=fn2, a1=a2, sign=-1 → 0
    if (Math.abs(total) < 1e-9 && fn1 === fn2 && Math.abs(a1.argNum - a2.argNum) < 1e-9) continue;

    const term1 = `${arcFnTex(fn1)}${formatArcArg(a1.argTex)}`;
    const term2 = `${arcFnTex(fn2)}${formatArcArg(a2.argTex)}`;
    const exprLatex = sign === 1
      ? `${term1} + ${term2}`
      : `${term1} - ${term2}`;
    results.push({ exprLatex, resultLatex });
    if (results.length >= 60) break;
  }
  return results;
}

// Тип nested: outerFn(arcfn(a))
function genNested(outerFns, arcFns) {
  const results = [];
  for (const arc of arcFns) {
    const pool = (arc === 'arctan' || arc === 'arccot') ? TAN_ARGS : SINCOS_ARGS;
    for (const { argNum, argTex } of pool) {
      for (const outer of outerFns) {
        let angle;
        if (arc === 'arcsin')  angle = arcsinVal(argNum);
        else if (arc === 'arccos') angle = arccosVal(argNum);
        else if (arc === 'arctan') angle = arctanVal(argNum);
        else angle = arccotVal(argNum);

        const val = evalOuter(outer, angle);
        if (val === null) continue;

        const resultLatex = formatTrigResult(val);
        if (!resultLatex) continue;

        const innerTex = `${arcFnTex(arc)}${formatArcArg(argTex)}`;
        const exprLatex = `${outerFnTex(outer)}\\!\\left(${innerTex}\\right)`;
        results.push({ exprLatex, resultLatex });
      }
    }
  }
  return results;
}

// ─── Настройки по умолчанию ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount:  4,
  questionsCount: 6,
  taskType:       'basic',    // 'basic' | 'sum' | 'nested' | 'mixed'
  useArcsin:      true,
  useArccos:      true,
  useArctan:      false,
  useArccot:      false,
  useOuterSin:    true,
  useOuterCos:    true,
  useOuterTan:    false,
  useOuterCot:    false,
  useDegrees:     false,      // градусная мера угла
  showTeacherKey: true,
  twoPerPage:     false,
  showWorkSpace:  false,
  workSpaceSize:  20,
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateInverseTrigVariants(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const {
    variantsCount, questionsCount, taskType,
    useArcsin, useArccos, useArctan, useArccot,
    useOuterSin, useOuterCos, useOuterTan, useOuterCot,
    useDegrees,
  } = s;
  const arcFns = [
    useArcsin && 'arcsin', useArccos && 'arccos',
    useArctan && 'arctan', useArccot && 'arccot',
  ].filter(Boolean);
  if (arcFns.length === 0) return [];
  const outerFns = [
    useOuterSin && 'sin', useOuterCos && 'cos',
    useOuterTan && 'tan', useOuterCot && 'cot',
  ].filter(Boolean);
  let pool = [];
  if (taskType === 'basic'  || taskType === 'mixed') pool.push(...genBasic(arcFns, useDegrees));
  if (taskType === 'sum'    || taskType === 'mixed') pool.push(...genSum(arcFns, useDegrees));
  if ((taskType === 'nested' || taskType === 'mixed') && outerFns.length > 0) {
    pool.push(...genNested(outerFns, arcFns));
  }
  if (pool.length === 0) return [];
  return Array.from({ length: variantsCount }, () => {
    const shuffled = shuffle(pool);
    return shuffled.slice(0, Math.min(questionsCount, shuffled.length));
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useInverseTrig() {
  const [title, setTitle] = useState('Вычислите значения выражений');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null);

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const {
      variantsCount, questionsCount, taskType,
      useArcsin, useArccos, useArctan, useArccot,
      useOuterSin, useOuterCos, useOuterTan, useOuterCot,
      useDegrees,
    } = s;

    const arcFns = [
      useArcsin && 'arcsin', useArccos && 'arccos',
      useArctan && 'arctan', useArccot && 'arccot',
    ].filter(Boolean);
    if (arcFns.length === 0) return;

    const outerFns = [
      useOuterSin && 'sin', useOuterCos && 'cos',
      useOuterTan && 'tan', useOuterCot && 'cot',
    ].filter(Boolean);

    // Формируем полный пул заданий по типу
    let pool = [];
    if (taskType === 'basic' || taskType === 'mixed') pool.push(...genBasic(arcFns, useDegrees));
    if (taskType === 'sum'   || taskType === 'mixed') pool.push(...genSum(arcFns, useDegrees));
    if ((taskType === 'nested' || taskType === 'mixed') && outerFns.length > 0) {
      pool.push(...genNested(outerFns, arcFns)); // nested: результат — число, не угол
    }
    if (pool.length === 0) return;

    const variants = Array.from({ length: variantsCount }, () => {
      const shuffled = shuffle(pool);
      return shuffled.slice(0, Math.min(questionsCount, shuffled.length));
    });

    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Вычислите значения выражений');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return { title, setTitle, settings, updateSetting, tasksData, generate, reset };
}
