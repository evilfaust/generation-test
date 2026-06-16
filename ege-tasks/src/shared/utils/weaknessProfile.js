// Профиль слабостей ученика — единая тематическая модель поверх двух источников:
//  • внутренние прохождения Lemma (attempts → attempt_answers → task → topic)
//  • внешние результаты решу.ЕГЭ (ext_journal_task_results → task_number → topic ege_base)
//
// Ядро (aggregateObservations/statusFor/buildWeaknessProfile) — чистые функции над
// нормализованными «наблюдениями», покрыты юнит-тестами. Адаптеры превращают сырой
// ответ API в наблюдения. Ключ темы — topicId (НЕ номер ЕГЭ) → готовность к профилю.
//
// Наблюдение (Observation): { topicId, section, egeNumber, isCorrect: bool,
//   date: number|string|Date|null, source: 'internal'|'external' }

export const WEAK_STATUS = Object.freeze({
  RED: 'red',     // явная слабость
  AMBER: 'amber', // зона риска
  GREEN: 'green', // освоено
  NODATA: 'nodata', // нет данных
});

// Пороги по доле верных (recency-взвешенной): rate < red → RED, < amber → AMBER, иначе GREEN.
export const DEFAULT_THRESHOLDS = Object.freeze({ red: 0.5, amber: 0.7 });

// Период полураспада веса свежести (дней): наблюдение «состаривается» вдвое за это время.
export const DEFAULT_HALF_LIFE_DAYS = 45;

// Сколько наблюдений считаем достаточным, чтобы доверять статусу (иначе lowConfidence).
export const DEFAULT_MIN_CONFIDENT = 3;

