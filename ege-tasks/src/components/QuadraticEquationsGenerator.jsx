import { useState } from 'react';
import {
  Button, Slider, Checkbox, Space, Switch, Divider, Segmented,
} from 'antd';
import {
  PrinterOutlined, CheckSquareOutlined, ThunderboltOutlined,
  FunctionOutlined, FormOutlined,
} from '@ant-design/icons';
import {
  useQuadraticEquations,
  quadInstruction,
  CATEGORY_LABELS_QUAD,
  CATEGORY_GROUPS_QUAD,
} from '../hooks/useQuadraticEquations';
import { useTrigMCModal } from '../hooks/useTrigMCModal';
import OralCountingPrintLayout from './trig/OralCountingPrintLayout';
import { SheetOrderPanel } from './trig/SheetOrderPanel';
import { CategoryChecklist } from './trig/CategoryChecklist';
import { plannedTotal } from '../utils/questionPlan';
import { useSheetLayout } from '../hooks/useSheetLayout';
import { useSheetTools } from '../hooks/useSheetTools';
import { SheetStorageActions } from './trig/SheetStorageActions';
import { SheetToolsModals } from './trig/SheetTools';
import { TrigMCSection } from './trig/TrigMCSection';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigStatBadge,
  TrigBlockToggle,
} from './trig/TrigGeneratorLayout';
import { SheetLayoutOptions } from './trig/sheetOptions';

// Размах чисел внутри одного и того же типа заданий: корни и коэффициенты
// растут, приём остаётся прежним
const LEVELS = [
  { value: 1, label: 'Лёгкий' },
  { value: 2, label: 'Средний' },
  { value: 3, label: 'Сложный' },
];

const ROOT_KINDS = [
  { value: 'any',      label: 'Любые' },
  { value: 'rational', label: 'Без корней √' },
  { value: 'integer',  label: 'Целые' },
];

const ANSWER_STYLES = [
  { value: 'list',    label: '−3; 5' },
  { value: 'indexed', label: 'x₁, x₂' },
];

