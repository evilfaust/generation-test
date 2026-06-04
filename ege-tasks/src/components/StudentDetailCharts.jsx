import React, { useState } from 'react';
import { Button } from 'antd';
import { api } from '../services/pocketbase';
import MathRenderer from './MathRenderer';

// Презентационные под-компоненты StudentDetailPage, вынесены из god-компонента:
// AttemptDetails (разворачиваемая строка попытки) и ScoreChart (SVG-график динамики).

// ============================================
// Attempt Details — expandable row content
// ============================================
const AttemptDetails = ({ answers }) => {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggle = (id) => setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  if (!answers || !answers.length) {
    return <div className="sdp-attempt-empty">Нет данных об ответах</div>;
  }
  return (
    <div className="sdp-attempt-details">
      {answers.map((ans) => {
        const task = ans.expand?.task;
        const topic = task?.expand?.topic;
        const isExpanded = expandedIds.has(ans.id);
        const hasStatement = !!(task?.statement_md || task?.statement);
        const taskImageUrl = task ? api.getTaskImageUrl(task) : null;
        return (
          <div
            key={ans.id}
            className={`sdp-attempt-row ${ans.is_correct ? 'sdp-attempt-row--ok' : 'sdp-attempt-row--err'}`}
          >
            <div className="sdp-attempt-row-main">
              <span className="sdp-attempt-status">{ans.is_correct ? '✓' : '✗'}</span>
              {task?.code && <span className="sdp-attempt-code">{task.code}</span>}
              {topic && <span className="sdp-attempt-topic">{topic.title}</span>}
              <span className="sdp-attempt-answers">
                <span className={ans.is_correct ? 'sdp-ans-ok' : 'sdp-ans-err'}>
                  {ans.answer_raw || '—'}
                </span>
                {!ans.is_correct && task?.answer && (
                  <span className="sdp-ans-right">→ {task.answer}</span>
                )}
              </span>
              {(hasStatement || taskImageUrl) && (
                <Button
                  size="small"
                  type={isExpanded ? 'default' : 'link'}
                  onClick={() => toggle(ans.id)}
                  className="sdp-attempt-stmt-btn"
                >
                  {isExpanded ? 'Скрыть' : 'Условие'}
                </Button>
              )}
            </div>
            {isExpanded && (
              <div className="sdp-attempt-statement">
                {hasStatement && (
                  <MathRenderer text={task.statement_md || task.statement} />
                )}
                {taskImageUrl && (
                  <img src={taskImageUrl} alt="" className="sdp-attempt-stmt-img" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// SVG Line Chart with tooltip + click
// ============================================
const ScoreChart = ({ data, onPointClick }) => {
  const [tooltip, setTooltip] = useState(null);

  if (data.length < 2) return null;

  const W = 640, H = 170;
  const PAD = { top: 14, right: 16, bottom: 30, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * plotW,
    y: PAD.top + plotH - (d.percent / 100) * plotH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`;

  const maxLabels = 8;
  const step = data.length > maxLabels ? Math.ceil(data.length / maxLabels) : 1;
  const dayCountMap = data.reduce((acc, item) => {
    const key = item.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());

  const getColor = (pct) => pct >= 70 ? '#52c41a' : pct >= 40 ? '#faad14' : '#ff4d4f';

  return (
    <div className="sdp-chart-wrap" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="sdp-chart"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="sdpChartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4361ee" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4361ee" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map(v => {
          const y = PAD.top + plotH - (v / 100) * plotH;
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e8e8e8" strokeDasharray="4,4" />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#8c8c8c" fontFamily="Inter, -apple-system, sans-serif">{v}%</text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#sdpChartGrad)" />
        <path d={linePath} fill="none" stroke="#4361ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Invisible hit areas for easy hover */}
        {points.map((p, i) => (
          <circle
            key={`hit-${i}`}
            cx={p.x} cy={p.y} r="14"
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setTooltip({ xPct: p.x / W, yPct: p.y / H, point: p })}
            onClick={() => onPointClick?.(p)}
          />
        ))}
        {/* Visible dots */}
        {points.map((p, i) => {
          const color = getColor(p.percent);
          const isHovered = tooltip?.point === p;
          return (
            <circle
              key={`dot-${i}`}
              cx={p.x} cy={p.y}
              r={isHovered ? 6 : 4}
              fill="#fff"
              stroke={color}
              strokeWidth={isHovered ? 2.5 : 2}
              style={{ pointerEvents: 'none' }}
            />
          );
        })}
        {/* X axis labels */}
        {points.map((p, i) => {
          if (i % step !== 0 && i !== data.length - 1) return null;
          const dayLabel = p.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
          const isDuplicateDay = (dayCountMap.get(dayLabel) || 0) > 1;
          const dateStr = isDuplicateDay
            ? `${dayLabel} ${p.date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
            : dayLabel;
          return (
            <text key={`d-${i}`} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#8c8c8c" fontFamily="Inter, -apple-system, sans-serif">
              {dateStr}
            </text>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="sdp-chart-tooltip"
          style={{
            left: `${tooltip.xPct * 100}%`,
            top: `${tooltip.yPct * 100}%`,
          }}
        >
          <div className="sdp-chart-tooltip-title">{tooltip.point.title}</div>
          <div className="sdp-chart-tooltip-date">
            {tooltip.point.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div className="sdp-chart-tooltip-score" style={{ color: getColor(tooltip.point.percent) }}>
            {tooltip.point.percent}%
            {tooltip.point.score !== undefined && ` (${tooltip.point.score}/${tooltip.point.total})`}
          </div>
          <div className="sdp-chart-tooltip-hint">Нажмите, чтобы выделить</div>
        </div>
      )}
    </div>
  );
};

export { AttemptDetails, ScoreChart };
