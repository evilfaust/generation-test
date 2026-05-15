import { describe, it, expect } from 'vitest';
import {
  generateDistractors,
  buildOptions,
  shuffleOptionsWithSeed,
  hashStringToSeed,
} from '../utils/distractorGenerator';

describe('generateDistractors', () => {
  it('возвращает запрошенное количество дистракторов', () => {
    expect(generateDistractors('8', 3)).toHaveLength(3);
    expect(generateDistractors('8', 5)).toHaveLength(5);
  });

  it('дистракторы для целого числа не совпадают с правильным', () => {
    const distractors = generateDistractors('8', 3);
    expect(distractors).not.toContain('8');
  });

  it('дистракторы уникальны между собой', () => {
    const distractors = generateDistractors('10', 4);
    expect(new Set(distractors).size).toBe(distractors.length);
  });

  it('сохраняет запятую как разделитель для десятичных', () => {
    const distractors = generateDistractors('1,5', 3);
    distractors.forEach(d => {
      if (d) expect(d).not.toContain('.');
    });
  });

  it('генерирует дистракторы для дроби a/b', () => {
    const distractors = generateDistractors('3/4', 3);
    expect(distractors).toHaveLength(3);
    distractors.forEach(d => {
      if (d) expect(d).toMatch(/^-?\d+\/-?\d+$/);
    });
  });

  it('не создаёт дроби с делением на ноль', () => {
    const distractors = generateDistractors('1/1', 5);
    distractors.forEach(d => {
      expect(d.endsWith('/0')).toBe(false);
    });
  });

  it('берёт первый ответ из альтернатив (через |)', () => {
    const distractors = generateDistractors('8|8,0', 3);
    expect(distractors).not.toContain('8');
  });

  it('возвращает массив пустых строк для пустого/null', () => {
    expect(generateDistractors('', 3)).toEqual(['', '', '']);
    expect(generateDistractors(null, 3)).toEqual(['', '', '']);
    expect(generateDistractors(undefined, 3)).toEqual(['', '', '']);
  });

  it('текстовые дистракторы — варьируют числа внутри текста', () => {
    const distractors = generateDistractors('x = 5', 3);
    expect(distractors).toHaveLength(3);
    expect(distractors).not.toContain('x = 5');
  });
});

describe('buildOptions', () => {
  it('возвращает 4 варианта по умолчанию', () => {
    const opts = buildOptions('8');
    expect(opts).toHaveLength(4);
  });

  it('первый вариант — правильный', () => {
    const opts = buildOptions('8');
    expect(opts[0]).toEqual({ text: '8', is_correct: true });
  });

  it('остальные варианты — неправильные', () => {
    const opts = buildOptions('8');
    for (let i = 1; i < opts.length; i++) {
      expect(opts[i].is_correct).toBe(false);
    }
  });

  it('извлекает первый из альтернативных ответов', () => {
    const opts = buildOptions('8|8,0|восемь');
    expect(opts[0].text).toBe('8');
  });

  it('кастомное количество вариантов', () => {
    expect(buildOptions('5', 3)).toHaveLength(3);
    expect(buildOptions('5', 5)).toHaveLength(5);
  });
});

describe('shuffleOptionsWithSeed', () => {
  const opts = [
    { text: 'A', is_correct: true },
    { text: 'B', is_correct: false },
    { text: 'C', is_correct: false },
    { text: 'D', is_correct: false },
  ];

  it('детерминированно — один и тот же seed даёт тот же результат', () => {
    const r1 = shuffleOptionsWithSeed(opts, 42);
    const r2 = shuffleOptionsWithSeed(opts, 42);
    expect(r1).toEqual(r2);
  });

  it('разные seed дают разные результаты (с большой вероятностью)', () => {
    const r1 = shuffleOptionsWithSeed(opts, 1);
    const r2 = shuffleOptionsWithSeed(opts, 999999);
    // Хотя бы один из 4 элементов на разной позиции
    let different = false;
    for (let i = 0; i < opts.length; i++) {
      if (r1[i].text !== r2[i].text) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });

  it('содержит все исходные элементы', () => {
    const shuffled = shuffleOptionsWithSeed(opts, 123);
    const texts = shuffled.map(o => o.text).sort();
    expect(texts).toEqual(['A', 'B', 'C', 'D']);
  });

  it('не мутирует исходный массив', () => {
    const original = [...opts];
    shuffleOptionsWithSeed(opts, 7);
    expect(opts).toEqual(original);
  });

  it('сохраняет ровно один правильный ответ', () => {
    const shuffled = shuffleOptionsWithSeed(opts, 555);
    expect(shuffled.filter(o => o.is_correct)).toHaveLength(1);
  });
});

describe('hashStringToSeed', () => {
  it('детерминирован — одна строка → один хеш', () => {
    expect(hashStringToSeed('test')).toBe(hashStringToSeed('test'));
  });

  it('разные строки → разные хеши (обычно)', () => {
    expect(hashStringToSeed('abc')).not.toBe(hashStringToSeed('def'));
  });

  it('возвращает unsigned 32-bit', () => {
    const h = hashStringToSeed('какой-то текст с unicode 🚀');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('пустая строка возвращает начальный seed', () => {
    expect(hashStringToSeed('')).toBe(2166136261);
  });
});
