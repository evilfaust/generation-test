import { useState, useMemo, useEffect } from 'react';

const DIFF_CLASS = { 1: 'easy', 2: 'med', 3: 'hard' };

export default function QueueStrip({ students, tasks, trackingData, setTrackingData, onSaveTracking }) {
  const [addOpen, setAddOpen] = useState(false);

  const queue = useMemo(() => {
    return students
      .filter(name => trackingData[name]?._queueAt)
      .map(name => {
        const issued = trackingData[name]?._issued ?? 2;
        const handCards = [];
        for (let i = 0; i < Math.min(issued, tasks.length); i++) {
          const d = (trackingData[name] || {})[String(i)];
          if (!d?.solved && !d?.failed) handCards.push({ idx: i, task: tasks[i] });
        }
        return { name, queueAt: trackingData[name]._queueAt, handCards };
      })
      .sort((a, b) => a.queueAt - b.queueAt);
  }, [students, tasks, trackingData]);

  const available = students.filter(name => !trackingData[name]?._queueAt);
  const hasQueue = queue.length > 0;

  const handleEnqueue = (studentName) => {
    setTrackingData(prev => {
      const next = { ...prev, [studentName]: { ...prev[studentName], _queueAt: Date.now() } };
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
    setAddOpen(false);
  };

  const handleDequeue = (studentName) => {
    setTrackingData(prev => {
      const sd = { ...prev[studentName] };
      delete sd._queueAt;
      const next = { ...prev, [studentName]: sd };
      if (onSaveTracking) onSaveTracking(next);
      return next;
    });
  };

  useEffect(() => {
    if (!addOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setAddOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addOpen]);

  return (
    <div className={`queue-strip${hasQueue ? ' has-queue' : ''}`}>
      <div className="queue-strip__row">

        {/* Заголовок */}
        <div className="queue-strip__head">
          <div className="queue-strip__icon">{hasQueue ? '✋' : '👋'}</div>
          <div className="queue-strip__title">
            <span>
              Очередь к учителю
              {hasQueue && <span className="queue-strip__count-badge">{queue.length}</span>}
            </span>
            <span className="sub">
              {hasQueue
                ? 'Ученики ждут проверки — нажмите ✓ когда примите'
                : 'Никто не ждёт'}
            </span>
          </div>
        </div>

        {/* Чипы очереди */}
        <div className="queue-strip__chips">
          {hasQueue ? queue.map((item, idx) => (
            <div key={item.name} className="q-chip">
              <span className="pos">{idx + 1}</span>
              <span className="name">{item.name.split(' ')[0]}</span>
              {item.handCards.length > 0 && (
                <span className="cards">
                  {item.handCards.map(({ idx: tIdx, task }) => (
                    <span
                      key={tIdx}
                      className={`qcard ${DIFF_CLASS[task?.difficulty] || ''}`}
                      title={task?.code}
                    >
                      {tIdx + 1}
                    </span>
                  ))}
                </span>
              )}
              <button
                className="accept"
                onClick={() => handleDequeue(item.name)}
                title="Принять"
              >✓</button>
            </div>
          )) : (
            <span className="queue-strip__empty">Очередь пуста</span>
          )}
        </div>

        {/* Добавить вручную */}
        <div className="queue-strip__add">
          <button
            className="queue-strip__add-btn"
            onClick={() => setAddOpen(o => !o)}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            Добавить
          </button>
          {addOpen && (
            <>
              <div className="backdrop" onClick={() => setAddOpen(false)} />
              <div className="queue-strip__add-pop">
                <div className="head">Поставить в очередь ({available.length})</div>
                <div className="grid">
                  {available.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>
                      Все ученики уже в очереди
                    </span>
                  ) : available.map(name => (
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
            </>
          )}
        </div>

      </div>
    </div>
  );
}
