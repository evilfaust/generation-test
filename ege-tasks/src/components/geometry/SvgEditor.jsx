/**
 * SvgEditor — интерактивный редактор SVG-чертежа.
 *
 * Показывает SVG с наложенными drag-хэндлами над каждой видимой точкой.
 * При перетаскивании обновляет координаты в GeoGebra XML и перерисовывает SVG.
 * Геометрические зависимости (Midpoint, Intersection…) не пересчитываются —
 * зависимые точки можно перемещать независимо как визуальное смещение.
 *
 * Props:
 *   xmlString   {string}  — GeoGebra XML (источник истины для координат)
 *   svgString   {string}  — текущий SVG (будет обновляться при перемещениях)
 *   onSave      {(svg: string) => void}  — вызывается при нажатии «Применить»
 *   onCancel    {() => void}             — вызывается при «Отмена» / без сохранения
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Space, Typography } from 'antd';
import { DragOutlined } from '@ant-design/icons';
import { applyPointOverrides, ggbXmlToSvg, parseGgbPoints } from '../../utils/ggbToSvg';

const { Text } = Typography;

// Парсим viewBox из SVG-строки
function parseViewBox(svgStr) {
  const m = svgStr?.match(/viewBox="([^"]+)"/);
  if (!m) return null;
  const [x, y, w, h] = m[1].trim().split(/\s+/).map(Number);
  if ([x, y, w, h].some(isNaN)) return null;
  return { x, y, w, h };
}

export default function SvgEditor({ xmlString, svgString, onSave, onCancel }) {
  const [currentXml, setCurrentXml] = useState(xmlString);
  const [currentSvg, setCurrentSvg] = useState(svgString);

  // Точки с пиксельными позициями хэндлов
  const [handles, setHandles] = useState([]);
  const [coordSys, setCoordSys] = useState(null);
  const [viewBox, setViewBox] = useState(null);

  // ref на <div> с SVG (для вычисления масштаба экран→SVG)
  const containerRef = useRef(null);

  // Состояние активного drag (не в state — чтобы не вызывать ре-рендеры)
  const dragRef = useRef(null);
  // label точки, которую сейчас тащат (для подсветки)
  const [activeLabel, setActiveLabel] = useState(null);

  // ── Парсим точки при смене XML ───────────────────────────────────────────
  useEffect(() => {
    try {
      const { points, coordSys: cs } = parseGgbPoints(currentXml);
      setCoordSys(cs);
      setHandles(points.map((p) => ({ ...p })));
    } catch (err) {
      console.error('[SvgEditor] parseGgbPoints:', err);
    }
  }, [currentXml]);

  // ── Парсим viewBox при смене SVG ─────────────────────────────────────────
  useEffect(() => {
    setViewBox(parseViewBox(currentSvg));
  }, [currentSvg]);

  // ── Масштаб экран → SVG-пиксели ──────────────────────────────────────────
  const getScreenToSvgScale = useCallback(() => {
    if (!containerRef.current || !viewBox) return { sx: 1, sy: 1 };
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return { sx: 1, sy: 1 };
    return {
      sx: viewBox.w / rect.width,
      sy: viewBox.h / rect.height,
    };
  }, [viewBox]);

  // ── Pointer events (работают и мышью, и пальцем) ─────────────────────────
  const handlePointerDown = useCallback((e, label, px, py) => {
    e.preventDefault();
    e.stopPropagation();
    // setPointerCapture удерживает события даже при выходе за пределы элемента
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragRef.current = {
      label,
      startPx:      px,
      startPy:      py,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
    setActiveLabel(label);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const { label, startPx, startPy, startClientX, startClientY } = dragRef.current;
    const { sx, sy } = getScreenToSvgScale();
    const newPx = startPx + (e.clientX - startClientX) * sx;
    const newPy = startPy + (e.clientY - startClientY) * sy;
    // Двигаем только хэндл (быстро, без перерисовки SVG)
    setHandles((prev) =>
      prev.map((h) => (h.label === label ? { ...h, px: newPx, py: newPy } : h)),
    );
  }, [getScreenToSvgScale]);

  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current) return;
    const { label, startPx, startPy, startClientX, startClientY } = dragRef.current;
    dragRef.current = null;
    setActiveLabel(null);

    if (!coordSys) return;
    const { sx, sy } = getScreenToSvgScale();
    const finalPx = startPx + (e.clientX - startClientX) * sx;
    const finalPy = startPy + (e.clientY - startClientY) * sy;

    // SVG-пиксели → координаты GeoGebra
    const newX = (finalPx - coordSys.xZero) / coordSys.scale;
    const newY = (coordSys.yZero - finalPy) / coordSys.yscale;

    try {
      const newXml = applyPointOverrides(currentXml, { [label]: { x: newX, y: newY } });
      const newSvg = ggbXmlToSvg(newXml);
      setCurrentXml(newXml);
      setCurrentSvg(newSvg);
    } catch (err) {
      console.error('[SvgEditor] apply override error:', err);
    }
  }, [coordSys, getScreenToSvgScale, currentXml]);

  // ── Сброс к исходному состоянию ──────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCurrentXml(xmlString);
    setCurrentSvg(svgString);
  }, [xmlString, svgString]);

  // ── Рендер ────────────────────────────────────────────────────────────────
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {/* Холст: SVG + оверлей с хэндлами */}
      <div
        style={{
          position:   'relative',
          touchAction: 'none',     // отключаем системный скролл при drag пальцем
          userSelect:  'none',
          background:  '#ffffff',
          border:      '1px solid #d9d9d9',
          borderRadius: 8,
          overflow:    'hidden',
          cursor:      dragRef.current ? 'grabbing' : 'default',
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

        {/* Оверлей с drag-хэндлами */}
        {viewBox && handles.length > 0 && (
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
            {handles.map(({ label, px, py }) => {
              const isActive = label === activeLabel;
              return (
                <g
                  key={label}
                  style={{ cursor: isActive ? 'grabbing' : 'grab' }}
                  onPointerDown={(e) => handlePointerDown(e, label, px, py)}
                >
                  {/* Большая прозрачная зона для удобного захвата */}
                  <circle
                    cx={px} cy={py} r={12}
                    fill="transparent"
                  />
                  {/* Видимый маркер */}
                  <circle
                    cx={px} cy={py} r={isActive ? 7 : 5}
                    fill={isActive ? 'rgba(24,144,255,0.45)' : 'rgba(24,144,255,0.2)'}
                    stroke="#1890ff"
                    strokeWidth={1.5}
                  />
                  {/* Подпись рядом с маркером (маленькая, не перекрывает буквы чертежа) */}
                  <text
                    x={px + 9}
                    y={py - 8}
                    fontSize={10}
                    fontFamily="sans-serif"
                    fill="#1890ff"
                    style={{ pointerEvents: 'none' }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Подсказка */}
      <Space size={4}>
        <DragOutlined style={{ color: '#1890ff' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Перетащите синие маркеры для перемещения вершин.
          Зависимые точки (середины, пересечения) движутся независимо от родителей.
        </Text>
      </Space>

      {/* Кнопки */}
      <Space>
        <Button onClick={onCancel}>Отмена</Button>
        <Button onClick={handleReset}>Сбросить изменения</Button>
        <Button
          type="primary"
          onClick={() => onSave(currentSvg)}
        >
          Применить
        </Button>
      </Space>
    </Space>
  );
}
