import { describe, it, expect } from 'vitest';
import { summerWeeks, weekLabel, defaultSummerRange } from '../shared/utils/summerWeeks';

describe('summerWeeks', () => {
  it('1 июля – 31 августа = 9 недель (62 дня)', () => {
    const w = summerWeeks('2026-07-01', '2026-08-31');
    expect(w.length).toBe(9);
    expect(w[0].week).toBe(1);
    expect(w[8].week).toBe(9);
  });

  it('первая неделя 1–7 июля, нумерация подряд', () => {
    const w = summerWeeks('2026-07-01', '2026-08-31');
    expect(w[0].label).toBe('1–7 июля');
    expect(w[1].label).toBe('8–14 июля');
  });

  it('переход через месяц подписывается с двумя месяцами', () => {
    const w = summerWeeks('2026-07-01', '2026-08-31');
    // 5-я неделя: 29 июля – 4 августа
    expect(w[4].label).toBe('29 июля – 4 августа');
  });

  it('последняя неделя обрезается по концу диапазона', () => {
    const w = summerWeeks('2026-07-01', '2026-08-31');
    const last = w[w.length - 1];
    expect(last.to.getDate()).toBe(31);
    expect(last.to.getMonth()).toBe(7); // август (0-based)
  });

  it('битый/пустой диапазон → []', () => {
    expect(summerWeeks(null, null)).toEqual([]);
    expect(summerWeeks('2026-08-31', '2026-07-01')).toEqual([]);
  });

  it('weekLabel по номеру', () => {
    expect(weekLabel(1, '2026-07-01', '2026-08-31')).toBe('1–7 июля');
    expect(weekLabel(99, '2026-07-01', '2026-08-31')).toBe(null);
  });

  it('defaultSummerRange — июль–август', () => {
    expect(defaultSummerRange(2026)).toEqual({ startDate: '2026-07-01', endDate: '2026-08-31' });
  });
});
