import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../shared/services/pocketbase';
import { sheetKind } from '../utils/sheetRegistry';

/**
 * Сохранение и загрузка листов генераторов (коллекция `generator_sheets`).
 *
 * Лист сохраняется снимком: настройки + все варианты заданий + порядок заданий.
 * Перегенерация по одним настройкам дала бы другие числа (генераторы не seeded),
 * а ручные правки заданий вообще нигде больше не живут — поэтому храним данные,
 * а не рецепт.
 *
 * Лист открывается ссылкой `?sheet=<id>` (из «Моих работ» или закладки): хук
 * сам подхватывает параметр и зовёт onLoad генератора.
 *
 * @param {object}   opts
 * @param {string}   opts.generator  тип генератора (ключ sheetRegistry)
 * @param {string}   opts.title      текущее название листа
 * @param {object}   opts.settings   текущие настройки генератора
 * @param {*}        opts.tasksData  текущий снимок заданий (null = не сформирован)
 * @param {Array}    opts.layout     порядок заданий и черты (useSheetLayout)
 * @param {Function} opts.onLoad     применить загруженный лист в генераторе
 */
export function useSheetStorage({
  generator,
  title,
  settings,
  tasksData,
  layout,
  onLoad,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sheetId, setSheetId] = useState(null);
  const [sheetTitle, setSheetTitle] = useState('');   // под каким именем сохранён
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  // onLoad пересоздаётся на каждый рендер генератора — держим в ref,
  // иначе эффект автозагрузки крутился бы в цикле.
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  const buildPayload = useCallback((overrides = {}) => {
    const flat = sheetKind(generator) === 'flat';
    const variantsCount = Array.isArray(tasksData) ? tasksData.length : 0;
    const questionsCount = flat
      ? (tasksData?.[0]?.length ?? 0)
      : (tasksData?.[0]?.sections?.reduce((s, sec) => s + (sec.tasks?.length || 0), 0) ?? 0);

    return {
      generator,
      kind: sheetKind(generator),
      title: (overrides.title ?? title ?? '').trim() || 'Лист без названия',
      settings: settings ?? {},
      layout: layout ?? [],
      tasks_data: tasksData ?? null,
      variants_count: variantsCount,
      questions_count: questionsCount,
      folder: overrides.folder ?? '',
      note: overrides.note ?? '',
      class_number: overrides.classNumber ?? 0,
      is_pinned: overrides.isPinned ?? false,
    };
  }, [generator, title, settings, layout, tasksData]);

  const loadList = useCallback(async (options = {}) => {
    setListLoading(true);
    try {
      // По умолчанию показываем листы этого же генератора: чужой лист
      // в этот генератор всё равно не загрузится.
      const items = await api.getGeneratorSheets({
        generator: options.allGenerators ? null : generator,
        search: options.search || '',
      });
      setList(items);
      return items;
    } finally {
      setListLoading(false);
    }
  }, [generator]);

  const openList = useCallback(() => {
    setListOpen(true);
    loadList();
  }, [loadList]);

  // Применить запись к генератору. Сам генератор решает, как разложить
  // settings/tasksData по своему состоянию (см. applySheet в его хуке).
  const applyRecord = useCallback((record) => {
    setSheetId(record.id);
    setSheetTitle(record.title || '');
    onLoadRef.current?.({
      title: record.title || '',
      settings: record.settings || {},
      tasksData: record.tasks_data ?? null,
      layout: Array.isArray(record.layout) ? record.layout : [],
      record,
    });
  }, []);

  const loadSheet = useCallback(async (id) => {
    const record = await api.getGeneratorSheet(id);
    if (record.generator !== generator) {
      // Лист другого генератора открывать здесь нечем — зовущая сторона
      // должна была увести на его страницу.
      throw new Error('Лист сделан другим генератором');
    }
    applyRecord(record);
    setListOpen(false);
    return record;
  }, [generator, applyRecord]);

  const save = useCallback(async (overrides = {}) => {
    setSaving(true);
    try {
      const payload = buildPayload(overrides);
      if (sheetId && !overrides.asNew) {
        // Папку/заметку не затираем пустыми значениями при обычном «Обновить»
        const patch = { ...payload };
        if (!('folder' in overrides))      delete patch.folder;
        if (!('note' in overrides))        delete patch.note;
        if (!('classNumber' in overrides)) delete patch.class_number;
        if (!('isPinned' in overrides))    delete patch.is_pinned;
        const rec = await api.updateGeneratorSheet(sheetId, patch);
        setSheetTitle(rec.title || '');
        return rec;
      }
      const rec = await api.createGeneratorSheet(payload);
      setSheetId(rec.id);
      setSheetTitle(rec.title || '');
      return rec;
    } finally {
      setSaving(false);
    }
  }, [buildPayload, sheetId]);

  const saveAsNew = useCallback(
    (overrides = {}) => save({ ...overrides, asNew: true }),
    [save],
  );

  const deleteSheet = useCallback(async (id) => {
    await api.deleteGeneratorSheet(id);
    setList((prev) => prev.filter((s) => s.id !== id));
    if (id === sheetId) {
      setSheetId(null);
      setSheetTitle('');
    }
  }, [sheetId]);

  // «Отвязаться» от записи: следующее сохранение создаст новый лист.
  // Нужно после «Сформировать» заново — это уже другой набор заданий.
  const detach = useCallback(() => {
    setSheetId(null);
    setSheetTitle('');
  }, []);

  // Открытие по ссылке ?sheet=<id>
  const requestedId = searchParams.get('sheet');
  const handledRef = useRef(null);
  useEffect(() => {
    if (!requestedId || handledRef.current === requestedId) return;
    handledRef.current = requestedId;

    let alive = true;
    api.getGeneratorSheet(requestedId)
      .then((record) => {
        if (!alive) return;
        if (record.generator !== generator) return;
        applyRecord(record);
      })
      .catch((error) => console.error('Не удалось открыть лист:', error))
      .finally(() => {
        if (!alive) return;
        // Параметр отработал — убираем из адреса, чтобы «Сформировать»
        // заново не выглядело как повторное открытие сохранённого листа.
        const next = new URLSearchParams(searchParams);
        next.delete('sheet');
        setSearchParams(next, { replace: true });
      });

    return () => { alive = false; };
  }, [requestedId, generator, applyRecord, searchParams, setSearchParams]);

  return {
    sheetId,
    sheetTitle,
    saving,
    list,
    listLoading,
    listOpen,
    setListOpen,
    openList,
    loadList,
    loadSheet,
    save,
    saveAsNew,
    deleteSheet,
    detach,
  };
}

export default useSheetStorage;
