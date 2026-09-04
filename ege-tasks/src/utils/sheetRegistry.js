// Реестр листовых генераторов — единый справочник «тип листа → генератор».
//
// Нужен сохранённым листам (коллекция `generator_sheets`): по типу из записи
// надо знать, как лист называется, на какой странице открывается, как
// подписаны категории заданий и какой чистой функцией догенерировать одно
// задание взамен неудачного.
//
// Ключи типов совпадают с `generator_type` тестов A/B/C/D (TrigMCSaveModal) —
// один лист может дать и печатный вариант, и тест, и метка у них общая.

import {
  generateOralCountingVariants,
  CATEGORY_LABELS as CL_ORAL,
} from '../hooks/useOralCounting';
import {
  generateEgeBaseVariants,
  CATEGORY_LABELS_EGE,
} from '../hooks/useOralEgeBase';
import {
  generateFractionsVariants,
  CATEGORY_LABELS_FR,
} from '../hooks/useOralFractions';
import {
  generateLogarithmsVariants,
  CATEGORY_LABELS_LOG,
} from '../hooks/useOralLogarithms';
import {
  generatePowersRootsVariants,
  CATEGORY_LABELS_PR,
} from '../hooks/useOralPowersRoots';
import {
  generateLogExpVariants,
  CATEGORY_LABELS_LOGEXP,
} from '../hooks/useLogExpEquations';
import {
  generateLinearEquationVariants,
  CATEGORY_LABELS_LINEQ,
} from '../hooks/useLinearEquations';
import {
  generateQuadraticVariants,
  CATEGORY_LABELS_QUAD,
} from '../hooks/useQuadraticEquations';
import {
  generateQuadraticInequalityVariants,
  CATEGORY_LABELS_QINEQ,
} from '../hooks/useQuadraticInequalities';
import {
  generateLinearInequalityVariants,
  CATEGORY_LABELS_INEQ,
} from '../hooks/useLinearInequalities';
import {
  generateDoubleInequalityVariants,
  CATEGORY_LABELS_DBL,
} from '../hooks/useDoubleInequalities';
import { generateTrigExpressionsVariants }      from '../hooks/useTrigExpressions';
import { generateInverseTrigVariants }          from '../hooks/useInverseTrig';
import { generateReductionFormulasVariants }    from '../hooks/useReductionFormulas';
import { generateAdditionFormulasVariants }     from '../hooks/useAdditionFormulas';
import { generateTrigEquationsVariants }        from '../hooks/useTrigEquations';
import { generateDoubleAngleVariants }          from '../hooks/useDoubleAngle';
import { generateTrigEquationsAdvancedVariants } from '../hooks/useTrigEquationsAdvanced';

