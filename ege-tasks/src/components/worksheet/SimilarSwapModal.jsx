import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Space, Spin, Alert, Tag, Empty, Switch, Tooltip, InputNumber, App } from 'antd';
import { ReloadOutlined, SwapOutlined, PlusOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { PB_BASE_URL } from '../../shared/services/pocketbaseUrl';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

function pctColor(pct) {
  if (pct >= 90) return 'red';     // почти-дубль
  if (pct >= 70) return 'orange';  // явно похожа
  if (pct >= 50) return 'gold';    // тот же тип
  return 'default';
}

// /similar отдаёт обрезанный statement — для вставки в работу дотягиваем полную запись.
async function getFullTask(id) {
  try {
    if (typeof api.getTask === 'function') {
      const t = await api.getTask(id);
      if (t) return t;
    }
  } catch { /* ignore — пробуем REST ниже */ }
  try {
    const r = await fetch(`${PB_BASE_URL}/api/collections/tasks/records/${id}`);
    if (r.ok) return await r.json();
  } catch { /* ignore */ }
  return null;
}

/**
 * «Похожие задачи» для редактора работ: векторные соседи одной задачи (/similar)
 * с действиями «Заменить» (свапнуть на месте) и «Добавить» (в конец варианта).
 *
 * @param {boolean} open
 * @param {function} onClose
 * @param {object} task - исходная задача {id, code, statement_md}
 * @param {string[]} excludeIds - id задач, уже присутствующих в варианте
 * @param {function} onReplace - (fullTask) => void
 * @param {function} onAdd - (fullTask) => void
 */
export default function SimilarSwapModal({ open, onClose, task, excludeIds = [], onReplace, onAdd }) {
  const { message } = App.useApp();
  const [sameTopicOnly, setSameTopicOnly] = useState(true);
  const [limit, setLimit] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [addedIds, setAddedIds] = useState(() => new Set());

  const taskId = task?.id;
  const excludeKey = excludeIds.join(',');

  const fetchSimilar = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${PDF_SERVICE_URL}/similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, limit, same_topic_only: sameTopicOnly }),
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
        const exclude = new Set(excludeKey ? excludeKey.split(',') : []);
        setItems((data.items || []).filter((it) => !exclude.has(it.task_id)));
      }
    } catch (e) {
      setError(e.name === 'TimeoutError' ? 'Таймаут запроса к сервису поиска.' : e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [taskId, limit, sameTopicOnly, excludeKey]);

  useEffect(() => {
    if (open) {
      setAddedIds(new Set());
      fetchSimilar();
    }
  }, [open, fetchSimilar]);

  const handlePick = async (id, mode) => {
    setBusyId(id);
    try {
      const full = await getFullTask(id);
      if (!full) {
        message.error('Не удалось загрузить задачу.');
        return;
      }
      if (mode === 'replace') {
        onReplace?.(full);
        message.success('Задача заменена');
        onClose();
      } else {
        onAdd?.(full);
        setAddedIds((prev) => new Set(prev).add(id));
        message.success('Задача добавлена в вариант');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={720}
      title="🔎 Похожие задачи (векторный поиск)"
      footer={[<Button key="close" onClick={onClose}>Закрыть</Button>]}
    >
      {task && (
        <div style={{
          padding: '8px 10px', marginBottom: 12, background: '#fafafa',
          border: '1px solid #f0f0f0', borderRadius: 6, fontSize: 13,
          maxHeight: 110, overflow: 'hidden',
        }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            похожие на {task.code ? <b>{task.code}</b> : 'задачу'}:
          </div>
          <MathRenderer text={task.statement_md} />
        </div>
      )}

      <Space wrap style={{ marginBottom: 12 }}>
        <Tooltip title="Искать только в той же теме — надёжнее по типу задачи. Выключите для поиска по всей базе.">
          <span style={{ fontSize: 13 }}>
            <Switch size="small" checked={sameTopicOnly} onChange={setSameTopicOnly} /> только эта тема
          </span>
        </Tooltip>
        <span style={{ fontSize: 13 }}>
          кандидатов:{' '}
          <InputNumber size="small" min={3} max={20} value={limit} onChange={(v) => setLimit(v || 8)} style={{ width: 64 }} />
        </span>
        <Button size="small" icon={<ReloadOutlined />} onClick={fetchSimilar} disabled={loading}>обновить</Button>
      </Space>

      {loading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
      {!loading && error && <Alert type="warning" showIcon message={error} />}
      {!loading && !error && items.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Похожих задач не найдено" />
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
          {items.map((it) => {
            const added = addedIds.has(it.task_id);
            return (
              <div key={it.task_id} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px',
                background: added ? '#f6ffed' : '#fafafa',
                border: `1px solid ${added ? '#b7eb8f' : '#f0f0f0'}`,
                borderRadius: 6,
              }}>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 52 }}>
                  <Tag color={pctColor(it.pct)} style={{ margin: 0, fontWeight: 600 }}>{it.pct}%</Tag>
                  <span style={{ fontSize: 11, color: '#999' }}>{it.code}</span>
                </div>
                <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4, overflow: 'hidden' }}>
                  <MathRenderer text={it.statement} />
                </div>
                <Space direction="vertical" size={4} style={{ flexShrink: 0 }}>
                  <Button
                    size="small"
                    icon={<SwapOutlined />}
                    loading={busyId === it.task_id}
                    onClick={() => handlePick(it.task_id, 'replace')}
                  >
                    Заменить
                  </Button>
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    disabled={added}
                    loading={busyId === it.task_id}
                    onClick={() => handlePick(it.task_id, 'add')}
                  >
                    {added ? 'Добавлена' : 'Добавить'}
                  </Button>
                </Space>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
