import { useMemo, forwardRef } from 'react';
import CrosswordGrid from './CrosswordGrid';
import { THEMES } from '../../hooks/useCrossword';

const PAGE_W   = 794;
const PAGE_H   = 1123;
const PAGE_PAD = 34;
const GRID_TOP = 112;
const GRID_MAX_W = PAGE_W - PAGE_PAD * 2;
const GRID_MAX_H = 555;
const CLUES_TOP = 710;
const CLUES_H = PAGE_H - CLUES_TOP - PAGE_PAD;

function makeRng(seed) {
  let s = Math.abs(seed | 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function strHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return h;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function buildImageInstances(words) {
  const instances = [];
  for (const w of words) {
    if (!w.imageDataUrl) continue;
    for (let i = 0; i < (w.number || 1); i++) {
      instances.push({ src: w.imageDataUrl, wordId: w.id, i });
    }
  }
  return instances;
}

function shuffleWithRng(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCellSize(layout) {
  if (!layout) return 28;
  const byW = Math.floor(GRID_MAX_W / Math.max(layout.width, 1));
  const byH = Math.floor(GRID_MAX_H / Math.max(layout.height, 1));
  return clamp(Math.min(byW, byH), 18, 34);
}

function getClueLayout(count) {
  if (count <= 0) return { cols: 1, tile: 58, gap: 10 };
  const cols = clamp(Math.ceil(Math.sqrt(count * 1.9)), 4, 10);
  const gap = count > 56 ? 6 : 8;
  const tileByW = Math.floor((GRID_MAX_W - gap * (cols - 1)) / cols);
  const rows = Math.ceil(count / cols);
  const tileByH = Math.floor((CLUES_H - 42 - gap * Math.max(rows - 1, 0)) / Math.max(rows, 1));
  return { cols, gap, tile: clamp(Math.min(tileByW, tileByH), 30, 58) };
}

const CrosswordPrintLayout = forwardRef(function CrosswordPrintLayout(
  { words, layout, theme, title, showAnswers, className = '' },
  ref
) {
  const t = THEMES[theme] ?? THEMES.ocean;

  const cellSize = getCellSize(layout);
  const cwW = layout ? layout.width  * cellSize : 0;
  const cwH = layout ? layout.height * cellSize : 0;
  const cwLeft = (PAGE_W - cwW) / 2;
  const cwTop  = GRID_TOP + (GRID_MAX_H - cwH) / 2;

  const seed = strHash((words.map(w => w.text).join('') || '') + title + theme);

  const instances = useMemo(() => buildImageInstances(words), [words]);
  const clueLayout = useMemo(() => getClueLayout(instances.length), [instances.length]);
  const shuffledInstances = useMemo(() => shuffleWithRng(instances, makeRng(seed + 2)), [instances, seed]);

  return (
    <div
      ref={ref}
      className={`cw-sheet ${className}`}
      style={{
        width: PAGE_W,
        height: PAGE_H,
        position: 'relative',
        overflow: 'hidden',
        background: '#ffffff',
        boxSizing: 'border-box',
        fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div className="cw-sheet-header">
        <div>
          <div className="cw-sheet-kicker">Lemma · кроссворд по картинкам</div>
          <div className="cw-sheet-title">{title || 'Кроссворд'}</div>
        </div>
        <div className="cw-sheet-fields">
          <span>Имя: ________________________________</span>
          <span>Класс: __________ Дата: __________</span>
        </div>
      </div>

      <div className="cw-sheet-rule" />

      <div className="cw-sheet-instruction">
        Сосчитай одинаковые картинки. Число таких картинок подсказывает номер слова в сетке.
      </div>

      <div className="cw-grid-zone">
        <div className="cw-grid-paper" style={{ borderColor: t.cellBorder }}>
          {layout && (
            <div style={{ position: 'absolute', left: cwLeft - PAGE_PAD, top: cwTop - GRID_TOP }}>
              <CrosswordGrid
                layout={layout}
                showAnswers={showAnswers}
                cellSize={cellSize}
                cellBorder="#111827"
                cellBg="#ffffff"
                numColor="#111827"
              />
            </div>
          )}
          {!layout && (
            <div className="cw-empty-print">
              Добавьте слова, чтобы увидеть кроссворд
            </div>
          )}
        </div>
      </div>

      <div className="cw-clue-zone">
        <div className="cw-clue-zone-head">
          <span>Картинки-подсказки</span>
          <span>{showAnswers ? 'Лист с ответами' : 'Лист ученика'}</span>
        </div>
        <div
          className="cw-clue-grid"
          style={{
            gridTemplateColumns: `repeat(${clueLayout.cols}, ${clueLayout.tile}px)`,
            gap: clueLayout.gap,
          }}
        >
          {shuffledInstances.map((inst, idx) => (
            <div
              className="cw-clue-tile"
              key={`${inst.wordId}-${inst.i}`}
              style={{ width: clueLayout.tile, height: clueLayout.tile }}
            >
              <img src={inst.src} alt="" />
            </div>
          ))}
          {shuffledInstances.length === 0 && (
            <div className="cw-clue-empty">Загрузите картинки к словам</div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CrosswordPrintLayout;
