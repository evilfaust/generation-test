export default function CrosswordGrid({
  layout,
  showAnswers,
  cellSize = 28,
  cellBorder = '#222',
  cellBg = 'rgba(255,255,255,0.92)',
  numColor = '#1a1a1a',
}) {
  if (!layout) return null;

  const { grid, placed, width, height } = layout;

  const startNumbers = {};
  for (const pw of placed) {
    if (!pw.unplaced) {
      const k = `${pw.row},${pw.col}`;
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
                  border: cell ? `2px solid ${cellBorder}` : 'none',
                  background: cell ? cellBg : 'transparent',
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
                      left: 2,
                      fontSize: numSize,
                      lineHeight: 1,
                      fontWeight: 800,
                      color: numColor,
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
                      color: numColor,
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
