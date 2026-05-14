import { useState, useCallback } from 'react';
import { api } from '../services/pocketbase';
import { buildOptions } from '../utils/distractorGenerator';

const DEFAULT_OPTIONS_COUNT = 4;

export function useMCTest() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classNumber, setClassNumber] = useState(null);
  const [topicIds, setTopicIds] = useState([]);
  const [optionsCount, setOptionsCount] = useState(DEFAULT_OPTIONS_COUNT);
  const [shuffleMode, setShuffleMode] = useState('per_student'); // 'fixed' | 'per_student'
  const [sourceType, setSourceType] = useState('catalog'); // 'catalog' | 'generator'
  const [generatorType, setGeneratorType] = useState(null);
  const [generatorSettings, setGeneratorSettings] = useState(null);
  const [variants, setVariants] = useState([]); // [{ number, tasks: [{task_id, options}] }]
  const [tasksMap, setTasksMap] = useState({}); // { [taskId]: taskRecord }
  const [savedId, setSavedId] = useState(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setTitle('');
    setDescription('');
    setClassNumber(null);
    setTopicIds([]);
    setOptionsCount(DEFAULT_OPTIONS_COUNT);
    setShuffleMode('per_student');
    setSourceType('catalog');
    setGeneratorType(null);
    setGeneratorSettings(null);
    setVariants([]);
    setTasksMap({});
    setSavedId(null);
  }, []);

  const addVariant = useCallback(() => {
    setVariants(prev => [...prev, { number: prev.length + 1, tasks: [] }]);
  }, []);

  const removeVariant = useCallback((index) => {
    setVariants(prev => prev.filter((_, i) => i !== index).map((v, i) => ({ ...v, number: i + 1 })));
  }, []);

  const addTasksToVariant = useCallback((variantIndex, tasks) => {
    setTasksMap(prev => {
      const next = { ...prev };
      tasks.forEach(t => { next[t.id] = t; });
      return next;
    });
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex) return v;
      const existingIds = new Set(v.tasks.map(t => t.task_id));
      const newTasks = tasks
        .filter(t => !existingIds.has(t.id))
        .map(t => ({
          task_id: t.id,
          options: buildOptions(t.answer || '', optionsCount),
        }));
      return { ...v, tasks: [...v.tasks, ...newTasks] };
    }));
  }, [optionsCount]);

  const removeTaskFromVariant = useCallback((variantIndex, taskIndex) => {
    setVariants(prev => prev.map((v, i) =>
      i === variantIndex ? { ...v, tasks: v.tasks.filter((_, j) => j !== taskIndex) } : v
    ));
  }, []);

  const moveTaskInVariant = useCallback((variantIndex, fromIdx, toIdx) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex) return v;
      const tasks = [...v.tasks];
      const [moved] = tasks.splice(fromIdx, 1);
      tasks.splice(toIdx, 0, moved);
      return { ...v, tasks };
    }));
  }, []);

  const updateOption = useCallback((variantIndex, taskIndex, optionIndex, text) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex) return v;
      const tasks = v.tasks.map((t, j) => {
        if (j !== taskIndex) return t;
        const options = t.options.map((o, k) => k === optionIndex ? { ...o, text } : o);
        return { ...t, options };
      });
      return { ...v, tasks };
    }));
  }, []);

  const setCorrectOption = useCallback((variantIndex, taskIndex, optionIndex) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex) return v;
      const tasks = v.tasks.map((t, j) => {
        if (j !== taskIndex) return t;
        const options = t.options.map((o, k) => ({ ...o, is_correct: k === optionIndex }));
        return { ...t, options };
      });
      return { ...v, tasks };
    }));
  }, []);

  const reorderOptions = useCallback((variantIndex, taskIndex, fromIdx, toIdx) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex) return v;
      const tasks = v.tasks.map((t, j) => {
        if (j !== taskIndex) return t;
        const options = [...t.options];
        const [moved] = options.splice(fromIdx, 1);
        options.splice(toIdx, 0, moved);
        return { ...t, options };
      });
      return { ...v, tasks };
    }));
  }, []);

  const regenerateOptions = useCallback((variantIndex, taskIndex) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== variantIndex) return v;
      const tasks = v.tasks.map((t, j) => {
        if (j !== taskIndex) return t;
        const taskRec = tasksMap[t.task_id];
        const correct = taskRec?.answer || '';
        return { ...t, options: buildOptions(correct, optionsCount) };
      });
      return { ...v, tasks };
    }));
  }, [tasksMap, optionsCount]);

  const buildPayload = useCallback(() => ({
    title,
    description,
    class_number: classNumber,
    topics: topicIds,
    options_count: optionsCount,
    shuffle_mode: shuffleMode,
    source_type: sourceType,
    ...(generatorType ? { generator_type: generatorType } : {}),
    ...(generatorSettings ? { generator_settings: generatorSettings } : {}),
    variants,
  }), [title, description, classNumber, topicIds, optionsCount, shuffleMode, sourceType, generatorType, generatorSettings, variants]);

  const save = useCallback(async () => {
    setLoading(true);
    try {
      const payload = buildPayload();
      let rec;
      if (savedId) {
        rec = await api.updateMCTest(savedId, payload);
      } else {
        rec = await api.createMCTest(payload);
        setSavedId(rec.id);
      }
      return rec;
    } finally {
      setLoading(false);
    }
  }, [buildPayload, savedId]);

  const load = useCallback(async (id) => {
    setLoading(true);
    try {
      const rec = await api.getMCTest(id);
      setSavedId(rec.id);
      setTitle(rec.title || '');
      setDescription(rec.description || '');
      setClassNumber(rec.class_number || null);
      setTopicIds(rec.topics || []);
      setOptionsCount(rec.options_count || DEFAULT_OPTIONS_COUNT);
      setShuffleMode(rec.shuffle_mode || 'per_student');
      setSourceType(rec.source_type || 'catalog');
      setGeneratorType(rec.generator_type || null);
      setGeneratorSettings(rec.generator_settings || null);
      const v = rec.variants || [];
      setVariants(v);

      const allIds = v.flatMap(variant => variant.tasks.map(t => t.task_id));
      const tasks = await api.getTasksByIds(allIds);
      const map = {};
      tasks.forEach(t => { map[t.id] = t; });
      setTasksMap(map);
      return rec;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    title, setTitle,
    description, setDescription,
    classNumber, setClassNumber,
    topicIds, setTopicIds,
    optionsCount, setOptionsCount,
    shuffleMode, setShuffleMode,
    sourceType, generatorType, generatorSettings,
    variants,
    tasksMap,
    savedId,
    loading,
    reset,
    addVariant,
    removeVariant,
    addTasksToVariant,
    removeTaskFromVariant,
    moveTaskInVariant,
    updateOption,
    setCorrectOption,
    reorderOptions,
    regenerateOptions,
    save,
    load,
  };
}
