import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Tag, Tooltip, Spin, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../../../services/pocketbase';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

// Сколько последних работ берём как «эталон уже выданного».
const RECENT_WORKS = 5;

// Правки набора идут пачками (drag&drop, удаление задач) — считаем новизну
// не на каждое движение, иначе десятки запросов забивают соединения браузера
// и мешают сохранению работы.
const DEBOUNCE_MS = 700;

function noveltyColor(pct) {
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'gold';
  return 'red';
}

function noveltyWord(pct) {
  if (pct >= 80) return 'свежий набор';
  if (pct >= 50) return 'частично новый';
  return 'много повторов';
}

/**
 * Бейдж «новизны» набора (v3.9.41): насколько сгенерированный лист свежий
 * относительно задач последних RECENT_WORKS работ.
 * Сравнивает уникальные задачи всех вариантов через /novelty-score.
 *
 * @param {Array} variants - [{ tasks: [{id}] }]
 * @param {string} [currentWorkId] - исключить текущую редактируемую работу из эталона
 */
export default function NoveltyBadge({ variants = [], currentWorkId = null }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  // Растущий счётчик: результат устаревшего расчёта не перетирает свежий.
  const runIdRef = useRef(0);

  // уникальные id задач набора
  const taskIds = useMemo(
    () => [...new Set(variants.flatMap((v) => (v.tasks || []).map((t) => t.id).filter(Boolean)))],
    [variants]
  );
  const key = taskIds.join(',');

  const compute = useCallback(async (signal) => {
    if (taskIds.length === 0) { setData(null); return; }
    const runId = ++runIdRef.current;
    const isStale = () => runId !== runIdRef.current || signal?.aborted;

    setLoading(true); setError(false);
    try {
      // Эталон — задачи последних работ. Списки берём лёгкими: у работ нужен
      // только id, у вариантов — состав (без expand задач).
      const recentWorks = await api.getRecentWorkIds(RECENT_WORKS + 1, currentWorkId);
      if (isStale()) return;
      const recent = recentWorks.filter((id) => id !== currentWorkId).slice(0, RECENT_WORKS);

      const refSet = new Set();
      if (recent.length) {
        const vs = await api.getVariantsByWorks(recent, { fields: 'id,tasks' });
        if (isStale()) return;
        vs.forEach((v) => (v.tasks || []).forEach((id) => refSet.add(id)));
      }
      // не сравнивать задачу саму с собой
      taskIds.forEach((id) => refSet.delete(id));

      const res = await fetch(`${PDF_SERVICE_URL}/novelty-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: taskIds, ref_task_ids: [...refSet] }),
        signal: signal || AbortSignal.timeout(15000),
      });
      if (isStale()) return;
      if (!res.ok) { setError(true); return; }
      const j = await res.json();
      if (isStale()) return;
      if (j.error) { setError(true); return; }
      setData(j);
    } catch {
      if (!isStale()) setError(true);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [key, currentWorkId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => compute(controller.signal), DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [compute]);

  if (taskIds.length === 0) return null;
  if (loading) return <Tag icon={<Spin size="small" />} style={{ margin: 0 }}>оценка новизны…</Tag>;
  if (error || !data) return null;

  const { novelty_pct, fresh, dup, scored, ref_count } = data;
  const tip = ref_count === 0
    ? 'Нет недавних работ для сравнения — набор считается полностью новым.'
    : `${fresh} из ${scored} задач не встречались в ${RECENT_WORKS} последних работах` +
      (dup > 0 ? `; ${dup} почти повторяют ранее выданные.` : '.');

  return (
    <Tooltip title={tip}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Tag color={noveltyColor(novelty_pct)} style={{ margin: 0, fontWeight: 600 }}>
          🆕 новизна {novelty_pct}% · {noveltyWord(novelty_pct)}
        </Tag>
        {dup > 0 && <Tag color="volcano" style={{ margin: 0 }}>повторов: {dup}</Tag>}
        <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => compute()} />
      </span>
    </Tooltip>
  );
}
