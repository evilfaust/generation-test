import { useMemo, useState } from 'react';
import {
  Modal, Button, Space, Segmented, InputNumber, Input, Switch, Empty, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import NumberLineSVG from './NumberLineSVG';
import { shapesToSpec, pointsToSpec } from '../../utils/numberLine';

// Визуальный конструктор числовой прямой. Два типа:
//  • «Неравенства» — лучи/отрезки/точки со штриховкой (open/fill);
//  • «Точки на прямой» — линейка с целыми засечками + помеченные точки A,B,C,D.
// На каждый чих собираем DSL (shapesToSpec / pointsToSpec) и показываем живое
// превью. По «Вставить» отдаём готовый сниппет (блок или inline для таблиц).

// Координаты — строки: позволяют вводить дроби «1/2», «-3/4» наряду с «0.5», «2».
const SHAPE_DEFAULTS = {
  ray: { type: 'ray', dir: 'right', x: '1', filled: false },
  seg: { type: 'seg', a: '1', b: '2', ea: false, eb: false },
  point: { type: 'point', x: '0', filled: true },
};

// Готовый к вставке сниппет: блочный fenced (```numline) или inline-код
// (`numline: a; b`) — последний нужен для ячеек markdown-таблиц.
export function buildNumlineSnippet(spec, format) {
  if (format === 'inline') {
    return `\`numline: ${spec.replace(/\n/g, '; ')}\``;
  }
  return `\n\`\`\`numline\n${spec}\n\`\`\`\n`;
}

function ShapeRow({ shape, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...shape, ...delta });
  return (
    <Space wrap style={{ width: '100%', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee' }}>
      <Space wrap size={6}>
        {shape.type === 'ray' && (
          <>
            <span style={{ color: '#888' }}>Луч</span>
            <Segmented
              size="small"
              value={shape.dir}
              onChange={(dir) => patch({ dir })}
              options={[{ value: 'left', label: '← влево' }, { value: 'right', label: 'вправо →' }]}
            />
            <span style={{ color: '#888' }}>от</span>
            <Input size="small" style={{ width: 64 }} value={shape.x} onChange={(e) => patch({ x: e.target.value })} placeholder="1/2" />
            <Tooltip title="Закрашенная точка = нестрогое неравенство (≤/≥)">
              <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={shape.filled} onChange={(filled) => patch({ filled })} />
            </Tooltip>
          </>
        )}
        {shape.type === 'seg' && (
          <>
            <span style={{ color: '#888' }}>Отрезок</span>
            <Input size="small" style={{ width: 60 }} value={shape.a} onChange={(e) => patch({ a: e.target.value })} placeholder="1/2" />
            <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={shape.ea} onChange={(ea) => patch({ ea })} />
            <span style={{ color: '#888' }}>—</span>
            <Input size="small" style={{ width: 60 }} value={shape.b} onChange={(e) => patch({ b: e.target.value })} placeholder="2" />
            <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={shape.eb} onChange={(eb) => patch({ eb })} />
          </>
        )}
        {shape.type === 'point' && (
          <>
            <span style={{ color: '#888' }}>Точка</span>
            <Input size="small" style={{ width: 64 }} value={shape.x} onChange={(e) => patch({ x: e.target.value })} placeholder="1/2" />
            <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={shape.filled} onChange={(filled) => patch({ filled })} />
          </>
        )}
      </Space>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </Space>
  );
}

function MarkRow({ mark, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...mark, ...delta });
  return (
    <Space wrap style={{ width: '100%', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee' }}>
      <Space wrap size={6}>
        <span style={{ color: '#888' }}>Точка</span>
        <Input size="small" style={{ width: 60 }} value={mark.label} maxLength={3} onChange={(e) => patch({ label: e.target.value })} placeholder="A" />
        <span style={{ color: '#888' }}>в координате</span>
        <InputNumber size="small" step={0.1} style={{ width: 90 }} value={mark.x} onChange={(x) => patch({ x: x ?? 0 })} />
      </Space>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </Space>
  );
}

const DEFAULT_INTERVALS = { domain: [0, 3], shapes: [{ ...SHAPE_DEFAULTS.ray }] };
const DEFAULT_POINTS = {
  scale: { from: -1, to: 5, step: 1 },
  marks: [{ label: 'A', x: 0 }, { label: 'B', x: 2 }],
};

export default function NumberLineModal({ open, onCancel, onInsert, defaultFormat = 'block' }) {
  const [kind, setKind] = useState('intervals'); // 'intervals' | 'points'
  const [axisLabel, setAxisLabel] = useState('x');
  const [format, setFormat] = useState(defaultFormat);

  // тип «Неравенства»
  const [domain, setDomain] = useState(DEFAULT_INTERVALS.domain);
  const [shapes, setShapes] = useState(DEFAULT_INTERVALS.shapes);

  // тип «Точки на прямой»
  const [scale, setScale] = useState(DEFAULT_POINTS.scale);
  const [marks, setMarks] = useState(DEFAULT_POINTS.marks);

  const spec = useMemo(() => (
    kind === 'points'
      ? pointsToSpec({ scale, marks, axisLabel })
      : shapesToSpec({ domain, shapes, axisLabel })
  ), [kind, scale, marks, domain, shapes, axisLabel]);

  const addShape = (type) => setShapes((arr) => [...arr, { ...SHAPE_DEFAULTS[type] }]);
  const updateShape = (i, next) => setShapes((arr) => arr.map((s, idx) => (idx === i ? next : s)));
  const removeShape = (i) => setShapes((arr) => arr.filter((_, idx) => idx !== i));

  const addMark = () => setMarks((arr) => [...arr, { label: '', x: 0 }]);
  const updateMark = (i, next) => setMarks((arr) => arr.map((m, idx) => (idx === i ? next : m)));
  const removeMark = (i) => setMarks((arr) => arr.filter((_, idx) => idx !== i));

  const handleInsert = () => {
    onInsert(buildNumlineSnippet(spec, format));
    // сброс к дефолту для следующего вызова
    setKind('intervals');
    setAxisLabel('x');
    setFormat(defaultFormat);
    setDomain(DEFAULT_INTERVALS.domain);
    setShapes([{ ...SHAPE_DEFAULTS.ray }]);
    setScale(DEFAULT_POINTS.scale);
    setMarks([{ label: 'A', x: 0 }, { label: 'B', x: 2 }]);
  };

  return (
    <Modal
      title="Числовая прямая"
      open={open}
      onCancel={onCancel}
      onOk={handleInsert}
      okText="Вставить"
      cancelText="Отмена"
      width={580}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Тип прямой */}
        <Segmented
          block
          value={kind}
          onChange={setKind}
          options={[
            { value: 'intervals', label: 'Неравенства (штриховка)' },
            { value: 'points', label: 'Точки на прямой' },
          ]}
        />

        {/* Превью */}
        <div style={{ textAlign: 'center', padding: '10px 8px', background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
          <NumberLineSVG spec={spec} />
        </div>

        {/* Буква оси */}
        <Space>
          <span style={{ color: '#888' }}>Буква оси:</span>
          <Input size="small" style={{ width: 64 }} value={axisLabel} maxLength={4} onChange={(e) => setAxisLabel(e.target.value || 'x')} placeholder="x" />
          <span style={{ color: '#bbb' }}>(x, y, t, n…)</span>
        </Space>

        {kind === 'intervals' ? (
          <>
            {/* Диапазон оси */}
            <Space>
              <span style={{ color: '#888' }}>Диапазон оси:</span>
              <InputNumber size="small" style={{ width: 80 }} value={domain[0]} onChange={(v) => setDomain([v ?? 0, domain[1]])} />
              <span>…</span>
              <InputNumber size="small" style={{ width: 80 }} value={domain[1]} onChange={(v) => setDomain([domain[0], v ?? 1])} />
            </Space>

            {/* Список фигур */}
            <div>
              {shapes.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Добавьте луч, отрезок или точку" />
              ) : (
                shapes.map((s, i) => (
                  <ShapeRow key={i} shape={s} onChange={(next) => updateShape(i, next)} onRemove={() => removeShape(i)} />
                ))
              )}
            </div>

            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addShape('ray')}>Луч</Button>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addShape('seg')}>Отрезок</Button>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addShape('point')}>Точка</Button>
            </Space>
            <span style={{ color: '#bbb', fontSize: 12 }}>В координате можно вводить дроби: 1/2, -3/4 (отрисуются дробью под осью)</span>
          </>
        ) : (
          <>
            {/* Линейка (засечки с числами) */}
            <Space wrap>
              <span style={{ color: '#888' }}>Засечки:</span>
              <InputNumber size="small" style={{ width: 72 }} value={scale.from} onChange={(v) => setScale((s) => ({ ...s, from: v ?? 0 }))} />
              <span>…</span>
              <InputNumber size="small" style={{ width: 72 }} value={scale.to} onChange={(v) => setScale((s) => ({ ...s, to: v ?? 1 }))} />
              <span style={{ color: '#888' }}>шаг</span>
              <InputNumber size="small" min={0.1} style={{ width: 64 }} value={scale.step} onChange={(v) => setScale((s) => ({ ...s, step: v ?? 1 }))} />
            </Space>

            {/* Помеченные точки */}
            <div>
              {marks.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Добавьте помеченную точку" />
              ) : (
                marks.map((m, i) => (
                  <MarkRow key={i} mark={m} onChange={(next) => updateMark(i, next)} onRemove={() => removeMark(i)} />
                ))
              )}
            </div>

            <Button size="small" icon={<PlusOutlined />} onClick={addMark}>Точка (A, B, …)</Button>
          </>
        )}

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
          <Tooltip title="«В строку» — компактный код `numline: …`, который можно вставлять прямо в ячейку markdown-таблицы. «Блоком» — крупная прямая на всю ширину.">
            <span style={{ color: '#bbb', cursor: 'help' }}>?</span>
          </Tooltip>
        </Space>
      </div>
    </Modal>
  );
}
