import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Input, Segmented, Space, Switch, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, UndoOutlined } from '@ant-design/icons';
import { api } from '../shared/services/pocketbase';
import MathRenderer from './MathRenderer';
import SaveGeometryPrintModal from './geometry/SaveGeometryPrintModal';
import './GeometryTaskPreview.css';

const { Text } = Typography;

const MODE_OPTIONS = [
  { label: 'Печать A5 (6)', value: 'print' },
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
    if (mode === 'print') return `${(2.05 * layout.text.fontScale).toFixed(2)}mm`;
    return `${Math.round(17 * layout.text.fontScale)}px`;
  }, [layout.text.fontScale, mode]);

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
        {/* Клетка 5 мм — div-линии с физическими mm/pt-единицами → нативные векторы в PDF */}
        {Array.from({ length: 15 }, (_, i) => (
          <div key={`gh-${i}`} className="geo-preview-h-line" style={{ top: `${(i + 1) * 5}mm` }} />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <div key={`gv-${i}`} className="geo-preview-v-line" style={{ left: `${(i + 1) * 5}mm` }} />
        ))}

        <div
          className={`geometry-preview-layer geometry-preview-layer-image ${editable ? 'editable' : ''}`}
          style={toLayerStyle(layout.image, 1)}
          onPointerDown={(e) => startInteraction(e, 'image', 'move')}
        >
          {isPlaceholder ? null : showImage && imageValue ? (
            <img
              className="geometry-preview-image"
              src={imageValue}
              alt={`Чертёж ${task.code || index + 1}`}
              draggable={false}
            />
          ) : (
            <div className="geometry-preview-drawing-placeholder">Чертёж не задан</div>
          )}

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
  const [drawingMode, setDrawingMode] = useState('task');
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

  // Задаём формат страницы A5 при печати и убираем при демонтировании,
  // чтобы не ломать @page других разделов приложения.
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@page { size: A5 portrait; margin: 0; }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

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
        try {
          const existing = safeParseLayout(currentTaskLayouts[taskKey]) || {};
          const nextPreviewLayout = {
            ...existing,
            [currentMode]: normalizeLayout(layoutForMode, currentMode),
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
              [currentMode]: normalizeLayout(layoutForMode, currentMode),
            };
          });
          return next;
        });
        setLayoutOverrides((prev) => ({ ...prev, [currentMode]: {} }));
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
    for (let i = 0; i < orderedTasks.length; i += PRINT_TASKS_PER_PAGE) {
      pages.push(orderedTasks.slice(i, i + PRINT_TASKS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);
    return pages.map((pageTasks) =>
      Array.from({ length: PRINT_TASKS_PER_PAGE }, (_, i) => pageTasks[i] || null));
  }, [orderedTasks]);
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
      const currentTaskLayout = normalizeLayout(prev[mode]?.[taskKey], mode);
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
  }, [mode, scheduleAutosave]);

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
        setLayoutOverrides((prev) => ({ ...prev, [mode]: {} }));
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
    if (printTasks.length !== 6) {
      message.error('Для печатного теста нужно ровно 6 задач на листе A5');
      return;
    }
    const title = String(values?.title || '').trim();
    if (!title) return;

    const taskIds = printTasks.map((t) => t.id).filter(Boolean);
    if (taskIds.length !== 6) {
      message.error('Не удалось определить id всех 6 задач');
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
        page_size: 'A5',
        tasks_per_page: 6,
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
  }, [currentPrintTest, getTaskLayout, layoutOverrides.print, orderedTasks]);

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

  const handlePrintA5 = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const styleId = 'geometry-print-page-size';
    document.getElementById(styleId)?.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@media print { @page { size: A5 portrait; margin: 0; } }';
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  }, []);

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
          {mode === 'print' && <Tag>A5: {PRINT_TASKS_PER_PAGE} задач на лист · Листов: {printPages.length}</Tag>}
        </Space>
        <Space>
          <Button
            onClick={() => setSaveModalVisible(true)}
            disabled={mode !== 'print'}
          >
            {currentPrintTest?.id ? 'Обновить лист A5' : 'Сохранить лист A5'}
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
          <Button icon={<PrinterOutlined />} onClick={handlePrintA5}>
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
            <div className="geometry-preview-sheet a5" key={`page-${pageIndex + 1}`}>
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
              <div className="geometry-preview-grid a5">
                {pageTasks.map((task, idx) => {
                  const globalIndex = pageIndex * PRINT_TASKS_PER_PAGE + idx;
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
        tasksCount={PRINT_TASKS_PER_PAGE}
        initialTitle={
          currentPrintTest?.title
            || `Геометрия A5 · ${new Date().toLocaleDateString('ru-RU')}`
        }
        initialSheetTopic={headerTopic}
        initialSheetSubtopic={headerSubtopic}
      />
    </div>
  );
}
