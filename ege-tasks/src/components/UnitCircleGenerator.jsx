import { useState } from 'react';
import { printPaged } from '../utils/printPage';
import { MathInline } from './shared/MathInline';
import {
  Button, Select, Slider, Radio, Checkbox, Switch,
  Divider, Space, Modal, List, Typography, Tag,
} from 'antd';
import {
  PrinterOutlined, SaveOutlined, FolderOpenOutlined,
  DeleteOutlined, RadarChartOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useUnitCircle } from '../hooks/useUnitCircle';
import UnitCircleSVG from './trig/UnitCircleSVG';
import UnitCirclePrintLayout from './trig/UnitCirclePrintLayout';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigPreviewCard,
  TrigStatBadge,
} from './trig/TrigGeneratorLayout';

const { Text } = Typography;


const TASK_TYPE_OPTIONS = [
  { value: 'direct', label: 'Прямая (подписать точки)' },
  { value: 'inverse', label: 'Обратная (отметить точки)' },
  { value: 'mixed', label: 'Смешанная' },
];

const SHOW_AXES_OPTIONS = [
  { value: 'none', label: 'Ничего' },
  { value: 'axes', label: 'Только оси' },
  { value: 'all', label: 'Все стандартные углы' },
];

const MAX_K_OPTIONS = [
  { value: 0, label: '0 (только [0, 2π))' },
  { value: 1, label: '±1 (±2π)' },
  { value: 2, label: '±2 (±4π)' },
  { value: 3, label: '±3 (±6π)' },
  { value: 4, label: '±4 (±8π)' },
];

export default function UnitCircleGenerator() {
  const [showLoadModal, setShowLoadModal] = useState(false);

  const {
    title, setTitle,
    settings, updateSetting,
    tasksData,
    savedId, saved, loadingSaved, saving,
    generate, reset,
    loadSavedList, saveWorksheet, loadWorksheet, deleteWorksheet,
  } = useUnitCircle();

  const handlePrint = () => printPaged({ margin: '7mm' });

  const handleOpenLoad = async () => {
    await loadSavedList();
    setShowLoadModal(true);
  };

  const taskLabel = (type) => (type === 'direct' ? 'Подписать точки' : 'Отметить точки');

  return (
    <>
      <TrigGeneratorLayout
        icon={<RadarChartOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        leftWidth={360}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            <TrigSettingsSection label="Основные настройки">
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Тип задания</div>
                <Select value={settings.taskType} onChange={v => updateSetting('taskType', v)} options={TASK_TYPE_OPTIONS} style={{ width: '100%' }} size="small" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Кол-во вариантов: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.variantsCount}</b>
              </div>
              <Slider min={1} max={30} value={settings.variantsCount} onChange={v => updateSetting('variantsCount', v)} marks={{ 1: '1', 10: '10', 20: '20', 30: '30' }} size="small" />
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Кружков на странице A4</div>
              <Radio.Group value={settings.circlesPerPage} onChange={e => updateSetting('circlesPerPage', e.target.value)} size="small">
                <Radio.Button value={2}>2</Radio.Button>
                <Radio.Button value={4}>4</Radio.Button>
              </Radio.Group>
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                Точек на кружок: <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{settings.pointsPerCircle}</b>
              </div>
              <Slider min={4} max={12} value={settings.pointsPerCircle} onChange={v => updateSetting('pointsPerCircle', v)} marks={{ 4: '4', 8: '8', 12: '12' }} size="small" />
            </TrigSettingsSection>

            <TrigSettingsSection label="Разметка окружности">
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Смещение по ±k×2π</div>
                <Select value={settings.maxK} onChange={v => updateSetting('maxK', v)} options={MAX_K_OPTIONS} style={{ width: '100%' }} size="small" />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Подписи на окружности</div>
                <Select value={settings.showAxes} onChange={v => updateSetting('showAxes', v)} options={SHOW_AXES_OPTIONS} style={{ width: '100%' }} size="small" />
              </div>
              <Space direction="vertical" size={6}>
                <Checkbox checked={settings.showDegrees} onChange={e => updateSetting('showDegrees', e.target.checked)}>
                  Показывать градусы
                </Checkbox>
                <Checkbox checked={settings.showTicks} onChange={e => updateSetting('showTicks', e.target.checked)}>
                  Засечки на всех стандартных позициях
                </Checkbox>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch size="small" checked={settings.useDegrees ?? false} onChange={v => updateSetting('useDegrees', v)} />
                  <span style={{ fontSize: 13 }}>Градусная мера угла</span>
                </div>
                <Checkbox checked={settings.showTeacherKey} onChange={e => updateSetting('showTeacherKey', e.target.checked)}>
                  Лист ответов учителя
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
            emptyTitle="Нажмите «Сформировать», чтобы создать варианты"
            emptyHint="Единичная окружность"
            summary={[
              <TrigStatBadge key="type" tone="accent">{TASK_TYPE_OPTIONS.find(o => o.value === settings.taskType)?.label || 'Тип'}</TrigStatBadge>,
              <TrigStatBadge key="variants" tone="success">{settings.variantsCount} вар.</TrigStatBadge>,
              <TrigStatBadge key="page">{settings.circlesPerPage} на стр.</TrigStatBadge>,
            ]}
          >
            {tasksData?.map((variant, vi) => (
              <TrigPreviewCard key={vi} title={`Вариант ${vi + 1}`} meta={`${variant.length} кружков`}>
                <div style={{ display: 'grid', gridTemplateColumns: settings.circlesPerPage === 4 ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 16 }}>
                  {variant.map((task, ti) => (
                    <div key={ti} style={{ border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius)', padding: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8, fontWeight: 600 }}>
                        {taskLabel(task.type)}
                      </div>
                      <div style={{ maxWidth: 240, margin: '0 auto 12px' }}>
                        <UnitCircleSVG
                          points={task.points}
                          taskType={task.type}
                          isAnswer={false}
                          showAxes={settings.showAxes}
                          showDegrees={settings.showDegrees}
                          showTicks={settings.showTicks}
                        />
                      </div>
                      {task.type === 'direct' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {task.points.map(p => (
                            <div key={p.id} style={{ fontSize: 12, color: 'var(--ink-4)' }}><b>{p.id}.</b> ____</div>
                          ))}
                        </div>
                      )}
                      {task.type === 'inverse' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {task.points.map(p => (
                            <span key={p.id} style={{ fontSize: 12 }}>
                              <b>{p.id}.</b> <MathInline latex={p.display} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TrigPreviewCard>
            ))}
          </TrigPreviewPane>
        }
      />

      <UnitCirclePrintLayout tasksData={tasksData} settings={settings} title={title} />

      <Modal
        title="Загрузить сохранённый лист"
        open={showLoadModal}
        onCancel={() => setShowLoadModal(false)}
        footer={null}
        width={500}
      >
        {saved.length === 0 && !loadingSaved ? (
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
