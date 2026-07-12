import { useState, useEffect, useCallback } from 'react';
import { Modal, Segmented, Spin, Alert, Empty, Tag, Button, Space, Switch, Typography, Tooltip } from 'antd';
import { ReloadOutlined, EyeOutlined, CheckOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';

const { Text } = Typography;

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

// Пороги мягче дедупа банка tasks (0.93): у банковских задач в тексте эмбеддинга
// есть фасетные теги, у своих — нет, поэтому даже точный дубль даёт cos < 1.
const THRESHOLDS = [
  { label: 'Строго', value: 0.92 },
  { label: 'Средне', value: 0.87 },
  { label: 'Широко', value: 0.82 },
];

// Просмотренные пары — в localStorage (разовое ревью небольшого каталога,
// миграция под это не заводится).
const HIDDEN_KEY = 'geoBankDupHidden';
const loadHidden = () => {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); }
  catch { return new Set(); }
};
const saveHidden = (set) => {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
};

function pctColor(pct) {
  if (pct >= 90) return 'red';
  if (pct >= 70) return 'orange';
  if (pct >= 50) return 'gold';
  return 'default';
}

const pairKey = (p) => `${p.mine.id}:${p.bank.id}`;

function TaskHalf({ label, color, code, title, statement, answer, onOpen }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Tag color={color} style={{ margin: 0 }}>{label}</Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>{code}</Text>
        {onOpen && (
          <Button size="small" type="text" icon={<EyeOutlined />} onClick={onOpen} style={{ marginLeft: 'auto' }} />
        )}
      </div>
      {title && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{title}</div>}
      <div style={{ fontSize: 13, lineHeight: 1.4 }}>
        <MathRenderer text={statement} />
      </div>
      {answer && (
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          Ответ: <MathRenderer text={answer} inline />
        </div>
      )}
    </div>
  );
}

/**
 * Модал «Дубли с банком МЦНМО» — ревью пар «моя задача ↔ похожая в банке»
 * поверх /geo/duplicates (vec_geometry). Скрытие пары = «просмотрено»
 * (localStorage), данные не трогаются.
 */
export default function GeometryBankDuplicatesModal({ open, onClose, onOpenTask }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [minCos, setMinCos] = useState(0.87);
  const [hidden, setHidden] = useState(loadHidden);
  const [showHidden, setShowHidden] = useState(false);

  const fetchPairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${PDF_SERVICE_URL}/geo/duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_cos: minCos }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Сервис ответил ${res.status}`);
      const d = await res.json();
      if (d.error === 'no_index') throw new Error('Векторный индекс геометрии не построен (npm run index:geo).');
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e.name === 'TimeoutError' ? 'Таймаут запроса к сервису поиска.' : e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [minCos]);

  useEffect(() => { if (open) fetchPairs(); }, [open, fetchPairs]);

  const toggleHidden = (key) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveHidden(next);
      return next;
    });
  };

  const pairs = data?.pairs || [];
  const visible = pairs.filter((p) => showHidden || !hidden.has(pairKey(p)));
  const hiddenCount = pairs.filter((p) => hidden.has(pairKey(p))).length;
  const notIndexed = data ? data.manual_total - data.manual_indexed : 0;

  return (
    <Modal
      title="Дубли с банком МЦНМО"
      open={open}
      onCancel={onClose}
      width={900}
      footer={[<Button key="close" onClick={onClose}>Закрыть</Button>]}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Tooltip title="Насколько близкими должны быть тексты, чтобы пара попала в список.">
            <Segmented
              size="small"
              value={minCos}
              onChange={setMinCos}
              options={THRESHOLDS}
            />
          </Tooltip>
          <span style={{ fontSize: 13 }}>
            <Switch size="small" checked={showHidden} onChange={setShowHidden} /> показать просмотренные{hiddenCount ? ` (${hiddenCount})` : ''}
          </span>
          <Button size="small" type="text" icon={<ReloadOutlined />} onClick={fetchPairs} disabled={loading}>
            обновить
          </Button>
          {data && (
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
              Сравнено своих задач: {data.manual_indexed} из {data.manual_total}
              {notIndexed > 0 && ` (${notIndexed} без текста — не сравниваются)`}
            </Text>
          )}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}

        {!loading && error && <Alert type="warning" showIcon message={error} />}

        {!loading && !error && data && visible.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={pairs.length > 0 ? 'Все пары просмотрены' : 'Дублей выше порога не найдено'}
          />
        )}

        {!loading && !error && visible.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
            {visible.map((p) => {
              const key = pairKey(p);
              const isHidden = hidden.has(key);
              return (
                <div
                  key={key}
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    padding: '10px 12px',
                    background: isHidden ? '#f5f5f5' : '#fafafa',
                    opacity: isHidden ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Tag color={pctColor(p.pct)} style={{ margin: 0, fontWeight: 600 }}>{p.pct}%</Tag>
                    {p.answers_match && <Tag color="volcano" style={{ margin: 0 }}>ответы совпадают</Tag>}
                    <Button
                      size="small"
                      type="text"
                      icon={<CheckOutlined />}
                      style={{ marginLeft: 'auto', color: isHidden ? '#52c41a' : undefined }}
                      onClick={() => toggleHidden(key)}
                    >
                      {isHidden ? 'просмотрено' : 'скрыть'}
                    </Button>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <TaskHalf
                      label="Моя" color="green"
                      code={p.mine.code} title={p.mine.title}
                      statement={p.mine.statement} answer={p.mine.answer}
                      onOpen={onOpenTask ? () => onOpenTask(p.mine.id) : undefined}
                    />
                    <div style={{ width: 1, background: '#e8e8e8', flexShrink: 0 }} />
                    <TaskHalf
                      label="Банк" color="geekblue"
                      code={p.bank.code}
                      statement={p.bank.statement} answer={p.bank.answer}
                      onOpen={onOpenTask ? () => onOpenTask(p.bank.id) : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Space>
    </Modal>
  );
}
