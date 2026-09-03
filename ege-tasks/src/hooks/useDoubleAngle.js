import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── Таблица значений sin/cos/tan для стандартных углов ──────────────────────
const STD = {
  '-60': { sin: '-\\dfrac{\\sqrt{3}}{2}', cos: '\\dfrac{1}{2}',           tan: '-\\sqrt{3}',           sinV: -Math.sqrt(3)/2, cosV: 0.5 },
  '-45': { sin: '-\\dfrac{\\sqrt{2}}{2}', cos: '\\dfrac{\\sqrt{2}}{2}',   tan: '-1',                   sinV: -Math.SQRT2/2,   cosV: Math.SQRT2/2 },
  '-30': { sin: '-\\dfrac{1}{2}',          cos: '\\dfrac{\\sqrt{3}}{2}',   tan: '-\\dfrac{\\sqrt{3}}{3}', sinV: -0.5,            cosV: Math.sqrt(3)/2 },
  '0':   { sin: '0',                       cos: '1',                        tan: '0',                    sinV: 0,               cosV: 1 },
  '30':  { sin: '\\dfrac{1}{2}',           cos: '\\dfrac{\\sqrt{3}}{2}',   tan: '\\dfrac{\\sqrt{3}}{3}', sinV: 0.5,             cosV: Math.sqrt(3)/2 },
  '45':  { sin: '\\dfrac{\\sqrt{2}}{2}',   cos: '\\dfrac{\\sqrt{2}}{2}',   tan: '1',                    sinV: Math.SQRT2/2,    cosV: Math.SQRT2/2 },
  '60':  { sin: '\\dfrac{\\sqrt{3}}{2}',   cos: '\\dfrac{1}{2}',           tan: '\\sqrt{3}',            sinV: Math.sqrt(3)/2,  cosV: 0.5 },
  '90':  { sin: '1',                       cos: '0',                        tan: null,                   sinV: 1,               cosV: 0 },
  '120': { sin: '\\dfrac{\\sqrt{3}}{2}',   cos: '-\\dfrac{1}{2}',          tan: '-\\sqrt{3}',           sinV: Math.sqrt(3)/2,  cosV: -0.5 },
  '135': { sin: '\\dfrac{\\sqrt{2}}{2}',   cos: '-\\dfrac{\\sqrt{2}}{2}',  tan: '-1',                   sinV: Math.SQRT2/2,    cosV: -Math.SQRT2/2 },
  '150': { sin: '\\dfrac{1}{2}',           cos: '-\\dfrac{\\sqrt{3}}{2}',  tan: '-\\dfrac{\\sqrt{3}}{3}', sinV: 0.5,           cosV: -Math.sqrt(3)/2 },
  '180': { sin: '0',                       cos: '-1',                       tan: '0',                    sinV: 0,               cosV: -1 },
};

// Двойные углы — стандартные результаты (2*α):
// sin 2α = 2 sin α cos α
// cos 2α = cos²α − sin²α = 2cos²α − 1 = 1 − 2sin²α
// tan 2α = 2 tan α / (1 − tan²α)

const NICE_TEX = {
  '0':                    '0',
  '1':                    '1',
  '-1':                   '-1',
  '0.5':                  '\\dfrac{1}{2}',
  '-0.5':                 '-\\dfrac{1}{2}',
  [String(Math.SQRT2/2)]: '\\dfrac{\\sqrt{2}}{2}',
  [String(-Math.SQRT2/2)]:'-\\dfrac{\\sqrt{2}}{2}',
  [String(Math.sqrt(3)/2)]:  '\\dfrac{\\sqrt{3}}{2}',
  [String(-Math.sqrt(3)/2)]: '-\\dfrac{\\sqrt{3}}{2}',
  [String(Math.sqrt(3))]:    '\\sqrt{3}',
  [String(-Math.sqrt(3))]:   '-\\sqrt{3}',
  [String(Math.sqrt(3)/3)]:  '\\dfrac{\\sqrt{3}}{3}',
  [String(-Math.sqrt(3)/3)]: '-\\dfrac{\\sqrt{3}}{3}',
  [String(Math.sqrt(6)/4)]:  '\\dfrac{\\sqrt{6}}{4}',
  [String(-Math.sqrt(6)/4)]: '-\\dfrac{\\sqrt{6}}{4}',
  [String((Math.sqrt(6)+Math.sqrt(2))/4)]: '\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}',
  [String((Math.sqrt(6)-Math.sqrt(2))/4)]: '\\dfrac{\\sqrt{6}-\\sqrt{2}}{4}',
  [String((-Math.sqrt(6)+Math.sqrt(2))/4)]: '\\dfrac{\\sqrt{2}-\\sqrt{6}}{4}',
  [String(-(Math.sqrt(6)+Math.sqrt(2))/4)]: '-\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}',
};

