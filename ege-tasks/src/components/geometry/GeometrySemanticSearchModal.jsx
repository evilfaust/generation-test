import { useState } from 'react';
import { Modal, Input, Segmented, Spin, Alert, Empty, Tag, Button, Space, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { aiHeaders } from '../../services/pocketbase';

const { Text } = Typography;

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

const ORIGIN_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'mccme', label: 'Банк МЦНМО' },
  { value: 'manual', label: 'Мои' },
];

const EXAMPLES = [
  'биссектриса пересекает описанную окружность',
  'вписанная окружность касается сторон',
  'площадь трапеции через диагонали',
  'сечение куба плоскостью',
];

/**
 * Модал «Поиск по смыслу» — запрос на естественном языке → /geo/search
 * (эмбеддинг запроса на сервере → KNN по vec_geometry).
 */
export default function GeometrySemanticSearchModal({ open, onClose, onOpenTask }) {
  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState(null); // null = ещё не искали

  const runSearch = async (q = query) => {
    const text = String(q || '').trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${PDF_SERVICE_URL}/geo/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({
          query: text,
          limit: 15,
          ...(origin !== 'all' ? { origin } : {}),
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 401 || res.status === 403) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Нужен вход учителя с включёнными ИИ-функциями.');
      }
      if (!res.ok) throw new Error(`Сервис ответил ${res.status}`);
      const data = await res.json();
      if (data.error === 'no_index') throw new Error('Векторный индекс геометрии не построен.');
      if (data.error === 'index_model_mismatch') throw new Error('Индекс построен другой моделью — нужна переиндексация (npm run index:geo:full).');
      if (data.error) throw new Error(data.error);
      setItems(data.items || []);
    } catch (e) {
      setError(e.name === 'TimeoutError' ? 'Таймаут запроса к сервису поиска.' : e.message);
      setItems(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="🧠 Поиск задач по смыслу"
      open={open}
      onCancel={onClose}
      width={780}
      footer={[<Button key="close" onClick={onClose}>Закрыть</Button>]}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Input.Search
          placeholder="Опишите, какая задача нужна — например: биссектриса пересекает описанную окружность"
          enterButton="Найти"
          size="large"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onSearch={() => runSearch()}
          loading={loading}
          autoFocus
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Segmented size="small" value={origin} onChange={setOrigin} options={ORIGIN_FILTERS} />
          {items === null && !loading && !error && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Например:{' '}
              {EXAMPLES.map((ex, i) => (
                <span key={ex}>
                  {i > 0 && ' · '}
                  <a onClick={() => { setQuery(ex); runSearch(ex); }}>{ex}</a>
                </span>
              ))}
            </Text>
          )}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}

        {!loading && error && <Alert type="warning" showIcon message={error} />}

        {!loading && !error && items && items.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Ничего похожего не нашлось — попробуйте переформулировать" />
        )}

        {!loading && items && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
            {items.map((it, idx) => (
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
                  <Tag style={{ margin: 0, fontWeight: 600 }}>{idx + 1}</Tag>
                  <span style={{ fontSize: 11, color: '#999' }}>{it.code}</span>
                  <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                    color={it.origin === 'mccme' ? 'geekblue' : 'green'}>
                    {it.origin === 'mccme' ? 'Банк' : 'Моя'}
                  </Tag>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.4, overflow: 'hidden', flex: 1 }}>
                  {it.title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{it.title}</div>}
                  <MathRenderer text={it.statement} />
                </div>
                {onOpenTask && <EyeOutlined style={{ color: '#999', flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}
          </div>
        )}
      </Space>
    </Modal>
  );
}
