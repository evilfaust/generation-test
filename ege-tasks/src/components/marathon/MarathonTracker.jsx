import { useState, useCallback, useRef, useEffect } from 'react';
import { Popconfirm } from 'antd';

/* ================================================================
   Score helpers
   ================================================================ */

function calcTaskScore(data) {
  if (!data || (!data.solved && !data.failed)) return 0;
  if (data.failed) return 0;
  if (data.solved) {
    const a = data.attempts || 0;
    if (a === 0) return 3;
    if (a === 1) return 2;
    return 1;
  }
  return 0;
}

function calcTotalScore(name, trackingData) {
  const data = trackingData[name] || {};
  return Object.entries(data).reduce((sum, [k, v]) => {
    if (k.startsWith('_')) return sum;
    return sum + calcTaskScore(v);
  }, 0);
}

function getIssuedCount(studentName, trackingData) {
  return trackingData[studentName]?._issued ?? 2;
}

function getHandCards(studentName, taskCount, trackingData) {
  const issued = getIssuedCount(studentName, trackingData);
  const result = [];
  for (let i = 0; i < Math.min(issued, taskCount); i++) {
    const d = (trackingData[studentName] || {})[String(i)];
    if (!d?.solved && !d?.failed) result.push(i + 1);
  }
  return result;
}

function getPopularTasks(students, tasks, trackingData) {
  const counts = tasks.map((_, idx) => {
    const solved = students.filter(s => (trackingData[s] || {})[String(idx)]?.solved).length;
    return { idx, solved };
  });
  counts.sort((a, b) => b.solved - a.solved);
  const top = new Set(counts.slice(0, 3).filter(c => c.solved > 0).map(c => c.idx));
  return top;
}

/* ================================================================
   Difficulty helpers
   ================================================================ */

const DIFF_CLASS = { 1: 'easy', 2: 'med', 3: 'hard' };
const DIFF_LABEL = { 1: 'Л', 2: 'С', 3: 'Т' };

/* ================================================================
   Cell component
   ================================================================ */

