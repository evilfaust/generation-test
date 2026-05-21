import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, Button, Input, Select, InputNumber, Space, Divider, Modal, App, Empty,
  Tag, Tooltip, Collapse, Radio, Popconfirm, Spin, Tabs,
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, PrinterOutlined, ArrowLeftOutlined,
  EditOutlined, FileTextOutlined, CloseOutlined, ArrowUpOutlined, ArrowDownOutlined,
  AppstoreAddOutlined, ReloadOutlined, ShareAltOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/pocketbase';
import { useMCTest } from '../hooks/useMCTest';
import { useTrigMCModal } from '../hooks/useTrigMCModal';
import MathRenderer from './MathRenderer';
import TaskSelectModal from './TaskSelectModal';
import MCOptionsEditor from './mc-test/MCOptionsEditor';
import MCTestPrintLayout from './mc-test/MCTestPrintLayout';
import MCTestAnalytics from './mc-test/MCTestAnalytics';
import TrigMCPrintLayout from './trig/TrigMCPrintLayout';
import TrigMCTestEditor from './trig/TrigMCTestEditor';
import SessionPanel from './worksheet/SessionPanel';

const GENERATOR_LABELS = {
  trig_expressions:        'Вычисление выражений',
  trig_equations:          'Простейшие уравнения',
  inverse_trig:            'Обратные функции',
  double_angle:            'Двойной аргумент',
  trig_equations_advanced: 'Уравнения f(kx+b)=a',
  reduction_formulas:      'Формулы приведения',
  addition_formulas:       'Формулы сложения',
  oral_counting:           'Устный счёт',
};

function SourceBadge({ test }) {
  if (test.source_type === 'generator') {
    const label = GENERATOR_LABELS[test.generator_type] ?? test.generator_type ?? 'Генератор';
    return <Tag color="purple">{label}</Tag>;
  }
  return <Tag color="blue">Задачник</Tag>;
}

const { TextArea } = Input;

