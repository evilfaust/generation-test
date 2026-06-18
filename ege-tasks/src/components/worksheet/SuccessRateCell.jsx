import React from 'react';
import { Tooltip, Progress, Typography, Tag } from 'antd';
import { rateColor, LOW_CONFIDENCE_N, shrunkRate } from '../../utils/successStats';

const { Text } = Typography;

/**
 * Ячейка колонки «Успеваемость» для генераторов вариантов (ЕГЭ-база/профиль/ОГЭ).
 *
 * st — результат poolStatsDetailed по задачам темы:
 *   { rate, c, n, lower, internal:{rate,c,n}, external:{rate,c,n} } | { rate:null }
 * prior — средняя решаемость по каталогу (для усадки тем с малым/нулём данных).
 *
 * Две подачи:
 *  • измерено (n ≥ порога) — цвет по нижней границе Уилсона, бейдж «Р» и разбивка
 *    «наши vs Решу», если есть внешние данные;
 *  • оценка (мало/нет прямых данных) — усадка к приору, бледно, префикс «≈».
 */
export default function SuccessRateCell({ st, prior = 0.7 }) {
  const n = st?.n || 0;
  const measured = st && st.rate !== null && n >= LOW_CONFIDENCE_N;

  if (!measured) {
    const est = shrunkRate(st?.c || 0, n, prior);
    const pct = Math.round(est * 100);
    const color = rateColor(est);
    const tip = n > 0
      ? `≈ оценка: ${pct}%. Прямых ответов мало (n=${n}) — усреднено со средним по каталогу.`
      : `≈ оценка: ${pct}%. Прямых данных по теме нет — показано среднее по каталогу.`;
    return (
      <Tooltip title={tip}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.5 }}>
          <Progress percent={pct} size="small" strokeColor={color} showInfo={false} style={{ width: 60, margin: 0 }} />
          <Text style={{ fontSize: 12, color, fontWeight: 600 }}>≈{pct}%</Text>
        </div>
      </Tooltip>
    );
  }

  const pct = Math.round(st.rate * 100);
  const color = rateColor(st.lower);
  const hasExt = st.external.n > 0;
  const hasInt = st.internal.n > 0;
  const tip = (
    <div style={{ fontSize: 12 }}>
      <div>Решаемость: {pct}% (верно {st.c} из {st.n})</div>
      {hasInt && <div>• Наши ученики: {Math.round(st.internal.rate * 100)}% (n={st.internal.n})</div>}
      {hasExt && <div>• Решу (внешние): {Math.round(st.external.rate * 100)}% (n={st.external.n})</div>}
    </div>
  );
  return (
    <Tooltip title={tip}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Progress percent={pct} size="small" strokeColor={color} showInfo={false} style={{ width: 60, margin: 0 }} />
        <Text style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}%</Text>
        <Text type="secondary" style={{ fontSize: 10 }}>n={st.n}</Text>
        {hasExt && (
          <Tag color="geekblue" style={{ margin: 0, fontSize: 9, lineHeight: '14px', padding: '0 4px' }}>Р</Tag>
        )}
      </div>
    </Tooltip>
  );
}
