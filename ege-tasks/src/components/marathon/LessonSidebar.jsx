import { useMemo } from 'react';
import { Popconfirm } from 'antd';

/* ================================================================
   Score helpers (дублируем локально, чтобы не создавать shared-файл)
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
  const data = trackingData[name] || {};
  let total = 0;
  for (let i = 0; i < taskCount; i++) total += calcTaskScore(data[String(i)]);
  return total;
}

const DIFF_CLASS = { 1: 'easy', 2: 'med', 3: 'hard' };

/* ================================================================
   LessonSidebar
   ================================================================ */

export default function LessonSidebar({
  students,
  tasks,
  trackingData,
  setTrackingData,
  onSaveTracking,
}) {
  const taskCount = tasks.length;

  /* ---- Ranking ---- */
  const ranking = useMemo(() => {
    return [...students]
      .map(name => ({ name, score: calcTotalScore(name, trackingData, taskCount) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ru'));
  }, [students, trackingData, taskCount]);

  const maxScore = taskCount * 3;

  /* ---- KPI ---- */
  const kpi = useMemo(() => {
    if (!students.length || !taskCount) return null;

    let totalSolved = 0;
    let totalAttempts = 0;
    const scores = [];

    students.forEach(name => {
      const data = trackingData[name] || {};
      let s = 0;
      for (let i = 0; i < taskCount; i++) {
        const d = data[String(i)];
        if (d?.solved) { totalSolved++; s += calcTaskScore(d); }
        if (d?.attempts) totalAttempts += d.attempts;
      }
      scores.push(s);
    });

    const avgScore = scores.length
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : 0;
    const pctSolved = totalAttempts > 0
      ? Math.round((totalSolved / (students.length * taskCount)) * 100)
      : 0;
    const leader = ranking[0];

    return { totalSolved, avgScore, pctSolved, leader };
  }, [students, tasks, trackingData, ranking]);

  /* ---- Queue (students with _queueAt set) ---- */
  const queue = useMemo(() => {
    return students
      .filter(name => trackingData[name]?._queueAt)
      .map(name => {
        const issued = trackingData[name]?._issued ?? 2;
        const handCards = [];
        for (let i = 0; i < Math.min(issued, taskCount); i++) {
          const d = (trackingData[name] || {})[String(i)];
          if (!d?.solved && !d?.failed) handCards.push({ idx: i, task: tasks[i] });
        }
        return { name, queueAt: trackingData[name]._queueAt, handCards };
      })
      .sort((a, b) => a.queueAt - b.queueAt);
  }, [students, trackingData, tasks, taskCount]);

  /* ---- Handle queue actions ---- */

  const handleEnqueue = (studentName) => {
    setTrackingData(prev => {
      const next = { ...prev };
      next[studentName] = { ...next[studentName], _queueAt: Date.now() };
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
  };

  const handleDequeue = (studentName) => {
    setTrackingData(prev => {
      const next = { ...prev };
      const sd = { ...next[studentName] };
      delete sd._queueAt;
      next[studentName] = sd;
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
  };

  if (!students.length) return null;

  /* ---- Render ---- */

  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3, 10);

  return (
    <div className="side-panel">
      {/* ---- KPI row ---- */}
      {kpi && (
        <div className="kpi-row">
          <div className="kpi">
            <div className="lbl">Ср. счёт</div>
            <div className="val">{kpi.avgScore}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Решено</div>
            <div className="val is-progress">{kpi.pctSolved}%</div>
          </div>
          <div className="kpi">
            <div className="lbl">Решений</div>
            <div className="val">{kpi.totalSolved}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Лидер</div>
            <div className="val" style={{ fontSize: 14, paddingTop: 4 }}>
              {kpi.leader?.name?.split(' ')[0] || '—'}
            </div>
          </div>
        </div>
      )}

      {/* ---- Leaderboard ---- */}
      <div className="side-card">
        <div className="side-card-head">
          🏆 Лидерборд
        </div>
        <div className="side-card-body" style={{ padding: 0 }}>
          {/* Podium top-3 */}
          {podium.length >= 1 && (
            <div className="podium">
              {/* Silver (2nd) */}
              {podium[1] ? (
                <div className="col silver">
                  <div className="medal">🥈</div>
                  <div className="pname">{podium[1].name.split(' ')[0]}</div>
                  <div className="ppts">{podium[1].score}</div>
                </div>
              ) : <div />}
              {/* Gold (1st) */}
              <div className="col gold">
                <div className="medal">🥇</div>
                <div className="pname">{podium[0].name.split(' ')[0]}</div>
                <div className="ppts">{podium[0].score}</div>
              </div>
              {/* Bronze (3rd) */}
              {podium[2] ? (
                <div className="col bronze">
                  <div className="medal">🥉</div>
                  <div className="pname">{podium[2].name.split(' ')[0]}</div>
                  <div className="ppts">{podium[2].score}</div>
                </div>
              ) : <div />}
            </div>
          )}

          {/* Rest of ranking */}
          {rest.length > 0 && (
            <div style={{ padding: '4px 12px 10px' }}>
              {rest.map((item, i) => (
                <div key={item.name} className="side-rank-row">
                  <span className="side-rank-pos">{i + 4}</span>
                  <span className="side-rank-name">{item.name}</span>
                  <span className="side-rank-score">{item.score}</span>
                  <div className="side-rank-bar">
                    <span style={{ width: maxScore > 0 ? `${(item.score / maxScore) * 100}%` : '0%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Queue to teacher ---- */}
      <div className="side-card">
        <div className="side-card-head" style={{ justifyContent: 'space-between' }}>
          <span>👋 Очередь к учителю</span>
          <span style={{ fontSize: 11, color: 'var(--ink-400)', fontWeight: 500 }}>
            {queue.length} чел.
          </span>
        </div>
        <div className="side-card-body" style={{ padding: queue.length ? '8px 12px' : '12px' }}>
          {queue.length === 0 ? (
            <div style={{ color: 'var(--ink-300)', fontSize: 12, textAlign: 'center' }}>
              Очередь пуста
            </div>
          ) : (
            <div className="queue-list">
              {queue.map((item, idx) => (
                <div key={item.name} className="queue-item">
                  <span className="qpos">{idx + 1}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-900)' }}>
                      {item.name}
                    </div>
                    <div className="qcards">
                      {item.handCards.map(({ idx: tIdx, task }) => (
                        <span
                          key={tIdx}
                          className={`qcard ${DIFF_CLASS[task?.difficulty] || ''}`}
                          title={task?.code}
                        >
                          {tIdx + 1}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn-accept"
                    onClick={() => handleDequeue(item.name)}
                    title="Принял"
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Кнопки «В очередь» для остальных учеников */}
          <div style={{ marginTop: 10, borderTop: '1px dashed var(--ink-200)', paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 6 }}>
              Добавить в очередь:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {students
                .filter(name => !trackingData[name]?._queueAt)
                .map(name => (
                  <button
                    key={name}
                    className="btn-enqueue"
                    onClick={() => handleEnqueue(name)}
                  >
                    {name.split(' ')[0]}
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
