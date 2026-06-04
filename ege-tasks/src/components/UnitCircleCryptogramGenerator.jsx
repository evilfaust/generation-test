import { useState } from 'react';
import { printPaged } from '../utils/printPage';
import { MathInline } from './shared/MathInline';
import {
  Button, Select, Radio, Checkbox, Divider,
  Space, Modal, List, Typography, Tag, Input,
} from 'antd';
import {
  PrinterOutlined, SaveOutlined, FolderOpenOutlined,
  DeleteOutlined, CodeSandboxOutlined, KeyOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useCryptogram } from '../hooks/useCryptogram';
import UnitCircleSVG from './trig/UnitCircleSVG';
import CryptogramPrintLayout from './trig/CryptogramPrintLayout';
import {
  TrigGeneratorLayout,
  TrigSettingsSection,
  TrigActions,
  TrigPreviewPane,
  TrigPreviewCard,
  TrigStatBadge,
} from './trig/TrigGeneratorLayout';

const { Text } = Typography;
const { TextArea } = Input;


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

export default function UnitCircleCryptogramGenerator() {
  const [showLoadModal, setShowLoadModal] = useState(false);

  const {
    title, setTitle,
    wordsText, setWordsText,
    settings, updateSetting,
    tasksData,
    savedId,
    saved, loadingSaved, saving,
    generate, reset,
    loadSavedList, saveWorksheet, loadWorksheet, deleteWorksheet,
  } = useCryptogram();

  const handlePrint = () => printPaged({ margin: '7mm' });

  const handleOpenLoad = async () => {
    await loadSavedList();
    setShowLoadModal(true);
  };

  return (
    <>
      <TrigGeneratorLayout
        icon={<KeyOutlined style={{ fontSize: 14 }} />}
        title={title}
        onTitleChange={setTitle}
        leftWidth={360}
        left={
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            <TrigSettingsSection label="Слова-ответы">
              <TextArea
                rows={6}
                value={wordsText}
                onChange={e => setWordsText(e.target.value)}
                placeholder="СИНУС\nТАНГЕНС\nФУНКЦИЯ"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Каждое слово станет отдельным заданием. Максимум 16 уникальных букв в слове.
              </Text>
            </TrigSettingsSection>

            <TrigSettingsSection label="Параметры">
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Заданий на странице A4</div>
              <Radio.Group value={settings.circlesPerPage} onChange={e => updateSetting('circlesPerPage', e.target.value)} size="small">
                <Radio.Button value={2}>2 варианта</Radio.Button>
                <Radio.Button value={4}>4 варианта</Radio.Button>
              </Radio.Group>
              <Divider style={{ margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Смещение по ±k×2π</div>
              <Select value={settings.maxK} onChange={v => updateSetting('maxK', v)} options={MAX_K_OPTIONS} style={{ width: '100%' }} size="small" />
            </TrigSettingsSection>

            <TrigSettingsSection label="Разметка окружности">
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Подписи на окружности</div>
              <Select value={settings.showAxes} onChange={v => updateSetting('showAxes', v)} options={SHOW_AXES_OPTIONS} style={{ width: '100%' }} size="small" />
              <Divider style={{ margin: '10px 0' }} />
              <Space direction="vertical" size={6}>
                <Checkbox checked={settings.showDegrees} onChange={e => updateSetting('showDegrees', e.target.checked)}>
                  Показывать градусы
                </Checkbox>
                <Checkbox checked={settings.showTicks} onChange={e => updateSetting('showTicks', e.target.checked)}>
                  Засечки на всех стандартных позициях
                </Checkbox>
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
            emptyIcon={<CodeSandboxOutlined />}
            emptyTitle="Нажмите «Сформировать», чтобы создать шифровки"
            emptyHint="Шифровки по единичной окружности"
            summary={[
              <TrigStatBadge key="pages" tone="success">{tasksData?.length || 0} стр.</TrigStatBadge>,
              <TrigStatBadge key="perpage">{settings.circlesPerPage} на стр.</TrigStatBadge>,
              <TrigStatBadge key="title" tone="accent">Шифровка</TrigStatBadge>,
            ]}
          >
            {tasksData?.map((page, pi) => (
              <TrigPreviewCard key={pi} title={`Страница ${pi + 1}`} meta={`${page.length} заданий`}>
                <div style={{ display: 'grid', gridTemplateColumns: settings.circlesPerPage === 4 ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 16 }}>
                  {page.map((task, ti) => (
                    <div key={ti} style={{ border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius)', padding: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                        Слово: <b style={{ color: 'var(--ink)' }}>{task.word}</b>
                      </div>
                      <div style={{ maxWidth: 220, margin: '0 auto 12px' }}>
                        <UnitCircleSVG
                          taskType="cryptogram"
                          isAnswer={false}
                          showAxes={settings.showAxes}
                          showDegrees={settings.showDegrees}
                          showTicks={settings.showTicks}
                          cipherMap={task.cipherMap}
                        />
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--rule)', textAlign: 'left' }}>Угол</th>
                            <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--rule)', textAlign: 'left' }}>Буква</th>
                          </tr>
                        </thead>
                        <tbody>
                          {task.questions.map((q, i) => (
                            <tr key={i}>
                              <td style={{ padding: '6px 8px', borderBottom: '1px dotted var(--rule-soft)' }}><MathInline latex={q.display} /></td>
                              <td style={{ padding: '6px 8px', borderBottom: '1px dotted var(--rule-soft)', color: 'var(--ink-4)' }}>____</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </TrigPreviewCard>
            ))}
          </TrigPreviewPane>
        }
      />

      <CryptogramPrintLayout tasksData={tasksData} settings={settings} title={title} />

      <Modal
        title="Загрузить сохранённые шифровки"
        open={showLoadModal}
        onCancel={() => setShowLoadModal(false)}
        footer={null}
        width={500}
      >
        {saved.length === 0 && !loadingSaved ? (
          <Text type="secondary">Нет сохранённых листов с шифровками</Text>
        ) : (
          <List
            loading={loadingSaved}
            dataSource={saved}
            renderItem={item => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>
                    <Tag color="cyan">Шифровка</Tag>
                    {item.variants_count} стр. · {new Date(item.created).toLocaleDateString('ru')}
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
