import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Space, Spin, Alert, Tag, Empty, Switch, Tooltip, Checkbox, InputNumber, Select, App } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import MathRenderer from '../../MathRenderer';
import { api } from '../../../services/pocketbase';
import { PB_BASE_URL } from '../../../shared/services/pocketbaseUrl';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

function pctColor(pct) {
  if (pct >= 90) return 'red';     // почти-дубль
  if (pct >= 70) return 'orange';  // явно похожа
  if (pct >= 50) return 'gold';    // тот же тип
  return 'default';
}

// Полная запись задачи нужна, чтобы добавить её в лист (рендер + печать + ответы).
// /similar отдаёт обрезанный statement, поэтому дотягиваем оригинал.
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
 * «Дополнить лист похожими» — векторная догенерация (фичи A1 + догенерация).
 * Для каждой задачи выбранного варианта дёргает /similar (sqlite-vec) и собирает
 * кандидатов, исключая уже присутствующие. Отмеченные добавляются в лист.
 *
 * @param {boolean} open
 * @param {function} onClose
 * @param {Array} variants - [{ number, tasks: [{id, code, ...}] }]
 * @param {function} setVariants - сеттер вариантов генератора
 */
export default function FillSimilarModal({ open, onClose, variants = [], setVariants }) {
  const { message } = App.useApp();
  const [variantIdx, setVariantIdx] = useState(0);
  const [sameTopicOnly, setSameTopicOnly] = useState(true);
  const [perTask, setPerTask] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]); // [{ base:{id,code}, items:[{task_id,code,statement,pct}] }]
  const [checked, setChecked] = useState(() => new Set());
  const [adding, setAdding] = useState(false);

  const safeIdx = Math.min(variantIdx, Math.max(variants.length - 1, 0));

  const fetchSimilar = useCallback(async () => {
    const tasks = variants[safeIdx]?.tasks || [];
    const existing = new Set(tasks.map((t) => t.id).filter(Boolean));
    if (existing.size === 0) { setGroups([]); return; }
    setLoading(true); setError(null);
    const seen = new Set(existing); // не предлагать дубли между группами
    const out = [];
    try {
      for (const t of tasks) {
        if (!t.id) continue;
        try {
          const res = await fetch(`${PDF_SERVICE_URL}/similar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_id: t.id, limit: perTask, same_topic_only: sameTopicOnly }),
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (data.error) continue;
          const items = (data.items || []).filter((it) => {
            if (seen.has(it.task_id)) return false;
            seen.add(it.task_id);
            return true;
          });
          if (items.length) out.push({ base: { id: t.id, code: t.code }, items });
        } catch { /* пропускаем задачу */ }
      }
      setGroups(out);
      if (out.length === 0) {
        setError('Похожих задач не найдено (либо задачи ещё не проиндексированы, либо сервис поиска недоступен).');
      }
    } finally {
      setLoading(false);
    }
  }, [variants, safeIdx, sameTopicOnly, perTask]);

  useEffect(() => {
    if (open) { setChecked(new Set()); fetchSimilar(); }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open, safeIdx, sameTopicOnly, perTask]);

  const toggle = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (checked.size === 0) { onClose(); return; }
    setAdding(true);
    try {
      const fetched = [];
      for (const id of checked) {
        const t = await getFullTask(id);
        if (t) fetched.push(t);
      }
      if (fetched.length === 0) {
        message.error('Не удалось загрузить выбранные задачи.');
        return;
      }
      setVariants((prev) => {
        const copy = prev.map((v) => ({ ...v, tasks: [...(v.tasks || [])] }));
        const target = copy[safeIdx];
        const have = new Set(target.tasks.map((t) => t.id));
        fetched.forEach((t) => { if (!have.has(t.id)) target.tasks.push(t); });
        return copy;
      });
      message.success(`Добавлено задач: ${fetched.length}`);
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={720}
      title="➕ Дополнить лист похожими задачами"
      footer={[
        <Button key="cancel" onClick={onClose}>Отмена</Button>,
        <Button key="add" type="primary" loading={adding} disabled={checked.size === 0} onClick={handleAdd}>
          Добавить в лист ({checked.size})
        </Button>,
      ]}
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="Для каждой задачи варианта подбираются семантически похожие из базы (тот же тип). Отметьте нужные — они добавятся в конец листа."
      />

      <Space wrap style={{ marginBottom: 12 }}>
        {variants.length > 1 && (
          <Select
            size="small"
            value={safeIdx}
            style={{ width: 160 }}
            onChange={setVariantIdx}
            options={variants.map((v, i) => ({ value: i, label: `Вариант ${v.number ?? i + 1}` }))}
          />
        )}
        <Tooltip title="Искать только в той же теме — надёжнее по типу задачи. Выключите для поиска по всей базе.">
          <span style={{ fontSize: 13 }}>
            <Switch size="small" checked={sameTopicOnly} onChange={setSameTopicOnly} /> только эта тема
          </span>
        </Tooltip>
        <span style={{ fontSize: 13 }}>
          похожих на задачу:{' '}
          <InputNumber size="small" min={1} max={8} value={perTask} onChange={(v) => setPerTask(v || 3)} style={{ width: 64 }} />
        </span>
        <Button size="small" icon={<ReloadOutlined />} onClick={fetchSimilar} disabled={loading}>обновить</Button>
      </Space>

      {loading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
      {!loading && error && <Alert type="warning" showIcon message={error} />}
      {!loading && !error && groups.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет кандидатов" />
      )}

      {!loading && groups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 480, overflowY: 'auto' }}>
          {groups.map((g) => (
            <div key={g.base.id}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                похожие на <b>{g.base.code || g.base.id.slice(0, 6)}</b>:
              </div>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {g.items.map((it) => (
                  <label key={it.task_id} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px',
                    background: checked.has(it.task_id) ? '#f6ffed' : '#fafafa',
                    border: `1px solid ${checked.has(it.task_id) ? '#b7eb8f' : '#f0f0f0'}`,
                    borderRadius: 6, cursor: 'pointer',
                  }}>
                    <Checkbox checked={checked.has(it.task_id)} onChange={() => toggle(it.task_id)} />
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 52 }}>
                      <Tag color={pctColor(it.pct)} style={{ margin: 0, fontWeight: 600 }}>{it.pct}%</Tag>
                      <span style={{ fontSize: 11, color: '#999' }}>{it.code}</span>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.4, overflow: 'hidden' }}>
                      <MathRenderer text={it.statement} />
                    </div>
                  </label>
                ))}
              </Space>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
