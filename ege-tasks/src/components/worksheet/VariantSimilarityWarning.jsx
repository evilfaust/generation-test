import { useState, useEffect } from 'react';
import { Alert, Tag, Tooltip } from 'antd';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';
const WARN_COS = 0.78; // порог «возможный повтор» внутри варианта

function pctColor(pct) {
  if (pct >= 90) return 'red';
  if (pct >= 70) return 'orange';
  return 'gold';
}

/**
 * Предупреждение о похожих задачах ВНУТРИ варианта (A2).
 * Дёргает /pairs по id задач каждого варианта; показывает пары выше порога.
 * Тихо ничего не рендерит, если сервис недоступен или повторов нет.
 *
 * @param {Array} variants - [{ tasks: [{id, code}] }]
 */
export default function VariantSimilarityWarning({ variants = [] }) {
  const [results, setResults] = useState([]); // [{ variantIdx, pairs:[{a,b,cos,pct}] }]

  useEffect(() => {
    let cancelled = false;
    if (!variants.length) { setResults([]); return; }

    (async () => {
      const out = [];
      for (let vi = 0; vi < variants.length; vi++) {
        const tasks = variants[vi].tasks || [];
        const ids = tasks.map((t) => t.id).filter(Boolean);
        if (ids.length < 2) continue;
        try {
          const res = await fetch(`${PDF_SERVICE_URL}/pairs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_ids: ids, min_cos: WARN_COS }),
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (data.pairs?.length) out.push({ variantIdx: vi, pairs: data.pairs });
        } catch { /* сервис недоступен — молчим */ }
      }
      if (!cancelled) setResults(out);
    })();

    return () => { cancelled = true; };
  }, [variants]);

  if (!results.length) return null;

  // id → «№позиция (код)» внутри варианта
  const labelOf = (vi, id) => {
    const tasks = variants[vi].tasks || [];
    const idx = tasks.findIndex((t) => t.id === id);
    const code = tasks[idx]?.code || id.slice(0, 6);
    return `№${idx + 1} (${code})`;
  };

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginTop: 12 }}
      message="Возможные повторы внутри вариантов"
      description={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map(({ variantIdx, pairs }) => (
            <div key={variantIdx}>
              <b>Вариант {variantIdx + 1}:</b>{' '}
              {pairs.map((p, i) => (
                <Tooltip key={i} title={`косинус ${p.cos}`}>
                  <Tag color={pctColor(p.pct)} style={{ marginBottom: 4 }}>
                    {labelOf(variantIdx, p.a)} ↔ {labelOf(variantIdx, p.b)} · {p.pct}%
                  </Tag>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      }
    />
  );
}
