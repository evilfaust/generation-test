import { useMemo, useRef, useState } from 'react';
import { Button, Card, Input, Segmented, Select, Space, Switch, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, FilePdfOutlined, TableOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { filterTaskText } from '../../utils/filterTaskText';
import { useWorksheetActions } from '../../hooks';
import './WorkPrintPreview.css';

const { Text } = Typography;

// Размер текста условия S/M/L (mm).
const TEXT_SIZE_CFG = {
  s: { statement: '3.2mm', badge: '3.2mm' },
  m: { statement: '3.8mm', badge: '3.8mm' },
  l: { statement: '4.5mm', badge: '4.5mm' },
};

// Размер чертежа: ширина — % от блока, высота — доля от высоты блока задачи.
const DRAWING_SIZE_CFG = {
  s:  { w: '26%', hRatio: 0.30 },
  m:  { w: '42%', hRatio: 0.50 },
  l:  { w: '56%', hRatio: 0.72 },
  xl: { w: '70%', hRatio: 0.95 },
};

// Кол-во задач на лист — 1..12, A4 portrait.
const LAYOUT_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1} / лист`,
}));

// Высота рабочей зоны A4 ≈ для оценки высоты чертежа.
const A4_CONTENT_MM = 265;

function calcDrawingMaxHeight(tasksOnSheet, drawingSize) {
  const cfg = DRAWING_SIZE_CFG[drawingSize] ?? DRAWING_SIZE_CFG.m;
  const perTask = A4_CONTENT_MM / Math.max(tasksOnSheet, 1);
  const h = Math.max(8, Math.round(perTask * cfg.hRatio));
  return `${h}mm`;
}

// ── Одна задача ───────────────────────────────────────────────────────────────

function WorkTask({ task, number, showDrawing, drawingSize, textSize, boxed, italic, sheetTasksCount, hideTaskPrefixes }) {
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : '';
  const dcfg = DRAWING_SIZE_CFG[drawingSize] ?? DRAWING_SIZE_CFG.m;
  const maxH = calcDrawingMaxHeight(sheetTasksCount, drawingSize);
  const tcfg = TEXT_SIZE_CFG[textSize] ?? TEXT_SIZE_CFG.m;

  const raw = task.statement_md || '';
  const text = hideTaskPrefixes ? filterTaskText(raw) : raw;

  return (
    <div className="wcp-task">
      <div className="wcp-task-header">
        <span className="wcp-task-badge" style={{ fontSize: tcfg.badge }}>№{number}</span>
        <div
          className="wcp-task-statement"
          style={{ fontSize: tcfg.statement, fontStyle: italic ? 'italic' : 'normal' }}
        >
          {text ? (
            <MathRenderer text={text} />
          ) : (
            <Text type="secondary" style={{ fontSize: tcfg.statement }}>Условие не задано</Text>
          )}
        </div>
      </div>

      <div className={`wcp-task-body${boxed ? ' wcp-task-body--boxed' : ''}`}>
        {showDrawing && imageUrl && (
          <div className="wcp-task-drawing" style={{ maxWidth: dcfg.w, maxHeight: maxH }}>
            <img src={imageUrl} alt={`Чертёж ${task.code || ''}`} style={{ maxHeight: maxH }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Один лист ─────────────────────────────────────────────────────────────────

function WorkSheet({
  sheetTasks,
  startNumber,
  title,
  variantHeading,
  showFields,
  showDrawing,
  drawingSize,
  textSize,
  boxed,
  italic,
  isFirstSheet,
  tasksPerSheet,
  hideTaskPrefixes,
}) {
  const sheetClass = ['wcp-sheet', tasksPerSheet >= 4 ? 'wcp-sheet--compact' : ''].filter(Boolean).join(' ');

  return (
    <div className={sheetClass}>
      {isFirstSheet ? (
        <div className="wcp-sheet-header">
          <span className="wcp-sheet-title">{title}</span>
          {variantHeading && <span className="wcp-sheet-variant">{variantHeading}</span>}
        </div>
      ) : (
        (title || variantHeading) && (
          <div className="wcp-sheet-header wcp-sheet-header--compact">
            <span className="wcp-sheet-title">{title}</span>
            {variantHeading && <span className="wcp-sheet-variant">{variantHeading}</span>}
          </div>
        )
      )}

      {isFirstSheet && showFields && (
        <div className="wcp-fields">
          {['Фамилия Имя', 'Дата'].map((label) => (
            <div key={label} className="wcp-field">
              <span className="wcp-field-label">{label}</span>
              <div className="wcp-field-line" />
            </div>
          ))}
        </div>
      )}

      {sheetTasks.map((task, i) => (
        <div key={task.id || `${startNumber}-${i}`} className="wcp-task-wrap">
          {i > 0 && <div className="wcp-divider" />}
          <WorkTask
            task={task}
            number={startNumber + i}
            showDrawing={showDrawing}
            drawingSize={drawingSize}
            textSize={textSize}
            boxed={boxed}
            italic={italic}
            sheetTasksCount={sheetTasks.length}
            hideTaskPrefixes={hideTaskPrefixes}
          />
        </div>
      ))}
    </div>
  );
}

// ── Лист ответов учителя ──────────────────────────────────────────────────────

function TeacherKeyPage({ variants, title, showVariantHeading }) {
  return (
    <div className="wcp-key-page">
      <div className="wcp-key-title">Ответы (для учителя){title ? ` — ${title}` : ''}</div>
      {variants.map((variant, vi) => (
        <div key={variant.number || vi} className="wcp-key-variant-block">
          {showVariantHeading && variants.length > 1 && (
            <div className="wcp-key-variant">Вариант {variant.number || vi + 1}</div>
          )}
          <ol className="wcp-key-list">
            {(variant.tasks || []).map((task, i) => (
              <li key={task.id || i} className="wcp-key-item">
                <span className="wcp-key-num">{i + 1}.</span>
                <span className="wcp-key-answer">
                  {task.answer ? <MathRenderer text={task.answer} /> : <span className="wcp-key-no-answer">—</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────

/**
 * Полноэкранный предпросмотр печати сохранённой работы (из WorkEditor).
 * Стилистика — как у «Рабочего листа» (чистые A4-листы, засечка серифом),
 * но без клетки: компоновка по числу задач на листе, поле для решения,
 * тумблер слова «Вариант», всё чёрным (без синего — лучше при печати).
 *
 * Scoped print: body:has(.wpv-overlay) — печатается только .wpv-print-root.
 *
 * @param {object} work - работа (нужен title)
 * @param {Array} variants - [{ number, tasks }]
 * @param {function} onClose
 * @param {function} [onOpenWorksheet] - переход в режим «Рабочий лист» (клетка)
 */
export default function WorkPrintPreview({ work, variants = [], onClose, onOpenWorksheet }) {
  const printRef = useRef(null);
  const { handleExportPDF, exporting } = useWorksheetActions();

  const title = work?.title || 'Контрольная работа';

  const [topicTitle, setTopicTitle] = useState(title);
  const [tasksPerSheet, setTasksPerSheet] = useState(4);
  const [textSize, setTextSize] = useState('m');
  const [italicText, setItalicText] = useState(false);
  const [showVariantLabel, setShowVariantLabel] = useState(true);
  const [showFields, setShowFields] = useState(true);
  const [showDrawing, setShowDrawing] = useState(true);
  const [drawingSize, setDrawingSize] = useState('m');
  const [boxedSolveArea, setBoxedSolveArea] = useState(false);
  const [showTeacherKey, setShowTeacherKey] = useState(true);
  const [hideTaskPrefixes, setHideTaskPrefixes] = useState(false);

  // Разбиваем каждый вариант на листы по tasksPerSheet задач.
  const sheets = useMemo(() => {
    const result = [];
    variants.forEach((variant, vi) => {
      const tasks = variant.tasks || [];
      const variantHeading = showVariantLabel ? `Вариант ${variant.number || vi + 1}` : '';
      for (let i = 0; i < tasks.length; i += tasksPerSheet) {
        result.push({
          key: `${vi}-${i}`,
          sheetTasks: tasks.slice(i, i + tasksPerSheet),
          startNumber: i + 1,
          variantHeading,
          isFirstSheet: i === 0,
        });
      }
    });
    return result;
  }, [variants, tasksPerSheet, showVariantLabel]);

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'wcp-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1500);
  };

  const totalTasks = variants.reduce((sum, v) => sum + (v.tasks?.length || 0), 0);

  return (
    <div className="wpv-overlay">
      <Card
        size="small"
        className="wpv-toolbar no-print"
        styles={{ body: { padding: '10px 14px' } }}
      >
        <Space wrap align="center" style={{ width: '100%' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onClose}>
            Назад к редактору
          </Button>

          {onOpenWorksheet && (
            <Tooltip title="Печать рабочего листа в клетку — поля для решения от руки">
              <Button icon={<TableOutlined />} onClick={onOpenWorksheet}>
                Рабочий лист
              </Button>
            </Tooltip>
          )}

          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Заголовок:</Text>
            <Input
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="Название работы"
              style={{ width: 200 }}
              size="small"
            />
          </Space>

          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Задач на листе:</Text>
            <Select
              size="small"
              value={tasksPerSheet}
              onChange={setTasksPerSheet}
              options={LAYOUT_OPTIONS}
              style={{ width: 100 }}
            />
          </Space>

          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Текст:</Text>
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
            <Text style={{ fontSize: 13 }}>Начертание:</Text>
            <Segmented
              size="small"
              value={italicText ? 'italic' : 'normal'}
              onChange={(v) => setItalicText(v === 'italic')}
              options={[
                { label: 'Прямой', value: 'normal' },
                { label: 'Курсив', value: 'italic' },
              ]}
            />
          </Space>

          <Space size={6}>
            <Switch size="small" checked={showVariantLabel} onChange={setShowVariantLabel} />
            <Text style={{ fontSize: 13 }}>Слово «Вариант»</Text>
          </Space>

          <Space size={6}>
            <Switch size="small" checked={showFields} onChange={setShowFields} />
            <Text style={{ fontSize: 13 }}>ФИО / Дата</Text>
          </Space>

          <Space size={6}>
            <Switch size="small" checked={showDrawing} onChange={setShowDrawing} />
            <Text style={{ fontSize: 13 }}>Чертежи</Text>
          </Space>
          {showDrawing && (
            <Space size={6}>
              <Text style={{ fontSize: 13 }}>Размер:</Text>
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

          <Tooltip title="Рамка вокруг места для решения">
            <Space size={6}>
              <Switch size="small" checked={boxedSolveArea} onChange={setBoxedSolveArea} />
              <Text style={{ fontSize: 13 }}>Рамка решения</Text>
            </Space>
          </Tooltip>

          <Space size={6}>
            <Switch size="small" checked={showTeacherKey} onChange={setShowTeacherKey} />
            <Text style={{ fontSize: 13 }}>Ответы (учитель)</Text>
          </Space>

          <Tooltip title="Скрывать типовые фразы («Вычислите», «Найдите»…)">
            <Space size={6}>
              <Switch size="small" checked={hideTaskPrefixes} onChange={setHideTaskPrefixes} />
              <Text style={{ fontSize: 13 }}>Без префиксов</Text>
            </Space>
          </Tooltip>

          <Space style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
              Печать
            </Button>
            <Button
              icon={<FilePdfOutlined />}
              loading={exporting}
              onClick={() => handleExportPDF(printRef, topicTitle || title)}
            >
              PDF
            </Button>
          </Space>
        </Space>
      </Card>

      <div className="wpv-stage">
        <div ref={printRef} className="wpv-print-root">
          {totalTasks === 0 ? (
            <div className="wcp-sheet">
              <Text type="secondary">В работе нет задач для печати.</Text>
            </div>
          ) : (
            <>
              {sheets.map((sheet) => (
                <WorkSheet
                  key={sheet.key}
                  sheetTasks={sheet.sheetTasks}
                  startNumber={sheet.startNumber}
                  title={topicTitle}
                  variantHeading={sheet.variantHeading}
                  showFields={showFields}
                  showDrawing={showDrawing}
                  drawingSize={drawingSize}
                  textSize={textSize}
                  boxed={boxedSolveArea}
                  italic={italicText}
                  isFirstSheet={sheet.isFirstSheet}
                  tasksPerSheet={tasksPerSheet}
                  hideTaskPrefixes={hideTaskPrefixes}
                />
              ))}
              {showTeacherKey && (
                <TeacherKeyPage
                  variants={variants}
                  title={topicTitle}
                  showVariantHeading={showVariantLabel}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