function niceVal(v) {
  if (!isFinite(v) || isNaN(v)) return null;
  const key = String(v);
  if (NICE_TEX[key]) return NICE_TEX[key];
  // поиск с округлением
  const S2 = Math.SQRT2, S3 = Math.sqrt(3), S6 = Math.sqrt(6);
  const candidates = [
    [0, '0'], [1, '1'], [-1, '-1'],
    [0.5, '\\dfrac{1}{2}'], [-0.5, '-\\dfrac{1}{2}'],
    [S2/2, '\\dfrac{\\sqrt{2}}{2}'], [-S2/2, '-\\dfrac{\\sqrt{2}}{2}'],
    [S3/2, '\\dfrac{\\sqrt{3}}{2}'], [-S3/2, '-\\dfrac{\\sqrt{3}}{2}'],
    [S3,   '\\sqrt{3}'],             [-S3,   '-\\sqrt{3}'],
    [S3/3, '\\dfrac{\\sqrt{3}}{3}'], [-S3/3, '-\\dfrac{\\sqrt{3}}{3}'],
    [S6/4, '\\dfrac{\\sqrt{6}}{4}'], [-S6/4, '-\\dfrac{\\sqrt{6}}{4}'],
    [(S6+S2)/4, '\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}'],
    [(S6-S2)/4, '\\dfrac{\\sqrt{6}-\\sqrt{2}}{4}'],
    [(-S6+S2)/4, '\\dfrac{\\sqrt{2}-\\sqrt{6}}{4}'],
    [-(S6+S2)/4, '-\\dfrac{\\sqrt{6}+\\sqrt{2}}{4}'],
    [2+S3, `2+\\sqrt{3}`], [2-S3, `2-\\sqrt{3}`],
    [-(2+S3), `-(2+\\sqrt{3})`],
  ];
  for (const [num, tex] of candidates) {
    if (Math.abs(v - num) < 1e-9) return tex;
  }
  return null;
}

// ─── ТИП 1: числовое вычисление — форм. двойного угла ────────────────────────
// Таблица: полуугол → { sin 2α, cos 2α, tan 2α } в LaTeX
// Включаем «нестандартные» полуугла: 15°, 75°, 105° (их двойные 30°, 150°, 210°)

const DOUBLE_RESULTS = {
  '15':  { sin: '\\dfrac{1}{2}',              cos: '\\dfrac{\\sqrt{3}}{2}',  tan: '\\dfrac{\\sqrt{3}}{3}' },  // 30°
  '30':  { sin: '\\dfrac{\\sqrt{3}}{2}',      cos: '\\dfrac{1}{2}',          tan: '\\sqrt{3}' },               // 60°
  '45':  { sin: '1',                           cos: '0',                       tan: null },                     // 90°
  '60':  { sin: '\\dfrac{\\sqrt{3}}{2}',      cos: '-\\dfrac{1}{2}',         tan: '-\\sqrt{3}' },              // 120°
  '75':  { sin: '\\dfrac{1}{2}',              cos: '-\\dfrac{\\sqrt{3}}{2}', tan: '-\\dfrac{\\sqrt{3}}{3}' }, // 150°
  '90':  { sin: '0',                           cos: '-1',                      tan: '0' },                      // 180°
  '105': { sin: '-\\dfrac{1}{2}',             cos: '-\\dfrac{\\sqrt{3}}{2}', tan: '\\dfrac{\\sqrt{3}}{3}' },  // 210°
};

const HALF_ANGLES = Object.keys(DOUBLE_RESULTS).map(Number);

