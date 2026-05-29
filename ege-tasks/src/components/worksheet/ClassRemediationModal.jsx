import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, Space, Spin, Alert, Tag, Checkbox, Select, Input, Typography, App } from 'antd';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import MathRenderer from '../MathRenderer';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';
const buildStudentUrl = (sessionId) => {
  const base = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/student`;
  return `${base}/${sessionId}`;
};

/**
 * C4 фаза 3 — «работа над ошибками» для класса.
 * Агрегирует провалы по всем попыткам сессии → частые ошибки (≥ порога) →
 * подбор похожих → создание работы + сессии для класса.
 */
export default function ClassRemediationModal({ open, onClose, sessionId, attempts = [], classNumber, workTitle }) {
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(false);
  const [agg, setAgg] = useState([]); // [{taskId, code, statement, fail, total, rate}]
  const [threshold, setThreshold] = useState(40);
  const [selectedFailIds, setSelectedFailIds] = useState(new Set());
  const [similar, setSimilar] = useState(null);
  const [selectedSimilarIds, setSelectedSimilarIds] = useState(new Set());
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  const loadAgg = useCallback(async () => {
    const ids = attempts.map((a) => a.id).filter(Boolean);
    if (!ids.length) { setAgg([]); return; }
    setLoading(true);
    try {
      const answers = await api.getAttemptAnswersByAttemptsDetailed(ids);
      const map = new Map();
      for (const ans of answers) {
        const task = ans.expand?.task;
        if (!task) continue;
        const m = map.get(task.id) || { taskId: task.id, code: task.code, statement: (task.statement_md || '').replace(/\s+/g, ' ').slice(0, 140), fail: 0, total: 0 };
        m.total += 1;
        if (!ans.is_correct) m.fail += 1;
        map.set(task.id, m);
      }
      const rows = [...map.values()]
        .map((m) => ({ ...m, rate: Math.round((m.fail / m.total) * 100) }))
        .filter((m) => m.total >= 2)
        .sort((a, b) => b.rate - a.rate);
      setAgg(rows);
    } catch (e) {
      message.error(`Не удалось загрузить ответы: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [attempts, message]);

  useEffect(() => {
    if (!open) return;
    setSimilar(null); setSelectedSimilarIds(new Set()); setResult(null);
    setTitle(`Работа над ошибками класса${workTitle ? ` — ${workTitle}` : ''}`);
    loadAgg();
  }, [open, loadAgg, workTitle]);

  // частые ошибки по порогу
  const frequent = useMemo(() => agg.filter((m) => m.rate >= threshold), [agg, threshold]);
  useEffect(() => { setSelectedFailIds(new Set(frequent.map((m) => m.taskId))); }, [frequent]);

  const loadSimilar = async () => {
    const ids = [...selectedFailIds];
    if (!ids.length) return;
    setLoadingSimilar(true);
    try {
      const res = await fetch(`${PDF_SERVICE_URL}/remediation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failed_task_ids: ids, per_task: 2 }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Сервис ответил ${res.status}`);
      const data = await res.json();
      setSimilar(data);
      setSelectedSimilarIds(new Set((data.all || []).map((t) => t.task_id)));
      if (!data.all?.length) message.info('Похожих задач не нашлось');
    } catch (e) {
      message.error(`Подбор не удался: ${e.message}`);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const createWork = async () => {
    const taskIds = [...selectedFailIds, ...selectedSimilarIds];
    if (!taskIds.length) return;
    setCreating(true);
    try {
      const work = await api.createWork({ title: title || 'Работа над ошибками класса', ...(classNumber ? { class: classNumber } : {}) });
      await api.createVariant({ work: work.id, number: 1, tasks: taskIds, order: taskIds.map((id, i) => ({ taskId: id, position: i })) });
      const session = await api.createSession({ work: work.id, is_open: true, achievements_enabled: true, student_title: 'Работа над ошибками' });
      setResult({ work, session });
      message.success('Работа для класса создана');
    } catch (e) {
      message.error(`Не удалось создать: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const total = selectedFailIds.size + selectedSimilarIds.size;

  return (
    <Modal
      open={open} onCancel={onClose} width={760}
      title="🩹 Работа над ошибками класса"
      footer={result ? [
        <Button key="c" onClick={onClose}>Закрыть</Button>,
      ] : [
        <Button key="c" onClick={onClose}>Отмена</Button>,
        canEdit && <Button key="ok" type="primary" loading={creating} disabled={total === 0} onClick={createWork}>Создать работу ({total})</Button>,
      ]}
    >
      {result ? (
        <div>
          <Alert type="success" showIcon message="Работа создана и открыта для класса" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{result.work.title}</div>
          <Input readOnly value={buildStudentUrl(result.session.id)}
            addonAfter={<a onClick={() => { navigator.clipboard.writeText(buildStudentUrl(result.session.id)); message.success('Скопировано'); }}>копировать</a>} />
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <div>
          <Space style={{ marginBottom: 12 }}>
            <span>Порог «часто проваливают»:</span>
            <Select value={threshold} onChange={setThreshold} style={{ width: 110 }}
              options={[30, 40, 50, 60, 70].map((v) => ({ value: v, label: `≥ ${v}%` }))} />
            <span style={{ color: '#888' }}>задач: {frequent.length}</span>
          </Space>

          {agg.length === 0 && <Alert type="info" message="Нет данных по ответам (или это MC-тест без привязки к задачам)." />}

          {frequent.length > 0 && (
            <>
              <Typography.Text strong>Частые ошибки класса ({selectedFailIds.size} выбрано)</Typography.Text>
              <div style={{ maxHeight: 200, overflow: 'auto', margin: '6px 0 14px' }}>
                {frequent.map((m) => (
                  <label key={m.taskId} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
                    <Checkbox checked={selectedFailIds.has(m.taskId)} onChange={(e) => setSelectedFailIds((p) => { const n = new Set(p); e.target.checked ? n.add(m.taskId) : n.delete(m.taskId); return n; })} />
                    <span style={{ minWidth: 56, color: '#888' }}>{m.code || '—'}</span>
                    <Tag color="red">{m.rate}% ({m.fail}/{m.total})</Tag>
                    <span style={{ flex: 1, overflow: 'hidden', fontSize: 12 }}><MathRenderer text={m.statement} /></span>
                  </label>
                ))}
              </div>

              <Space style={{ marginBottom: 8 }}>
                <Button loading={loadingSimilar} disabled={selectedFailIds.size === 0} onClick={loadSimilar}>
                  🩹 Подобрать похожие для отработки
                </Button>
                {similar && <span style={{ color: '#888' }}>{selectedSimilarIds.size} похожих выбрано</span>}
              </Space>

              {similar?.groups?.map((g) => g.picks.length > 0 && (
                <div key={g.source.task_id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#999' }}>к задаче {g.source.code || '—'}:</div>
                  {g.picks.map((p) => (
                    <label key={p.task_id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 0' }}>
                      <Checkbox checked={selectedSimilarIds.has(p.task_id)} onChange={(e) => setSelectedSimilarIds((s) => { const n = new Set(s); e.target.checked ? n.add(p.task_id) : n.delete(p.task_id); return n; })} />
                      <span style={{ minWidth: 56, color: '#888' }}>{p.code || '—'}</span>
                      <Tag>{p.pct}%</Tag>
                      <span style={{ flex: 1, overflow: 'hidden', fontSize: 12 }}><MathRenderer text={p.statement} /></span>
                    </label>
                  ))}
                </div>
              ))}

              <div style={{ marginTop: 12 }}>
                <Input addonBefore="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
