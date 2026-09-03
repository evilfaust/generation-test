import { useState, useEffect, useCallback, useRef } from 'react';
import { layoutWithoutTask } from '../utils/sheetTasks';

/**
 * План листа: порядок заданий и разделительные черты.
 *
 * План один на все варианты — задание №5 везде одного типа (см.
 * `utils/questionPlan`), поэтому и перестановка, и черта применяются сразу ко
 * всем вариантам: строка «отсюда сложные» проходит через лист в одном месте.
 *
 * Элементы: `{ kind: 'task', idx }` — задание с индексом idx внутри варианта,
 * `{ kind: 'divider', id }` — горизонтальная черта.
 */
const naturalLayout = (count) =>
  Array.from({ length: count }, (_, i) => ({ kind: 'task', idx: i }));

// Порядок из сохранённого листа мог устареть (лист правили в другой вкладке):
// оставляем только существующие задания и дописываем те, которых в нём нет.
const normalizeLayout = (saved, count) => {
  const seen = new Set();
  const kept = (Array.isArray(saved) ? saved : []).filter((item) => {
    if (item?.kind === 'divider') return true;
    if (item?.kind !== 'task') return false;
    if (item.idx < 0 || item.idx >= count || seen.has(item.idx)) return false;
    seen.add(item.idx);
    return true;
  });
  for (let i = 0; i < count; i++) {
    if (!seen.has(i)) kept.push({ kind: 'task', idx: i });
  }
  return kept;
};

export function useSheetLayout(tasksData) {
  const [layout, setLayout] = useState([]);
  // Для какого набора заданий порядок уже задан. Загрузка сохранённого листа
  // выставляет порядок вместе с заданиями — эффект ниже не должен его затирать.
  const appliedFor = useRef(null);

  // Новая генерация — новый естественный порядок
  useEffect(() => {
    if (appliedFor.current === tasksData) return;
    appliedFor.current = tasksData;
    setLayout(naturalLayout(tasksData?.[0]?.length ?? 0));
  }, [tasksData]);

  const move = useCallback((from, to) => {
    setLayout(prev => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const addDivider = useCallback((position) => {
    setLayout(prev => {
      const next = [...prev];
      const at = position === undefined ? next.length : position;
      next.splice(at, 0, { kind: 'divider', id: `d${Date.now()}${next.length}` });
      return next;
    });
  }, []);

  const removeAt = useCallback((index) => {
    setLayout(prev => prev.filter((item, i) => !(i === index && item.kind === 'divider')));
  }, []);

  const reset = useCallback(() => {
    setLayout(naturalLayout(tasksData?.[0]?.length ?? 0));
  }, [tasksData]);

  // Задание убрали с листа: его позиция уходит, а номера следующих съезжают
  // на единицу — иначе порядок стал бы ссылаться на чужие задания.
  const removeTask = useCallback((idx) => {
    setLayout(prev => layoutWithoutTask(prev, idx));
  }, []);

  // Порядок из сохранённого листа. Вызывается вместе с setTasksData — поэтому
  // принимает те же данные, для которых порядок посчитан.
  const apply = useCallback((srcTasksData, savedLayout) => {
    appliedFor.current = srcTasksData;
    setLayout(normalizeLayout(savedLayout, srcTasksData?.[0]?.length ?? 0));
  }, []);

  return { layout, move, addDivider, removeAt, removeTask, reset, apply };
}

export default useSheetLayout;
