/**
 * Расписание пар школы + расчёт времени уроков.
 * Единый источник истины: используется и календарём (TeacherCalendar), и
 * дашбордом «Сегодня» (TodayDashboard, hero «Идёт сейчас»).
 *
 * full   = [старт, конец] целой пары;
 * halves = [[1-я полупара], [2-я полупара]] (нулевая пара — без полупар).
 */
export const PAIRS = [
  { key: '0', label: 'Нулевая', full: ['09:00', '10:00'], halves: null },
  { key: '1', label: '1-я пара', full: ['10:15', '11:45'], halves: [['10:15', '11:00'], ['11:05', '11:45']] },
  { key: '2', label: '2-я пара', full: ['12:00', '13:45'], halves: [['12:00', '12:45'], ['12:50', '13:45']] },
  { key: '3', label: '3-я пара', full: ['14:05', '15:40'], halves: [['14:05', '14:50'], ['14:55', '15:40']] },
  { key: '4', label: '4-я пара', full: ['16:00', '17:35'], halves: [['16:00', '16:45'], ['16:50', '17:35']] },
  { key: '5', label: '5-я пара', full: ['17:45', '19:20'], halves: [['17:45', '18:30'], ['18:35', '19:20']] },
  // Вечерние пары — для дистанционных занятий (онлайн-курсы, интенсивы).
  { key: '6', label: 'Вечерняя 1', full: ['19:00', '21:00'], halves: [['19:00', '19:55'], ['20:05', '21:00']] },
  { key: '7', label: 'Вечерняя 2', full: ['21:10', '22:40'], halves: [['21:10', '21:55'], ['22:00', '22:40']] },
];

export const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Карта старт→конец для длительности на календаре. На пересечении старта целой и
// 1-й полупары приоритет у ЦЕЛОЙ (частый случай); 2-я полупара различима по старту.
const START_TO_END = (() => {
  const m = {};
  for (const p of PAIRS) {
    m[p.full[0]] = p.full[1];
    if (p.halves) m[p.halves[1][0]] = p.halves[1][1];
  }
  return m;
})();

// Конец события: по таблице расписания, иначе дефолт 45 мин.
export function endForStart(start) {
  const endStr = START_TO_END[hhmm(start)];
  if (!endStr) return new Date(start.getTime() + 45 * 60 * 1000);
  const [h, m] = endStr.split(':').map(Number);
  const end = new Date(start);
  end.setHours(h, m, 0, 0);
  return end;
}

// Угадать пару/часть по времени старта (для инициализации селектора). Для старта,
// совпадающего с целой/1-й полупарой, по умолчанию 'full'.
export function guessSlot(start) {
  const t = hhmm(start);
  for (const p of PAIRS) {
    if (p.full[0] === t) return { pair: p.key, part: 'full' };
    if (p.halves && p.halves[1][0] === t) return { pair: p.key, part: '2' };
  }
  return { pair: null, part: 'full' };
}

// Диапазон [старт,конец] по коду time_slot: "0"|"N"|"Na"/"Nb"|"N-M" (интенсив).
export function slotRangeFromCode(code) {
  if (!code) return null;
  const inten = /^(\d)-(\d)$/.exec(code);
  if (inten) {
    const a = PAIRS.find((p) => p.key === inten[1]);
    const b = PAIRS.find((p) => p.key === inten[2]);
    return a && b ? [a.full[0], b.full[1]] : null;
  }
  const half = /^(\d)([ab])$/.exec(code);
  if (half) {
    const p = PAIRS.find((x) => x.key === half[1]);
    return p && p.halves ? (half[2] === 'a' ? p.halves[0] : p.halves[1]) : null;
  }
  const p = PAIRS.find((x) => x.key === code);
  return p ? p.full : null;
}

// Конец события: приоритет у сохранённого time_slot (интенсивы/полупары), иначе по
// времени старта (обратная совместимость со старыми уроками), иначе 45 мин.
export function endForLesson(l, start) {
  const r = slotRangeFromCode(l.time_slot);
  if (r) {
    const [h, m] = r[1].split(':').map(Number);
    const end = new Date(start);
    end.setHours(h, m, 0, 0);
    return end;
  }
  return endForStart(start);
}

// Пара Date {start, end} для урока (по date_plan + time_slot).
export function lessonStartEnd(l) {
  const start = new Date(l.date_plan);
  return { start, end: endForLesson(l, start) };
}

// Доля прошедшего времени урока в [0..1] на момент `now` (Date).
// <0 — урок ещё не начался, >1 — уже закончился (вызывающий сам решает, как трактовать).
export function lessonProgress(l, now = new Date()) {
  const { start, end } = lessonStartEnd(l);
  const span = end.getTime() - start.getTime();
  if (span <= 0) return 0;
  return (now.getTime() - start.getTime()) / span;
}
