import { describe, it, expect } from 'vitest';
import { validateTaskCode } from '../utils/taskCodeGenerator';

describe('validateTaskCode', () => {
  it('принимает стандартные коды ЕГЭ', () => {
    expect(validateTaskCode('14-001')).toBe(true);
    expect(validateTaskCode('1-001')).toBe(true);
    expect(validateTaskCode('21-999')).toBe(true);
  });

  it('принимает тригонометрические коды T{N}-{seq}', () => {
    expect(validateTaskCode('T1-001')).toBe(true);
    expect(validateTaskCode('T12-042')).toBe(true);
    expect(validateTaskCode('T7-100')).toBe(true);
  });

  it('отклоняет коды без трёх цифр в seq', () => {
    expect(validateTaskCode('14-01')).toBe(false);
    expect(validateTaskCode('14-1')).toBe(false);
    expect(validateTaskCode('14-9999')).toBe(false);
  });

  it('отклоняет коды без разделителя', () => {
    expect(validateTaskCode('14001')).toBe(false);
    expect(validateTaskCode('T1001')).toBe(false);
  });

  it('отклоняет пустую строку', () => {
    expect(validateTaskCode('')).toBe(false);
  });

  it('отклоняет null/undefined', () => {
    expect(validateTaskCode(null)).toBe(false);
    expect(validateTaskCode(undefined)).toBe(false);
  });

  it('отклоняет коды с буквами в seq', () => {
    expect(validateTaskCode('14-abc')).toBe(false);
  });

  it('отклоняет коды Mordkovich (M{par}-{seq} — другой формат)', () => {
    // M{par} не соответствует T\d+ и не является числом → false
    expect(validateTaskCode('M14-001')).toBe(false);
  });
});
