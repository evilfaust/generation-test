import { useMemo, useCallback } from 'react';

function calcTaskScore(data) {
  if (!data || (!data.solved && !data.failed)) return 0;
  if (data.failed) return 0;
  if (data.solved) {
    const a = data.attempts || 0;
    return a === 0 ? 3 : a === 1 ? 2 : 1;
  }
  return 0;
}

const DIFF_CLASS = { 1: 'easy', 2: 'med', 3: 'hard' };
const DIFF_LABEL = { 1: 'Лёгкая', 2: 'Средняя', 3: 'Сложная' };

/* Для каждой задачи — список учеников, у которых она «на руках» и не завершена */
function buildQueueMap(students, tasks, trackingData) {
  return tasks.map((task, taskIdx) => {
    const entries = [];
    students.forEach(name => {
      const issued = trackingData[name]?._issued ?? 2;
      if (taskIdx >= issued) return; // карточка ещё не выдана
      const d = (trackingData[name] || {})[String(taskIdx)];
      if (!d?.solved && !d?.failed) {
        entries.push({
          name,
          attempts: d?.attempts || 0,
          data: d,
        });
      }
    });
    return { task, taskIdx, entries };
  });
}

export default function QueueBoard({ students, tasks, trackingData, setTrackingData, onSaveTracking }) {
  const queueMap = useMemo(
    () => buildQueueMap(students, tasks, trackingData),
    [students, tasks, trackingData]
  );

  const handleAttempt = useCallback((studentName, taskIdx, success) => {
    setTrackingData(prev => {
      const next = { ...prev };
      const sd = { ...(next[studentName] || {}) };
      const key = String(taskIdx);
      const cur = sd[key] || { attempts: 0, solved: false, failed: false };
      if (cur.solved || cur.failed) return prev;

      let updated;
      if (success) {
        updated = { ...cur, solved: true, _lastActivityAt: Date.now() };
      } else {
        const na = cur.attempts + 1;
        updated = { ...cur, attempts: na, failed: na >= 3, _lastActivityAt: Date.now() };
      }
      sd[key] = updated;
      next[studentName] = sd;
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
  }, [setTrackingData, onSaveTracking]);

  const activeTasks = queueMap.filter(q => q.entries.length > 0);

  if (!students.length || !tasks.length) {
    return (
      <div className="tg-empty">
        Добавьте учеников и задачи, затем инициализируйте трекер
      </div>
    );
  }

  if (activeTasks.length === 0) {
    return (
      <div className="tg-empty">
        Ни у кого нет незавершённых карточек на руках
      </div>
    );
  }

  return (
    <div className="queue-board">
      {activeTasks.map(({ task, taskIdx, entries }) => {
        const diffClass = DIFF_CLASS[task.difficulty] || '';
        return (
          <div key={taskIdx} className="qb-card">
            <div className={`qb-card-head diff-${diffClass}`}>
              <span className={`task-num ${diffClass}`}>{taskIdx + 1}</span>
              <span className="qb-card-head__title">
                {DIFF_LABEL[task.difficulty] || '?'}
              </span>
              <span className="qb-card-head__code">{task.code}</span>
              <span className="qb-card-head__count">{entries.length} чел.</span>
            </div>
            <div className="qb-card-body">
              {entries.map(({ name, attempts }) => (
                <div key={name} className="qb-student">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                    {attempts > 0 && (
                      <div className="att" style={{ color: 'var(--fail)' }}>
                        {attempts} {attempts === 1 ? 'неудача' : 'неудачи'}
                      </div>
                    )}
                  </div>
                  <div className="actions">
                    <button
                      className="qbtn ok"
                      onClick={() => handleAttempt(name, taskIdx, true)}
                      title="Решено"
                    >✓</button>
                    <button
                      className="qbtn ng"
                      onClick={() => handleAttempt(name, taskIdx, false)}
                      disabled={attempts >= 3}
                      title="Неудача"
                    >✗</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