// Пути дублируются строками намеренно: реестр лежит в utils/ и не может
// импортировать R из App.jsx (циклическая зависимость). Синхронность
// сторожит юнит-тест sheetRegistry.test.js — он сверяет пути с App.jsx.
export const SHEET_GENERATORS = {
  // ── Арифметика (устный счёт) ──
  oral_counting: {
    label: 'Устный счёт: арифметика',
    route: '/app/arith/oral-counting',
    instruction: 'Вычислите:',
    categoryLabels: CL_ORAL,
    generate: generateOralCountingVariants,
  },
  oral_ege_base: {
    label: 'Устный счёт: действия с десятичными',
    route: '/app/arith/ege-base',
    instruction: 'Вычислите:',
    categoryLabels: CATEGORY_LABELS_EGE,
    generate: generateEgeBaseVariants,
  },
  oral_fractions: {
    label: 'Устный счёт: дроби',
    route: '/app/arith/fractions',
    instruction: 'Вычислите:',
    categoryLabels: CATEGORY_LABELS_FR,
    generate: generateFractionsVariants,
  },
  oral_powers_roots: {
    label: 'Устный счёт: степени и корни',
    route: '/app/arith/powers-roots',
    instruction: 'Вычислите:',
    categoryLabels: CATEGORY_LABELS_PR,
    generate: generatePowersRootsVariants,
  },
  oral_logarithms: {
    label: 'Устный счёт: логарифмы',
    route: '/app/arith/logarithms',
    instruction: 'Вычислите:',
    categoryLabels: CATEGORY_LABELS_LOG,
    generate: generateLogarithmsVariants,
  },
  log_exp_equations: {
    label: 'Степени и логарифмы: уравнения',
    route: '/app/arith/log-exp',
    instruction: 'Решите уравнение:',
    categoryLabels: CATEGORY_LABELS_LOGEXP,
    generate: generateLogExpVariants,
  },

  // ── Уравнения и неравенства ──
  linear_equations: {
    label: 'Линейные уравнения',
    route: '/app/equations/linear',
    instruction: 'Решите уравнение:',
    categoryLabels: CATEGORY_LABELS_LINEQ,
    generate: generateLinearEquationVariants,
  },
  quadratic_equations: {
    label: 'Квадратные уравнения',
    route: '/app/equations/quadratic',
    instruction: 'Решите уравнение:',
    categoryLabels: CATEGORY_LABELS_QUAD,
    generate: generateQuadraticVariants,
  },
  quadratic_inequalities: {
    label: 'Квадратные неравенства',
    route: '/app/equations/quadratic-inequalities',
    instruction: 'Решите неравенство:',
    categoryLabels: CATEGORY_LABELS_QINEQ,
    generate: generateQuadraticInequalityVariants,
  },
  linear_inequalities: {
    label: 'Линейные неравенства',
    route: '/app/equations/inequalities',
    instruction: 'Решите неравенство:',
    categoryLabels: CATEGORY_LABELS_INEQ,
    generate: generateLinearInequalityVariants,
  },
  double_inequalities: {
    label: 'Двойные неравенства',
    route: '/app/equations/double-inequalities',
    instruction: 'Решите двойное неравенство:',
    categoryLabels: CATEGORY_LABELS_DBL,
    generate: generateDoubleInequalityVariants,
  },

  // ── Тригонометрия ──
  trig_expressions: {
    label: 'Вычисление выражений',
    route: '/app/trig/expressions',
    instruction: 'Вычислите:',
    generate: generateTrigExpressionsVariants,
  },
  inverse_trig: {
    label: 'Обратные функции',
    route: '/app/trig/inverse',
    instruction: 'Вычислите:',
    generate: generateInverseTrigVariants,
  },
  trig_equations: {
    label: 'Простейшие уравнения',
    route: '/app/trig/equations',
    instruction: 'Решите уравнение:',
    generate: generateTrigEquationsVariants,
  },
  trig_equations_advanced: {
    label: 'Уравнения f(kx+b)=a',
    route: '/app/trig/equations-advanced',
    instruction: 'Решите уравнение:',
    generate: generateTrigEquationsAdvancedVariants,
  },
  reduction_formulas: {
    label: 'Формулы приведения',
    route: '/app/trig/reduction',
    instruction: 'Упростите выражение:',
    generate: generateReductionFormulasVariants,
  },
  addition_formulas: {
    label: 'Формулы сложения',
    route: '/app/trig/addition',
    instruction: 'Вычислите или упростите:',
    generate: generateAdditionFormulasVariants,
  },
  double_angle: {
    label: 'Двойной аргумент',
    route: '/app/trig/double-angle',
    instruction: 'Вычислите или упростите:',
    generate: generateDoubleAngleVariants,
  },

  // ── Смешанные работы (несколько разделов на листе) ──
  // Снимок другой формы: kind='sections', перегенерация одного задания
  // недоступна (задание принадлежит разделу, а не плоскому списку).
  oral_mixed: {
    label: 'Смешанная работа: устный счёт',
    route: '/app/arith/mixed',
    kind: 'sections',
  },
  trig_mixed: {
    label: 'Смешанная работа: тригонометрия',
    route: '/app/trig/mixed',
    kind: 'sections',
  },
};

export const SHEET_GENERATOR_TYPES = Object.keys(SHEET_GENERATORS);

export function getSheetGenerator(type) {
  return SHEET_GENERATORS[type] || null;
}

// Метка листа для списков; неизвестный тип показываем как есть, а не «—»,
// чтобы старая запись после переименования генератора не выглядела пустой.
export function sheetGeneratorLabel(type) {
  return SHEET_GENERATORS[type]?.label || type || 'Лист';
}

export function sheetGeneratorRoute(type) {
  return SHEET_GENERATORS[type]?.route || null;
}

// Форма снимка заданий: 'flat' (Variant[][]) или 'sections'
export function sheetKind(type) {
  return SHEET_GENERATORS[type]?.kind || 'flat';
}

/**
 * Догенерировать одно задание — замена неудачного прямо на листе.
 *
 * Общий приём для всех генераторов: просим у чистой функции лист «1 вариант ×
 * 1 задание», сузив категории до нужной. Ключ количества у генераторов разный
 * (`questionsCount` / `tasksPerVariant`) — передаём оба, лишний игнорируется.
 *
 * Возвращает задание `{ exprLatex, resultLatex, ... }` или null, если генератор
 * не смог собрать задание с такими настройками (бывает при узких ограничениях —
 * например «только целые корни» на категории с дробями).
 */
export function regenerateOneTask(type, settings = {}, cat = null) {
  const meta = SHEET_GENERATORS[type];
  if (!meta?.generate) return null;

  const narrowed = {
    ...settings,
    variantsCount: 1,
    questionsCount: 1,
    tasksPerVariant: 1,
    // Квоты категорий рассчитаны на полный лист — на одном задании они
    // дали бы лист длиннее одной строки.
    categoryCounts: undefined,
  };
  if (cat && settings.categories && cat in settings.categories) {
    narrowed.categories = { [cat]: true };
  }

  try {
    const variants = meta.generate(narrowed);
    const task = variants?.[0]?.[0];
    return task || null;
  } catch (error) {
    console.error('regenerateOneTask failed:', type, error);
    return null;
  }
}