const MCTestGenerator = ({ initialMcTestId = null } = {}) => {
  const { message, modal } = App.useApp();
  const { topics, subtopics, tags } = useReferenceData();
  const { canEdit, canDelete } = useAuth();

  const [mode, setMode] = useState('list'); // 'list' | 'edit'
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [issueOpenId, setIssueOpenId] = useState(null);
  const [analyticsOpenId, setAnalyticsOpenId] = useState(null);
  const [editingTrigId, setEditingTrigId] = useState(null);

  const { printTest: trigPrintTest, handlePrint: handleTrigPrint } = useTrigMCModal();

  const mc = useMCTest();
  const [taskSelectFor, setTaskSelectFor] = useState(null);
  const [activeVariantKey, setActiveVariantKey] = useState(['0']);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      setList(await api.getMCTests());
    } finally { setListLoading(false); }
  }, []);

  useEffect(() => { if (mode === 'list') loadList(); }, [mode, loadList]);

  useEffect(() => {
    if (initialMcTestId) {
      (async () => {
        try {
          await mc.load(initialMcTestId);
          setActiveVariantKey(['0']);
          setMode('edit');
        } catch {
          message.error('Не удалось загрузить тест');
        }
      })();
    }
  }, [initialMcTestId]);

  const startNew = () => {
    mc.reset();
    mc.addVariant();
    setActiveVariantKey(['0']);
    setMode('edit');
  };

  const openTest = async (id) => {
    try {
      await mc.load(id);
      setActiveVariantKey(['0']);
      setMode('edit');
    } catch {
      message.error('Не удалось загрузить тест');
    }
  };

  const handleDelete = (id, title) => {
    modal.confirm({
      title: `Удалить тест "${title}"?`,
      content: 'Связанные сессии останутся, но тест будет недоступен.',
      okText: 'Удалить',
      okType: 'danger',
      onOk: async () => {
        try {
          await api.deleteMCTest(id);
          message.success('Тест удалён');
          setList(prev => prev.filter(t => t.id !== id));
          if (issueOpenId === id) setIssueOpenId(null);
          if (analyticsOpenId === id) setAnalyticsOpenId(null);
        } catch {
          message.error('Ошибка удаления');
        }
      },
    });
  };

  const handleSave = async () => {
    if (!mc.title.trim()) {
      message.warning('Укажите название теста');
      return;
    }
    if (mc.variants.length === 0 || mc.variants.every(v => v.tasks.length === 0)) {
      message.warning('Добавьте хотя бы одну задачу');
      return;
    }
    try {
      await mc.save();
      message.success(mc.savedId ? 'Тест обновлён' : 'Тест создан');
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const handlePrint = () => {
    if (!mc.variants.length) {
      message.warning('Нет вариантов для печати');
      return;
    }
    window.print();
  };

  // ─── LIST MODE ────────────────────────────────────────────────────────────

  if (mode === 'list') {
    return (
      <div style={{ padding: 16 }}>
        <Card
          title="Тесты с выбором ответа"
          extra={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={startNew}>Создать тест</Button>}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button icon={<ReloadOutlined />} size="small" onClick={loadList}>Обновить</Button>
          </div>

          {listLoading ? (
            <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
          ) : list.length === 0 ? (
            <Empty description="Нет сохранённых тестов. Нажмите «Создать тест» или сохраните тест из тригогенератора." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {list.map(t => {
                const variantsCount = Array.isArray(t.variants) ? t.variants.length : 0;
                const tasksPerVariant = variantsCount > 0 ? (t.variants[0]?.tasks?.length ?? 0) : 0;
                const isIssueOpen = issueOpenId === t.id;
                const isAnalyticsOpen = analyticsOpenId === t.id;
                const isGenerator = t.source_type === 'generator';

                return (
                  <Card key={t.id} size="small" hoverable style={{ borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{t.title || '(без названия)'}</span>
                          <SourceBadge test={t} />
                        </div>
                        {t.description && (
                          <div style={{ color: '#666', marginTop: 2, fontSize: 13 }}>{t.description}</div>
                        )}
                        <Space size={6} style={{ marginTop: 6 }} wrap>
                          {t.class_number && <Tag>{t.class_number} класс</Tag>}
                          <Tag color="geekblue">{variantsCount} вар.</Tag>
                          <Tag color="cyan">{tasksPerVariant} зад./вар.</Tag>
                          <Tag color="purple">{t.options_count} отв.</Tag>
                          <Tag color={t.shuffle_mode === 'fixed' ? 'orange' : 'green'}>
                            {t.shuffle_mode === 'fixed' ? 'Фикс.' : 'Перемешать'}
                          </Tag>
                          <span style={{ fontSize: 11, color: '#aaa' }}>
                            {new Date(t.created).toLocaleDateString('ru')}
                          </span>
                        </Space>
                      </div>

                      <Space wrap style={{ flexShrink: 0 }}>
                        <Tooltip title="Аналитика">
                          <Button
                            icon={<BarChartOutlined />}
                            type={isAnalyticsOpen ? 'primary' : 'default'}
                            onClick={() => {
                              setAnalyticsOpenId(prev => prev === t.id ? null : t.id);
                              if (isIssueOpen) setIssueOpenId(null);
                            }}
                          />
                        </Tooltip>
                        <Button
                          icon={<ShareAltOutlined />}
                          type={isIssueOpen ? 'primary' : 'default'}
                          onClick={() => {
                            setIssueOpenId(prev => prev === t.id ? null : t.id);
                            if (isAnalyticsOpen) setAnalyticsOpenId(null);
                          }}
                        >
                          Выдать
                        </Button>
                        <Button
                          icon={<PrinterOutlined />}
                          onClick={() => isGenerator ? handleTrigPrint(t) : openTest(t.id).then(() => setTimeout(window.print, 300))}
                        >
                          Печать
                        </Button>
                        {canEdit && (
                          <Button icon={<EditOutlined />} onClick={() => isGenerator ? setEditingTrigId(t.id) : openTest(t.id)}>
                            Редактировать
                          </Button>
                        )}
                        {canDelete && (
                          <Popconfirm
                            title={`Удалить «${t.title}»?`}
                            onConfirm={() => handleDelete(t.id, t.title)}
                            okText="Да" cancelText="Нет" okType="danger"
                          >
                            <Button danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        )}
                      </Space>
                    </div>

                    {isIssueOpen && (
                      <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                        <SessionPanel mcTestId={t.id} />
                      </div>
                    )}

                    {isAnalyticsOpen && (
                      <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                        <MCTestAnalytics
                          mcTestId={t.id}
                          variants={t.variants || []}
                          shuffleMode={t.shuffle_mode}
                        />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </Card>

        {/* Печать тестов из генераторов (через TrigMCPrintLayout) */}
        {trigPrintTest && (
          <TrigMCPrintLayout
            variants={trigPrintTest.variants}
            title={trigPrintTest.title}
            shuffleMode={trigPrintTest.shuffle_mode || 'fixed'}
          />
        )}

        {/* Редактор тестов из генераторов */}
        <TrigMCTestEditor
          testId={editingTrigId}
          open={!!editingTrigId}
          onClose={() => setEditingTrigId(null)}
          onSaved={() => loadList()}
        />
      </div>
    );
  }

  // ─── EDIT MODE (тесты из задачника) ──────────────────────────────────────

  const collapseItems = mc.variants.map((variant, vi) => ({
    key: String(vi),
    label: (
      <Space>
        <strong>Вариант {variant.number}</strong>
        <Tag color="blue">{variant.tasks.length} задач</Tag>
      </Space>
    ),
    extra: (
      <Space onClick={(e) => e.stopPropagation()}>
        <Button size="small" icon={<AppstoreAddOutlined />} onClick={() => setTaskSelectFor(vi)}>
          Добавить задачи
        </Button>
        <Button size="small" danger icon={<CloseOutlined />} onClick={() => mc.removeVariant(vi)}>
          Удалить вариант
        </Button>
      </Space>
    ),
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {variant.tasks.length === 0 && <Empty description="Нет задач в варианте" />}
        {variant.tasks.map((t, ti) => {
          const taskRec = mc.tasksMap[t.task_id];
          return (
            <Card key={`${t.task_id}-${ti}`} size="small" type="inner" title={
              <Space>
                <span>№{ti + 1}</span>
                {taskRec?.code && <Tag>{taskRec.code}</Tag>}
                {taskRec?.answer && <Tag color="green">Ответ: {taskRec.answer}</Tag>}
              </Space>
            } extra={
              <Space>
                <Tooltip title="Вверх">
                  <Button size="small" icon={<ArrowUpOutlined />} disabled={ti === 0}
                    onClick={() => mc.moveTaskInVariant(vi, ti, ti - 1)} />
                </Tooltip>
                <Tooltip title="Вниз">
                  <Button size="small" icon={<ArrowDownOutlined />} disabled={ti === variant.tasks.length - 1}
                    onClick={() => mc.moveTaskInVariant(vi, ti, ti + 1)} />
                </Tooltip>
                <Button size="small" danger icon={<DeleteOutlined />}
                  onClick={() => mc.removeTaskFromVariant(vi, ti)} />
              </Space>
            }>
              <div style={{ marginBottom: 8 }}>
                <MathRenderer text={taskRec?.statement_md || '_(задача не загружена)_'} />
              </div>
              <MCOptionsEditor
                options={t.options}
                onUpdateOption={(oi, text) => mc.updateOption(vi, ti, oi, text)}
                onSetCorrect={(oi) => mc.setCorrectOption(vi, ti, oi)}
                onReorder={(from, to) => mc.reorderOptions(vi, ti, from, to)}
                onRegenerate={() => mc.regenerateOptions(vi, ti)}
              />
            </Card>
          );
        })}
      </div>
    ),
  }));

  const editTabItems = [
    {
      key: 'editor',
      label: 'Редактор',
      children: (
        <>
          <Card title="Параметры теста" size="small" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Название</label>
                <Input value={mc.title} onChange={e => mc.setTitle(e.target.value)}
                  placeholder="Например: Производная — контрольная" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Класс</label>
                <InputNumber value={mc.classNumber} onChange={mc.setClassNumber}
                  min={1} max={11} style={{ width: '100%' }} placeholder="11" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 4 }}>Описание</label>
                <TextArea value={mc.description} onChange={e => mc.setDescription(e.target.value)}
                  rows={2} placeholder="Краткое описание (необязательно)" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Темы</label>
                <Select mode="multiple" value={mc.topicIds} onChange={mc.setTopicIds}
                  placeholder="Можно несколько" style={{ width: '100%' }}
                  showSearch optionFilterProp="label"
                  options={topics.map(t => ({ value: t.id, label: t.title }))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Вариантов ответа на задачу</label>
                <InputNumber value={mc.optionsCount} onChange={mc.setOptionsCount}
                  min={2} max={6} style={{ width: '100%' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 4 }}>Порядок вариантов ответа</label>
                <Radio.Group value={mc.shuffleMode} onChange={e => mc.setShuffleMode(e.target.value)}>
                  <Radio value="fixed">Фиксированный (как в редакторе)</Radio>
                  <Radio value="per_student">Перемешивать для каждого ученика</Radio>
                </Radio.Group>
              </div>
            </div>
          </Card>

          <Card title="Варианты" size="small" extra={
            <Button icon={<PlusOutlined />} onClick={mc.addVariant}>Добавить вариант</Button>
          } style={{ marginBottom: 16 }}>
            {mc.variants.length === 0 ? (
              <Empty description="Нажмите «Добавить вариант», чтобы начать" />
            ) : (
              <Collapse
                activeKey={activeVariantKey}
                onChange={setActiveVariantKey}
                items={collapseItems}
              />
            )}
          </Card>
        </>
      ),
    },
    {
      key: 'issue',
      label: 'Выдача',
      disabled: !mc.savedId,
      children: mc.savedId ? (
        <Card title={<Space><FileTextOutlined /> Выдача ученикам</Space>} size="small">
          <SessionPanel mcTestId={mc.savedId} />
        </Card>
      ) : null,
    },
    {
      key: 'analytics',
      label: 'Аналитика',
      disabled: !mc.savedId,
      children: mc.savedId ? (
        <Card title={<Space><BarChartOutlined /> Аналитика по тесту</Space>} size="small">
          <MCTestAnalytics
            mcTestId={mc.savedId}
            variants={mc.variants}
            shuffleMode={mc.shuffleMode}
          />
        </Card>
      ) : null,
    },
  ];

  return (
    <>
      <div style={{ padding: 16 }} className="mc-test-editor-screen">
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setMode('list')}>К списку</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={mc.loading}>
            {mc.savedId ? 'Сохранить изменения' : 'Сохранить тест'}
          </Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
        </Space>

        <Tabs items={editTabItems} />
      </div>

      {/* Печать */}
      <MCTestPrintLayout
        variants={mc.variants}
        tasksMap={mc.tasksMap}
        title={mc.title}
        shuffleMode={mc.shuffleMode}
        showTeacherKey={true}
        seedBase={mc.savedId || 'preview'}
      />

      <TaskSelectModal
        visible={taskSelectFor !== null}
        onCancel={() => setTaskSelectFor(null)}
        onSelect={(task) => {
          mc.addTasksToVariant(taskSelectFor, [task]);
          message.success(`Задача добавлена в Вариант ${mc.variants[taskSelectFor]?.number}`);
        }}
        topics={topics}
        subtopics={subtopics}
        tags={tags}
        excludeIds={taskSelectFor !== null ? mc.variants[taskSelectFor]?.tasks.map(t => t.task_id) || [] : []}
      />
    </>
  );
};

export default MCTestGenerator;
