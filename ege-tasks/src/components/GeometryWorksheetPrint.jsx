import { useMemo, useState } from 'react';
import { Button, Card, Input, Segmented, Space, Switch, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import MathRenderer from './MathRenderer';
import './GeometryWorksheetPrint.css';

const { Text } = Typography;

/**
 * Размеры чертежей: ширина контейнера (%) и max-height (mm) для каждого
 * сочетания drawingSize × tasksPerSheet.
 */
const DRAWING_SIZE_CFG = {
  s:  { w: '26%', h: { 2: '33mm', 3: '27mm', 4: '19mm', 5: '14mm' } },
  m:  { w: '42%', h: { 2: '55mm', 3: '45mm', 4: '32mm', 5: '25mm' } },
  l:  { w: '56%', h: { 2: '80mm', 3: '65mm', 4: '46mm', 5: '35mm' } },
  xl: { w: '70%', h: { 2: '110mm', 3: '88mm', 4: '61mm', 5: '46mm' } },
};

// ── Одна задача (половина листа) ─────────────────────────────────────────────

function WorksheetTask({ task, index, showDrawing, drawingSize, tasksPerSheet }) {
  const imageUrl = api.getGeometryImageUrl(task);
  const hasImage = !!imageUrl;

  const dcfg = DRAWING_SIZE_CFG[drawingSize] ?? DRAWING_SIZE_CFG.m;
  const maxH = dcfg.h[tasksPerSheet] ?? dcfg.h[2];
  const drawingStyle = { width: dcfg.w, maxHeight: maxH };
  const imgStyle    = { maxHeight: maxH };

  return (
    <div className="geo-worksheet-task">
      {/* Строка: бейдж + условие */}
      <div className="geo-worksheet-task-header">
        <span className="geo-worksheet-task-badge">№{index + 1}</span>
        <div className="geo-worksheet-task-statement">
          {task.statement_md ? (
            <MathRenderer text={task.statement_md} />
          ) : (
            <Text type="secondary" style={{ fontSize: '3.2mm' }}>Условие не задано</Text>
          )}
        </div>
      </div>

      {/* Тело: сетка на весь блок, чертёж поверх в левом верхнем углу */}
      <div className="geo-worksheet-task-body">
        {/* Сетка занимает весь блок — максимум места для решения */}
        <div className="geo-worksheet-task-grid">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="geo-worksheet-grid-svg">
            <defs>
              <pattern
                id={`geo-grid-${index}`}
                x="0" y="0"
                width="18.898" height="18.898"
                patternUnits="userSpaceOnUse"
              >
                <path d="M 18.898 0 L 0 0 0 18.898" fill="none" stroke="#c4cedf" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#geo-grid-${index})`} />
          </svg>
        </div>

        {/* Чертёж — плавает поверх сетки в левом верхнем углу */}
        {showDrawing && (
          <div className="geo-worksheet-task-drawing" style={drawingStyle}>
            {hasImage ? (
              <img src={imageUrl} alt={`Чертёж ${task.code || ''}`} style={imgStyle} />
            ) : (
              <div className="geo-worksheet-task-drawing-placeholder">нет чертежа</div>
            )}
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
  tasksPerSheet,
  drawingSize,
}) {
  const showPrimaryHeader = isFirstSheet;
  const showCompactTitle = !isFirstSheet && topicLabel;

  const sheetClass = [
    'geo-worksheet-sheet',
    tasksPerSheet > 2 ? 'geo-worksheet-sheet--a4' : '',
    tasksPerSheet === 4 ? 'geo-worksheet-sheet--4' : '',
    tasksPerSheet === 5 ? 'geo-worksheet-sheet--5' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={sheetClass}>
      {/* Шапка */}
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

      {/* Поля для заполнения */}
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

      {/* Задачи (разделены линией если их две) */}
      {sheetTasks.map((task, i) => (
        <>
          {i > 0 && <div key={`div-${task.id}`} className="geo-worksheet-divider" />}
          <WorksheetTask
            key={task.id}
            task={task}
            index={startIndex + i}
            showDrawing={showDrawing}
            drawingSize={drawingSize}
            tasksPerSheet={tasksPerSheet}
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
  const [tasksPerSheet, setTasksPerSheet] = useState(2);
  const [drawingSize, setDrawingSize] = useState('m');

  const handlePrint = () => {
    const size = tasksPerSheet === 2 ? 'A5 portrait' : 'A4 portrait';
    const style = document.createElement('style');
    style.textContent = `@page { size: ${size}; margin: 0; }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1500);
  };

  const sheets = useMemo(() => {
    const result = [];
    for (let i = 0; i < tasks.length; i += tasksPerSheet) {
      result.push({ sheetTasks: tasks.slice(i, i + tasksPerSheet), startIndex: i });
    }
    return result;
  }, [tasks, tasksPerSheet]);

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
              value={tasksPerSheet}
              onChange={setTasksPerSheet}
              options={[
                { label: '2 / A5', value: 2 },
                { label: '3 / A4', value: 3 },
                { label: '4 / A4', value: 4 },
                { label: '5 / A4', value: 5 },
              ]}
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
            tasksPerSheet={tasksPerSheet}
            drawingSize={drawingSize}
          />
        ))}
      </div>
    </div>
  );
}
