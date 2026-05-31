import { describe, it, expect } from 'vitest';
import { katexDiagnostics } from '../utils/katexLint';

describe('katexDiagnostics', () => {
  it('возвращает пусто для чистого текста без формул', () => {
    expect(katexDiagnostics('Просто текст без математики')).toEqual([]);
  });

  it('не ругается на валидные inline и display формулы', () => {
    expect(katexDiagnostics('Решите $x^2 + 1 = 0$ и $$\\frac{a}{b}$$')).toEqual([]);
  });

  it('ловит битую формулу (несбалансированная скобка)', () => {
    const d = katexDiagnostics('Найдите $\\frac{1}{$');
    // незакрытая \frac → ошибка KaTeX и/или непарный $
    expect(d.length).toBeGreaterThan(0);
    expect(d.some((x) => x.severity === 'error' || x.severity === 'warning')).toBe(true);
  });

  it('ловит неизвестную команду как error', () => {
    const d = katexDiagnostics('$\\nonexistentcmd{x}$');
    expect(d.some((x) => x.severity === 'error')).toBe(true);
  });

  it('ловит непарный $ как warning', () => {
    const d = katexDiagnostics('Цена $5 за штуку');
    expect(d.some((x) => x.severity === 'warning')).toBe(true);
  });

  it('игнорирует экранированный \\$', () => {
    expect(katexDiagnostics('Цена \\$5 за штуку')).toEqual([]);
  });

  it('пустая формула $$ не считается ошибкой', () => {
    expect(katexDiagnostics('текст $$ ещё')).toEqual([]);
  });

  it('диагностика указывает диапазон внутри текста', () => {
    const text = 'aaa $\\frac{1}{$ bbb';
    const d = katexDiagnostics(text);
    expect(d[0].from).toBeGreaterThanOrEqual(0);
    expect(d[0].to).toBeGreaterThan(d[0].from);
  });
});