function genNumericTask(funcs, incSin, incCos, incTan) {
  const ops = [
    ...(incSin ? ['sin'] : []),
    ...(incCos ? ['cos'] : []),
    ...(incTan ? ['tan'] : []),
  ].filter(f => funcs.includes(f));
  if (!ops.length) return null;

  const fn = rand(ops);
  const halfDegs = HALF_ANGLES.filter(d => {
    if (fn === 'tan') return DOUBLE_RESULTS[String(d)].tan !== null;
    return true;
  });
  if (!halfDegs.length) return null;

  const half = rand(halfDegs);
  const hS = `${half}^{\\circ}`;
  const tg = '\\operatorname{tg}';

  const entry = DOUBLE_RESULTS[String(half)];
  let exprLatex, resultLatex;

  if (fn === 'sin') {
    exprLatex   = `2\\sin ${hS}\\cos ${hS}`;
    resultLatex = entry.sin;
  } else if (fn === 'cos') {
    const form = rand(['diff', 'cos2', 'sin2']);
    if (form === 'diff') {
      exprLatex = `\\cos^2 ${hS} - \\sin^2 ${hS}`;
    } else if (form === 'cos2') {
      exprLatex = `2\\cos^2 ${hS} - 1`;
    } else {
      exprLatex = `1 - 2\\sin^2 ${hS}`;
    }
    resultLatex = entry.cos;
  } else {
    // tan: 2tg(α) / (1 − tg²(α))
    exprLatex   = `\\dfrac{2${tg}\\,${hS}}{1-${tg}^2 ${hS}}`;
    resultLatex = entry.tan;
  }

  return { exprLatex, resultLatex };
}

// ─── ТИП 2: символьное упрощение ─────────────────────────────────────────────
// Пример: 2sin 3x cos 3x = sin 6x

const VARS = ['\\alpha', 'x', 't', '\\varphi', '\\beta'];

function coef(k) { return k === 1 ? '' : `${k}`; }

function genSymbolicTask(funcs, incSin, incCos, incTan) {
  const ops = [
    ...(incSin ? ['sin'] : []),
    ...(incCos ? ['cos'] : []),
    ...(incTan ? ['tan'] : []),
  ].filter(f => funcs.includes(f));
  if (!ops.length) return null;

  const fn = rand(ops);
  const v  = rand(VARS);
  const n  = randInt(1, 8);
  const tg = '\\operatorname{tg}';

  const argS  = n === 1 ? v : `${n}${v}`;
  const arg2S = `${2*n}${v}`;

  let exprLatex, resultLatex;

  if (fn === 'sin') {
    exprLatex   = `2\\sin ${argS}\\cos ${argS}`;
    resultLatex = `\\sin ${arg2S}`;
  } else if (fn === 'cos') {
    const form = rand(['diff', 'cos2', 'sin2']);
    if (form === 'diff') {
      exprLatex   = `\\cos^2 ${argS} - \\sin^2 ${argS}`;
    } else if (form === 'cos2') {
      exprLatex   = `2\\cos^2 ${argS} - 1`;
    } else {
      exprLatex   = `1 - 2\\sin^2 ${argS}`;
    }
    resultLatex = `\\cos ${arg2S}`;
  } else {
    exprLatex   = `\\dfrac{2${tg}\\,${argS}}{1-${tg}^2 ${argS}}`;
    resultLatex = `${tg}\\,${arg2S}`;
  }

  return { exprLatex, resultLatex };
}

// ─── ТИП 3: смешанная форма ───────────────────────────────────────────────────
// Используем разные формы: например cos²t - sin²t или  cos²t + sin²t → 1 → нет
// Задачи на распознавание формул в нестандартном виде

