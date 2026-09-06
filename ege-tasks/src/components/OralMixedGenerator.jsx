import { useState, useCallback, useMemo } from 'react';
import {
  Button, Slider, Checkbox, Space, Switch, Divider, Segmented,
  Select, Input, InputNumber, Dropdown, Typography,
} from 'antd';
import {
  PrinterOutlined, ThunderboltOutlined, AppstoreAddOutlined,
  PlusOutlined, DeleteOutlined, HolderOutlined, FunctionOutlined,
} from '@ant-design/icons';
import { SplitLayout, ConfigLabel } from '../ui';
import OralMixedPrintLayout from './trig/OralMixedPrintLayout';
import { ORAL_TYPES, getOralType } from '../hooks/oralMixedRegistry';
import { SheetLayoutOptions, SHEET_DEFAULTS } from './trig/sheetOptions';
import { useSheetTools } from '../hooks/useSheetTools';
import { SheetStorageActions } from './trig/SheetStorageActions';

const { Text } = Typography;

// Уникальный id для секции
let _sectionCounter = 0;
const nextSectionId = () => `s${Date.now()}-${++_sectionCounter}`;

// Стартовая секция
function makeSection(type) {
  const meta = getOralType(type);
  if (!meta) return null;
  return {
    id: nextSectionId(),
    type,
    questionsCount: 5,
    categories: { ...meta.defaultCategories },
    decimalOnly: false,
  };
}

