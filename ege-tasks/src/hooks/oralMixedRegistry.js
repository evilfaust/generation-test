// Реестр всех типов разделов для смешанной работы устного счёта.
// Каждый тип ссылается на:
//   - чистую функцию генерации (без хуков)
//   - метаданные категорий
//   - дефолтные настройки

import {
  generateOralCountingVariants,
  CATEGORY_LABELS as CL_ORAL,
  DEFAULT_SETTINGS as DS_ORAL,
} from './useOralCounting';

import {
  generateLogExpVariants,
  CATEGORY_LABELS_LOGEXP,
  DEFAULT_SETTINGS_LOGEXP,
} from './useLogExpEquations';

import {
  generatePowersRootsVariants,
  CATEGORY_LABELS_PR,
  DEFAULT_SETTINGS_PR,
} from './useOralPowersRoots';

import {
  generateLogarithmsVariants,
  CATEGORY_LABELS_LOG,
  DEFAULT_SETTINGS_LOG,
} from './useOralLogarithms';

import {
  generateEgeBaseVariants,
  CATEGORY_LABELS_EGE,
  DEFAULT_SETTINGS_EGE,
} from './useOralEgeBase';

import {
  generateFractionsVariants,
  CATEGORY_LABELS_FR,
  DEFAULT_SETTINGS_FR,
} from './useOralFractions';

import {
  generateLinearEquationVariants,
  CATEGORY_LABELS_LINEQ,
  DEFAULT_SETTINGS_LINEQ,
} from './useLinearEquations';

import {
  generateQuadraticVariants,
  CATEGORY_LABELS_QUAD,
  DEFAULT_SETTINGS_QUAD,
} from './useQuadraticEquations';

import {
  generateQuadraticInequalityVariants,
  CATEGORY_LABELS_QINEQ,
  DEFAULT_SETTINGS_QINEQ,
} from './useQuadraticInequalities';

import {
  generateLinearInequalityVariants,
  CATEGORY_LABELS_INEQ,
  DEFAULT_SETTINGS_INEQ,
} from './useLinearInequalities';

import {
  generateDoubleInequalityVariants,
  CATEGORY_LABELS_DBL,
  DEFAULT_SETTINGS_DBL,
} from './useDoubleInequalities';

// Дефолтный набор включённых категорий (все true)
const allTrue = (labels) => Object.fromEntries(Object.keys(labels).map(k => [k, true]));

export const ORAL_TYPES = [
  {
    type:         'oral_counting',
    label:        'Арифметика',
    instruction:  'Вычислите:',
    equationMode: false,
    generator:    generateOralCountingVariants,
    categoryLabels: CL_ORAL,
    defaultCategories: allTrue(CL_ORAL),
    defaultSettings: DS_ORAL,
  },
  {
    type:         'ege_base',
    label:        'Действия с десятичными',
    instruction:  'Вычислите:',
    equationMode: false,
    generator:    generateEgeBaseVariants,
    categoryLabels: CATEGORY_LABELS_EGE,
    defaultCategories: allTrue(CATEGORY_LABELS_EGE),
    defaultSettings: DEFAULT_SETTINGS_EGE,
  },
  {
    type:         'fractions',
    label:        'Действия с обыкновенными дробями',
    instruction:  'Вычислите:',
    equationMode: false,
    generator:    generateFractionsVariants,
    categoryLabels: CATEGORY_LABELS_FR,
    defaultCategories: allTrue(CATEGORY_LABELS_FR),
    defaultSettings: DEFAULT_SETTINGS_FR,
  },
  {
    type:         'powers_roots',
    label:        'Степени и корни',
    instruction:  'Вычислите:',
    equationMode: false,
    generator:    generatePowersRootsVariants,
    categoryLabels: CATEGORY_LABELS_PR,
    defaultCategories: allTrue(CATEGORY_LABELS_PR),
    defaultSettings: DEFAULT_SETTINGS_PR,
  },
  {
    type:         'logarithms',
    label:        'Логарифмы',
    instruction:  'Вычислите:',
    equationMode: false,
    generator:    generateLogarithmsVariants,
    categoryLabels: CATEGORY_LABELS_LOG,
    defaultCategories: allTrue(CATEGORY_LABELS_LOG),
    defaultSettings: DEFAULT_SETTINGS_LOG,
  },
  {
    type:         'log_exp',
    label:        'Степени и логарифмы (уравнения)',
    instruction:  'Решите уравнения:',
    equationMode: true,
    generator:    generateLogExpVariants,
    categoryLabels: CATEGORY_LABELS_LOGEXP,
    defaultCategories: allTrue(CATEGORY_LABELS_LOGEXP),
    defaultSettings: DEFAULT_SETTINGS_LOGEXP,
  },
  {
    type:         'linear_equations',
    label:        'Линейные уравнения',
    instruction:  'Решите уравнения:',
    equationMode: true,
    generator:    generateLinearEquationVariants,
    categoryLabels: CATEGORY_LABELS_LINEQ,
    defaultCategories: DEFAULT_SETTINGS_LINEQ.categories,
    defaultSettings: DEFAULT_SETTINGS_LINEQ,
  },
  {
    type:         'quadratic_equations',
    label:        'Квадратные уравнения',
    instruction:  'Решите уравнения:',
    equationMode: true,
    promptMode:   'answer',   // корней два — подсказка «x =» не подходит
    generator:    generateQuadraticVariants,
    categoryLabels: CATEGORY_LABELS_QUAD,
    defaultCategories: DEFAULT_SETTINGS_QUAD.categories,
    defaultSettings: DEFAULT_SETTINGS_QUAD,
  },
  {
    type:         'quadratic_inequalities',
    label:        'Квадратные неравенства',
    instruction:  'Решите неравенства:',
    equationMode: true,
    promptMode:   'answer',   // ответ — промежуток, подсказка «x =» не подходит
    generator:    generateQuadraticInequalityVariants,
    categoryLabels: CATEGORY_LABELS_QINEQ,
    defaultCategories: DEFAULT_SETTINGS_QINEQ.categories,
    defaultSettings: DEFAULT_SETTINGS_QINEQ,
  },
  {
    type:         'linear_inequalities',
    label:        'Линейные неравенства',
    instruction:  'Решите неравенства:',
    equationMode: true,
    promptMode:   'answer',   // ответ — «x > 5», подсказка «x =» не подходит
    generator:    generateLinearInequalityVariants,
    categoryLabels: CATEGORY_LABELS_INEQ,
    defaultCategories: DEFAULT_SETTINGS_INEQ.categories,
    defaultSettings: DEFAULT_SETTINGS_INEQ,
  },
  {
    type:         'double_inequalities',
    label:        'Двойные неравенства',
    instruction:  'Решите двойные неравенства:',
    equationMode: true,
    promptMode:   'answer',
    generator:    generateDoubleInequalityVariants,
    categoryLabels: CATEGORY_LABELS_DBL,
    defaultCategories: DEFAULT_SETTINGS_DBL.categories,
    defaultSettings: DEFAULT_SETTINGS_DBL,
  },
];

export function getOralType(type) {
  return ORAL_TYPES.find(t => t.type === type);
}
