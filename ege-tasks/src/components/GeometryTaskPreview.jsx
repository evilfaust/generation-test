import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Input, Segmented, Select, Space, Switch, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, UndoOutlined } from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import MathRenderer from './MathRenderer';
import SaveGeometryPrintModal from './geometry/SaveGeometryPrintModal';
import './GeometryTaskPreview.css';

const { Text } = Typography;

const MODE_OPTIONS = [
  { label: 'Печать', value: 'print' },
  { label: 'Вид ученика', value: 'student' },
];
const DRAWING_OPTIONS = [
  { label: 'По задаче', value: 'task' },
  { label: 'Картинка', value: 'image' },
];
export const PRINT_TASKS_PER_PAGE = 6;
// A5 sheet 148x210mm with 5mm paddings -> content 138x200mm.
// Grid is 2x3, so one cell is 69 x (200/3) mm.
export const PRINT_CELL_ASPECT_RATIO = 69 / (200 / 3);

// Габариты листов (мм) для печати «Просмотра».
const PAGE_DIMS = {
  A5: { w: 148, h: 210 },
  A4: { w: 210, h: 297 },
};

// Раскладки печати: формат листа + сетка задач (cols×rows).
// fontK подгоняет mm-шрифт условия под размер ячейки — чем крупнее ячейка,
// тем крупнее текст (учитель всё равно может донастроить макет каждой задачи).
const PRINT_LAYOUTS = [
  { id: 'a5-6', label: 'A5 · 6 (2×3)', page: 'A5', cols: 2, rows: 3, fontK: 1 },
  { id: 'a5-4', label: 'A5 · 4 (2×2)', page: 'A5', cols: 2, rows: 2, fontK: 1.18 },
  { id: 'a5-2', label: 'A5 · 2 (1×2)', page: 'A5', cols: 1, rows: 2, fontK: 1.45 },
  { id: 'a4-9', label: 'A4 · 9 (3×3)', page: 'A4', cols: 3, rows: 3, fontK: 1 },
  { id: 'a4-8', label: 'A4 · 8 (2×4)', page: 'A4', cols: 2, rows: 4, fontK: 1.2 },
  { id: 'a4-6', label: 'A4 · 6 (2×3)', page: 'A4', cols: 2, rows: 3, fontK: 1.42 },
  { id: 'a4-4', label: 'A4 · 4 (2×2)', page: 'A4', cols: 2, rows: 2, fontK: 1.7 },
];

const DEFAULT_PRINT_LAYOUT_ID = 'a5-6';

const getPrintLayout = (id) => PRINT_LAYOUTS.find((l) => l.id === id) || PRINT_LAYOUTS[0];

// Сохранённый лист хранит page_size + tasks_per_page → подбираем раскладку.
const matchPrintLayout = (printTest) => {
  if (!printTest) return DEFAULT_PRINT_LAYOUT_ID;
  const page = String(printTest.page_size || 'A5').toUpperCase();
  const per = Number(printTest.tasks_per_page) || 6;
  const found = PRINT_LAYOUTS.find((l) => l.page === page && l.cols * l.rows === per);
  return found?.id || DEFAULT_PRINT_LAYOUT_ID;
};

// Кол-во линий клетки 5 мм под размер ячейки раскладки. Считаем точно по
// габаритам ячейки — лишние линии при печати масштабируют страницу (см. CLAUDE.md).
const getGridLines = (layout) => {
  const dims = PAGE_DIMS[layout.page] || PAGE_DIMS.A5;
  const cellW = (dims.w - 10) / layout.cols;
  const cellH = (dims.h - 10) / layout.rows;
  return { vLines: Math.ceil(cellW / 5), hLines: Math.ceil(cellH / 5) };
};

