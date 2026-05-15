import { describe, it, expect } from 'vitest';
import { normalizeAnswer, checkAnswer } from '../utils/answerChecker';

describe('normalizeAnswer', () => {
  it('парсит целые числа', () => {
    expect(normalizeAnswer('8')).toBe(8);
    expect(normalizeAnswer('-2')).toBe(-2);
    expect(normalizeAnswer('0')).toBe(0);
  });

  it('парсит десятичные с запятой', () => {
    expect(normalizeAnswer('1,5')).toBeCloseTo(1.5);
    expect(normalizeAnswer('-0,04')).toBeCloseTo(-0.04);
  });

  it('парсит десятичные с точкой', () => {
    expect(normalizeAnswer('0.333')).toBeCloseTo(0.333);
  });

  it('парсит простые дроби a/b', () => {
    expect(normalizeAnswer('3/2')).toBeCloseTo(1.5);
    expect(normalizeAnswer('1/2')).toBeCloseTo(0.5);
    expect(normalizeAnswer('-1/4')).toBeCloseTo(-0.25);
  });

  it('парсит LaTeX-обёртку $...$', () => {
    expect(normalizeAnswer('$8$')).toBe(8);
    expect(normalizeAnswer('$-2$')).toBe(-2);
    expect(normalizeAnswer('$0$')).toBe(0);
  });

  it('парсит LaTeX-присваивание $x = 5$', () => {
    expect(normalizeAnswer('$x = 5$')).toBe(5);
    expect(normalizeAnswer('$x = 27$')).toBe(27);
    expect(normalizeAnswer('x = 8')).toBe(8);
  });

  it('парсит LaTeX-дроби \\frac{a}{b}', () => {
    expect(normalizeAnswer('$\\frac{1}{2}$')).toBeCloseTo(0.5);
    expect(normalizeAnswer('$-\\frac{3}{4}$')).toBeCloseTo(-0.75);
    expect(normalizeAnswer('$\\dfrac{2}{3}$')).toBeCloseTo(2 / 3);
  });

  it('парсит смешанные дроби в LaTeX', () => {
    expect(normalizeAnswer('$10\\dfrac{1}{4}$')).toBeCloseTo(10.25);
    expect(normalizeAnswer('$1\\frac{1}{2}$')).toBeCloseTo(1.5);
  });

  it('парсит LaTeX-запятую {,}', () => {
    expect(normalizeAnswer('$0{,}04$')).toBeCloseTo(0.04);
  });

  it('возвращает NaN для пустой строки', () => {
    expect(normalizeAnswer('')).toBeNaN();
    expect(normalizeAnswer('   ')).toBeNaN();
  });

  it('возвращает NaN для null/undefined', () => {
    expect(normalizeAnswer(null)).toBeNaN();
    expect(normalizeAnswer(undefined)).toBeNaN();
  });

  it('возвращает NaN для нечисловых выражений', () => {
    expect(normalizeAnswer('$(-1)^n \\frac{\\pi}{3} + \\pi n$')).toBeNaN();
  });
});

describe('checkAnswer', () => {
  it('правильный ответ — числовое совпадение', () => {
    const result = checkAnswer('8', '8');
    expect(result.isCorrect).toBe(true);
    expect(result.normalized).toBe(8);
  });

  it('неправильный ответ — числовое несовпадение', () => {
    const result = checkAnswer('9', '8');
    expect(result.isCorrect).toBe(false);
  });

  it('совпадение с учётом epsilon', () => {
    const result = checkAnswer('0.3333333', '1/3');
    expect(result.isCorrect).toBe(true);
  });

  it('альтернативные ответы через |', () => {
    expect(checkAnswer('3', '3|3,0').isCorrect).toBe(true);
    expect(checkAnswer('3,0', '3|3,0').isCorrect).toBe(true);
    expect(checkAnswer('4', '3|3,0').isCorrect).toBe(false);
  });

  it('LaTeX-ответ в correctRaw', () => {
    expect(checkAnswer('5', '$x = 5$').isCorrect).toBe(true);
    expect(checkAnswer('0,5', '$\\frac{1}{2}$').isCorrect).toBe(true);
  });

  it('текстовое совпадение (нечисловые ответы)', () => {
    expect(checkAnswer('нет решений', 'нет решений').isCorrect).toBe(true);
    expect(checkAnswer('Нет Решений', 'нет решений').isCorrect).toBe(true);
    expect(checkAnswer('yes', 'нет решений').isCorrect).toBe(false);
  });

  it('пустой studentRaw → не засчитывается', () => {
    expect(checkAnswer('', '8').isCorrect).toBe(false);
    expect(checkAnswer('   ', '8').isCorrect).toBe(false);
  });

  it('отсутствующий correctRaw → не засчитывается', () => {
    expect(checkAnswer('8', '').isCorrect).toBe(false);
    expect(checkAnswer('8', null).isCorrect).toBe(false);
  });

  it('запятая vs точка считаются одинаково', () => {
    expect(checkAnswer('1,5', '1.5').isCorrect).toBe(true);
    expect(checkAnswer('1.5', '1,5').isCorrect).toBe(true);
  });
});
