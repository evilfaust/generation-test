// Чистая логика подбора задач: ни SQLite, ни sqlite-vec, ни сети.
// Вынесено из vec-search.js, чтобы алгоритмы (раздача параллелей, ползунок
// похожести, MMR, кластеры) можно было прогонять юнит-тестами фронтового
// vitest — у pdf-service своего раннера нет, а нативный better-sqlite3 в
// тестовой среде не поднимается.

// --- векторы -----------------------------------------------------------------

// Косинус двух Float32Array одинаковой длины.
export function cosF32(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// Копия массива в случайном порядке (Fisher-Yates). rnd вынесен параметром,
// чтобы тесты могли сделать перестановку предсказуемой.
export function shuffled(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- ответы ------------------------------------------------------------------

// Ответ в сравнимом виде: без пробелов, запятая → точка, нижний регистр.
export function normalizeAnswer(ans) {
  return String(ans || '').replace(/\s+/g, '').replace(/,/g, '.').toLowerCase();
}

// Ответ, по которому вообще можно судить о совпадении задач. «Доказать» и
// буквенные ответы («абв», «12») совпадают у сотен разных задач.
export function isDiscriminativeAnswer(normalized) {
  const a = normalized;
  if (!a || a === 'доказать' || a === 'докажите') return false;
  if (/^[абвгдеж)(,;.\s]+$/.test(a)) return false;
  return true;
}

// --- структурная подпись задачи ----------------------------------------------
//
// Косинус bge-m3 сам по себе не отделяет «параллель» от «просто про то же»:
// на размеченных парах у похожих p10 = 0.671, у непохожих p90 = 0.804 —
// классы перекрываются. Поэтому перед косинусом стоит дешёвая структурная
// проверка: числовой ответ против «доказать», условие в три строки против
// условия с таблицей на пол-листа — это заведомо разные задачи, как бы близко
// они ни лежали в векторном пространстве.
//
// Замер на ручной разметке (40 похожих / 31 непохожая пара): правило ниже
// теряет 10% настоящих параллелей и отсекает 65% ложных. Более жёсткие
// варианты (совпадение точной формы ответа и бакета длины) отсекают до 94%
// ложных, но выбрасывают четверть настоящих — для подбора это дорого,
// пул позиции и так бывает пустым.

const NUMERIC_KINDS = new Set(['integer', 'decimal', 'fraction', 'multi']);
export const LENGTH_ORDER = ['S', 'M', 'L', 'XL'];

/** Форма ответа: целое / десятичная / обыкновенная дробь / перечисление / выражение / «доказать» / пусто. */
export function answerKind(raw) {
  const a = normalizeAnswer(raw);
  if (!a) return 'empty';
  if (a === 'доказать' || a === 'докажите') return 'proof';
  if (/^-?\d+$/.test(a)) return 'integer';
  if (/^-?\d+\.\d+$/.test(a)) return 'decimal';
  if (/frac|\//.test(a)) return 'fraction';
  if (/[;]|(\d\s*,\s*\d)/.test(a)) return 'multi';
  if (/[a-zа-я\\]/.test(a)) return 'symbolic';
  return 'other';
}

/** Огрублённый класс ответа — им и сравниваем: 0,25 вместо 5 параллель не ломает. */
export function answerClass(kind) {
  if (NUMERIC_KINDS.has(kind)) return 'num';
  return kind; // symbolic | proof | empty | other
}

/** Бакет длины условия: задачи разного «объёма» — разные по типу работы. */
export function lengthBucket(text) {
  const n = (text || '').length;
  if (n < 150) return 'S';
  if (n < 400) return 'M';
  if (n < 900) return 'L';
  return 'XL';
}

/**
 * Структурная подпись задачи. Всё считается по условию и ответу — никаких
 * запросов. `stmtLength` можно передать отдельно, если полный текст не грузили.
 */
export function taskSignature({ answer, statement_md: statement, stmtLength, hasImage, examPart } = {}) {
  const kind = answerKind(answer);
  const text = statement || '';
  return {
    answerClass: answerClass(kind),
    negative: /^-/.test(normalizeAnswer(answer)),
    table: /(^|\n)\s*\|.*\|/.test(text),
    formula: text.includes('$'),
    figure: hasImage === undefined ? null : !!hasImage,
    length: lengthBucket(stmtLength != null ? ' '.repeat(stmtLength) : text),
    examPart: examPart == null || examPart === '' ? null : String(examPart),
  };
}

/**
 * Годятся ли две задачи друг другу как параллели по структуре.
 * Неизвестные признаки (null, пустой ответ) сравнение не проваливают —
 * молчание данных не повод отбрасывать кандидата.
 *
 * @param {object} a - подпись образца
 * @param {object} b - подпись кандидата
 * @param {object} [o]
 * @param {number} [o.lengthTolerance=1] - на сколько ступеней может отличаться объём условия
 */
export function signaturesCompatible(a, b, { lengthTolerance = 1 } = {}) {
  if (!a || !b) return true;
  if (a.answerClass !== 'empty' && b.answerClass !== 'empty' && a.answerClass !== b.answerClass) return false;
  if (a.negative !== b.negative) return false;
  if (a.table !== b.table) return false;
  if (a.formula !== b.formula) return false;
  if (a.figure !== null && b.figure !== null && a.figure !== b.figure) return false;
  if (a.examPart !== null && b.examPart !== null && a.examPart !== b.examPart) return false;
  const da = LENGTH_ORDER.indexOf(a.length);
  const db = LENGTH_ORDER.indexOf(b.length);
  if (da >= 0 && db >= 0 && Math.abs(da - db) > lengthTolerance) return false;
  return true;
}

// --- фильтры -----------------------------------------------------------------

// Сузить пул до задач, прошедших фильтры каталога (их считает фронт).
export function applyAllowed(rows, allowedIds) {
  if (!allowedIds || allowedIds.length === 0) return rows;
  const allow = new Set(allowedIds);
  return rows.filter((r) => allow.has(r.id));
}

// --- «по образцу»: ползунок → целевой косинус --------------------------------

// Внутри одной темы случайная пара задач даёт ≈0.70, почти-клон ≈0.98 (замер по
// 22k векторов bge-m3). Ползунок линеен, косинус — нет, поэтому позицию ползунка
// переводим в целевой косинус, а не в ранг соседа.
export const SEED_COS_MIN = 0.70;
export const SEED_COS_MAX = 0.98;

export function seedTargetCos(similarity) {
  const s = Math.max(0, Math.min(1, Number(similarity)));
  return SEED_COS_MIN + s * (SEED_COS_MAX - SEED_COS_MIN);
}

// Ближайшие к целевой похожести, отсортированные по убыванию похожести.
export function pickByTargetCos(pool, targetCos, count) {
  return [...pool]
    .sort((a, b) => Math.abs(a.cos - targetCos) - Math.abs(b.cos - targetCos))
    .slice(0, count)
    .sort((a, b) => b.cos - a.cos);
}

// --- параллельные варианты: раздача кандидатов --------------------------------

/**
 * Разложить кандидатов позиций по вариантам.
 *
 * Раздаём по ПОЗИЦИЯМ, а не по вариантам: жадный проход «вариант за вариантом»
 * отдавал первому варианту всегда ближайшего кандидата, второму — следующего,
 * из-за чего параллели выходили неравноценными, а повторный подбор — тем же
 * самым. Здесь на каждую позицию берём окно лучших, тасуем его и раздаём
 * вариантам в случайном порядке.
 *
 * @param {Array<Array<{id:string, cos:number, sameAnswer?:boolean}>>} pools - по кандидату на позицию, отсортировано по пригодности
 * @param {number} count - сколько параллелей
 * @param {function} [rnd] - источник случайности (для тестов)
 * @returns {{ variants: Array<Array<object|null>>, shortage: Array<{position:number}> }}
 *          variants[v][i] — кандидат или null, если замены не нашлось
 */
export function distributeParallel(pools, count, rnd = Math.random) {
  const variants = Array.from({ length: count }, () => new Array(pools.length).fill(null));
  const shortage = [];
  const used = new Set();

  for (let i = 0; i < pools.length; i++) {
    const free = pools[i].filter((c) => !used.has(c.id));
    const window = shuffled(free.slice(0, Math.min(free.length, count * 2 + 2)), rnd);
    const picks = window.slice(0, count);
    for (let j = picks.length; j < Math.min(count, free.length); j++) picks.push(free[j]);

    const order = shuffled(variants.map((_, v) => v), rnd);
    for (let v = 0; v < count; v++) {
      const pick = picks[v];
      if (pick) {
        used.add(pick.id);
        variants[order[v]][i] = pick;
      } else {
        shortage.push({ position: i + 1 });
      }
    }
  }
  return { variants, shortage };
}

// --- «разные сюжеты» ----------------------------------------------------------

/**
 * Жадный MMR (max-min): из пула выбрать count максимально разных задач.
 * Старт — случайный элемент, поэтому перегенерация даёт другой набор.
 * items: [{vec: Float32Array, ...}]; в результат добавляется _cos — похожесть
 * на ближайшего уже выбранного.
 */
export function mmrSelect(items, count, rnd = Math.random) {
  if (items.length === 0) return [];
  const n = Math.min(count, items.length);
  const chosen = new Set([Math.floor(rnd() * items.length)]);
  const first = [...chosen][0];
  const minSim = items.map((it) => cosF32(it.vec, items[first].vec));
  while (chosen.size < n) {
    let best = -1, bestSim = Infinity;
    for (let i = 0; i < items.length; i++) {
      if (chosen.has(i)) continue;
      if (minSim[i] < bestSim) { bestSim = minSim[i]; best = i; }
    }
    if (best < 0) break;
    chosen.add(best);
    const bv = items[best].vec;
    for (let i = 0; i < items.length; i++) {
      const s = cosF32(items[i].vec, bv);
      if (s < minSim[i]) minSim[i] = s;
    }
  }
  return [...chosen].map((i) => ({ ...items[i], _cos: minSim[i] }));
}

/** k-means по векторам (k=count) → медоид каждого непустого кластера. */
export function kmeansMedoids(items, count, rnd = Math.random) {
  const k = Math.min(count, items.length);
  if (k <= 1) return items.slice(0, k);
  const dim = items[0].vec.length;
  const order = items.map((_, i) => i).sort(() => rnd() - 0.5).slice(0, k);
  let centroids = order.map((i) => Float32Array.from(items[i].vec));
  const assign = new Array(items.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      let best = 0, bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const s = cosF32(items[i].vec, centroids[c]);
        if (s > bestSim) { bestSim = s; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    }
    if (!changed && iter > 0) break;
    const sums = Array.from({ length: k }, () => new Float64Array(dim));
    const cnts = new Array(k).fill(0);
    for (let i = 0; i < items.length; i++) {
      const c = assign[i]; cnts[c]++;
      const v = items[i].vec;
      for (let j = 0; j < dim; j++) sums[c][j] += v[j];
    }
    centroids = sums.map((s, c) => {
      const out = new Float32Array(dim);
      if (cnts[c] > 0) for (let j = 0; j < dim; j++) out[j] = s[j] / cnts[c];
      return out;
    });
  }
  const medoids = [];
  for (let c = 0; c < k; c++) {
    let best = -1, bestSim = -Infinity;
    for (let i = 0; i < items.length; i++) {
      if (assign[i] !== c) continue;
      const s = cosF32(items[i].vec, centroids[c]);
      if (s > bestSim) { bestSim = s; best = i; }
    }
    if (best >= 0) medoids.push(items[best]);
  }
  return medoids;
}

// --- новизна ------------------------------------------------------------------

/**
 * Доля «свежих» задач набора относительно эталонного набора векторов.
 * vectors / refVectors — Float32Array[]; задачи без вектора считаются неоценёнными.
 */
export function noveltyScore(vectors, refVectors, { dupCos = 0.95, freshCos = 0.85 } = {}) {
  let fresh = 0, dup = 0, scored = 0;
  const sims = [];
  for (const v of vectors) {
    if (!v) { sims.push(null); continue; }
    let maxSim = 0;
    for (const rv of refVectors) { const s = cosF32(v, rv); if (s > maxSim) maxSim = s; }
    scored++;
    if (maxSim < freshCos) fresh++;
    if (maxSim >= dupCos) dup++;
    sims.push(maxSim);
  }
  return { sims, fresh, dup, scored, novelty_pct: scored > 0 ? Math.round((fresh / scored) * 100) : 100 };
}
