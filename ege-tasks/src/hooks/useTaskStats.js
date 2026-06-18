import { useState, useEffect } from 'react';
import { api } from '../services/pocketbase';

// Свидетельства решаемости по задачам — набор «якорей» для колонки «Успеваемость»
// и (в перспективе) для векторного переноса сложности на весь каталог.
//
// Объединяет два источника на каждую задачу:
//   • внутренние ответы учеников (attempt_answers) — поле ci/ni
//   • внешние результаты Решу (ext_journal_task_results), мост problem_id →
//     tasks.sdamgia_id — поле ce/ne
// и комбинированную сумму c/n. Кэш на уровне модуля — грузится один раз.
let _cache = null;
let _inflight = null;

export function invalidateTaskStats() {
  _cache = null;
  _inflight = null;
}

async function buildStats() {
  const [internal, extByProblem] = await Promise.all([
    api.getInternalTaskStats(),
    api.getExternalTaskStatsByProblem(),
  ]);

  // Мост problem_id (решу) → task.id через sdamgia_id.
  const pids = Object.keys(extByProblem || {});
  const pidToTask = pids.length ? await api.getTaskIdsBySdamgiaIds(pids) : {};

  const byTask = {};
  const ensure = (id) => byTask[id] || (byTask[id] = { c: 0, n: 0, ci: 0, ni: 0, ce: 0, ne: 0 });

  for (const [id, s] of Object.entries(internal || {})) {
    const t = ensure(id);
    t.ci += s.c; t.ni += s.n;
  }
  for (const [pid, s] of Object.entries(extByProblem || {})) {
    const id = pidToTask[pid];
    if (!id) continue; // внешняя задача без соответствия в каталоге — пропускаем
    const t = ensure(id);
    t.ce += s.c; t.ne += s.n;
  }
  // Комбинированная сумма + глобальный приор (средняя решаемость по каталогу).
  let totC = 0;
  let totN = 0;
  for (const t of Object.values(byTask)) {
    t.c = t.ci + t.ce;
    t.n = t.ni + t.ne;
    totC += t.c; totN += t.n;
  }
  const prior = totN > 0 ? totC / totN : 0.7;
  return { byTask, prior };
}

const EMPTY = { byTask: {}, prior: 0.7 };

export function useTaskStats() {
  const [data, setData] = useState(_cache || EMPTY);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    let alive = true;
    if (_cache) {
      setData(_cache);
      setLoading(false);
      return () => { alive = false; };
    }
    if (!_inflight) {
      _inflight = buildStats().then((d) => { _cache = d || EMPTY; return _cache; });
    }
    _inflight.then((d) => {
      if (!alive) return;
      setData(d);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  return { statsByTask: data.byTask, prior: data.prior, loading };
}
