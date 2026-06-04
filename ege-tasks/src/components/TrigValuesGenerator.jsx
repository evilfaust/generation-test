import { useState } from 'react';
import { printPaged } from '../utils/printPage';
import { MathInline } from './shared/MathInline';
import {
  Button, Slider, Radio, Checkbox, Divider, Space,
  Modal, List, Typography, Switch, Tag,
} from 'antd';
import {
  PrinterOutlined, SaveOutlined, FolderOpenOutlined,
  DeleteOutlined, RadarChartOutlined, TableOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useTrigValues } from '../hooks/useTrigValues';
import TrigValuesSVG from './trig/TrigValuesSVG';
import TrigValuesPrintLayout from './trig/TrigValuesPrintLayout';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigPreviewCard,
  TrigStatBadge,
} from './trig/TrigGeneratorLayout';

const { Text } = Typography;


function PreviewTable({ points, showSin, showCos, showTan, showCot }) {
  const cols = [
    showSin && { key: 'sin', head: '\\sin' },
    showCos && { key: 'cos', head: '\\cos' },
    showTan && { key: 'tan', head: '\\text{tg}' },
    showCot && { key: 'cot', head: '\\text{ctg}' },
  ].filter(Boolean);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>№</th>
            <th style={thStyle}><MathInline latex="\alpha" /></th>
            {cols.map(c => <th key={c.key} style={thStyle}><MathInline latex={c.head} /></th>)}
          </tr>
        </thead>
        <tbody>
          {points.map(p => (
            <tr key={p.id}>
              <td style={tdStyle}>{p.id}</td>
              <td style={tdStyle}><MathInline latex={p.angleDisplayCompact || p.angleDisplay} /></td>
              {cols.map(c => {
                const undef = (c.key === 'tan' && p.tanUndef) || (c.key === 'cot' && p.cotUndef);
                return (
                  <td key={c.key} style={{ ...tdStyle, color: 'var(--ink-4)' }}>
                    {undef ? '—' : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--rule)',
  textAlign: 'center',
  color: 'var(--ink-3)',
  fontWeight: 600,
};

const tdStyle = {
  padding: '6px 8px',
  borderBottom: '1px dotted var(--rule-soft)',
  textAlign: 'center',
};

export default function TrigValuesGenerator() {
  const [showLoadModal, setShowLoadModal] = useState(false);

  const {
    title, setTitle,
    settings, updateSetting,
    tasksData,
    generate, reset,
    savedId, saved, loadingSaved, saving,
    loadSavedList, saveWorksheet, loadWorksheet, deleteWorksheet,
  } = useTrigValues();

  const handleOpenLoad = async () => {
    await loadSavedList();
    setShowLoadModal(true);
  };

  const handlePrint = () => printPaged({
    size: settings.layout === 'portrait' ? 'A4 portrait' : 'A4 landscape',
  });

  const columnLabels = [settings.showSin && 'sin', settings.showCos && 'cos', settings.showTan && 'tg', settings.showCot && 'ctg']
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <TrigGeneratorLayout
        icon={<TableOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        leftWidth={360}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            <TrigSettingsSection label="Параметры">
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Углов в таблице: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.anglesCount ?? 8}</b>
              </div>
              <Slider min={4} max={16} value={settings.anglesCount ?? 8} onChange={v => updateSetting('anglesCount', v)} marks={{ 4: '4', 8: '8', 12: '12', 16: '16' }} size="small" />
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Кол-во вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.variantsCount}</b>
              </div>
              <Slider min={1} max={32} value={settings.variantsCount} onChange={v => updateSetting('variantsCount', v)} marks={{ 1: '1', 10: '10', 20: '20', 32: '32' }} size="small" />
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Сдвиг углов ±k×2π: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.maxK === 0 ? 'нет' : `до ${settings.maxK}`}</b>
              </div>
              <Slider min={0} max={4} value={settings.maxK ?? 2} onChange={v => updateSetting('maxK', v)} marks={{ 0: 'нет', 1: '±1', 2: '±2', 3: '±3', 4: '±4' }} size="small" />
            </TrigSettingsSection>

            <TrigSettingsSection label="Колонки">
              <Space wrap size={4}>
                <Checkbox checked={settings.showSin} onChange={e => updateSetting('showSin', e.target.checked)}>sin</Checkbox>
                <Checkbox checked={settings.showCos} onChange={e => updateSetting('showCos', e.target.checked)}>cos</Checkbox>
                <Checkbox checked={settings.showTan} onChange={e => updateSetting('showTan', e.target.checked)}>tg</Checkbox>
                <Checkbox checked={settings.showCot} onChange={e => updateSetting('showCot', e.target.checked)}>ctg</Checkbox>
              </Space>
            </TrigSettingsSection>

            <TrigSettingsSection label="Печать и вид">
              <Radio.Group value={settings.layout} onChange={e => updateSetting('layout', e.target.value)} size="small" optionType="button" buttonStyle="solid">
                <Radio.Button value="landscape">Альбомная</Radio.Button>
                <Radio.Button value="portrait">Книжная</Radio.Button>
              </Radio.Group>
              <Divider style={{ margin: '10px 0' }} />
              <Space direction="vertical" size={6}>
                <Checkbox checked={settings.showHelperLines} onChange={e => updateSetting('showHelperLines', e.target.checked)}>
                  Вспомогательные линии
                </Checkbox>
                <Checkbox checked={settings.showAngleLabels} onChange={e => updateSetting('showAngleLabels', e.target.checked)}>
                  Подписи углов на окружности
                </Checkbox>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch size="small" checked={settings.useDegrees ?? false} onChange={v => updateSetting('useDegrees', v)} />
                  <span style={{ fontSize: 13 }}>Градусная мера</span>
                </div>
                <Checkbox checked={settings.showTeacherKey} onChange={e => updateSetting('showTeacherKey', e.target.checked)}>
                  Лист ответов
                </Checkbox>
              </Space>
            </TrigSettingsSection>

            <TrigActions>
              <Button type="primary" block icon={<ThunderboltOutlined />} onClick={generate}>
                Сформировать
              </Button>
              {tasksData && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button block icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
                  <Button block icon={<SaveOutlined />} loading={saving} onClick={saveWorksheet}>
                    {savedId ? 'Обновить' : 'Сохранить'}
                  </Button>
                </div>
              )}
              <Button block icon={<FolderOpenOutlined />} onClick={handleOpenLoad}>Загрузить</Button>
              {tasksData && <Button block onClick={reset}>Сбросить</Button>}
            </TrigActions>
          </div>
        }
        right={
          <TrigPreviewPane
            hasData={Boolean(tasksData)}
            emptyIcon={<RadarChartOutlined />}
            emptyTitle="Нажмите «Сформировать», чтобы создать лист"
            emptyHint="Таблица значений тригонометрических функций"
            summary={[
              <TrigStatBadge key="angles" tone="accent">{tasksData?.[0]?.length || settings.anglesCount} углов</TrigStatBadge>,
              <TrigStatBadge key="cols">{columnLabels || 'колонки'}</TrigStatBadge>,
              <TrigStatBadge key="variants" tone="success">{settings.variantsCount} вар.</TrigStatBadge>,
              <TrigStatBadge key="layout">{settings.layout === 'landscape' ? 'A4 альбом' : 'A4 книжн.'}</TrigStatBadge>,
            ]}
          >
            {tasksData?.map((variant, vi) => (
              <TrigPreviewCard key={vi} title={`Вариант ${vi + 1}`} meta={`${variant.length} углов`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 16, alignItems: 'start' }}>
                  <div style={{ maxWidth: 320 }}>
                    <TrigValuesSVG
                      points={variant}
                      showHelperLines={settings.showHelperLines}
                      showAngleLabels={settings.showAngleLabels}
                    />
                  </div>
                  <PreviewTable
                    points={variant}
                    showSin={settings.showSin}
                    showCos={settings.showCos}
                    showTan={settings.showTan}
                    showCot={settings.showCot}
                  />
                </div>
              </TrigPreviewCard>
            ))}
          </TrigPreviewPane>
        }
      />

      {tasksData && (
        <TrigValuesPrintLayout
          tasksData={tasksData}
          settings={settings}
          title={title}
        />
      )}

      <Modal
        title="Загрузить сохранённый лист"
        open={showLoadModal}
        onCancel={() => setShowLoadModal(false)}
        footer={null}
        width={520}
      >
        {!loadingSaved && saved.length === 0 ? (
          <Text type="secondary">Нет сохранённых листов</Text>
        ) : (
          <List
            loading={loadingSaved}
            dataSource={saved}
            renderItem={item => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>
                    <Tag>{item.task_type}</Tag>
                    {item.variants_count} вар. · {new Date(item.created).toLocaleDateString('ru')}
                  </div>
                </div>
                <Space>
                  <Button size="small" onClick={() => { loadWorksheet(item); setShowLoadModal(false); }}>Загрузить</Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteWorksheet(item.id)} />
                </Space>
              </div>
            )}
          />
        )}
      </Modal>
    </>
  );
}
