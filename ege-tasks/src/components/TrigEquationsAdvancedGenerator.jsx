import { MathInline } from './shared/MathInline';
import { printPaged } from '../utils/printPage';
import { Button, Slider, Checkbox, Divider, Space } from 'antd';
import { PrinterOutlined, FunctionOutlined, CheckSquareOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTrigEquationsAdvanced } from '../hooks/useTrigEquationsAdvanced';
import { useTrigMCModal } from '../hooks/useTrigMCModal';
import TrigExprPrintLayout from './trig/TrigExprPrintLayout';
import { useSheetTools } from '../hooks/useSheetTools';
import { SheetStorageActions } from './trig/SheetStorageActions';
import { SheetToolsModals, SheetTasksPanel } from './trig/SheetTools';
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

export default function TrigEquationsAdvancedGenerator() {
  const {
    title, setTitle, settings, updateSetting, tasksData, generate, reset,
    setTasksData, applySheet,
  } = useTrigEquationsAdvanced();
  // Сохранение листа + правка отдельных заданий
  const sheet = useSheetTools({
    generator: 'trig_equations_advanced',
    hook: { title, settings, tasksData, setTasksData, applySheet },
  });
  const { modalOpen, setModalOpen, printTest, handlePrint: handleMCPrint } = useTrigMCModal();

  const handlePrint = () => printPaged();

  return (
    <>
      <TrigGeneratorLayout
        icon={<FunctionOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            <TrigSettingsSection label="Параметры">
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Заданий в варианте: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.questionsCount}</b>
              </div>
              <Slider min={2} max={12} value={settings.questionsCount} onChange={v => updateSetting('questionsCount', v)} marks={{ 2: '2', 6: '6', 10: '10', 12: '12' }} size="small" />
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.variantsCount}</b>
              </div>
              <Slider min={1} max={32} value={settings.variantsCount} onChange={v => updateSetting('variantsCount', v)} marks={{ 1: '1', 10: '10', 20: '20', 32: '32' }} size="small" />
            </TrigSettingsSection>

            <TrigSettingsSection label="Типы уравнений">
              <Space direction="vertical" size={4}>
                <Checkbox checked={settings.useType1} onChange={e => updateSetting('useType1', e.target.checked)}>
                  f(kx) = a
                </Checkbox>
                <Checkbox checked={settings.useType2} onChange={e => updateSetting('useType2', e.target.checked)}>
                  A·f(kx + b) = c
                </Checkbox>
              </Space>
            </TrigSettingsSection>

            <TrigSettingsSection label="Печать и вид">
              <Space direction="vertical" size={6}>
                <Checkbox checked={settings.showTeacherKey} onChange={e => updateSetting('showTeacherKey', e.target.checked)}>
                  Лист ответов (учитель)
                </Checkbox>
                <Checkbox checked={settings.twoPerPage} onChange={e => updateSetting('twoPerPage', e.target.checked)}>
                  2 варианта на листе A4
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

            {tasksData && <SheetTasksPanel sheet={sheet} />}

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
              <SheetStorageActions
                storage={sheet.storage}
                hasData={Boolean(tasksData)}
                generator="trig_equations_advanced"
              />
              {tasksData && <Button block onClick={reset}>Сбросить</Button>}
            </TrigActions>
          </div>
        }
        right={
          <TrigPreviewPane
            hasData={Boolean(tasksData)}
            emptyIcon={<FunctionOutlined />}
            emptyTitle="Настройте параметры и нажмите «Сформировать»"
            emptyHint="Уравнения f(kx + b) = a"
            summary={[
              <TrigStatBadge key="count">{settings.questionsCount} зад.</TrigStatBadge>,
              <TrigStatBadge key="variants" tone="success">{settings.variantsCount} вар.</TrigStatBadge>,
              settings.useType1 ? <TrigStatBadge key="type1" tone="accent">f(kx)=a</TrigStatBadge> : null,
              settings.useType2 ? <TrigStatBadge key="type2">A·f(kx+b)=c</TrigStatBadge> : null,
            ].filter(Boolean)}
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
                    <span style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 11, maxWidth: 340, textAlign: 'right' }}>
                      <MathInline latex={q.resultLatex} />
                    </span>
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
          instruction="Решите уравнение:"
          questionMode="plain"
        />
      )}

      <SheetToolsModals sheet={sheet} />

      <TrigMCSection
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        printTest={printTest}
        onPrint={handleMCPrint}
        tasksData={tasksData}
        generatorType="trig_equations_advanced"
        generatorTitle={title}
        settings={settings}
      />
    </>
  );
}
