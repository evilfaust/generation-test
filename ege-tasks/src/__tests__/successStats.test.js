import { describe, it, expect } from 'vitest';
import { wilsonLower, poolStats, poolStatsDetailed, rateColor, LOW_CONFIDENCE_N, shrunkRate } from '../utils/successStats';

describe('wilsonLower', () => {
  it('возвращает 0 при отсутствии наблюдений', () => {
    expect(wilsonLower(0, 0)).toBe(0);
  });

  it('малый n даёт консервативную (заниженную) оценку', () => {
    // 2 из 2 = 100% сырых, но нижняя граница должна быть заметно ниже 1
    const lower = wilsonLower(2, 2);
    expect(lower).toBeGreaterThan(0);
    expect(lower).toBeLessThan(0.7);
  });

  it('большой n приближает нижнюю границу к доле', () => {
    const lower = wilsonLower(80, 100); // p=0.8
    expect(lower).toBeGreaterThan(0.7);
    expect(lower).toBeLessThan(0.8);
  });

  it('0 верных → нижняя граница 0', () => {
    expect(wilsonLower(0, 10)).toBe(0);
  });
});

describe('poolStats', () => {
  const byTask = {
    a: { c: 8, n: 10 },
    b: { c: 1, n: 10 },
    c: { c: 5, n: 5 },
  };

  it('нет данных по задачам темы → rate null', () => {
    expect(poolStats(['x', 'y'], byTask)).toEqual({ rate: null, c: 0, n: 0, lower: 0 });
  });

  it('пулинг суммирует верные и общие, а не усредняет доли', () => {
    // a+b: (8+1)/(10+10) = 9/20 = 0.45 — НЕ среднее долей (0.8+0.1)/2=0.45 совпало бы,
    // но проверим неравный вес: a+c → (8+5)/(10+5)=13/15
    const st = poolStats(['a', 'c'], byTask);
    expect(st.c).toBe(13);
    expect(st.n).toBe(15);
    expect(st.rate).toBeCloseTo(13 / 15, 5);
  });

  it('игнорирует отсутствующие id', () => {
    const st = poolStats(['a', 'missing'], byTask);
    expect(st.n).toBe(10);
    expect(st.c).toBe(8);
  });
});

describe('poolStatsDetailed', () => {
  const byTask = {
    a: { c: 9, n: 10, ci: 8, ni: 8, ce: 1, ne: 2 },
    b: { c: 3, n: 8, ci: 0, ni: 0, ce: 3, ne: 8 },
  };

  it('нет данных → rate null и нулевые ветки', () => {
    const st = poolStatsDetailed(['x'], byTask);
    expect(st.rate).toBeNull();
    expect(st.internal.rate).toBeNull();
    expect(st.external.rate).toBeNull();
  });

  it('разделяет внутренние и внешние свидетельства', () => {
    const st = poolStatsDetailed(['a', 'b'], byTask);
    // комбинированно: (9+3)/(10+8)=12/18
    expect(st.c).toBe(12);
    expect(st.n).toBe(18);
    expect(st.rate).toBeCloseTo(12 / 18, 5);
    // внутр: (8+0)/(8+0)=1.0
    expect(st.internal.c).toBe(8);
    expect(st.internal.n).toBe(8);
    expect(st.internal.rate).toBeCloseTo(1, 5);
    // внеш: (1+3)/(2+8)=4/10
    expect(st.external.c).toBe(4);
    expect(st.external.n).toBe(10);
    expect(st.external.rate).toBeCloseTo(0.4, 5);
  });

  it('задача только с внешними данными — внутр. ветка пустая', () => {
    const st = poolStatsDetailed(['b'], byTask);
    expect(st.internal.n).toBe(0);
    expect(st.internal.rate).toBeNull();
    expect(st.external.n).toBe(8);
  });
});

describe('rateColor', () => {
  it('зелёный при высокой нижней границе', () => {
    expect(rateColor(0.75)).toBe('#52c41a');
  });
  it('жёлтый в среднем диапазоне', () => {
    expect(rateColor(0.5)).toBe('#faad14');
  });
  it('красный при низкой', () => {
    expect(rateColor(0.2)).toBe('#ff4d4f');
  });
});

describe('shrunkRate', () => {
  const prior = 0.8;
  it('при n=0 возвращает приор', () => {
    expect(shrunkRate(0, 0, prior)).toBeCloseTo(prior, 5);
  });
  it('при большом n приближается к измеренной доле', () => {
    // 30/100 при alpha=5 → (30+5*0.8)/(100+5)=34/105≈0.324, близко к 0.3
    const r = shrunkRate(30, 100, prior, 5);
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.35);
  });
  it('малый n тянется к приору', () => {
    // 0/2 при alpha=5 → (0+4)/(7)=0.571, далеко от 0, ближе к приору
    const r = shrunkRate(0, 2, prior, 5);
    expect(r).toBeGreaterThan(0.4);
  });
});

describe('LOW_CONFIDENCE_N', () => {
  it('положительный порог', () => {
    expect(LOW_CONFIDENCE_N).toBeGreaterThan(0);
  });
});
