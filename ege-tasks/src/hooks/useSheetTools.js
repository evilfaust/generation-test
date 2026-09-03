import { useCallback, useState } from 'react';
import { useSheetStorage } from './useSheetStorage';
import { useSheetTaskEditing } from './useSheetTaskEditing';

/**
 * Всё, что генератор умеет делать с готовым листом: сохранить, загрузить
 * и поправить отдельные задания.
 *
 * Объединяет хранение (`generator_sheets`) и правку снимка, чтобы подключение
 * к генератору было одной строкой — вместо трёх хуков и состояния модалок.
 *
 * @param {string}   generator  тип генератора (ключ sheetRegistry)
 * @param {object}   hook       результат хука генератора: title/settings/
 *                              tasksData/setTasksData/applySheet
 * @param {object}   order      результат useSheetLayout (у кого он есть)
 */
export function useSheetTools({ generator, hook, order }) {
  const {
    title, settings, tasksData, setTasksData, applySheet,
  } = hook;

  const [editIndex, setEditIndex] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  // Загруженный лист приносит и порядок заданий — применяем их вместе,
  // иначе порядок сбросится на естественный (см. useSheetLayout).
  const handleLoad = useCallback((sheet) => {
    applySheet(sheet);
    order?.apply?.(sheet.tasksData, sheet.layout);
  }, [applySheet, order]);

  const storage = useSheetStorage({
    generator,
    title,
    settings,
    tasksData,
    layout: order?.layout,
    onLoad: handleLoad,
  });

  const editing = useSheetTaskEditing({
    generator, settings, tasksData, setTasksData, order,
  });

  const openTask = useCallback((idx) => setEditIndex(idx), []);
  const closeTask = useCallback(() => setEditIndex(null), []);

  return {
    generator,
    settings,
    tasksData,
    storage,
    editing,
    editIndex,
    openTask,
    closeTask,
    addOpen,
    openAdd: () => setAddOpen(true),
    closeAdd: () => setAddOpen(false),
  };
}

export default useSheetTools;