const MIXED_POOL = [
  // (cos α + sin α)² = 1 + 2sinα cosα = 1 + sin 2α
  { funcs: ['sin','cos'], exprLatex: '(\\cos\\,{V} + \\sin\\,{V})^2', resultLatex: '1 + \\sin\\,{2V}' },
  // (cos α − sin α)² = 1 − sin 2α
  { funcs: ['sin','cos'], exprLatex: '(\\cos\\,{V} - \\sin\\,{V})^2', resultLatex: '1 - \\sin\\,{2V}' },
  // sin α cos α = ½ sin 2α
  { funcs: ['sin','cos'], exprLatex: '\\sin\\,{V}\\cos\\,{V}',        resultLatex: '\\dfrac{1}{2}\\sin\\,{2V}' },
  // cos²α = ½(1 + cos 2α)
  { funcs: ['cos'],       exprLatex: '\\cos^2\\,{V}',                 resultLatex: '\\dfrac{1+\\cos\\,{2V}}{2}' },
  // sin²α = ½(1 − cos 2α)
  { funcs: ['sin'],       exprLatex: '\\sin^2\\,{V}',                 resultLatex: '\\dfrac{1-\\cos\\,{2V}}{2}' },
  // 2cos²α − 1 = cos 2α
  { funcs: ['cos'],       exprLatex: '2\\cos^2\\,{V} - 1',            resultLatex: '\\cos\\,{2V}' },
  // 1 − 2sin²α = cos 2α
  { funcs: ['sin'],       exprLatex: '1 - 2\\sin^2\\,{V}',            resultLatex: '\\cos\\,{2V}' },
  // cos²α − sin²α = cos 2α
  { funcs: ['sin','cos'], exprLatex: '\\cos^2\\,{V} - \\sin^2\\,{V}', resultLatex: '\\cos\\,{2V}' },
  // ½(cos 2α + 1) = cos²α
  { funcs: ['cos'],       exprLatex: '\\dfrac{\\cos\\,{2V}+1}{2}',    resultLatex: '\\cos^2\\,{V}' },
  // ½(1 − cos 2α) = sin²α
  { funcs: ['sin'],       exprLatex: '\\dfrac{1-\\cos\\,{2V}}{2}',    resultLatex: '\\sin^2\\,{V}' },
];

function genMixedTask(funcs) {
  const avail = MIXED_POOL.filter(p => p.funcs.every(f => funcs.includes(f)));
  if (!avail.length) return null;
  const p = rand(avail);
  const v = rand(VARS);
  const n = rand([1, 2, 3]);
  const argS  = n === 1 ? v : `${n}${v}`;
  const arg2S = `${2*n}${v}`;
  return {
    exprLatex:   p.exprLatex.replaceAll('{V}', argS).replaceAll('{2V}', arg2S),
    resultLatex: p.resultLatex.replaceAll('{V}', argS).replaceAll('{2V}', arg2S),
  };
}

// ─── Генерация одного варианта ────────────────────────────────────────────────

function generateVariant({ count, taskTypes, funcs, incSin, incCos, incTan }) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    const type = rand(taskTypes);
    let task = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      if (type === 'numeric')  task = genNumericTask(funcs, incSin, incCos, incTan);
      else if (type === 'symbolic') task = genSymbolicTask(funcs, incSin, incCos, incTan);
      else                     task = genMixedTask(funcs);
      if (task) break;
    }
    tasks.push(task || { exprLatex: '?', resultLatex: '?' });
  }
  return tasks;
}

// ─── Настройки по умолчанию ───────────────────────────────────────────────────

export const DEFAULT_DA_SETTINGS = {
  taskTypes:       ['numeric', 'symbolic'],
  funcs:           ['sin', 'cos'],
  incSin:          true,
  incCos:          true,
  incTan:          false,
  variantsCount:   4,
  tasksPerVariant: 8,
  twoPerPage:      false,
  showTeacherKey:  true,
  showWorkSpace:   false,
  workSpaceSize:   30,
};

// ─── Хук ─────────────────────────────────────────────────────────────────────

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateDoubleAngleVariants(settings) {
  const s = { ...DEFAULT_DA_SETTINGS, ...settings };
  const { variantsCount, tasksPerVariant, taskTypes, funcs, incSin, incCos, incTan } = s;
  if (!taskTypes?.length || !funcs?.length) return [];
  return Array.from({ length: variantsCount }, () =>
    generateVariant({ count: tasksPerVariant, taskTypes, funcs, incSin, incCos, incTan })
  );
}

export function useDoubleAngle() {
  const [title, setTitle] = useState('Формулы двойного аргумента');
  const [settings, setSettings] = useState(DEFAULT_DA_SETTINGS);
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_DA_SETTINGS });

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const { variantsCount, tasksPerVariant, taskTypes, funcs, incSin, incCos, incTan } = s;
    if (!taskTypes.length || !funcs.length) return;
    const data = Array.from({ length: variantsCount }, () =>
      generateVariant({ count: tasksPerVariant, taskTypes, funcs, incSin, incCos, incTan })
    );
    setTasksData(data);
  }, [settings]);

  const reset = useCallback(() => setTasksData(null), []);

  return {
    title, setTitle, settings, updateSetting, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
