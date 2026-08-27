import { describe, it, expect } from 'vitest';
import { normalizeLabel, normalizeTopicTitle, normalizeStatementStrict, normalizeStatementLoose } from '../utils/normalize';

describe('normalizeLabel', () => {
  it('приводит к нижнему регистру', () => {
    expect(normalizeLabel('ТЕМА')).toBe('тема');
  });

  it('обрезает пробелы по краям', () => {
    expect(normalizeLabel('  тема  ')).toBe('тема');
  });

  it('схлопывает множественные пробелы', () => {
    expect(normalizeLabel('тема  один   два')).toBe('тема один два');
  });

  it('заменяет ё на е', () => {
    expect(normalizeLabel('Ёлка')).toBe('елка');
    expect(normalizeLabel('ёж')).toBe('еж');
  });

  it('возвращает пустую строку для falsy', () => {
    expect(normalizeLabel('')).toBe('');
    expect(normalizeLabel(null)).toBe('');
    expect(normalizeLabel(undefined)).toBe('');
  });

  it('конвертирует число в строку', () => {
    expect(normalizeLabel(42)).toBe('42');
  });
});

describe('normalizeStatementStrict', () => {
  it('аналогично normalizeLabel: trim + lower + ё→е + пробелы', () => {
    expect(normalizeStatementStrict('  Найдите значение  ')).toBe('найдите значение');
    expect(normalizeStatementStrict('Ёлочка')).toBe('елочка');
  });

  it('сохраняет пунктуацию', () => {
    expect(normalizeStatementStrict('Вычислите: x+1')).toBe('вычислите: x+1');
  });
});

describe('normalizeStatementLoose', () => {
  it('удаляет пунктуацию', () => {
    expect(normalizeStatementLoose('вычислите: x+1')).toBe('вычислитеx+1');
  });

  it('удаляет пробелы', () => {
    expect(normalizeStatementLoose('найди значение')).toBe('найдизначение');
  });

  it('удаляет знаки $', () => {
    expect(normalizeStatementLoose('$x^2$')).toBe('x^2');
  });

  it('удаляет обратные слеши', () => {
    expect(normalizeStatementLoose('\\frac')).toBe('frac');
  });

  it('заменяет ё на е', () => {
    expect(normalizeStatementLoose('Ёж')).toBe('еж');
  });

  it('возвращает пустую строку для falsy', () => {
    expect(normalizeStatementLoose('')).toBe('');
    expect(normalizeStatementLoose(null)).toBe('');
  });
});

describe('normalizeTopicTitle', () => {
  it('игнорирует точку и «№» — тема из файла совпадает с темой в базе', () => {
    expect(normalizeTopicTitle('ЕГЭ-База №14 Вычисления'))
      .toBe(normalizeTopicTitle('ЕГЭ-База. №14 Вычисления'));
  });

  it('игнорирует регистр и ё', () => {
    expect(normalizeTopicTitle('Чётность')).toBe(normalizeTopicTitle('четность'));
  });

  it('схлопывает пробелы после снятой пунктуации', () => {
    expect(normalizeTopicTitle('Входной тест из 10 в 11 класс. Профиль'))
      .toBe('входной тест из 10 в 11 класс профиль');
  });

  it('возвращает пустую строку для falsy', () => {
    expect(normalizeTopicTitle('')).toBe('');
    expect(normalizeTopicTitle(null)).toBe('');
  });
});
