import { useState } from 'react';
import katex from 'katex';
import {
  Button, Slider, Checkbox, Space, Switch, Divider,
} from 'antd';
import {
  PrinterOutlined, CheckSquareOutlined, ThunderboltOutlined,
  CalculatorOutlined, FormOutlined,
} from '@ant-design/icons';
import { useOralCounting, CATEGORY_LABELS } from '../hooks/useOralCounting';
import { useTrigMCModal } from '../hooks/useTrigMCModal';
import OralCountingPrintLayout from './trig/OralCountingPrintLayout';
import TrigMCSaveModal from './trig/TrigMCSaveModal';
import TrigMCPrintLayout from './trig/TrigMCPrintLayout';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigPreviewCard,
  TrigStatBadge,
} from './trig/TrigGeneratorLayout';

// ─── Порядок категорий в UI ───────────────────────────────────────────────────
const CATEGORY_ORDER = [
  'fracTimesInt',
  'intDivFrac',
  'fracDivInt',
  'fracDivFrac',
  'timesReciprocal',
  'mixedArith',
  'decimalPower',
  'mulPow10',
  'decimalDiv',
  'decimalSimple',
];

function MathInline({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const LABELS = Array.from({ length: 30 }, (_, i) => String(i + 1));

export default function OralCountingGenerator() {
  const {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
  } = useOralCounting();

  const { modalOpen, setModalOpen, printTest, handlePrint: handleMCPrint } = useTrigMCModal();
  const [mcFillMode, setMcFillMode] = useState(false);

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

  const enabledCount = Object.values(settings.categories).filter(Boolean).length;
  const varCount = tasksData?.length ?? 0;
  const qCount = tasksData?.[0]?.length ?? settings.questionsCount;

  return (
    <>
      <TrigGeneratorLayout
        icon={<CalculatorOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Название листа"
        leftWidth={320}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>

            {/* Категории заданий */}
            <TrigSettingsSection label="Категории заданий">
              <Space direction="vertical" size={4}>
                {CATEGORY_ORDER.map(cat => (
                  <Checkbox
                    key={cat}
                    checked={settings.categories[cat]}
                    onChange={e => updateCategory(cat, e.target.checked)}
                  >
                    <span style={{ fontSize: 12 }}>{CATEGORY_LABELS[cat]}</span>
                  </Checkbox>
                ))}
              </Space>
            </TrigSettingsSection>

            {/* Параметры */}
            <TrigSettingsSection label="Параметры">
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Заданий в варианте: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.questionsCount}</b>
              </div>
              <Slider
                min={5} max={30} step={5}
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
                  checked={settings.sideBySide}
                  onChange={e => updateSetting('sideBySide', e.target.checked)}
                >
                  2 варианта рядом (лево/право)
                </Checkbox>
                <Checkbox
                  checked={settings.twoPerPage}
                  onChange={e => updateSetting('twoPerPage', e.target.checked)}
                >
                  2 варианта на листе A4 (верх/низ)
                </Checkbox>
                <Checkbox
                  checked={settings.showTeacherKey}
                  onChange={e => updateSetting('showTeacherKey', e.target.checked)}
                >
                  Лист ответов (учитель)
                </Checkbox>
              </Space>
            </TrigSettingsSection>

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
            emptyIcon={<CalculatorOutlined />}
            emptyTitle="Настройте параметры и нажмите «Сформировать»"
            emptyHint={`Активных категорий: ${enabledCount}`}
            summary={[
              <TrigStatBadge key="cats" tone="accent">{enabledCount} кат.</TrigStatBadge>,
              <TrigStatBadge key="q">{qCount} зад.</TrigStatBadge>,
              <TrigStatBadge key="v" tone="success">{varCount || settings.variantsCount} вар.</TrigStatBadge>,
              settings.twoPerPage ? <TrigStatBadge key="2pp">2 на листе</TrigStatBadge> : null,
            ].filter(Boolean)}
          >
            {tasksData?.map((variant, vi) => (
              <TrigPreviewCard key={vi} title={`Вариант ${vi + 1}`} meta={`${variant.length} заданий`}>
                {variant.map((q, qi) => (
                  <div key={qi} style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                    padding: '4px 0',
                    borderBottom: qi < variant.length - 1 ? '1px dotted var(--rule-soft)' : 'none',
                    fontSize: 13,
                  }}>
                    <span style={{ fontWeight: 600, minWidth: 20, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {LABELS[qi]})
                    </span>
                    <span style={{ flex: 1, fontSize: 12 }}><MathInline latex={q.exprLatex} /></span>
                    <span style={{ color: 'var(--rule)', padding: '0 3px' }}>=</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 12 }}>
                      <MathInline latex={q.resultLatex} />
                    </span>
                  </div>
                ))}
              </TrigPreviewCard>
            ))}
          </TrigPreviewPane>
        }
      />

      {/* Печатная вёрстка */}
      {tasksData && (
        <OralCountingPrintLayout
          tasksData={tasksData}
          settings={settings}
          title={title}
        />
      )}

      <TrigMCSaveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tasksData={tasksData}
        generatorType="oral_counting"
        generatorTitle={title}
        settings={settings}
        fillMode={mcFillMode}
        onPrint={handleMCPrint}
      />
      {printTest && (
        <TrigMCPrintLayout
          variants={printTest.variants}
          title={printTest.title}
          shuffleMode={printTest.shuffle_mode || 'fixed'}
        />
      )}
    </>
  );
}
