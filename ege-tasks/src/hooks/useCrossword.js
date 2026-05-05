import { useState, useCallback, useMemo, useEffect } from 'react';
import { generateCrossword } from '../utils/crosswordLayout';

const STORAGE_KEY = 'crossword_generator_state_v1';

export const THEMES = {
  winter:   { name: 'Зима',     bg: '#e8f4fd', border: '#5b9bd5', symbol: '❄' },
  spring:   { name: 'Весна',    bg: '#f0fce8', border: '#5cb85c', symbol: '🌸' },
  ocean:    { name: 'Океан',    bg: '#e0f7fa', border: '#0097a7', symbol: '🌊' },
  space:    { name: 'Космос',   bg: '#eef0ff', border: '#5c6bc0', symbol: '⭐' },
  rainbow:  { name: 'Радуга',   bg: '#fff9e0', border: '#ff9800', symbol: '🌈' },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function useCrossword() {
  const saved = useMemo(() => loadState(), []);

  const [words, setWords] = useState(saved?.words ?? []);
  const [theme, setTheme] = useState(saved?.theme ?? 'winter');
  const [title, setTitle] = useState(saved?.title ?? 'Crossword');
  const [showAnswers, setShowAnswers] = useState(false);

  // Persist to localStorage whenever relevant state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ words, theme, title }));
    } catch {}
  }, [words, theme, title]);

  const layout = useMemo(() => {
    const valid = words.filter(w => w.text && w.text.trim().length >= 2);
    if (valid.length === 0) return null;
    return generateCrossword(valid.map(w => ({ text: w.text.trim(), number: w.number })));
  }, [words]);

  const addWord = useCallback(() => {
    const maxNum = words.reduce((m, w) => Math.max(m, w.number ?? 0), 0);
    setWords(prev => [
      ...prev,
      { id: genId(), text: '', imageDataUrl: null, number: maxNum + 1 },
    ]);
  }, [words]);

  const updateWord = useCallback((id, changes) => {
    setWords(prev => prev.map(w => (w.id === id ? { ...w, ...changes } : w)));
  }, []);

  const removeWord = useCallback((id) => {
    setWords(prev => prev.filter(w => w.id !== id));
  }, []);

  const moveWord = useCallback((fromIdx, toIdx) => {
    setWords(prev => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setWords([]);
    setTitle('Crossword');
  }, []);

  // Unplaced words from the last layout run
  const unplacedWords = useMemo(() => {
    if (!layout) return [];
    return layout.placed.filter(p => p.unplaced).map(p => p.text);
  }, [layout]);

  return {
    words, theme, title, showAnswers, layout, unplacedWords,
    setTheme, setTitle, setShowAnswers,
    addWord, updateWord, removeWord, moveWord, clearAll,
  };
}
