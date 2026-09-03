import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateLinearEquationVariants,
  CATEGORY_LABELS_LINEQ,
  CATEGORY_GROUPS_LINEQ,
  DEFAULT_SETTINGS_LINEQ,
} from '../hooks/useLinearEquations';

const CATS = Object.keys(CATEGORY_LABELS_LINEQ);

// ─── Независимый вычислитель LaTeX ───────────────────────────────────────────
// Разворачивает \dfrac{A}{B} → ((A)/(B)) с учётом вложенности, затем
// подставляет корень вместо переменной и считает обе части уравнения.
function expandFracs(tex) {
  const i = tex.indexOf('\\dfrac{');
  if (i === -1) return tex;

  const readBraced = (start) => {           // start указывает на '{'
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
  if (tex[numer.end + 1] !== '{') throw new Error(`нет знаменателя: ${tex}`);
  const denom = readBraced(numer.end + 1);

  const replaced =
    tex.slice(0, i) +
    `((${expandFracs(numer.body)})/(${expandFracs(denom.body)}))` +
    tex.slice(denom.end + 1);
  return expandFracs(replaced);
}

function evalSide(tex, varName, xValue) {
  let e = expandFracs(tex)
    .replace(/\\left|\\right/g, '')
    .replace(/\{,\}/g, '.')
    .replace(/\s+/g, '');

  // Подразумеваемое умножение: 3x → 3*x, )x → )*x, 2( → 2*(, )( → )*(
  e = e
    .replace(new RegExp(`([\\d)])(?=${varName})`, 'g'), '$1*')
    .replace(/([\d)])(?=\()/g, '$1*');

  e = e.replace(new RegExp(varName, 'g'), `(${xValue})`);

  if (!/^[-+*/(). \d]+$/.test(e)) throw new Error(`не разобрано: ${tex} → ${e}`);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${e});`)();
}

function parseAnswer(latex) {
  const frac = latex.match(/^(-?)\\dfrac\{(\d+)\}\{(\d+)\}$/);
  if (frac) {
    const [, sign, n, d] = frac;
    const v = Number(n) / Number(d);
    return sign === '-' ? -v : v;
  }
  return Number(latex.replace('{,}', '.'));
}

function onlyCategory(cat, count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, k === cat]));
  const [questions] = generateLinearEquationVariants({
    variantsCount: 1,
    questionsCount: count,
    categories,
    ...extra,
  });
  return questions;
}

function allCategories(count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, true]));
  const [questions] = generateLinearEquationVariants({
    variantsCount: 1,
    questionsCount: count,
    categories,
    ...extra,
  });
  return questions;
}

describe('генератор линейных уравнений', () => {
  it('каждая категория объявлена в лейблах, группах и дефолтных настройках', () => {
    const inGroups = CATEGORY_GROUPS_LINEQ.flatMap(g => g.keys);
    expect(new Set(inGroups)).toEqual(new Set(CATS));
    for (const cat of CATS) {
      expect(typeof CATEGORY_LABELS_LINEQ[cat]).toBe('string');
      expect(DEFAULT_SETTINGS_LINEQ.categories).toHaveProperty(cat);
    }
  });

  it('каждая категория выдаёт запрошенное число заданий', () => {
    for (const cat of CATS) {
      const questions = onlyCategory(cat, 15);
      expect(questions, cat).toHaveLength(15);
    }
  });

  it('корень действительно решает напечатанное уравнение', () => {
    for (const cat of CATS) {
      for (const q of onlyCategory(cat, 120)) {
        if (q.solution.kind !== 'root') continue;   // блок «особые случаи»
        const [left, right] = q.exprLatex.split('=');
        expect(right, `${cat}: ${q.exprLatex}`).toBeDefined();
        const x = parseAnswer(q.resultLatex);
        expect(Number.isFinite(x), `${cat}: ответ ${q.resultLatex}`).toBe(true);
        const l = evalSide(left, q.varLatex, x);
        const r = evalSide(right, q.varLatex, x);
        expect(Math.abs(l - r), `${cat}: ${q.exprLatex} → x = ${q.resultLatex}`)
          .toBeLessThan(1e-9);
      }
    }
  });

  it('условие рендерится KaTeX и содержит ровно один знак «=»', () => {
    for (const q of allCategories(200)) {
      expect(() => katex.renderToString(q.exprLatex, { throwOnError: true })).not.toThrow();
      expect(q.exprLatex.split('=')).toHaveLength(2);
      expect(q.exprLatex).toContain(q.varLatex);
    }
  });

  it('ответы «красивые»: знаменатель ≤ 12, модуль ≤ 100', () => {
    for (const q of allCategories(300)) {
      if (q.solution.kind !== 'root') continue;
      const frac = q.resultLatex.match(/^-?\\dfrac\{(\d+)\}\{(\d+)\}$/);
      if (frac) expect(Number(frac[2])).toBeLessThanOrEqual(12);
      expect(Math.abs(parseAnswer(q.resultLatex))).toBeLessThanOrEqual(100);
    }
  });

  it('«только целые корни» — ответы без дробей', () => {
    const questions = allCategories(120, { integerOnly: true });
    expect(questions).toHaveLength(120);
    for (const q of questions) {
      if (q.solution.kind !== 'root') continue;
      expect(q.resultLatex).toMatch(/^-?\d+$/);
    }
  });

  it('формат ответа «десятичный» отсекает бесконечные дроби', () => {
    const questions = allCategories(120, { answerStyle: 'dec' });
    expect(questions).toHaveLength(120);
    for (const q of questions) {
      if (q.solution.kind !== 'root') continue;
      expect(q.resultLatex).toMatch(/^-?\d+(\{,\}\d+)?$/);
    }
  });

  it('формат ответа «обыкновенная дробь» не даёт десятичных', () => {
    for (const q of allCategories(200, { answerStyle: 'frac' })) {
      expect(q.resultLatex).not.toContain('{,}');
    }
  });

  it('особые случаи: нет корней и любое число', () => {
    for (const q of onlyCategory('noSolution', 60)) {
      expect(q.solution.kind).toBe('empty');
      expect(q.resultLatex).toBe('\\varnothing');
      // Обе части при раскрытии дают одинаковый коэффициент при переменной,
      // поэтому уравнение не выполняется ни при каком значении
      for (const x of [-7, -1, 0, 0.5, 3, 11]) {
        const [left, right] = q.exprLatex.split('=');
        expect(evalSide(left, q.varLatex, x)).not.toBeCloseTo(
          evalSide(right, q.varLatex, x), 9);
      }
    }
    for (const q of onlyCategory('allReal', 60)) {
      expect(q.solution.kind).toBe('all');
      expect(q.resultLatex).toContain('\\mathbb{R}');
      for (const x of [-7, -1, 0, 0.5, 3, 11]) {
        const [left, right] = q.exprLatex.split('=');
        expect(evalSide(left, q.varLatex, x)).toBeCloseTo(
          evalSide(right, q.varLatex, x), 9);
      }
    }
  });

  it('все категории объявлены ровно в одном блоке', () => {
    const inBlocks = CATEGORY_GROUPS_LINEQ.flatMap(g => g.keys);
    expect(inBlocks).toHaveLength(new Set(inBlocks).size);
    expect(CATEGORY_GROUPS_LINEQ).toHaveLength(5);
  });

  it('режим переменных ограничивает набор букв', () => {
    for (const q of allCategories(60, { varsMode: 'x' })) {
      expect(q.varLatex).toBe('x');
    }
    for (const q of allCategories(60, { varsMode: 'xy' })) {
      expect(['x', 'y']).toContain(q.varLatex);
    }
  });

  it('категория «отрицательные числа» всегда содержит минус', () => {
    for (const q of onlyCategory('negNumbers', 100)) {
      expect(q.exprLatex).toContain('-');
    }
  });

  it('пустой набор категорий не ломает генерацию', () => {
    const variants = generateLinearEquationVariants({
      variantsCount: 3,
      questionsCount: 5,
      categories: Object.fromEntries(CATS.map(k => [k, false])),
    });
    expect(variants).toEqual([]);
  });

  it('число вариантов и заданий соответствует настройкам', () => {
    const variants = generateLinearEquationVariants({
      ...DEFAULT_SETTINGS_LINEQ,
      variantsCount: 6,
      questionsCount: 12,
    });
    expect(variants).toHaveLength(6);
    for (const v of variants) expect(v).toHaveLength(12);
  });
});
