import { useState } from 'react';
import { printPaged } from '../utils/printPage';
import { MathInline } from './shared/MathInline';
import { Button, Slider, Radio, Checkbox, Divider, Space, Switch } from 'antd';
import { PrinterOutlined, FunctionOutlined, CheckSquareOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useInverseTrig } from '../hooks/useInverseTrig';
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
  { value: 'basic',  label: 'Простые (arcsin, arccos...)' },
  { value: 'sum',    label: 'Сумма / разность' },
  { value: 'nested', label: 'Вложенные (sin(arccos...) )' },
  { value: 'mixed',  label: 'Смешанный' },
];

export default function InverseTrigGenerator() {
  const { title, setTitle, settings, updateSetting, tasksData, generate, reset } = useInverseTrig();
  const { modalOpen, setModalOpen, printTest, handlePrint: handleMCPrint } = useTrigMCModal();

  const handlePrint = () => printPaged();

  const arcFnBoxes = [
    { key: 'useArcsin', label: 'arcsin' },
    { key: 'useArccos', label: 'arccos' },
    { key: 'useArctan', label: 'arctg' },
    { key: 'useArccot', label: 'arcctg' },
  ];

  const outerBoxes = [
    { key: 'useOuterSin', label: 'sin' },
    { key: 'useOuterCos', label: 'cos' },
    { key: 'useOuterTan', label: 'tg' },
    { key: 'useOuterCot', label: 'ctg' },
  ];

  const showNested = settings.taskType === 'nested' || settings.taskType === 'mixed';
  const typeLabel = TASK_TYPE_OPTIONS.find(o => o.value === settings.taskType)?.label ?? 'Обратные функции';

  return (
    <>
      <TrigGeneratorLayout
        icon={<FunctionOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            <TrigSettingsSection label="Тип задач">
              <Radio.Group
                value={settings.taskType}
                onChange={e => updateSetting('taskType', e.target.value)}
                size="small"
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                {TASK_TYPE_OPTIONS.map(o => (
                  <Radio key={o.value} value={o.value}>{o.label}</Radio>
                ))}
              </Radio.Group>
            </TrigSettingsSection>

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

            <TrigSettingsSection label="Обратные функции">
              <Space wrap size={4}>
                {arcFnBoxes.map(f => (
                  <Checkbox key={f.key} checked={settings[f.key]} onChange={e => updateSetting(f.key, e.target.checked)}>
                    {f.label}
                  </Checkbox>
                ))}
              </Space>
            </TrigSettingsSection>

            {showNested && (
              <TrigSettingsSection label="Внешние функции">
                <Space wrap size={4}>
                  {outerBoxes.map(f => (
                    <Checkbox key={f.key} checked={settings[f.key]} onChange={e => updateSetting(f.key, e.target.checked)}>
                      {f.label}
                    </Checkbox>
                  ))}
                </Space>
              </TrigSettingsSection>
            )}

            <TrigSettingsSection label="Печать и вид">
              <Space direction="vertical" size={6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch size="small" checked={settings.useDegrees} onChange={v => updateSetting('useDegrees', v)} />
                  <span style={{ fontSize: 13 }}>Градусная мера</span>
                </div>
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
            emptyHint={typeLabel}
            summary={[
              <TrigStatBadge key="type" tone="accent">{typeLabel}</TrigStatBadge>,
              <TrigStatBadge key="count">{settings.questionsCount} зад.</TrigStatBadge>,
              <TrigStatBadge key="variants" tone="success">{settings.variantsCount} вар.</TrigStatBadge>,
              settings.twoPerPage ? <TrigStatBadge key="page">2 на лист</TrigStatBadge> : null,
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
          instruction="Вычислите:"
        />
      )}

      <TrigMCSection
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        printTest={printTest}
        onPrint={handleMCPrint}
        tasksData={tasksData}
        generatorType="inverse_trig"
        generatorTitle={title}
        settings={settings}
      />
    </>
  );
}
