import { useState, useEffect, useCallback } from 'react';
import { Spin, Alert, Tag, Switch, Tooltip, Empty, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import MathRenderer from './MathRenderer';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

// Цвет бейджа похожести по проценту (калибровка с бэка: 0.55→0%, 0.95→100%)
function pctColor(pct) {
  if (pct >= 90) return 'red';     // почти-дубль
  if (pct >= 70) return 'orange';  // явно похожа
  if (pct >= 50) return 'gold';    // тот же тип
  return 'default';
}

/**
 * Панель «Похожие задачи» — дёргает /similar (sqlite-vec) и показывает соседей.
 * @param {string} taskId
 * @param {function} [onOpenTask] - (taskId) => void, по клику на соседа
 */
export default function SimilarTasksPanel({ taskId, onOpenTask }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [sameTopicOnly, setSameTopicOnly] = useState(true);

  const fetchSimilar = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${PDF_SERVICE_URL}/similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, limit: 8, same_topic_only: sameTopicOnly }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Сервис ответил ${res.status}`);
      const data = await res.json();
      if (data.error === 'not_indexed') {
        setError('Задача ещё не проиндексирована (добавлена после последней индексации).');
        setItems([]);
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        setItems(data.items || []);
      }
    } catch (e) {
      setError(e.name === 'TimeoutError' ? 'Таймаут запроса к сервису поиска.' : e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [taskId, sameTopicOnly]);

  useEffect(() => { fetchSimilar(); }, [fetchSimilar]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Tooltip title="Тема — надёжный признак типа задачи. Выключи, чтобы искать похожие по всей базе.">
          <span style={{ fontSize: 13 }}>
            <Switch size="small" checked={sameTopicOnly} onChange={setSameTopicOnly} /> только эта тема
          </span>
        </Tooltip>
        <Button size="small" type="text" icon={<ReloadOutlined />} onClick={fetchSimilar} disabled={loading}>
          обновить
        </Button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>}

      {!loading && error && <Alert type="warning" showIcon message={error} style={{ marginBottom: 8 }} />}

      {!loading && !error && items.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Похожих не найдено" />
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <div
              key={it.task_id}
              onClick={onOpenTask ? () => onOpenTask(it.task_id) : undefined}
              style={{
                padding: '8px 10px',
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                borderRadius: 6,
                cursor: onOpenTask ? 'pointer' : 'default',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 56 }}>
                <Tag color={pctColor(it.pct)} style={{ margin: 0, fontWeight: 600 }}>{it.pct}%</Tag>
                <span style={{ fontSize: 11, color: '#999' }}>{it.code}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.4, overflow: 'hidden' }}>
                <MathRenderer text={it.statement} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
