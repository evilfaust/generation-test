// Фактический прогресс учеников по кампании каникулярного задания.
//
// Источник правды — попытки (attempts) по выдачам элементов плана. Выдача
// каждого элемента индивидуальна (см. buildProgram.js), поэтому попытка
// привязывается к ученику ЧЕРЕЗ СЕССИЮ, а не через attempt.student — так
// корректно считаются и те, кто решал анонимно, без входа в аккаунт.
//
// Считаем только элементы с выдачей: файлы, ссылки и устный счёт факта не
// оставляют, они в знаменатель не попадают.
//
// Дедлайна у летних выдач нет (is_open, без deadline), роль срока играет
// params.week: неделя плана + config.startDate дают «ожидалось к сегодня»,
// то есть темп относительно плана.

import { summerWeeks } from '../../../shared/utils/summerWeeks';

export const PACE = {
  NO_PLAN:     'no_plan',      // в плане нет ни одной выданной работы
  NOT_STARTED: 'not_started',  // план есть, попыток нет ни одной
  BEHIND:      'behind',       // сдано меньше, чем ожидалось к сегодня
  ON_TRACK:    'on_track',     // идёт по графику (или опережает)
  DONE:        'done',         // сдано всё
};

export const PACE_LABEL = {
  [PACE.NO_PLAN]:     'нет работ',
  [PACE.NOT_STARTED]: 'не приступил',
  [PACE.BEHIND]:      'отстаёт',
  [PACE.ON_TRACK]:    'в графике',
  [PACE.DONE]:        'всё сдано',
};

export const PACE_TONE = {
  [PACE.NO_PLAN]:     'neutral',
  [PACE.NOT_STARTED]: 'neutral',
  [PACE.BEHIND]:      'rose',
  [PACE.ON_TRACK]:    'blue',
  [PACE.DONE]:        'teal',
};

const SUBMITTED = new Set(['submitted', 'corrected']);

/** Номер текущей недели плана (1..N). 0 — план ещё не начался, N — уже закончился. */
export function currentWeekIndex(config, now = new Date()) {
  const weeks = summerWeeks(config?.startDate, config?.endDate);
  if (!weeks.length) return null;
  const t = now.getTime();
  if (t < weeks[0].from.getTime()) return 0;
  for (const w of weeks) {
    // Неделя считается текущей до конца её последнего дня.
    const till = new Date(w.to);
    till.setHours(23, 59, 59, 999);
    if (t <= till.getTime()) return w.week;
  }
  return weeks.length;
}

/** Лучшая попытка по сессии: максимум score, при равенстве — более поздняя. */
function bestAttempt(list) {
  let best = null;
  for (const a of list) {
    if (!SUBMITTED.has(a.status)) continue;
    if (!best) { best = a; continue; }
    const s = Number(a.score) || 0;
    const bs = Number(best.score) || 0;
    if (s > bs || (s === bs && attemptTime(a) > attemptTime(best))) best = a;
  }
  return best;
}

function attemptTime(a) {
  const v = a?.submitted_at || a?.created;
  const t = v ? new Date(v).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Сводка по кампании.
 *
 * @param {object[]} students  ученики группы (без external)
 * @param {object}   programs  studentId → study_programs
 * @param {object[]} items     study_program_items всех программ кампании
 * @param {object[]} attempts  попытки по сессиям этих элементов
 * @param {object}   campaign  сама кампания (нужен deadline как запасной срок)
 * @param {Date}     now
 */
export function computeCampaignProgress({
  students = [], programs = {}, items = [], attempts = [], campaign = null, now = new Date(),
} = {}) {
  // Попытки по сессиям.
  const bySession = new Map();
  for (const a of attempts) {
    if (!a.session) continue;
    if (!bySession.has(a.session)) bySession.set(a.session, []);
    bySession.get(a.session).push(a);
  }

  // Элементы с выдачей — по программам.
  const byProgram = new Map();
  for (const it of items) {
    if (!it.session || !it.program) continue;
    if (!byProgram.has(it.program)) byProgram.set(it.program, []);
    byProgram.get(it.program).push(it);
  }

  const campaignOverdue = campaign?.deadline
    ? now.getTime() > new Date(campaign.deadline).getTime()
    : false;

  const byStudent = {};
  const notStarted = [];
  const paceCount = {
    [PACE.NO_PLAN]: 0, [PACE.NOT_STARTED]: 0, [PACE.BEHIND]: 0, [PACE.ON_TRACK]: 0, [PACE.DONE]: 0,
  };
  let worksTotal = 0;
  let worksDone = 0;
  let correctTotal = 0;
  let answeredTotal = 0;
  let startedStudents = 0;

  const week = (it) => Number(it.params?.week) || 1;

  for (const s of students) {
    const prog = programs[s.id];
    const list = prog ? (byProgram.get(prog.id) || []) : [];

    let done = 0;
    let inProgress = 0;
    let correct = 0;
    let answered = 0;
    let lastActivity = 0;

    for (const it of list) {
      const sessionAttempts = bySession.get(it.session) || [];
      if (!sessionAttempts.length) continue;
      for (const a of sessionAttempts) lastActivity = Math.max(lastActivity, attemptTime(a));
      const best = bestAttempt(sessionAttempts);
      if (best) {
        done += 1;
        correct += Number(best.score) || 0;
        answered += Number(best.total) || 0;
      } else {
        inProgress += 1; // попытка начата, но не сдана
      }
    }

    // Ожидалось к сегодня: работы недель, которые уже наступили.
    const wk = currentWeekIndex(prog?.config, now);
    let expected = null;
    if (wk != null) expected = list.filter((it) => week(it) <= wk).length;
    else if (campaignOverdue) expected = list.length;

    const works = list.length;
    const started = done + inProgress > 0;
    const behindBy = expected == null ? 0 : Math.max(0, expected - done);

    let pace;
    if (!works) pace = PACE.NO_PLAN;
    else if (done >= works) pace = PACE.DONE;
    else if (!started) pace = PACE.NOT_STARTED;
    else if (behindBy > 0) pace = PACE.BEHIND;
    else pace = PACE.ON_TRACK;

    byStudent[s.id] = {
      works,
      done,
      inProgress,
      expected,
      behindBy,
      pace,
      started,
      correct,
      answered,
      quality: answered > 0 ? correct / answered : null,
      lastActivity: lastActivity ? new Date(lastActivity) : null,
      hasProgram: !!prog,
    };

    paceCount[pace] += 1;
    worksTotal += works;
    worksDone += done;
    correctTotal += correct;
    answeredTotal += answered;
    if (started) startedStudents += 1;
    else if (works) notStarted.push(s);
  }

  return {
    byStudent,
    totals: {
      students: students.length,
      withProgram: students.filter((s) => !!programs[s.id]).length,
      startedStudents,
      notStarted,                       // ученики с планом, но без единой попытки
      works: worksTotal,
      done: worksDone,
      quality: answeredTotal > 0 ? correctTotal / answeredTotal : null,
      pace: paceCount,
    },
  };
}

/** «сегодня» / «3 дня назад» / «—» — короткая подпись последней активности. */
export function lastActivityLabel(date, now = new Date()) {
  if (!date) return null;
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} нед. назад`;
  return `${Math.floor(days / 30)} мес. назад`;
}
