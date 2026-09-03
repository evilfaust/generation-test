import { describe, it, expect } from 'vitest';
import {
  cosF32, shuffled, normalizeAnswer, isDiscriminativeAnswer, applyAllowed,
  seedTargetCos, pickByTargetCos, distributeParallel, mmrSelect, kmeansMedoids,
  noveltyScore, SEED_COS_MIN, SEED_COS_MAX,
  answerKind, answerClass, lengthBucket, taskSignature, signaturesCompatible,
} from '../../../pocketbase/vec-lib.mjs';

// Детерминированный «рандом» для проверок раздачи (LCG).
function seededRnd(seed = 1) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}
const vec = (...xs) => Float32Array.from(xs);
const cand = (id, cos, sameAnswer = false) => ({ id, cos, sameAnswer });

describe('cosF32', () => {
  it('одинаковые векторы дают 1, ортогональные 0', () => {
    expect(cosF32(vec(1, 0, 0), vec(1, 0, 0))).toBeCloseTo(1);
    expect(cosF32(vec(1, 0, 0), vec(0, 1, 0))).toBeCloseTo(0);
  });

  it('нулевой вектор не даёт NaN', () => {
    expect(cosF32(vec(0, 0, 0), vec(1, 0, 0))).toBe(0);
  });
});

describe('normalizeAnswer / isDiscriminativeAnswer', () => {
  it('приводит запятую, регистр и пробелы к общему виду', () => {
    expect(normalizeAnswer(' 0,5 ')).toBe('0.5');
    expect(normalizeAnswer('НЕТ')).toBe('нет');
  });

  it('«доказать» и буквенные ответы не различают задачи', () => {
    expect(isDiscriminativeAnswer(normalizeAnswer('доказать'))).toBe(false);
    expect(isDiscriminativeAnswer(normalizeAnswer('абв'))).toBe(false);
    expect(isDiscriminativeAnswer(normalizeAnswer(''))).toBe(false);
    expect(isDiscriminativeAnswer(normalizeAnswer('12,5'))).toBe(true);
  });
});

describe('applyAllowed', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('без списка возвращает пул как есть', () => {
    expect(applyAllowed(rows, null)).toHaveLength(3);
    expect(applyAllowed(rows, [])).toHaveLength(3);
  });

  it('оставляет только разрешённые задачи', () => {
    expect(applyAllowed(rows, ['b', 'c', 'zzz']).map((r) => r.id)).toEqual(['b', 'c']);
  });
});

describe('ползунок похожести', () => {
  it('края ползунка дают границы полосы косинуса', () => {
    expect(seedTargetCos(0)).toBeCloseTo(SEED_COS_MIN);
    expect(seedTargetCos(1)).toBeCloseTo(SEED_COS_MAX);
    expect(seedTargetCos(0.5)).toBeCloseTo((SEED_COS_MIN + SEED_COS_MAX) / 2);
  });

  it('значения вне [0,1] обрезаются', () => {
    expect(seedTargetCos(-3)).toBeCloseTo(SEED_COS_MIN);
    expect(seedTargetCos(42)).toBeCloseTo(SEED_COS_MAX);
  });

  it('выбирает ближайшие к цели, а не просто самые похожие', () => {
    const pool = [0.99, 0.9, 0.84, 0.75, 0.7].map((cos, i) => ({ task_id: `t${i}`, cos }));
    const mid = pickByTargetCos(pool, 0.84, 2).map((r) => r.task_id);
    expect(mid).toEqual(['t1', 't2']); // 0.90 и 0.84 — ближайшие к 0.84
  });

  it('результат отсортирован по убыванию похожести', () => {
    const pool = [0.7, 0.95, 0.82].map((cos, i) => ({ task_id: `t${i}`, cos }));
    const out = pickByTargetCos(pool, 0.8, 3).map((r) => r.cos);
    expect(out).toEqual([...out].sort((a, b) => b - a));
  });
});

