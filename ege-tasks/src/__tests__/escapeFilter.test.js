import { describe, it, expect } from 'vitest';
import { escapeFilter } from '../utils/escapeFilter';

describe('escapeFilter', () => {
  it('обычная строка проходит без изменений', () => {
    expect(escapeFilter('hello')).toBe('hello');
  });

  it('экранирует двойные кавычки', () => {
    expect(escapeFilter('say "hi"')).toBe('say \\"hi\\"');
  });

  it('экранирует обратные слеши', () => {
    expect(escapeFilter('a\\b')).toBe('a\\\\b');
  });

  it('экранирует обратный слеш ПЕРЕД кавычкой (порядок важен)', () => {
    // Сначала \ → \\, потом " → \"
    expect(escapeFilter('a\\"b')).toBe('a\\\\\\"b');
  });

  it('возвращает пустую строку для null', () => {
    expect(escapeFilter(null)).toBe('');
  });

  it('возвращает пустую строку для undefined', () => {
    expect(escapeFilter(undefined)).toBe('');
  });

  it('конвертирует числа в строку', () => {
    expect(escapeFilter(42)).toBe('42');
  });

  it('конвертирует boolean в строку', () => {
    expect(escapeFilter(true)).toBe('true');
    expect(escapeFilter(false)).toBe('false');
  });

  it('защищает от инъекции типа "; DROP TABLE', () => {
    const malicious = '"; drop table users; --';
    const escaped = escapeFilter(malicious);
    expect(escaped).toBe('\\"; drop table users; --');
    // Все кавычки экранированы
    expect(escaped.match(/(?<!\\)"/g)).toBeNull();
  });

  it('пустая строка возвращается как есть', () => {
    expect(escapeFilter('')).toBe('');
  });
});
