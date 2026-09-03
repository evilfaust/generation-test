import { useState, useEffect, useCallback } from 'react';

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

export function useSheetLayout(tasksData) {
  const [layout, setLayout] = useState([]);

  // Новая генерация — новый естественный порядок
  useEffect(() => {
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

  return { layout, move, addDivider, removeAt, reset };
}

export default useSheetLayout;
