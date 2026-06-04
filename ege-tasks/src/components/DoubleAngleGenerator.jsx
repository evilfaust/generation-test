import { MathInline } from './shared/MathInline';
import { printPaged } from '../utils/printPage';
import { Button, Slider, Checkbox, Divider, Space } from 'antd';
import { PrinterOutlined, FunctionOutlined, CheckSquareOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useDoubleAngle } from '../hooks/useDoubleAngle';
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


const LABELS = Array.from({ length: 20 }, (_, i) => String(i + 1));

const TASK_TYPE_OPTIONS = [
  { value: 'numeric', label: 'Числовое вычисление' },
  { value: 'symbolic', label: 'Символьное упрощение' },
  { value: 'mixed', label: 'Распознавание формул' },
];

const FUNC_OPTIONS = [
  { value: 'sin', label: 'sin' },
  { value: 'cos', label: 'cos' },
  { value: 'tan', label: 'tg' },
];

function getInstruction(taskTypes) {
  const hasEval = taskTypes.includes('numeric');
  const hasSym = taskTypes.includes('symbolic') || taskTypes.includes('mixed');
  if (hasSym && !hasEval) return 'Упростите выражение:';
  if (!hasSym && hasEval) return 'Вычислите:';
  return 'Вычислите или упростите:';
}

export default function DoubleAngleGenerator() {
  const { modalOpen, setModalOpen, printTest, handlePrint: handleMCPrint } = useTrigMCModal();
  const { title, setTitle, settings, updateSetting, tasksData, generate, reset } = useDoubleAngle();

  const handlePrint = () => printPaged();

  const { taskTypes, funcs, incSin, incCos, incTan, variantsCount, tasksPerVariant } = settings;
  const instruction = getInstruction(taskTypes);
  const selectedTypes = TASK_TYPE_OPTIONS.filter(o => taskTypes.includes(o.value)).map(o => o.label).join(', ');
  const selectedFuncs = FUNC_OPTIONS.filter(o => funcs.includes(o.value)).map(o => o.label).join(', ');

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

            <TrigSettingsSection label="Функции и формулы">
              <Checkbox.Group
                options={FUNC_OPTIONS}
                value={funcs}
                onChange={v => { if (v.length) updateSetting('funcs', v); }}
              />
              <Divider style={{ margin: '10px 0' }} />
              <Space direction="vertical" size={4}>
                <Checkbox checked={incCos} onChange={e => { if (e.target.checked || incSin || incTan) updateSetting('incCos', e.target.checked); }}>
                  cos2a
                </Checkbox>
                <Checkbox checked={incSin} onChange={e => { if (e.target.checked || incCos || incTan) updateSetting('incSin', e.target.checked); }}>
                  sin2a
                </Checkbox>
                {funcs.includes('tan') && (
                  <Checkbox checked={incTan} onChange={e => { if (e.target.checked || incSin || incCos) updateSetting('incTan', e.target.checked); }}>
                    tg2a
                  </Checkbox>
                )}
              </Space>
            </TrigSettingsSection>

            <TrigSettingsSection label="Параметры">
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Задач в варианте: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{tasksPerVariant}</b>
              </div>
              <Slider min={4} max={20} value={tasksPerVariant} onChange={v => updateSetting('tasksPerVariant', v)} marks={{ 4: '4', 8: '8', 12: '12', 20: '20' }} size="small" />
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
            emptyHint={selectedTypes || 'Формулы двойного аргумента'}
            summary={[
              <TrigStatBadge key="types" tone="accent">{selectedTypes || 'Типы'}</TrigStatBadge>,
              <TrigStatBadge key="funcs">{selectedFuncs || 'Функции'}</TrigStatBadge>,
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
        generatorType="double_angle"
        generatorTitle={title}
        settings={settings}
      />
    </>
  );
}
