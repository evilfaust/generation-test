import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateQuadraticVariants,
  answerTex,
  quadInstruction,
  CATEGORY_LABELS_QUAD,
  CATEGORY_GROUPS_QUAD,
  DEFAULT_SETTINGS_QUAD,
} from '../hooks/useQuadraticEquations';
import { sInt, sRad, sr, sTex, sAdd, sMul, sDiv, sNum, squareFree } from '../utils/surd';
import { rat } from '../utils/linearExpr';

const CATS = Object.keys(CATEGORY_LABELS_QUAD);
const ASK_CATS = new Set(CATEGORY_GROUPS_QUAD[5].keys);

// ─── Независимый вычислитель LaTeX ───────────────────────────────────────────
// Разбирает напечатанное условие сам, не заглядывая в дерево генератора:
// если ответ разойдётся с условием, тест это увидит.
function readBraced(tex, start) {          // start указывает на '{'
  let depth = 0;
  for (let j = start; j < tex.length; j++) {
    if (tex[j] === '{') depth++;
    else if (tex[j] === '}') {
      depth--;
      if (depth === 0) return { body: tex.slice(start + 1, j), end: j };
    }
  }
  throw new Error(`несбалансированные скобки: ${tex}`);
}

function expandCommands(tex) {
  const i = tex.search(/\\dfrac\{|\\sqrt\{/);
  if (i === -1) return tex;

  if (tex.startsWith('\\dfrac{', i)) {
    const numer = readBraced(tex, i + '\\dfrac'.length);
    if (tex[numer.end + 1] !== '{') throw new Error(`нет знаменателя: ${tex}`);
    const denom = readBraced(tex, numer.end + 1);
    return expandCommands(
      `${tex.slice(0, i)}((${expandCommands(numer.body)})/(${expandCommands(denom.body)}))${tex.slice(denom.end + 1)}`,
    );
  }
  const arg = readBraced(tex, i + '\\sqrt'.length);
  return expandCommands(
    `${tex.slice(0, i)}(Math.sqrt(${expandCommands(arg.body)}))${tex.slice(arg.end + 1)}`,
  );
}

function toJs(tex, varName, xValue) {
  let e = expandCommands(tex)
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\{,\}/g, '.')
    .replace(/\s+/g, '');

  e = e.replace(/\^(\d)/g, '**$1');
  // Подразумеваемое умножение: 3x, )x, 2(, )( — но не «Math(» и не «**2(»
  e = e
    .replace(new RegExp(`([\\d)])(?=${varName})`, 'g'), '$1*')
    .replace(/([\d)])(?=\()/g, '$1*')
    .replace(/Math\*\(/g, 'Math(');
  e = e.replace(new RegExp(`(?<!Math\\.[a-z]*)${varName}`, 'g'), `(${xValue})`);
  // JS запрещает унарный минус перед ** — «-x²» после подстановки станет «-(-3)**2»
  e = e.replace(/(^|[-+*/(])-(?=\()/g, '$1(-1)*');

  if (!/^[-+*/(). \d]|Math/.test(e)) throw new Error(`не разобрано: ${tex} → ${e}`);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${e});`)();
}

/** Значение «левая часть минус правая» при данном x */
function residual(exprLatex, varName, x) {
  const [left, right] = exprLatex.split('=');
  return toJs(left, varName, x) - toJs(right, varName, x);
}

/** Числа, зашитые в напечатанный ответ (── ± даёт два значения) */
function parseAnswer(latex, varName) {
  const cleaned = latex
    .replace(new RegExp(`${varName}_\\{\\d\\}\\s*=\\s*`, 'g'), '')
    .replace(new RegExp(`^${varName}\\s*=\\s*`), '');
  const parts = cleaned.split(/;\\\s|,\\\s/);
  const out = [];
  for (const part of parts) {
    if (part.includes('\\pm')) {
      out.push(toJs(part.replace('\\pm', '+'), varName, 0));
      out.push(toJs(part.replace('\\pm', '-'), varName, 0));
    } else {
      out.push(toJs(part, varName, 0));
    }
  }
  return out.sort((a, b) => a - b);
}

// ─── Помощники ───────────────────────────────────────────────────────────────
function onlyCategory(cat, count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, k === cat]));
  const [questions] = generateQuadraticVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
}

function allCategories(count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, true]));
  const [questions] = generateQuadraticVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
}

// ─── Арифметика Q(√m) ────────────────────────────────────────────────────────
describe('числа вида p + q√m', () => {
  it('раскладывает радикал на свободный от квадратов', () => {
    expect(squareFree(12)).toEqual({ k: 2, m: 3 });
    expect(squareFree(50)).toEqual({ k: 5, m: 2 });
    expect(squareFree(7)).toEqual({ k: 1, m: 7 });
    expect(sTex(sRad(rat(1), 12))).toBe('2\\sqrt{3}');
  });

  it('складывает, умножает и делит, не выходя из поля', () => {
    const a = sr(rat(2), rat(1), 3);       // 2 + √3
    const b = sr(rat(2), rat(-1), 3);      // 2 − √3
    expect(sNum(sMul(a, b))).toBeCloseTo(1, 12);     // (2+√3)(2−√3) = 1
    expect(sNum(sAdd(a, b))).toBeCloseTo(4, 12);
    expect(sNum(sDiv(sInt(1), a))).toBeCloseTo(1 / (2 + Math.sqrt(3)), 12);
  });

  it('не смешивает разные радикалы', () => {
    expect(sAdd(sRad(rat(1), 2), sRad(rat(1), 3))).toBeNull();
  });

  it('печатает корень одной дробью', () => {
    expect(sTex(sr(rat(5, 2), rat(1, 2), 13))).toBe('\\dfrac{5 + \\sqrt{13}}{2}');
    expect(sTex(sr(rat(2), rat(-1), 3))).toBe('2 - \\sqrt{3}');
  });
});

// ─── Реестр категорий ────────────────────────────────────────────────────────
describe('генератор квадратных уравнений', () => {
  it('каждая категория объявлена в лейблах, блоках и дефолтных настройках', () => {
    const inGroups = CATEGORY_GROUPS_QUAD.flatMap(g => g.keys);
    expect(new Set(inGroups)).toEqual(new Set(CATS));
    expect(inGroups).toHaveLength(new Set(inGroups).size);
    for (const cat of CATS) {
      expect(typeof CATEGORY_LABELS_QUAD[cat], cat).toBe('string');
      expect(DEFAULT_SETTINGS_QUAD.categories, cat).toHaveProperty(cat);
    }
  });

  it('каждая категория выдаёт запрошенное число заданий', () => {
    for (const cat of CATS) {
      expect(onlyCategory(cat, 15), cat).toHaveLength(15);
    }
  });

  it('условие рендерится KaTeX', () => {
    for (const q of allCategories(200, { level: 3 })) {
      expect(() => katex.renderToString(q.exprLatex, { throwOnError: true }),
        `${q.cat}: ${q.exprLatex}`).not.toThrow();
      expect(() => katex.renderToString(q.resultLatex, { throwOnError: true }),
        `${q.cat}: ${q.resultLatex}`).not.toThrow();
    }
  });

  it('заявленные корни действительно обращают уравнение в ноль', () => {
    for (const cat of CATS) {
      if (ASK_CATS.has(cat)) continue;
      for (const q of onlyCategory(cat, 60)) {
        for (const x of q.solution.roots) {
          expect(Math.abs(residual(q.exprLatex, q.varLatex, x)),
            `${cat}: ${q.exprLatex} при x = ${x}`).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('напечатанный ответ совпадает с корнями', () => {
    for (const cat of CATS) {
      if (ASK_CATS.has(cat)) continue;
      for (const q of onlyCategory(cat, 60)) {
        if (q.solution.kind === 'empty') {
          expect(q.resultLatex, cat).toBe('\\varnothing');
          continue;
        }
        const printed = parseAnswer(q.resultLatex, q.varLatex);
        const actual = [...q.solution.roots].sort((a, b) => a - b);
        expect(printed, `${cat}: ${q.exprLatex} → ${q.resultLatex}`).toHaveLength(actual.length);
        printed.forEach((v, i) => {
          expect(Math.abs(v - actual[i]),
            `${cat}: ${q.exprLatex} → ${q.resultLatex}`).toBeLessThan(1e-9);
        });
      }
    }
  });

  it('«нет корней» — уравнение не выполняется ни при каком x', () => {
    for (const cat of ['pureNegative', 'sumPositive', 'reducedNoRoots', 'fullNoRoots']) {
      for (const q of onlyCategory(cat, 30)) {
        expect(q.solution.kind, cat).toBe('empty');
        for (let x = -30; x <= 30; x += 0.25) {
          expect(Math.abs(residual(q.exprLatex, q.varLatex, x)),
            `${cat}: ${q.exprLatex} при x = ${x}`).toBeGreaterThan(1e-9);
        }
      }
    }
  });
});

// ─── Отдельные блоки ─────────────────────────────────────────────────────────
describe('устный блок', () => {
  it('x² = 0 и 7x² = 0 дают единственный корень', () => {
    for (const q of onlyCategory('zeroRoot', 30)) {
      expect(q.solution.roots).toEqual([0]);
      expect(q.resultLatex).toBe('0');
    }
  });

  it('чистый квадрат печатается через ±', () => {
    for (const q of onlyCategory('pureSquare', 30)) {
      expect(q.resultLatex).toMatch(/^\\pm \d+$/);
    }
  });

  it('иррациональный устный ответ — ±√m', () => {
    for (const q of onlyCategory('pureSquareIrr', 30)) {
      expect(q.resultLatex).toMatch(/^\\pm \\sqrt\{\d+\}$/);
    }
  });

  it('(ax + b)² = 0 — один корень, чаще дробный', () => {
    let fractional = 0;
    const questions = onlyCategory('binomSquareZero', 40);
    for (const q of questions) {
      expect(q.exprLatex, q.exprLatex).toMatch(/\\right\)\^2 = 0$/);
      expect(q.solution.roots, q.exprLatex).toHaveLength(1);
      if (!Number.isInteger(q.solution.roots[0])) fractional += 1;
    }
    expect(fractional).toBeGreaterThan(questions.length / 2);
  });

  it('свёрнутый квадрат даёт ровно один корень', () => {
    for (const q of onlyCategory('perfectSquare', 30)) {
      expect(q.solution.roots).toHaveLength(1);
    }
  });
});

describe('иррациональности', () => {
  it('сопряжённые корни печатаются одной записью с ±', () => {
    for (const q of onlyCategory('conjugateRoots', 30)) {
      expect(q.resultLatex, q.exprLatex).toContain('\\pm');
      expect(q.resultLatex, q.exprLatex).toContain('\\sqrt');
      expect(q.solution.roots).toHaveLength(2);
    }
  });

  it('корень попадает в коэффициент уравнения', () => {
    for (const q of onlyCategory('irrCoefB', 20)) {
      expect(q.exprLatex).toContain('\\sqrt');
    }
    for (const q of onlyCategory('irrCoefA', 20)) {
      expect(q.exprLatex).toContain('\\sqrt');
    }
  });
});

describe('приведение к квадратному', () => {
  it('биквадратное даёт до четырёх корней', () => {
    const counts = new Set();
    for (const q of onlyCategory('biquadratic', 60)) {
      expect(q.exprLatex).toContain('^4');
      counts.add(q.solution.roots.length);
    }
    expect([...counts].every(n => [0, 2, 4].includes(n))).toBe(true);
  });

  it('уравнение с переменной в знаменателе не даёт корень 0', () => {
    for (const q of onlyCategory('fracVarDenom', 40)) {
      expect(q.exprLatex).toContain('\\dfrac');
      for (const x of q.solution.roots) expect(Math.abs(x)).toBeGreaterThan(1e-9);
    }
  });
});

describe('теорема Виета без решения', () => {
  it('ответ сходится с настоящими корнями', () => {
    const check = {
      askSum:        ([a, b]) => a + b,
      askProduct:    ([a, b]) => a * b,
      askSumSquares: ([a, b]) => a * a + b * b,
      askInverses:   ([a, b]) => 1 / a + 1 / b,
    };
    for (const [cat, fn] of Object.entries(check)) {
      for (const q of onlyCategory(cat, 40)) {
        expect(q.solution.roots, cat).toHaveLength(2);
        const printed = parseAnswer(q.resultLatex, q.varLatex)[0];
        expect(Math.abs(printed - fn(q.solution.roots)),
          `${cat}: ${q.exprLatex} → ${q.resultLatex}`).toBeLessThan(1e-6);
      }
    }
  });

  it('«составьте уравнение» отвечает уравнением с нужными корнями', () => {
    for (const q of onlyCategory('buildByRoots', 30)) {
      expect(q.resultLatex).toContain('= 0');
      for (const x of q.solution.roots) {
        expect(Math.abs(residual(q.resultLatex, q.varLatex, x)),
          `${q.exprLatex} → ${q.resultLatex}`).toBeLessThan(1e-9);
      }
    }
  });

  it('строка-инструкция меняется вместе с набором категорий', () => {
    expect(quadInstruction({ vietaPositive: true })).toBe('Решите уравнение:');
    expect(quadInstruction({ vietaPositive: true, askSum: true })).toBe('Выполните задания:');
  });
});

// ─── Настройки ───────────────────────────────────────────────────────────────
describe('настройки листа', () => {
  it('«только целые корни» убирает дроби и радикалы', () => {
    const questions = allCategories(120, { rootKind: 'integer' });
    expect(questions.length).toBeGreaterThan(100);
    for (const q of questions) {
      for (const x of q.solution.roots) {
        expect(Number.isInteger(x), `${q.cat}: ${q.exprLatex} → ${q.resultLatex}`).toBe(true);
      }
    }
  });

  it('«рациональные корни» не пускает радикалы в ответ', () => {
    for (const q of allCategories(120, { rootKind: 'rational' })) {
      if (q.solution.kind === 'roots') {
        expect(q.resultLatex, `${q.cat}: ${q.resultLatex}`).not.toContain('\\sqrt');
      }
    }
  });

  it('стиль ответа «x₁, x₂» подписывает корни', () => {
    for (const q of onlyCategory('vietaMixed', 20, { answerStyle: 'indexed' })) {
      expect(q.resultLatex).toMatch(/^x_\{1\} = .+,\\ x_\{2\} = /);
    }
  });

  it('режим переменных ограничивает набор букв', () => {
    for (const q of allCategories(40, { varsMode: 'x' })) expect(q.varLatex).toBe('x');
    for (const q of allCategories(40, { varsMode: 'xy' })) expect(['x', 'y']).toContain(q.varLatex);
  });

  it('уровень сложности меняет размах чисел', () => {
    const spread = (level) => {
      const values = onlyCategory('vietaPositive', 60, { level })
        .flatMap(q => q.solution.roots.map(Math.abs));
      return Math.max(...values);
    };
    expect(spread(1)).toBeLessThanOrEqual(6);
    expect(spread(3)).toBeGreaterThan(6);
  });

  it('на листе почти не бывает повторов', () => {
    const variants = generateQuadraticVariants({
      ...DEFAULT_SETTINGS_QUAD, variantsCount: 4, questionsCount: 12,
    });
    const all = variants.flat().map(q => q.exprLatex);
    expect(all.length).toBe(48);
    // Узкие категории («x² = 0») повторов не избегут, но лист не должен
    // состоять из них наполовину
    expect(new Set(all).size / all.length).toBeGreaterThan(0.9);
  });

  it('все варианты строятся по одному плану', () => {
    const variants = generateQuadraticVariants({
      variantsCount: 4,
      questionsCount: 10,
      categories: { pureSquare: true, vietaMixed: true, fullFracRoot: true },
    });
    expect(variants).toHaveLength(4);
    const plan = variants[0].map(q => q.cat);
    for (const v of variants) expect(v.map(q => q.cat)).toEqual(plan);
  });
});

describe('оформление ответа', () => {
  it('пустое множество, один корень, пара и симметрия', () => {
    expect(answerTex([])).toBe('\\varnothing');
    expect(answerTex([sInt(3)])).toBe('3');
    expect(answerTex([sInt(-7), sInt(7)])).toBe('\\pm 7');
    expect(answerTex([sInt(-7), sInt(7)], { usePm: false })).toBe('-7;\\ 7');
    expect(answerTex([sInt(-3), sInt(5)])).toBe('-3;\\ 5');
  });
});
