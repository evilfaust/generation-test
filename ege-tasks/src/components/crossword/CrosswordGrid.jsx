export default function CrosswordGrid({ layout, showAnswers, cellSize = 28 }) {
  if (!layout) return null;

  const { grid, placed, width, height } = layout;

  // Map "row,col" → word number for cells that start a word
  const startNumbers = {};
  for (const pw of placed) {
    if (!pw.unplaced) {
      const k = `${pw.row},${pw.col}`;
      // If multiple words start at same cell (rare), show smallest number
      if (!startNumbers[k] || pw.number < startNumbers[k]) {
        startNumbers[k] = pw.number;
      }
    }
  }

  const numSize = Math.max(Math.floor(cellSize * 0.28), 6);
  const letterSize = Math.floor(cellSize * 0.52);

  return (
    <div style={{ display: 'inline-block', lineHeight: 0, userSelect: 'none' }}>
      {Array.from({ length: height }, (_, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {Array.from({ length: width }, (_, c) => {
            const cell = grid[`${r},${c}`] ?? null;
            const startNum = startNumbers[`${r},${c}`];
            return (
              <div
                key={c}
                style={{
                  width: cellSize,
                  height: cellSize,
                  border: cell ? '1.5px solid #222' : 'none',
                  background: cell ? '#fff' : 'transparent',
                  position: 'relative',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                {startNum != null && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 1,
                      left: 1,
                      fontSize: numSize,
                      lineHeight: 1,
                      fontWeight: 700,
                      color: '#1a1a1a',
                      fontFamily: 'Arial, sans-serif',
                    }}
                  >
                    {startNum}
                  </span>
                )}
                {showAnswers && cell && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingTop: startNum != null ? numSize : 0,
                      fontSize: letterSize,
                      fontWeight: 700,
                      color: '#1677ff',
                      fontFamily: 'Arial, sans-serif',
                    }}
                  >
                    {cell.letter}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