// → миллисекунды эпохи или null. Принимает number(ms), ISO-строку, Date.
function toMs(date) {
  if (date == null) return null;
  if (typeof date === 'number') return Number.isFinite(date) ? date : null;
  if (date instanceof Date) { const t = date.getTime(); return Number.isNaN(t) ? null : t; }
  const t = Date.parse(date);
  return Number.isNaN(t) ? null : t;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Вес свежести: 0.5^(возраст_в_днях / период_полураспада). Без даты — нейтральный вес 1.
function recencyWeight(ms, now, halfLifeDays) {
  if (ms == null) return 1;
  const ageDays = Math.max(0, (now - ms) / DAY_MS);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

// Статус по доле верных + доверию (число наблюдений).
export function statusFor(rate, attempts, opts = {}) {
  const { thresholds = DEFAULT_THRESHOLDS } = opts;
  if (!attempts || rate == null) return WEAK_STATUS.NODATA;
  if (rate < thresholds.red) return WEAK_STATUS.RED;
  if (rate < thresholds.amber) return WEAK_STATUS.AMBER;
  return WEAK_STATUS.GREEN;
}

// Тренд: знак разницы «свежая половина − старая половина» по доле верных.
// Требует >=4 наблюдений с датами, иначе 'flat'.
function computeTrend(obs) {
  const dated = obs.filter((o) => o._ms != null).sort((a, b) => a._ms - b._ms);
  if (dated.length < 4) return 'flat';
  const mid = Math.floor(dated.length / 2);
  const rate = (arr) => arr.reduce((s, o) => s + (o.isCorrect ? 1 : 0), 0) / arr.length;
  const diff = rate(dated.slice(mid)) - rate(dated.slice(0, mid));
  if (diff > 0.1) return 'up';
  if (diff < -0.1) return 'down';
  return 'flat';
}

// Главная: наблюдения → массив тем-метрик, отсортированный «слабые сверху».
export function aggregateObservations(observations = [], opts = {}) {
  const {
    thresholds = DEFAULT_THRESHOLDS,
    halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
    minConfident = DEFAULT_MIN_CONFIDENT,
    now = Date.now(),
  } = opts;

  const byTopic = new Map(); // topicId → { meta, list[] }
  for (const o of observations) {
    if (!o || !o.topicId) continue;
    const ms = toMs(o.date);
    const entry = byTopic.get(o.topicId) || {
      topicId: o.topicId,
      section: o.section ?? null,
      egeNumber: o.egeNumber ?? null,
      list: [],
    };
    // section/egeNumber подхватываем при первой непустой встрече
    if (entry.section == null && o.section != null) entry.section = o.section;
    if (entry.egeNumber == null && o.egeNumber != null) entry.egeNumber = o.egeNumber;
    entry.list.push({ ...o, _ms: ms });
    byTopic.set(o.topicId, entry);
  }

  const result = [];
  for (const entry of byTopic.values()) {
    const list = entry.list;
    const attempts = list.length;
    const correct = list.reduce((s, o) => s + (o.isCorrect ? 1 : 0), 0);
    const correctRate = attempts ? correct / attempts : null;

    let wSum = 0;
    let wCorrect = 0;
    for (const o of list) {
      const w = recencyWeight(o._ms, now, halfLifeDays);
      wSum += w;
      if (o.isCorrect) wCorrect += w;
    }
    const recencyWeightedRate = wSum ? wCorrect / wSum : null;

    const sources = new Set(list.map((o) => o.source).filter(Boolean));

    result.push({
      topicId: entry.topicId,
      section: entry.section,
      egeNumber: entry.egeNumber,
      attempts,
      correct,
      correctRate,
      recencyWeightedRate,
      trend: computeTrend(list),
      status: statusFor(recencyWeightedRate, attempts, { thresholds }),
      lowConfidence: attempts < minConfident,
      sources: [...sources],
    });
  }

  // Слабые сверху: red < amber < green < nodata, внутри — по rate возр., затем больше попыток.
  const rank = { [WEAK_STATUS.RED]: 0, [WEAK_STATUS.AMBER]: 1, [WEAK_STATUS.GREEN]: 2, [WEAK_STATUS.NODATA]: 3 };
  result.sort((a, b) =>
    rank[a.status] - rank[b.status] ||
    (a.recencyWeightedRate ?? 1) - (b.recencyWeightedRate ?? 1) ||
    b.attempts - a.attempts,
  );
  return result;
}

// ───────────────────────── Адаптеры (сырой API → наблюдения) ─────────────────────────

// Внутренние: attempt_answers с expand.task.topic + карта attemptId → дата попытки.
export function internalAnswersToObservations(answers = [], attemptDateById = new Map()) {
  const obs = [];
  for (const a of answers) {
    const topic = a?.expand?.task?.expand?.topic || a?.expand?.task?.topic;
    if (!topic?.id) continue;
    obs.push({
      topicId: topic.id,
      section: topic.section ?? null,
      egeNumber: topic.ege_number ?? null,
      isCorrect: !!a.is_correct,
      date: attemptDateById.get(a.attempt) ?? null,
      source: 'internal',
    });
  }
  return obs;
}

// Внешние: ext_journal_task_results + карта ege_number → topic + карта exam_id → дата.
export function extTaskResultsToObservations(taskResults = [], topicByNum = new Map(), examDateById = new Map()) {
  const obs = [];
  for (const r of taskResults) {
    const n = r?.task_number;
    if (!n) continue;
    const topic = topicByNum.get(n);
    if (!topic?.id) continue;
    obs.push({
      topicId: topic.id,
      section: topic.section ?? null,
      egeNumber: topic.ege_number ?? n,
      isCorrect: !!r.is_correct,
      date: examDateById.get(r.exam_id) ?? null,
      source: 'external',
    });
  }
  return obs;
}

// ───────────────────────── Матчинг ученика между системами ─────────────────────────

// Нормализация имени для фолбэк-матча (когда нет telegram_id).
export function normalizeStudentName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Ключ ученика: telegram_id (приоритет) → имя (фолбэк). Возвращает { key, byTelegram }.
export function studentMatchKey(student) {
  const tg = student?.telegram_id ? String(student.telegram_id).trim() : '';
  if (tg) return { key: `tg:${tg}`, byTelegram: true };
  return { key: `name:${normalizeStudentName(student?.name)}`, byTelegram: false };
}

// Отбор внешних строк, относящихся к ученику. Если у ученика есть telegram_id и строки
// его несут — матчим по нему; иначе фолбэк на нормализованное имя.
export function filterExternalForStudent(rows = [], student) {
  const tg = student?.telegram_id ? String(student.telegram_id).trim() : '';
  if (tg && rows.some((r) => r.telegram_id)) {
    return rows.filter((r) => String(r.telegram_id || '').trim() === tg);
  }
  const nm = normalizeStudentName(student?.name);
  return rows.filter((r) => normalizeStudentName(r.student_name) === nm);
}

// Удобная сборка профиля «всё в одном» для одного ученика.
export function buildWeaknessProfile({
  student,
  internalAnswers = [],
  attemptDateById = new Map(),
  externalTaskResults = [],
  topicByNum = new Map(),
  examDateById = new Map(),
  opts = {},
} = {}) {
  const extForStudent = student ? filterExternalForStudent(externalTaskResults, student) : externalTaskResults;
  const observations = [
    ...internalAnswersToObservations(internalAnswers, attemptDateById),
    ...extTaskResultsToObservations(extForStudent, topicByNum, examDateById),
  ];
  return aggregateObservations(observations, opts);
}
