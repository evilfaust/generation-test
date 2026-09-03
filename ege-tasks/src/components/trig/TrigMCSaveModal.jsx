import { useState, useEffect, useCallback } from 'react';
import {
  Modal, Tabs, Form, Input, Select, Radio, Button,
  Space, List, Tag, Popconfirm, message, Spin, Empty, Progress,
} from 'antd';
import { SaveOutlined, PrinterOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { buildOptionsWithAI } from '../../utils/aiDistractorGenerator';
import { generateTrigTaskCodes } from '../../utils/taskCodeGenerator';

const { Option } = Select;

export const GENERATOR_LABELS = {
  trig_expressions:        'Вычисление выражений',
  trig_equations:          'Простейшие уравнения',
  inverse_trig:            'Обратные функции',
  double_angle:            'Двойной аргумент',
  trig_equations_advanced: 'Уравнения f(kx+b)=a',
  reduction_formulas:      'Формулы приведения',
  addition_formulas:       'Формулы сложения',
  oral_counting:           'Устный счёт',
  log_exp_equations:       'Степени и логарифмы',
  linear_equations:        'Линейные уравнения',
  linear_inequalities:     'Линейные неравенства',
};

// Инструкция-префикс, записываемая в statement_md задачи
const GENERATOR_INSTRUCTIONS = {
  trig_expressions:        'Вычислите:',
  trig_equations:          'Решите уравнение:',
  inverse_trig:            'Вычислите:',
  double_angle:            'Вычислите или упростите:',
  trig_equations_advanced: 'Решите уравнение:',
  reduction_formulas:      'Упростите выражение:',
  addition_formulas:       'Вычислите или упростите:',
  log_exp_equations:       'Решите уравнение:',
  linear_equations:        'Решите уравнение:',
  linear_inequalities:     'Решите неравенство:',
};

// Соответствие generator_type → title темы (должно совпадать с migration 1772000023)
const GENERATOR_TOPIC_TITLES = {
  trig_expressions:        'Вычисление тригонометрических выражений',
  trig_equations:          'Простейшие тригонометрические уравнения',
  inverse_trig:            'Обратные тригонометрические функции',
  double_angle:            'Формулы двойного аргумента',
  trig_equations_advanced: 'Уравнения f(kx+b)=a',
  reduction_formulas:      'Формулы приведения',
  addition_formulas:       'Формулы сложения',
};

/**
 * Создаёт реальные записи в коллекции `tasks` для каждой задачи генератора,
 * возвращает варианты в формате {number, tasks: [{task_id, options}]}.
 * При ошибке откатывает уже созданные задачи.
 */
async function createTasksAndBuildVariants(tasksData, optionsCount, generatorType, onProgress) {
  const instruction = GENERATOR_INSTRUCTIONS[generatorType] || 'Вычислите:';
  const createdIds = [];

  // Определяем тему: ищем среди тригонометрических тем по названию
  let topicId = null;
  try {
    const targetTitle = GENERATOR_TOPIC_TITLES[generatorType];
    if (targetTitle) {
      const trigTopics = await api.getTrigTopics();
      const match = trigTopics.find(t => t.title === targetTitle);
      if (match) topicId = match.id;
    }
  } catch {
    // Тема не критична — продолжаем без неё
  }

  // Предварительно генерируем коды для всех задач (один запрос к API)
  const totalTaskCount = tasksData.reduce((s, v) => s + v.length, 0);
  let codePool = [];
  if (topicId) {
    try {
      codePool = await generateTrigTaskCodes(topicId, totalTaskCount);
    } catch {
      // Коды не критичны — продолжаем без них
    }
  }
  let codeIndex = 0;

  try {
    const variants = [];
    let done = 0;
    const total = totalTaskCount;

    for (let i = 0; i < tasksData.length; i++) {
      const variantTasks = tasksData[i];
      const tasks = [];

      for (const task of variantTasks) {
        const taskData = {
          statement_md: `${instruction}\n\n$$${task.exprLatex}$$`,
          answer:  task.resultLatex,
          source:  'trig_generator',
        };
        if (topicId) taskData.topic = topicId;
        if (codePool[codeIndex]) taskData.code = codePool[codeIndex++];
        const record = await api.createTask(taskData);
        createdIds.push(record.id);
        tasks.push({
          task_id:  record.id,
          question: task.exprLatex,
          answer:   task.resultLatex,
          options:  await buildOptionsWithAI(task.resultLatex, task.exprLatex, generatorType, optionsCount),
        });
        done++;
        // Прогресс 5–90 % — создание задач; 90–100 % — сохранение теста
        onProgress?.(5 + Math.round((done / total) * 85));
      }

      variants.push({ number: i + 1, tasks });
    }

    return variants;
  } catch (err) {
    // Откатить уже созданные задачи
    await Promise.allSettled(createdIds.map(id => api.deleteTask(id)));
    throw err;
  }
}

function SaveTab({ tasksData, generatorType, generatorTitle, settings, onSaved }) {
  const [form] = Form.useForm();
  const [saving,   setSaving]   = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    form.setFieldValue('title', generatorTitle || '');
  }, [generatorTitle, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (!tasksData?.length) {
      message.warning('Сначала сгенерируйте задания');
      return;
    }
    setSaving(true);
    setProgress(5);
    try {
      const variants = await createTasksAndBuildVariants(
        tasksData,
        values.optionsCount,
        generatorType,
        (pct) => setProgress(pct),
      );
      setProgress(95);
      const record = await api.createMCTest({
        title:              values.title,
        class_number:       values.classNumber || null,
        source_type:        'generator',
        generator_type:     generatorType,
        generator_settings: settings || {},
        options_count:      values.optionsCount,
        shuffle_mode:       values.shuffleMode,
        variants,
      });
      setProgress(100);
      message.success('Тест сохранён!');
      onSaved?.(record);
    } catch (e) {
      message.error('Ошибка сохранения: ' + (e?.message || e));
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  const totalTasks    = tasksData ? (tasksData[0]?.length ?? 0) : 0;
  const variantsCount = tasksData?.length ?? 0;

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ optionsCount: 4, shuffleMode: 'fixed' }}
      style={{ paddingTop: 8 }}
    >
      <Form.Item
        name="title"
        label="Название теста"
        rules={[{ required: true, message: 'Введите название' }]}
      >
        <Input placeholder="Название теста" />
      </Form.Item>

      <Form.Item name="classNumber" label="Класс (необязательно)">
        <Select placeholder="Не указан" allowClear style={{ width: 120 }}>
          {Array.from({ length: 7 }, (_, i) => i + 5).map(n => (
            <Option key={n} value={n}>{n} класс</Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="optionsCount" label="Количество вариантов ответа">
        <Radio.Group>
          <Radio value={2}>2</Radio>
          <Radio value={3}>3</Radio>
          <Radio value={4}>4</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item name="shuffleMode" label="Порядок вариантов ответа">
        <Radio.Group>
          <Radio value="fixed">Фиксированный</Radio>
          <Radio value="per_student">Перемешать у каждого</Radio>
        </Radio.Group>
      </Form.Item>

      {tasksData ? (
        <div style={{
          background: '#f6f6f6', borderRadius: 6, padding: '8px 12px',
          fontSize: 13, color: '#555', marginBottom: 8,
        }}>
          Будет сохранено: <b>{variantsCount}</b> вар. × <b>{totalTasks}</b> задач
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
            Каждая задача сохраняется как отдельная запись — студент видит разбор ошибок
          </div>
        </div>
      ) : (
        <div style={{ color: '#999', fontSize: 13, marginBottom: 8 }}>
          Задания не сгенерированы. Нажмите «Сгенерировать» в генераторе.
        </div>
      )}

      {saving && progress > 0 && (
        <Progress
          percent={progress}
          size="small"
          status={progress < 100 ? 'active' : 'success'}
          style={{ marginBottom: 8 }}
        />
      )}

      <Button
        type="primary"
        icon={<SaveOutlined />}
        onClick={handleSave}
        loading={saving}
        disabled={!tasksData}
      >
        {saving ? 'Сохранение...' : 'Сохранить тест'}
      </Button>
    </Form>
  );
}

function SavedTab({ generatorType, onPrint }) {
  const [tests,      setTests]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTests(await api.getMCTestsByGeneratorType(generatorType));
    } finally {
      setLoading(false);
    }
  }, [generatorType]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const test = tests.find(t => t.id === id);
      if (test?.variants) {
        const taskIds = (test.variants || [])
          .flatMap(v => (v.tasks || []).map(t => t.task_id).filter(Boolean));
        await Promise.allSettled(taskIds.map(tid => api.deleteTask(tid)));
      }
      await api.deleteMCTest(id);
      message.success('Тест удалён');
      setTests(prev => prev.filter(t => t.id !== id));
    } catch {
      message.error('Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>;
  if (!tests.length) return (
    <div style={{ paddingTop: 16 }}>
      <Empty description="Нет сохранённых тестов" />
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Button icon={<ReloadOutlined />} size="small" onClick={load}>Обновить</Button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button icon={<ReloadOutlined />} size="small" onClick={load}>Обновить</Button>
      </div>
      <List
        dataSource={tests}
        renderItem={t => {
          const variantsCount   = Array.isArray(t.variants) ? t.variants.length : 0;
          const tasksPerVariant = variantsCount > 0 ? (t.variants[0]?.tasks?.length ?? 0) : 0;
          return (
            <List.Item
              actions={[
                <Button
                  key="print" size="small" icon={<PrinterOutlined />}
                  onClick={() => onPrint(t)}
                >
                  Печать
                </Button>,
                <Popconfirm
                  key="del"
                  title="Удалить тест и все его задачи?"
                  onConfirm={() => handleDelete(t.id)}
                  okText="Да" cancelText="Нет"
                >
                  <Button size="small" danger icon={<DeleteOutlined />} loading={deletingId === t.id} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={t.title}
                description={
                  <Space size={4} wrap>
                    {t.class_number && <Tag>{t.class_number} кл.</Tag>}
                    <Tag color="blue">{variantsCount} вар.</Tag>
                    <Tag color="cyan">{tasksPerVariant} зад./вар.</Tag>
                    <Tag color="purple">{t.options_count} вар. ответа</Tag>
                    <span style={{ fontSize: 11, color: '#aaa' }}>
                      {new Date(t.created).toLocaleDateString('ru')}
                    </span>
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
}

export default function TrigMCSaveModal({
  open,
  onClose,
  tasksData,
  generatorType,
  generatorTitle,
  settings,
  onPrint,
}) {
  const [activeTab,  setActiveTab]  = useState('save');
  const [savedCount, setSavedCount] = useState(0);

  const handleSaved = () => {
    setSavedCount(c => c + 1);
    setActiveTab('list');
  };

  const tabs = [
    {
      key: 'save',
      label: 'Сохранить',
      children: (
        <SaveTab
          tasksData={tasksData}
          generatorType={generatorType}
          generatorTitle={generatorTitle}
          settings={settings}
          onSaved={handleSaved}
        />
      ),
    },
    {
      key: 'list',
      label: (
        <span>
          Сохранённые
          {savedCount > 0 && (
            <Tag color="blue" style={{ marginLeft: 4, lineHeight: '16px' }}>{savedCount}</Tag>
          )}
        </span>
      ),
      children: (
        <SavedTab
          key={`${generatorType}-${savedCount}`}
          generatorType={generatorType}
          onPrint={(t) => { onPrint?.(t); }}
        />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Тест с выбором — ${GENERATOR_LABELS[generatorType] ?? generatorType}`}
      footer={null}
      width={520}
      destroyOnHidden={false}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} size="small" />
    </Modal>
  );
}
