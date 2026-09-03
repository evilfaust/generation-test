import { useState } from 'react';
import { printPaged } from '../utils/printPage';
import { MathInline } from './shared/MathInline';
import { Button, Slider, Checkbox, Divider, Space } from 'antd';
import { PrinterOutlined, FunctionOutlined, CheckSquareOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useAdditionFormulas } from '../hooks/useAdditionFormulas';
import { useTrigMCModal } from '../hooks/useTrigMCModal';
import TrigExprPrintLayout from './trig/TrigExprPrintLayout';
import { TrigMCSection } from './trig/TrigMCSection';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigPreviewCard,
  TrigStatBadge,
} from './trig/TrigGeneratorLayout';
import { SheetLayoutOptions } from './trig/sheetOptions';


const LABELS = Array.from({ length: 20 }, (_, i) => String(i + 1));

const TASK_TYPE_OPTIONS = [
  { value: 'formula_eval', label: 'Числовое распознавание' },
  { value: 'symbolic', label: 'Символьное упрощение' },
  { value: 'nonstandard', label: 'Нестандартные углы' },
];

const FUNC_OPTIONS = [
  { value: 'sin', label: 'sin' },
  { value: 'cos', label: 'cos' },
  { value: 'tan', label: 'tg' },
];

function getInstruction(taskTypes) {
  const hasEval = taskTypes.includes('formula_eval') || taskTypes.includes('nonstandard');
  const hasSym = taskTypes.includes('symbolic');
  if (hasSym && !hasEval) return 'Упростите выражение:';
  if (!hasSym && hasEval) return 'Вычислите:';
  return 'Вычислите или упростите:';
}