// ─── Компонент настроек одной секции ──────────────────────────────────────────
function SectionPanel({ section, onUpdate, onRemove, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDropTarget }) {
  const meta = getOralType(section.type);
  if (!meta) return null;

  const setField = (k, v) => onUpdate({ ...section, [k]: v });
  const toggleCat = (catKey, checked) => onUpdate({
    ...section,
    categories: { ...section.categories, [catKey]: checked },
  });

  const enabledCount = Object.values(section.categories).filter(Boolean).length;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, section.id)}
      onDragOver={e => onDragOver(e, section.id)}
      onDrop={e => onDrop(e, section.id)}
      onDragEnd={onDragEnd}
      style={{
        padding: '8px 10px',
        border: `1px solid ${isDropTarget ? 'var(--accent)' : 'var(--accent)'}`,
        borderRadius: 'var(--radius)',
        background: 'var(--accent-soft)',
        opacity: isDragging ? 0.5 : 1,
        transition: 'opacity .15s, border-color .15s, background .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <HolderOutlined style={{ color: 'var(--ink-4)', cursor: 'grab', fontSize: 13 }} />
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>
          {meta.label}
        </span>
        <Button
          size="small" type="text" danger
          icon={<DeleteOutlined />}
          onClick={() => onRemove(section.id)}
        />
      </div>

      <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>Заданий:</Text>
          <InputNumber
            min={1} max={20}
            value={section.questionsCount}
            onChange={v => setField('questionsCount', v || 1)}
            size="small"
            style={{ width: 64 }}
          />
          <Checkbox
            checked={!!section.decimalOnly}
            onChange={e => setField('decimalOnly', e.target.checked)}
            style={{ fontSize: 11 }}
          >
            <span style={{ fontSize: 11 }}>Только целые/дес.</span>
          </Checkbox>
        </div>

        <details style={{ fontSize: 11 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--ink-3)', fontSize: 11, userSelect: 'none' }}>
            Категории: {enabledCount} из {Object.keys(meta.categoryLabels).length}
          </summary>
          <Space direction="vertical" size={2} style={{ marginTop: 6, paddingLeft: 4 }}>
            {Object.entries(meta.categoryLabels).map(([catKey, label]) => (
              <Checkbox
                key={catKey}
                checked={!!section.categories[catKey]}
                onChange={e => toggleCat(catKey, e.target.checked)}
              >
                <span style={{ fontSize: 11 }}>{label}</span>
              </Checkbox>
            ))}
          </Space>
        </details>
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function OralMixedGenerator() {
  const [workTitle, setWorkTitle] = useState('Смешанная работа: устный счёт');
  const [variantsCount, setVariantsCount] = useState(4);
  const [sections, setSections] = useState(() => [
    makeSection('oral_counting'),
  ]);
  const [showTeacherKey, setShowTeacherKey] = useState(true);
  const [showSectionHeaders, setShowSectionHeaders] = useState(true);
  const [columnsCount, setColumnsCount] = useState(2);
  const [fontSize, setFontSize] = useState('s');
  // Общие настройки листа (шапка, класс, название, интервал) — как в остальных
  // генераторах; здесь они лежат отдельным объектом, а не в settings хука.
  // Раскладка листа («вариантов на листе») живёт здесь же, рядом с шапкой и
  // интервалом: переключатель общий с устным счётом (SheetLayoutOptions).
  const [sheet, setSheet] = useState({ ...SHEET_DEFAULTS, variantsPerPage: '2side' });
  const updateSheet = (k, v) => setSheet(p => ({ ...p, [k]: v }));

  const [generated, setGenerated] = useState(null); // массив variants для печати
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Сохранение листа (generator_sheets). У смешанной работы состояние размазано
  // по отдельным useState — собираем его в один объект настроек и обратно.
  const applySheet = useCallback((s) => {
    const st = s.settings || {};
    if (st.workTitle) setWorkTitle(st.workTitle);
    if (typeof st.variantsCount === 'number') setVariantsCount(st.variantsCount);
    if (Array.isArray(st.sections)) setSections(st.sections);
    if (typeof st.showTeacherKey === 'boolean') setShowTeacherKey(st.showTeacherKey);
    if (typeof st.showSectionHeaders === 'boolean') setShowSectionHeaders(st.showSectionHeaders);
    if (typeof st.columnsCount === 'number') setColumnsCount(st.columnsCount);
    if (st.fontSize) setFontSize(st.fontSize);
    // Листы, сохранённые до переключателя, несут только sideBySide/twoPerPage.
    const legacyPerPage = st.sideBySide === false
      ? (st.twoPerPage ? '2half' : 1)
      : '2side';
    setSheet({
      ...SHEET_DEFAULTS,
      variantsPerPage: legacyPerPage,
      ...(st.sheet || {}),
    });
    setGenerated(s.tasksData ?? null);
  }, []);

  const sheetTools = useSheetTools({
    generator: 'oral_mixed',
    hook: {
      title: workTitle,
      settings: {
        workTitle, variantsCount, sections,
        showTeacherKey, showSectionHeaders, columnsCount, fontSize, sheet,
      },
      tasksData: generated,
      setTasksData: setGenerated,
      applySheet,
    },
  });

  // Добавление новой секции через dropdown
  const addMenuItems = ORAL_TYPES.map(t => ({
    key: t.type,
    label: t.label,
  }));

  const addSection = (type) => {
    const s = makeSection(type);
    if (s) setSections(prev => [...prev, s]);
  };

  const updateSection = (newSec) => {
    setSections(prev => prev.map(s => s.id === newSec.id ? newSec : s));
  };

  const removeSection = (id) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  // ─── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null); setDragOverId(null);
      return;
    }
    setSections(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(s => s.id === dragId);
      const toIdx = next.findIndex(s => s.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragId(null); setDragOverId(null);
  };
  const handleDragEnd = () => { setDragId(null); setDragOverId(null); };

  // ─── Генерация ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    // Для каждой секции — массив variantsCount наборов
    const perSection = sections.map(sec => {
      const meta = getOralType(sec.type);
      if (!meta) return null;
      const variants = meta.generator({
        variantsCount,
        questionsCount: sec.questionsCount,
        categories: sec.categories,
        decimalOnly: sec.decimalOnly,
      });
      return { sec, meta, variants };
    }).filter(Boolean);

    // Собираем variants × sections
    const mixed = Array.from({ length: variantsCount }, (_, vi) => ({
      number: vi + 1,
      sections: perSection.map(({ sec, meta, variants }) => ({
        id: sec.id,
        label: meta.label,
        instruction: meta.instruction,
        equationMode: meta.equationMode,
        promptMode: meta.promptMode,
        tasks: variants[vi] || [],
      })),
    }));

    setGenerated(mixed);
  }, [sections, variantsCount]);

  const handleReset = () => {
    setGenerated(null);
  };

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'oral-mixed-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('oral-mixed-print-page-style');
      if (s) s.remove();
    }, 1500);
  };

  const totalTasks = useMemo(() => {
    return sections.reduce((s, x) => s + (x.questionsCount || 0), 0);
  }, [sections]);

  const printSettings = {
    showTeacherKey,
    columnsCount,
    showSectionHeaders,
    ...sheet,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Заголовок */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 12, borderBottom: '1px solid var(--rule)', marginBottom: 16,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AppstoreAddOutlined style={{ fontSize: 14 }} />
        </div>
        <Input
          value={workTitle}
          onChange={e => setWorkTitle(e.target.value)}
          placeholder="Название работы"
          style={{ flex: 1, fontWeight: 500 }}
        />
      </div>

      <SplitLayout leftWidth={360} gap={20} style={{ flex: 1, minHeight: 0 }}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 10 }}>
            {/* Вариантов */}
            <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius)', border: '1px solid var(--rule-soft)' }}>
              <ConfigLabel>Настройки</ConfigLabel>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{variantsCount}</b>
              </div>
              <Slider
                min={1} max={32} value={variantsCount}
                onChange={setVariantsCount}
                marks={{ 1: '1', 4: '4', 8: '8', 16: '16', 32: '32' }}
                size="small"
              />
            </div>

            {/* Разделы */}
            <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Разделы · {sections.length} · {totalTasks} зад. в варианте
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px 4px', margin: '0 -4px' }}>
              {sections.map(sec => (
                <SectionPanel
                  key={sec.id}
                  section={sec}
                  onUpdate={updateSection}
                  onRemove={removeSection}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  isDragging={dragId === sec.id}
                  isDropTarget={dragOverId === sec.id && dragId !== sec.id}
                />
              ))}

              <Dropdown
                menu={{
                  items: addMenuItems,
                  onClick: ({ key }) => addSection(key),
                }}
                trigger={['click']}
              >
                <Button block icon={<PlusOutlined />} type="dashed">
                  Добавить раздел
                </Button>
              </Dropdown>
            </div>

            {/* Параметры печати */}
            <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius)' }}>
              <ConfigLabel>Параметры печати</ConfigLabel>
              <Space direction="vertical" size={6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    size="small"
                    checked={columnsCount === 2}
                    onChange={v => setColumnsCount(v ? 2 : 1)}
                  />
                  <span style={{ fontSize: 13 }}>2 колонки на листе</span>
                </div>
                <Checkbox checked={showSectionHeaders} onChange={e => setShowSectionHeaders(e.target.checked)}>
                  Заголовки разделов
                </Checkbox>
                <Checkbox checked={showTeacherKey} onChange={e => setShowTeacherKey(e.target.checked)}>
                  Лист ответов (учитель)
                </Checkbox>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13 }}>Шрифт:</span>
                  <Segmented
                    size="small"
                    options={['S', 'M', 'L']}
                    value={fontSize.toUpperCase()}
                    onChange={v => setFontSize(v.toLowerCase())}
                  />
                </div>
              </Space>
              <Divider style={{ margin: '10px 0' }} />
              <SheetLayoutOptions
                // Заголовки разделов съедают примерно строку задания каждый —
                // иначе прикидка вместимости у смешанной работы врёт в плюс.
                settings={{
                  ...sheet,
                  questionsCount: totalTasks + (showSectionHeaders ? sections.length : 0),
                  columnsCount,
                }}
                onChange={updateSheet}
                showPerPage
              />
            </div>

            {/* Кнопки */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Button
                type="primary" block
                icon={<ThunderboltOutlined />}
                onClick={handleGenerate}
                disabled={!sections.length}
              >
                Сформировать
              </Button>
              {generated && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button block icon={<PrinterOutlined />} onClick={handlePrint}>
                    Печать
                  </Button>
                  <Button block onClick={handleReset}>
                    Сбросить
                  </Button>
                </div>
              )}
              <SheetStorageActions
                storage={sheetTools.storage}
                hasData={Boolean(generated)}
                generator="oral_mixed"
              />
            </div>
          </div>
        }
        right={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {!generated ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-3)' }}>
                <AppstoreAddOutlined style={{ fontSize: 32, marginBottom: 12, color: 'var(--ink-4)' }} />
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-3)' }}>
                  Добавьте разделы и нажмите «Сформировать»
                </div>
                <div style={{ fontSize: 12, marginTop: 8, color: 'var(--ink-4)' }}>
                  Разделов: {sections.length} · Заданий в варианте: {totalTasks}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Предпросмотр</h2>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)',
                    padding: '2px 8px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--rule)',
                  }}>
                    {generated.length} вар. · {totalTasks} зад.
                  </span>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <OralMixedPrintLayout
                    variants={generated}
                    title={workTitle}
                    settings={printSettings}
                    screenMode
                    fontSize={fontSize}
                  />
                </div>
              </div>
            )}
          </div>
        }
      />

      {generated && (
        <OralMixedPrintLayout
          variants={generated}
          title={workTitle}
          settings={printSettings}
          fontSize={fontSize}
        />
      )}
    </div>
  );
}
