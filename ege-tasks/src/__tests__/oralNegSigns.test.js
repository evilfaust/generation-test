import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateOralCountingVariants,
  CATEGORY_LABELS,
  DEFAULT_SETTINGS,
} from '../hooks/useOralCounting';

// Независимо считаем значение LaTeX-выражения: \dfrac{a}{b} → (a/b),
// \cdot → *, ":" → /, "{,}" → ".". Нужен, чтобы поймать перепутанный знак
// в категории «Минусы и скобки» (там их по три-четыре на задание).
function evalLatex(tex) {
  const expr = tex
    .replace(/\\dfrac\{(\d+)\}\{(\d+)\}/g, '($1/$2)')
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\{,\}/g, '.')
    .replace(/:/g, '/')
    .trim();
  if (!/^[-+*/(). \d]+$/.test(expr)) throw new Error(`не разобрано: ${tex} → ${expr}`);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr});`)();
}

// Ответ может быть смешанным числом: -1\dfrac{4}{5} = -(1 + 4/5)
function parseAnswer(latex) {
  const mixed = latex.match(/^(-?)(\d+)\\dfrac\{(\d+)\}\{(\d+)\}$/);
  if (mixed) {
    const [, sign, whole, n, d] = mixed;
    const v = Number(whole) + Number(n) / Number(d);
    return sign === '-' ? -v : v;
  }
  const frac = latex.match(/^(-?)\\dfrac\{(\d+)\}\{(\d+)\}$/);
  if (frac) {
    const [, sign, n, d] = frac;
    const v = Number(n) / Number(d);
    return sign === '-' ? -v : v;
  }
  return Number(latex.replace('{,}', '.'));
}

function onlyNegSigns(count) {
  const categories = Object.fromEntries(
    Object.keys(CATEGORY_LABELS).map(k => [k, k === 'negSigns']),
  );
  const [questions] = generateOralCountingVariants({
    variantsCount: 1,
    questionsCount: count,
    categories,
  });
  return questions;
}

describe('устный счёт → арифметика → «Минусы и скобки»', () => {
  it('категория зарегистрирована во всех трёх местах', () => {
    expect(CATEGORY_LABELS.negSigns).toBe('Минусы и скобки');
    expect(DEFAULT_SETTINGS.categories.negSigns).toBe(true);
    expect(onlyNegSigns(5)).toHaveLength(5);
  });

  it('ответ совпадает с вычислением выражения', () => {
    for (const q of onlyNegSigns(300)) {
      const expected = evalLatex(q.exprLatex);
      const actual = parseAnswer(q.resultLatex);
      expect(Number.isFinite(actual)).toBe(true);
      expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
    }
  });

  it('в каждом задании минимум два минуса и выражение рендерится KaTeX', () => {
    for (const q of onlyNegSigns(300)) {
      expect((q.exprLatex.match(/-/g) || []).length).toBeGreaterThanOrEqual(2);
      expect(() => katex.renderToString(q.exprLatex, { throwOnError: true })).not.toThrow();
    }
  });

  it('с decimalOnly ответы — только целые/десятичные', () => {
    const categories = Object.fromEntries(
      Object.keys(CATEGORY_LABELS).map(k => [k, k === 'negSigns']),
    );
    const [questions] = generateOralCountingVariants({
      variantsCount: 1,
      questionsCount: 40,
      categories,
      decimalOnly: true,
    });
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.resultLatex).toMatch(/^-?\d+(\{,\}\d+)?$/);
    }
  });
});
