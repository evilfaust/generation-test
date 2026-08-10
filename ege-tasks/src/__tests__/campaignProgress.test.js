import { describe, it, expect } from 'vitest';
import {
  computeCampaignProgress, currentWeekIndex, lastActivityLabel, PACE,
} from '../components/workspace/summer/campaignProgress';

const CONFIG = { startDate: '2026-07-01', endDate: '2026-08-31' };

// 1 июля — понедельник недели 1; неделя 3 стартует 15 июля.
const NOW = new Date('2026-07-20T12:00:00Z'); // середина недели 3

function student(id, name) { return { id, name }; }
function program(id, student) { return { id, student, config: CONFIG }; }
function item(id, prog, week, session) {
  return { id, program: prog, session, params: { week }, block_type: 'algebra', title: `Работа ${id}` };
}
function attempt(session, status, score, total, at) {
  return { id: `a-${session}-${status}-${score}`, session, status, score, total, submitted_at: at };
}

describe('currentWeekIndex', () => {
  it('считает номер недели по датам плана', () => {
    expect(currentWeekIndex(CONFIG, new Date('2026-07-02'))).toBe(1);
    expect(currentWeekIndex(CONFIG, new Date('2026-07-20'))).toBe(3);
  });

  it('до начала — 0, после конца — последняя неделя', () => {
    expect(currentWeekIndex(CONFIG, new Date('2026-06-20'))).toBe(0);
    expect(currentWeekIndex(CONFIG, new Date('2026-09-10'))).toBe(9);
  });

  it('без дат — null (темп не считаем)', () => {
    expect(currentWeekIndex(null, NOW)).toBeNull();
    expect(currentWeekIndex({ startDate: '2026-07-01' }, NOW)).toBeNull();
  });
});

describe('computeCampaignProgress', () => {
  const students = [student('s1', 'Аня'), student('s2', 'Борис'), student('s3', 'Вера')];
  const programs = { s1: program('p1', 's1'), s2: program('p2', 's2'), s3: program('p3', 's3') };
  const items = [
    item('i1', 'p1', 1, 'sess1'), item('i2', 'p1', 2, 'sess2'), item('i3', 'p1', 5, 'sess3'),
    item('i4', 'p2', 1, 'sess4'), item('i5', 'p2', 2, 'sess5'),
    item('i6', 'p3', 1, 'sess6'),
    // элемент без выдачи (файл) — в знаменатель не идёт
    { id: 'i7', program: 'p3', session: null, params: { week: 1 }, block_type: 'custom' },
  ];

  it('считает сдачи, темп и решаемость по выдачам', () => {
    const attempts = [
      // Аня: сдала обе работы прошедших недель → в графике
      attempt('sess1', 'submitted', 4, 5, '2026-07-05'),
      attempt('sess2', 'submitted', 3, 5, '2026-07-12'),
      // Борис: одну сдал, вторую только начал → отстаёт на 1
      attempt('sess4', 'submitted', 2, 5, '2026-07-04'),
      attempt('sess5', 'started', 0, 0, null),
      // Вера — ни одной попытки
    ];
    const { byStudent, totals } = computeCampaignProgress({
      students, programs, items, attempts, now: NOW,
    });

    expect(byStudent.s1).toMatchObject({ works: 3, done: 2, expected: 2, behindBy: 0, pace: PACE.ON_TRACK });
    expect(byStudent.s1.quality).toBeCloseTo(7 / 10);

    expect(byStudent.s2).toMatchObject({ works: 2, done: 1, inProgress: 1, expected: 2, behindBy: 1, pace: PACE.BEHIND });

    expect(byStudent.s3).toMatchObject({ works: 1, done: 0, started: false, pace: PACE.NOT_STARTED });

    expect(totals.works).toBe(6);        // элемент-файл не считается
    expect(totals.done).toBe(3);
    expect(totals.startedStudents).toBe(2);
    expect(totals.notStarted.map((s) => s.id)).toEqual(['s3']);
    expect(totals.quality).toBeCloseTo(9 / 15);
  });

  it('лучшая попытка из нескольких идёт в зачёт', () => {
    const attempts = [
      attempt('sess6', 'submitted', 1, 5, '2026-07-03'),
      attempt('sess6', 'submitted', 4, 5, '2026-07-10'),
    ];
    const { byStudent } = computeCampaignProgress({
      students: [student('s3', 'Вера')], programs: { s3: programs.s3 }, items, attempts, now: NOW,
    });
    expect(byStudent.s3.done).toBe(1);
    expect(byStudent.s3.correct).toBe(4);
    expect(byStudent.s3.lastActivity?.toISOString().slice(0, 10)).toBe('2026-07-10');
  });

  it('сдано всё — статус done, даже если недели ещё не кончились', () => {
    const attempts = [
      attempt('sess1', 'submitted', 5, 5, '2026-07-05'),
      attempt('sess2', 'submitted', 5, 5, '2026-07-06'),
      attempt('sess3', 'corrected', 5, 5, '2026-07-07'),
    ];
    const { byStudent } = computeCampaignProgress({
      students: [student('s1', 'Аня')], programs: { s1: programs.s1 }, items, attempts, now: NOW,
    });
    expect(byStudent.s1.pace).toBe(PACE.DONE);
  });

  it('нет программы или нет выдач — no_plan, в знаменатель не идёт', () => {
    const { byStudent, totals } = computeCampaignProgress({
      students: [student('s9', 'Гриша')], programs: {}, items, attempts: [], now: NOW,
    });
    expect(byStudent.s9).toMatchObject({ works: 0, pace: PACE.NO_PLAN, hasProgram: false });
    expect(totals.notStarted).toEqual([]); // без плана не попрекаем
    expect(totals.quality).toBeNull();
  });

  it('без дат плана темп не считается, но сдачи считаются', () => {
    const noDates = { s1: { id: 'p1', student: 's1', config: {} } };
    const attempts = [attempt('sess1', 'submitted', 5, 5, '2026-07-05')];
    const { byStudent } = computeCampaignProgress({
      students: [student('s1', 'Аня')], programs: noDates, items, attempts, now: NOW,
    });
    expect(byStudent.s1.expected).toBeNull();
    expect(byStudent.s1.done).toBe(1);
    expect(byStudent.s1.pace).toBe(PACE.ON_TRACK);
  });

  it('дедлайн кампании прошёл, дат плана нет → ожидались все работы', () => {
    const noDates = { s2: { id: 'p2', student: 's2', config: {} } };
    const attempts = [attempt('sess4', 'submitted', 5, 5, '2026-07-05')];
    const { byStudent } = computeCampaignProgress({
      students: [student('s2', 'Борис')], programs: noDates, items, attempts,
      campaign: { deadline: '2026-07-15' }, now: NOW,
    });
    expect(byStudent.s2).toMatchObject({ expected: 2, behindBy: 1, pace: PACE.BEHIND });
  });
});

describe('lastActivityLabel', () => {
  const now = new Date('2026-07-20T12:00:00Z');
  it('форматирует давность', () => {
    expect(lastActivityLabel(null)).toBeNull();
    expect(lastActivityLabel(new Date('2026-07-20T09:00:00Z'), now)).toBe('сегодня');
    expect(lastActivityLabel(new Date('2026-07-19T09:00:00Z'), now)).toBe('вчера');
    expect(lastActivityLabel(new Date('2026-07-17T09:00:00Z'), now)).toBe('3 дн. назад');
    expect(lastActivityLabel(new Date('2026-07-06T09:00:00Z'), now)).toBe('2 нед. назад');
  });
});
