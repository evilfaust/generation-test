// Статистика решаемости для колонки «Успеваемость» (Слой A).
//
// Источник — внутренние ответы учеников (attempt_answers), агрегированные
// по задаче в { c: верных, n: всего }. Колонка темы считается ПУЛИНГОМ
// (Σc / Σn по всем задачам темы), а не средним по средним: так задачи с
// большим числом ответов весят больше, а единичные ответы не перекашивают.

// Нижняя граница доверительного интервала Уилсона для доли.
// Нужна для ЦВЕТА индикатора: «3 из 3 = 100%» при n=3 не должно гореть
// ярко-зелёным. По умолчанию z=1.96 (95%).
export function wilsonLower(c, n, z = 1.96) {
  if (!n || n <= 0) return 0;
  const p = c / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, (centre - margin) / denom);
}

// Сводка по списку задач темы (комбинированное свидетельство).
// taskIds — id задач темы; byTask — карта { [id]: {c,n,...} }.
// Возвращает { rate, c, n, lower } или { rate:null, n:0 } если данных нет.
export function poolStats(taskIds, byTask) {
  let c = 0;
  let n = 0;
  for (const id of taskIds) {
    const s = byTask?.[id];
    if (s) { c += s.c; n += s.n; }
  }
  if (n === 0) return { rate: null, c: 0, n: 0, lower: 0 };
  return { rate: c / n, c, n, lower: wilsonLower(c, n) };
}

// Детальная сводка: комбинированная + раздельно внутренняя/внешняя — для дельты
// «наши vs внешние (Решу)». byTask[id] = { c,n (комбин.), ci,ni (внутр.), ce,ne (внеш.) }.
export function poolStatsDetailed(taskIds, byTask) {
  const acc = { c: 0, n: 0, ci: 0, ni: 0, ce: 0, ne: 0 };
  for (const id of taskIds) {
    const s = byTask?.[id];
    if (!s) continue;
    acc.c += s.c; acc.n += s.n;
    acc.ci += s.ci || 0; acc.ni += s.ni || 0;
    acc.ce += s.ce || 0; acc.ne += s.ne || 0;
  }
  const mk = (c, n) => (n > 0 ? c / n : null);
  return {
    rate: mk(acc.c, acc.n), c: acc.c, n: acc.n, lower: acc.n ? wilsonLower(acc.c, acc.n) : 0,
    internal: { rate: mk(acc.ci, acc.ni), c: acc.ci, n: acc.ni },
    external: { rate: mk(acc.ce, acc.ne), c: acc.ce, n: acc.ne },
  };
}

// Минимальное число ответов, ниже которого показатель считаем
// «мало данных» (бледная подача). Подобрано под текущий малый объём данных.
export const LOW_CONFIDENCE_N = 5;

// Усадка решаемости к приору (среднему по каталогу) — для тем с малым/нулём
// прямых данных. Псевдо-счёт alpha = сколько «виртуальных» наблюдений приора
// подмешиваем. При большом n estimate ≈ измеренной доле; при n→0 → приор.
// Валидация (LOO) показала: это даёт ту же точность, что и векторный перенос,
// без какого-либо пайплайна — поэтому используем именно усадку.
export function shrunkRate(c, n, prior, alpha = LOW_CONFIDENCE_N) {
  const p = prior == null ? 0 : prior;
  return (c + alpha * p) / (n + alpha);
}

// Цвет индикатора по нижней границе Уилсона (а не по сырому проценту) —
// консервативная окраска при малом n. Пороги те же, что были в генераторах.
export function rateColor(lower) {
  const pct = lower * 100;
  if (pct >= 70) return '#52c41a';
  if (pct >= 40) return '#faad14';
  return '#ff4d4f';
}
