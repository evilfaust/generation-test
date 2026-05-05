import { useMemo, forwardRef } from 'react';
import CrosswordGrid from './CrosswordGrid';
import { THEMES } from '../../hooks/useCrossword';

// A4 at 96 dpi
const PAGE_W = 794;
const PAGE_H = 1123;
const IMG_SIZE = 66;
const CELL_SIZE = 24;

// Simple seeded RNG (LCG)
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

function computeImagePositions(cwW, cwH, rng) {
  const HEADER_H = 60;
  const cwLeft  = (PAGE_W - cwW) / 2;
  const cwTop   = HEADER_H + (PAGE_H - HEADER_H - cwH) / 2;
  const PAD = 10;

  const positions = [];
  const cols = Math.floor(PAGE_W / IMG_SIZE);
  const rows = Math.floor(PAGE_H / IMG_SIZE);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = (rng() - 0.5) * (IMG_SIZE * 0.3);
      const jy = (rng() - 0.5) * (IMG_SIZE * 0.3);
      const x = c * IMG_SIZE + IMG_SIZE / 2 - IMG_SIZE / 2 + jx;
      const y = r * IMG_SIZE + IMG_SIZE / 2 - IMG_SIZE / 2 + jy;

      // Skip cells that would obscure the crossword center (with padding)
      if (
        x + IMG_SIZE > cwLeft - PAD &&
        x < cwLeft + cwW + PAD &&
        y + IMG_SIZE > cwTop - PAD &&
        y < cwTop + cwH + PAD
      ) continue;

      const rotation = (rng() - 0.5) * 24;
      positions.push({ x, y, rotation });
    }
  }

  // Shuffle positions so images are distributed evenly, not row by row
  return shuffleWithRng(positions, rng);
}

// Decorative symbols scattered around border
const DECOR_COUNT = 28;
function buildDecorPositions(rng) {
  const positions = [];
  for (let i = 0; i < DECOR_COUNT; i++) {
    const side = Math.floor(rng() * 4);
    let x, y;
    if (side === 0) { x = rng() * PAGE_W; y = rng() * 40; }
    else if (side === 1) { x = rng() * PAGE_W; y = PAGE_H - rng() * 40; }
    else if (side === 2) { x = rng() * 40; y = rng() * PAGE_H; }
    else { x = PAGE_W - rng() * 40; y = rng() * PAGE_H; }
    positions.push({ x, y, size: 10 + rng() * 10 });
  }
  return positions;
}

const CrosswordPrintLayout = forwardRef(function CrosswordPrintLayout(
  { words, layout, theme, title, showAnswers },
  ref
) {
  const themeObj = THEMES[theme] ?? THEMES.winter;

  const cwW = layout ? layout.width  * CELL_SIZE : 0;
  const cwH = layout ? layout.height * CELL_SIZE : 0;
  const HEADER_H = 60;
  const cwLeft = (PAGE_W - cwW) / 2;
  const cwTop  = HEADER_H + (PAGE_H - HEADER_H - cwH) / 2;

  const seed = strHash((words.map(w => w.text).join('') || '') + title);

  const instances = useMemo(() => buildImageInstances(words), [words]);
  const positions = useMemo(() => computeImagePositions(cwW, cwH, makeRng(seed)), [cwW, cwH, seed]);
  const decorPos  = useMemo(() => buildDecorPositions(makeRng(seed + 1)), [seed]);

  const shuffledInstances = useMemo(
    () => shuffleWithRng(instances, makeRng(seed + 2)),
    [instances, seed]
  );

  return (
    <div
      ref={ref}
      className="cw-print-root"
      style={{
        width: PAGE_W,
        height: PAGE_H,
        position: 'relative',
        overflow: 'hidden',
        background: themeObj.bg,
        boxSizing: 'border-box',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Border frame */}
      <div style={{
        position: 'absolute',
        inset: 6,
        border: `3px solid ${themeObj.border}`,
        borderRadius: 6,
        pointerEvents: 'none',
        zIndex: 10,
      }} />

      {/* Decorative theme symbols */}
      {decorPos.map((d, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: d.x,
            top: d.y,
            fontSize: d.size,
            opacity: 0.35,
            userSelect: 'none',
            pointerEvents: 'none',
            lineHeight: 1,
          }}
        >
          {themeObj.symbol}
        </span>
      ))}

      {/* Scattered images */}
      {shuffledInstances.map((inst, idx) => {
        if (idx >= positions.length) return null;
        const pos = positions[idx];
        return (
          <img
            key={`${inst.wordId}-${inst.i}`}
            src={inst.src}
            alt=""
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: IMG_SIZE,
              height: IMG_SIZE,
              objectFit: 'contain',
              transform: `rotate(${pos.rotation}deg)`,
              opacity: 0.9,
              imageRendering: 'auto',
            }}
          />
        );
      })}

      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 0,
        width: PAGE_W,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        boxSizing: 'border-box',
        zIndex: 20,
      }}>
        <div style={{
          fontSize: 22,
          fontWeight: 900,
          color: themeObj.border,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {title || 'Crossword'}
        </div>
        <div style={{
          fontSize: 13,
          color: '#444',
          display: 'flex',
          gap: 20,
        }}>
          <span>Name: ____________________</span>
          <span>Class: _______</span>
        </div>
      </div>

      {/* Crossword grid — centered, on top of images */}
      {layout && (
        <div
          style={{
            position: 'absolute',
            left: cwLeft,
            top: cwTop,
            background: 'rgba(255,255,255,0.92)',
            padding: 8,
            borderRadius: 4,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            zIndex: 15,
          }}
        >
          <CrosswordGrid
            layout={layout}
            showAnswers={showAnswers}
            cellSize={CELL_SIZE}
          />
        </div>
      )}

      {!layout && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          color: '#999',
          fontSize: 14,
          zIndex: 15,
        }}>
          Добавьте слова, чтобы увидеть кроссворд
        </div>
      )}
    </div>
  );
});

export default CrosswordPrintLayout;