describe('distributeParallel', () => {
  // 3 позиции, у каждой по 6 кандидатов с убывающей похожестью
  const pools = [0, 1, 2].map((p) =>
    [0.98, 0.95, 0.92, 0.9, 0.88, 0.85].map((cos, i) => cand(`p${p}-c${i}`, cos))
  );

  it('заполняет все позиции всех вариантов, не повторяя задачи', () => {
    const { variants, shortage } = distributeParallel(pools, 3, seededRnd(7));
    expect(variants).toHaveLength(3);
    const ids = variants.flat().map((c) => c.id);
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
    expect(shortage).toHaveLength(0);
  });

  it('варианты равноценны: систематического перекоса по похожести нет', () => {
    // Прежний жадный подбор отдавал первому варианту лучших кандидатов, и на
    // длинной серии средняя похожесть монотонно убывала от варианта к варианту.
    // Здесь усредняем по многим прогонам: порядок вариантов не должен влиять.
    const rnd = seededRnd(3);
    const sums = [0, 0, 0];
    const RUNS = 200;
    for (let r = 0; r < RUNS; r++) {
      const { variants } = distributeParallel(pools, 3, rnd);
      variants.forEach((v, i) => { sums[i] += v.reduce((s, c) => s + c.cos, 0) / v.length; });
    }
    const means = sums.map((s) => s / RUNS);
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.01);
  });

  it('нехватку кандидатов отмечает shortage и null-ячейкой', () => {
    const scarce = [[cand('only-one', 0.9)], [cand('a', 0.9), cand('b', 0.88)]];
    const { variants, shortage } = distributeParallel(scarce, 2, seededRnd(1));
    expect(shortage).toEqual([{ position: 1 }]);
    const firstPositionCells = variants.map((v) => v[0]);
    expect(firstPositionCells.filter(Boolean)).toHaveLength(1);
    expect(firstPositionCells.filter((c) => c === null)).toHaveLength(1);
  });

  it('разные источники случайности дают разные раскладки', () => {
    const sig = (rnd) => distributeParallel(pools, 2, rnd).variants.flat().map((c) => c?.id).join(',');
    expect(sig(seededRnd(1))).not.toBe(sig(seededRnd(99)));
  });

  it('пустой пул позиции не роняет раздачу', () => {
    const { variants, shortage } = distributeParallel([[], [cand('x', 0.9)]], 1, seededRnd(5));
    expect(variants[0][0]).toBeNull();
    expect(variants[0][1].id).toBe('x');
    expect(shortage).toEqual([{ position: 1 }]);
  });
});

describe('mmrSelect', () => {
  it('берёт максимально непохожие элементы', () => {
    const items = [
      { id: 'x+', vec: vec(1, 0, 0) },
      { id: 'x++', vec: vec(0.99, 0.01, 0) },
      { id: 'y', vec: vec(0, 1, 0) },
      { id: 'z', vec: vec(0, 0, 1) },
    ];
    const picked = mmrSelect(items, 3, seededRnd(2)).map((i) => i.id);
    expect(picked).toHaveLength(3);
    // почти совпадающие x+ и x++ вместе в тройку не попадают
    expect(picked.includes('x+') && picked.includes('x++')).toBe(false);
  });

  it('не запрашивает больше, чем есть в пуле', () => {
    const items = [{ id: 'a', vec: vec(1, 0) }, { id: 'b', vec: vec(0, 1) }];
    expect(mmrSelect(items, 10, seededRnd(1))).toHaveLength(2);
    expect(mmrSelect([], 5, seededRnd(1))).toEqual([]);
  });
});

describe('kmeansMedoids', () => {
  it('возвращает по представителю на кластер', () => {
    const items = [
      { id: 'a1', vec: vec(1, 0) }, { id: 'a2', vec: vec(0.98, 0.02) },
      { id: 'b1', vec: vec(0, 1) }, { id: 'b2', vec: vec(0.02, 0.98) },
    ];
    const picked = kmeansMedoids(items, 2, seededRnd(11));
    expect(picked).toHaveLength(2);
    const ids = picked.map((p) => p.id);
    expect(ids.some((id) => id.startsWith('a'))).toBe(true);
    expect(ids.some((id) => id.startsWith('b'))).toBe(true);
  });
});

describe('noveltyScore', () => {
  it('набор без пересечений с эталоном считается свежим', () => {
    const r = noveltyScore([vec(1, 0), vec(0, 1)], [vec(0, 0, 1).subarray(0, 2)]);
    expect(r.novelty_pct).toBe(100);
    expect(r.dup).toBe(0);
  });

  it('повторы ловятся по порогу dupCos', () => {
    const ref = [vec(1, 0)];
    const r = noveltyScore([vec(1, 0), vec(0, 1)], ref);
    expect(r.dup).toBe(1);
    expect(r.fresh).toBe(1);
    expect(r.novelty_pct).toBe(50);
  });

  it('без эталона всё свежее, пустые векторы не считаются', () => {
    const r = noveltyScore([vec(1, 0), null], []);
    expect(r.scored).toBe(1);
    expect(r.novelty_pct).toBe(100);
  });
});

