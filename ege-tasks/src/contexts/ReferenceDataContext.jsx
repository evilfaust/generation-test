import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { App } from 'antd';
import { api } from '../services/pocketbase';

const ReferenceDataContext = createContext(null);

const CACHE_KEY = 'ege_ref_data_v3';
const CACHE_TTL = 5 * 60 * 1000; // 5 минут — дольше кэш не показываем
// Снимок каталога — это ~25 тыс. задач, полсотни запросов подряд. Если кэш
// совсем свежий (открыли соседнюю вкладку, перезагрузили страницу), фоновое
// обновление только занимает канал и тормозит то, что делает учитель.
const REFRESH_AFTER = 2 * 60 * 1000;

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    const age = Date.now() - timestamp;
    if (age > CACHE_TTL) return null;
    return { data, age };
  } catch {
    return null;
  }
}

function saveToCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

async function fetchAllData() {
  const [topicsData, tagsData, subtopicsData, theoryCatsData, snapshotData, answerCnt, solutionCnt] = await Promise.all([
    api.getTopics(),
    api.getTags(),
    api.getSubtopics(),
    api.getTheoryCategories(),
    api.getTasksStatsSnapshot(),
    api.getWithAnswerCount(),
    api.getWithSolutionCount(),
  ]);
  return {
    topics: topicsData,
    tags: tagsData,
    subtopics: subtopicsData,
    theoryCategories: theoryCatsData,
    tasksSnapshot: snapshotData,
    withAnswerCount: answerCnt,
    withSolutionCount: solutionCnt,
  };
}

function applyData(data, setters) {
  setters.setTopics(data.topics);
  setters.setTags(data.tags);
  setters.setSubtopics(data.subtopics);
  setters.setTheoryCategories(data.theoryCategories);
  setters.setTasksSnapshot(data.tasksSnapshot);
  setters.setWithAnswerCount(data.withAnswerCount);
  setters.setWithSolutionCount(data.withSolutionCount);
}

export function ReferenceDataProvider({ children }) {
  const { message } = App.useApp();
  const [topics, setTopics] = useState([]);
  const [tags, setTags] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [theoryCategories, setTheoryCategories] = useState([]);
  const [tasksSnapshot, setTasksSnapshot] = useState([]);
  const [withAnswerCount, setWithAnswerCount] = useState(0);
  const [withSolutionCount, setWithSolutionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const setters = { setTopics, setTags, setSubtopics, setTheoryCategories, setTasksSnapshot, setWithAnswerCount, setWithSolutionCount };

  // Извлекаем years и sources из snapshot (вместо двух отдельных getFullList)
  const years = useMemo(() => {
    return [...new Set(tasksSnapshot.map(r => r.year).filter(Boolean))].sort((a, b) => b - a);
  }, [tasksSnapshot]);

  const sources = useMemo(() => {
    return [...new Set(tasksSnapshot.map(r => r.source).filter(Boolean))].sort();
  }, [tasksSnapshot]);

  // Темы ЕГЭ базового уровня, отсортированные по номеру задания
  const egeBaseTopics = useMemo(() => {
    return topics
      .filter(t => t.exam_type === 'ege_base')
      .sort((a, b) => a.ege_number - b.ege_number);
  }, [topics]);

  // Темы ЕГЭ профильного уровня (часть 1 → часть 2, по ege_number)
  const egeProfileTopics = useMemo(() => {
    return topics
      .filter(t => t.exam_type === 'ege_profile')
      .sort((a, b) => (a.exam_part || 0) - (b.exam_part || 0) || a.ege_number - b.ege_number);
  }, [topics]);

  // Темы ОГЭ (9 класс), отсортированы по номеру задания
  const ogeTopics = useMemo(() => {
    return topics
      .filter(t => t.exam_type === 'oge')
      .sort((a, b) => (a.ege_number || 0) - (b.ege_number || 0));
  }, [topics]);

  // Темы тригонометрических генераторов
  const trigTopics = useMemo(() => {
    return topics
      .filter(t => t.exam_type === 'trig')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [topics]);

  // Явная перезагрузка (кнопка «Обновить» или после мутаций) — всегда идёт в сеть
  const reloadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllData();
      applyData(data, setters);
      saveToCache(data);
    } catch (error) {
      console.error('Error loading reference data:', error);
      message.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  }, [message]); // eslint-disable-line react-hooks/exhaustive-deps

  // Перезагрузить только snapshot (для кнопок «Обновить» в Stats/Catalog)
  const reloadSnapshot = useCallback(async () => {
    try {
      const [snapshotData, answerCnt, solutionCnt] = await Promise.all([
        api.getTasksStatsSnapshot(),
        api.getWithAnswerCount(),
        api.getWithSolutionCount(),
      ]);
      setTasksSnapshot(snapshotData);
      setWithAnswerCount(answerCnt);
      setWithSolutionCount(solutionCnt);
      // Обновляем кэш частично
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          cached.data.tasksSnapshot = snapshotData;
          cached.data.withAnswerCount = answerCnt;
          cached.data.withSolutionCount = solutionCnt;
          cached.timestamp = Date.now();
          localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
        }
      } catch {}
    } catch (error) {
      console.error('Error reloading snapshot:', error);
      message.error('Ошибка при обновлении статистики');
    }
  }, [message]);

  // При монтировании: stale-while-revalidate
  // 1. Если кэш свежий → рендерим сразу, обновляем в фоне без loading
  // 2. Если кэш устарел/отсутствует → показываем loading, грузим данные
  useEffect(() => {
    const cached = loadFromCache();
    if (cached) {
      // Мгновенно показываем кэшированные данные
      applyData(cached.data, setters);
      setLoading(false);
      // Тихое фоновое обновление — только если кэш уже подостыл
      if (cached.age > REFRESH_AFTER) {
        fetchAllData()
          .then(data => {
            applyData(data, setters);
            saveToCache(data);
          })
          .catch(err => console.warn('Background refresh failed:', err));
      }
    } else {
      // Нет кэша — грузим с индикатором
      setLoading(true);
      fetchAllData()
        .then(data => {
          applyData(data, setters);
          saveToCache(data);
        })
        .catch(error => {
          console.error('Error loading reference data:', error);
          message.error('Ошибка при загрузке данных');
        })
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ReferenceDataContext.Provider value={{
      topics,
      egeBaseTopics,
      egeProfileTopics,
      ogeTopics,
      trigTopics,
      tags,
      years,
      sources,
      subtopics,
      theoryCategories,
      tasksSnapshot,
      withAnswerCount,
      withSolutionCount,
      loading,
      reloadData,
      reloadSnapshot,
    }}>
      {children}
    </ReferenceDataContext.Provider>
  );
}

export function useReferenceData() {
  const ctx = useContext(ReferenceDataContext);
  if (!ctx) {
    throw new Error('useReferenceData must be used within a ReferenceDataProvider');
  }
  return ctx;
}
