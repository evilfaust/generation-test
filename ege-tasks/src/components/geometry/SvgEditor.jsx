/**
 * SvgEditor — интерактивный редактор SVG-чертежа.
 *
 * Два типа drag-хэндлов:
 *   • Синий кружок  — на геометрической точке. Drag меняет coords в XML.
 *   • Оранжевый кружок — на подписи вершины. Drag меняет labelOffset в XML.
 *
 * Props:
 *   xmlString  {string}  — GeoGebra XML (источник координат и смещений)
 *   svgString  {string}  — текущий SVG-чертёж
 *   onSave     {(svg: string) => void}
 *   onCancel   {() => void}
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Space, Typography } from 'antd';
import {
  applyLabelOffsets,
  applyPointOverrides,
  ggbXmlToSvg,
  parseGgbPoints,
} from '../../utils/ggbToSvg';

const { Text } = Typography;

function parseViewBox(svgStr) {
  const m = svgStr?.match(/viewBox="([^"]+)"/);
  if (!m) return null;
  const [x, y, w, h] = m[1].trim().split(/\s+/).map(Number);
  if ([x, y, w, h].some(isNaN)) return null;
  return { x, y, w, h };
}

// Типы хэндлов
const HANDLE_POINT = 'point';
const HANDLE_LABEL = 'label';

export default function SvgEditor({ xmlString, svgString, onSave, onCancel }) {
  const [currentXml, setCurrentXml] = useState(xmlString);
  const [currentSvg, setCurrentSvg] = useState(svgString);

  // Хэндлы: { label, px, py } для точек и { label, px, py, pointPx, pointPy } для меток
  const [pointHandles, setPointHandles] = useState([]);
  const [labelHandles, setLabelHandles] = useState([]);
  const [coordSys, setCoordSys] = useState(null);
  const [viewBox, setViewBox] = useState(null);

  const containerRef = useRef(null);
  // Текущий drag: { type, label, startPx, startPy, startClientX, startClientY, pointPx?, pointPy? }
  const dragRef = useRef(null);
  const [activeHandle, setActiveHandle] = useState(null); // { type, label }

  // ── Парсим точки при смене XML ───────────────────────────────────────────
  useEffect(() => {
    try {
      const { points, coordSys: cs } = parseGgbPoints(currentXml);
      setCoordSys(cs);
      setPointHandles(points.map(({ label, px, py }) => ({ label, px, py })));
      setLabelHandles(
        points
          .filter((p) => p.showLabel)
          .map(({ label, labelPx, labelPy, px, py }) => ({
            label,
            px:      labelPx,
            py:      labelPy,
            pointPx: px,
            pointPy: py,
          })),
      );
    } catch (err) {
      console.error('[SvgEditor] parseGgbPoints:', err);
    }
  }, [currentXml]);

  // ── Парсим viewBox при смене SVG ─────────────────────────────────────────
  useEffect(() => {
    setViewBox(parseViewBox(currentSvg));
  }, [currentSvg]);

  // ── Масштаб: экранные пиксели → SVG-пиксели ─────────────────────────────
  const getScale = useCallback(() => {
    if (!containerRef.current || !viewBox) return { sx: 1, sy: 1 };
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return { sx: 1, sy: 1 };
    return { sx: viewBox.w / rect.width, sy: viewBox.h / rect.height };
  }, [viewBox]);

  // ── Pointer down ─────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e, type, label, px, py, pointPx, pointPy) => {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragRef.current = {
      type,
      label,
      startPx:      px,
      startPy:      py,
      startClientX: e.clientX,
      startClientY: e.clientY,
      // Нужно для label-drag (чтобы вычислить новый offset относительно точки)
      pointPx: pointPx ?? px,
      pointPy: pointPy ?? py,
    };
    setActiveHandle({ type, label });
  }, []);

  // ── Pointer move: двигаем только хэндл, SVG не перерисовываем ───────────
  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const { type, label, startPx, startPy, startClientX, startClientY } = dragRef.current;
    const { sx, sy } = getScale();
    const newPx = startPx + (e.clientX - startClientX) * sx;
    const newPy = startPy + (e.clientY - startClientY) * sy;

    if (type === HANDLE_POINT) {
      setPointHandles((prev) =>
        prev.map((h) => (h.label === label ? { ...h, px: newPx, py: newPy } : h)),
      );
    } else {
      setLabelHandles((prev) =>
        prev.map((h) => (h.label === label ? { ...h, px: newPx, py: newPy } : h)),
      );
    }
  }, [getScale]);

  // ── Pointer up: пересчитываем координаты и перерисовываем SVG ───────────
  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current) return;
    const { type, label, startPx, startPy, startClientX, startClientY, pointPx, pointPy } = dragRef.current;
    dragRef.current = null;
    setActiveHandle(null);

    const { sx, sy } = getScale();
    const finalPx = startPx + (e.clientX - startClientX) * sx;
    const finalPy = startPy + (e.clientY - startClientY) * sy;

    try {
      let newXml;
      if (type === HANDLE_POINT) {
        // SVG-пиксели → математические координаты GeoGebra
        if (!coordSys) return;
        const newX = (finalPx - coordSys.xZero) / coordSys.scale;
        const newY = (coordSys.yZero - finalPy) / coordSys.yscale;
        newXml = applyPointOverrides(currentXml, { [label]: { x: newX, y: newY } });
      } else {
        // Смещение относительно точки (в SVG-пикселях = GeoGebra screen pixels)
        // pointPx/Py — позиция самой точки ДО этого drag (из dragRef, не изменялась)
        newXml = applyLabelOffsets(currentXml, {
          [label]: { x: finalPx - pointPx, y: finalPy - pointPy },
        });
      }
      const newSvg = ggbXmlToSvg(newXml);
      setCurrentXml(newXml);
      setCurrentSvg(newSvg);
    } catch (err) {
      console.error('[SvgEditor] apply error:', err);
    }
  }, [coordSys, getScale, currentXml]);

  // ── Сброс к исходному состоянию ──────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCurrentXml(xmlString);
    setCurrentSvg(svgString);
  }, [xmlString, svgString]);

  // ── Рендер ────────────────────────────────────────────────────────────────
  const isDragging = !!activeHandle;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* Легенда */}
      <Space size={16}>
        <Space size={4}>
          <svg width={14} height={14}>
            <circle cx={7} cy={7} r={5} fill="rgba(24,144,255,0.3)" stroke="#1890ff" strokeWidth={1.5}/>
          </svg>
          <Text style={{ fontSize: 12 }}>вершина</Text>
        </Space>
        <Space size={4}>
          <svg width={14} height={14}>
            <circle cx={7} cy={7} r={5} fill="rgba(250,140,22,0.3)" stroke="#fa8c16" strokeWidth={1.5}/>
          </svg>
          <Text style={{ fontSize: 12 }}>подпись</Text>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>— перетащите нужный маркер</Text>
      </Space>

      {/* Холст */}
      <div
        style={{
          position:    'relative',
          touchAction: 'none',
          userSelect:  'none',
          background:  '#ffffff',
          border:      '1px solid #d9d9d9',
          borderRadius: 8,
          overflow:    'hidden',
          cursor:      isDragging ? 'grabbing' : 'default',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* SVG-чертёж */}
        <div
          ref={containerRef}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: currentSvg }}
        />

        {/* Оверлей с хэндлами */}
        {viewBox && (
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            style={{
              position: 'absolute',
              top:      0,
              left:     0,
              width:    '100%',
              height:   '100%',
              overflow: 'visible',
            }}
          >
            {/* Соединительные линии: точка → подпись */}
            {labelHandles.map(({ label, px: lx, py: ly }) => {
              const ph = pointHandles.find((h) => h.label === label);
              if (!ph) return null;
              return (
                <line
                  key={`line-${label}`}
                  x1={ph.px} y1={ph.py}
                  x2={lx}    y2={ly}
                  stroke="#fa8c16"
                  strokeWidth={0.8}
                  strokeDasharray="3,3"
                  opacity={0.6}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

            {/* Хэндлы точек (синие) */}
            {pointHandles.map(({ label, px, py }) => {
              const isActive = activeHandle?.type === HANDLE_POINT && activeHandle?.label === label;
              return (
                <g
                  key={`pt-${label}`}
                  style={{ cursor: isActive ? 'grabbing' : 'grab' }}
                  onPointerDown={(e) => handlePointerDown(e, HANDLE_POINT, label, px, py)}
                >
                  {/* Зона захвата */}
                  <circle cx={px} cy={py} r={14} fill="transparent" />
                  {/* Маркер */}
                  <circle
                    cx={px} cy={py}
                    r={isActive ? 7 : 5}
                    fill={isActive ? 'rgba(24,144,255,0.5)' : 'rgba(24,144,255,0.25)'}
                    stroke="#1890ff"
                    strokeWidth={1.5}
                  />
                </g>
              );
            })}

            {/* Хэндлы подписей (оранжевые) */}
            {labelHandles.map(({ label, px, py, pointPx, pointPy }) => {
              const isActive = activeHandle?.type === HANDLE_LABEL && activeHandle?.label === label;
              return (
                <g
                  key={`lbl-${label}`}
                  style={{ cursor: isActive ? 'grabbing' : 'grab' }}
                  onPointerDown={(e) =>
                    handlePointerDown(e, HANDLE_LABEL, label, px, py, pointPx, pointPy)
                  }
                >
                  {/* Зона захвата */}
                  <circle cx={px} cy={py} r={14} fill="transparent" />
                  {/* Маркер */}
                  <circle
                    cx={px} cy={py}
                    r={isActive ? 7 : 5}
                    fill={isActive ? 'rgba(250,140,22,0.5)' : 'rgba(250,140,22,0.25)'}
                    stroke="#fa8c16"
                    strokeWidth={1.5}
                  />
                </g>
              );
            })}
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