export default function QuadraticEquationsGenerator() {
  const {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData, setTasksData, applySheet,
    generate, reset,
  } = useQuadraticEquations();

  const { modalOpen, setModalOpen, printTest, handlePrint: handleMCPrint } = useTrigMCModal();
  const [mcFillMode, setMcFillMode] = useState(false);
  const order = useSheetLayout(tasksData);
  const sheet = useSheetTools({
    generator: 'quadratic_equations',
    hook: { title, settings, tasksData, setTasksData, applySheet },
    order,
  });

  const updateCount = (cat, value) => updateSetting('categoryCounts', {
    ...(settings.categoryCounts || {}),
    [cat]: value || undefined,
  });

  const plannedCount = plannedTotal(
    settings.categories, settings.questionsCount, settings.categoryCounts,
  );

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'oral-print-page-style';
    style.textContent = `@page { size: A4 portrait; margin: 0; }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('oral-print-page-style');
      if (s) s.remove();
    }, 1500);
  };

  const toggleBlock = (keys, checked) => keys.forEach(k => updateCategory(k, checked));

  const enabledCount = Object.values(settings.categories).filter(Boolean).length;
  const varCount = tasksData?.length ?? 0;
  const qCount = tasksData?.[0]?.length ?? plannedCount;
  const instruction = quadInstruction(settings.categories);

  return (
    <>
      <TrigGeneratorLayout
        icon={<FunctionOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Название листа"
        leftWidth={350}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>

            {/* Категории заданий */}
            {CATEGORY_GROUPS_QUAD.map(group => (
              <TrigSettingsSection
                key={group.label}
                label={
                  <TrigBlockToggle
                    label={group.label}
                    keys={group.keys}
                    categories={settings.categories}
                    onToggleBlock={toggleBlock}
                  />
                }
              >
                <CategoryChecklist
                  keys={group.keys}
                  labels={CATEGORY_LABELS_QUAD}
                  categories={settings.categories}
                  counts={settings.categoryCounts || {}}
                  onToggle={updateCategory}
                  onCount={updateCount}
                />
              </TrigSettingsSection>
            ))}

            {/* Параметры */}
            <TrigSettingsSection label="Параметры">
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Заданий в варианте: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{plannedCount}</b>
                {plannedCount !== settings.questionsCount && (
                  <span style={{ color: 'var(--ink-4)' }}> — по количеству типов</span>
                )}
              </div>
              <Slider
                min={2} max={30} step={1}
                value={settings.questionsCount}
                onChange={v => updateSetting('questionsCount', v)}
                marks={{ 5: '5', 10: '10', 20: '20', 30: '30' }}
                size="small"
              />
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.variantsCount}</b>
              </div>
              <Slider
                min={1} max={32}
                value={settings.variantsCount}
                onChange={v => updateSetting('variantsCount', v)}
                marks={{ 1: '1', 8: '8', 16: '16', 32: '32' }}
                size="small"
              />
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>Числа:</span>
                <Segmented
                  size="small"
                  options={LEVELS}
                  value={settings.level}
                  onChange={v => updateSetting('level', v)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>Корни:</span>
                <Segmented
                  size="small"
                  options={ROOT_KINDS}
                  value={settings.rootKind}
                  onChange={v => updateSetting('rootKind', v)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>Ответ:</span>
                <Segmented
                  size="small"
                  options={ANSWER_STYLES}
                  value={settings.answerStyle}
                  onChange={v => updateSetting('answerStyle', v)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>Буквы:</span>
                <Segmented
                  size="small"
                  options={[
                    { value: 'x', label: 'x' },
                    { value: 'xy', label: 'x, y' },
                    { value: 'mixed', label: 'Разные' },
                  ]}
                  value={settings.varsMode}
                  onChange={v => updateSetting('varsMode', v)}
                />
              </div>
              <Checkbox
                checked={settings.usePm !== false}
                disabled={settings.answerStyle === 'indexed'}
                onChange={e => updateSetting('usePm', e.target.checked)}
              >
                <span style={{ fontSize: 13 }}>Писать ±7 вместо «−7; 7»</span>
              </Checkbox>
            </TrigSettingsSection>

            {/* Печать и вид */}
            <TrigSettingsSection label="Печать и вид">
              <Space direction="vertical" size={6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    size="small"
                    checked={settings.columnsCount === 2}
                    onChange={v => updateSetting('columnsCount', v ? 2 : 1)}
                  />
                  <span style={{ fontSize: 13 }}>2 колонки на листе</span>
                </div>
                <Checkbox
                  checked={settings.showTeacherKey}
                  onChange={e => updateSetting('showTeacherKey', e.target.checked)}
                >
                  Лист ответов (учитель)
                </Checkbox>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13 }}>Шрифт:</span>
                  <Segmented
                    size="small"
                    options={['S', 'M', 'L']}
                    value={(settings.fontSize || 's').toUpperCase()}
                    onChange={v => updateSetting('fontSize', v.toLowerCase())}
                  />
                </div>
              </Space>
              <Divider style={{ margin: '10px 0' }} />
              <SheetLayoutOptions settings={settings} onChange={updateSetting} showPerPage />
            </TrigSettingsSection>

            {/* Порядок заданий и черта — только когда есть что переставлять */}
            {tasksData && (
              <SheetOrderPanel
                layout={order.layout}
                categoryLabels={CATEGORY_LABELS_QUAD}
                sample={tasksData[0] || []}
                onMove={order.move}
                onAddDivider={order.addDivider}
                onRemoveAt={order.removeAt}
                onReset={order.reset}
                onEditTask={sheet.openTask}
                onAddTask={sheet.openAdd}
              />
            )}

            {/* Действия */}
            <TrigActions>
              <Button
                type="primary" block
                icon={<ThunderboltOutlined />}
                onClick={() => generate()}
                disabled={enabledCount === 0}
              >
                Сформировать
              </Button>
              {tasksData && (
                <>
                  <Button block icon={<PrinterOutlined />} onClick={handlePrint}>
                    Печать
                  </Button>
                  <SheetStorageActions
                    storage={sheet.storage}
                    hasData={Boolean(tasksData)}
                    generator="quadratic_equations"
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button
                      block
                      icon={<CheckSquareOutlined />}
                      onClick={() => { setMcFillMode(false); setModalOpen(true); }}
                    >
                      Тест A/B/C/D
                    </Button>
                    <Button
                      block
                      icon={<FormOutlined />}
                      onClick={() => { setMcFillMode(true); setModalOpen(true); }}
                    >
                      Вписать ответ
                    </Button>
                  </div>
                  <Button block onClick={reset}>Сбросить</Button>
                </>
              )}
            </TrigActions>
          </div>
        }
        right={
          <TrigPreviewPane
            hasData={Boolean(tasksData)}
            emptyIcon={<FunctionOutlined />}
            emptyTitle="Настройте параметры и нажмите «Сформировать»"
            emptyHint={`Активных категорий: ${enabledCount}`}
            summary={[
              <TrigStatBadge key="cats" tone="accent">{enabledCount} кат.</TrigStatBadge>,
              <TrigStatBadge key="q">{qCount} зад.</TrigStatBadge>,
              <TrigStatBadge key="v" tone="success">{varCount || settings.variantsCount} вар.</TrigStatBadge>,
              <TrigStatBadge key="fs">{(settings.fontSize || 's').toUpperCase()}</TrigStatBadge>,
            ].filter(Boolean)}
          >
            {tasksData && (
              <OralCountingPrintLayout
                tasksData={tasksData}
                settings={settings}
                title={title}
                layout={order.layout}
                equationMode
                promptMode="answer"
                instruction={instruction}
                screenMode
                fontSize={settings.fontSize || 's'}
              />
            )}
          </TrigPreviewPane>
        }
      />

      {/* Печатная вёрстка */}
      {tasksData && (
        <OralCountingPrintLayout
          tasksData={tasksData}
          settings={settings}
          title={title}
          layout={order.layout}
          equationMode
          promptMode="answer"
          instruction={instruction}
          fontSize={settings.fontSize || 's'}
        />
      )}

      <SheetToolsModals sheet={sheet} />

      <TrigMCSection
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        printTest={printTest}
        onPrint={handleMCPrint}
        tasksData={tasksData}
        generatorType="quadratic_equations"
        generatorTitle={title}
        settings={settings}
        fillMode={mcFillMode}
      />
    </>
  );
}
