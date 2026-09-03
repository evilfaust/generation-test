import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const STANDARD_DEG = new Set([0,30,45,60,90,120,135,150,180,210,225,240,270,300,315,330,360]);
const isStd = d => STANDARD_DEG.has(((d % 360) + 360) % 360);

// ─── Значения в стандартных углах ─────────────────────────────────────────────
const STD = {
  '-60': { sin: '-\\dfrac{\\sqrt{3}}{2}', cos: '\\dfrac{1}{2}',              tan: '-\\sqrt{3}' },
  '-45': { sin: '-\\dfrac{\\sqrt{2}}{2}', cos: '\\dfrac{\\sqrt{2}}{2}',      tan: '-1' },
  '-30': { sin: '-\\dfrac{1}{2}',          cos: '\\dfrac{\\sqrt{3}}{2}',      tan: '-\\dfrac{1}{\\sqrt{3}}' },
  '0':   { sin: '0',                       cos: '1',                          tan: '0' },
  '30':  { sin: '\\dfrac{1}{2}',           cos: '\\dfrac{\\sqrt{3}}{2}',      tan: '\\dfrac{1}{\\sqrt{3}}' },
  '45':  { sin: '\\dfrac{\\sqrt{2}}{2}',   cos: '\\dfrac{\\sqrt{2}}{2}',      tan: '1' },
  '60':  { sin: '\\dfrac{\\sqrt{3}}{2}',   cos: '\\dfrac{1}{2}',              tan: '\\sqrt{3}' },
  '90':  { sin: '1',                       cos: '0',                          tan: null },
  '120': { sin: '\\dfrac{\\sqrt{3}}{2}',   cos: '-\\dfrac{1}{2}',             tan: '-\\sqrt{3}' },
  '135': { sin: '\\dfrac{\\sqrt{2}}{2}',   cos: '-\\dfrac{\\sqrt{2}}{2}',     tan: '-1' },
  '150': { sin: '\\dfrac{1}{2}',           cos: '-\\dfrac{\\sqrt{3}}{2}',     tan: '-\\dfrac{1}{\\sqrt{3}}' },
  '180': { sin: '0',                       cos: '-1',                         tan: '0' },
};

// ─── Тип 1: числовое значение (A,B нестандартны, A±B — стандарт) ──────────────

function genSplit(target) {
  const cands = [];
  for (let a = 1; a < target; a++) {
    const b = target - a;
    if (b > 0 && b < 180 && !isStd(a) && !isStd(b) && a !== b) cands.push([a, b]);
  }
  return cands.length ? rand(cands) : null;
}

function genSplitDiff(target) {
  const cands = [];
  for (let b = 1; b <= 89; b++) {
    const a = target + b;
    if (a <= 179 && !isStd(a) && !isStd(b)) cands.push([a, b]);
  }
  return cands.length ? rand(cands) : null;
}

const SUM_TARGETS  = [30, 45, 60, 90, 120, 150, 180];
const DIFF_TARGETS = [30, 45, 60, 90];

function genFormulaEvalTask(funcs, incSum, incDiff) {
  const ops = [...(incSum ? ['sum'] : []), ...(incDiff ? ['diff'] : [])];
  if (!ops.length) return null;
  const op = rand(ops);

  // Выбираем функцию (тангенс допустим только при target ≠ 90 для суммы)
  const func = rand(funcs);

  const rawTargets = op === 'sum' ? SUM_TARGETS : DIFF_TARGETS;
  const validTargets = rawTargets.filter(t => {
    if (func === 'tan' && t === 90) return false;
    return STD[String(t)]?.[func] != null;
  });
  if (!validTargets.length) return null;

  const target = rand(validTargets);
  const split = op === 'sum' ? genSplit(target) : genSplitDiff(target);
  if (!split) return null;
  const [A, B] = split; // A+B=target (sum) or A-B=target (diff)

  let exprLatex;
  const tg = '\\operatorname{tg}';
  const AS = `${A}^{\\circ}`, BS = `${B}^{\\circ}`;

  if (func === 'sin') {
    exprLatex = op === 'sum'
      ? `\\sin ${AS}\\cos ${BS} + \\cos ${AS}\\sin ${BS}`
      : `\\sin ${AS}\\cos ${BS} - \\cos ${AS}\\sin ${BS}`;
  } else if (func === 'cos') {
    exprLatex = op === 'sum'
      ? `\\cos ${AS}\\cos ${BS} - \\sin ${AS}\\sin ${BS}`
      : `\\cos ${AS}\\cos ${BS} + \\sin ${AS}\\sin ${BS}`;
  } else { // tan
    exprLatex = op === 'sum'
      ? `\\dfrac{${tg}${AS} + ${tg}${BS}}{1 - ${tg}${AS}\\,${tg}${BS}}`
      : `\\dfrac{${tg}${AS} - ${tg}${BS}}{1 + ${tg}${AS}\\,${tg}${BS}}`;
  }

  return { exprLatex, resultLatex: STD[String(target)][func] };
}

