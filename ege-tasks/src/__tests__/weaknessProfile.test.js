import { describe, it, expect } from 'vitest';
import {
  WEAK_STATUS,
  statusFor,
  aggregateObservations,
  internalAnswersToObservations,
  extTaskResultsToObservations,
  normalizeStudentName,
  studentMatchKey,
  filterExternalForStudent,
  buildWeaknessProfile,
} from '../shared/utils/weaknessProfile';

const obs = (topicId, isCorrect, extra = {}) => ({
  topicId, isCorrect, section: 'Алгебра', egeNumber: 1, source: 'internal', date: null, ...extra,
});

describe('statusFor', () => {
  it('нет попыток или нет rate → nodata', () => {
    expect(statusFor(null, 0)).toBe(WEAK_STATUS.NODATA);
    expect(statusFor(0.9, 0)).toBe(WEAK_STATUS.NODATA);
    expect(statusFor(null, 5)).toBe(WEAK_STATUS.NODATA);
  });
  it('пороги red < 0.5 ≤ amber < 0.7 ≤ green', () => {
    expect(statusFor(0.3, 5)).toBe(WEAK_STATUS.RED);
    expect(statusFor(0.49, 5)).toBe(WEAK_STATUS.RED);
    expect(statusFor(0.5, 5)).toBe(WEAK_STATUS.AMBER);
    expect(statusFor(0.69, 5)).toBe(WEAK_STATUS.AMBER);
    expect(statusFor(0.7, 5)).toBe(WEAK_STATUS.GREEN);
    expect(statusFor(1, 5)).toBe(WEAK_STATUS.GREEN);
  });
  it('кастомные пороги', () => {
    expect(statusFor(0.75, 5, { thresholds: { red: 0.6, amber: 0.8 } })).toBe(WEAK_STATUS.AMBER);
  });
});

describe('aggregateObservations', () => {
  it('считает rate и статус по теме', () => {
    const res = aggregateObservations([
      obs('t1', true), obs('t1', false), obs('t1', false), obs('t1', false), // 1/4 = 0.25 → red
      obs('t2', true), obs('t2', true), obs('t2', true), obs('t2', false),   // 3/4 = 0.75 → green
    ]);
    const t1 = res.find((r) => r.topicId === 't1');
    const t2 = res.find((r) => r.topicId === 't2');
    expect(t1.correctRate).toBeCloseTo(0.25);
    expect(t1.status).toBe(WEAK_STATUS.RED);
    expect(t2.correctRate).toBeCloseTo(0.75);
    expect(t2.status).toBe(WEAK_STATUS.GREEN);
  });

  it('сортирует слабые сверху (red → amber → green → nodata)', () => {
    const res = aggregateObservations([
      obs('green', true), obs('green', true), obs('green', true),
      obs('red', false), obs('red', false),
      obs('amber', true), obs('amber', false), obs('amber', true), // 2/3 ≈ 0.67 → amber
    ]);
    expect(res.map((r) => r.topicId)).toEqual(['red', 'amber', 'green']);
  });

  it('lowConfidence при малом числе наблюдений', () => {
    const res = aggregateObservations([obs('t1', false), obs('t1', true)]);
    expect(res[0].lowConfidence).toBe(true);
    const res2 = aggregateObservations([obs('t2', true), obs('t2', true), obs('t2', false)]);
    expect(res2[0].lowConfidence).toBe(false);
  });

  it('recency-вес: свежие ошибки тянут rate вниз сильнее старых верных', () => {
    const now = Date.UTC(2026, 5, 15);
    const day = 24 * 60 * 60 * 1000;
    const res = aggregateObservations([
      // старые верные (полгода назад) + свежие неверные (сегодня)
      obs('t', true, { date: now - 180 * day }),
      obs('t', true, { date: now - 180 * day }),
      obs('t', false, { date: now }),
      obs('t', false, { date: now }),
    ], { now, halfLifeDays: 45 });
    const t = res[0];
    expect(t.correctRate).toBeCloseTo(0.5); // невзвешенно — ровно половина
    expect(t.recencyWeightedRate).toBeLessThan(0.5); // свежие ошибки весомее
  });

  it('тренд up/down по свежей половине', () => {
    const now = Date.UTC(2026, 5, 15);
    const day = 24 * 60 * 60 * 1000;
    const up = aggregateObservations([
      obs('t', false, { date: now - 40 * day }), obs('t', false, { date: now - 30 * day }),
      obs('t', true, { date: now - 10 * day }), obs('t', true, { date: now }),
    ], { now });
    expect(up[0].trend).toBe('up');
    const down = aggregateObservations([
      obs('t', true, { date: now - 40 * day }), obs('t', true, { date: now - 30 * day }),
      obs('t', false, { date: now - 10 * day }), obs('t', false, { date: now }),
    ], { now });
    expect(down[0].trend).toBe('down');
  });

  it('игнорирует наблюдения без topicId', () => {
    const res = aggregateObservations([obs(null, true), obs('t', true)]);
    expect(res).toHaveLength(1);
  });
});

