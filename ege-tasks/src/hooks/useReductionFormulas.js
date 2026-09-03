import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const FUNC_LATEX = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\operatorname{tg}',
  cot: '\\operatorname{ctg}',
};

// ─── Таблица формул приведения: f(n·π/2 ± α) ──────────────────────────────────
// map: для каждой функции → [знак, новая функция]
const BASIC_TABLE = [
  { n:1, plus:false, map:{ sin:[+1,'cos'], cos:[+1,'sin'], tan:[+1,'cot'], cot:[+1,'tan'] } },
  { n:1, plus:true,  map:{ sin:[+1,'cos'], cos:[-1,'sin'], tan:[-1,'cot'], cot:[-1,'tan'] } },
  { n:2, plus:false, map:{ sin:[+1,'sin'], cos:[-1,'cos'], tan:[-1,'tan'], cot:[-1,'cot'] } },
  { n:2, plus:true,  map:{ sin:[-1,'sin'], cos:[-1,'cos'], tan:[+1,'tan'], cot:[+1,'cot'] } },
  { n:3, plus:false, map:{ sin:[-1,'cos'], cos:[-1,'sin'], tan:[+1,'cot'], cot:[+1,'tan'] } },
  { n:3, plus:true,  map:{ sin:[-1,'cos'], cos:[+1,'sin'], tan:[-1,'cot'], cot:[-1,'tan'] } },
  { n:4, plus:false, map:{ sin:[-1,'sin'], cos:[+1,'cos'], tan:[-1,'tan'], cot:[-1,'cot'] } },
  { n:4, plus:true,  map:{ sin:[+1,'sin'], cos:[+1,'cos'], tan:[+1,'tan'], cot:[+1,'cot'] } },
];

// ─── Таблица перевёрнутого аргумента: f(α − n·π/2) ────────────────────────────
const REVERSED_TABLE = [
  { n:1, map:{ sin:[-1,'cos'], cos:[+1,'sin'], tan:[-1,'cot'], cot:[-1,'tan'] } },
  { n:2, map:{ sin:[-1,'sin'], cos:[-1,'cos'], tan:[+1,'tan'], cot:[+1,'cot'] } },
  { n:3, map:{ sin:[+1,'cos'], cos:[-1,'sin'], tan:[-1,'cot'], cot:[-1,'tan'] } },
];

const BASE_DEG = { 1:'90', 2:'180', 3:'270', 4:'360' };
const BASE_RAD = { 1:'\\dfrac{\\pi}{2}', 2:'\\pi', 3:'\\dfrac{3\\pi}{2}', 4:'2\\pi' };

function angleBasicLatex(n, plus, radians) {
  const base = radians ? BASE_RAD[n] : BASE_DEG[n] + '^{\\circ}';
  return plus ? `${base} + \\alpha` : `${base} - \\alpha`;
}

function angleReversedLatex(n, radians) {
  const base = radians ? BASE_RAD[n] : BASE_DEG[n] + '^{\\circ}';
  return `\\alpha - ${base}`;
}

function answerLatex(sign, func) {
  return (sign < 0 ? '-' : '') + FUNC_LATEX[func] + '\\,\\alpha';
}

function genBasicTask(funcs, radians) {
  const row = rand(BASIC_TABLE);
  const func = rand(funcs);
  const [sign, newFunc] = row.map[func];
  return {
    exprLatex: `${FUNC_LATEX[func]}\\!\\left(${angleBasicLatex(row.n, row.plus, radians)}\\right)`,
    resultLatex: answerLatex(sign, newFunc),
  };
}

function genReversedTask(funcs, radians) {
  const row = rand(REVERSED_TABLE);
  const func = rand(funcs);
  const [sign, newFunc] = row.map[func];
  return {
    exprLatex: `${FUNC_LATEX[func]}\\!\\left(${angleReversedLatex(row.n, radians)}\\right)`,
    resultLatex: answerLatex(sign, newFunc),
  };
}

