import { describe, it, expect } from 'vitest';
import {
  normalizeCryptogramPhrase,
  getCryptogramLetterCount,
  getCryptogramUniqueLetterCount,
  buildCryptogramForVariant,
} from '../utils/cryptogram';

describe('normalizeCryptogramPhrase', () => {
  it('приводит к верхнему регистру', () => {
    expect(normalizeCryptogramPhrase('привет')).toBe('ПРИВЕТ');
  });

  it('заменяет Ё на Е', () => {
    expect(normalizeCryptogramPhrase('ёжик')).toBe('ЕЖИК');
  });

  it('удаляет пунктуацию и спецсимволы', () => {
    expect(normalizeCryptogramPhrase('Привет, мир!')).toBe('ПРИВЕТ МИР');
  });

  it('сохраняет цифры', () => {
    expect(normalizeCryptogramPhrase('ABC 123')).toBe('ABC 123');
  });

  it('схлопывает множественные пробелы', () => {
    expect(normalizeCryptogramPhrase('а   б   в')).toBe('А Б В');
  });

  it('возвращает пустую строку для falsy', () => {
    expect(normalizeCryptogramPhrase('')).toBe('');
    expect(normalizeCryptogramPhrase(null)).toBe('');
    expect(normalizeCryptogramPhrase(undefined)).toBe('');
  });
});

describe('getCryptogramLetterCount', () => {
  it('считает все буквы без пробелов', () => {
    expect(getCryptogramLetterCount('абв гд')).toBe(5);
  });

  it('повторы считает отдельно', () => {
    expect(getCryptogramLetterCount('ааа')).toBe(3);
  });
});

describe('getCryptogramUniqueLetterCount', () => {
  it('считает только уникальные буквы', () => {
    expect(getCryptogramUniqueLetterCount('ааа')).toBe(1);
    expect(getCryptogramUniqueLetterCount('абвабв')).toBe(3);
  });

  it('игнорирует пробелы', () => {
    expect(getCryptogramUniqueLetterCount('а б в а')).toBe(3);
  });

  it('ё и е считаются как одна буква', () => {
    expect(getCryptogramUniqueLetterCount('ёж и еж')).toBe(3); // Е, Ж, И
  });
});

describe('buildCryptogramForVariant', () => {
  const makeVariant = (answers, number = 1) => ({
    number,
    tasks: answers.map(answer => ({ answer })),
  });

  it('предупреждает, если задач меньше уникальных букв', () => {
    const result = buildCryptogramForVariant({
      variant: makeVariant(['1', '2']),
      phrase: 'АБВ',
    });
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('предупреждает на пустой фразе', () => {
    const result = buildCryptogramForVariant({
      variant: makeVariant(['1']),
      phrase: '',
    });
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toMatch(/слово|фразу/i);
  });

  it('предупреждает, если у задачи нет ответа', () => {
    const result = buildCryptogramForVariant({
      variant: makeVariant(['1', '', '3']),
      phrase: 'АБВ',
    });
    expect(result.valid).toBe(false);
  });

  it('строит корректный answerKey при валидных данных', () => {
    const result = buildCryptogramForVariant({
      variant: makeVariant(['10', '20', '30']),
      phrase: 'АБВ',
    });
    expect(result.valid).toBe(true);
    expect(result.answerKey).toHaveLength(3);
    // Биекция: первая задача → первая уникальная буква (А)
    expect(result.answerKey[0]).toMatchObject({ answer: '10', letter: 'А' });
    expect(result.answerKey[1]).toMatchObject({ answer: '20', letter: 'Б' });
    expect(result.answerKey[2]).toMatchObject({ answer: '30', letter: 'В' });
  });

  it('answerCells содержит space для пробелов', () => {
    const result = buildCryptogramForVariant({
      variant: makeVariant(['1', '2', '3']),
      phrase: 'А Б В',
    });
    expect(result.answerCells.map(c => c.type)).toEqual([
      'letter', 'space', 'letter', 'space', 'letter',
    ]);
  });

  it('posNum нумеруется последовательно для букв (без пробелов)', () => {
    const result = buildCryptogramForVariant({
      variant: makeVariant(['1', '2', '3']),
      phrase: 'А Б В',
    });
    const posNums = result.answerCells.filter(c => c.type === 'letter').map(c => c.posNum);
    expect(posNums).toEqual([1, 2, 3]);
  });

  it('добавляет дистракторы (decoys) в entries', () => {
    const result = buildCryptogramForVariant({
      variant: makeVariant(['1', '2', '3']),
      phrase: 'АБВ',
      minDecoys: 4,
      maxDecoys: 4,
    });
    const realCount = result.entries.filter(e => !e.isDecoy).length;
    const decoyCount = result.entries.filter(e => e.isDecoy).length;
    expect(realCount).toBe(3);
    expect(decoyCount).toBe(4);
  });

  it('decoys не пересекаются по буквам с real entries', () => {
    const result = buildCryptogramForVariant({
      variant: makeVariant(['1', '2', '3']),
      phrase: 'АБВ',
    });
    const realLetters = new Set(result.entries.filter(e => !e.isDecoy).map(e => e.letter));
    const decoyLetters = result.entries.filter(e => e.isDecoy).map(e => e.letter);
    decoyLetters.forEach(l => expect(realLetters.has(l)).toBe(false));
  });

  it('детерминирован — один и тот же ввод → тот же результат', () => {
    const a = buildCryptogramForVariant({
      variant: makeVariant(['1', '2', '3'], 5),
      phrase: 'АБВ',
    });
    const b = buildCryptogramForVariant({
      variant: makeVariant(['1', '2', '3'], 5),
      phrase: 'АБВ',
    });
    expect(a.entries.map(e => e.letter)).toEqual(b.entries.map(e => e.letter));
  });
});