// ─── Тип 2: символьное упрощение (переменные) ─────────────────────────────────

const VARS = ['\\alpha', '\\beta', 'x', 'y', '\\varphi', 't'];

const FORMULAS = ['sin_sum', 'sin_diff', 'cos_sum', 'cos_diff'];

function coef(k, v) { return k === 1 ? v : `${k}${v}`; }

function genSymbolicTask(funcs) {
  let n, m;
  do { n = randInt(1, 7); m = randInt(1, 7); } while (n === m || n + m > 12);

  const v = rand(VARS);
  const validFormulas = FORMULAS.filter(f =>
    !(f.startsWith('sin') && !funcs.includes('sin')) &&
    !(f.startsWith('cos') && !funcs.includes('cos'))
  );
  const f = rand(validFormulas.length ? validFormulas : FORMULAS);

  const nv = coef(n, v), mv = coef(m, v);
  const kSum  = n + m;
  const kDiff = Math.abs(n - m);
  const sumV  = coef(kSum, v);
  const diffV = coef(kDiff, v);

  let exprLatex, resultLatex;
  if (f === 'sin_sum') {
    exprLatex   = `\\sin ${nv}\\cos ${mv} + \\cos ${nv}\\sin ${mv}`;
    resultLatex = `\\sin ${sumV}`;
  } else if (f === 'sin_diff') {
    exprLatex   = `\\sin ${nv}\\cos ${mv} - \\cos ${nv}\\sin ${mv}`;
    resultLatex = n > m ? `\\sin ${diffV}` : `-\\sin ${diffV}`;
  } else if (f === 'cos_sum') {
    exprLatex   = `\\cos ${nv}\\cos ${mv} - \\sin ${nv}\\sin ${mv}`;
    resultLatex = `\\cos ${sumV}`;
  } else {
    exprLatex   = `\\cos ${nv}\\cos ${mv} + \\sin ${nv}\\sin ${mv}`;
    resultLatex = `\\cos ${diffV}`;
  }
  return { exprLatex, resultLatex };
}

// ─── Тип 3: нестандартные углы (75°, 15°, 105°, …) ───────────────────────────
// Показываем угол с подсказкой разложения; ответ — точное иррациональное значение