// ─── Числовые задачи: a√3 × f(угол) = целое ───────────────────────────────────
// type: 'sqrt3half' → trig = ±√3/2, 'sqrt3' → trig = ±√3, 'inv_sqrt3' → trig = ±1/√3
const SQRT3_PATTERNS = [
  { func:'sin', base:60,  period:360, type:'sqrt3half', sign:+1 },
  { func:'sin', base:120, period:360, type:'sqrt3half', sign:+1 },
  { func:'sin', base:240, period:360, type:'sqrt3half', sign:-1 },
  { func:'sin', base:300, period:360, type:'sqrt3half', sign:-1 },
  { func:'cos', base:30,  period:360, type:'sqrt3half', sign:+1 },
  { func:'cos', base:150, period:360, type:'sqrt3half', sign:-1 },
  { func:'cos', base:210, period:360, type:'sqrt3half', sign:-1 },
  { func:'cos', base:330, period:360, type:'sqrt3half', sign:+1 },
  { func:'tan', base:60,  period:180, type:'sqrt3',     sign:+1 },
  { func:'tan', base:120, period:180, type:'sqrt3',     sign:-1 },
  { func:'cot', base:30,  period:180, type:'sqrt3',     sign:+1 },
  { func:'cot', base:150, period:180, type:'sqrt3',     sign:-1 },
  { func:'tan', base:30,  period:180, type:'inv_sqrt3', sign:+1 },
  { func:'tan', base:150, period:180, type:'inv_sqrt3', sign:-1 },
  { func:'cot', base:60,  period:180, type:'inv_sqrt3', sign:+1 },
  { func:'cot', base:120, period:180, type:'inv_sqrt3', sign:-1 },
];

// ─── Числовые задачи: a√2 × f(угол) = целое ───────────────────────────────────
const SQRT2_PATTERNS = [
  { func:'sin', base:45,  period:360, sign:+1 },
  { func:'sin', base:135, period:360, sign:+1 },
  { func:'sin', base:225, period:360, sign:-1 },
  { func:'sin', base:315, period:360, sign:-1 },
  { func:'cos', base:45,  period:360, sign:+1 },
  { func:'cos', base:135, period:360, sign:-1 },
  { func:'cos', base:225, period:360, sign:-1 },
  { func:'cos', base:315, period:360, sign:+1 },
];

// ─── Числовые задачи: a·ctg(A°)·ctg(B°), A+B=90° ─────────────────────────────
const NON_STD = [7,11,13,17,19,22,23,28,29,31,34,37,38,39,41,43,46,47,49,52,53,56,58,61,62,64,67,68,71,73,76,77,79,83];

function degStr(d) {
  return d < 0 ? `(${d}^{\\circ})` : `${d}^{\\circ}`;
}

function numFmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', '{,}');
}

function genSqrt3Task(funcs) {
  const avail = SQRT3_PATTERNS.filter(p => funcs.includes(p.func));
  if (!avail.length) return null;
  const p = rand(avail);
  const sign = rand([-1, 1]);
  const k = randInt(1, 3);
  const angle = p.base + sign * k * p.period;

  let coef, result;
  if (p.type === 'sqrt3half') {
    const m = randInt(1, 7);        // result = ±3m (целое)
    coef = 2 * m;
    result = p.sign * 3 * m;
  } else if (p.type === 'sqrt3') {
    const c = randInt(1, 6);
    coef = c;
    result = p.sign * 3 * c;
  } else {                          // inv_sqrt3: result = ±coef
    const c = randInt(2, 9);
    coef = c;
    result = p.sign * c;
  }

  const coefLatex = coef === 1 ? '\\sqrt{3}' : `${coef}\\sqrt{3}`;
  return {
    exprLatex: `${coefLatex}\\,${FUNC_LATEX[p.func]}\\,${degStr(angle)}`,
    resultLatex: String(result),
  };
}

function genSqrt2Task(funcs) {
  const avail = SQRT2_PATTERNS.filter(p => funcs.includes(p.func));
  if (!avail.length) return null;
  const p = rand(avail);
  const sign = rand([-1, 1]);
  const k = randInt(1, 3);
  const angle = p.base + sign * k * 360;

  const c = randInt(1, 8);
  const result = p.sign * c;
  const coefLatex = c === 1 ? '\\sqrt{2}' : `${c}\\sqrt{2}`;
  return {
    exprLatex: `${coefLatex}\\,${FUNC_LATEX[p.func]}\\,${degStr(angle)}`,
    resultLatex: String(result),
  };
}

