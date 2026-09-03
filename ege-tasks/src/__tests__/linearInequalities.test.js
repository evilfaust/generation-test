import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateLinearInequalityVariants,
  CATEGORY_LABELS_INEQ,
  CATEGORY_GROUPS_INEQ,
  DEFAULT_SETTINGS_INEQ,
  OPS,
} from '../hooks/useLinearInequalities';

const CATS = Object.keys(CATEGORY_LABELS_INEQ);

// ─── Независимый вычислитель LaTeX (как в тесте уравнений) ───────────────────
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
    .replace(/\s+/g, '');

  e = e
    .replace(new RegExp(`([\\d)])(?=${varName})`, 'g'), '$1*')
    .replace(/([\d)])(?=\()/g, '$1*')
    .replace(new RegExp(varName, 'g'), `(${xValue})`);

  if (!/^[-+*/(). \d]+$/.test(e)) throw new Error(`не разобрано: ${tex} → ${e}`);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${e});`)();
}

const OP_BY_TEX = { '<': 'lt', '>': 'gt', '\\leqslant': 'le', '\\geqslant': 'ge' };

// Истинно ли напечатанное неравенство при данном значении переменной
function holdsAt(exprLatex, varName, x) {
  const parts = exprLatex.split(/(\\leqslant|\\geqslant|<|>)/);
  const sides = parts.filter((_, i) => i % 2 === 0).map(s => evalSide(s, varName, x));
  const ops   = parts.filter((_, i) => i % 2 === 1).map(s => OP_BY_TEX[s.trim()]);
  return ops.every((op, i) => OPS[op].test(sides[i], sides[i + 1]));
}

const val = (r) => r.n / r.d;

// Принадлежит ли точка множеству решений
function inSolution(solution, x) {
  switch (solution.kind) {
    case 'empty': return false;
    case 'all':   return true;
    case 'ray':   return OPS[solution.op].test(x, val(solution.value));
    default:
      return OPS[solution.opLo].test(val(solution.lo), x)
          && OPS[solution.opHi].test(x, val(solution.hi));
  }
}

function solutionBounds(solution) {
  if (solution.kind === 'ray') return [val(solution.value)];
  if (solution.kind === 'between') return [val(solution.lo), val(solution.hi)];
  return [];
}

// Точки вокруг границ и по всей прямой. Саму границу не проверяем численно:
// у 11x ⩾ 60 граница 60/11 не представима в double, и подстановка врёт в
// последнем знаке. Строгость знака проверяется отдельным тестом.
function probePoints(solution) {
  const base = [-30, -12.5, -7, -3, -1, -0.5, 0, 0.5, 1, 3, 7, 12.5, 30];
  const bounds = solutionBounds(solution);
  const near = bounds.flatMap(b => [b - 1, b - 0.25, b + 0.25, b + 1]);
  return [...base, ...near]
    .filter(x => bounds.every(b => Math.abs(x - b) > 1e-6));
}

function onlyCategory(cat, count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, k === cat]));
  const [questions] = generateLinearInequalityVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions;
}

function allCategories(count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, true]));
  const [questions] = generateLinearInequalityVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions;
}

describe('генератор линейных неравенств', () => {
  it('каждая категория объявлена в лейблах, блоках и дефолтных настройках', () => {
    const inBlocks = CATEGORY_GROUPS_INEQ.flatMap(g => g.keys);
    expect(new Set(inBlocks)).toEqual(new Set(CATS));
    for (const cat of CATS) {
      expect(typeof CATEGORY_LABELS_INEQ[cat]).toBe('string');
      expect(DEFAULT_SETTINGS_INEQ.categories).toHaveProperty(cat);
    }
  });

  it('каждая категория выдаёт запрошенное число заданий', () => {
    for (const cat of CATS) {
      expect(onlyCategory(cat, 15), cat).toHaveLength(15);
    }
  });

  it('множество решений совпадает с напечатанным неравенством', () => {
    for (const cat of CATS) {
      for (const q of onlyCategory(cat, 60)) {
        for (const x of probePoints(q.solution)) {
          const actual = holdsAt(q.exprLatex, q.varLatex, x);
          const expected = inSolution(q.solution, x);
          expect(actual, `${cat}: ${q.exprLatex} → ${q.resultLatex}, x = ${x}`)
            .toBe(expected);
        }
      }
    }
  });

  it('ответ «x > a» соответствует множеству решений', () => {
    for (const q of allCategories(300, { answerForm: 'ineq' })) {
      if (q.solution.kind === 'empty') { expect(q.resultLatex).toBe('\\varnothing'); continue; }
      if (q.solution.kind === 'all')   { expect(q.resultLatex).toContain('\\mathbb{R}'); continue; }

      const parts = q.resultLatex.split(/(\\leqslant|\\geqslant|<|>)/).map(s => s.trim());
      if (q.solution.kind === 'ray') {
        expect(parts[0]).toBe(q.varLatex);
        expect(OP_BY_TEX[parts[1]]).toBe(q.solution.op);
        expect(evalSide(parts[2], q.varLatex, 0)).toBeCloseTo(val(q.solution.value), 9);
      } else {
        expect(parts[2]).toBe(q.varLatex);
        expect(OP_BY_TEX[parts[1]]).toBe(q.solution.opLo);
        expect(OP_BY_TEX[parts[3]]).toBe(q.solution.opHi);
        expect(evalSide(parts[0], q.varLatex, 0)).toBeCloseTo(val(q.solution.lo), 9);
        expect(evalSide(parts[4], q.varLatex, 0)).toBeCloseTo(val(q.solution.hi), 9);
      }
    }
  });

  it('ответ-промежуток: скобка круглая у строгого знака и квадратная у нестрогого', () => {
    for (const q of allCategories(300, { answerForm: 'interval' })) {
      if (q.solution.kind === 'empty' || q.solution.kind === 'all') continue;
      const tex = q.resultLatex;
      if (q.solution.kind === 'ray') {
        const strict = OPS[q.solution.op].strict;
        const less = q.solution.op === 'lt' || q.solution.op === 'le';
        expect(tex).toContain('\\infty');
        if (less) expect(tex.endsWith(strict ? '\\right)' : '\\right]')).toBe(true);
        else      expect(tex.startsWith(strict ? '\\left(' : '\\left[')).toBe(true);
      } else {
        expect(tex.startsWith(OPS[q.solution.opLo].strict ? '\\left(' : '\\left[')).toBe(true);
        expect(tex.endsWith(OPS[q.solution.opHi].strict ? '\\right)' : '\\right]')).toBe(true);
      }
    }
  });

  it('условие и ответ рендерятся KaTeX', () => {
    for (const form of ['ineq', 'interval']) {
      for (const q of allCategories(150, { answerForm: form })) {
        expect(() => katex.renderToString(q.exprLatex, { throwOnError: true })).not.toThrow();
        expect(() => katex.renderToString(q.resultLatex, { throwOnError: true })).not.toThrow();
      }
    }
  });

  it('«только строгие знаки» убирает ⩽ и ⩾ из условия и ответа', () => {
    for (const q of allCategories(200, { strictOnly: true })) {
      expect(q.exprLatex).not.toMatch(/leqslant|geqslant/);
      expect(q.resultLatex).not.toMatch(/leqslant|geqslant/);
      expect(q.resultLatex).not.toContain('\\right]');
    }
  });

  it('«только целые границы» — в ответе нет дробей', () => {
    const questions = allCategories(150, { integerOnly: true });
    expect(questions).toHaveLength(150);
    for (const q of questions) {
      expect(q.resultLatex).not.toContain('\\dfrac');
      expect(q.resultLatex).not.toContain('{,}');
    }
  });

  it('строгость знака сохраняется: < даёт <, ⩽ даёт ⩽', () => {
    for (const q of allCategories(300)) {
      if (q.solution.kind !== 'ray') continue;
      const printedOp = OP_BY_TEX[q.exprLatex.split(/(\\leqslant|\\geqslant|<|>)/)[1].trim()];
      expect(OPS[q.solution.op].strict, q.exprLatex).toBe(OPS[printedOp].strict);
    }
  });

  it('деление на отрицательное разворачивает знак', () => {
    for (const q of onlyCategory('negCoef', 100)) {
      expect(q.exprLatex.trimStart().startsWith('-')).toBe(true);
      const printedOp = OP_BY_TEX[q.exprLatex.split(/(\\leqslant|\\geqslant|<|>)/)[1].trim()];
      expect(q.solution.kind).toBe('ray');
      expect(q.solution.op).toBe(OPS[printedOp].flip);
    }
  });

  it('особые случаи дают пустое множество и всю прямую', () => {
    for (const q of onlyCategory('noSolution', 60)) {
      expect(q.solution.kind).toBe('empty');
    }
    for (const q of onlyCategory('allReal', 60)) {
      expect(q.solution.kind).toBe('all');
    }
  });

  it('двойное неравенство даёт промежуток с lo < hi', () => {
    for (const q of onlyCategory('doubleIneq', 60)) {
      expect(q.solution.kind).toBe('between');
      expect(val(q.solution.lo)).toBeLessThan(val(q.solution.hi));
    }
  });

  it('пустой набор категорий не ломает генерацию', () => {
    const variants = generateLinearInequalityVariants({
      variantsCount: 3,
      questionsCount: 5,
      categories: Object.fromEntries(CATS.map(k => [k, false])),
    });
    expect(variants).toEqual([]);
  });

  it('число вариантов и заданий соответствует настройкам', () => {
    const variants = generateLinearInequalityVariants({
      ...DEFAULT_SETTINGS_INEQ,
      variantsCount: 6,
      questionsCount: 12,
    });
    expect(variants).toHaveLength(6);
    for (const v of variants) expect(v).toHaveLength(12);
  });
});
