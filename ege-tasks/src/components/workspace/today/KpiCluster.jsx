import { TONE_HEX } from '../ui/groupColor';

/**
 * KPI 2×2. items: [{ key, label, value, tone, tag, icon, alert, onClick }].
 * alert=true → значение цветом тона (для amber/rose-метрик).
 */
export default function KpiCluster({ items }) {
  return (
    <div className="td-kpi">
      {items.map((k) => {
        const hex = TONE_HEX[k.tone] || TONE_HEX.neutral;
        return (
          <button type="button" key={k.key} className="td-kpi__card" onClick={k.onClick}>
            <div className="td-kpi__top">
              <span className="td-kpi__icon" style={{ color: hex.base, background: hex.soft }}>{k.icon}</span>
              {k.tag && <span className="td-kpi__tag" style={{ color: hex.base, background: hex.soft }}>{k.tag}</span>}
            </div>
            <div>
              <div className="td-kpi__value" style={k.alert ? { color: hex.base } : undefined}>{k.value}</div>
              <div className="td-kpi__label">{k.label}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
