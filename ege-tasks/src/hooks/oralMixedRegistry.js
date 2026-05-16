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
];

export function getOralType(type) {
  return ORAL_TYPES.find(t => t.type === type);
}
