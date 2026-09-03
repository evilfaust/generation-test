import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateDoubleInequalityVariants,
  CATEGORY_LABELS_DBL,
  CATEGORY_GROUPS_DBL,
  DEFAULT_SETTINGS_DBL,
} from '../hooks/useDoubleInequalities';
import { OPS } from '../utils/inequalityCore';

const CATS = Object.keys(CATEGORY_LABELS_DBL);

// ─── Независимый вычислитель LaTeX ───────────────────────────────────────────
function expandFracs(tex) {
  const i = tex.indexOf('\\dfrac{');
  if (i === -1) return tex;

  const readBraced = (start) => {
    let depth = 0;
    for (let j = start; j < tex.length; j++) {
      if (tex[j] === '{') depth++;
      else if (tex[j] === '}') {
        depth--;
        if (depth === 0) return { body: tex.slice(start + 1, j), end: j };
      }
    }
    throw new Error(`несбалансированные скобки: ${tex}`);
  };

  const numer = readBraced(i + '\\dfrac'.length);
  const denom = readBraced(numer.end + 1);
  return expandFracs(
    tex.slice(0, i) +
    `((${expandFracs(numer.body)})/(${expandFracs(denom.body)}))` +
    tex.slice(denom.end + 1),
  );
}

function evalSide(tex, varName, xValue) {
  let e = expandFracs(tex)
    .replace(/\\left|\\right/g, '')
    .replace(/\{,\}/g, '.')
    .replace(/\s+/g, '')
    .replace(new RegExp(`([\\d)])(?=${varName})`, 'g'), '$1*')
    .replace(/([\d)])(?=\()/g, '$1*')
    .replace(new RegExp(varName, 'g'), `(${xValue})`);

  if (!/^[-+*/(). \d]+$/.test(e)) throw new Error(`не разобрано: ${tex} → ${e}`);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${e});`)();
}

const OP_BY_TEX = { '<': 'lt', '>': 'gt', '\\leqslant': 'le', '\\geqslant': 'ge' };
const splitOps = (tex) => tex.split(/(\\leqslant|\\geqslant|<|>)/);

// Выполняется ли напечатанное двойное неравенство при данном значении
function holdsAt(exprLatex, varName, x) {
  const parts = splitOps(exprLatex);
  const sides = parts.filter((_, i) => i % 2 === 0).map(s => evalSide(s, varName, x));
  const ops   = parts.filter((_, i) => i % 2 === 1).map(s => OP_BY_TEX[s.trim()]);
  return ops.every((op, i) => OPS[op].test(sides[i], sides[i + 1]));
}

const val = (r) => r.n / r.d;

const inSolution = (s, x) =>
  OPS[s.opLo].test(val(s.lo), x) && OPS[s.opHi].test(x, val(s.hi));

// Границу численно не проверяем: у −17 ⩽ 2x она равна −8,5 не всегда точно
// (например 1/3), и подстановка врёт в последнем знаке. Строгость знаков
// проверяется отдельным тестом.
function probePoints(solution) {
  const bounds = [val(solution.lo), val(solution.hi)];
  const mid = (bounds[0] + bounds[1]) / 2;
  const near = bounds.flatMap(b => [b - 1, b - 0.25, b + 0.25, b + 1]);
  return [...near, mid, -50, -13.5, -3, 0, 3, 13.5, 50]
    .filter(x => bounds.every(b => Math.abs(x - b) > 1e-6));
}

function onlyCategory(cat, count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, k === cat]));
  const [questions] = generateDoubleInequalityVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions;
}

function allCategories(count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, true]));
  const [questions] = generateDoubleInequalityVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions;
}

describe('генератор двойных неравенств', () => {
  it('каждая категория объявлена в лейблах, блоках и дефолтных настройках', () => {
    const inBlocks = CATEGORY_GROUPS_DBL.flatMap(g => g.keys);
    expect(new Set(inBlocks)).toEqual(new Set(CATS));
    expect(inBlocks).toHaveLength(new Set(inBlocks).size);
    for (const cat of CATS) {
      expect(typeof CATEGORY_LABELS_DBL[cat]).toBe('string');
      expect(DEFAULT_SETTINGS_DBL.categories).toHaveProperty(cat);
    }
  });

  it('каждая категория выдаёт запрошенное число заданий', () => {
    for (const cat of CATS) {
      expect(onlyCategory(cat, 15), cat).toHaveLength(15);
    }
  });

  it('условие — двойное неравенство: три части и два знака «меньше»', () => {
    for (const q of allCategories(200)) {
      const parts = splitOps(q.exprLatex);
      expect(parts).toHaveLength(5);
      const ops = [parts[1], parts[3]].map(s => OP_BY_TEX[s.trim()]);
      for (const op of ops) expect(['lt', 'le']).toContain(op);
      expect(q.exprLatex).toContain(q.varLatex);
    }
  });

  it('множество решений совпадает с напечатанным неравенством', () => {
    for (const cat of CATS) {
      for (const q of onlyCategory(cat, 60)) {
        for (const x of probePoints(q.solution)) {
          expect(
            holdsAt(q.exprLatex, q.varLatex, x),
            `${cat}: ${q.exprLatex} → ${q.resultLatex}, x = ${x}`,
          ).toBe(inSolution(q.solution, x));
        }
      }
    }
  });

  it('ответ читается как «a ⩽ x < b» и совпадает с решением', () => {
    for (const q of allCategories(250, { answerForm: 'ineq' })) {
      const parts = splitOps(q.resultLatex).map(s => s.trim());
      expect(parts[2]).toBe(q.varLatex);
      expect(OP_BY_TEX[parts[1]]).toBe(q.solution.opLo);
      expect(OP_BY_TEX[parts[3]]).toBe(q.solution.opHi);
      expect(evalSide(parts[0], q.varLatex, 0)).toBeCloseTo(val(q.solution.lo), 9);
      expect(evalSide(parts[4], q.varLatex, 0)).toBeCloseTo(val(q.solution.hi), 9);
      expect(val(q.solution.lo)).toBeLessThan(val(q.solution.hi));
    }
  });

  it('ответ-промежуток: скобки по строгости знаков', () => {
    for (const q of allCategories(250, { answerForm: 'interval' })) {
      const { opLo, opHi } = q.solution;
      expect(q.resultLatex.startsWith(OPS[opLo].strict ? '\\left(' : '\\left[')).toBe(true);
      expect(q.resultLatex.endsWith(OPS[opHi].strict ? '\\right)' : '\\right]')).toBe(true);
    }
  });

  it('отрицательный коэффициент разворачивает знаки и меняет границы местами', () => {
    for (const q of onlyCategory('negCoef', 100)) {
      const printed = splitOps(q.exprLatex).filter((_, i) => i % 2 === 1)
        .map(s => OP_BY_TEX[s.trim()]);
      // печатается «lo ⩽ -6x ⩽ hi», а в ответе крайние знаки меняются ролями
      expect(q.solution.opLo).toBe(printed[1]);
      expect(q.solution.opHi).toBe(printed[0]);
    }
  });

  it('условие и ответ рендерятся KaTeX', () => {
    for (const form of ['ineq', 'interval']) {
      for (const q of allCategories(120, { answerForm: form })) {
        expect(() => katex.renderToString(q.exprLatex, { throwOnError: true })).not.toThrow();
        expect(() => katex.renderToString(q.resultLatex, { throwOnError: true })).not.toThrow();
      }
    }
  });

  it('«только строгие знаки» убирает ⩽ из условия и ответа', () => {
    for (const q of allCategories(150, { strictOnly: true })) {
      expect(q.exprLatex).not.toMatch(/leqslant|geqslant/);
      expect(q.resultLatex).not.toMatch(/leqslant|geqslant/);
    }
  });

  it('«только целые границы» — в ответе нет дробей', () => {
    const questions = allCategories(120, { integerOnly: true });
    expect(questions).toHaveLength(120);
    for (const q of questions) {
      expect(q.resultLatex).not.toContain('\\dfrac');
      expect(q.resultLatex).not.toContain('{,}');
    }
  });

  it('пустой набор категорий не ломает генерацию', () => {
    expect(generateDoubleInequalityVariants({
      variantsCount: 3,
      questionsCount: 5,
      categories: Object.fromEntries(CATS.map(k => [k, false])),
    })).toEqual([]);
  });

  it('число вариантов и заданий соответствует настройкам', () => {
    const variants = generateDoubleInequalityVariants({
      ...DEFAULT_SETTINGS_DBL, variantsCount: 6, questionsCount: 12,
    });
    expect(variants).toHaveLength(6);
    for (const v of variants) expect(v).toHaveLength(12);
  });
});
