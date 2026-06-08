import { useEffect, useRef, useState } from 'react'

const STATS = [
  { value: 17000, suffix: '+', label: '\u0437\u0430\u0434\u0430\u0447 \u0432 \u0431\u0430\u0437\u0435', color: 'cyan' },
  { value: 88, suffix: '', label: '\u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0439', color: 'pink' },
  { value: 20, suffix: '+', label: '\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u0432', color: 'purple' },
  { value: 3, suffix: '', label: '\u043C\u0438\u043D\u0443\u0442\u044B \u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u0443', color: 'orange' },
]

function animateCount(start, end, duration, callback) {
  const startTime = performance.now()
  const step = (now) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 4)
    callback(Math.round(start + (end - start) * eased))
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const StatItem = ({ value, suffix, label, color }) => {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
          animateCount(0, value, 2000, setCount)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, started])

  return (
    <div className="v2-stat v2-stagger" ref={ref}>
      <div className={`v2-stat-number v2-stat-number--${color}`}>
        {count}<span>{suffix}</span>
      </div>
      <div className="v2-stat-label">{label}</div>
    </div>
  )
}

const StatsV2 = () => (
  <section className="v2-stats v2-reveal">
    <div className="v2-container">
      <div className="v2-stats-grid">
        {STATS.map((stat, i) => (
          <StatItem key={i} {...stat} />
        ))}
      </div>
    </div>
  </section>
)

export default StatsV2
