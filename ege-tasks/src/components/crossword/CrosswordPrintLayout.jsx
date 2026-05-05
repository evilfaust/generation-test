import { useMemo, forwardRef } from 'react';
import CrosswordGrid from './CrosswordGrid';
import { THEMES } from '../../hooks/useCrossword';

const PAGE_W   = 794;
const PAGE_H   = 1123;
const IMG_SIZE = 82;
const CELL_SIZE = 26;
const HEADER_H  = 72;
const FRAME_PAD = 14;   // inner padding from frame border
const BORDER_W  = 10;   // frame border thickness

// Safe image area (keep images inside the frame)
const SAFE_X1 = FRAME_PAD + BORDER_W;
const SAFE_X2 = PAGE_W - FRAME_PAD - BORDER_W - IMG_SIZE;
const SAFE_Y1 = HEADER_H + 4;
const SAFE_Y2 = PAGE_H - FRAME_PAD - BORDER_W - IMG_SIZE;

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

function computeImagePositions(cwW, cwH, rng) {
  const cwLeft = (PAGE_W - cwW) / 2;
  const cwTop  = HEADER_H + (PAGE_H - HEADER_H - cwH) / 2;
  const CW_PAD = 12;

  const STEP = IMG_SIZE + 4;
  const cols = Math.ceil(PAGE_W / STEP);
  const rows = Math.ceil(PAGE_H / STEP);
  const positions = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = (rng() - 0.5) * 20;
      const jy = (rng() - 0.5) * 20;
      const rawX = c * STEP + jx;
      const rawY = r * STEP + jy;
      const x = clamp(rawX, SAFE_X1, SAFE_X2);
      const y = clamp(rawY, SAFE_Y1, SAFE_Y2);

      // Skip if it would cover the crossword grid
      if (
        x + IMG_SIZE > cwLeft - CW_PAD &&
        x            < cwLeft + cwW + CW_PAD &&
        y + IMG_SIZE > cwTop  - CW_PAD &&
        y            < cwTop  + cwH + CW_PAD
      ) continue;

      const rotation = (rng() - 0.5) * 28;
      positions.push({ x, y, rotation });
    }
  }

  return shuffleWithRng(positions, rng);
}

function buildDecorPositions(symbols, rng) {
  const COUNT = 32;
  const result = [];
  for (let i = 0; i < COUNT; i++) {
    // Distribute across the whole page edge region
    const edge = rng();
    let x, y;
    if (edge < 0.25)      { x = rng() * PAGE_W;        y = FRAME_PAD + rng() * 40; }
    else if (edge < 0.5)  { x = rng() * PAGE_W;        y = PAGE_H - FRAME_PAD - 40 + rng() * 40; }
    else if (edge < 0.75) { x = FRAME_PAD + rng() * 40; y = rng() * PAGE_H; }
    else                   { x = PAGE_W - FRAME_PAD - 40 + rng() * 40; y = rng() * PAGE_H; }
    const sym = symbols[Math.floor(rng() * symbols.length)];
    result.push({ x, y, size: 13 + rng() * 12, sym });
  }
  return result;
}

const CrosswordPrintLayout = forwardRef(function CrosswordPrintLayout(
  { words, layout, theme, title, showAnswers, className = '' },
  ref
) {
  const t = THEMES[theme] ?? THEMES.ocean;

  const cwW = layout ? layout.width  * CELL_SIZE : 0;
  const cwH = layout ? layout.height * CELL_SIZE : 0;
  const cwLeft = (PAGE_W - cwW) / 2;
  const cwTop  = HEADER_H + (PAGE_H - HEADER_H - cwH) / 2;

  const seed = strHash((words.map(w => w.text).join('') || '') + title + theme);

  const instances = useMemo(() => buildImageInstances(words), [words]);
  const positions = useMemo(() => computeImagePositions(cwW, cwH, makeRng(seed)), [cwW, cwH, seed]);
  const decorPos  = useMemo(() => buildDecorPositions(t.decorSymbols, makeRng(seed + 1)), [t.decorSymbols, seed]);
  const shuffledInstances = useMemo(() => shuffleWithRng(instances, makeRng(seed + 2)), [instances, seed]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: PAGE_W,
        height: PAGE_H,
        position: 'relative',
        overflow: 'hidden',
        background: t.bg,
        boxSizing: 'border-box',
        fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
      }}
    >
      {/* Outer frame */}
      <div style={{
        position: 'absolute',
        inset: 8,
        border: `${BORDER_W}px solid ${t.frameColor}`,
        borderRadius: 16,
        pointerEvents: 'none',
        zIndex: 30,
        boxSizing: 'border-box',
      }} />

      {/* Edge decorative symbols */}
      {decorPos.map((d, i) => (
        <span key={i} style={{
          position: 'absolute',
          left: d.x,
          top: d.y,
          fontSize: d.size,
          opacity: 0.55,
          userSelect: 'none',
          pointerEvents: 'none',
          lineHeight: 1,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
        }}>
          {d.sym}
        </span>
      ))}

      {/* Scattered word images */}
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
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
            }}
          />
        );
      })}

      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 0,
        width: PAGE_W,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        boxSizing: 'border-box',
        zIndex: 20,
      }}>
        <div style={{
          fontSize: 28,
          fontWeight: 900,
          color: t.titleColor,
          letterSpacing: 3,
          textTransform: 'uppercase',
          textShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {t.symbol} {title || 'Crossword'}
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 12,
          color: t.nameColor,
          textShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}>
          <span>Name: ________________________________</span>
          <span>Class: _____________ Date: __________</span>
        </div>
      </div>

      {/* Crossword — floating directly on background, no white panel */}
      {layout && (
        <div style={{
          position: 'absolute',
          left: cwLeft,
          top: cwTop,
          zIndex: 15,
        }}>
          <CrosswordGrid
            layout={layout}
            showAnswers={showAnswers}
            cellSize={CELL_SIZE}
            cellBorder={t.cellBorder}
            cellBg={t.cellBg}
            numColor={t.numColor}
          />
        </div>
      )}

      {!layout && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: 16,
          fontWeight: 600,
          textAlign: 'center',
          zIndex: 15,
          textShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}>
          Добавьте слова, чтобы<br />увидеть кроссворд
        </div>
      )}
    </div>
  );
});

export default CrosswordPrintLayout;
