import { useCallback } from 'react';

/**
 * Загрузка сохранённого листа в состояние генератора.
 *
 * Общая для всех листовых генераторов: у каждого своё содержимое настроек, но
 * состояние устроено одинаково — название, объект настроек и снимок заданий.
 *
 * Настройки мержатся с дефолтами: лист мог быть сохранён версией генератора,
 * в которой ещё не было какого-то переключателя, и панель настроек упала бы
 * на неопределённом поле.
 */
export function useApplySheet({ setTitle, setSettings, setTasksData, defaults }) {
  return useCallback((sheet = {}) => {
    if (typeof sheet.title === 'string' && sheet.title) setTitle(sheet.title);
    setSettings({ ...defaults, ...(sheet.settings || {}) });
    setTasksData(sheet.tasksData ?? null);
  }, [setTitle, setSettings, setTasksData, defaults]);
}

export default useApplySheet;
