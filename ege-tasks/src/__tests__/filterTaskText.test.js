import { describe, it, expect } from 'vitest';
import { filterTaskText } from '../utils/filterTaskText';

describe('filterTaskText', () => {
  it('удаляет "Вычислите: "', () => {
    expect(filterTaskText('Вычислите: x + 1')).toBe('x + 1');
  });

  it('удаляет "Вычислите " без двоеточия', () => {
    expect(filterTaskText('Вычислите x + 1')).toBe('x + 1');
  });

  it('удаляет "Найдите значение выражения "', () => {
    expect(filterTaskText('Найдите значение выражения $x^2$')).toBe('$x^2$');
  });

  it('удаляет "Решите уравнение: "', () => {
    expect(filterTaskText('Решите уравнение: 2x = 4')).toBe('2x = 4');
  });

  it('удаляет "Найдите: "', () => {
    expect(filterTaskText('Найдите: 42')).toBe('42');
  });

  it('удаляет "Упростите выражение: "', () => {
    expect(filterTaskText('Упростите выражение: $a^2 - b^2$')).toBe('$a^2 - b^2$');
  });

  it('удаляет "Найдите корень уравнения"', () => {
    expect(filterTaskText('Найдите корень уравнения: x = 5')).toBe('x = 5');
  });

  it('не меняет текст без известного префикса', () => {
    expect(filterTaskText('Докажите теорему Пифагора')).toBe('Докажите теорему Пифагора');
  });

  it('не меняет пустую строку', () => {
    expect(filterTaskText('')).toBe('');
  });

  it('возвращает null/undefined как есть', () => {
    expect(filterTaskText(null)).toBe(null);
    expect(filterTaskText(undefined)).toBe(undefined);
  });

  it('удаляет мягкие переносы при сравнении с префиксом', () => {
    // Мягкий перенос (U+00AD) внутри слова не должен мешать удалению префикса
    const textWithSoftHyphen = 'Вычис­лите: результат';
    expect(filterTaskText(textWithSoftHyphen)).toBe('результат');
  });

  it('удаляет двоеточие и пробел после короткого префикса', () => {
    expect(filterTaskText('Решите: x^2 = 9')).toBe('x^2 = 9');
  });
});