describe('адаптеры', () => {
  it('internalAnswersToObservations берёт topic из expand и дату попытки', () => {
    const answers = [
      { attempt: 'a1', is_correct: true, expand: { task: { topic: { id: 'T5', section: 'Геометрия', ege_number: 17 } } } },
      { attempt: 'a2', is_correct: false, expand: { task: { expand: { topic: { id: 'T5', section: 'Геометрия', ege_number: 17 } } } } },
      { attempt: 'a3', is_correct: true, expand: { task: {} } }, // без темы → пропуск
    ];
    const dates = new Map([['a1', '2026-06-01'], ['a2', '2026-06-10']]);
    const res = internalAnswersToObservations(answers, dates);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ topicId: 'T5', section: 'Геометрия', egeNumber: 17, isCorrect: true, date: '2026-06-01', source: 'internal' });
  });

  it('extTaskResultsToObservations маппит task_number → тему', () => {
    const topicByNum = new Map([[1, { id: 'TA', section: 'Алгебра', ege_number: 1 }]]);
    const rows = [
      { exam_id: 'e1', task_number: 1, is_correct: false },
      { exam_id: 'e1', task_number: 99, is_correct: true }, // нет темы → пропуск
    ];
    const examDates = new Map([['e1', '2026-05-20']]);
    const res = extTaskResultsToObservations(rows, topicByNum, examDates);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ topicId: 'TA', isCorrect: false, date: '2026-05-20', source: 'external' });
  });
});

describe('матчинг ученика', () => {
  it('normalizeStudentName схлопывает пробелы и регистр', () => {
    expect(normalizeStudentName('  Иванов   Иван ')).toBe('иванов иван');
  });

  it('studentMatchKey приоритет telegram_id', () => {
    expect(studentMatchKey({ telegram_id: '123', name: 'Иванов' })).toEqual({ key: 'tg:123', byTelegram: true });
    expect(studentMatchKey({ name: 'Иванов Иван' })).toEqual({ key: 'name:иванов иван', byTelegram: false });
  });

  it('filterExternalForStudent по telegram_id если он есть и в строках', () => {
    const rows = [
      { telegram_id: '111', student_name: 'Иванов', is_correct: true },
      { telegram_id: '222', student_name: 'Петров', is_correct: false },
    ];
    const res = filterExternalForStudent(rows, { telegram_id: '111', name: 'Иванов' });
    expect(res).toHaveLength(1);
    expect(res[0].student_name).toBe('Иванов');
  });

  it('filterExternalForStudent фолбэк на имя, когда telegram_id в строках нет', () => {
    const rows = [
      { student_name: 'Иванов Иван', is_correct: true },
      { student_name: 'Петров', is_correct: false },
    ];
    const res = filterExternalForStudent(rows, { telegram_id: '111', name: 'иванов иван' });
    expect(res).toHaveLength(1);
    expect(res[0].student_name).toBe('Иванов Иван');
  });
});

describe('buildWeaknessProfile (сборка end-to-end)', () => {
  it('сливает внутренние и внешние наблюдения по одной теме', () => {
    const student = { telegram_id: '111', name: 'Иванов' };
    const internalAnswers = [
      { attempt: 'a1', is_correct: false, expand: { task: { topic: { id: 'TA', section: 'Алгебра', ege_number: 1 } } } },
    ];
    const externalTaskResults = [
      { telegram_id: '111', student_name: 'Иванов', exam_id: 'e1', task_number: 1, is_correct: false },
      { telegram_id: '999', student_name: 'Чужой', exam_id: 'e1', task_number: 1, is_correct: true },
    ];
    const topicByNum = new Map([[1, { id: 'TA', section: 'Алгебра', ege_number: 1 }]]);
    const res = buildWeaknessProfile({ student, internalAnswers, externalTaskResults, topicByNum });
    expect(res).toHaveLength(1);
    expect(res[0].topicId).toBe('TA');
    expect(res[0].attempts).toBe(2); // только свои строки (чужой отфильтрован)
    expect(res[0].status).toBe(WEAK_STATUS.RED);
    expect(res[0].sources.sort()).toEqual(['external', 'internal']);
  });
});
