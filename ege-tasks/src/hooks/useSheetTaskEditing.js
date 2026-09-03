import { useCallback } from 'react';
import {
  patchTask, replaceTask, removeTaskEverywhere, appendTaskEverywhere,
  layoutWithoutTask,
} from '../utils/sheetTasks';
import { regenerateOneTask } from '../utils/sheetRegistry';

/**
 * Правка заданий сформированного листа: текст условия и ответа, перегенерация
 * отдельного задания, удаление позиции, своё задание руками.
 *
 * Правки идут в снимок (tasksData) — настройки генератора при этом не трогаются,
 * поэтому «Сформировать» заново их не сохранит, а «Сохранить лист» сохранит.
 *
 * Порядок заданий (useSheetLayout) переносится на новый снимок: без этого
 * любая правка сбрасывала бы расстановку и черту, ведь layout пересчитывается
 * на каждый новый tasksData.
 */
export function useSheetTaskEditing({
  generator,
  settings,
  tasksData,
  setTasksData,
  order,
}) {
  const commit = useCallback((next) => {
    setTasksData(next);
    order?.apply?.(next, order.layout);
    return next;
  }, [setTasksData, order]);

  // Правка полей одного задания одного варианта
  const patch = useCallback((variantIdx, taskIdx, fields) => {
    commit(patchTask(tasksData, variantIdx, taskIdx, fields));
  }, [commit, tasksData]);

  // Заново одно задание. Категорию берём у заменяемого — новое задание должно
  // остаться того же типа, иначе позиция перестанет совпадать с другими вариантами.
  const regenerate = useCallback((variantIdx, taskIdx) => {
    const current = tasksData?.[variantIdx]?.[taskIdx];
    const fresh = regenerateOneTask(generator, settings, current?.cat);
    if (!fresh) return false;
    commit(replaceTask(tasksData, variantIdx, taskIdx, fresh));
    return true;
  }, [commit, tasksData, generator, settings]);

  // Заново эту позицию во всех вариантах
  const regenerateAll = useCallback((taskIdx) => {
    if (!Array.isArray(tasksData)) return false;
    const cat = tasksData[0]?.[taskIdx]?.cat;
    let next = tasksData;
    let ok = false;
    for (let vi = 0; vi < tasksData.length; vi++) {
      const fresh = regenerateOneTask(generator, settings, cat);
      if (!fresh) continue;
      next = replaceTask(next, vi, taskIdx, fresh);
      ok = true;
    }
    if (ok) commit(next);
    return ok;
  }, [commit, tasksData, generator, settings]);

  // Порядок пересчитываем ЗДЕСЬ и отдаём готовым: commit применяет layout сам,
  // поэтому отдельный order.removeTask срезал бы позицию второй раз.
  const remove = useCallback((taskIdx) => {
    const next = removeTaskEverywhere(tasksData, taskIdx);
    setTasksData(next);
    order?.apply?.(next, layoutWithoutTask(order?.layout, taskIdx));
  }, [setTasksData, tasksData, order]);

  // Своё задание — одинаковое во всех вариантах (общий вопрос листа)
  const append = useCallback((task) => {
    commit(appendTaskEverywhere(tasksData, { ...task, cat: 'manual' }));
  }, [commit, tasksData]);

  return { patch, regenerate, regenerateAll, remove, append };
}

export default useSheetTaskEditing;
