import { useMemo, useState } from 'react';
import {
  Modal, Button, Space, Segmented, InputNumber, Input, Select, Switch, Empty, Tooltip, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import CoordPlotSVG from './CoordPlotSVG';
import { plotToSpec, compileExpr, PLOT_COLORS } from '../../utils/coordPlot';

// Визуальный конструктор координатной плоскости. Два режима:
//  • «График функции» — формула y = f(x) (можно несколько кривых);
//  • «Векторы» — стрелки на клетчатой плоскости с подписями a, b, …
// Окно/клетка/точки общие для обоих режимов. На каждый чих собираем DSL
// (plotToSpec) и показываем живое превью. По «Вставить» отдаём готовый сниппет.

const COLOR_LABEL = {
  ink: 'чёрный', orange: 'оранжевый', blue: 'синий', green: 'зелёный',
  red: 'красный', violet: 'фиолетовый', gray: 'серый',
};
const COLOR_OPTIONS = PLOT_COLORS.map((c) => ({ value: c, label: COLOR_LABEL[c] || c }));

// Шаблоны формул — вставляют готовую кривую, коэффициенты правятся прямо в поле.
const TEMPLATES = [
  { label: 'Прямая', expr: '2x+1' },
  { label: 'Парабола', expr: 'x^2-4' },
  { label: 'Гипербола', expr: '2/x' },
  { label: 'Показательная', expr: '2^x' },
  { label: 'Логарифм', expr: 'log(2,x)' },
  { label: 'Корень', expr: 'sqrt(x)' },
  { label: 'Модуль', expr: 'abs(x)' },
  { label: 'Синус', expr: 'sin(x)' },
];

const SIZE_OPTIONS = [
  { value: 220, label: 'S' },
  { value: 280, label: 'M' },
  { value: 360, label: 'L' },
];

const DEFAULT_VIEW = { xrange: [-5, 5], yrange: [-5, 5], grid: 1, axisX: 'x', axisY: 'y', units: true, width: 280 };
const DEFAULT_CURVES = [{ expr: 'x^2-4', color: 'ink', from: '', to: '', dash: false }];
const DEFAULT_VECTORS = [{ label: 'a', x1: 0, y1: 0, x2: 3, y2: 2, color: 'ink', side: 'left' }];

// Готовый к вставке сниппет: блочный fenced (```plot) или inline-код
// (`plot: a; b`) — последний нужен для ячеек markdown-таблиц.
export function buildPlotSnippet(spec, format) {
  if (format === 'inline') {
    return `\`plot: ${spec.replace(/\n/g, '; ')}\``;
  }
  return `\n\`\`\`plot\n${spec}\n\`\`\`\n`;
}

const rowStyle = { width: '100%', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee' };

function CurveRow({ curve, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...curve, ...delta });
  const { error } = useMemo(() => compileExpr(curve.expr), [curve.expr]);
  return (
    <div style={{ borderBottom: '1px dashed #eee', padding: '6px 0' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap size={6}>
          <span style={{ color: '#888' }}>y =</span>
          <Input
            size="small"
            style={{ width: 180 }}
            value={curve.expr}
            onChange={(e) => patch({ expr: e.target.value })}
            placeholder="x^2-4"
            status={error ? 'error' : ''}
          />
          <Select size="small" style={{ width: 118 }} value={curve.color} onChange={(color) => patch({ color })} options={COLOR_OPTIONS} />
          <Tooltip title="Пунктиром">
            <Switch size="small" checkedChildren="- -" unCheckedChildren="—" checked={!!curve.dash} onChange={(dash) => patch({ dash })} />
          </Tooltip>
          <Tooltip title="Рисовать только на части оси X (пусто — на всём окне)">
            <Space size={4}>
              <span style={{ color: '#bbb' }}>от</span>
              <Input size="small" style={{ width: 52 }} value={curve.from} onChange={(e) => patch({ from: e.target.value })} placeholder="—" />
              <span style={{ color: '#bbb' }}>до</span>
              <Input size="small" style={{ width: 52 }} value={curve.to} onChange={(e) => patch({ to: e.target.value })} placeholder="—" />
            </Space>
          </Tooltip>
        </Space>
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
      </Space>
      {error && <div style={{ color: '#cf1322', fontSize: 12 }}>{error}</div>}
    </div>
  );
}

function VectorRow({ vec, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...vec, ...delta });
  const numProps = { size: 'small', step: 1, style: { width: 62 } };
  return (
    <Space wrap style={rowStyle}>
      <Space wrap size={6}>
        <Input size="small" style={{ width: 46 }} maxLength={3} value={vec.label} onChange={(e) => patch({ label: e.target.value })} placeholder="a" />
        <span style={{ color: '#888' }}>из</span>
        <InputNumber {...numProps} value={vec.x1} onChange={(v) => patch({ x1: v ?? 0 })} />
        <InputNumber {...numProps} value={vec.y1} onChange={(v) => patch({ y1: v ?? 0 })} />
        <span style={{ color: '#888' }}>в</span>
        <InputNumber {...numProps} value={vec.x2} onChange={(v) => patch({ x2: v ?? 0 })} />
        <InputNumber {...numProps} value={vec.y2} onChange={(v) => patch({ y2: v ?? 0 })} />
        <Select size="small" style={{ width: 112 }} value={vec.color} onChange={(color) => patch({ color })} options={COLOR_OPTIONS} />
        <Tooltip title="С какой стороны от стрелки стоит подпись">
          <Segmented
            size="small"
            value={vec.side || 'left'}
            onChange={(side) => patch({ side })}
            options={[{ value: 'left', label: 'подпись слева' }, { value: 'right', label: 'справа' }]}
          />
        </Tooltip>
      </Space>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </Space>
  );
}

function PointRow({ point, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...point, ...delta });
  const numProps = { size: 'small', step: 1, style: { width: 62 } };
  return (
    <Space wrap style={rowStyle}>
      <Space wrap size={6}>
        <span style={{ color: '#888' }}>Точка</span>
        <InputNumber {...numProps} value={point.x} onChange={(v) => patch({ x: v ?? 0 })} />
        <InputNumber {...numProps} value={point.y} onChange={(v) => patch({ y: v ?? 0 })} />
        <Tooltip title="Закрашенная / выколотая">
          <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={point.filled !== false} onChange={(filled) => patch({ filled })} />
        </Tooltip>
        <Input size="small" style={{ width: 56 }} maxLength={4} value={point.label} onChange={(e) => patch({ label: e.target.value })} placeholder="подпись" />
        <Select size="small" style={{ width: 112 }} value={point.color} onChange={(color) => patch({ color })} options={COLOR_OPTIONS} />
      </Space>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </Space>
  );
}

export default function PlotModal({ open, onCancel, onInsert, kind = 'function', defaultFormat = 'block' }) {
  const [mode, setMode] = useState(kind);
  const [format, setFormat] = useState(defaultFormat);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [curves, setCurves] = useState(DEFAULT_CURVES);
  const [vectors, setVectors] = useState(DEFAULT_VECTORS);
  const [points, setPoints] = useState([]);

  // Открытие модала под конкретную кнопку («График» / «Векторы»).
  const [lastKind, setLastKind] = useState(kind);
  if (open && kind !== lastKind) { setLastKind(kind); setMode(kind); }

  const patchView = (delta) => setView((v) => ({ ...v, ...delta }));

  const spec = useMemo(() => plotToSpec({
    view,
    curves: mode === 'function' ? curves : [],
    vectors: mode === 'vectors' ? vectors : [],
    points,
  }), [view, mode, curves, vectors, points]);

  const addCurve = (expr = 'x') => setCurves((arr) => [...arr, { expr, color: 'ink', from: '', to: '', dash: false }]);
  const addVector = () => setVectors((arr) => [
    ...arr,
    { label: String.fromCharCode(97 + arr.length), x1: 0, y1: 0, x2: 2, y2: 3, color: 'ink', side: 'left' },
  ]);
  const addPoint = () => setPoints((arr) => [...arr, { x: 1, y: 1, filled: true, label: '', color: 'ink' }]);
  const upd = (setter) => (i, next) => setter((arr) => arr.map((it, idx) => (idx === i ? next : it)));
  const del = (setter) => (i) => setter((arr) => arr.filter((_, idx) => idx !== i));

  const handleInsert = () => {
    onInsert(buildPlotSnippet(spec, format));
    // сброс к дефолту для следующего вызова
    setView(DEFAULT_VIEW);
    setCurves(DEFAULT_CURVES);
    setVectors(DEFAULT_VECTORS);
    setPoints([]);
    setFormat(defaultFormat);
  };

  return (
    <Modal
      title={mode === 'vectors' ? 'Векторы на плоскости' : 'График функции'}
      open={open}
      onCancel={onCancel}
      onOk={handleInsert}
      okText="Вставить"
      cancelText="Отмена"
      width={700}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Segmented
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: 'function', label: 'График функции' },
            { value: 'vectors', label: 'Векторы' },
          ]}
        />

        {/* Превью */}
        <div style={{ textAlign: 'center', padding: '10px 8px', background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
          <CoordPlotSVG spec={spec} />
        </div>

        {/* Окно и клетка */}
        <Space wrap size={8}>
          <span style={{ color: '#888' }}>X от</span>
          <InputNumber size="small" style={{ width: 70 }} value={view.xrange[0]} onChange={(v) => patchView({ xrange: [v ?? -5, view.xrange[1]] })} />
          <span style={{ color: '#888' }}>до</span>
          <InputNumber size="small" style={{ width: 70 }} value={view.xrange[1]} onChange={(v) => patchView({ xrange: [view.xrange[0], v ?? 5] })} />
          <span style={{ color: '#888', marginLeft: 8 }}>Y от</span>
          <InputNumber size="small" style={{ width: 70 }} value={view.yrange[0]} onChange={(v) => patchView({ yrange: [v ?? -5, view.yrange[1]] })} />
          <span style={{ color: '#888' }}>до</span>
          <InputNumber size="small" style={{ width: 70 }} value={view.yrange[1]} onChange={(v) => patchView({ yrange: [view.yrange[0], v ?? 5] })} />
        </Space>
        <Space wrap size={8}>
          <span style={{ color: '#888' }}>Клетка</span>
          <InputNumber size="small" min={0} step={0.5} style={{ width: 70 }} value={view.grid} onChange={(v) => patchView({ grid: v ?? 1 })} />
          <span style={{ color: '#888', marginLeft: 8 }}>Размер</span>
          <Segmented size="small" value={view.width} onChange={(w) => patchView({ width: w })} options={SIZE_OPTIONS} />
          <span style={{ color: '#888', marginLeft: 8 }}>Оси</span>
          <Input size="small" style={{ width: 48 }} maxLength={3} value={view.axisX} onChange={(e) => patchView({ axisX: e.target.value || 'x' })} />
          <Input size="small" style={{ width: 48 }} maxLength={3} value={view.axisY} onChange={(e) => patchView({ axisY: e.target.value || 'y' })} />
          <Tooltip title="Подписывать единичный отрезок «1» и начало координат O">
            <Switch size="small" checked={view.units !== false} onChange={(units) => patchView({ units })} />
          </Tooltip>
        </Space>

        {mode === 'function' ? (
          <>
            <div>
              {curves.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Добавьте формулу" />
              ) : (
                curves.map((c, i) => (
                  <CurveRow key={i} curve={c} onChange={(next) => upd(setCurves)(i, next)} onRemove={() => del(setCurves)(i)} />
                ))
              )}
            </div>
            <Space wrap size={4}>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addCurve('x')}>Формула</Button>
              <span style={{ color: '#bbb', margin: '0 4px' }}>шаблоны:</span>
              {TEMPLATES.map((t) => (
                <Button key={t.label} size="small" type="dashed" onClick={() => addCurve(t.expr)}>{t.label}</Button>
              ))}
            </Space>
            <Alert
              type="info"
              showIcon={false}
              banner
              message={(
                <span style={{ fontSize: 12 }}>
                  Можно писать: <code>2x+1</code>, <code>x^2-4</code>, <code>1/x</code>, <code>2^x</code>,{' '}
                  <code>sqrt(x-1)</code>, <code>abs(x)</code>, <code>sin(x)</code>, <code>ln(x)</code>,{' '}
                  <code>lg(x)</code>, <code>log(2,x)</code>. Дробные числа — через точку или запятую.
                </span>
              )}
            />
          </>
        ) : (
          <>
            <div>
              {vectors.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Добавьте вектор" />
              ) : (
                vectors.map((v, i) => (
                  <VectorRow key={i} vec={v} onChange={(next) => upd(setVectors)(i, next)} onRemove={() => del(setVectors)(i)} />
                ))
              )}
            </div>
            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={addVector}>Вектор</Button>
              <span style={{ color: '#bbb', fontSize: 12 }}>Подпись рисуется со стрелочкой сверху, как $\vec a$</span>
            </Space>
          </>
        )}

        {/* Точки — общие для обоих режимов */}
        <div>
          {points.map((p, i) => (
            <PointRow key={i} point={p} onChange={(next) => upd(setPoints)(i, next)} onRemove={() => del(setPoints)(i)} />
          ))}
        </div>
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={addPoint}>Точка</Button>
        </Space>

        {/* Формат вставки */}
        <Space align="center">
          <span style={{ color: '#888' }}>Формат:</span>
          <Segmented
            size="small"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'block', label: 'Отдельным блоком' },
              { value: 'inline', label: 'В строку (для таблиц)' },
            ]}
          />
          <Tooltip title="«В строку» — компактный код `plot: …`, который можно вставлять прямо в ячейку markdown-таблицы. «Блоком» — картинка на отдельной строке.">
            <span style={{ color: '#bbb', cursor: 'help' }}>?</span>
          </Tooltip>
        </Space>
      </div>
    </Modal>
  );
}