/** URL изображения задачи: файловое поле → legacy base64 → пусто */
function getTaskImageSrc(task) {
  return api.getGeometryImageUrl(task) || '';
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const getMinY = (layerType) => (layerType === 'text' ? -24 : -10);

export const safeParseLayout = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const getDefaultLayout = (mode) => {
  if (mode === 'student') {
    return {
      image: { x: 4, y: 14, w: 88, h: 73 },
      text: { x: 56, y: 6, w: 40, h: 35, fontScale: 2.16 },
    };
  }
  return {
    image: { x: 4, y: 16, w: 90, h: 76 },
    text: { x: 55, y: 6, w: 41, h: 35, fontScale: 2 },
  };
};

const normalizeLayer = (layer, type) => {
  const minW = type === 'text' ? 16 : 22;
  const minH = type === 'text' ? 12 : 18;
  const w = clamp(layer?.w, minW, 100);
  const h = clamp(layer?.h, minH, 100);
  const x = clamp(layer?.x, 0, 100 - w);
  const y = clamp(layer?.y, getMinY(type), 100 - h);

  if (type === 'text') {
    return {
      x,
      y,
      w,
      h,
      fontScale: clamp(layer?.fontScale, 0.65, 2.3),
    };
  }

  return { x, y, w, h };
};

export const normalizeLayout = (layout, mode) => {
  const base = layout || getDefaultLayout(mode);
  return {
    image: normalizeLayer(base.image, 'image'),
    text: normalizeLayer(base.text, 'text'),
  };
};

function getTaskNumber(task, index) {
  return index + 1;
}

function normalizeStatement(task) {
  const statement = (task?.statement_md || '').trim();
  if (!statement) return 'Дано: $\\triangle ABC$\nНайдите искомую величину.';
  return statement;
}

function toLayerStyle(layer, zIndex) {
  return {
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    width: `${layer.w}%`,
    height: `${layer.h}%`,
    zIndex,
  };
}

export function GeometryPreviewCard({
  task,
  index,
  showAnswers,
  mode,
  drawingMode,
  isPlaceholder = false,
  editable = false,
  layout,
  onLayoutChange,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  highlightDrop = false,
  hLines = 15,
  vLines = 15,
  fontK = 1,
  showGrid = true,
}) {
  // Приоритет: файловое поле (drawing_image) → legacy base64 → пусто
  const imageValue = getTaskImageSrc(task);
  const showImage = drawingMode === 'image' || drawingMode === 'task';

  const stageRef = useRef(null);
  const interactionRef = useRef(null);

  const stopInteraction = useCallback(() => {
    window.removeEventListener('pointermove', interactionRef.current?.onMove);
    window.removeEventListener('pointerup', interactionRef.current?.onUp);
    interactionRef.current = null;
  }, []);

  useEffect(() => () => stopInteraction(), [stopInteraction]);

  const handlePointerMove = useCallback((event) => {
    const state = interactionRef.current;
    if (!state) return;

    const dxPct = ((event.clientX - state.startX) / state.rect.width) * 100;
    const dyPct = ((event.clientY - state.startY) / state.rect.height) * 100;

    if (state.action === 'move') {
      onLayoutChange(state.layer, {
        x: clamp(state.origin.x + dxPct, 0, 100 - state.origin.w),
        y: clamp(state.origin.y + dyPct, getMinY(state.layer), 100 - state.origin.h),
      });
      return;
    }

    if (state.action === 'resize-x') {
      const minW = state.layer === 'text' ? 16 : 22;
      const nextW = clamp(state.origin.w + dxPct, minW, 100 - state.origin.x);
      onLayoutChange(state.layer, { w: nextW });
      return;
    }

    if (state.action === 'resize-y') {
      const minH = state.layer === 'text' ? 12 : 18;
      const nextH = clamp(state.origin.h + dyPct, minH, 100 - state.origin.y);
      onLayoutChange(state.layer, { h: nextH });
      return;
    }

    const ratio = state.origin.w / state.origin.h || 1;
    const majorDelta = Math.abs(dxPct) >= Math.abs(dyPct) ? dxPct : dyPct * ratio;

    const minW = state.layer === 'text' ? 16 : 22;
    let nextW = clamp(state.origin.w + majorDelta, minW, 100 - state.origin.x);
    let nextH = nextW / ratio;

    if (nextH > 100 - state.origin.y) {
      nextH = 100 - state.origin.y;
      nextW = nextH * ratio;
    }

    const patch = {
      w: clamp(nextW, minW, 100),
      h: clamp(nextH, state.layer === 'text' ? 12 : 18, 100),
    };

    if (state.layer === 'text') {
      const scaleK = patch.w / state.origin.w;
      patch.fontScale = clamp(state.origin.fontScale * scaleK, 0.65, 2.3);
    }

    onLayoutChange(state.layer, patch);
  }, [onLayoutChange]);

  const startInteraction = useCallback((event, layer, action) => {
    if (!editable || isPlaceholder) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 10 || rect.height < 10) return;

    event.preventDefault();
    event.stopPropagation();

    const origin = layout[layer];
    const onMove = (e) => handlePointerMove(e);
    const onUp = () => stopInteraction();

    interactionRef.current = {
      layer,
      action,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      origin,
      onMove,
      onUp,
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [editable, handlePointerMove, isPlaceholder, layout, stopInteraction]);

  const textFontSize = useMemo(() => {
    if (mode === 'print') return `${(2.05 * fontK * layout.text.fontScale).toFixed(2)}mm`;
    return `${Math.round(17 * layout.text.fontScale)}px`;
  }, [layout.text.fontScale, mode, fontK]);

  return (
    <article
      className="geometry-preview-cell"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={highlightDrop ? { outline: '2px dashed #1677ff', outlineOffset: -2 } : undefined}
    >
      <div className="geometry-preview-number">{getTaskNumber(task, index)}</div>
      {!isPlaceholder && task?.code && (
        <div className="geometry-preview-code">{task.code}</div>
      )}

      <div
        ref={stageRef}
        className={`geometry-preview-stage ${editable ? 'is-editing' : ''}`}
      >
        {/* Клетка 5 мм — div-линии с физическими mm/pt-единицами → нативные векторы в PDF.
            Кол-во линий считается точно под ячейку раскладки (hLines/vLines). */}
        {showGrid && (
          <>
            {Array.from({ length: hLines }, (_, i) => (
              <div key={`gh-${i}`} className="geo-preview-h-line" style={{ top: `${(i + 1) * 5}mm` }} />
            ))}
            {Array.from({ length: vLines }, (_, i) => (
              <div key={`gv-${i}`} className="geo-preview-v-line" style={{ left: `${(i + 1) * 5}mm` }} />
            ))}
          </>
        )}

        <div
          className={`geometry-preview-layer geometry-preview-layer-image ${editable ? 'editable' : ''}`}
          style={toLayerStyle(layout.image, 1)}
          onPointerDown={(e) => startInteraction(e, 'image', 'move')}
        >
          {!isPlaceholder && showImage && imageValue ? (
            <img
              className="geometry-preview-image"
              src={imageValue}
              alt={`Чертёж ${task.code || index + 1}`}
              draggable={false}
            />
          ) : null}

          {editable && !isPlaceholder && (
            <>
              <div className="geometry-preview-layer-tag">Чертёж</div>
              <div
                className="geometry-preview-resize-handle"
                onPointerDown={(e) => startInteraction(e, 'image', 'resize')}
              />
              <div
                className="geometry-preview-resize-handle geometry-preview-resize-handle-x"
                onPointerDown={(e) => startInteraction(e, 'image', 'resize-x')}
              />
              <div
                className="geometry-preview-resize-handle geometry-preview-resize-handle-y"
                onPointerDown={(e) => startInteraction(e, 'image', 'resize-y')}
              />
            </>
          )}
        </div>

        <div
          className={`geometry-preview-layer geometry-preview-layer-text ${editable ? 'editable' : ''}`}
          style={{ ...toLayerStyle(layout.text, 3), fontSize: textFontSize }}
          onPointerDown={(e) => startInteraction(e, 'text', 'move')}
        >
          <div className="geometry-preview-text-content">
            {!isPlaceholder && <MathRenderer text={normalizeStatement(task)} />}
            {showAnswers && task?.answer && (
              <div className="geometry-preview-answer">
                <strong>Ответ:</strong> {task.answer}
              </div>
            )}
          </div>

          {editable && !isPlaceholder && (
            <>
              <div className="geometry-preview-layer-tag">Дано</div>
              <div
                className="geometry-preview-resize-handle"
                onPointerDown={(e) => startInteraction(e, 'text', 'resize')}
              />
              <div
                className="geometry-preview-resize-handle geometry-preview-resize-handle-x"
                onPointerDown={(e) => startInteraction(e, 'text', 'resize-x')}
              />
              <div
                className="geometry-preview-resize-handle geometry-preview-resize-handle-y"
                onPointerDown={(e) => startInteraction(e, 'text', 'resize-y')}
              />
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function GeometryTaskPreview({ tasks, onBack, initialPrintTest = null }) {
  const { message } = App.useApp();
  const [orderedTasks, setOrderedTasks] = useState(tasks);
  const [mode, setMode] = useState('print');
  const [showAnswers, setShowAnswers] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [drawingMode, setDrawingMode] = useState('task');
  const [printLayoutId, setPrintLayoutId] = useState(() => matchPrintLayout(initialPrintTest));
  const [layoutEdit, setLayoutEdit] = useState(false);
  const [layoutOverrides, setLayoutOverrides] = useState({ print: {}, student: {} });
  const [savingLayout, setSavingLayout] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState(null); // 'saving' | 'saved' | 'error' | null
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [savingPrintTest, setSavingPrintTest] = useState(false);
  const [currentPrintTest, setCurrentPrintTest] = useState(initialPrintTest);
  const [dragTaskIndex, setDragTaskIndex] = useState(null);
  const [dropTaskIndex, setDropTaskIndex] = useState(null);

  // Refs для доступа к актуальным данным внутри setTimeout без stale closures
  const autosaveTimerRef = useRef(null);
  const layoutOverridesRef = useRef(layoutOverrides);
  const taskLayoutsRef = useRef(null);
  const tasksRef = useRef(orderedTasks);
  tasksRef.current = orderedTasks;

  // Заголовок листа — редактируется прямо в тулбаре, отображается сразу
  const [headerTopic, setHeaderTopic] = useState(initialPrintTest?.sheet_topic || '');
  const [headerSubtopic, setHeaderSubtopic] = useState(initialPrintTest?.sheet_subtopic || '');

  const [taskLayouts, setTaskLayouts] = useState(() => {
    const initial = {};
    tasks.forEach((task, idx) => {
      if (!task) return;
      const key = task.id || task.code || `slot-${idx}`;
      initial[key] = safeParseLayout(task.preview_layout);
    });
    return initial;
  });

  // Синхронизируем рефы с актуальным состоянием
  layoutOverridesRef.current = layoutOverrides;
  taskLayoutsRef.current = taskLayouts;

  // ── Выбранная раскладка печати: формат листа + сетка ───────────────────────
  const printLayout = getPrintLayout(printLayoutId);
  const perPage = printLayout.cols * printLayout.rows;
  const pageDims = PAGE_DIMS[printLayout.page] || PAGE_DIMS.A5;
  const gridLines = useMemo(() => getGridLines(printLayout), [printLayout]);
  const gridTemplate = {
    gridTemplateColumns: `repeat(${printLayout.cols}, 1fr)`,
    gridTemplateRows: `repeat(${printLayout.rows}, 1fr)`,
  };

  // Задаём формат страницы (A5/A4) при печати и убираем при демонтировании,
  // чтобы не ломать @page других разделов приложения.
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `@page { size: ${printLayout.page} portrait; margin: 0; }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [printLayout.page]);

  // Автосохранение layoutOverrides в БД после 800мс без изменений
  const scheduleAutosave = useCallback((currentMode) => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus('saving');
    autosaveTimerRef.current = setTimeout(async () => {
      const modeOverrides = layoutOverridesRef.current[currentMode] || {};
      const entries = Object.entries(modeOverrides);
      if (entries.length === 0) { setAutosaveStatus(null); return; }

      let okCount = 0;
      let failCount = 0;
      const allTasks = tasksRef.current;
      const currentTaskLayouts = taskLayoutsRef.current;

      for (const [taskKey, layoutForMode] of entries) {
        const task = allTasks.find((t, idx) => (t?.id || t?.code || `slot-${idx}`) === taskKey);
        if (!task?.id) continue;
        const existing = safeParseLayout(currentTaskLayouts[taskKey]) || {};
        const nextNorm = normalizeLayout(layoutForMode, currentMode);
        // Уже сохранено — не дёргаем БД повторно (оверрайды не очищаем, так что
        // одни и те же значения иначе переписывались бы при каждом движении).
        if (JSON.stringify(existing[currentMode]) === JSON.stringify(nextNorm)) {
          okCount += 1;
          continue;
        }
        try {
          const nextPreviewLayout = { ...existing, [currentMode]: nextNorm };
          await api.updateGeometryTask(task.id, { preview_layout: nextPreviewLayout });
          okCount += 1;
        } catch {
          failCount += 1;
        }
      }

      if (okCount > 0) {
        // Синхронизируем «сохранённый» макет, НО оверрайды НЕ очищаем — они
        // остаются живым источником истины редактора до конца сессии правки.
        // Очистка во время жеста сбрасывала макет на снапшот/дефолт (баг «слетает»).
        setTaskLayouts((prev) => {
          const next = { ...prev };
          entries.forEach(([taskKey, layoutForMode]) => {
            const existing = safeParseLayout(next[taskKey]) || {};
            next[taskKey] = {
              ...existing,
              [currentMode]: normalizeLayout(layoutForMode, currentMode),
            };
          });
          return next;
        });
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus((s) => (s === 'saved' ? null : s)), 3000);
      } else if (failCount > 0) {
        setAutosaveStatus('error');
      } else {
        setAutosaveStatus(null);
      }
    }, 800);
  }, []);

  useEffect(() => {
    setCurrentPrintTest(initialPrintTest || null);
    setHeaderTopic(initialPrintTest?.sheet_topic || '');
    setHeaderSubtopic(initialPrintTest?.sheet_subtopic || '');
    if (initialPrintTest) setPrintLayoutId(matchPrintLayout(initialPrintTest));
  }, [initialPrintTest]);

  useEffect(() => {
    setOrderedTasks(tasks);
    const next = {};
    tasks.forEach((task, idx) => {
      if (!task) return;
      const key = task.id || task.code || `slot-${idx}`;
      next[key] = safeParseLayout(task.preview_layout);
    });
    setTaskLayouts(next);
    setLayoutOverrides({ print: {}, student: {} });
  }, [tasks]);

  const printPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < orderedTasks.length; i += perPage) {
      pages.push(orderedTasks.slice(i, i + perPage));
    }
    if (pages.length === 0) pages.push([]);
    return pages.map((pageTasks) =>
      Array.from({ length: perPage }, (_, i) => pageTasks[i] || null));
  }, [orderedTasks, perPage]);
  const visibleTasks = mode === 'print' ? printPages.flat() : orderedTasks;
  const pendingCount = Object.keys(layoutOverrides[mode] || {}).length;
  const snapshotLayouts = useMemo(() => {
    const raw = safeParseLayout(currentPrintTest?.layout_snapshot);
    return raw && typeof raw === 'object' ? raw : {};
  }, [currentPrintTest?.layout_snapshot]);

  const getTaskLayout = useCallback((task, idx) => {
    const taskKey = task?.id || task?.code || `slot-${idx}`;
    const override = layoutOverrides[mode]?.[taskKey];
    if (override) return normalizeLayout(override, mode);
    if (mode === 'print' && task?.id && snapshotLayouts[task.id]) {
      return normalizeLayout(snapshotLayouts[task.id], mode);
    }
    const persisted = taskLayouts[taskKey]?.[mode];
    return normalizeLayout(persisted, mode);
  }, [layoutOverrides, mode, snapshotLayouts, taskLayouts]);

  const handleLayoutChange = useCallback((taskKey, layerName, patch) => {
    setLayoutOverrides((prev) => {
      // База первой правки — текущий ОТОБРАЖАЕМЫЙ макет (оверрайд → снапшот листа →
      // сохранённый → дефолт), а не дефолт. Иначе частичный патч ресайза/перемещения
      // сбрасывал остальные поля слоя на дефолт (баг «слетает при первом движении»).
      let base = prev[mode]?.[taskKey];
      if (!base) {
        if (mode === 'print' && snapshotLayouts[taskKey]) base = snapshotLayouts[taskKey];
        else base = taskLayouts[taskKey]?.[mode];
      }
      const currentTaskLayout = normalizeLayout(base, mode);
      const nextTaskLayout = normalizeLayout({
        ...currentTaskLayout,
        [layerName]: {
          ...currentTaskLayout[layerName],
          ...patch,
        },
      }, mode);
      return {
        ...prev,
        [mode]: {
          ...(prev[mode] || {}),
          [taskKey]: nextTaskLayout,
        },
      };
    });
    scheduleAutosave(mode);
  }, [mode, scheduleAutosave, snapshotLayouts, taskLayouts]);

  const resetLayout = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus(null);
    setLayoutOverrides((prev) => ({
      ...prev,
      [mode]: {},
    }));
  }, [mode]);

  const handleSaveLayout = useCallback(async () => {
    const modeOverrides = layoutOverrides[mode] || {};
    const entries = Object.entries(modeOverrides);
    if (entries.length === 0) return;

    setSavingLayout(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const [taskKey, layoutForMode] of entries) {
        const task = orderedTasks.find((t, idx) => (t?.id || t?.code || `slot-${idx}`) === taskKey);
        if (!task?.id) continue;
        try {
          const existing = safeParseLayout(taskLayouts[taskKey]) || {};
          const nextPreviewLayout = {
            ...existing,
            [mode]: normalizeLayout(layoutForMode, mode),
          };
          await api.updateGeometryTask(task.id, { preview_layout: nextPreviewLayout });
          okCount += 1;
        } catch {
          failCount += 1;
        }
      }

      if (okCount > 0) {
        setTaskLayouts((prev) => {
          const next = { ...prev };
          entries.forEach(([taskKey, layoutForMode]) => {
            const existing = safeParseLayout(next[taskKey]) || {};
            next[taskKey] = {
              ...existing,
              [mode]: normalizeLayout(layoutForMode, mode),
            };
          });
          return next;
        });
        // Оверрайды НЕ очищаем (см. scheduleAutosave) — иначе макет слетает на снапшот.
      }
      if (okCount > 0 && failCount === 0) {
        message.success(`Макет сохранён для ${okCount} задач`);
      } else if (okCount > 0 && failCount > 0) {
        message.warning(`Сохранено: ${okCount}, с ошибкой: ${failCount}`);
      } else {
        message.error('Не удалось сохранить макет');
      }
    } finally {
      setSavingLayout(false);
    }
  }, [layoutOverrides, mode, taskLayouts, orderedTasks]);

  const handleSaveAsPrintTest = useCallback(async (values) => {
    const printTasks = orderedTasks.filter(Boolean);
    if (printTasks.length !== perPage) {
      message.error(`Для листа ${printLayout.page} нужно ровно ${perPage} задач`);
      return;
    }
    const title = String(values?.title || '').trim();
    if (!title) return;

    const taskIds = printTasks.map((t) => t.id).filter(Boolean);
    if (taskIds.length !== perPage) {
      message.error(`Не удалось определить id всех ${perPage} задач`);
      return;
    }

    const layoutSnapshot = {};
    printTasks.forEach((task, idx) => {
      const key = task?.id || task?.code || `slot-${idx}`;
      layoutSnapshot[task.id] = getTaskLayout(task, idx);
      const unsaved = layoutOverrides.print?.[key];
      if (unsaved) {
        layoutSnapshot[task.id] = normalizeLayout(unsaved, 'print');
      }
    });

    setSavingPrintTest(true);
    try {
      const sheetTopic = String(values?.sheet_topic || '').trim();
      const sheetSubtopic = String(values?.sheet_subtopic || '').trim();
      const payload = {
        title,
        sheet_topic: sheetTopic,
        sheet_subtopic: sheetSubtopic,
        tasks: taskIds,
        task_order: taskIds,
        layout_snapshot: layoutSnapshot,
        page_size: printLayout.page,
        tasks_per_page: perPage,
      };

      let saved;
      if (currentPrintTest?.id) {
        saved = await api.updateGeometryPrintTest(currentPrintTest.id, payload);
        message.success('Лист обновлён');
      } else {
        saved = await api.createGeometryPrintTest(payload);
        message.success('Лист сохранён');
      }

      setCurrentPrintTest(saved);
      setHeaderTopic(sheetTopic);
      setHeaderSubtopic(sheetSubtopic);
      setSaveModalVisible(false);
    } catch (error) {
      message.error(`Ошибка сохранения: ${error?.message || 'неизвестная ошибка'}`);
    } finally {
      setSavingPrintTest(false);
    }
  }, [currentPrintTest, getTaskLayout, layoutOverrides.print, orderedTasks, perPage, printLayout.page]);

  const reorderTasks = useCallback((fromIndex, toIndex) => {
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    setOrderedTasks((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length) return prev;
      const target = Math.max(0, Math.min(toIndex, prev.length - 1));
      if (target === fromIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const handlePrint = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const styleId = 'geometry-print-page-size';
    document.getElementById(styleId)?.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `@media print { @page { size: ${printLayout.page} portrait; margin: 0; } }`;
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  }, [printLayout.page]);

  return (
    <div className="geometry-preview-root">
      <div className="geometry-preview-toolbar">
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            Назад к списку
          </Button>
          <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
          <Segmented options={DRAWING_OPTIONS} value={drawingMode} onChange={setDrawingMode} />
          <Space size={8}>
            <Switch checked={layoutEdit} onChange={setLayoutEdit} />
            <Text>Редактировать макет</Text>
          </Space>
          {!layoutEdit && (
            <Tag color="blue">Перетаскивайте карточки для смены порядка</Tag>
          )}
          {layoutEdit && (
            <Button icon={<UndoOutlined />} onClick={resetLayout}>
              Сбросить макет
            </Button>
          )}
          <Space size={8}>
            <Switch checked={showAnswers} onChange={setShowAnswers} />
            <Text>Показывать ответы</Text>
          </Space>
          <Space size={8}>
            <Switch checked={showGrid} onChange={setShowGrid} />
            <Text>Клетка</Text>
          </Space>
          {mode === 'print' && (
            <Space size={8}>
              <Text>Раскладка</Text>
              <Select
                value={printLayoutId}
                onChange={setPrintLayoutId}
                options={PRINT_LAYOUTS.map((l) => ({ value: l.id, label: l.label }))}
                style={{ width: 150 }}
              />
              <Tag>Задач/лист: {perPage} · Листов: {printPages.length}</Tag>
            </Space>
          )}
        </Space>
        <Space>
          <Button
            onClick={() => setSaveModalVisible(true)}
            disabled={mode !== 'print'}
          >
            {currentPrintTest?.id ? 'Обновить лист' : 'Сохранить лист'}
          </Button>
          {autosaveStatus === 'saving' && <Tag color="processing">Сохранение макета…</Tag>}
          {autosaveStatus === 'saved' && <Tag color="success">Макет сохранён ✓</Tag>}
          {autosaveStatus === 'error' && (
            <Button
              type="primary"
              onClick={handleSaveLayout}
              loading={savingLayout}
              disabled={pendingCount === 0}
            >
              Сохранить макет{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Button>
          )}
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            Печать
          </Button>
        </Space>
      </div>

      {mode === 'print' && (
        <div className="geometry-preview-header-inputs">
          <Input
            placeholder="Тема (заголовок листа)"
            value={headerTopic}
            onChange={(e) => setHeaderTopic(e.target.value)}
            style={{ maxWidth: 320 }}
            allowClear
          />
          <Input
            placeholder="Подтема (подзаголовок)"
            value={headerSubtopic}
            onChange={(e) => setHeaderSubtopic(e.target.value)}
            style={{ maxWidth: 320 }}
            allowClear
          />
        </div>
      )}

      {mode === 'print' ? (
        <div className="geometry-preview-pages">
          {printPages.map((pageTasks, pageIndex) => (
            <div
              className="geometry-preview-sheet is-print"
              key={`page-${pageIndex + 1}`}
              style={{ width: `${pageDims.w}mm`, height: `${pageDims.h}mm`, padding: '5mm' }}
            >
              {(headerTopic || headerSubtopic) && (
                <div className="geometry-preview-sheet-header">
                  {headerTopic && (
                    <div className="geometry-preview-sheet-topic">{headerTopic}</div>
                  )}
                  {headerSubtopic && (
                    <div className="geometry-preview-sheet-subtopic">{headerSubtopic}</div>
                  )}
                </div>
              )}
              <div className="geometry-preview-grid is-print" style={gridTemplate}>
                {pageTasks.map((task, idx) => {
                  const globalIndex = pageIndex * perPage + idx;
                  const taskKey = task?.id || task?.code || `slot-${pageIndex}-${idx}`;
                  const layout = getTaskLayout(task, globalIndex);
                  return (
                    <GeometryPreviewCard
                      key={taskKey}
                      task={task || {}}
                      index={globalIndex}
                      isPlaceholder={!task}
                      showAnswers={showAnswers}
                      mode={mode}
                      drawingMode={drawingMode}
                      editable={layoutEdit}
                      layout={layout}
                      hLines={gridLines.hLines}
                      vLines={gridLines.vLines}
                      fontK={printLayout.fontK}
                      showGrid={showGrid}
                      onLayoutChange={(layerName, patch) => handleLayoutChange(taskKey, layerName, patch)}
                      draggable={!layoutEdit && !!task}
                      onDragStart={!layoutEdit && !!task ? () => setDragTaskIndex(globalIndex) : undefined}
                      onDragOver={!layoutEdit ? (e) => {
                        if (layoutEdit || dragTaskIndex === null || dragTaskIndex === globalIndex) return;
                        e.preventDefault();
                        setDropTaskIndex(globalIndex);
                      } : undefined}
                      onDrop={!layoutEdit ? (e) => {
                        if (layoutEdit) return;
                        e.preventDefault();
                        reorderTasks(dragTaskIndex, globalIndex);
                        setDragTaskIndex(null);
                        setDropTaskIndex(null);
                      } : undefined}
                      onDragEnd={!layoutEdit ? () => {
                        setDragTaskIndex(null);
                        setDropTaskIndex(null);
                      } : undefined}
                      highlightDrop={!layoutEdit && dropTaskIndex === globalIndex}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="geometry-preview-sheet">
          <div className="geometry-preview-grid student">
            {visibleTasks.map((task, idx) => {
              const taskKey = task?.id || task?.code || `slot-${idx}`;
              const layout = getTaskLayout(task, idx);
              return (
                <GeometryPreviewCard
                  key={taskKey}
                  task={task || {}}
                  index={idx}
                  isPlaceholder={!task}
                  showAnswers={showAnswers}
                  mode={mode}
                  drawingMode={drawingMode}
                  editable={layoutEdit}
                  layout={layout}
                  showGrid={showGrid}
                  onLayoutChange={(layerName, patch) => handleLayoutChange(taskKey, layerName, patch)}
                  draggable={!layoutEdit && !!task}
                  onDragStart={!layoutEdit && !!task ? () => setDragTaskIndex(idx) : undefined}
                  onDragOver={!layoutEdit ? (e) => {
                    if (layoutEdit || dragTaskIndex === null || dragTaskIndex === idx) return;
                    e.preventDefault();
                    setDropTaskIndex(idx);
                  } : undefined}
                  onDrop={!layoutEdit ? (e) => {
                    if (layoutEdit) return;
                    e.preventDefault();
                    reorderTasks(dragTaskIndex, idx);
                    setDragTaskIndex(null);
                    setDropTaskIndex(null);
                  } : undefined}
                  onDragEnd={!layoutEdit ? () => {
                    setDragTaskIndex(null);
                    setDropTaskIndex(null);
                  } : undefined}
                  highlightDrop={!layoutEdit && dropTaskIndex === idx}
                />
              );
            })}
          </div>
        </div>
      )}
      <SaveGeometryPrintModal
        visible={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onSave={handleSaveAsPrintTest}
        saving={savingPrintTest}
        isUpdate={!!currentPrintTest?.id}
        tasksCount={perPage}
        initialTitle={
          currentPrintTest?.title
            || `Геометрия ${printLayout.page} · ${new Date().toLocaleDateString('ru-RU')}`
        }
        initialSheetTopic={headerTopic}
        initialSheetSubtopic={headerSubtopic}
      />
    </div>
  );
}
