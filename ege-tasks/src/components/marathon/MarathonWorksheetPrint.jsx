import { useMemo, useState } from 'react';
import { Button, Card, Segmented, Space, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import './MarathonWorksheetPrint.css';

const { Text } = Typography;

const LAYOUT_OPTIONS = [
  { value: '2a4', label: '2 / A4', count: 2 },
  { value: '3a4', label: '3 / A4', count: 3 },
  { value: '4a4', label: '4 / A4', count: 4 },
  { value: '5a4', label: '5 / A4', count: 5 },
];

// Максимальная высота области условия (только текст — чертёж теперь на клетке)
const CONTENT_MAX_H = {
  '2a4': '40mm',
  '3a4': '26mm',
  '4a4': '18mm',
  '5a4': '14mm',
};

// Размер чертежа на клетке: ширина (%) и max-height per layout
const DRAWING_SIZE_CFG = {
  s:  { w: '28%', h: { '2a4': '50mm',  '3a4': '30mm', '4a4': '22mm', '5a4': '16mm' } },
  m:  { w: '42%', h: { '2a4': '70mm',  '3a4': '44mm', '4a4': '32mm', '5a4': '24mm' } },
  l:  { w: '58%', h: { '2a4': '95mm',  '3a4': '60mm', '4a4': '43mm', '5a4': '32mm' } },
  xl: { w: '74%', h: { '2a4': '125mm', '3a4': '78mm', '4a4': '56mm', '5a4': '42mm' } },
};

// Размеры шрифта условия задачи
const TEXT_SIZE_CFG = {
  s: { fontSize: '3mm',   numSize: '3mm'   },
  m: { fontSize: '3.8mm', numSize: '3.8mm' },
  l: { fontSize: '4.5mm', numSize: '4.5mm' },
};

// Сколько линий клетки рендерить per layout (с запасом, лишние клипуются)
const GRID_LINES_BY_LAYOUT = {
  '2a4': { h: 30, v: 42 },
  '3a4': { h: 22, v: 42 },
  '4a4': { h: 16, v: 42 },
  '5a4': { h: 13, v: 42 },
};

// ── Линия разреза ─────────────────────────────────────────────────────────────

function CutLine() {
  return (
    <div className="mwsp-cut-line">
      <div className="mwsp-cut-dash" />
      <span className="mwsp-cut-icon">✂</span>
      <div className="mwsp-cut-dash" />
    </div>
  );
}

// ── Один блок задачи ──────────────────────────────────────────────────────────

function WorksheetBlock({ task, index, layoutKey, attemptsCount, textSize, drawingSize }) {
  const imageUrl    = api.getTaskImageUrl(task);
  const contentMaxH = CONTENT_MAX_H[layoutKey] ?? '26mm';
  const dcfg        = DRAWING_SIZE_CFG[drawingSize] ?? DRAWING_SIZE_CFG.m;
  const imgMaxH     = dcfg.h[layoutKey] ?? dcfg.h['3a4'];
  const tcfg        = TEXT_SIZE_CFG[textSize] ?? TEXT_SIZE_CFG.s;
  const lines       = GRID_LINES_BY_LAYOUT[layoutKey] ?? GRID_LINES_BY_LAYOUT['3a4'];

  return (
    <div className="mwsp-block">
      {/* Шапка: ФИ + квадратики */}
      <div className="mwsp-header">
        <div className="mwsp-name-area">
          <span className="mwsp-name-label">ФИ</span>
          <div className="mwsp-name-line" />
        </div>
        <div className="mwsp-attempts">
          {Array.from({ length: attemptsCount }, (_, i) => (
            <div key={i} className="mwsp-attempt-unit">
              <span className="mwsp-attempt-n">{i + 1}</span>
              <div className="mwsp-attempt-box" />
            </div>
          ))}
        </div>
      </div>

      {/* Условие: №N + текст */}
      <div className="mwsp-content" style={{ maxHeight: contentMaxH }}>
        <span className="mwsp-task-num" style={{ fontSize: tcfg.numSize }}>
          №{index + 1}
        </span>
        <div className="mwsp-task-text" style={{ fontSize: tcfg.fontSize }}>
          <MathRenderer content={task.statement_md || ''} />
        </div>
      </div>

      {/* Клетка; чертёж поверх в левом верхнем углу.
          Линии — обычные div'ы с физическими mm-позициями и pt-толщиной.
          Печатаются как нативные PDF-векторы → идеальное качество. */}
      <div className="mwsp-grid">
        {imageUrl && (
          <div className="mwsp-grid-drawing" style={{ maxWidth: dcfg.w }}>
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              className="mwsp-grid-drawing-img"
              style={{ maxHeight: imgMaxH }}
            />
          </div>
        )}
        {/* Горизонтальные линии каждые 5 мм */}
        {Array.from({ length: lines.h }, (_, i) => (
          <div
            key={`h-${i}`}
            className="mwsp-h-line"
            style={{ top: `${(i + 1) * 5}mm` }}
          />
        ))}
        {/* Вертикальные линии каждые 5 мм */}
        {Array.from({ length: lines.v }, (_, i) => (
          <div
            key={`v-${i}`}
            className="mwsp-v-line"
            style={{ left: `${(i + 1) * 5}mm` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Один лист A4 ──────────────────────────────────────────────────────────────

function WorksheetSheet({ sheetTasks, startIndex, layoutKey, attemptsCount, textSize, drawingSize }) {
  const layoutOpt  = LAYOUT_OPTIONS.find((o) => o.value === layoutKey) ?? LAYOUT_OPTIONS[1];
  const emptyCount = layoutOpt.count - sheetTasks.length;
  const allBlocks  = [
    ...sheetTasks.map((task, i) => ({ task, index: startIndex + i, empty: false })),
    ...Array.from({ length: emptyCount }, (_, i) => ({ task: null, index: -1, empty: true, key: `empty-${i}` })),
  ];

  return (
    <div className="mwsp-sheet">
      {allBlocks.map((item, pos) => (
        <div key={item.empty ? item.key : item.task.id} className="mwsp-slot">
          {pos > 0 && <CutLine />}
          {item.empty ? (
            <div className="mwsp-block mwsp-block--empty" />
          ) : (
            <WorksheetBlock
              task={item.task}
              index={item.index}
              layoutKey={layoutKey}
              attemptsCount={attemptsCount}
              textSize={textSize}
              drawingSize={drawingSize}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────

export default function MarathonWorksheetPrint({ tasks, title, onBack }) {
  const [layoutKey,     setLayoutKey]     = useState('3a4');
  const [attemptsCount, setAttemptsCount] = useState(2);
  const [textSize,      setTextSize]      = useState('s');
  const [drawingSize,   setDrawingSize]   = useState('m');

  const layoutOpt = LAYOUT_OPTIONS.find((o) => o.value === layoutKey) ?? LAYOUT_OPTIONS[1];

  const handlePrint = () => {
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1500);
  };

  const sheets = useMemo(() => {
    const count = layoutOpt.count;
    const result = [];
    for (let i = 0; i < tasks.length; i += count) {
      result.push({ sheetTasks: tasks.slice(i, i + count), startIndex: i });
    }
    return result;
  }, [tasks, layoutOpt.count]);

  const sheetsWord = sheets.length === 1 ? 'лист' : sheets.length < 5 ? 'листа' : 'листов';

  return (
    <div className="mwsp-root">
      {/* Панель управления */}
      <div className="mwsp-toolbar">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <Text type="secondary">
            Рабочий лист · {tasks.length} задач · {sheets.length} {sheetsWord}
          </Text>
        </Space>
        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
          Печать
        </Button>
      </div>

      {/* Настройки */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={16}>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Задач на листе:</Text>
            <Segmented
              size="small"
              value={layoutKey}
              onChange={setLayoutKey}
              options={LAYOUT_OPTIONS}
            />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Попыток:</Text>
            <Segmented
              size="small"
              value={attemptsCount}
              onChange={setAttemptsCount}
              options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
            />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Размер текста:</Text>
            <Segmented
              size="small"
              value={textSize}
              onChange={setTextSize}
              options={[
                { label: 'S', value: 's' },
                { label: 'M', value: 'm' },
                { label: 'L', value: 'l' },
              ]}
            />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Размер чертежа:</Text>
            <Segmented
              size="small"
              value={drawingSize}
              onChange={setDrawingSize}
              options={[
                { label: 'S',  value: 's'  },
                { label: 'M',  value: 'm'  },
                { label: 'L',  value: 'l'  },
                { label: 'XL', value: 'xl' },
              ]}
            />
          </Space>
        </Space>
      </Card>

      {/* Листы */}
      <div className="mwsp-pages">
        {sheets.map((sheet, i) => (
          <WorksheetSheet
            key={i}
            sheetTasks={sheet.sheetTasks}
            startIndex={sheet.startIndex}
            layoutKey={layoutKey}
            attemptsCount={attemptsCount}
            textSize={textSize}
            drawingSize={drawingSize}
          />
        ))}
      </div>
    </div>
  );
}
