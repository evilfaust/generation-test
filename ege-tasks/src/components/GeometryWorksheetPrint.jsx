import { useMemo, useState } from 'react';
import { Button, Card, Input, Segmented, Space, Switch, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import MathRenderer from './MathRenderer';
import './GeometryWorksheetPrint.css';

const { Text } = Typography;

const TEXT_SIZE_CFG = {
  s: { statement: '3.2mm', badge: '3.2mm' },
  m: { statement: '3.8mm', badge: '3.8mm' },
  l: { statement: '4.5mm', badge: '4.5mm' },
};

// Вычисляет число линий клетки по фактическому кол-ву задач на листе.
// Лишние линии безопасно клипуются overflow:hidden.
// PAGE_H — высота контентной области: A4=289mm, A5=200mm
// v-линии фиксированы по ширине страницы
function calcGridLines(actualTaskCount, isA4) {
  const pageH = isA4 ? 289 : 200;
  const pageW = isA4 ? 202 : 138;
  const h = Math.ceil(pageH / (Math.max(actualTaskCount, 1) * 5)) + 4;
  const v = Math.ceil(pageW / 5) + 2;
  return { h, v };
}

// Варианты раскладки: id, метка, кол-во задач, формат печати
const LAYOUT_OPTIONS = [
  { value: '1a4', label: '1 / A4', count: 1, isA4: true  },
  { value: '2a5', label: '2 / A5', count: 2, isA4: false },
  { value: '2a4', label: '2 / A4', count: 2, isA4: true  },
  { value: '3a4', label: '3 / A4', count: 3, isA4: true  },
  { value: '4a4', label: '4 / A4', count: 4, isA4: true  },
  { value: '5a4', label: '5 / A4', count: 5, isA4: true  },
];

/**
 * Размеры чертежей: ширина контейнера (%) и max-height (mm) для каждого
 * сочетания drawingSize × layoutKey.
 */
const DRAWING_SIZE_CFG = {
  s:  { w: '26%', h: { '1a4': '55mm',  '2a5': '33mm', '2a4': '45mm', '3a4': '27mm', '4a4': '19mm', '5a4': '14mm' } },
  m:  { w: '42%', h: { '1a4': '90mm',  '2a5': '55mm', '2a4': '75mm', '3a4': '45mm', '4a4': '32mm', '5a4': '25mm' } },
  l:  { w: '56%', h: { '1a4': '130mm', '2a5': '80mm', '2a4': '110mm', '3a4': '65mm', '4a4': '46mm', '5a4': '35mm' } },
  xl: { w: '70%', h: { '1a4': '180mm', '2a5': '110mm', '2a4': '155mm', '3a4': '88mm', '4a4': '61mm', '5a4': '46mm' } },
};

// ── Одна задача ───────────────────────────────────────────────────────────────

function WorksheetTask({ task, index, showDrawing, drawingSize, layoutKey, textSize, sheetTasksCount, isA4 }) {
  const imageUrl = api.getGeometryImageUrl(task);
  const hasSvg   = task.drawing_view === 'svg' && !!task.drawing_svg;
  const hasImage = !!imageUrl && !hasSvg;

  const dcfg  = DRAWING_SIZE_CFG[drawingSize] ?? DRAWING_SIZE_CFG.m;
  const maxH  = dcfg.h[layoutKey] ?? dcfg.h['2a5'];
  const drawingStyle = { maxWidth: dcfg.w, maxHeight: maxH };
  const imgStyle     = { maxHeight: maxH };

  const tcfg  = TEXT_SIZE_CFG[textSize] ?? TEXT_SIZE_CFG.s;
  // Считаем по фактическому числу задач на листе — последний лист может быть неполным
  const lines = calcGridLines(sheetTasksCount, isA4);

  return (
    <div className="geo-worksheet-task">
      <div className="geo-worksheet-task-header">
        <span className="geo-worksheet-task-badge" style={{ fontSize: tcfg.badge }}>№{index + 1}</span>
        <div className="geo-worksheet-task-statement" style={{ fontSize: tcfg.statement }}>
          {task.statement_md ? (
            <MathRenderer text={task.statement_md} />
          ) : (
            <Text type="secondary" style={{ fontSize: tcfg.statement }}>Условие не задано</Text>
          )}
        </div>
      </div>

      <div className="geo-worksheet-task-body">
        {/* Клетка: div-линии с физическими mm/pt-единицами → нативные векторы в PDF */}
        <div className="geo-worksheet-task-grid">
          {Array.from({ length: lines.h }, (_, i) => (
            <div key={`h-${i}`} className="geo-worksheet-h-line" style={{ top: `${(i + 1) * 5}mm` }} />
          ))}
          {Array.from({ length: lines.v }, (_, i) => (
            <div key={`v-${i}`} className="geo-worksheet-v-line" style={{ left: `${(i + 1) * 5}mm` }} />
          ))}
        </div>

        {showDrawing && hasSvg && (
          <div className="geo-worksheet-task-drawing" style={drawingStyle}>
            <div dangerouslySetInnerHTML={{ __html: task.drawing_svg }} style={{ lineHeight: 0 }} />
          </div>
        )}
        {showDrawing && hasImage && (
          <div className="geo-worksheet-task-drawing" style={drawingStyle}>
            <img src={imageUrl} alt={`Чертёж ${task.code || ''}`} style={imgStyle} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Один лист ─────────────────────────────────────────────────────────────────

function WorksheetSheet({
  sheetTasks,
  startIndex,
  topicLabel,
  variantLabel,
  showFields,
  showDrawing,
  isFirstSheet,
  layoutKey,
  tasksCount,
  isA4,
  drawingSize,
  textSize,
}) {
  const showPrimaryHeader = isFirstSheet;
  const showCompactTitle = !isFirstSheet && topicLabel;

  const sheetClass = [
    'geo-worksheet-sheet',
    isA4 ? 'geo-worksheet-sheet--a4' : '',
    tasksCount === 4 ? 'geo-worksheet-sheet--4' : '',
    tasksCount === 5 ? 'geo-worksheet-sheet--5' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={sheetClass}>
      {showPrimaryHeader && (
        <div className="geo-worksheet-header">
          <span className="geo-worksheet-header-topic">{topicLabel || 'Геометрия'}</span>
          {variantLabel && <span className="geo-worksheet-header-part">{variantLabel}</span>}
        </div>
      )}

      {showCompactTitle && (
        <div className="geo-worksheet-header-compact">
          <span className="geo-worksheet-header-topic">{topicLabel}</span>
        </div>
      )}

      {showPrimaryHeader && showFields && (
        <div className="geo-worksheet-fields">
          {['Фамилия Имя', 'Дата'].map((label) => (
            <div key={label} className="geo-worksheet-field">
              <span className="geo-worksheet-field-label">{label}</span>
              <div className="geo-worksheet-field-line" />
            </div>
          ))}
        </div>
      )}

      {sheetTasks.map((task, i) => (
        <>
          {i > 0 && <div key={`div-${task.id}`} className="geo-worksheet-divider" />}
          <WorksheetTask
            key={task.id}
            task={task}
            index={startIndex + i}
            showDrawing={showDrawing}
            drawingSize={drawingSize}
            layoutKey={layoutKey}
            textSize={textSize}
            sheetTasksCount={sheetTasks.length}
            isA4={isA4}
          />
        </>
      ))}
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────

export default function GeometryWorksheetPrint({
  tasks,
  onBack,
  initialTopicLabel = '',
  initialVariantLabel = '',
}) {
  const [topicLabel, setTopicLabel] = useState(initialTopicLabel);
  const [variantLabel, setVariantLabel] = useState(initialVariantLabel);
  const [showFields, setShowFields] = useState(true);
  const [showDrawing, setShowDrawing] = useState(true);
  const [layoutKey, setLayoutKey] = useState('2a5');
  const [drawingSize, setDrawingSize] = useState('m');
  const [textSize, setTextSize] = useState('s');

  const layoutOpt = LAYOUT_OPTIONS.find((o) => o.value === layoutKey) ?? LAYOUT_OPTIONS[1];

  const handlePrint = () => {
    const size = layoutOpt.isA4 ? 'A4 portrait' : 'A5 portrait';
    const style = document.createElement('style');
    style.textContent = `@page { size: ${size}; margin: 0; }`;
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
    <div className="geo-worksheet-root">
      {/* ── Панель управления ── */}
      <div className="geo-worksheet-toolbar">
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

      {/* ── Настройки ── */}
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
            <Text style={{ fontSize: 13 }}>Заголовок:</Text>
            <Input
              value={topicLabel}
              onChange={(e) => setTopicLabel(e.target.value)}
              placeholder="Тема листа"
              style={{ width: 240 }}
              size="small"
            />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Справа:</Text>
            <Input
              value={variantLabel}
              onChange={(e) => setVariantLabel(e.target.value)}
              placeholder="Вариант 1"
              style={{ width: 120 }}
              size="small"
            />
          </Space>
          <Space size={6}>
            <Switch size="small" checked={showFields} onChange={setShowFields} />
            <Text style={{ fontSize: 13 }}>Фамилия / Имя / Дата</Text>
          </Space>
          <Space size={6}>
            <Switch size="small" checked={showDrawing} onChange={setShowDrawing} />
            <Text style={{ fontSize: 13 }}>Чертежи</Text>
          </Space>
          {showDrawing && (
            <Space size={6}>
              <Text style={{ fontSize: 13 }}>Размер чертежа:</Text>
              <Segmented
                size="small"
                value={drawingSize}
                onChange={setDrawingSize}
                options={[
                  { label: 'S', value: 's' },
                  { label: 'M', value: 'm' },
                  { label: 'L', value: 'l' },
                  { label: 'XL', value: 'xl' },
                ]}
              />
            </Space>
          )}
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
        </Space>
      </Card>

      {/* ── Листы ── */}
      <div className="geo-worksheet-pages">
        {sheets.map((sheet, i) => (
          <WorksheetSheet
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            sheetTasks={sheet.sheetTasks}
            startIndex={sheet.startIndex}
            topicLabel={topicLabel}
            variantLabel={variantLabel}
            showFields={showFields}
            showDrawing={showDrawing}
            isFirstSheet={i === 0}
            layoutKey={layoutKey}
            tasksCount={layoutOpt.count}
            isA4={layoutOpt.isA4}
            drawingSize={drawingSize}
            textSize={textSize}
          />
        ))}
      </div>
    </div>
  );
}
