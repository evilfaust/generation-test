import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Button, Tag, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';

/**
 * Предупреждение «задачи этой работы уже встречаются в других работах».
 * Точное пересечение по id задач (не векторное — почти-дубли ловит NoveltyBadge).
 * Один запрос: варианты других работ, содержащие любую из задач текущей.
 *
 * @param {string} workId - текущая работа (исключается из поиска)
 * @param {Array} variants - локальные варианты [{ tasks: [{id}] }]
 * @param {function} [onOpenWork] - (workId) => void
 */
export default function WorkOverlapWarning({ workId, variants = [], onOpenWork }) {
  const [loading, setLoading] = useState(false);
  const [overlaps, setOverlaps] = useState(null); // [{ work:{id,title,archived}, count }]

  const taskIds = useMemo(
    () => [...new Set(variants.flatMap(v => (v.tasks || []).map(t => t.id).filter(Boolean)))],
    [variants]
  );
  const key = taskIds.join(',');

  const check = useCallback(async () => {
    if (taskIds.length === 0) { setOverlaps(null); return; }
    setLoading(true);
    try {
      const found = await api.getVariantsContainingTasks(taskIds, workId);
      const mine = new Set(taskIds);
      const byWork = new Map(); // workId -> { work, taskSet }
      for (const v of found) {
        const w = v.expand?.work;
        if (!w) continue;
        const shared = (v.tasks || []).filter(id => mine.has(id));
        if (!shared.length) continue;
        const entry = byWork.get(w.id) || { work: w, taskSet: new Set() };
        shared.forEach(id => entry.taskSet.add(id));
        byWork.set(w.id, entry);
      }
      const list = [...byWork.values()]
        .map(e => ({ work: e.work, count: e.taskSet.size }))
        .sort((a, b) => b.count - a.count);
      setOverlaps(list);
    } catch {
      setOverlaps(null);
    } finally {
      setLoading(false);
    }
  }, [key, workId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { check(); }, [check]);

  if (taskIds.length === 0) return null;
  if (loading && overlaps === null) {
    return (
      <div style={{ marginBottom: 12, fontSize: 13, color: '#888' }}>
        <Spin size="small" /> проверка пересечений с другими работами…
      </div>
    );
  }
  if (!overlaps || overlaps.length === 0) return null;

  const totalShared = overlaps.reduce((s, o) => s + o.count, 0);

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 12 }}
      message={
        <span>
          Задачи этой работы уже встречаются в других работах ({totalShared}{' '}
          пересечений) — возможно, ученики их уже решали.
        </span>
      }
      description={
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {overlaps.slice(0, 8).map(({ work, count }) => (
            <Tag
              key={work.id}
              color={work.archived ? 'default' : 'orange'}
              style={{ margin: 0, cursor: onOpenWork ? 'pointer' : 'default' }}
              onClick={() => onOpenWork?.(work.id)}
            >
              {work.title || 'Без названия'}{work.archived ? ' (архив)' : ''} — {count}
            </Tag>
          ))}
          {overlaps.length > 8 && <span style={{ fontSize: 12, color: '#888' }}>и ещё {overlaps.length - 8}…</span>}
          <Button size="small" type="text" icon={<ReloadOutlined />} onClick={check} />
        </span>
      }
    />
  );
}
