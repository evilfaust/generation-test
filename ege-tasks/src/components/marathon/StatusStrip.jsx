import { useState, useMemo, useEffect, useRef } from 'react';

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

const MEDALS = ['🥇', '🥈', '🥉'];
const TIERS  = ['gold', 'silver', 'bronze'];

export default function StatusStrip({ students, tasks, trackingData }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const maxScore = tasks.length * 3;

  const ranking = useMemo(() => {
    return [...students]
      .map(name => {
        const data = trackingData[name] || {};
        let score = 0;
        for (let i = 0; i < tasks.length; i++) score += calcTaskScore(data[String(i)]);
        return { name, score };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ru'));
  }, [students, tasks, trackingData]);

  const kpi = useMemo(() => {
    if (!students.length || !tasks.length) return null;
    let totalSolved = 0;
    const scores = [];
    students.forEach(name => {
      const data = trackingData[name] || {};
      let s = 0;
      for (let i = 0; i < tasks.length; i++) {
        const d = data[String(i)];
        if (d?.solved) { totalSolved++; s += calcTaskScore(d); }
      }
      scores.push(s);
    });
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const pctSolved = students.length && tasks.length
      ? Math.round((totalSolved / (students.length * tasks.length)) * 100)
      : 0;
    return { totalSolved, avgScore: avg, pctSolved };
  }, [students, tasks, trackingData]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [open]);

  const top3 = ranking.slice(0, 3);
  const hasScores = top3.some(p => p.score > 0);

  return (
    <div className="status-strip" style={{ position: 'relative' }}>

      {/* KPIs */}
      <div className="ss-kpis">
        <div className="ss-kpi">
          <div className="lbl">Ср. счёт</div>
          <div className="val">
            {kpi ? kpi.avgScore.toFixed(1) : '0'}
            <span className="sub">/ {maxScore}</span>
          </div>
        </div>
        <div className="ss-kpi is-solved">
          <div className="lbl">Решено</div>
          <div className="val">{kpi?.pctSolved ?? 0}%</div>
          <div className="ss-mini-bar">
            <span style={{ width: `${kpi?.pctSolved ?? 0}%` }} />
          </div>
        </div>
        <div className="ss-kpi">
          <div className="lbl">Решений</div>
          <div className="val">{kpi?.totalSolved ?? 0}</div>
        </div>
      </div>

      {/* Podium */}
      <div className="ss-podium">
        <div className="ss-podium-label">🏆 Лидеры</div>
        <div className="ss-podium-row">
          {!hasScores ? (
            <span style={{ fontSize: 12.5, color: 'var(--ink-400)', fontStyle: 'italic' }}>
              Пока никто не набрал баллов
            </span>
          ) : (
            <>
              {top3.map((item, i) => item.score > 0 ? (
                <div key={item.name} className={`ss-chip ${TIERS[i]}`}>
                  <span className="medal">{MEDALS[i]}</span>
                  <span className="name">{item.name.split(' ')[0]}</span>
                  <span className="score">{item.score}</span>
                </div>
              ) : null)}
              {ranking.slice(3, 5).filter(r => r.score > 0).map((item, i) => (
                <div key={item.name} className="ss-rank">
                  <span className="pos">{i + 4}</span>
                  <span className="name">{item.name.split(' ')[0]}</span>
                  <span className="score">{item.score}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Expand → leaderboard popover */}
      <button
        className={`ss-expand${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Полный рейтинг"
      >
        <span>Весь рейтинг</span>
        <span className="chev" />
      </button>

      {open && (
        <div className="lb-popover" ref={popoverRef}>
          <div className="lb-popover__head">
            🏆 Лидерборд · {ranking.filter(r => r.score > 0).length} активных
          </div>
          <div className="lb-popover__list">
            {ranking.map((item, i) => {
              const pct = maxScore > 0 ? (item.score / maxScore) * 100 : 0;
              return (
                <div key={item.name} className="lb-row">
                  <span className="pos">
                    {i < 3 ? <span className="medal">{MEDALS[i]}</span> : i + 1}
                  </span>
                  <span className="name">{item.name}</span>
                  <span className="score">{item.score}</span>
                  <span className="bar"><span style={{ width: `${pct}%` }} /></span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
