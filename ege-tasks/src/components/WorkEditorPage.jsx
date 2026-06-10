import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spin, App } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import WorkEditor from './WorkEditor';
import { api } from '../services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';

/**
 * Страница редактора работы: грузит работу по workId и рендерит WorkEditor
 * во всю ширину. Список работ — единственный, в «Мои работы» (WorkManager);
 * без workId страница редиректит туда (v3.9.70, левая панель-дубль удалена).
 */
const WorkEditorPage = ({ initialWorkId = null }) => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { topics, tags, subtopics, years, sources } = useReferenceData();
  const [workLoading, setWorkLoading] = useState(false);
  const [currentWork, setCurrentWork] = useState(null);
  const [variants, setVariants] = useState([]);
  const [attemptCount, setAttemptCount] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [dirty, setDirty] = useState(false);

  // Без выбранной работы редактору нечего показывать — ведём в список.
  useEffect(() => {
    if (!initialWorkId) navigate('/app/works', { replace: true });
  }, [initialWorkId, navigate]);

  // Правки вариантов из редактора помечают работу как «несохранённую».
  const setVariantsDirty = useCallback((updater) => {
    setVariants(updater);
    setDirty(true);
  }, []);

  const markDirty = useCallback(() => setDirty(true), []);

  // Защита от закрытия/перезагрузки вкладки с несохранёнными правками.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const goToList = useCallback(() => {
    if (dirty) {
      modal.confirm({
        title: 'Несохранённые изменения',
        content: 'В работе есть несохранённые правки. Перейти к списку без сохранения? Изменения будут потеряны.',
        okText: 'Перейти без сохранения',
        okButtonProps: { danger: true },
        cancelText: 'Остаться',
        onOk: () => navigate('/app/works'),
      });
    } else {
      navigate('/app/works');
    }
  }, [dirty, modal, navigate]);

  const loadWorkDetails = useCallback(async (workId) => {
    if (!workId) return;
    setWorkLoading(true);
    try {
      const work = await api.getWork(workId);
      const variantsData = await api.getVariantsByWork(workId);

      const normalizedVariants = await Promise.all(variantsData.map(async (variant) => {
        let tasks = variant.expand?.tasks || [];
        if (tasks.length === 0 && Array.isArray(variant.tasks) && variant.tasks.length > 0) {
          const loaded = await Promise.all(variant.tasks.map(id => api.getTask(id)));
          tasks = loaded.filter(Boolean);
        }

        if (Array.isArray(variant.order) && variant.order.length > 0) {
          const positionById = new Map(variant.order.map(o => [o.taskId, o.position]));
          tasks.sort((a, b) => (positionById.get(a.id) ?? 999) - (positionById.get(b.id) ?? 999));
        }

        return {
          number: variant.number,
          tasks,
        };
      }));

      const attempts = await api.getAttemptsCountByWork(workId);
      const workSessions = await api.getSessionsByWork(workId);

      setCurrentWork(work);
      setVariants(normalizedVariants);
      setAttemptCount(attempts);
      setSessions(workSessions || []);
      setDirty(false);
    } catch (error) {
      console.error('Error loading work details:', error);
      message.error('Ошибка загрузки работы');
    } finally {
      setWorkLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialWorkId) {
      loadWorkDetails(initialWorkId);
    } else {
      setCurrentWork(null);
      setVariants([]);
      setAttemptCount(0);
      setSessions([]);
    }
  }, [initialWorkId, loadWorkDetails]);

  const handleSave = async (values) => {
    if (!currentWork) return;
    try {
      await api.updateWork(currentWork.id, {
        title: values.title,
        topic: values.topic || null,
        time_limit: values.timeLimit ? parseInt(values.timeLimit, 10) : null,
      });

      const existingVariants = await api.getVariantsByWork(currentWork.id);
      const existingByNumber = new Map(existingVariants.map(v => [v.number, v]));
      const incomingNumbers = new Set();

      for (const variant of variants) {
        const taskIds = variant.tasks.map(t => t.id);
        const order = variant.tasks.map((t, idx) => ({ taskId: t.id, position: idx }));
        const payload = {
          work: currentWork.id,
          number: variant.number,
          tasks: taskIds,
          order,
        };

        incomingNumbers.add(variant.number);
        const existing = existingByNumber.get(variant.number);
        if (existing) {
          await api.updateVariant(existing.id, payload);
        } else {
          await api.createVariant(payload);
        }
      }

      for (const variant of existingVariants) {
        if (!incomingNumbers.has(variant.number)) {
          await api.deleteVariant(variant.id);
        }
      }

      message.success('Работа сохранена');
      setDirty(false);
      await loadWorkDetails(currentWork.id);
    } catch (error) {
      console.error('Error saving work:', error);
      message.error('Ошибка при сохранении работы');
    }
  };

  const handleSaveAsNew = async (values) => {
    if (!currentWork) return;
    try {
      const newWork = await api.createWork({
        title: values.title || currentWork.title || 'Контрольная работа',
        topic: values.topic || currentWork.topic || null,
        time_limit: values.timeLimit ? parseInt(values.timeLimit, 10) : currentWork.time_limit || null,
        archived: false,
      });

      for (const variant of variants) {
        const taskIds = variant.tasks.map(t => t.id);
        const order = variant.tasks.map((t, idx) => ({ taskId: t.id, position: idx }));
        await api.createVariant({
          work: newWork.id,
          number: variant.number,
          tasks: taskIds,
          order,
        });
      }

      message.success('Работа сохранена как новая');
      setDirty(false);
      navigate(`/app/works/${newWork.id}/edit`);
    } catch (error) {
      console.error('Error saving work as new:', error);
      message.error('Ошибка при сохранении работы');
    }
  };

  if (workLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={goToList}>
          К списку работ
        </Button>
      </div>
      <WorkEditor
        work={currentWork}
        variants={variants}
        setVariants={setVariantsDirty}
        onSave={handleSave}
        onSaveAsNew={handleSaveAsNew}
        hasAttempts={attemptCount > 0}
        attemptCount={attemptCount}
        sessions={sessions}
        dirty={dirty}
        onDirty={markDirty}
        topics={topics}
        tags={tags}
        subtopics={subtopics}
        years={years}
        sources={sources}
      />
    </div>
  );
};

export default WorkEditorPage;
