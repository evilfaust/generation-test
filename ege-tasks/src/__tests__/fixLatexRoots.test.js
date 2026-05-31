import { describe, it, expect } from 'vitest';
import { fixLatexRoots, hasBrokenRoots } from '../utils/fixLatexRoots';

describe('fixLatexRoots', () => {
  it('чинит главный кейс со скриншота (\\sqrt: + пробельный маркер)', () => {
    const input = '\\log_{\\sqrt: начало аргумента: 3 конец аргумента}';
    expect(fixLatexRoots(input)).toBe('\\log_{\\sqrt{3}}');
  });

  it('чинит слипшийся вариант (без пробелов)', () => {
    const input = '\\sqrt:началоаргумента:3конецаргумента';
    expect(fixLatexRoots(input)).toBe('\\sqrt{3}');
  });

  it('чинит вариант с мягкими переносами', () => {
    const input =
      '\\sqrt: на­ча­ло ар­гу­мен­та: x+1 конец ар­гу­мен­та';
    expect(fixLatexRoots(input)).toBe('\\sqrt{x+1}');
  });

  it('словесный «корень из»', () => {
    const input = 'корень из: начало аргумента: 2 конец аргумента';
    expect(fixLatexRoots(input)).toBe('\\sqrt{2}');
  });

  it('корень N-ой степени', () => {
    const input = 'корень 3 степени из: начало аргумента: 8 конец аргумента';
    expect(fixLatexRoots(input)).toBe('\\sqrt[3]{8}');
  });

  it('\\sqrt[N] с маркером', () => {
    const input = '\\sqrt[4]: началоаргумента 16 конецаргумента';
    expect(fixLatexRoots(input)).toBe('\\sqrt[4]{16}');
  });

  it('вложенные аргументы разворачиваются изнутри наружу', () => {
    const input =
      '\\sqrt: начало аргумента: \\sqrt: начало аргумента: 9 конец аргумента конец аргумента';
    expect(fixLatexRoots(input)).toBe('\\sqrt{\\sqrt{9}}');
  });

  it('несколько корней в одном тексте', () => {
    const input =
      'Найдите \\sqrt: начало аргумента: 3 конец аргумента и \\sqrt: начало аргумента: 5 конец аргумента.';
    expect(fixLatexRoots(input)).toBe('Найдите \\sqrt{3} и \\sqrt{5}.');
  });

  it('Unicode-корни', () => {
    expect(fixLatexRoots('√x + ∛y')).toBe('\\sqrt x + \\sqrt[3]y');
  });

  it('не трогает уже валидный LaTeX', () => {
    const ok = '\\log_3 x - \\log_{1/3} |x-6| = \\sqrt{3}';
    expect(fixLatexRoots(ok)).toBe(ok);
  });

  it('пустые/невалидные входы', () => {
    expect(fixLatexRoots('')).toBe('');
    expect(fixLatexRoots(null)).toBe(null);
    expect(fixLatexRoots(undefined)).toBe(undefined);
  });
});

describe('hasBrokenRoots', () => {
  it('детектит битые маркеры', () => {
    expect(hasBrokenRoots('\\sqrt: начало аргумента: 3 конец аргумента')).toBe(true);
    expect(hasBrokenRoots('началоаргумента 3 конецаргумента')).toBe(true);
    expect(hasBrokenRoots('корень из 2')).toBe(true);
    expect(hasBrokenRoots('√2')).toBe(true);
  });

  it('не срабатывает на валидном тексте', () => {
    expect(hasBrokenRoots('\\sqrt{3} + x^2')).toBe(false);
    expect(hasBrokenRoots('обычный текст без формул')).toBe(false);
    expect(hasBrokenRoots('')).toBe(false);
  });
});