describe('shuffled', () => {
  it('не меняет исходный массив и сохраняет состав', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffled(src, seededRnd(4));
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});


describe('структурная подпись задачи', () => {
  const sig = (over = {}) => taskSignature({ answer: '5', statement_md: 'Найдите значение $x$.', ...over });

  it('различает формы ответа', () => {
    expect(answerKind('12')).toBe('integer');
    expect(answerKind('0,5')).toBe('decimal');
    expect(answerKind('\\frac{1}{2}')).toBe('fraction');
    expect(answerKind('2; 3')).toBe('multi');
    expect(answerKind('доказать')).toBe('proof');
    expect(answerKind('')).toBe('empty');
    expect(answerKind('x + 1')).toBe('symbolic');
  });

  it('числовые формы попадают в один класс — 0,25 вместо 5 параллель не ломает', () => {
    expect(answerClass(answerKind('5'))).toBe('num');
    expect(answerClass(answerKind('0,25'))).toBe('num');
    expect(answerClass(answerKind('\\frac{3}{4}'))).toBe('num');
    expect(answerClass(answerKind('доказать'))).toBe('proof');
  });

  it('бакет длины растёт вместе с условием', () => {
    expect(lengthBucket('коротко')).toBe('S');
    expect(lengthBucket('x'.repeat(300))).toBe('M');
    expect(lengthBucket('x'.repeat(600))).toBe('L');
    expect(lengthBucket('x'.repeat(2000))).toBe('XL');
  });

  it('видит таблицу, формулы, знак и чертёж', () => {
    const table = taskSignature({ answer: '5', statement_md: 'Дано:\n| a | b |\n| 1 | 2 |' });
    expect(table.table).toBe(true);
    expect(sig().formula).toBe(true);
    expect(sig({ answer: '-5' }).negative).toBe(true);
    expect(sig({ hasImage: true }).figure).toBe(true);
    expect(sig().figure).toBeNull(); // не передали — не знаем
  });
});

describe('signaturesCompatible', () => {
  const base = taskSignature({ answer: '5', statement_md: 'Найдите значение выражения $2+3$.' });

  it('похожая по структуре задача проходит', () => {
    const other = taskSignature({ answer: '7', statement_md: 'Найдите значение выражения $4+3$.' });
    expect(signaturesCompatible(base, other)).toBe(true);
  });

  it('«доказать» не параллель к числовому ответу', () => {
    const proof = taskSignature({ answer: 'доказать', statement_md: 'Докажите, что $a>b$.' });
    expect(signaturesCompatible(base, proof)).toBe(false);
  });

  it('условие с таблицей не параллель к условию без неё', () => {
    const table = taskSignature({ answer: '5', statement_md: 'Дано $x$:\n| a | b |\n| 1 | 2 |' });
    expect(signaturesCompatible(base, table)).toBe(false);
  });

  it('объём условия может отличаться на ступень, но не на две', () => {
    const oneStep = taskSignature({ answer: '5', statement_md: `$x$ ${'текст '.repeat(40)}` });
    const twoSteps = taskSignature({ answer: '5', statement_md: `$x$ ${'текст '.repeat(200)}` });
    expect(signaturesCompatible(base, oneStep)).toBe(true);
    expect(signaturesCompatible(base, twoSteps)).toBe(false);
  });

  it('чертёж различает задачи, но только когда известен у обеих', () => {
    const withFig = taskSignature({ answer: '5', statement_md: 'Найдите $x$ на рисунке.', hasImage: true });
    const noFig = taskSignature({ answer: '5', statement_md: 'Найдите $x$ здесь.', hasImage: false });
    const unknown = taskSignature({ answer: '5', statement_md: 'Найдите $x$ здесь.' });
    expect(signaturesCompatible(withFig, noFig)).toBe(false);
    expect(signaturesCompatible(withFig, unknown)).toBe(true);
  });

  it('пустой ответ не проваливает сравнение', () => {
    const empty = taskSignature({ answer: '', statement_md: 'Найдите значение выражения $2+3$.' });
    expect(signaturesCompatible(base, empty)).toBe(true);
  });

  it('отсутствующая подпись не мешает подбору', () => {
    expect(signaturesCompatible(null, base)).toBe(true);
  });
});
