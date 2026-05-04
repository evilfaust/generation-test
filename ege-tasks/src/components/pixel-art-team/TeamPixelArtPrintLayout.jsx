import MathRenderer from '../MathRenderer';

/**
 * Печатная разметка командного пиксель-арта.
 *
 * Генерирует:
 *  - N² листов учеников (один лист на плитку, без нумерации)
 *  - 1 лист учителя: мини-превью полной картинки с пронумерованной сеткой плиток
 *    + ответы ко всем плиткам
 *
 * Каждый лист умещается на A4 portrait.
 */
export default function TeamPixelArtPrintLayout({
  title,
  tileCount,           // 2 | 3 | 4 (плиток на сторону)
  tiles,               // boolean[][][] — подматрицы
  tileGrids,           // Cell[][][] — { value, isAnswer }
  tileTasks,           // Task[][] — задачи для каждой плитки
  tileAnswers,         // {taskId: string}[] — кастомные ответы
  taskMode,            // 'same' | 'per_tile'
  sharedTasks,         // Task[] — для режима 'same'
  sharedAnswers,       // {taskId: string}
  twoSheets = false,
  twoColumns = false,
  fullMatrix,          // boolean[][] — полная матрица для листа учителя
}) {
  const totalTiles = tileCount * tileCount;

  // ── Получить задачи и ответы для плитки ───────────────────────────────────
  const getTasksForTile = (i) => taskMode === 'same' ? (sharedTasks ?? []) : (tileTasks?.[i] ?? []);
  const getAnswersForTile = (i) => taskMode === 'same' ? (sharedAnswers ?? {}) : (tileAnswers?.[i] ?? {});
  const getAnswerForTask = (tileIdx, task) => {
    const custom = getAnswersForTile(tileIdx);
    const c = custom[task.id];
    return c !== undefined && c !== '' ? c : (task.answer ?? '');
  };

  // ── Размер клетки для одной плитки (A4, квадратные клетки) ────────────────
  const calcCellMm = (grid, tasks, twoSh, twoCols) => {
    if (!grid?.length) return 6;
    const rows = grid.length;
    const cols = grid[0]?.length ?? rows;
    const availW = 186;
    const taskRows = twoCols ? Math.ceil(tasks.length / 2) : tasks.length;
    const computedAvailH = 277 - 60 - taskRows * 20;
    const availH = twoSh ? 250 : Math.max(60, computedAvailH);
    return Math.min(10, availW / cols, availH / rows);
  };

  // ── Единый размер клетки для всех плиток (ориентир — самая «тесная») ───────
  // В режиме twoSheets сетка на отдельном листе без задач — там всегда одинаково.
  // В режиме per_tile + одна страница: у кого больше задач — меньше места → берём min.
  const unifiedCellMm = (() => {
    const sizes = Array.from({ length: totalTiles }, (_, i) => {
      const grid = tileGrids?.[i];
      if (!grid?.length) return null;
      return calcCellMm(grid, getTasksForTile(i), twoSheets, twoColumns);
    }).filter(v => v !== null);
    return sizes.length > 0 ? Math.min(...sizes) : 6;
  })();

  const unifiedGridCellMm = (() => {
    // Для страниц с только сеткой (twoSheets=true) задачи не влияют, но всё равно унифицируем
    const sizes = Array.from({ length: totalTiles }, (_, i) => {
      const grid = tileGrids?.[i];
      if (!grid?.length) return null;
      return calcCellMm(grid, [], true, twoColumns);
    }).filter(v => v !== null);
    return sizes.length > 0 ? Math.min(...sizes) : 6;
  })();

  // ── Рендер сетки плитки ───────────────────────────────────────────────────
  const renderTileGrid = (grid, cellMm, highlightAnswers = false) => {
    if (!grid?.length) return null;
    const cols = grid[0]?.length ?? 0;
    const tableW = cellMm * cols;
    const fontPt = Math.max(4, Math.round(cellMm * 2.2 - 1));

    return (
      <table style={{
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        width: `${tableW}mm`,
        pageBreakInside: 'avoid',
        margin: '0 auto',
      }}>
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const filled = highlightAnswers && cell.isAnswer;
                return (
                  <td key={ci} style={{
                    height: `${cellMm}mm`,
                    border: '0.4pt solid #666',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontSize: `${fontPt}pt`,
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 500,
                    background: filled ? '#1a1a1a' : '#fff',
                    color: filled ? '#fff' : '#222',
                    padding: 0,
                    lineHeight: 1,
                    overflow: 'hidden',
                  }}>
                    {cell.value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ── Шапка листа ученика ───────────────────────────────────────────────────
  const renderStudentHeader = () => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      borderBottom: '1.5pt solid #000',
      paddingBottom: 6,
      marginBottom: 14,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Times New Roman, serif' }}>
        {title}
      </div>
      <div style={{ fontSize: 10, fontFamily: 'Arial, sans-serif', whiteSpace: 'nowrap' }}>
        Имя:_____________________ Класс:_______
      </div>
    </div>
  );

  // ── Задачи ────────────────────────────────────────────────────────────────
  const renderTasks = (tasks, tileIdx) => (
    <div style={{
      marginBottom: 14,
      ...(twoColumns ? {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6mm 5mm',
      } : {}),
    }}>
      {tasks.map((task, idx) => (
        <div key={task.id} style={{ marginBottom: 8, overflow: 'hidden' }}>
          <span style={{ fontWeight: 600, fontFamily: 'Arial, sans-serif', fontSize: 11 }}>
            Задача {idx + 1}.{' '}
          </span>
          <span style={{ fontSize: 11, fontFamily: 'Times New Roman, serif', lineHeight: 1.45 }}>
            <MathRenderer content={task.statement_md || ''} />
          </span>
          <div style={{ marginTop: 3, fontSize: 10, fontFamily: 'Arial, sans-serif', color: '#555' }}>
            Ответ: _______________
          </div>
        </div>
      ))}
    </div>
  );

  const instruction = (
    <div style={{
      fontSize: 10,
      fontFamily: 'Arial, sans-serif',
      marginBottom: 12,
      padding: '5px 10px',
      background: '#f5f5f5',
      border: '0.5pt solid #ccc',
      borderRadius: 3,
    }}>
      <b>Задание:</b> Реши задачи ниже. Найди в таблице все клетки с числами-ответами
      и закрась их. Если всё сделано верно — из закрашенных клеток получится фрагмент
      общей картины. Вырежи свой квадрат и сложи картину с командой!
    </div>
  );

  const footer = (
    <div style={{ marginTop: 8, textAlign: 'center', fontSize: 8, color: '#bbb', fontFamily: 'Arial, sans-serif' }}>
      © Лемма
    </div>
  );

  const gridCaption = (
    <div style={{
      textAlign: 'center', fontWeight: 600, fontFamily: 'Arial, sans-serif',
      fontSize: 10, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1,
    }}>
      Закрась числа-ответы — получится фрагмент картины!
    </div>
  );

  // ── Лист учителя: мини-превью полной картинки ─────────────────────────────
  const renderTeacherKey = () => {
    // Мини-сетка полной картинки (~120×120mm, макс 2мм на клетку)
    const fullRows = fullMatrix?.length ?? 0;
    const fullCols = fullMatrix?.[0]?.length ?? 0;
    const previewMm = Math.min(2, 120 / Math.max(fullRows, fullCols, 1));
    const previewW = previewMm * fullCols;
    const previewH = previewMm * fullRows;
    const tilePixH = (fullRows / tileCount) * previewMm;
    const tilePixW = (fullCols / tileCount) * previewMm;

    return (
      <div className="team-pixel-art-teacher-page" style={{ pageBreakBefore: 'always' }}>
        <div style={{
          borderBottom: '1.5pt solid #000', paddingBottom: 6, marginBottom: 14,
          fontWeight: 700, fontSize: 14, fontFamily: 'Times New Roman, serif',
        }}>
          {title} — КЛЮЧ (для учителя)
        </div>

        <div style={{ display: 'flex', gap: '20mm', alignItems: 'flex-start', marginBottom: 16 }}>
          {/* Превью полной картинки с нумерацией плиток */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, fontFamily: 'Arial, sans-serif',
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Схема сборки
            </div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {/* Пиксельная картинка */}
              {fullMatrix && (
                <table style={{
                  borderCollapse: 'collapse', tableLayout: 'fixed',
                  width: `${previewW}mm`, border: '0.5pt solid #333',
                }}>
                  <tbody>
                    {fullMatrix.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{
                            height: `${previewMm}mm`,
                            background: cell ? '#1a1a1a' : '#fff',
                            padding: 0,
                          }} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Сетка плиток поверх картинки */}
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: `${previewW}mm`, height: `${previewH}mm`,
              }}>
                {Array.from({ length: tileCount * tileCount }, (_, i) => {
                  const tr = Math.floor(i / tileCount);
                  const tc = i % tileCount;
                  return (
                    <div key={i} style={{
                      position: 'absolute',
                      left: `${tc * tilePixW}mm`,
                      top: `${tr * tilePixH}mm`,
                      width: `${tilePixW}mm`,
                      height: `${tilePixH}mm`,
                      border: '1pt solid rgba(255,80,0,0.8)',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span style={{
                        fontSize: `${Math.max(5, tilePixW * 2)}pt`,
                        fontWeight: 700,
                        fontFamily: 'Arial, sans-serif',
                        color: 'rgba(255,80,0,0.9)',
                        textShadow: '0 0 2px #fff',
                        lineHeight: 1,
                      }}>
                        {i + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{
              marginTop: 4, fontSize: 8, color: '#888',
              fontFamily: 'Arial, sans-serif', width: `${previewW}mm`,
            }}>
              Цифра = номер плитки ученика
            </div>
          </div>

          {/* Ответы по плиткам */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, fontFamily: 'Arial, sans-serif',
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Ответы
            </div>
            {Array.from({ length: totalTiles }, (_, i) => {
              const tasks = getTasksForTile(i);
              if (!tasks.length) return null;
              return (
                <div key={i} style={{
                  marginBottom: 8,
                  paddingBottom: 6,
                  borderBottom: i < totalTiles - 1 ? '0.5pt solid #ddd' : 'none',
                }}>
                  <div style={{
                    fontWeight: 700, fontSize: 10,
                    fontFamily: 'Arial, sans-serif', marginBottom: 3,
                    color: '#c04000',
                  }}>
                    Плитка {i + 1}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px' }}>
                    {tasks.map((task, idx) => (
                      <div key={task.id} style={{ fontSize: 10, fontFamily: 'Arial, sans-serif' }}>
                        Задача {idx + 1}: <b>{getAnswerForTask(i, task) || '—'}</b>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Мини-ключи плиток (подсвеченные) */}
        <div style={{
          fontSize: 10, fontWeight: 600, fontFamily: 'Arial, sans-serif',
          marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          Правильные паттерны плиток
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(tileCount * 2, 4)}, 1fr)`,
          gap: '6mm',
        }}>
          {Array.from({ length: totalTiles }, (_, i) => {
            const grid = tileGrids?.[i];
            if (!grid?.length) return null;
            const keyRows = grid.length;
            const keyCols = grid[0]?.length ?? keyRows;
            const keyCellMm = Math.min(3, 40 / Math.max(keyRows, keyCols));
            const keyW = keyCellMm * keyCols;
            const keyFontPt = Math.max(3, Math.round(keyCellMm * 2 - 1));
            return (
              <div key={i}>
                <div style={{
                  fontSize: 9, fontWeight: 700, fontFamily: 'Arial, sans-serif',
                  marginBottom: 3, color: '#c04000',
                }}>
                  Плитка {i + 1}
                </div>
                <table style={{
                  borderCollapse: 'collapse', tableLayout: 'fixed',
                  width: `${keyW}mm`, fontSize: `${keyFontPt}pt`,
                }}>
                  <tbody>
                    {grid.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{
                            height: `${keyCellMm}mm`,
                            border: '0.3pt solid #999',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            fontFamily: 'Arial, sans-serif',
                            fontWeight: 500,
                            background: cell.isAnswer ? '#1a1a1a' : '#fff',
                            color: cell.isAnswer ? '#fff' : '#555',
                            padding: 0, lineHeight: 1, overflow: 'hidden',
                          }}>
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {footer}
      </div>
    );
  };

  // ── Основной рендер ───────────────────────────────────────────────────────
  return (
    <div className="team-pixel-art-print-root">
      {/* Листы учеников */}
      {Array.from({ length: totalTiles }, (_, i) => {
        const grid  = tileGrids?.[i];
        const tasks = getTasksForTile(i);
        if (!grid) return null;

        return (
          <div
            key={i}
            className="team-pixel-art-student-page"
            style={{ pageBreakBefore: i > 0 ? 'always' : undefined }}
          >
            {renderStudentHeader()}
            {instruction}
            {tasks.length > 0 && renderTasks(tasks, i)}

            {!twoSheets && (
              <div style={{ pageBreakInside: 'avoid' }}>
                {gridCaption}
                {renderTileGrid(grid, unifiedCellMm, false)}
              </div>
            )}

            {footer}
          </div>
        );
      })}

      {/* Второй лист ученика (сетка отдельно) */}
      {twoSheets && Array.from({ length: totalTiles }, (_, i) => {
        const grid  = tileGrids?.[i];
        if (!grid) return null;
        return (
          <div key={`grid-${i}`} className="team-pixel-art-grid-page" style={{ pageBreakBefore: 'always' }}>
            <div style={{
              borderBottom: '1.5pt solid #000', paddingBottom: 6, marginBottom: 14,
              fontWeight: 700, fontSize: 14, fontFamily: 'Times New Roman, serif',
            }}>
              {title} — Таблица
            </div>
            {gridCaption}
            {renderTileGrid(grid, unifiedGridCellMm, false)}
            {footer}
          </div>
        );
      })}

      {/* Лист учителя */}
      {renderTeacherKey()}
    </div>
  );
}