export default function AdditionFormulasGenerator() {
  const { title, setTitle, settings, updateSetting, tasksData, generate, reset } = useAdditionFormulas();
  const { modalOpen, setModalOpen, printTest, handlePrint: handleMCPrint } = useTrigMCModal();

  const handlePrint = () => printPaged();

  const { taskTypes, funcs, incSum, incDiff, variantsCount, tasksPerVariant } = settings;
  const instruction = getInstruction(taskTypes);

  return (
    <>
      <TrigGeneratorLayout
        icon={<FunctionOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            <TrigSettingsSection label="Типы задач">
              <Space direction="vertical" size={4}>
                {TASK_TYPE_OPTIONS.map(o => (
                  <Checkbox
                    key={o.value}
                    checked={taskTypes.includes(o.value)}
                    onChange={e => {
                      const next = e.target.checked ? [...taskTypes, o.value] : taskTypes.filter(t => t !== o.value);
                      if (next.length) updateSetting('taskTypes', next);
                    }}
                  >
                    {o.label}
                  </Checkbox>
                ))}
              </Space>
            </TrigSettingsSection>

            <TrigSettingsSection label="Функции и операции">
              <Checkbox.Group
                options={FUNC_OPTIONS}
                value={funcs}
                onChange={v => { if (v.length) updateSetting('funcs', v); }}
              />
              <Divider style={{ margin: '10px 0' }} />
              <Space direction="vertical" size={4}>
                <Checkbox checked={incSum} onChange={e => { if (e.target.checked || incDiff) updateSetting('incSum', e.target.checked); }}>
                  Сумма
                </Checkbox>
                <Checkbox checked={incDiff} onChange={e => { if (e.target.checked || incSum) updateSetting('incDiff', e.target.checked); }}>
                  Разность
                </Checkbox>
                {taskTypes.includes('nonstandard') && (
                  <Checkbox checked={settings.showHint} onChange={e => updateSetting('showHint', e.target.checked)}>
                    Подсказка разложения
                  </Checkbox>
                )}
              </Space>
            </TrigSettingsSection>

            <TrigSettingsSection label="Параметры">
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Задач в варианте: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{tasksPerVariant}</b>
              </div>
              <Slider min={4} max={20} value={tasksPerVariant} onChange={v => updateSetting('tasksPerVariant', v)} size="small" />
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{variantsCount}</b>
              </div>
              <Slider min={1} max={32} value={variantsCount} onChange={v => updateSetting('variantsCount', v)} marks={{ 1: '1', 10: '10', 20: '20', 32: '32' }} size="small" />
            </TrigSettingsSection>

            <TrigSettingsSection label="Печать и вид">
              <Space direction="vertical" size={6}>
                <Checkbox checked={settings.twoPerPage} onChange={e => updateSetting('twoPerPage', e.target.checked)}>
                  2 варианта на стр.
                </Checkbox>
                <Checkbox checked={settings.showTeacherKey} onChange={e => updateSetting('showTeacherKey', e.target.checked)}>
                  Лист ответов
                </Checkbox>
                <Checkbox checked={settings.showWorkSpace} onChange={e => updateSetting('showWorkSpace', e.target.checked)}>
                  Место для работы
                </Checkbox>
              </Space>
              {settings.showWorkSpace && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
                    Высота: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.workSpaceSize} мм</b>
                  </div>
                  <Slider min={2} max={50} value={settings.workSpaceSize} onChange={v => updateSetting('workSpaceSize', v)} marks={{ 2: '2', 15: '15', 30: '30', 50: '50' }} size="small" />
                </div>
              )}
              <Divider style={{ margin: '10px 0' }} />
              <SheetLayoutOptions settings={settings} onChange={updateSetting} />
            </TrigSettingsSection>

            <TrigActions>
              <Button type="primary" block icon={<ThunderboltOutlined />} onClick={generate}>
                Сформировать
              </Button>
              {tasksData && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button block icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
                  <Button block icon={<CheckSquareOutlined />} onClick={() => setModalOpen(true)}>Тест</Button>
                </div>
              )}
              {tasksData && <Button block onClick={reset}>Сбросить</Button>}
            </TrigActions>
          </div>
        }
        right={
          <TrigPreviewPane
            hasData={Boolean(tasksData)}
            emptyIcon={<FunctionOutlined />}
            emptyTitle="Настройте параметры и нажмите «Сформировать»"
            emptyHint="Формулы сложения"
            summary={[
              <TrigStatBadge key="types" tone="accent">{taskTypes.length} типа</TrigStatBadge>,
              <TrigStatBadge key="funcs">{funcs.join(', ')}</TrigStatBadge>,
              <TrigStatBadge key="tasks">{tasksPerVariant} задач</TrigStatBadge>,
              <TrigStatBadge key="variants" tone="success">{variantsCount} вар.</TrigStatBadge>,
            ]}
          >
            {tasksData?.map((variant, vi) => (
              <TrigPreviewCard key={vi} title={`Вариант ${vi + 1}`} meta={`${variant.length} заданий`}>
                {variant.map((q, qi) => (
                  <div key={qi} style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                    padding: '5px 0',
                    borderBottom: qi < variant.length - 1 ? '1px dotted var(--rule-soft)' : 'none',
                    fontSize: 13,
                  }}>
                    <span style={{ fontWeight: 600, minWidth: 20, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                      {LABELS[qi]})
                    </span>
                    <span style={{ flex: 1 }}><MathInline latex={q.exprLatex} /></span>
                    <span style={{ color: 'var(--rule)', padding: '0 4px' }}>=</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 500 }}><MathInline latex={q.resultLatex} /></span>
                  </div>
                ))}
              </TrigPreviewCard>
            ))}
          </TrigPreviewPane>
        }
      />

      {tasksData && (
        <TrigExprPrintLayout
          tasksData={tasksData}
          settings={settings}
          title={title}
          instruction={instruction}
          questionMode="inline"
        />
      )}

      <TrigMCSection
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        printTest={printTest}
        onPrint={handleMCPrint}
        tasksData={tasksData}
        generatorType="addition_formulas"
        generatorTitle={title}
        settings={settings}
      />
    </>
  );
}
