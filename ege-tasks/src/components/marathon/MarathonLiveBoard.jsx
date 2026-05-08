import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../../shared/services/pocketbase';
import './MarathonLiveBoard.css';

/* ================================================================
   Helpers
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

function calcTotalScore(name, trackingData, taskCount) {
  const studentData = trackingData[name] || {};
  let total = 0;
  for (let i = 0; i < taskCount; i++) {
    total += calcTaskScore(studentData[String(i)]);
  }
  return total;
}

// Возвращает индекс задачи, на которой сейчас находится ученик:
// - in-progress (есть попытки, не решена/не провалена) → она
// - иначе — первая нерешённая/непроваленная
function getFrontierIndex(studentData, taskCount) {
  for (let i = 0; i < taskCount; i++) {
    const d = studentData[String(i)];
    if (d && !d.solved && !d.failed && (d.attempts || 0) > 0) return i;
  }
  for (let i = 0; i < taskCount; i++) {
    const d = studentData[String(i)];
    if (!d || (!d.solved && !d.failed)) return i;
  }
  return taskCount; // все завершены
}

// Ячейка одной задачи
function TaskCell({ data, taskNum, isActive, isInHand }) {
  const attempts = data?.attempts || 0;

  // Attempt dots: 3 маленьких кружка — красный = неудача, серый = не использован
  const AttemptDots = ({ used, okAt }) => (
    <div className="mlb-task-dots">
      {[0, 1, 2].map(j => {
        let cls = 'mlb-task-dot';
        if (j === okAt) cls += ' mlb-task-dot--ok';
        else if (j < used) cls += ' mlb-task-dot--fail';
        return <span key={j} className={cls} />;
      })}
    </div>
  );

  if (!data || (!data.solved && !data.failed && attempts === 0)) {
    // Не начата
    const cls = [
      'mlb-task mlb-task--empty',
      isActive ? ' mlb-task--frontier' : '',
      isInHand ? ' mlb-task--inhand' : '',
    ].join('');
    return (
      <div className={cls}>
        <span className="mlb-task-num">{taskNum}</span>
        {isInHand && <span className="mlb-inhand-dot" />}
      </div>
    );
  }

  if (data.solved) {
    const score = attempts === 0 ? 3 : attempts === 1 ? 2 : 1;
    return (
      <div className={`mlb-task mlb-task--solved mlb-task--s${score}`}>
        <span className="mlb-task-score">+{score}</span>
        <AttemptDots used={attempts} okAt={attempts} />
      </div>
    );
  }

  if (data.failed) {
    return (
      <div className="mlb-task mlb-task--failed">
        <span className="mlb-task-fail">✕</span>
        <AttemptDots used={3} okAt={-1} />
      </div>
    );
  }

  // В процессе — главный индикатор
  return (
    <div className="mlb-task mlb-task--active">
      <span className="mlb-task-num mlb-task-num--active">{taskNum}</span>
      <AttemptDots used={attempts} okAt={-1} />
    </div>
  );
}

function getRankMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

/* ================================================================
   Confetti burst
   ================================================================ */

const CONFETTI_COLORS = [
  '#f5c518', '#60a5fa', '#34d399', '#f472b6',
  '#a78bfa', '#fb923c', '#facc15', '#86efac',
];

function ConfettiContainer({ bursts }) {
  return (
    <div className="mlb-confetti-container" aria-hidden="true">
      {bursts.map((burst) =>
        burst.pieces.map((p) => (
          <div
            key={`${burst.id}-${p.id}`}
            className="mlb-confetti-piece"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size * (p.tall ? 2.5 : 1),
              background: p.color,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              opacity: 1,
            }}
          />
        ))
      )}
    </div>
  );
}

function createBurst(x, y) {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: x + (Math.random() - 0.5) * 20,
    y: y + (Math.random() - 0.5) * 10,
    size: 6 + Math.random() * 7,
    tall: Math.random() > 0.5,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    duration: 1.2 + Math.random() * 0.8,
    delay: Math.random() * 0.3,
  }));
  return { id: Date.now() + Math.random(), pieces };
}

/* ================================================================
   Main Component
   ================================================================ */

