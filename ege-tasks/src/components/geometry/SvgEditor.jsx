/**
 * SvgEditor — интерактивный редактор SVG-чертежа.
 *
 * Три типа drag-хэндлов:
 *   • Синий   — геометрическая точка (меняет coords в XML)
 *   • Оранжевый — подпись вершины (меняет labelOffset точки)
 *   • Фиолетовый — подпись угла, например "45°" (меняет labelOffset угла)
 *
 * Props:
 *   xmlString  {string}  — GeoGebra XML
 *   svgString  {string}  — текущий SVG-чертёж
 *   onSave     {(svg: string) => void}
 *   onCancel   {() => void}
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Space, Typography } from 'antd';
import {
  applyLabelOffsets,
  applyPointOverrides,
  applyTextPositions,
  applyTextStartPoints,
  ggbXmlToSvg,
  parseGgbPoints,
} from '../../utils/ggbToSvg';
import { sanitizeSvg } from '../../utils/sanitizeSvg';

const { Text } = Typography;

function parseViewBox(svgStr) {
  const m = svgStr?.match(/viewBox="([^"]+)"/);
  if (!m) return null;
  const [x, y, w, h] = m[1].trim().split(/\s+/).map(Number);
  if ([x, y, w, h].some(isNaN)) return null;
  return { x, y, w, h };
}

const HANDLE_POINT    = 'point';
const HANDLE_LABEL    = 'label';
const HANDLE_ANGLE    = 'angle';
const HANDLE_SEGLABEL = 'seglabel';
const HANDLE_TEXT     = 'text';

// Цвета хэндлов
const COLOR = {
  [HANDLE_POINT]:    { fill: 'rgba(24,144,255,0.25)',  active: 'rgba(24,144,255,0.5)',  stroke: '#1890ff' },
  [HANDLE_LABEL]:    { fill: 'rgba(250,140,22,0.25)',  active: 'rgba(250,140,22,0.5)',  stroke: '#fa8c16' },
  [HANDLE_ANGLE]:    { fill: 'rgba(114,59,134,0.25)', active: 'rgba(114,59,134,0.5)',  stroke: '#722b86' },
  [HANDLE_SEGLABEL]: { fill: 'rgba(19,194,194,0.25)', active: 'rgba(19,194,194,0.5)',  stroke: '#13c2c2' },
  [HANDLE_TEXT]:     { fill: 'rgba(82,196,26,0.25)',   active: 'rgba(82,196,26,0.5)',   stroke: '#52c41a' },
};

export default function SvgEditor({ xmlString, svgString, onSave, onCancel }) {
  const [currentXml, setCurrentXml] = useState(xmlString);
  const [currentSvg, setCurrentSvg] = useState(svgString);

  const [pointHandles,    setPointHandles]    = useState([]); // { label, px, py }
  const [labelHandles,    setLabelHandles]    = useState([]); // { label, px, py, pointPx, pointPy }
  const [angleHandles,    setAngleHandles]    = useState([]); // { label, px, py, basePx, basePy }
  const [segLabelHandles, setSegLabelHandles] = useState([]); // { label, px, py, basePx, basePy }
  const [textHandles,     setTextHandles]     = useState([]); // { label, text, px, py }
  const [coordSys, setCoordSys]          = useState(null);
  const [viewBox, setViewBox]            = useState(null);

  const containerRef = useRef(null);
  // { type, label, startPx, startPy, startClientX, startClientY, basePx?, basePy?, pointPx?, pointPy? }
  const dragRef = useRef(null);
  const [activeHandle, setActiveHandle] = useState(null); // { type, label }

  // ── Парсим при смене XML ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      const { points, angleLabels, segLabels, freeTexts, coordSys: cs } = parseGgbPoints(currentXml);
      setCoordSys(cs);
      setPointHandles(points.map(({ label, px, py }) => ({ label, px, py })));
      setLabelHandles(
        points
          .filter((p) => p.showLabel)
          .map(({ label, labelPx, labelPy, px, py }) => ({
            label, px: labelPx, py: labelPy, pointPx: px, pointPy: py,
          })),
      );
      setAngleHandles(
        angleLabels.map(({ label, px, py, basePx, basePy }) => ({
          label, px, py, basePx, basePy,
        })),
      );
      setSegLabelHandles(
        (segLabels ?? []).map(({ label, px, py, basePx, basePy }) => ({
          label, px, py, basePx, basePy,
        })),
      );
      setTextHandles((freeTexts ?? []).map(({ label, text, px, py, posType }) => ({ label, text, px, py, posType })));
    } catch (err) {
      console.error('[SvgEditor] parse:', err);
    }
  }, [currentXml]);

  useEffect(() => {
    setViewBox(parseViewBox(currentSvg));
  }, [currentSvg]);

  // ── Масштаб экран → SVG ──────────────────────────────────────────────────
  const getScale = useCallback(() => {
    if (!containerRef.current || !viewBox) return { sx: 1, sy: 1 };
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return { sx: 1, sy: 1 };
    return { sx: viewBox.w / rect.width, sy: viewBox.h / rect.height };
  }, [viewBox]);

  // ── Pointer down ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e, type, label, px, py, extra = {}) => {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragRef.current = { type, label, startPx: px, startPy: py,
                        startClientX: e.clientX, startClientY: e.clientY, ...extra };
    setActiveHandle({ type, label });
  }, []);

  // ── Pointer move: двигаем хэндл, SVG не перерисовываем ──────────────────
  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const { type, label, startPx, startPy, startClientX, startClientY } = dragRef.current;
    const { sx, sy } = getScale();
    const newPx = startPx + (e.clientX - startClientX) * sx;
    const newPy = startPy + (e.clientY - startClientY) * sy;

    if (type === HANDLE_POINT) {
      setPointHandles((prev) => prev.map((h) => h.label === label ? { ...h, px: newPx, py: newPy } : h));
    } else if (type === HANDLE_LABEL) {
      setLabelHandles((prev) => prev.map((h) => h.label === label ? { ...h, px: newPx, py: newPy } : h));
    } else if (type === HANDLE_ANGLE) {
      setAngleHandles((prev) => prev.map((h) => h.label === label ? { ...h, px: newPx, py: newPy } : h));
    } else if (type === HANDLE_SEGLABEL) {
      setSegLabelHandles((prev) => prev.map((h) => h.label === label ? { ...h, px: newPx, py: newPy } : h));
    } else {
      setTextHandles((prev) => prev.map((h) => h.label === label ? { ...h, px: newPx, py: newPy } : h));
    }
  }, [getScale]);

  // ── Pointer up: обновляем XML и перерисовываем SVG ───────────────────────
  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current) return;
    const { type, label, startPx, startPy, startClientX, startClientY,
            pointPx, pointPy, basePx, basePy } = dragRef.current;
    dragRef.current = null;
    setActiveHandle(null);

    const { sx, sy } = getScale();
    const finalPx = startPx + (e.clientX - startClientX) * sx;
    const finalPy = startPy + (e.clientY - startClientY) * sy;

    try {
      let newXml;
      if (type === HANDLE_POINT) {
        if (!coordSys) return;
        const newX = (finalPx - coordSys.xZero) / coordSys.scale;
        const newY = (coordSys.yZero - finalPy)  / coordSys.yscale;
        newXml = applyPointOverrides(currentXml, { [label]: { x: newX, y: newY } });
      } else if (type === HANDLE_LABEL) {
        // Смещение относительно геометрической точки (в SVG-пикселях)
        newXml = applyLabelOffsets(currentXml, { [label]: { x: finalPx - pointPx, y: finalPy - pointPy } });
      } else if (type === HANDLE_ANGLE || type === HANDLE_SEGLABEL) {
        // Смещение относительно базовой позиции (биссектриса угла / середина отрезка)
        newXml = applyLabelOffsets(currentXml, { [label]: { x: finalPx - basePx, y: finalPy - basePy } });
      } else {
        // HANDLE_TEXT
        const { posType } = dragRef.current;
        if (posType === 'start') {
          // startPoint: позиция в математических координатах GeoGebra
          if (!coordSys) return;
          const mathX = (finalPx - coordSys.xZero) / coordSys.scale;
          const mathY = (coordSys.yZero - finalPy)  / coordSys.yscale;
          newXml = applyTextStartPoints(currentXml, { [label]: { x: mathX, y: mathY } });
        } else {
          // absoluteScreenLocation: позиция в SVG-пикселях напрямую
          newXml = applyTextPositions(currentXml, { [label]: { x: finalPx, y: finalPy } });
        }
      }
      const newSvg = ggbXmlToSvg(newXml);
      setCurrentXml(newXml);
      setCurrentSvg(newSvg);
    } catch (err) {
      console.error('[SvgEditor] apply error:', err);
    }
  }, [coordSys, getScale, currentXml]);

  const handleReset = useCallback(() => {
    setCurrentXml(xmlString);
    setCurrentSvg(svgString);
  }, [xmlString, svgString]);

  // ── Универсальный рендер хэндла ──────────────────────────────────────────
  function Handle({ type, label, px, py, onDown }) {
    const isActive = activeHandle?.type === type && activeHandle?.label === label;
    const c = COLOR[type];
    return (
      <g
        style={{ cursor: isActive ? 'grabbing' : 'grab' }}
        onPointerDown={onDown}
      >
        <circle cx={px} cy={py} r={14} fill="transparent" />
        <circle cx={px} cy={py}
          r={isActive ? 7 : 5}
          fill={isActive ? c.active : c.fill}
          stroke={c.stroke}
          strokeWidth={1.5}
        />
      </g>
    );
  }

  // ── Рендер ────────────────────────────────────────────────────────────────
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* Легенда */}
      <Space size={16} wrap>
        {[
          [HANDLE_POINT,    'вершина'],
          [HANDLE_LABEL,    'подпись вершины'],
          [HANDLE_ANGLE,    'подпись угла'],
          [HANDLE_SEGLABEL, 'длина стороны'],
          [HANDLE_TEXT,     'свободный текст'],
        ].map(([type, name]) => (
          <Space key={type} size={4}>
            <svg width={14} height={14}>
              <circle cx={7} cy={7} r={5}
                fill={COLOR[type].fill}
                stroke={COLOR[type].stroke}
                strokeWidth={1.5}
              />
            </svg>
            <Text style={{ fontSize: 12 }}>{name}</Text>
          </Space>
        ))}
        <Text type="secondary" style={{ fontSize: 12 }}>— перетащите нужный маркер</Text>
      </Space>

      {/* Холст */}
      <div
        style={{
          position: 'relative', touchAction: 'none', userSelect: 'none',
          background: '#ffffff', border: '1px solid #d9d9d9',
          borderRadius: 8, overflow: 'hidden',
          cursor: dragRef.current ? 'grabbing' : 'default',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div ref={containerRef} dangerouslySetInnerHTML={{ __html: sanitizeSvg(currentSvg) }} />

        {viewBox && (
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            {/* Пунктирные линии: точка → подпись вершины */}
            {labelHandles.map(({ label, px: lx, py: ly }) => {
              const ph = pointHandles.find((h) => h.label === label);
              if (!ph) return null;
              return (
                <line key={`line-lbl-${label}`}
                  x1={ph.px} y1={ph.py} x2={lx} y2={ly}
                  stroke={COLOR[HANDLE_LABEL].stroke}
                  strokeWidth={0.8} strokeDasharray="3,3" opacity={0.5}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

            {/* Пунктирные линии: точка-вершина → подпись угла */}
            {angleHandles.map(({ label, px: ax, py: ay, basePx, basePy }) => (
              <line key={`line-ang-${label}`}
                x1={basePx} y1={basePy} x2={ax} y2={ay}
                stroke={COLOR[HANDLE_ANGLE].stroke}
                strokeWidth={0.8} strokeDasharray="3,3" opacity={0.5}
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {/* Пунктирные линии: середина отрезка → подпись длины */}
            {segLabelHandles.map(({ label, px: sx, py: sy, basePx, basePy }) => (
              <line key={`line-seg-${label}`}
                x1={basePx} y1={basePy} x2={sx} y2={sy}
                stroke={COLOR[HANDLE_SEGLABEL].stroke}
                strokeWidth={0.8} strokeDasharray="3,3" opacity={0.5}
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {/* Хэндлы точек (синие) */}
            {pointHandles.map(({ label, px, py }) => (
              <Handle key={`pt-${label}`} type={HANDLE_POINT} label={label} px={px} py={py}
                onDown={(e) => handlePointerDown(e, HANDLE_POINT, label, px, py)}
              />
            ))}

            {/* Хэндлы подписей вершин (оранжевые) */}
            {labelHandles.map(({ label, px, py, pointPx, pointPy }) => (
              <Handle key={`lbl-${label}`} type={HANDLE_LABEL} label={label} px={px} py={py}
                onDown={(e) => handlePointerDown(e, HANDLE_LABEL, label, px, py, { pointPx, pointPy })}
              />
            ))}

            {/* Хэндлы подписей углов (фиолетовые) */}
            {angleHandles.map(({ label, px, py, basePx, basePy }) => (
              <Handle key={`ang-${label}`} type={HANDLE_ANGLE} label={label} px={px} py={py}
                onDown={(e) => handlePointerDown(e, HANDLE_ANGLE, label, px, py, { basePx, basePy })}
              />
            ))}

            {/* Хэндлы подписей длин отрезков (голубые) */}
            {segLabelHandles.map(({ label, px, py, basePx, basePy }) => (
              <Handle key={`seg-${label}`} type={HANDLE_SEGLABEL} label={label} px={px} py={py}
                onDown={(e) => handlePointerDown(e, HANDLE_SEGLABEL, label, px, py, { basePx, basePy })}
              />
            ))}

            {/* Хэндлы свободных текстов (зелёные) */}
            {textHandles.map(({ label, px, py, posType }) => (
              <Handle key={`txt-${label}`} type={HANDLE_TEXT} label={label} px={px} py={py}
                onDown={(e) => handlePointerDown(e, HANDLE_TEXT, label, px, py, { posType })}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Кнопки */}
      <Space>
        <Button onClick={onCancel}>Отмена</Button>
        <Button onClick={handleReset}>Сбросить</Button>
        <Button type="primary" onClick={() => onSave(currentSvg)}>Применить</Button>
      </Space>
    </Space>
  );
}
