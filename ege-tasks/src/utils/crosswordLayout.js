const key = (r, c) => `${r},${c}`;

function getCell(grid, r, c) {
  return grid[key(r, c)] ?? null;
}

function canPlace(grid, wordText, row, col, dir) {
  const isH = dir === 'H';
  const dr = isH ? 0 : 1;
  const dc = isH ? 1 : 0;
  const n = wordText.length;

  // Cells immediately before/after must be empty
  if (getCell(grid, row - dr, col - dc)) return false;
  if (getCell(grid, row + dr * n, col + dc * n)) return false;

  let intersections = 0;

  for (let i = 0; i < n; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const cell = getCell(grid, r, c);

    if (cell) {
      if (cell.letter !== wordText[i]) return false;
      if (isH && cell.hWord != null) return false;
      if (!isH && cell.vWord != null) return false;
      intersections++;
    } else {
      // Perpendicular neighbors must be empty to prevent accidental word merging
      if (isH) {
        if (getCell(grid, r - 1, c) || getCell(grid, r + 1, c)) return false;
      } else {
        if (getCell(grid, r, c - 1) || getCell(grid, r, c + 1)) return false;
      }
    }
  }

  return intersections > 0;
}

function placeWord(grid, wordIdx, wordText, row, col, dir) {
  const isH = dir === 'H';
  const dr = isH ? 0 : 1;
  const dc = isH ? 1 : 0;
  for (let i = 0; i < wordText.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const k = key(r, c);
    if (!grid[k]) grid[k] = { letter: wordText[i], hWord: null, vWord: null };
    if (isH) grid[k].hWord = wordIdx;
    else grid[k].vWord = wordIdx;
  }
}

function getBoundsOfPlaced(placed) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const p of placed) {
    if (p.unplaced) continue;
    const endR = p.dir === 'V' ? p.row + p.text.length - 1 : p.row;
    const endC = p.dir === 'H' ? p.col + p.text.length - 1 : p.col;
    minR = Math.min(minR, p.row);
    maxR = Math.max(maxR, endR);
    minC = Math.min(minC, p.col);
    maxC = Math.max(maxC, endC);
  }
  return { minR, maxR, minC, maxC };
}

function scorePlacement(placed, wordLen, row, col, dir) {
  const { minR, maxR, minC, maxC } = getBoundsOfPlaced(placed);
  const endR = dir === 'V' ? row + wordLen - 1 : row;
  const endC = dir === 'H' ? col + wordLen - 1 : col;
  const newH = Math.max(maxR, endR) - Math.min(minR, row) + 1;
  const newW = Math.max(maxC, endC) - Math.min(minC, col) + 1;
  return -(newH * newW);
}

export function generateCrossword(words) {
  if (!words || words.length === 0) return null;

  const sanitized = words
    .map(w => ({ ...w, text: (w.text || '').toUpperCase().replace(/[^A-Z]/g, '') }))
    .filter(w => w.text.length >= 2)
    .sort((a, b) => b.text.length - a.text.length);

  if (sanitized.length === 0) return null;

  const grid = {};
  const placed = [];

  // Place first word horizontally at origin
  const first = sanitized[0];
  placeWord(grid, 0, first.text, 0, 0, 'H');
  placed.push({ text: first.text, number: first.number, row: 0, col: 0, dir: 'H' });

  for (let wi = 1; wi < sanitized.length; wi++) {
    const { text, number } = sanitized[wi];
    let best = null;
    let bestScore = -Infinity;

    for (const pw of placed) {
      if (pw.unplaced) continue;
      const perpDir = pw.dir === 'H' ? 'V' : 'H';

      for (let pci = 0; pci < pw.text.length; pci++) {
        for (let wci = 0; wci < text.length; wci++) {
          if (pw.text[pci] !== text[wci]) continue;

          let row, col;
          if (pw.dir === 'H') {
            col = pw.col + pci;
            row = pw.row - wci;
          } else {
            row = pw.row + pci;
            col = pw.col - wci;
          }

          if (canPlace(grid, text, row, col, perpDir)) {
            const score = scorePlacement(placed, text.length, row, col, perpDir);
            if (score > bestScore) {
              bestScore = score;
              best = { row, col, dir: perpDir };
            }
          }
        }
      }
    }

    if (best) {
      placeWord(grid, placed.length, text, best.row, best.col, best.dir);
      placed.push({ text, number, row: best.row, col: best.col, dir: best.dir });
    } else {
      placed.push({ text, number, unplaced: true });
    }
  }

  // Normalize coordinates to 0-based
  const { minR, maxR, minC, maxC } = getBoundsOfPlaced(placed);
  if (!isFinite(minR)) return null;

  const normPlaced = placed.map(p =>
    p.unplaced ? p : { ...p, row: p.row - minR, col: p.col - minC }
  );

  const normGrid = {};
  for (const [k, v] of Object.entries(grid)) {
    const [r, c] = k.split(',').map(Number);
    normGrid[key(r - minR, c - minC)] = v;
  }

  return {
    placed: normPlaced,
    grid: normGrid,
    width: maxC - minC + 1,
    height: maxR - minR + 1,
  };
}
