import { useState, useEffect, useCallback, Fragment } from 'react';
import { Modal, Button, InputNumber, Input, Space, Spin, Alert, Tag, Empty, Tooltip, Segmented, Checkbox, App } from 'antd';
import { ReloadOutlined, SaveOutlined, SwapOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import TaskSelectModal from '../TaskSelectModal';
import TaskEditModal from '../TaskEditModal';
import VectorIndexNote from './VectorIndexNote';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { useReferenceData } from '../../contexts/ReferenceDataContext';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

// Пресеты степени похожести параллелей (полоса cos для /parallel-variants).
const SIM_PRESETS = {
  similar:  { label: 'Похожие',        min_cos: 0.90, max_cos: 0.99 },
  balanced: { label: 'Сбалансировано', min_cos: 0.85, max_cos: 0.995 },
  diverse:  { label: 'Разные',         min_cos: 0.70, max_cos: 0.90 },
};
const SIM_PRESET_OPTIONS = Object.entries(SIM_PRESETS).map(([value, p]) => ({ value, label: p.label }));

function cosColor(cos) {
  if (cos == null) return 'default';
  if (cos >= 0.97) return 'red';
  if (cos >= 0.9) return 'orange';
  return 'gold';
}

const TaskCell = ({ t, onPick, onEdit, editing }) => {
  if (!t || t.missing) {
    return (
      <div style={{ height: '100%', boxSizing: 'border-box', padding: 8, border: '1px dashed #ffccc7', borderRadius: 6, background: '#fff2f0', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#cf1322' }}>нет подходящей замены</span>
        {onPick && <Button size="small" icon={<PlusOutlined />} onClick={onPick}>Выбрать</Button>}
      </div>
    );
  }
  return (
    <div style={{ height: '100%', boxSizing: 'border-box', padding: 8, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fafafa', fontSize: 12 }}>
      <Space size={4} style={{ marginBottom: 4, width: '100%', justifyContent: 'space-between' }}>
        <Space size={4}>
          <span style={{ color: '#888' }}>{t.code}</span>
          <Tag style={{ margin: 0 }}>{t.answer || '—'}</Tag>
          {t.cos != null ? (
            <Tooltip title={`похоже на образец, cos ${t.cos}`}>
              <Tag color={cosColor(t.cos)} style={{ margin: 0 }}>{Math.round(t.cos * 100)}%</Tag>
            </Tooltip>
          ) : t.manual ? <Tag color="blue" style={{ margin: 0 }}>вручную</Tag> : null}
          {t.same_answer && (
            <Tooltip title="Ответ совпадает с образцом — по нему списывание не отличить. Замените, если это важно.">
              <Tag color="volcano" style={{ margin: 0 }}>тот же ответ</Tag>
            </Tooltip>
          )}
          {t.off_spec && (
            <Tooltip title="Структурно задача отличается от образца (форма ответа, объём условия, таблица/чертёж). Взята потому, что более подходящей в базе не нашлось.">
              <Tag color="gold" style={{ margin: 0 }}>иная структура</Tag>
            </Tooltip>
          )}
          {t.solve_rate != null && (
            <Tooltip title="Доля верных ответов учеников по этой задаче — параллели подбираются сопоставимой трудности">
              <Tag style={{ margin: 0, color: '#666' }}>решают {Math.round(t.solve_rate * 100)}%</Tag>
            </Tooltip>
          )}
        </Space>
        <Space size={0}>
          {onEdit && (
            <Tooltip title="Редактировать задачу (починить LaTeX и т.п.)">
              <Button size="small" type="text" loading={editing} icon={<EditOutlined />} onClick={onEdit} />
            </Tooltip>
          )}
          {onPick && (
            <Tooltip title="Заменить задачу вручную">
              <Button size="small" type="text" icon={<SwapOutlined />} onClick={onPick} />
            </Tooltip>
          )}
        </Space>
      </Space>
      <div style={{ overflow: 'hidden' }}><MathRenderer text={t.statement} /></div>
    </div>
  );
};

/**
 * A4 — семейство параллельных вариантов «по образцу».
 * Берёт базовый набор задач и подбирает параллели (тот же тип, другие числа).
 *
 * @param {boolean} open
 * @param {function} onClose
 * @param {Array} baseTasks - [{id, code, ...}] базовый вариант
 * @param {string[]} excludeTaskIds - задачи, которые нельзя выдавать в параллели
 *        (остальные варианты той же работы — иначе «дубль» повторит вариант 2 оригинала)
 */
export default function ParallelVariantsModal({ open, onClose, baseTasks = [], baseWorkId = null, baseTitle = '', classNumber = null, excludeTaskIds = [], onOpenWork }) {
  const { message, modal } = App.useApp();
  const { canEdit } = useAuth();
  const { topics, tags, subtopics, years, sources } = useReferenceData();
  const [count, setCount] = useState(2);
  const [simPreset, setSimPreset] = useState('balanced');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // [{id, role, title}] после создания работ
  const [title, setTitle] = useState('');
  const [pickTarget, setPickTarget] = useState(null); // { vi, pos } — какую ячейку заполняем
  const [editTask, setEditTask] = useState(null); // полная задача для TaskEditModal
  const [editingId, setEditingId] = useState(null); // task_id, пока грузим полную задачу

  const [rejectPairs, setRejectPairs] = useState({}); // baseTaskId → [отвергнутые вручную]
  const [families, setFamilies] = useState([]); // прошлые семейства A4 по этим задачам
  const [avoidPrevious, setAvoidPrevious] = useState(true);

  // Массив-проп пересоздаётся на каждом рендере родителя — держим стабильный ключ.
  const excludeKey = excludeTaskIds.filter(Boolean).join(',');

  // Задачи прошлых параллелей: их незачем предлагать снова, если учитель делает
  // ещё один комплект дублей к той же работе.
  const previousIds = avoidPrevious
    ? [...new Set(families.flatMap((f) => f.taskIds))].filter((id) => !baseTasks.some((t) => t.id === id))
    : [];
  const previousKey = previousIds.join(',');
  const rejectKey = JSON.stringify(rejectPairs);

  // Патч одной задачи (по task_id) во всём семействе — образец + все параллели.
  const patchFamilyTask = (taskId, patch) => {
    setResult((prev) => {
      if (!prev) return prev;
      const fix = (cell) => (cell && cell.task_id === taskId ? { ...cell, ...patch } : cell);
      return { ...prev, base: prev.base.map(fix), variants: prev.variants.map((v) => v.map(fix)) };
    });
  };

  // Открыть редактор: подтянуть полную задачу из БД.
  const handleEdit = async (taskId) => {
    if (!taskId) return;
    setEditingId(taskId);
    try {
      const full = await api.getTask(taskId);
      if (!full) throw new Error('not found');
      setEditTask(full);
    } catch {
      message.error('Не удалось загрузить задачу');
    } finally {
      setEditingId(null);
    }
  };

  // Сохранить правки задачи и сразу обновить карточки семейства.
  const handleSaveEdit = async (taskId, values) => {
    await api.updateTask(taskId, values);
    patchFamilyTask(taskId, {
      code: values.code,
      answer: values.answer,
      statement: (values.statement_md || '').replace(/\s+/g, ' ').slice(0, 160),
    });
    setEditTask(null);
    message.success('Задача обновлена');
  };

  // Удалить задачу из базы; в семействе ячейка станет «нет замены».
  const handleDeleteEdit = async (taskId) => {
    const finish = () => { patchFamilyTask(taskId, { missing: true, task_id: null }); setEditTask(null); message.success('Задача удалена'); };
    try {
      await api.deleteTask(taskId);
      finish();
    } catch (error) {
      if (error?.status === 400) {
        modal.confirm({
          title: 'Задача используется в работах',
          content: 'Задача входит в варианты или другие работы. Удалить её отовсюду и убрать из базы?',
          okText: 'Удалить', okButtonProps: { danger: true }, cancelText: 'Отмена',
          onOk: async () => { await api.forceDeleteTask(taskId); finish(); },
        });
      } else {
        message.error('Ошибка при удалении задачи');
      }
    }
  };

  // все задачи, уже занятые в семействе (образец + все параллели) — чтобы не повторять
  const usedIds = (() => {
    const s = new Set();
    if (result) {
      result.base.forEach((t) => t && !t.missing && s.add(t.task_id));
      result.variants.forEach((v) => v.forEach((t) => t && !t.missing && s.add(t.task_id)));
    }
    return [...s];
  })();

  // Тема образца в той же строке — ею предзаполняем выбор ручной замены.
  const pickTopic = pickTarget && result ? (result.base[pickTarget.pos]?.topic || null) : null;

  const handlePick = (task) => {
    if (!pickTarget) return;
    const { vi, pos } = pickTarget;
    // Ручная замена = сигнал «подобрано плохо». Запоминаем пару, чтобы следующий
    // подбор по этому образцу её не предлагал.
    const replaced = result?.variants?.[vi]?.[pos];
    const baseId = result?.base?.[pos]?.task_id;
    if (replaced?.task_id && baseId && replaced.task_id !== task.id) {
      setRejectPairs((prev) => ({
        ...prev,
        [baseId]: [...new Set([...(prev[baseId] || []), replaced.task_id])],
      }));
      api.markRejectedParallel(baseId, replaced.task_id);
    }
    setResult((prev) => {
      const variants = prev.variants.map((v) => v.slice());
      variants[vi][pos] = {
        task_id: task.id, code: task.code, answer: task.answer,
        statement: (task.statement_md || '').replace(/\s+/g, ' ').slice(0, 160),
        manual: true,
      };
      return { ...prev, variants };
    });
    setPickTarget(null);
  };

  const generate = useCallback(async () => {
    const ids = baseTasks.map((t) => t.id).filter(Boolean);
    if (ids.length === 0) return;
    setLoading(true); setError(null);
    try {
      const band = SIM_PRESETS[simPreset] || SIM_PRESETS.balanced;
      const res = await fetch(`${PDF_SERVICE_URL}/parallel-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_ids: ids, count, min_cos: band.min_cos, max_cos: band.max_cos,
          reject_pairs: rejectPairs,
          exclude_task_ids: [
            ...(excludeKey ? excludeKey.split(',') : []),
            ...(previousKey ? previousKey.split(',') : []),
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Сервис ответил ${res.status}`);
      setResult(await res.json());
      setCreated(null);
    } catch (e) {
      setError(e.message); setResult(null);
    } finally {
      setLoading(false);
    }
  }, [baseTasks, count, simPreset, excludeKey, previousKey, rejectKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setTitle(baseTitle || 'Вариант');
    setCreated(null);
    const ids = baseTasks.map((t) => t.id).filter(Boolean);
    api.getVariantFamiliesByTasks(ids).then((list) => setFamilies(list || [])).catch(() => setFamilies([]));
    api.getRejectedParallels(ids).then((map) => setRejectPairs(map || {})).catch(() => setRejectPairs({}));
    /* eslint-disable-next-line */
  }, [open]);

  // Первый подбор — после того, как узнали про прошлые семейства (иначе первый
  // прогон шёл бы без их исключения и сразу перерисовывался).
  useEffect(() => {
    if (open) generate();
    /* eslint-disable-next-line */
  }, [open, previousKey]);

  // Создать работы в «Мои работы»: оригинал + дубль 1..N, связать в variant_family.
  const createWorks = async () => {
    if (!result) return;
    setSaving(true);
    const createdIds = []; // для отката, если оборвёмся на середине семейства
    try {
      const mkVariant = (workId, ids) =>
        api.createVariant({ work: workId, number: 1, tasks: ids, order: ids.map((id, i) => ({ taskId: id, position: i })) });
      const works = [];

      // 1) оригинал — переиспользуем исходную работу, либо создаём из образца
      const baseIds = result.base.filter((t) => t && !t.missing).map((t) => t.task_id);
      if (baseWorkId) {
        // Исходную работу не переименовываем — показываем её настоящее название.
        works.push({ id: baseWorkId, role: 'оригинал', title: baseTitle || 'исходная работа' });
      } else {
        const w = await api.createWork({ title: `${title} — оригинал`, ...(classNumber ? { class: classNumber } : {}) });
        createdIds.push(w.id);
        await mkVariant(w.id, baseIds);
        works.push({ id: w.id, role: 'оригинал', title: w.title });
      }

      // 2) параллели → дубль N
      for (let i = 0; i < result.variants.length; i++) {
        const ids = result.variants[i].filter((t) => t && !t.missing).map((t) => t.task_id);
        if (!ids.length) continue;
        const w = await api.createWork({ title: `${title} — дубль ${i + 1}`, ...(classNumber ? { class: classNumber } : {}) });
        createdIds.push(w.id);
        await mkVariant(w.id, ids);
        works.push({ id: w.id, role: `дубль ${i + 1}`, title: w.title });
      }

      // 3) запись связи на уровне задач (variant_family)
      try {
        const parallels = result.variants.map((v) => v.filter((t) => t && !t.missing));
        await api.markVariantFamily(result.base.filter((t) => t && !t.missing), parallels, title);
      } catch (_) { /* связь некритична */ }

      setCreated(works);
      message.success(`Создано работ: ${works.length}`);
    } catch (e) {
      // Полусемейство хуже, чем ничего: пользователь не поймёт, какие дубли
      // созданы, а какие нет. Убираем всё, что успели создать этим запуском.
      for (const id of createdIds) {
        try { await api.deleteWork(id); } catch { /* уже удалено или нет прав */ }
      }
      message.error(`Не удалось создать работы: ${e.message}. Созданное откачено.`);
    } finally {
      setSaving(false);
    }
  };

  const cols = result ? 1 + result.variants.length : 1;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={Math.min(360 * cols, 1200)}
      title="🧬 Параллельные варианты (по образцу)"
      footer={[
        canEdit && result && !created && (
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} onClick={createWorks}>
            Создать работы в «Мои работы»
          </Button>
        ),
        <Button key="close" onClick={onClose}>Закрыть</Button>,
      ]}
    >
      {created ? (
        <div>
          <Alert type="success" showIcon style={{ marginBottom: 12 }}
            message={`Создано работ: ${created.length}. Найти их можно в разделе «Мои работы».`} />
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {created.map((w) => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                <Tag color={w.role === 'оригинал' ? 'gold' : 'blue'}>{w.role}</Tag>
                <span style={{ flex: 1 }}>{w.title}</span>
                {onOpenWork && <Button size="small" onClick={() => { onOpenWork(w.id); onClose(); }}>Открыть</Button>}
              </div>
            ))}
          </Space>
        </div>
      ) : (
      <>
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="Для каждой задачи образца подбирается похожая (та же тема и тип, другие числа). Получаются параллельные варианты: подготовка → контрольная → пересдача."
      />
      {families.length > 0 && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message={`Для этих задач параллели уже создавались (${families.length === 1 ? 'семейство' : 'семейств'}: ${families.length}${families[0]?.label ? `, «${families[0].label}»` : ''}).`}
          description={
            <Checkbox checked={avoidPrevious} onChange={(e) => setAvoidPrevious(e.target.checked)}>
              Не предлагать задачи из прошлых параллелей ({[...new Set(families.flatMap((f) => f.taskIds))].length} шт.)
            </Checkbox>
          }
        />
      )}

      <Space style={{ marginBottom: 12, width: '100%' }} wrap>
        <span>Название:</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 220 }} placeholder="Название работ" />
        <span>Параллелей:</span>
        <InputNumber min={1} max={5} value={count} onChange={(v) => setCount(v || 2)} />
        <Tooltip title="Степень похожести параллелей на образец: «Похожие» — почти клоны (другие числа), «Разные» — тот же тип, но заметно иной сюжет.">
          <span>Похожесть:</span>
        </Tooltip>
        <Segmented options={SIM_PRESET_OPTIONS} value={simPreset} onChange={setSimPreset} />
        <Button icon={<ReloadOutlined />} onClick={generate} loading={loading}>Подобрать</Button>
      </Space>

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
      {!loading && error && <Alert type="error" showIcon message={error} />}
      {!loading && result?.shortage?.length > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12 }}
          message={`Для ${result.shortage.length} позиц. не хватило похожих задач в базе — отмечены красным. Ослабьте похожесть, уменьшите число параллелей или добавьте задач этого типа.`}
          description={<VectorIndexNote alwaysShow />}
        />
      )}

      {!loading && result && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: 10, rowGap: 6, alignItems: 'stretch' }}>
          {/* Шапка колонок */}
          <div style={{ fontWeight: 600, marginBottom: 2, textAlign: 'center' }}>Образец</div>
          {result.variants.map((_, vi) => (
            <div key={`h${vi}`} style={{ fontWeight: 600, marginBottom: 2, textAlign: 'center', color: '#1890ff' }}>
              Параллель {vi + 1}
            </div>
          ))}

          {/* Строки задач: каждая позиция образца + параллели в одной grid-строке */}
          {result.base.map((bt, i) => (
            <Fragment key={i}>
              <TaskCell
                t={bt}
                onEdit={canEdit && bt?.task_id ? () => handleEdit(bt.task_id) : undefined}
                editing={editingId === bt?.task_id}
              />
              {result.variants.map((variant, vi) => {
                const cell = variant[i];
                return (
                  <TaskCell
                    key={vi}
                    t={cell}
                    onPick={() => setPickTarget({ vi, pos: i })}
                    onEdit={canEdit && cell?.task_id ? () => handleEdit(cell.task_id) : undefined}
                    editing={editingId === cell?.task_id}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      )}

      {!loading && result && result.base.length === 0 && <Empty description="Нет задач в образце" />}
      </>
      )}

      <TaskSelectModal
        visible={pickTarget !== null}
        onCancel={() => setPickTarget(null)}
        onSelect={handlePick}
        excludeIds={usedIds}
        initialFilters={pickTopic ? { topic: pickTopic } : null}
      />

      {editTask && (
        <TaskEditModal
          task={editTask}
          visible={!!editTask}
          onClose={() => setEditTask(null)}
          onSave={handleSaveEdit}
          onDelete={handleDeleteEdit}
          allTags={tags || []}
          allSources={sources || []}
          allYears={years || []}
          allSubtopics={subtopics || []}
          allTopics={topics || []}
        />
      )}
    </Modal>
  );
}
