import { useState, useEffect, useCallback } from 'react';
import { Spin, Alert, Tag, Tooltip, Empty, Button, Segmented } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

// Цвет бейджа похожести по проценту (калибровка с бэка: 0.55→0%, 0.95→100%)
function pctColor(pct) {
  if (pct >= 90) return 'red';     // почти-дубль
  if (pct >= 70) return 'orange';  // явно похожа
  if (pct >= 50) return 'gold';    // тот же тип
  return 'default';
}

const ORIGIN_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'mccme', label: 'Банк МЦНМО' },
  { value: 'manual', label: 'Мои' },
];

/**
 * Панель «Похожие геометрические задачи» — дёргает /geo/similar (sqlite-vec).
 * У банка МЦНМО дерево тем не используется, поэтому вместо тумблера «только эта
 * тема» — фильтр по происхождению (все / банк / мои).
 * @param {string} taskId
 * @param {function} [onOpenTask] - (taskId) => void, по клику на соседа
 */
export default function SimilarGeometryPanel({ taskId, onOpenTask }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [origin, setOrigin] = useState('all');

  const fetchSimilar = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${PDF_SERVICE_URL}/geo/similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          limit: 8,
          ...(origin !== 'all' ? { origin } : {}),
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Сервис ответил ${res.status}`);
      const data = await res.json();
      if (data.error === 'no_index') {
        setError('Векторный индекс геометрии ещё не построен (npm run index:geo).');
        setItems([]);
      } else if (data.error === 'not_indexed') {
        setError('Задача не в индексе: мало текста (только чертёж) или индекс не обновлялся после её добавления.');
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
  }, [taskId, origin]);

  useEffect(() => { fetchSimilar(); }, [fetchSimilar]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <Tooltip title="Откуда показывать похожие: весь каталог, только банк МЦНМО или только свои задачи.">
          <Segmented size="small" value={origin} onChange={setOrigin} options={ORIGIN_FILTERS} />
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
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64 }}>
                <Tag color={pctColor(it.pct)} style={{ margin: 0, fontWeight: 600 }}>{it.pct}%</Tag>
                <span style={{ fontSize: 11, color: '#999' }}>{it.code}</span>
                <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                  color={it.origin === 'mccme' ? 'geekblue' : 'green'}>
                  {it.origin === 'mccme' ? 'Банк' : 'Моя'}
                </Tag>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.4, overflow: 'hidden' }}>
                {it.title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{it.title}</div>}
                <MathRenderer text={it.statement} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
