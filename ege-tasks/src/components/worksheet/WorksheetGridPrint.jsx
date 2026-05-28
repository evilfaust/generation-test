import { useMemo, useState } from 'react';
import { Button, Card, Input, Segmented, Select, Space, Switch, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import MathRenderer from '../MathRenderer';
import { filterTaskText } from '../../utils/filterTaskText';
import './WorksheetGridPrint.css';

const { Text } = Typography;

// Размер текста S/M/L (mm для условия и бейджа).
const TEXT_SIZE_CFG = {
  s: { statement: '3.2mm', badge: '3.2mm' },
  m: { statement: '3.8mm', badge: '3.8mm' },
  l: { statement: '4.5mm', badge: '4.5mm' },
};

// Кол-во задач на лист — 1..20, A4 portrait.
const LAYOUT_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1} / лист`,
}));

// Размер чертежа: ширина — % от блока, высота — доля от высоты блока.
const DRAWING_SIZE_CFG = {
  s:  { w: '26%', hRatio: 0.30 },
  m:  { w: '42%', hRatio: 0.50 },
  l:  { w: '56%', hRatio: 0.72 },
  xl: { w: '70%', hRatio: 0.95 },
};

// Высота рабочей зоны A4 ≈ 277mm минус заголовок/поля; используется только для оценки.
const A4_CONTENT_MM = 270;

function calcDrawingMaxHeight(tasksOnSheet, drawingSize) {
  const cfg = DRAWING_SIZE_CFG[drawingSize] ?? DRAWING_SIZE_CFG.m;
  const perTask = A4_CONTENT_MM / Math.max(tasksOnSheet, 1);
  const h = Math.max(8, Math.round(perTask * cfg.hRatio));
  return `${h}mm`;
}

// Кол-во линий клетки — берём с запасом, лишнее клипуется overflow:hidden.
function calcGridLines(tasksOnSheet) {
  const perTaskMm = A4_CONTENT_MM / Math.max(tasksOnSheet, 1);
  const h = Math.ceil(perTaskMm / 5) + 4;
  const v = Math.ceil(202 / 5) + 2;
  return { h, v };
}

// ── Одна задача ───────────────────────────────────────────────────────────────

function WorksheetTask({ task, index, showDrawing, drawingSize, textSize, sheetTasksCount, hideTaskPrefixes }) {
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : null;
  const dcfg = DRAWING_SIZE_CFG[drawingSize] ?? DRAWING_SIZE_CFG.m;
  const maxH = calcDrawingMaxHeight(sheetTasksCount, drawingSize);
  const drawingStyle = { maxWidth: dcfg.w, maxHeight: maxH };
  const imgStyle = { maxHeight: maxH };

  const tcfg = TEXT_SIZE_CFG[textSize] ?? TEXT_SIZE_CFG.s;
  const lines = calcGridLines(sheetTasksCount);

  const raw = task.statement_md || '';
  const text = hideTaskPrefixes ? filterTaskText(raw) : raw;

  return (
    <div className="wgp-task">
      <div className="wgp-task-header">
        <span className="wgp-task-badge" style={{ fontSize: tcfg.badge }}>№{index + 1}</span>
        <div className="wgp-task-statement" style={{ fontSize: tcfg.statement }}>
          {text ? (
            <MathRenderer text={text} />
          ) : (
            <Text type="secondary" style={{ fontSize: tcfg.statement }}>Условие не задано</Text>
          )}
        </div>
      </div>

      <div className="wgp-task-body">
        {/* Клетка 5 мм — div-линии с физическими mm-единицами */}
        <div className="wgp-task-grid">
          {Array.from({ length: lines.h }, (_, i) => (
            <div key={`h-${i}`} className="wgp-h-line" style={{ top: `${(i + 1) * 5}mm` }} />
          ))}
          {Array.from({ length: lines.v }, (_, i) => (
            <div key={`v-${i}`} className="wgp-v-line" style={{ left: `${(i + 1) * 5}mm` }} />
          ))}
        </div>

        {showDrawing && imageUrl && (
          <div className="wgp-task-drawing" style={drawingStyle}>
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
  tasksCount,
  drawingSize,
  textSize,
  hideTaskPrefixes,
}) {
  const showPrimaryHeader = isFirstSheet;
  const showCompactTitle = !isFirstSheet && topicLabel;

  const sheetClass = [
    'wgp-sheet',
    tasksCount >= 4 ? 'wgp-sheet--compact' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={sheetClass}>
      {showPrimaryHeader && (
        <div className="wgp-sheet-header">
          <span className="wgp-sheet-header-topic">{topicLabel || ''}</span>
          {variantLabel && <span className="wgp-sheet-header-part">{variantLabel}</span>}
        </div>
      )}

      {showCompactTitle && (
        <div className="wgp-sheet-header-compact">
          <span className="wgp-sheet-header-topic">{topicLabel}</span>
        </div>
      )}

      {showPrimaryHeader && showFields && (
        <div className="wgp-sheet-fields">
          {['Фамилия Имя', 'Дата'].map((label) => (
            <div key={label} className="wgp-sheet-field">
              <span className="wgp-sheet-field-label">{label}</span>
              <div className="wgp-sheet-field-line" />
            </div>
          ))}
        </div>
      )}

      {sheetTasks.map((task, i) => (
        <div key={task.id || `${startIndex}-${i}`} className="wgp-task-wrap">
          {i > 0 && <div className="wgp-divider" />}
          <WorksheetTask
            task={task}
            index={startIndex + i}
            showDrawing={showDrawing}
            drawingSize={drawingSize}
            textSize={textSize}
            sheetTasksCount={sheetTasks.length}
            hideTaskPrefixes={hideTaskPrefixes}
          />
        </div>
      ))}
    </div>
  );
}

// ── Лист ответов учителя ──────────────────────────────────────────────────────

function TeacherKeyPage({ tasks, titleOverride }) {
  return (
    <div className="wgp-key-page">
      <div className="wgp-key-title">Ответы (для учителя){titleOverride ? ` — ${titleOverride}` : ''}</div>
      <ol className="wgp-key-list">
        {tasks.map((task, i) => (
          <li key={task.id || i} className="wgp-key-item">
            <span className="wgp-key-num">{i + 1}.</span>
            <span className="wgp-key-answer">
              {task.answer
                ? <MathRenderer text={task.answer} />
                : <span className="wgp-key-no-answer">—</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────

export default function WorksheetGridPrint({ pages = [], hideTaskPrefixes = false, onBack }) {
  // Склеиваем все задачи из всех вариантов в один плоский список.
  const allTasks = useMemo(() => pages.flatMap(p => p.tasks || []), [pages]);

  const [topicLabel, setTopicLabel] = useState(() => pages[0]?.title || '');
  const [variantLabel, setVariantLabel] = useState('');
  const [showFields, setShowFields] = useState(true);
  const [showDrawing, setShowDrawing] = useState(true);
  const [tasksPerSheet, setTasksPerSheet] = useState(4);
  const [drawingSize, setDrawingSize] = useState('m');
  const [textSize, setTextSize] = useState('m');
  const [showTeacherKey, setShowTeacherKey] = useState(true);

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'wgp-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1500);
  };

  const sheets = useMemo(() => {
    const result = [];
    for (let i = 0; i < allTasks.length; i += tasksPerSheet) {
      result.push({ sheetTasks: allTasks.slice(i, i + tasksPerSheet), startIndex: i });
    }
    return result;
  }, [allTasks, tasksPerSheet]);

  if (!allTasks.length) return null;

  const sheetsWord = sheets.length === 1 ? 'лист' : sheets.length < 5 ? 'листа' : 'листов';

  return (
    <div className="wgp-root">
      {/* ── Панель управления ── */}
      <div className="wgp-toolbar">
        <Space>
          {onBack && <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>}
          <Text type="secondary">
            Рабочий лист · {allTasks.length} задач · {sheets.length} {sheetsWord}
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
            <Select
              size="small"
              value={tasksPerSheet}
              onChange={setTasksPerSheet}
              options={LAYOUT_OPTIONS}
              style={{ width: 110 }}
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
          <Space size={6}>
            <Switch size="small" checked={showTeacherKey} onChange={setShowTeacherKey} />
            <Text style={{ fontSize: 13 }}>Ответы (учитель)</Text>
          </Space>
        </Space>
      </Card>

      {/* ── Листы ── */}
      <div className="wgp-pages">
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
            tasksCount={tasksPerSheet}
            drawingSize={drawingSize}
            textSize={textSize}
            hideTaskPrefixes={hideTaskPrefixes}
          />
        ))}
        {showTeacherKey && (
          <TeacherKeyPage tasks={allTasks} titleOverride={topicLabel} />
        )}
      </div>
    </div>
  );
}
