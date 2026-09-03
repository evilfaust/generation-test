import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';

// ─── Таблица уравнений sin t = a ──────────────────────────────────────────────
// Для каждого a: главное решение (arcsin a) + общая формула
// Формат: { a, aTex, answer1Tex, answer2Tex, generalTex }
// answer1 = arcsin(a),  answer2 = π − arcsin(a)
// Общая формула: t = (-1)^n · arcsin(a) + πn, n ∈ ℤ

const SIN_ENTRIES = [
  {
    a: 0, aTex: '0',
    generalTex: 't = \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: 1, aTex: '1',
    generalTex: 't = \\dfrac{\\pi}{2} + 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -1, aTex: '-1',
    generalTex: 't = -\\dfrac{\\pi}{2} + 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: 0.5, aTex: '\\dfrac{1}{2}',
    generalTex: 't = (-1)^n \\dfrac{\\pi}{6} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -0.5, aTex: '-\\dfrac{1}{2}',
    generalTex: 't = (-1)^n \\left(-\\dfrac{\\pi}{6}\\right) + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: Math.SQRT2 / 2, aTex: '\\dfrac{\\sqrt{2}}{2}',
    generalTex: 't = (-1)^n \\dfrac{\\pi}{4} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -Math.SQRT2 / 2, aTex: '-\\dfrac{\\sqrt{2}}{2}',
    generalTex: 't = (-1)^n \\left(-\\dfrac{\\pi}{4}\\right) + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: Math.sqrt(3) / 2, aTex: '\\dfrac{\\sqrt{3}}{2}',
    generalTex: 't = (-1)^n \\dfrac{\\pi}{3} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -Math.sqrt(3) / 2, aTex: '-\\dfrac{\\sqrt{3}}{2}',
    generalTex: 't = (-1)^n \\left(-\\dfrac{\\pi}{3}\\right) + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
];

// ─── Таблица уравнений cos t = a ──────────────────────────────────────────────
// Общая формула: t = ± arccos(a) + 2πn, n ∈ ℤ

const COS_ENTRIES = [
  {
    a: 0, aTex: '0',
    generalTex: 't = \\dfrac{\\pi}{2} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: 1, aTex: '1',
    generalTex: 't = 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -1, aTex: '-1',
    generalTex: 't = \\pi + 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: 0.5, aTex: '\\dfrac{1}{2}',
    generalTex: 't = \\pm\\dfrac{\\pi}{3} + 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -0.5, aTex: '-\\dfrac{1}{2}',
    generalTex: 't = \\pm\\dfrac{2\\pi}{3} + 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: Math.SQRT2 / 2, aTex: '\\dfrac{\\sqrt{2}}{2}',
    generalTex: 't = \\pm\\dfrac{\\pi}{4} + 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -Math.SQRT2 / 2, aTex: '-\\dfrac{\\sqrt{2}}{2}',
    generalTex: 't = \\pm\\dfrac{3\\pi}{4} + 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: Math.sqrt(3) / 2, aTex: '\\dfrac{\\sqrt{3}}{2}',
    generalTex: 't = \\pm\\dfrac{\\pi}{6} + 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -Math.sqrt(3) / 2, aTex: '-\\dfrac{\\sqrt{3}}{2}',
    generalTex: 't = \\pm\\dfrac{5\\pi}{6} + 2\\pi n, \\quad n \\in \\mathbb{Z}',
  },
];

// ─── Таблица уравнений tg t = a ───────────────────────────────────────────────
// Общая формула: t = arctan(a) + πn, n ∈ ℤ

const TAN_ENTRIES = [
  {
    a: 0, aTex: '0',
    generalTex: 't = \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: 1, aTex: '1',
    generalTex: 't = \\dfrac{\\pi}{4} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -1, aTex: '-1',
    generalTex: 't = -\\dfrac{\\pi}{4} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: Math.sqrt(3) / 3, aTex: '\\dfrac{\\sqrt{3}}{3}',
    generalTex: 't = \\dfrac{\\pi}{6} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -Math.sqrt(3) / 3, aTex: '-\\dfrac{\\sqrt{3}}{3}',
    generalTex: 't = -\\dfrac{\\pi}{6} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: Math.sqrt(3), aTex: '\\sqrt{3}',
    generalTex: 't = \\dfrac{\\pi}{3} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -Math.sqrt(3), aTex: '-\\sqrt{3}',
    generalTex: 't = -\\dfrac{\\pi}{3} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
];

// ─── Таблица уравнений ctg t = a ──────────────────────────────────────────────
// Общая формула: t = arccot(a) + πn, n ∈ ℤ

const COT_ENTRIES = [
  {
    a: 0, aTex: '0',
    generalTex: 't = \\dfrac{\\pi}{2} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: 1, aTex: '1',
    generalTex: 't = \\dfrac{\\pi}{4} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -1, aTex: '-1',
    generalTex: 't = -\\dfrac{\\pi}{4} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: Math.sqrt(3) / 3, aTex: '\\dfrac{\\sqrt{3}}{3}',
    generalTex: 't = \\dfrac{\\pi}{3} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -Math.sqrt(3) / 3, aTex: '-\\dfrac{\\sqrt{3}}{3}',
    generalTex: 't = -\\dfrac{\\pi}{3} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: Math.sqrt(3), aTex: '\\sqrt{3}',
    generalTex: 't = \\dfrac{\\pi}{6} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
  {
    a: -Math.sqrt(3), aTex: '-\\sqrt{3}',
    generalTex: 't = -\\dfrac{\\pi}{6} + \\pi n, \\quad n \\in \\mathbb{Z}',
  },
];

// ─── LaTeX форматирование функций ─────────────────────────────────────────────
function fnTex(fn) {
  if (fn === 'sin') return '\\sin';
  if (fn === 'cos') return '\\cos';
  if (fn === 'tan') return '\\operatorname{tg}';
  return '\\operatorname{ctg}';
}

function entriesFor(fn) {
  if (fn === 'sin') return SIN_ENTRIES;
  if (fn === 'cos') return COS_ENTRIES;
  if (fn === 'tan') return TAN_ENTRIES;
  return COT_ENTRIES;
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

// ─── Генерация вариантов с гарантированным балансом функций ──────────────────
// Квоты делятся поровну между включёнными функциями; пул каждой функции
// перемешивается заранее для всех вариантов → нет повторов ни внутри варианта,
// ни между вариантами (пока хватает записей).
function generateVariants({ variantsCount, questionsCount, fns }) {
  if (!fns.length) return [];

  // Квота каждой функции в одном варианте (распределяем остаток по первым функциям)
  const base      = Math.floor(questionsCount / fns.length);
  const remainder = questionsCount % fns.length;
  const quotas    = fns.map((_, i) => base + (i < remainder ? 1 : 0));

  // Для каждой функции строим пул достаточной длины (без повторов внутри одного прохода)
  const fnPools = fns.map((fn, fi) => {
    const entries = entriesFor(fn);
    const needed  = quotas[fi] * variantsCount;
    let pool = [];
    // Повторяем перемешанные записи пока не наберём нужное количество
    while (pool.length < needed) pool = [...pool, ...shuffle([...entries])];
    return pool;
  });

  // Собираем варианты: каждый вариант берёт свою «порцию» из каждого пула
  return Array.from({ length: variantsCount }, (_, vi) => {
    const tasks = [];
    fns.forEach((fn, fi) => {
      const start = vi * quotas[fi];
      fnPools[fi].slice(start, start + quotas[fi]).forEach(entry => {
        tasks.push({
          exprLatex:   `${fnTex(fn)}\\, t = ${entry.aTex}`,
          resultLatex: entry.generalTex,
        });
      });
    });
    // Перемешиваем задания внутри варианта, чтобы функции не шли группами
    return shuffle(tasks);
  });
}

// ─── Настройки по умолчанию ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount:  4,
  questionsCount: 6,
  useSin:         true,
  useCos:         true,
  useTan:         false,
  useCot:         false,
  showTeacherKey: true,
  twoPerPage:     false,
  showWorkSpace:  false,
  workSpaceSize:  30,
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateTrigEquationsVariants(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const { variantsCount, questionsCount, useSin, useCos, useTan, useCot } = s;
  const fns = [
    useSin && 'sin', useCos && 'cos',
    useTan && 'tan', useCot && 'cot',
  ].filter(Boolean);
  if (fns.length === 0) return [];
  return generateVariants({ variantsCount, questionsCount, fns });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useTrigEquations() {
  const [title, setTitle] = useState('Простейшие тригонометрические уравнения');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const { variantsCount, questionsCount, useSin, useCos, useTan, useCot } = s;

    const fns = [
      useSin && 'sin', useCos && 'cos',
      useTan && 'tan', useCot && 'cot',
    ].filter(Boolean);
    if (fns.length === 0) return;

    const variants = generateVariants({ variantsCount, questionsCount, fns });
    if (!variants.length) return;

    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Простейшие тригонометрические уравнения');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    title, setTitle, settings, updateSetting, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