export default function MarathonLiveBoard({ marathonId }) {
  // ---- State ----
  const [marathon, setMarathon] = useState(null);
  const [trackingData, setTrackingData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [floatPopups, setFloatPopups] = useState([]);    // { id, name, delta }
  const [confettiBursts, setConfettiBursts] = useState([]);
  const [flashingRows, setFlashingRows] = useState(new Set());
  const [popScores, setPopScores] = useState({});
  const [isFrozen, setIsFrozen] = useState(false);

  // ---- Refs ----
  const prevScoresRef = useRef({});
  const rowRefs = useRef({});
  const prevPositionsRef = useRef({});
  const handleEventRef = useRef(null);
  const marathonRef = useRef(null);
  marathonRef.current = marathon;

  // ---- Effect helpers (defined early so handleEvent can use them) ----

  const addFloatingPlus = useCallback((name, delta) => {
    if (delta === 0) return;
    const id = Date.now() + Math.random();
    setFloatPopups(prev => [...prev, { id, name, delta }]);
    setTimeout(() => {
      setFloatPopups(prev => prev.filter(p => p.id !== id));
    }, 1500);
  }, []);

  const flashRow = useCallback((name) => {
    setFlashingRows(prev => new Set([...prev, name]));
    setTimeout(() => {
      setFlashingRows(prev => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }, 1300);
  }, []);

  const popScore = useCallback((name) => {
    setPopScores(prev => ({ ...prev, [name]: true }));
    setTimeout(() => {
      setPopScores(prev => { const n = { ...prev }; delete n[name]; return n; });
    }, 600);
  }, []);

  const triggerConfetti = useCallback((name) => {
    const el = rowRefs.current[name];
    const rect = el?.getBoundingClientRect();
    const x = rect ? ((rect.left + rect.width / 2) / window.innerWidth) * 100 : 50;
    const y = rect ? (rect.top / window.innerHeight) * 100 : 30;
    const burst = createBurst(x, y);
    setConfettiBursts(prev => [...prev, burst]);
    setTimeout(() => {
      setConfettiBursts(prev => prev.filter(b => b.id !== burst.id));
    }, 2500);
  }, []);

  // ---- FLIP helpers ----

  const recordPositions = useCallback(() => {
    const positions = {};
    Object.entries(rowRefs.current).forEach(([name, el]) => {
      if (el) positions[name] = el.getBoundingClientRect().top;
    });
    prevPositionsRef.current = positions;
  }, []);

  const applyFlip = useCallback(() => {
    Object.entries(rowRefs.current).forEach(([name, el]) => {
      if (!el) return;
      const prevY = prevPositionsRef.current[name];
      if (prevY === undefined) return;
      const newY = el.getBoundingClientRect().top;
      const delta = prevY - newY;
      if (Math.abs(delta) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = '';
        });
      });
    });
  }, []);

  // ---- Handle PocketBase real-time event ----

  const handleEvent = useCallback((event) => {
    if (event.action !== 'update') return;
    if (isFrozen) return;
    const newTracking = event.record.tracking_data || {};
    const currentMarathon = marathonRef.current;
    if (!currentMarathon) return;

    const tasks = currentMarathon.expand?.tasks || [];
    const taskCount = (currentMarathon.task_order || []).length || tasks.length;
    const students = currentMarathon.students || [];

    setTrackingData(prev => {
      // Diff: find who got new points
      const changes = [];
      students.forEach(name => {
        const oldScore = prevScoresRef.current[name] || 0;
        const newScore = calcTotalScore(name, newTracking, taskCount);
        if (newScore !== oldScore) {
          changes.push({ name, delta: newScore - oldScore, newScore });
        }

        // Check for fresh first-try solve (+3 → confetti)
        const oldData = prev[name] || {};
        const newData = newTracking[name] || {};
        for (let i = 0; i < taskCount; i++) {
          const key = String(i);
          const od = oldData[key];
          const nd = newData[key];
          if (nd?.solved && !od?.solved && (nd.attempts || 0) === 0) {
            triggerConfetti(name);
          }
        }
      });

      if (changes.length > 0) {
        recordPositions();
        changes.forEach(({ name, delta, newScore }) => {
          if (delta !== 0) {
            addFloatingPlus(name, delta);
            flashRow(name);
            popScore(name);
          }
          prevScoresRef.current[name] = newScore;
        });
      }

      return newTracking;
    });
  }, [addFloatingPlus, flashRow, popScore, triggerConfetti, recordPositions, isFrozen]);

  // Keep ref current every render (after handleEvent is defined)
  handleEventRef.current = handleEvent;

  // ---- Load marathon ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await api.getMarathon(marathonId);
        if (cancelled) return;
        setMarathon(data);
        setTrackingData(data.tracking_data || {});
        const tasks = data.expand?.tasks || [];
        const taskCount = (data.task_order || []).length || tasks.length;
        const scores = {};
        (data.students || []).forEach(s => {
          scores[s] = calcTotalScore(s, data.tracking_data || {}, taskCount);
        });
        prevScoresRef.current = scores;
      } catch {
        if (!cancelled) setError('Марафон не найден или ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [marathonId]);

  // ---- Subscribe to real-time updates ----
  useEffect(() => {
    if (!marathon) return;

    (async () => {
      try {
        await api.subscribeMarathon(marathonId, (event) => {
          handleEventRef.current?.(event);
        });
        setConnected(true);
      } catch {
        setConnected(false);
      }
    })();

    return () => {
      api.unsubscribeMarathon(marathonId).catch(() => {});
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marathon, marathonId]);

  // ---- FLIP: apply after trackingData changes ----
  const prevTrackingRef = useRef(trackingData);
  useEffect(() => {
    if (prevTrackingRef.current !== trackingData) {
      applyFlip();
      prevTrackingRef.current = trackingData;
    }
  }, [trackingData, applyFlip]);

  // ---- Derived data ----

  const taskCount = useMemo(() => {
    if (!marathon) return 0;
    return (marathon.task_order || []).length || (marathon.expand?.tasks || []).length;
  }, [marathon]);

  const sortedStudents = useMemo(() => {
    if (!marathon) return [];
    return [...(marathon.students || [])].sort((a, b) => {
      const sa = calcTotalScore(a, trackingData, taskCount);
      const sb = calcTotalScore(b, trackingData, taskCount);
      if (sb !== sa) return sb - sa;
      return a.localeCompare(b, 'ru');
    });
  }, [marathon, trackingData, taskCount]);

  const maxScore = taskCount * 3;
  const isCompact = sortedStudents.length > 20 || taskCount > 20;

  const solvedCount = useMemo(() => {
    return sortedStudents.reduce((acc, name) => {
      const data = trackingData[name] || {};
      for (let i = 0; i < taskCount; i++) {
        if (data[String(i)]?.solved) acc++;
      }
      return acc;
    }, 0);
  }, [sortedStudents, trackingData, taskCount]);

  const totalPossible = sortedStudents.length * taskCount;

  // ---- Render ----

  if (loading) {
    return (
      <div className="mlb-root">
        <div className="mlb-loading">
          <div className="mlb-spinner" />
          <span>Загрузка марафона…</span>
        </div>
      </div>
    );
  }

  if (error || !marathon) {
    return (
      <div className="mlb-root">
        <div className="mlb-error">
          <span style={{ fontSize: 32 }}>⚠️</span>
          <span>{error || 'Марафон не найден'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mlb-root">
      <ConfettiContainer bursts={confettiBursts} />

      {/* ---- Header ---- */}
      <div className="mlb-header">
        <div className="mlb-header-left">
          <div className="mlb-title">🏆 {marathon.title || 'Марафон'}</div>
          {marathon.class_number ? (
            <div className="mlb-subtitle">{marathon.class_number} класс</div>
          ) : null}
        </div>

        <div className="mlb-header-right">
          <div className="mlb-stat">
            <span className="mlb-stat-num">{sortedStudents.length}</span>
            <span className="mlb-stat-label">Участников</span>
          </div>
          <div className="mlb-stat-divider" />
          <div className="mlb-stat">
            <span className="mlb-stat-num">{taskCount}</span>
            <span className="mlb-stat-label">Заданий</span>
          </div>
          <div className="mlb-stat-divider" />
          <div className="mlb-stat">
            <span className="mlb-stat-num">{solvedCount}</span>
            <span className="mlb-stat-label">Решений</span>
          </div>
          <div className="mlb-stat-divider" />

          <button
            className={`mlb-freeze-btn${isFrozen ? ' is-frozen' : ''}`}
            onClick={() => setIsFrozen(v => !v)}
            title={isFrozen ? 'Разморозить рейтинг' : 'Заморозить рейтинг'}
          >
            {isFrozen ? '❄️ Заморожен' : '▶ Заморозить'}
          </button>

          {connected ? (
            <div className="mlb-live-badge">
              <span className="mlb-live-dot" />
              LIVE
            </div>
          ) : (
            <div className="mlb-offline-badge">
              <span className="mlb-offline-dot" />
              Offline
            </div>
          )}
        </div>
      </div>

      {/* ---- Leaderboard ---- */}
      <div className="mlb-content">
        {sortedStudents.length === 0 ? (
          <div className="mlb-empty">Участники не добавлены</div>
        ) : (
          <div className="mlb-table-wrap">
            <table className={`mlb-table${isCompact ? ' mlb-table--compact' : ''}`}>
              <thead>
                <tr>
                  <th className="mlb-th-rank">#</th>
                  <th className="mlb-th-name">Участник</th>
                  <th className="mlb-th-score">Очки</th>
                  {Array.from({ length: taskCount }, (_, i) => (
                    <th key={i} className="mlb-th-task-col">{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((name, idx) => {
                  const rank = idx + 1;
                  const score = calcTotalScore(name, trackingData, taskCount);
                  const medal = getRankMedal(rank);
                  const isFlashing = flashingRows.has(name);
                  const isPopping = popScores[name];
                  const popup = floatPopups.find(p => p.name === name);
                  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
                  const studentData = trackingData[name] || {};
                  const frontier = getFrontierIndex(studentData, taskCount);
                  const issuedCount = studentData._issued ?? 2;

                  let rowClass = 'mlb-row';
                  if (rank === 1) rowClass += ' mlb-row--top1';
                  else if (rank === 2) rowClass += ' mlb-row--top2';
                  else if (rank === 3) rowClass += ' mlb-row--top3';
                  if (isFlashing) rowClass += ' mlb-row--flash';

                  let nameClass = 'mlb-name-cell';
                  if (rank === 1 && score > 0) nameClass += ' mlb-name--top1';
                  else if (rank === 2 && score > 0) nameClass += ' mlb-name--top2';
                  else if (rank === 3 && score > 0) nameClass += ' mlb-name--top3';

                  return (
                    <tr
                      key={name}
                      className={rowClass}
                      ref={el => { rowRefs.current[name] = el; }}
                    >
                      {/* Rank */}
                      <td className="mlb-rank-cell">
                        {medal && score > 0 ? (
                          <span className="mlb-rank-medal">{medal}</span>
                        ) : (
                          <span className="mlb-rank-number">{rank}</span>
                        )}
                      </td>

                      {/* Name */}
                      <td className={nameClass}>
                        {rank === 1 && score > 0 && (
                          <span className="mlb-crown">👑</span>
                        )}
                        {name}
                      </td>

                      {/* Score + frontier badge */}
                      <td className="mlb-score-cell">
                        <div className="mlb-score-wrap">
                          <span className={`mlb-score-value${isPopping ? ' mlb-score-value--pop' : ''}`}>
                            {score}
                          </span>
                          <div className="mlb-score-bar-wrap">
                            <div
                              className="mlb-score-bar"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        {frontier < taskCount && (
                          <div className="mlb-frontier-badge">
                            ▶ №{frontier + 1}
                          </div>
                        )}
                        {popup && (
                          <div className="mlb-float-plus" key={popup.id}>
                            {popup.delta > 0 ? `+${popup.delta}` : popup.delta}
                          </div>
                        )}
                      </td>

                      {/* Task cells — one <td> per task */}
                      {Array.from({ length: taskCount }, (_, i) => {
                        const d = studentData[String(i)];
                        const isActive = !d?.solved && !d?.failed && (d?.attempts || 0) > 0;
                        const isFrontier = i === frontier && frontier < taskCount;
                        const isInHand = i < issuedCount && !d?.solved && !d?.failed;
                        return (
                          <td key={i} className={`mlb-task-td${isFrontier ? ' mlb-task-td--frontier' : ''}${isInHand ? ' mlb-task-td--inhand' : ''}`}>
                            <TaskCell
                              data={d}
                              taskNum={i + 1}
                              isActive={isActive}
                              isInHand={isInHand}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Footer legend ---- */}
      <div className="mlb-footer">
        <span className="mlb-legend-item">
          <span className="mlb-legend-task mlb-legend-task--s3">+3</span>
          с первой попытки
        </span>
        <span className="mlb-legend-item">
          <span className="mlb-legend-task mlb-legend-task--s2">+2</span>
          со второй
        </span>
        <span className="mlb-legend-item">
          <span className="mlb-legend-task mlb-legend-task--s1">+1</span>
          с третьей
        </span>
        <span className="mlb-legend-item">
          <span className="mlb-legend-task mlb-legend-task--fail">✕</span>
          провал
        </span>
        <span className="mlb-legend-item">
          <span className="mlb-legend-task mlb-legend-task--active">▶</span>
          в процессе (мигает)
        </span>
        {totalPossible > 0 && (
          <span style={{ marginLeft: 8, color: 'rgba(148,163,184,0.4)' }}>
            · решено {solvedCount} из {totalPossible}
          </span>
        )}
      </div>
    </div>
  );
}
