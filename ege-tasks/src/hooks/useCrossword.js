import { useState, useCallback, useMemo, useEffect } from 'react';
import { generateCrossword } from '../utils/crosswordLayout';

const STORAGE_KEY = 'crossword_generator_state_v1';

export const THEMES = {
  ocean: {
    name: 'Океан',
    symbol: '🐠',
    bg: 'linear-gradient(160deg, #0077b6 0%, #00b4d8 55%, #90e0ef 100%)',
    cellBorder: '#005f8a',
    cellBg: 'rgba(255,255,255,0.92)',
    numColor: '#005f8a',
    titleColor: '#ffffff',
    nameColor: 'rgba(255,255,255,0.9)',
    frameColor: 'rgba(255,255,255,0.5)',
    decorSymbols: ['🐠','🐙','🌊','🐚','🦀','🐡','⭐','🐳','🦈','🐬'],
  },
  space: {
    name: 'Космос',
    symbol: '🚀',
    bg: 'linear-gradient(160deg, #10002b 0%, #3c096c 50%, #7b2fff 100%)',
    cellBorder: '#c77dff',
    cellBg: 'rgba(255,255,255,0.93)',
    numColor: '#6a0dad',
    titleColor: '#e0aaff',
    nameColor: 'rgba(224,170,255,0.85)',
    frameColor: 'rgba(199,125,255,0.45)',
    decorSymbols: ['⭐','🌟','✨','💫','🚀','🪐','🌙','☄️','🌌','👾'],
  },
  rainbow: {
    name: 'Радуга',
    symbol: '🌈',
    bg: 'linear-gradient(135deg, #ff595e 0%, #ffca3a 25%, #8ac926 50%, #1982c4 75%, #6a4c93 100%)',
    cellBorder: '#6a4c93',
    cellBg: 'rgba(255,255,255,0.93)',
    numColor: '#6a4c93',
    titleColor: '#ffffff',
    nameColor: 'rgba(255,255,255,0.9)',
    frameColor: 'rgba(255,255,255,0.55)',
    decorSymbols: ['🌈','⭐','🎉','🎈','🌟','💝','🦋','🎀','🎊','💎'],
  },
  jungle: {
    name: 'Джунгли',
    symbol: '🦁',
    bg: 'linear-gradient(160deg, #1b4332 0%, #2d6a4f 50%, #74c69d 100%)',
    cellBorder: '#1b4332',
    cellBg: 'rgba(255,255,255,0.92)',
    numColor: '#1b4332',
    titleColor: '#d8f3dc',
    nameColor: 'rgba(216,243,220,0.85)',
    frameColor: 'rgba(216,243,220,0.4)',
    decorSymbols: ['🦁','🐘','🦒','🌿','🌺','🦜','🐍','🌴','🐆','🦓'],
  },
  candy: {
    name: 'Конфеты',
    symbol: '🍭',
    bg: 'linear-gradient(135deg, #ff006e 0%, #fb5607 30%, #ffbe0b 60%, #8338ec 100%)',
    cellBorder: '#c9006a',
    cellBg: 'rgba(255,255,255,0.93)',
    numColor: '#c9006a',
    titleColor: '#ffffff',
    nameColor: 'rgba(255,255,255,0.9)',
    frameColor: 'rgba(255,255,255,0.55)',
    decorSymbols: ['🍭','🍬','🍫','🍰','🎂','🍩','🍪','🧁','🍦','🎠'],
  },
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

  const [words, setWords]   = useState(saved?.words ?? []);
  const [theme, setTheme]   = useState(saved?.theme ?? 'ocean');
  const [title, setTitle]   = useState(saved?.title ?? 'Кроссворд');
  const [showAnswers, setShowAnswers] = useState(false);

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
    setTitle('Кроссворд');
  }, []);

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