function TgCell({ data, onSuccess, onFail, onReset, isInHand }) {
  const attempts = data?.attempts || 0;

  let stateClass = 'empty';
  if (data?.solved) {
    stateClass = `s${calcTaskScore(data)}`;
  } else if (data?.failed) {
    stateClass = 's0';
  } else if (attempts > 0) {
    stateClass = 'attempting';
  } else if (isInHand) {
    stateClass = 'empty in-hand';
  }

  const innerContent = () => {
    if (data?.solved) {
      const score = calcTaskScore(data);
      return (
        <>
          <span>+{score}</span>
          {attempts > 0 && (
            <div className="dots">
              {[0, 1, 2].map(i => (
                <span key={i} className={`d${i < attempts ? ' fail' : ''}`} />
              ))}
            </div>
          )}
        </>
      );
    }
    if (data?.failed) {
      return (
        <>
          <span>✕</span>
          <div className="dots">
            {[0, 1, 2].map(i => <span key={i} className="d fail" />)}
          </div>
        </>
      );
    }
    if (attempts > 0) {
      return (
        <>
          <span className="att-num">{attempts}</span>
          <div className="dots">
            {[0, 1, 2].map(i => (
              <span key={i} className={`d${i < attempts ? ' fail' : ''}`} />
            ))}
          </div>
        </>
      );
    }
    return isInHand ? <span style={{ fontSize: 10 }}>🃏</span> : <span>·</span>;
  };

  const canReset = data?.solved || data?.failed || attempts > 0;

  return (
    <div className={`tg-cell ${stateClass}`}>
      <Popconfirm
        title="Сбросить эту ячейку?"
        onConfirm={onReset}
        disabled={!canReset}
        placement="top"
      >
        <div className="inner">{innerContent()}</div>
      </Popconfirm>
      {!data?.solved && !data?.failed && (
        <div className="quick">
          <button className="qbtn ok" onClick={e => { e.stopPropagation(); onSuccess(); }} title="Решено">✓</button>
          <button className="qbtn fail" onClick={e => { e.stopPropagation(); onFail(); }} disabled={attempts >= 3} title="Неудача">✗</button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Main component
   ================================================================ */

const DENSITY_OPTIONS = [
  { key: 'compact',     label: 'Компактно' },
  { key: 'comfortable', label: 'Обычно'    },
  { key: 'large',       label: 'Крупно'    },
];

const SORT_OPTIONS = [
  { key: 'score', label: 'По счёту'  },
  { key: 'alpha', label: 'А–Я'       },
  { key: 'front', label: 'По фронту' },
];

export default function MarathonTracker({
  tasks,
  students,
  trackingData,
  setTrackingData,
  onSaveTracking,
}) {
  const [density, setDensity] = useState(() =>
    localStorage.getItem('marathon.tracker.density') || 'comfortable'
  );
  const [sortKey, setSortKey] = useState(() =>
    localStorage.getItem('marathon.tracker.sort') || 'score'
  );

  // Refs для синхронизации горизонтального скролла заголовка с телом
  const bodyTasksRef = useRef(null);
  const headTasksRef = useRef(null);

  const onBodyScroll = useCallback(() => {
    if (headTasksRef.current && bodyTasksRef.current) {
      headTasksRef.current.scrollLeft = bodyTasksRef.current.scrollLeft;
    }
  }, []);

  const setDensityPersist = (v) => { setDensity(v); localStorage.setItem('marathon.tracker.density', v); };
  const setSortPersist    = (v) => { setSortKey(v); localStorage.setItem('marathon.tracker.sort', v); };

  /* ---- Attempt handlers ---- */

  const handleAttempt = useCallback((studentName, taskIdx, success) => {
    setTrackingData(prev => {
      const next = { ...prev };
      const studentData = { ...(next[studentName] || {}) };
      const key = String(taskIdx);
      const current = studentData[key] || { attempts: 0, solved: false, failed: false };
      if (current.solved || current.failed) return prev;

      let updated;
      if (success) {
        updated = { ...current, solved: true, _lastActivityAt: Date.now() };
      } else {
        const newAttempts = current.attempts + 1;
        updated = { ...current, attempts: newAttempts, failed: newAttempts >= 3, _lastActivityAt: Date.now() };
      }
      studentData[key] = updated;
      next[studentName] = studentData;
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
  }, [setTrackingData, onSaveTracking]);

  const handleReset = useCallback((studentName, taskIdx) => {
    setTrackingData(prev => {
      const next = { ...prev };
      const studentData = { ...(next[studentName] || {}) };
      studentData[String(taskIdx)] = { attempts: 0, solved: false, failed: false };
      next[studentName] = studentData;
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
  }, [setTrackingData, onSaveTracking]);

  const handleIssueNext = useCallback((studentName) => {
    setTrackingData(prev => {
      const next = { ...prev };
      const studentData = { ...(next[studentName] || {}) };
      const current = studentData._issued ?? 2;
      if (current >= tasks.length) return prev;
      studentData._issued = current + 1;
      next[studentName] = studentData;
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
  }, [setTrackingData, onSaveTracking, tasks.length]);

  const handleIssueAll = useCallback(() => {
    setTrackingData(prev => {
      const next = { ...prev };
      students.forEach(name => {
        const studentData = { ...(next[name] || {}) };
        const current = studentData._issued ?? 2;
        if (current < tasks.length) {
          studentData._issued = current + 1;
          next[name] = studentData;
        }
      });
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
  }, [setTrackingData, onSaveTracking, students, tasks.length]);

  /* ---- Derived data ---- */

  const displayStudents = (() => {
    const arr = [...students];
    if (sortKey === 'score') {
      arr.sort((a, b) => calcTotalScore(b, trackingData) - calcTotalScore(a, trackingData));
    } else if (sortKey === 'alpha') {
      arr.sort((a, b) => a.localeCompare(b, 'ru'));
    } else if (sortKey === 'front') {
      arr.sort((a, b) => {
        const frontA = tasks.findIndex((_, i) => { const d = (trackingData[a] || {})[String(i)]; return !d?.solved && !d?.failed; });
        const frontB = tasks.findIndex((_, i) => { const d = (trackingData[b] || {})[String(i)]; return !d?.solved && !d?.failed; });
        return (frontA === -1 ? 999 : frontA) - (frontB === -1 ? 999 : frontB);
      });
    }
    return arr;
  })();

  const popularTasks = getPopularTasks(students, tasks, trackingData);
  const maxScore = tasks.length * 3;

  /* ---- Keyboard shortcuts ---- */

  const [focus, setFocus] = useState(null);

  const moveFocus = useCallback((dRow, dCol) => {
    setFocus(prev => {
      const row = prev ? Math.max(0, Math.min(displayStudents.length - 1, prev.row + dRow)) : 0;
      const col = prev ? Math.max(0, Math.min(tasks.length - 1, prev.col + dCol)) : 0;
      return { row, col };
    });
  }, [displayStudents.length, tasks.length]);

  useEffect(() => {
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (document.querySelector('.ant-popconfirm, .ant-modal-wrap:not(.ant-modal-wrap-hidden)')) return;
      const cur = focus;
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); moveFocus(0, 1); break;
        case 'ArrowLeft':  e.preventDefault(); moveFocus(0, -1); break;
        case 'ArrowDown':  e.preventDefault(); moveFocus(1, 0); break;
        case 'ArrowUp':    e.preventDefault(); moveFocus(-1, 0); break;
        case 'j': case 'J': moveFocus(1, 0); break;
        case 'k': case 'K': moveFocus(-1, 0); break;
        case 'Escape': setFocus(null); break;
        case 'Enter': case '1':
          if (cur) { const name = displayStudents[cur.row]; if (name) handleAttempt(name, cur.col, true); }
          break;
        case 'Backspace': case '0':
          if (cur) { e.preventDefault(); const name = displayStudents[cur.row]; if (name) handleAttempt(name, cur.col, false); }
          break;
        case 'r': case 'R':
          if (cur) { const name = displayStudents[cur.row]; if (name) handleReset(name, cur.col); }
          break;
        case 'h': case 'H':
          if (cur) { const name = displayStudents[cur.row]; if (name) handleIssueNext(name); }
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focus, moveFocus, handleAttempt, handleReset, handleIssueNext, displayStudents]);

  if (!students.length || !tasks.length) {
    return <div className="tg-empty">Добавьте учеников и задачи в разделе «Содержимое»</div>;
  }

  return (
    <div className={`marathon-tracker-v2 is-${density}`}>
      {/* ---- Toolbar ---- */}
      <div className="tracker-toolbar">
        <div className="seg">
          {DENSITY_OPTIONS.map(opt => (
            <button key={opt.key} className={density === opt.key ? 'is-active' : ''} onClick={() => setDensityPersist(opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="seg">
          {SORT_OPTIONS.map(opt => (
            <button key={opt.key} className={sortKey === opt.key ? 'is-active' : ''} onClick={() => setSortPersist(opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>
        <Popconfirm title="Выдать всем по одной карточке?" onConfirm={handleIssueAll} placement="bottomLeft">
          <button className="btn-issue-all">+ Раздать всем карточку</button>
        </Popconfirm>
        <div className="legend">
          <span><span className="legend-chip" style={{ background: '#14a85a' }} />+3</span>
          <span><span className="legend-chip" style={{ background: '#2f7df0' }} />+2</span>
          <span><span className="legend-chip" style={{ background: '#e89a14' }} />+1</span>
          <span><span className="legend-chip" style={{ background: '#d8e0ec' }} />0</span>
        </div>
        <button
          className={`btn-kbd${focus !== null ? ' is-active' : ''}`}
          onClick={() => focus !== null ? setFocus(null) : setFocus({ row: 0, col: 0 })}
          title={focus !== null ? 'Выйти из режима клавиатуры (Esc)' : 'Включить клавиатурное управление'}
        >
          ⌨{focus !== null ? ` ${displayStudents[focus.row]?.split(' ')[0]} · #${focus.col + 1}` : ' Клавиатура'}
        </button>
      </div>

      {/* KB hint bar */}
      {focus !== null && (
        <div className="tg-kb-bar">
          {[['←↑→↓','навигация'],['Enter','✓ решено'],['0','✗ неудача'],['R','сбросить'],['H','выдать'],['Esc','выход']].map(([key, desc]) => (
            <span key={key} className="tg-kb-item"><span className="tg-kk">{key}</span><span>{desc}</span></span>
          ))}
        </div>
      )}

      {/* ================================================================
          3-panel layout: [Names 220px] | [Tasks flex scroll] | [Score 96px]
          ================================================================ */}
      <div className="tg-panel-wrap">

        {/* ── STICKY HEADER ROW ── */}
        <div className="tg-panel-head">
          <div className="tg-ph-name">Ученик</div>
          {/* Task headers — overflow hidden, scrolled via JS in sync with body */}
          <div className="tg-ph-tasks" ref={headTasksRef}>
            <div className="tg-ph-tasks-inner">
              {tasks.map((task, idx) => (
                <div
                  key={idx}
                  className={`head-task${popularTasks.has(idx) ? ' is-popular' : ''}`}
                  title={task.code}
                >
                  <span>{idx + 1}</span>
                  {task.difficulty && <span className="diff-lbl">{DIFF_LABEL[task.difficulty]}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="tg-ph-score">Счёт</div>
        </div>

        {/* ── BODY ── */}
        <div className="tg-panel-body">

          {/* Left: names */}
          <div className="tg-panel-names">
            {displayStudents.map((student, rowIdx) => {
              const issuedCount = getIssuedCount(student, trackingData);
              const handCards = getHandCards(student, tasks.length, trackingData);
              const total = calcTotalScore(student, trackingData);
              const isLeader = rowIdx === 0 && sortKey === 'score' && total > 0;
              return (
                <div key={student} className={`tg-name${isLeader ? ' is-leader' : ''}`}>
                  <div className="name">
                    {isLeader && <span className="medal">🥇</span>}
                    {rowIdx === 1 && sortKey === 'score' && total > 0 && <span className="medal">🥈</span>}
                    {rowIdx === 2 && sortKey === 'score' && total > 0 && <span className="medal">🥉</span>}
                    <span>{student}</span>
                  </div>
                  <div className="hand">
                    <span>🃏</span>
                    <span className={`cards${handCards.length === 0 ? ' cards-empty' : ''}`}>
                      {handCards.length > 0 ? handCards.join(', ') : '—'}
                    </span>
                    <button
                      className="issue"
                      onClick={() => handleIssueNext(student)}
                      disabled={issuedCount >= tasks.length}
                      title={issuedCount < tasks.length ? `Выдать карточку №${issuedCount + 1}` : 'Все выданы'}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Middle: task cells — horizontal scroll */}
          <div className="tg-panel-tasks" ref={bodyTasksRef} onScroll={onBodyScroll}>
            {displayStudents.map((student, rowIdx) => {
              const issuedCount = getIssuedCount(student, trackingData);
              const total = calcTotalScore(student, trackingData);
              const isLeader = rowIdx === 0 && sortKey === 'score' && total > 0;
              return (
                <div key={student} className={`tg-task-row${isLeader ? ' is-leader' : ''}`}>
                  {tasks.map((_, taskIdx) => {
                    const data = (trackingData[student] || {})[String(taskIdx)];
                    const isInHand = taskIdx < issuedCount && !data?.solved && !data?.failed;
                    const isFocused = focus?.row === rowIdx && focus?.col === taskIdx;
                    return (
                      <div
                        key={taskIdx}
                        className={isFocused ? 'tg-cell-wrap is-focused' : 'tg-cell-wrap'}
                        onClick={() => setFocus({ row: rowIdx, col: taskIdx })}
                      >
                        <TgCell
                          data={data}
                          isInHand={isInHand}
                          onSuccess={() => handleAttempt(student, taskIdx, true)}
                          onFail={() => handleAttempt(student, taskIdx, false)}
                          onReset={() => handleReset(student, taskIdx)}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Right: scores */}
          <div className="tg-panel-scores">
            {displayStudents.map((student) => {
              const total = calcTotalScore(student, trackingData);
              const pct = maxScore > 0 ? Math.round((total / maxScore) * 100) : 0;
              return (
                <div key={student} className="tg-score">
                  <span className="total">{total}</span>
                  <span className="max">/ {maxScore}</span>
                  <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>

        </div>{/* end tg-panel-body */}
      </div>{/* end tg-panel-wrap */}

      {/* ---- Legend ---- */}
      <div className="tracker-legend">
        <span style={{ color: '#14a85a' }}>+3 — с первой попытки</span>
        <span style={{ color: '#2f7df0' }}>+2 — со второй</span>
        <span style={{ color: '#e89a14' }}>+1 — с третьей</span>
        <span style={{ color: '#999' }}>0 — три неудачи</span>
        <span style={{ color: 'var(--brand, #4f56e3)' }}>🃏 — карточка на руках</span>
      </div>
    </div>
  );
}
