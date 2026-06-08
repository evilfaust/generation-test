const CHECKLIST = [
  'Темы по кодификатору ЕГЭ и ОГЭ',
  'Импорт задач с «Решу ЕГЭ»',
  'Семантический поиск похожих задач',
  'Полные варианты КИМ ЕГЭ и ОГЭ',
  'Журнал, КТП и календарь уроков',
  'PDF-экспорт и печать из браузера',
]

const TestimonialsV2 = () => (
  <section className="v2-testimonials v2-section">
    <div className="v2-container">
      <div className="v2-section-header v2-reveal">
        <span className="v2-label">{'О проекте'}</span>
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          {'Создано '}<span className="v2-gradient-text">{'учителем'}</span>{' для учителей'}
        </h2>
      </div>

      <div className="v2-testimonial-card v2-reveal">
        <p className="v2-testimonial-quote">
          {'Разработано практикующим учителем математики. Каждая функция проверена на реальных уроках и создана для решения конкретных задач преподавания.'}
        </p>

        <div className="v2-checklist">
          {CHECKLIST.map((item, i) => (
            <div key={i} className="v2-checklist-item v2-stagger">
              <span className="v2-checklist-dot" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
)

export default TestimonialsV2
