// Календарная разбивка летних каникул на недели (для летней программы).
// Каникулы (по умолчанию 1 июля – 31 августа) делятся на 7-дневные недели;
// у каждой недели есть номер и человекочитаемый диапазон дат.

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function fmtRange(from, to) {
  const d1 = from.getDate();
  const d2 = to.getDate();
  const m1 = MONTHS_GEN[from.getMonth()];
  const m2 = MONTHS_GEN[to.getMonth()];
  return from.getMonth() === to.getMonth()
    ? `${d1}–${d2} ${m2}`
    : `${d1} ${m1} – ${d2} ${m2}`;
}

// Дефолтный диапазон каникул для года: 1 июля – 31 августа.
export function defaultSummerRange(year) {
  return { startDate: `${year}-07-01`, endDate: `${year}-08-31` };
}

// → массив недель [{ week, from: Date, to: Date, label }]. Пустой/битый диапазон → [].
export function summerWeeks(startISO, endISO) {
  if (!startISO || !endISO) return [];
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const weeks = [];
  const cur = new Date(start);
  let i = 1;
  while (cur <= end && i < 30) {
    const from = new Date(cur);
    const to = new Date(cur);
    to.setDate(to.getDate() + 6);
    if (to > end) to.setTime(end.getTime());
    weeks.push({ week: i, from, to, label: fmtRange(from, to) });
    cur.setDate(cur.getDate() + 7);
    i++;
  }
  return weeks;
}

// Подпись конкретной недели по номеру (или null, если вне диапазона).
export function weekLabel(weekNo, startISO, endISO) {
  const w = summerWeeks(startISO, endISO).find((x) => x.week === weekNo);
  return w ? w.label : null;
}
