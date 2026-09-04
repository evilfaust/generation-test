import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateQuadraticInequalityVariants,
  qineqInstruction,
  CATEGORY_LABELS_QINEQ,
  CATEGORY_GROUPS_QINEQ,
  DEFAULT_SETTINGS_QINEQ,
} from '../hooks/useQuadraticInequalities';
import {
  solutionFromRoots, solutionFromSimpleRoots, inequalityAnswerTex,
  contains, isEmptySet, isAllReal, singlePoint, puncturedAt, piece,
} from '../utils/quadraticInequality';
import { sInt, sRad } from '../utils/surd';
import { rat } from '../utils/linearExpr';
import { OPS } from '../utils/inequalityCore';

const CATS = Object.keys(CATEGORY_LABELS_QINEQ);
const ASK_CATS = new Set(CATEGORY_GROUPS_QINEQ[6].keys);
const COUNT_CATS = new Set(['countIntegers', 'leastInteger', 'greatestInteger']);

// ─── Независимый разбор напечатанного условия ────────────────────────────────
function readBraced(tex, start) {
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

function evalSide(tex, varName, xValue) {
  let e = expandCommands(tex)
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\{,\}/g, '.')
    .replace(/\s+/g, '')
    .replace(/\^(\d)/g, '**$1')
    .replace(new RegExp(`([\\d)])(?=${varName})`, 'g'), '$1*')
    .replace(/([\d)])(?=\()/g, '$1*')
    .replace(/Math\*\(/g, 'Math(');
  e = e.replace(new RegExp(`(?<!Math\\.[a-z]*)${varName}`, 'g'), `(${xValue})`);
  e = e.replace(/(^|[-+*/(])-(?=\()/g, '$1(-1)*');   // JS не даёт унарный минус перед **
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${e});`)();
}

const OP_TOKENS = [
  ['\\leqslant', 'le'], ['\\geqslant', 'ge'], ['<', 'lt'], ['>', 'gt'],
];

function splitInequality(exprLatex) {
  for (const [token, op] of OP_TOKENS) {
    const i = exprLatex.indexOf(token);
    if (i === -1) continue;
    return { op, left: exprLatex.slice(0, i), right: exprLatex.slice(i + token.length) };
  }
  throw new Error(`знак не найден: ${exprLatex}`);
}

/** Верно ли напечатанное неравенство при данном x */
function holdsAt(exprLatex, varName, x) {
  const { op, left, right } = splitInequality(exprLatex);
  return OPS[op].test(evalSide(left, varName, x), evalSide(right, varName, x));
}

/** «Левая минус правая» — на границе решения обязано быть нулём */
function residualAt(exprLatex, varName, x) {
  const { left, right } = splitInequality(exprLatex);
  return evalSide(left, varName, x) - evalSide(right, varName, x);
}

// ─── Помощники ───────────────────────────────────────────────────────────────
function onlyCategory(cat, count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, k === cat]));
  const [questions] = generateQuadraticInequalityVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
}

function allCategories(count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, true]));
  const [questions] = generateQuadraticInequalityVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
}

// ─── Решение как множество промежутков ───────────────────────────────────────
describe('решение квадратного неравенства', () => {
  const two = [sInt(2), sInt(5)];

  it('два корня: между ними или снаружи', () => {
    expect(contains(solutionFromRoots(two, 1, 'lt'), 3)).toBe(true);
    expect(contains(solutionFromRoots(two, 1, 'lt'), 6)).toBe(false);
    expect(contains(solutionFromRoots(two, 1, 'gt'), 6)).toBe(true);
    expect(contains(solutionFromRoots(two, 1, 'gt'), 3)).toBe(false);
  });

  it('отрицательный старший коэффициент разворачивает ответ', () => {
    expect(contains(solutionFromRoots(two, -1, 'gt'), 3)).toBe(true);
    expect(contains(solutionFromRoots(two, -1, 'gt'), 6)).toBe(false);
  });

  it('строгость знака решает, входит ли граница', () => {
    expect(contains(solutionFromRoots(two, 1, 'le'), 2, 0)).toBe(true);
    expect(contains(solutionFromRoots(two, 1, 'lt'), 2, 0)).toBe(false);
  });

  it('кратный корень: точка, вся прямая, пустое множество и «всё кроме»', () => {
    const one = [sInt(8)];
    expect(singlePoint(solutionFromRoots(one, 1, 'le'))).toBeTruthy();
    expect(isAllReal(solutionFromRoots(one, 1, 'ge'))).toBe(true);
    expect(isEmptySet(solutionFromRoots(one, 1, 'lt'))).toBe(true);
    expect(puncturedAt(solutionFromRoots(one, 1, 'gt'))).toBeTruthy();
  });

  it('корней нет: всё или ничего, с учётом знака старшего', () => {
    expect(isAllReal(solutionFromRoots([], 1, 'gt'))).toBe(true);
    expect(isEmptySet(solutionFromRoots([], 1, 'lt'))).toBe(true);
    expect(isAllReal(solutionFromRoots([], -1, 'lt'))).toBe(true);
    expect(isEmptySet(solutionFromRoots([], -1, 'gt'))).toBe(true);
  });

  it('четыре корня: знак чередуется через каждый', () => {
    const roots = [sInt(-2), sInt(-1), sInt(1), sInt(2)];
    const sol = solutionFromSimpleRoots(roots, 1, 'lt');
    expect(sol.pieces).toHaveLength(2);
    expect(contains(sol, -1.5)).toBe(true);
    expect(contains(sol, 0)).toBe(false);
    expect(contains(sol, 1.5)).toBe(true);
    expect(contains(sol, 3)).toBe(false);
  });
});

describe('запись ответа', () => {
  const between = { pieces: [piece(sInt(-3), sInt(5), false, false)] };
  const outside = { pieces: [piece(null, sInt(2)), piece(sInt(7), null)] };

  it('промежутками', () => {
    expect(inequalityAnswerTex(between, 'x', { form: 'interval' }))
      .toBe('\\left[-3; 5\\right]');
    expect(inequalityAnswerTex(outside, 'x', { form: 'interval' }))
      .toBe('\\left(-\\infty; 2\\right) \\cup \\left(7; +\\infty\\right)');
  });

  it('неравенствами', () => {
    expect(inequalityAnswerTex(between, 'x', { form: 'inequality' }))
      .toBe('-3 \\leqslant x \\leqslant 5');
    expect(inequalityAnswerTex(outside, 'x', { form: 'inequality' }))
      .toBe('x < 2 \\;\\text{или}\\; x > 7');
  });

  it('«всё кроме точки» пишется через ≠', () => {
    const sol = solutionFromRoots([sInt(8)], 1, 'gt');
    expect(inequalityAnswerTex(sol, 'x', { form: 'inequality' })).toBe('x \\neq 8');
  });

  it('пустое множество, вся прямая и точка', () => {
    expect(inequalityAnswerTex({ pieces: [] })).toBe('\\varnothing');
    expect(inequalityAnswerTex(solutionFromRoots([], 1, 'gt'), 'x', { form: 'inequality' }))
      .toBe('x \\in \\mathbb{R}');
    expect(inequalityAnswerTex(solutionFromRoots([sInt(8)], 1, 'le'), 'x', { form: 'interval' }))
      .toBe('\\left\\{8\\right\\}');
  });

  it('иррациональная граница печатается корнем, а не приближением', () => {
    const sol = solutionFromRoots([sRad(rat(-1), 7), sRad(rat(1), 7)], 1, 'le');
    expect(inequalityAnswerTex(sol, 'x', { form: 'interval' }))
      .toBe('\\left[-\\sqrt{7}; \\sqrt{7}\\right]');
  });
});

// ─── Генератор ───────────────────────────────────────────────────────────────
describe('генератор квадратных неравенств', () => {
  it('каждая категория объявлена в лейблах, блоках и дефолтных настройках', () => {
    const inGroups = CATEGORY_GROUPS_QINEQ.flatMap(g => g.keys);
    expect(new Set(inGroups)).toEqual(new Set(CATS));
    expect(inGroups).toHaveLength(new Set(inGroups).size);
    for (const cat of CATS) {
      expect(typeof CATEGORY_LABELS_QINEQ[cat], cat).toBe('string');
      expect(DEFAULT_SETTINGS_QINEQ.categories, cat).toHaveProperty(cat);
    }
  });

  it('каждая категория выдаёт запрошенное число заданий', () => {
    for (const cat of CATS) {
      expect(onlyCategory(cat, 12), cat).toHaveLength(12);
    }
  });

  it('условие и ответ рендерятся KaTeX', () => {
    for (const q of allCategories(200, { level: 3 })) {
      expect(() => katex.renderToString(q.exprLatex, { throwOnError: true }),
        `${q.cat}: ${q.exprLatex}`).not.toThrow();
      expect(() => katex.renderToString(q.resultLatex, { throwOnError: true }),
        `${q.cat}: ${q.resultLatex}`).not.toThrow();
    }
  });

  it('ответ совпадает с самим неравенством в пробных точках', () => {
    for (const cat of CATS) {
      if (ASK_CATS.has(cat)) continue;                // у блока 7 свои проверки
      for (const q of onlyCategory(cat, 40)) {
        const probes = [-31.5, -12.25, -3.5, -0.75, 0, 0.75, 3.5, 12.25, 31.5];
        for (const b of q.solution.pieces.flatMap(p => [p.lo, p.hi])) {
          if (!b) continue;
          const v = b.p.n / b.p.d + (b.q.n / b.q.d) * Math.sqrt(b.m);
          probes.push(v - 0.37, v + 0.37);
        }
        for (const x of probes) {
          expect(holdsAt(q.exprLatex, q.varLatex, x),
            `${cat}: ${q.exprLatex} при x = ${x} → ${q.resultLatex}`)
            .toBe(contains(q.solution, x));
        }
      }
    }
  });

  it('границы ответа — настоящие корни: обе части там равны', () => {
    for (const cat of CATS) {
      if (ASK_CATS.has(cat)) continue;
      for (const q of onlyCategory(cat, 30)) {
        for (const p of q.solution.pieces) {
          for (const b of [p.lo, p.hi]) {
            if (!b) continue;
            const v = b.p.n / b.p.d + (b.q.n / b.q.d) * Math.sqrt(b.m);
            expect(Math.abs(residualAt(q.exprLatex, q.varLatex, v)),
              `${cat}: ${q.exprLatex} на границе ${v}`).toBeLessThan(1e-9);
            // Граница входит в ответ ровно тогда, когда знак нестрогий
            const loose = /\\leqslant|\\geqslant/.test(q.exprLatex);
            expect(contains(q.solution, v, 0),
              `${cat}: ${q.exprLatex} → ${q.resultLatex}`).toBe(loose);
          }
        }
      }
    }
  });
});

// ─── Обязательные типы заданий ───────────────────────────────────────────────
describe('типы заданий, ради которых всё затевалось', () => {
  const shapes = {
    reducedNegative: /^x\^2 \+ \d+x \+ \d+ (\\leqslant|\\geqslant|<|>) 0$/,
    swapped:         /^\d+ - (\d+)?x\^2 (\\leqslant|\\geqslant|<|>) 0$/,
    doubleRootStrict: /(<|>) 0$/,
    noC:             /^-?(\d+)?x\^2 [-+] \d+x (\\leqslant|\\geqslant|<|>) 0$/,
    negLeadNoC:      /^-\d*x\^2 [-+] \d+x (\\leqslant|\\geqslant|<|>) 0$/,
    pureIrr:         /\\sqrt/,
  };

  it('каждый обязательный вид действительно печатается', () => {
    for (const [cat, re] of Object.entries(shapes)) {
      const questions = onlyCategory(cat, 20);
      expect(questions.length, cat).toBeGreaterThan(0);
      const target = cat === 'pureIrr'
        ? questions.filter(q => re.test(q.resultLatex))
        : questions.filter(q => re.test(q.exprLatex));
      expect(target.length, `${cat}: ${questions[0]?.exprLatex}`).toBeGreaterThan(0);
    }
  });

  it('x² − 16x + 64 > 0 даёт «всё, кроме точки»', () => {
    const punctured = onlyCategory('doubleRootStrict', 30, { opsMode: 'strict' })
      .filter(q => q.solution.pieces.length === 2);
    expect(punctured.length).toBeGreaterThan(0);
    for (const q of punctured) {
      expect(inequalityAnswerTex(q.solution, q.varLatex, { form: 'inequality' }))
        .toMatch(/\\neq/);
    }
  });

  it('неполное с минусом: старший коэффициент отрицательный, ноль — граница', () => {
    for (const q of onlyCategory('negLeadNoC', 30)) {
      expect(q.exprLatex, q.exprLatex).toMatch(/^-\d*x\^2/);
      expect(Math.abs(residualAt(q.exprLatex, q.varLatex, 0)), q.exprLatex)
        .toBeLessThan(1e-9);
      const bounds = q.solution.pieces.flatMap(p => [p.lo, p.hi]).filter(Boolean);
      expect(bounds.some(b => b.p.n === 0), `${q.exprLatex} → ${q.resultLatex}`).toBe(true);
    }
  });
});

// ─── Настройки ───────────────────────────────────────────────────────────────
describe('настройки листа', () => {
  it('«только строгие знаки» убирает ⩽ и ⩾', () => {
    for (const q of allCategories(120, { opsMode: 'strict' })) {
      if (q.cat === 'domainSqrt') continue;           // ⩾ 0 — часть постановки
      expect(q.exprLatex, q.cat).not.toContain('\\leqslant');
      expect(q.exprLatex, q.cat).not.toContain('\\geqslant');
    }
  });

  it('«только нестрогие» убирает < и >', () => {
    for (const q of allCategories(120, { opsMode: 'loose' })) {
      const body = q.exprLatex.replace(/\\text\{[^}]*\}/g, '');
      expect(body.includes('<') || /[^\\]>/.test(body), q.exprLatex).toBe(false);
    }
  });

  it('«целые границы» не пускает дроби и корни в ответ', () => {
    const questions = allCategories(120, { boundKind: 'integer' });
    expect(questions.length).toBeGreaterThan(100);
    for (const q of questions) {
      for (const p of q.solution.pieces) {
        for (const b of [p.lo, p.hi]) {
          if (!b) continue;
          expect(b.q.n, `${q.cat}: ${q.resultLatex}`).toBe(0);
          expect(b.p.d, `${q.cat}: ${q.resultLatex}`).toBe(1);
        }
      }
    }
  });

  it('форма ответа переключается между промежутками и неравенствами', () => {
    for (const q of onlyCategory('reducedMixed', 20, { answerForm: 'inequality' })) {
      expect(q.resultLatex).not.toContain('\\cup');
      expect(q.resultLatex).toMatch(/x/);
    }
    for (const q of onlyCategory('reducedMixed', 20, { answerForm: 'interval' })) {
      expect(q.resultLatex).toMatch(/\\left[([]/);
    }
  });

  it('уровень сложности меняет размах чисел', () => {
    const spread = (level) => Math.max(...onlyCategory('reducedPositive', 60, { level })
      .flatMap(q => q.solution.pieces.flatMap(p => [p.lo, p.hi]))
      .filter(Boolean).map(b => Math.abs(b.p.n / b.p.d)));
    expect(spread(1)).toBeLessThanOrEqual(6);
    expect(spread(3)).toBeGreaterThan(6);
  });

  it('строка-инструкция меняется вместе с набором категорий', () => {
    expect(qineqInstruction({ reducedMixed: true })).toBe('Решите неравенство:');
    expect(qineqInstruction({ reducedMixed: true, countIntegers: true }))
      .toBe('Выполните задания:');
  });

  it('все варианты строятся по одному плану', () => {
    const variants = generateQuadraticInequalityVariants({
      variantsCount: 4, questionsCount: 9,
      categories: { pureSquare: true, reducedMixed: true, fullFracRoot: true },
    });
    expect(variants).toHaveLength(4);
    const plan = variants[0].map(q => q.cat);
    for (const v of variants) expect(v.map(q => q.cat)).toEqual(plan);
  });
});

// ─── Блок 7 ──────────────────────────────────────────────────────────────────
describe('другие постановки', () => {
  it('счётные вопросы сходятся с честным перебором целых', () => {
    for (const cat of COUNT_CATS) {
      for (const q of onlyCategory(cat, 25)) {
        const ints = [];
        for (let x = -200; x <= 200; x++) {
          if (holdsAt(q.exprLatex.split('\\;')[0], q.varLatex, x)) ints.push(x);
        }
        const expected = cat === 'countIntegers' ? ints.length
          : cat === 'leastInteger' ? ints[0] : ints[ints.length - 1];
        expect(Number(q.resultLatex), `${cat}: ${q.exprLatex}`).toBe(expected);
      }
    }
  });

  it('область определения корня — там, где подкоренное неотрицательно', () => {
    for (const q of onlyCategory('domainSqrt', 25)) {
      expect(q.exprLatex).toMatch(/^D\\left\(\\sqrt\{/);
      const inner = q.exprLatex.slice('D\\left(\\sqrt{'.length, q.exprLatex.lastIndexOf('}\\right)'));
      for (const x of [-9.5, -3.25, -0.5, 0, 2.5, 7.25, 14.5]) {
        expect(evalSide(inner, q.varLatex, x) >= 0, `${q.exprLatex} при x = ${x}`)
          .toBe(contains(q.solution, x));
      }
    }
  });
});
