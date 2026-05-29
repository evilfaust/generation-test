import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, InputNumber, Input, Space, Spin, Alert, Tag, Empty, Tooltip, App } from 'antd';
import { ReloadOutlined, SaveOutlined, SwapOutlined, PlusOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import TaskSelectModal from '../TaskSelectModal';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

function cosColor(cos) {
  if (cos == null) return 'default';
  if (cos >= 0.97) return 'red';
  if (cos >= 0.9) return 'orange';
  return 'gold';
}

const TaskCell = ({ t, onPick }) => {
  if (!t || t.missing) {
    return (
      <div style={{ padding: 8, border: '1px dashed #ffccc7', borderRadius: 6, background: '#fff2f0', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#cf1322' }}>нет подходящей замены</span>
        {onPick && <Button size="small" icon={<PlusOutlined />} onClick={onPick}>Выбрать</Button>}
      </div>
    );
  }
  return (
    <div style={{ padding: 8, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fafafa', fontSize: 12 }}>
      <Space size={4} style={{ marginBottom: 4, width: '100%', justifyContent: 'space-between' }}>
        <Space size={4}>
          <span style={{ color: '#888' }}>{t.code}</span>
          <Tag style={{ margin: 0 }}>{t.answer || '—'}</Tag>
          {t.cos != null ? (
            <Tooltip title={`похоже на образец, cos ${t.cos}`}>
              <Tag color={cosColor(t.cos)} style={{ margin: 0 }}>{Math.round(t.cos * 100)}%</Tag>
            </Tooltip>
          ) : t.manual ? <Tag color="blue" style={{ margin: 0 }}>вручную</Tag> : null}
        </Space>
        {onPick && (
          <Tooltip title="Заменить задачу вручную">
            <Button size="small" type="text" icon={<SwapOutlined />} onClick={onPick} />
          </Tooltip>
        )}
      </Space>
      <div style={{ overflow: 'hidden' }}><MathRenderer text={t.statement} /></div>
    </div>
  );
};

/**
 * A4 — семейство параллельных вариантов «по образцу».
 * Берёт базовый набор задач и подбирает параллели (тот же тип, другие числа).
 *
 * @param {boolean} open
 * @param {function} onClose
 * @param {Array} baseTasks - [{id, code, ...}] базовый вариант
 */
export default function ParallelVariantsModal({ open, onClose, baseTasks = [], baseWorkId = null, baseTitle = '', classNumber = null, onOpenWork }) {
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const [count, setCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // [{id, role, title}] после создания работ
  const [title, setTitle] = useState('');
  const [pickTarget, setPickTarget] = useState(null); // { vi, pos } — какую ячейку заполняем

  // все задачи, уже занятые в семействе (образец + все параллели) — чтобы не повторять
  const usedIds = (() => {
    const s = new Set();
    if (result) {
      result.base.forEach((t) => t && !t.missing && s.add(t.task_id));
      result.variants.forEach((v) => v.forEach((t) => t && !t.missing && s.add(t.task_id)));
    }
    return [...s];
  })();

  const handlePick = (task) => {
    if (!pickTarget) return;
    const { vi, pos } = pickTarget;
    setResult((prev) => {
      const variants = prev.variants.map((v) => v.slice());
      variants[vi][pos] = {
        task_id: task.id, code: task.code, answer: task.answer,
        statement: (task.statement_md || '').replace(/\s+/g, ' ').slice(0, 160),
        manual: true,
      };
      return { ...prev, variants };
    });
    setSaved(false);
    setPickTarget(null);
  };

  const generate = useCallback(async () => {
    const ids = baseTasks.map((t) => t.id).filter(Boolean);
    if (ids.length === 0) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${PDF_SERVICE_URL}/parallel-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: ids, count }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Сервис ответил ${res.status}`);
      setResult(await res.json());
      setCreated(null);
    } catch (e) {
      setError(e.message); setResult(null);
    } finally {
      setLoading(false);
    }
  }, [baseTasks, count]);

  useEffect(() => {
    if (open) { setTitle(baseTitle || 'Вариант'); setCreated(null); generate(); }
    /* eslint-disable-next-line */
  }, [open]);

  // Создать работы в «Мои работы»: оригинал + дубль 1..N, связать в variant_family.
  const createWorks = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const mkVariant = (workId, ids) =>
        api.createVariant({ work: workId, number: 1, tasks: ids, order: ids.map((id, i) => ({ taskId: id, position: i })) });
      const works = [];

      // 1) оригинал — переиспользуем исходную работу, либо создаём из образца
      const baseIds = result.base.filter((t) => t && !t.missing).map((t) => t.task_id);
      if (baseWorkId) {
        works.push({ id: baseWorkId, role: 'оригинал', title: `${title} (исходная)` });
      } else {
        const w = await api.createWork({ title: `${title} — оригинал`, ...(classNumber ? { class: classNumber } : {}) });
        await mkVariant(w.id, baseIds);
        works.push({ id: w.id, role: 'оригинал', title: w.title });
      }

      // 2) параллели → дубль N
      for (let i = 0; i < result.variants.length; i++) {
        const ids = result.variants[i].filter((t) => t && !t.missing).map((t) => t.task_id);
        if (!ids.length) continue;
        const w = await api.createWork({ title: `${title} — дубль ${i + 1}`, ...(classNumber ? { class: classNumber } : {}) });
        await mkVariant(w.id, ids);
        works.push({ id: w.id, role: `дубль ${i + 1}`, title: w.title });
      }

      // 3) запись связи на уровне задач (variant_family)
      try {
        const parallels = result.variants.map((v) => v.filter((t) => t && !t.missing));
        await api.markVariantFamily(result.base.filter((t) => t && !t.missing), parallels, title);
      } catch (_) { /* связь некритична */ }

      setCreated(works);
      message.success(`Создано работ: ${works.length}`);
    } catch (e) {
      message.error(`Не удалось создать: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const cols = result ? 1 + result.variants.length : 1;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={Math.min(360 * cols, 1200)}
      title="🧬 Параллельные варианты (по образцу)"
      footer={[
        canEdit && result && !created && (
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} onClick={createWorks}>
            Создать работы в «Мои работы»
          </Button>
        ),
        <Button key="close" onClick={onClose}>Закрыть</Button>,
      ]}
    >
      {created ? (
        <div>
          <Alert type="success" showIcon style={{ marginBottom: 12 }}
            message={`Создано работ: ${created.length}. Найти их можно в разделе «Мои работы».`} />
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {created.map((w) => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                <Tag color={w.role === 'оригинал' ? 'gold' : 'blue'}>{w.role}</Tag>
                <span style={{ flex: 1 }}>{w.title}</span>
                {onOpenWork && <Button size="small" onClick={() => { onOpenWork(w.id); onClose(); }}>Открыть</Button>}
              </div>
            ))}
          </Space>
        </div>
      ) : (
      <>
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="Для каждой задачи образца подбирается похожая (та же тема и тип, другие числа). Получаются параллельные варианты: подготовка → контрольная → пересдача."
      />
      <Space style={{ marginBottom: 12, width: '100%' }} wrap>
        <span>Название:</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 220 }} placeholder="Название работ" />
        <span>Параллелей:</span>
        <InputNumber min={1} max={5} value={count} onChange={(v) => setCount(v || 2)} />
        <Button icon={<ReloadOutlined />} onClick={generate} loading={loading}>Подобрать</Button>
      </Space>

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
      {!loading && error && <Alert type="error" showIcon message={error} />}
      {!loading && result?.shortage?.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message={`Для ${result.shortage.length} позиц. не хватило похожих задач в базе — отмечены красным. Добавь больше задач этого типа или уменьши число вариантов.`}
        />
      )}

      {!loading && result && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, alignItems: 'start' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>Образец</div>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {result.base.map((t, i) => <TaskCell key={i} t={t} />)}
            </Space>
          </div>
          {result.variants.map((variant, vi) => (
            <div key={vi}>
              <div style={{ fontWeight: 600, marginBottom: 6, textAlign: 'center', color: '#1890ff' }}>Параллель {vi + 1}</div>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {variant.map((t, i) => (
                  <TaskCell key={i} t={t} onPick={() => setPickTarget({ vi, pos: i })} />
                ))}
              </Space>
            </div>
          ))}
        </div>
      )}

      {!loading && result && result.base.length === 0 && <Empty description="Нет задач в образце" />}
      </>
      )}

      <TaskSelectModal
        visible={pickTarget !== null}
        onCancel={() => setPickTarget(null)}
        onSelect={handlePick}
        excludeIds={usedIds}
      />
    </Modal>
  );
}