const NONSTANDARD_POOL = [
  { func:'sin', angle:75,  decompDeg:'45+30',  decomp:'45^{\\circ}+30^{\\circ}', result:'\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}' },
  { func:'cos', angle:75,  decompDeg:'45+30',  decomp:'45^{\\circ}+30^{\\circ}', result:'\\dfrac{\\sqrt{6}-\\sqrt{2}}{4}' },
  { func:'sin', angle:15,  decompDeg:'45-30',  decomp:'45^{\\circ}-30^{\\circ}', result:'\\dfrac{\\sqrt{6}-\\sqrt{2}}{4}' },
  { func:'cos', angle:15,  decompDeg:'45-30',  decomp:'45^{\\circ}-30^{\\circ}', result:'\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}' },
  { func:'sin', angle:105, decompDeg:'60+45',  decomp:'60^{\\circ}+45^{\\circ}', result:'\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}' },
  { func:'cos', angle:105, decompDeg:'60+45',  decomp:'60^{\\circ}+45^{\\circ}', result:'\\dfrac{\\sqrt{2}-\\sqrt{6}}{4}' },
  { func:'sin', angle:165, decompDeg:'120+45', decomp:'120^{\\circ}+45^{\\circ}',result:'\\dfrac{\\sqrt{6}-\\sqrt{2}}{4}' },
  { func:'cos', angle:165, decompDeg:'120+45', decomp:'120^{\\circ}+45^{\\circ}',result:'-\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}' },
  { func:'tan', angle:75,  decompDeg:'45+30',  decomp:'45^{\\circ}+30^{\\circ}', result:'2+\\sqrt{3}' },
  { func:'tan', angle:15,  decompDeg:'45-30',  decomp:'45^{\\circ}-30^{\\circ}', result:'2-\\sqrt{3}' },
  { func:'tan', angle:105, decompDeg:'60+45',  decomp:'60^{\\circ}+45^{\\circ}', result:'-(2+\\sqrt{3})' },
  // Дополнительно с использованием вычитания
  { func:'sin', angle:75,  decompDeg:'30+45',  decomp:'30^{\\circ}+45^{\\circ}', result:'\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}' },
  { func:'cos', angle:15,  decompDeg:'60-45',  decomp:'60^{\\circ}-45^{\\circ}', result:'\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}' },
  { func:'sin', angle:15,  decompDeg:'60-45',  decomp:'60^{\\circ}-45^{\\circ}', result:'\\dfrac{\\sqrt{6}-\\sqrt{2}}{4}' },
  { func:'cos', angle:75,  decompDeg:'30+45',  decomp:'30^{\\circ}+45^{\\circ}', result:'\\dfrac{\\sqrt{6}-\\sqrt{2}}{4}' },
];

function genNonstandardTask(funcs, showHint) {
  const avail = NONSTANDARD_POOL.filter(p => funcs.includes(p.func));
  if (!avail.length) return null;
  const p = rand(avail);
  const fn = p.func === 'tan' ? '\\operatorname{tg}' : `\\${p.func}`;
  const expr = showHint
    ? `${fn}\\,${p.angle}^{\\circ}\\;\\bigl(${p.angle}^{\\circ}=${p.decomp}\\bigr)`
    : `${fn}\\,${p.angle}^{\\circ}`;
  return { exprLatex: expr, resultLatex: p.result };
}

// ─── Вариант ──────────────────────────────────────────────────────────────────

function generateVariant({ count, taskTypes, funcs, incSum, incDiff, showHint }) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    const type = rand(taskTypes);
    let task = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (type === 'formula_eval') task = genFormulaEvalTask(funcs, incSum, incDiff);
      else if (type === 'symbolic')  task = genSymbolicTask(funcs);
      else                           task = genNonstandardTask(funcs, showHint);
      if (task) break;
    }
    tasks.push(task || { exprLatex: '?', resultLatex: '?' });
  }
  return tasks;
}

// ─── Хук ──────────────────────────────────────────────────────────────────────

export const DEFAULT_AF_SETTINGS = {
  taskTypes: ['formula_eval', 'symbolic', 'nonstandard'],
  funcs: ['sin', 'cos', 'tan'],
  incSum: true,
  incDiff: true,
  variantsCount: 4,
  tasksPerVariant: 10,
  showHint: false,
  twoPerPage: false,
  showTeacherKey: true,
  showWorkSpace: false,
  workSpaceSize: 30,
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateAdditionFormulasVariants(settings) {
  const s = { ...DEFAULT_AF_SETTINGS, ...settings };
  const { variantsCount, tasksPerVariant, taskTypes, funcs, incSum, incDiff, showHint } = s;
  if (!taskTypes?.length || !funcs?.length) return [];
  return Array.from({ length: variantsCount }, () =>
    generateVariant({ count: tasksPerVariant, taskTypes, funcs, incSum, incDiff, showHint })
  );
}

export function useAdditionFormulas() {
  const [title, setTitle] = useState('Формулы сложения');
  const [settings, setSettings] = useState(DEFAULT_AF_SETTINGS);
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_AF_SETTINGS });

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const { variantsCount, tasksPerVariant, taskTypes, funcs, incSum, incDiff, showHint } = s;
    if (!taskTypes.length || !funcs.length) return;
    const data = Array.from({ length: variantsCount }, () =>
      generateVariant({ count: tasksPerVariant, taskTypes, funcs, incSum, incDiff, showHint })
    );
    setTasksData(data);
  }, [settings]);

  const reset = useCallback(() => setTasksData(null), []);

  return {
    title, setTitle, settings, updateSetting, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