function genComplementaryTask(funcs) {
  const hasCot = funcs.includes('cot');
  const hasTan = funcs.includes('tan');
  if (!hasCot && !hasTan) return null;
  const funcType = (hasCot && hasTan) ? rand(['cot','tan']) : hasCot ? 'cot' : 'tan';

  const theta = rand(NON_STD);
  const comp = 90 - theta;
  const kA = randInt(0, 2);
  const kB = randInt(0, 2);
  const A = theta + kA * 180;
  const B = comp  + kB * 180;

  const useHalf = Math.random() < 0.25;
  const base = useHalf ? (randInt(1, 8) + 0.5) : randInt(2, 12);
  const fl = FUNC_LATEX[funcType];

  return {
    exprLatex: `${numFmt(base)}\\,${fl}\\,${A}^{\\circ}\\cdot${fl}\\,${B}^{\\circ}`,
    resultLatex: numFmt(base),
  };
}

function genNumericTask(funcs, numPatterns) {
  const pool = [];
  if (numPatterns.sqrt3) pool.push('sqrt3');
  if (numPatterns.sqrt2) pool.push('sqrt2');
  if (numPatterns.complementary) pool.push('comp');
  if (!pool.length) pool.push('sqrt3');

  for (let attempt = 0; attempt < 10; attempt++) {
    const type = rand(pool);
    const t =
      type === 'sqrt3' ? genSqrt3Task(funcs) :
      type === 'sqrt2' ? genSqrt2Task(funcs) :
      genComplementaryTask(funcs);
    if (t) return t;
  }
  return genSqrt3Task(['sin', 'cos', 'tan', 'cot']) || { exprLatex: '?', resultLatex: '?' };
}

// ─── Вариант ──────────────────────────────────────────────────────────────────
function generateVariant({ count, taskTypes, funcs, angleMode, numPatterns }) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    const type = rand(taskTypes);
    const radians =
      angleMode === 'radians' ? true :
      angleMode === 'degrees' ? false :
      Math.random() < 0.5;

    if (type === 'basic')    tasks.push(genBasicTask(funcs, radians));
    else if (type === 'reversed') tasks.push(genReversedTask(funcs, radians));
    else tasks.push(genNumericTask(funcs, numPatterns));
  }
  return tasks;
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export const DEFAULT_RF_SETTINGS = {
  taskTypes: ['basic', 'reversed', 'numeric'],
  funcs: ['sin', 'cos', 'tan', 'cot'],
  angleMode: 'both',        // 'radians' | 'degrees' | 'both'
  variantsCount: 4,
  tasksPerVariant: 10,
  numPatterns: { sqrt3: true, sqrt2: true, complementary: true },
  twoPerPage: false,
  showTeacherKey: true,
  showWorkSpace: false,
  workSpaceSize: 25,
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateReductionFormulasVariants(settings) {
  const s = { ...DEFAULT_RF_SETTINGS, ...settings };
  const { variantsCount, tasksPerVariant, taskTypes, funcs, angleMode, numPatterns } = s;
  if (!taskTypes?.length || !funcs?.length) return [];
  return Array.from({ length: variantsCount }, () =>
    generateVariant({ count: tasksPerVariant, taskTypes, funcs, angleMode, numPatterns })
  );
}

export function useReductionFormulas() {
  const [title, setTitle] = useState('Формулы приведения');
  const [settings, setSettings] = useState(DEFAULT_RF_SETTINGS);
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_RF_SETTINGS });

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const { variantsCount, tasksPerVariant, taskTypes, funcs, angleMode, numPatterns } = s;
    if (!taskTypes.length || !funcs.length) return;

    const data = Array.from({ length: variantsCount }, () =>
      generateVariant({ count: tasksPerVariant, taskTypes, funcs, angleMode, numPatterns })
    );
    setTasksData(data);
  }, [settings]);

  const reset = useCallback(() => setTasksData(null), []);

  return {
    title, setTitle, settings, updateSetting, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
