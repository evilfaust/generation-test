// Реестр типов разделов для смешанной работы по тригонометрии.
// Каждый тип содержит метаданные UI + чистую функцию генерации.

import { generateTrigExpressionsVariants }      from './useTrigExpressions';
import { generateInverseTrigVariants }           from './useInverseTrig';
import { generateReductionFormulasVariants }     from './useReductionFormulas';
import { generateAdditionFormulasVariants }      from './useAdditionFormulas';
import { generateTrigEquationsVariants }         from './useTrigEquations';
import { generateUnitCircleVariants }            from './useUnitCircle';
import { generateDoubleAngleVariants }           from './useDoubleAngle';
import { generateTrigEquationsAdvancedVariants } from './useTrigEquationsAdvanced';

export const TRIG_TYPES = [
  {
    type:         'trigExpressions',
    label:        'Тригонометрические выражения',
    instruction:  'Вычислите:',
    questionMode: 'inline',
    generator:    generateTrigExpressionsVariants,
    defaultCfg: {
      questionsCount: 4, taskType: 'mixed', termsCount: 3,
      useSin: true, useCos: true, useTan: false, useCot: false,
      useNegAngles: true, useDegrees: false,
      twoColumns: false,
    },
  },
  {
    type:         'inverseTrig',
    label:        'Обратные тригонометрические функции',
    instruction:  'Вычислите:',
    questionMode: 'inline',
    generator:    generateInverseTrigVariants,
    defaultCfg: {
      questionsCount: 4, taskType: 'mixed',
      useArcsin: true, useArccos: true, useArctan: false, useArccot: false,
      useOuterSin: true, useOuterCos: true, useOuterTan: false, useOuterCot: false,
      useDegrees: false,
      twoColumns: false,
    },
  },
  {
    type:         'reductionFormulas',
    label:        'Формулы приведения',
    instruction:  'Упростите или вычислите:',
    questionMode: 'inline',
    generator:    generateReductionFormulasVariants,
    defaultCfg: {
      tasksPerVariant: 4,
      taskTypes: ['basic', 'reversed'],
      funcs: ['sin', 'cos', 'tan', 'cot'],
      angleMode: 'both',
      numPatterns: { sqrt3: true, sqrt2: true, complementary: true },
      twoColumns: false,
    },
  },
  {
    type:         'additionFormulas',
    label:        'Формулы сложения',
    instruction:  'Упростите или вычислите:',
    questionMode: 'inline',
    generator:    generateAdditionFormulasVariants,
    defaultCfg: {
      tasksPerVariant: 4,
      taskTypes: ['formula_eval', 'symbolic'],
      funcs: ['sin', 'cos', 'tan'],
      incSum: true, incDiff: true, showHint: false,
      twoColumns: false,
    },
  },
  {
    type:         'trigEquations',
    label:        'Простейшие тригонометрические уравнения',
    instruction:  'Решите уравнение:',
    questionMode: 'twoLine',
    generator:    generateTrigEquationsVariants,
    defaultCfg: {
      questionsCount: 4,
      useSin: true, useCos: true, useTan: false, useCot: false,
      twoColumns: true,
    },
  },
  {
    type:         'unitCircle',
    label:        'Единичная окружность',
    instruction:  null,
    questionMode: 'unitcircle',
    generator:    generateUnitCircleVariants,
    defaultCfg: {
      circlesPerPage: 2,
      pointsPerCircle: 8,
      maxK: 1,
      taskType: 'mixed',
      showAxes: 'axes',
      showDegrees: false,
      showTicks: true,
      useDegrees: false,
    },
  },
  {
    type:         'doubleAngle',
    label:        'Формулы двойного аргумента',
    instruction:  'Вычислите или упростите:',
    questionMode: 'inline',
    generator:    generateDoubleAngleVariants,
    defaultCfg: {
      tasksPerVariant: 4,
      taskTypes: ['numeric', 'symbolic'],
      funcs: ['sin', 'cos'],
      incSin: true, incCos: true, incTan: false,
      twoColumns: false,
    },
  },
  {
    type:         'trigEquationsAdvanced',
    label:        'Уравнения f(kx + b) = a',
    instruction:  'Решите уравнение:',
    questionMode: 'twoLine',
    generator:    generateTrigEquationsAdvancedVariants,
    defaultCfg: {
      questionsCount: 4,
      useType1: true, useType2: false,
      twoColumns: true,
    },
  },
];

export function getTrigType(type) {
  return TRIG_TYPES.find(t => t.type === type);
}
