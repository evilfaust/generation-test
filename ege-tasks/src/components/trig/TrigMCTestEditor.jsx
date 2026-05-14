import { useState, useEffect, useCallback } from 'react';
import {
  Modal, Form, Input, Select, Radio, Button, Collapse,
  Space, Tag, Spin, App, Divider, Tabs,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { buildOptions } from '../../utils/distractorGenerator';
import MathRenderer from '../MathRenderer';
import MCOptionsEditor from '../mc-test/MCOptionsEditor';
import SessionPanel from '../worksheet/SessionPanel';
import { GENERATOR_LABELS } from './TrigMCSaveModal';

const { Option } = Select;

/** Оборачивает LaTeX-текст в $...$ если нет делимитеров */
function wrapLatex(text) {
  if (!text) return '';
  if (text.includes('$') || text.includes('\\(')) return text;
  if (/\\[a-zA-Z]|[_^{]/.test(text)) return `$${text}$`;
  return text;
}

export default function TrigMCTestEditor({ testId, open, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [test,     setTest]     = useState(null);
  // variants: [{number, tasks: [{task_id, question, answer, options, _taskRecord}]}]
  const [variants, setVariants] = useState([]);

  // Загрузить тест + записи задач
  const load = useCallback(async () => {
    if (!testId) return;
    setLoading(true);
    try {
      const t = await api.getMCTest(testId);
      setTest(t);
      form.setFieldsValue({
        title:        t.title || '',
        classNumber:  t.class_number || undefined,
        optionsCount: t.options_count || 4,
        shuffleMode:  t.shuffle_mode  || 'fixed',
      });

      // Собрать все task_id и загрузить задачи
      const allIds = (t.variants || [])
        .flatMap(v => (v.tasks || []).map(task => task.task_id).filter(Boolean));
      const uniqueIds = [...new Set(allIds)];
      const records = uniqueIds.length ? await api.getTasksByIds(uniqueIds) : [];
      const byId = new Map(records.map(r => [r.id, r]));

      setVariants(
        (t.variants || []).map(v => ({
          ...v,
          tasks: (v.tasks || []).map(task => ({
            ...task,
            _taskRecord: byId.get(task.task_id) || null,
          })),
        }))
      );
    } catch (e) {
      message.error('Ошибка загрузки теста: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [testId, form, message]);

  useEffect(() => {
    if (open && testId) load();
  }, [open, testId, load]);

  // === Редактирование опций ===

  const updateOption = (variantIdx, taskIdx, optionIdx, text) => {
    setVariants(prev => prev.map((v, vi) =>
      vi !== variantIdx ? v : {
        ...v,
        tasks: v.tasks.map((t, ti) =>
          ti !== taskIdx ? t : {
            ...t,
            options: t.options.map((o, oi) =>
              oi !== optionIdx ? o : { ...o, text }
            ),
          }
        ),
      }
    ));
  };

  const setCorrectOption = (variantIdx, taskIdx, optionIdx) => {
    setVariants(prev => prev.map((v, vi) =>
      vi !== variantIdx ? v : {
        ...v,
        tasks: v.tasks.map((t, ti) =>
          ti !== taskIdx ? t : {
            ...t,
            options: t.options.map((o, oi) => ({ ...o, is_correct: oi === optionIdx })),
          }
        ),
      }
    ));
  };

  const reorderOption = (variantIdx, taskIdx, fromIdx, toIdx) => {
    setVariants(prev => prev.map((v, vi) =>
      vi !== variantIdx ? v : {
        ...v,
        tasks: v.tasks.map((t, ti) => {
          if (ti !== taskIdx) return t;
          const opts = [...t.options];
          const [moved] = opts.splice(fromIdx, 1);
          opts.splice(toIdx, 0, moved);
          return { ...t, options: opts };
        }),
      }
    ));
  };

  const regenerateOptions = (variantIdx, taskIdx) => {
    setVariants(prev => prev.map((v, vi) =>
      vi !== variantIdx ? v : {
        ...v,
        tasks: v.tasks.map((t, ti) => {
          if (ti !== taskIdx) return t;
          const answer = t._taskRecord?.answer || t.answer || '';
          const count  = test?.options_count || 4;
          return { ...t, options: buildOptions(answer, count) };
        }),
      }
    ));
  };

  const regenerateAllOptions = () => {
    setVariants(prev => prev.map(v => ({
      ...v,
      tasks: v.tasks.map(t => {
        const answer = t._taskRecord?.answer || t.answer || '';
        const count  = test?.options_count || 4;
        return { ...t, options: buildOptions(answer, count) };
      }),
    })));
    message.success('Варианты ответов перегенерированы');
  };

  // === Сохранение ===

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      // Убрать служебное поле _taskRecord перед сохранением
      const cleanVariants = variants.map(v => ({
        ...v,
        tasks: v.tasks.map(({ _taskRecord, ...rest }) => rest),
      }));
      const updated = await api.updateMCTest(testId, {
        title:         values.title,
        class_number:  values.classNumber || null,
        options_count: values.optionsCount,
        shuffle_mode:  values.shuffleMode,
        variants:      cleanVariants,
      });
      setTest(updated);
      message.success('Тест обновлён');
      onSaved?.(updated);
    } catch (e) {
      message.error('Ошибка сохранения: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  // === Рендер ===

  const collapseItems = variants.map((variant, vi) => ({
    key: String(vi),
    label: (
      <Space>
        <span style={{ fontWeight: 600 }}>Вариант {variant.number}</span>
        <Tag color="blue">{variant.tasks?.length ?? 0} задач</Tag>
      </Space>
    ),
    children: (
      <div>
        {(variant.tasks || []).map((task, ti) => {
          const stmt = task._taskRecord?.statement_md
            || (task.question ? `${task.question}` : '');
          return (
            <div
              key={ti}
              style={{
                marginBottom: 16,
                padding: 12,
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                <Tag color="purple" style={{ flexShrink: 0 }}>{ti + 1}</Tag>
                <div style={{ fontSize: 14 }}>
                  <MathRenderer text={stmt} />
                </div>
              </div>
              <MCOptionsEditor
                options={task.options || []}
                onUpdateOption={(oi, text) => updateOption(vi, ti, oi, text)}
                onSetCorrect={(oi) => setCorrectOption(vi, ti, oi)}
                onReorder={(from, to) => reorderOption(vi, ti, from, to)}
                onRegenerate={() => regenerateOptions(vi, ti)}
              />
            </div>
          );
        })}
      </div>
    ),
  }));

  const tabItems = [
    {
      key: 'edit',
      label: 'Редактор',
      children: loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : (
        <div>
          <Form form={form} layout="vertical" style={{ marginBottom: 16 }}>
            <Form.Item name="title" label="Название" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Space wrap>
              <Form.Item name="classNumber" label="Класс" style={{ marginBottom: 0 }}>
                <Select placeholder="Не указан" allowClear style={{ width: 120 }}>
                  {Array.from({ length: 7 }, (_, i) => i + 5).map(n => (
                    <Option key={n} value={n}>{n} класс</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="optionsCount" label="Вариантов ответа" style={{ marginBottom: 0 }}>
                <Radio.Group>
                  <Radio value={2}>2</Radio>
                  <Radio value={3}>3</Radio>
                  <Radio value={4}>4</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="shuffleMode" label="Порядок опций" style={{ marginBottom: 0 }}>
                <Radio.Group>
                  <Radio value="fixed">Фиксированный</Radio>
                  <Radio value="per_student">Перемешать</Radio>
                </Radio.Group>
              </Form.Item>
            </Space>
          </Form>

          <Divider style={{ margin: '12px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600 }}>Задания по вариантам</span>
            <Button size="small" icon={<ReloadOutlined />} onClick={regenerateAllOptions}>
              Перегенерировать все ответы
            </Button>
          </div>

          <Collapse items={collapseItems} size="small" />

          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              Сохранить изменения
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: 'issue',
      label: 'Выдача',
      children: testId ? <SessionPanel mcTestId={testId} /> : null,
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        test
          ? `Редактор: ${test.title} (${GENERATOR_LABELS[test.generator_type] ?? test.generator_type})`
          : 'Редактор теста'
      }
      footer={null}
      width={760}
      destroyOnHidden
    >
      <Tabs items={tabItems} size="small" />
    </Modal>
  );
}
