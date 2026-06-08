const METRICS = [
  {
    title: 'Динамика по попыткам',
    desc: 'График показывает рост или просадку по каждому ученику и по классу в целом.',
  },
  {
    title: 'Тепловые карты ошибок',
    desc: 'Сетка «ученик × задание» с цветом по проценту верных — видно слабые темы и точечный разбор. Учитываются и внешние работы «Решу ЕГЭ».',
  },
  {
    title: 'Точечная доработка',
    desc: 'Учитель сразу видит слабые темы и одной кнопкой собирает адресную работу над ошибками под конкретных учеников.',
  },
]

const BARS = [
  { label: 'Неделя 1', value: 42 },
  { label: 'Неделя 2', value: 56 },
  { label: 'Неделя 3', value: 67 },
  { label: 'Неделя 4', value: 78 },
  { label: 'Неделя 5', value: 84 },
]

const PROBLEM_TASKS = [
  { code: '14-031', wrongRate: '62%' },
  { code: '16-112', wrongRate: '57%' },
  { code: '17-048', wrongRate: '49%' },
]

const ProgressInsightsV2 = () => (
  <section className="v2-progress v2-section" id="progress">
    <div className="v2-progress-bg" />
    <div className="v2-container">
      <div className="v2-section-header v2-reveal">
        <span className="v2-label">Аналитика прогресса</span>
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          Учитель видит не только <span className="v2-gradient-text">балл</span>, но и причину ошибок
        </h2>
        <p>
          Встроенная панель прогресса фиксирует динамику ученика и выделяет проблемные задачи.
          Это даёт основу для точной работы: что повторить, кому дать индивидуальный вариант, где класс теряет баллы.
        </p>
      </div>

      <div className="v2-progress-layout v2-reveal">
        <div className="v2-progress-board v2-stagger">
          <div className="v2-progress-board-head">
            <span>Динамика ученика</span>
            <span className="v2-progress-pill">+42% за 5 недель</span>
          </div>

          <div className="v2-progress-chart">
            {BARS.map((bar) => (
              <div key={bar.label} className="v2-progress-bar-item">
                <div className="v2-progress-bar-track">
                  <div className="v2-progress-bar-fill" style={{ height: `${bar.value}%` }} />
                </div>
                <span>{bar.label}</span>
              </div>
            ))}
          </div>

          <div className="v2-progress-problems">
            <div className="v2-progress-problems-title">Проблемные задачи</div>
            {PROBLEM_TASKS.map((task) => (
              <div key={task.code} className="v2-problem-row">
                <span>{task.code}</span>
                <span>{task.wrongRate} ошибок</span>
              </div>
            ))}
          </div>
        </div>

        <div className="v2-progress-cards">
          {METRICS.map((metric) => (
            <article key={metric.title} className="v2-progress-card v2-stagger">
              <h3>{metric.title}</h3>
              <p>{metric.desc}</p>
            </article>
          ))}
          <a href="/how-it-works.html" className="v2-progress-link v2-stagger">
            Открыть страницу «Как работает приложение» →
          </a>
        </div>
      </div>
    </div>
  </section>
)

export default ProgressInsightsV2
