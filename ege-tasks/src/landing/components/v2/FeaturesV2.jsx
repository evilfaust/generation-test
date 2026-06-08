const FEATURES = [
  {
    num: '01',
    numColor: 'cyan',
    cardColor: 'cyan',
    title: 'Банк задач',
    desc: '17 000+ задач по темам ЕГЭ и ОГЭ с LaTeX-формулами, изображениями, тегами и сложностью. Импорт из «Решу ЕГЭ» в один клик с авто-нормализацией формул.',
    tags: [
      { label: 'LaTeX', color: 'cyan' },
      { label: 'Импорт «Решу ЕГЭ»', color: 'cyan' },
      { label: 'Фильтры', color: '' },
    ],
  },
  {
    num: '02',
    numColor: 'pink',
    cardColor: 'pink',
    title: 'Генератор работ',
    desc: '20+ форматов: устный счёт, контрольные, карточки, маршрутные листы, QR-листы, пиксель-арт, шифровки, марафон. Несколько вариантов за секунды, печать и PDF.',
    tags: [
      { label: '20+ форматов', color: 'pink' },
      { label: 'PDF / печать', color: 'pink' },
      { label: 'Drag & Drop', color: '' },
    ],
  },
  {
    num: '03',
    numColor: 'purple',
    cardColor: 'purple',
    title: 'Варианты ЕГЭ и ОГЭ',
    desc: 'Полные варианты КИМ: ЕГЭ базовый (21 задание), профильный (19, с критериями части 2) и ОГЭ (25, со связным блоком 1–5). Печать как в ФИПИ, лист ответов.',
    tags: [
      { label: 'КИМ-стиль', color: 'purple' },
      { label: 'Критерии', color: 'purple' },
      { label: 'ЕГЭ / ОГЭ', color: '' },
    ],
  },
  {
    num: '04',
    numColor: 'cyan',
    cardColor: 'cyan',
    title: 'Умный подбор',
    desc: 'Семантический поиск по смыслу задачи: «похожие», анти-дубль, параллельные варианты одинаковой сложности и адресная работа над ошибками класса.',
    tags: [
      { label: 'Похожие', color: 'cyan' },
      { label: 'Анти-дубль', color: 'cyan' },
      { label: 'Параллели', color: '' },
    ],
  },
  {
    num: '05',
    numColor: 'pink',
    cardColor: 'pink',
    title: 'Тестирование',
    desc: 'Ученики заходят по ссылке или QR-коду, решают тест. Авто-проверка, результаты в реальном времени, несколько попыток и проходной балл с дедлайнами.',
    tags: [
      { label: 'QR-код', color: 'pink' },
      { label: 'Авто-проверка', color: 'pink' },
      { label: 'Дедлайны', color: '' },
    ],
  },
  {
    num: '06',
    numColor: 'purple',
    cardColor: 'purple',
    title: 'Геометрия',
    desc: 'Отдельный модуль для задач с чертежами. GeoGebra-редактор прямо в браузере, экспорт в SVG, A5-листы для печати, сохранение наборов задач.',
    tags: [
      { label: 'GeoGebra', color: 'purple' },
      { label: 'SVG-чертежи', color: 'purple' },
      { label: 'A5-печать', color: '' },
    ],
  },
  {
    num: '07',
    numColor: 'cyan',
    cardColor: 'cyan',
    title: 'Теория и ТДФ',
    desc: 'Библиотека статей с формулами и чертежами. Конспекты теорем, определений и формул (ТДФ) с GeoGebra, плюс бланки для устного опроса.',
    tags: [
      { label: 'Конспекты', color: 'cyan' },
      { label: 'Опросники', color: 'cyan' },
      { label: 'GeoGebra', color: '' },
    ],
  },
  {
    num: '08',
    numColor: 'pink',
    cardColor: 'pink',
    title: 'Игровые форматы',
    desc: 'Вовлекающие работы: QR-листы (ответы складываются в QR-код), пиксель-арт по числам-ответам, шифровки и марафон защиты задач с живой доской результатов.',
    tags: [
      { label: 'QR-листы', color: 'pink' },
      { label: 'Пиксель-арт', color: 'pink' },
      { label: 'Марафон', color: '' },
    ],
  },
]

const ANALYTICS_ITEMS = [
  { icon: '📈', title: 'Динамика результатов', desc: 'График по всем попыткам ученика и класса' },
  { icon: '🔥', title: 'Тепловые карты ошибок', desc: 'Слабые темы по классу и каждому ученику' },
  { icon: '📋', title: 'Журнал, КТП и календарь', desc: 'Классы, оценки и планирование уроков' },
  { icon: '🎯', title: 'Работа над ошибками', desc: 'Адресные подборки по слабым темам' },
]

const ACH_PREVIEW = [
  { icon: '/achievements/icon010.png', rarity: 'common' },
  { icon: '/achievements/icon020.png', rarity: 'common' },
  { icon: '/achievements/icon025.png', rarity: 'rare' },
  { icon: '/achievements/icon035.png', rarity: 'rare' },
  { icon: '/achievements/icon045.png', rarity: 'legendary' },
]

const FeaturesV2 = () => (
  <section className="v2-features v2-section" id="features">
    <div className="v2-container">
      <div className="v2-section-header v2-reveal">
        <span className="v2-label">{'Возможности'}</span>
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          {'Всё для '}<span className="v2-gradient-text">{'ЕГЭ и ОГЭ'}</span>{' в одном месте'}
        </h2>
        <p>{'Полный набор инструментов учителя математики'}</p>
      </div>

      <div className="v2-bento v2-reveal">
        {FEATURES.map((f, i) => (
          <div key={i} className={`v2-bento-card v2-bento-card--${f.cardColor} v2-stagger`}>
            <div className={`v2-bento-num v2-bento-num--${f.numColor}`}>{f.num}</div>
            <h3 className="v2-bento-title">{f.title}</h3>
            <p className="v2-bento-desc">{f.desc}</p>
            <div className="v2-bento-tags">
              {f.tags.map((tag, j) => (
                <span key={j} className={`v2-bento-tag ${tag.color ? `v2-bento-tag--${tag.color}` : ''}`}>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Analytics + Achievements row */}
      <div className="v2-bento v2-reveal" style={{ marginTop: 16 }}>
        {/* Analytics card */}
        <div className="v2-bento-card v2-bento-card--analytics">
          <div className="v2-bento-num v2-bento-num--orange">09</div>
          <h3 className="v2-bento-title">{'Пространство учителя'}</h3>
          <p className="v2-bento-desc">
            {'Классы и группы, журнал оценок, КТП с экспортом в Word, календарь уроков, заметки и аналитика — вся рутина в одном рабочем месте.'}
          </p>
          <div className="v2-analytics-grid">
            {ANALYTICS_ITEMS.map((item, i) => (
              <div key={i} className="v2-analytics-item">
                <span className="v2-analytics-icon">{item.icon}</span>
                <div>
                  <div className="v2-analytics-title">{item.title}</div>
                  <div className="v2-analytics-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Wide achievement card */}
        <div className="v2-bento-card v2-bento-card--wide v2-bento-card--achievements">
          <div>
            <div className="v2-bento-num v2-bento-num--orange">10</div>
            <h3 className="v2-bento-title">{'Достижения'}</h3>
            <p className="v2-bento-desc">
              {'88 достижений трёх уровней редкости. Ученики собирают коллекцию и возвращаются к тренировкам чаще.'}
            </p>
          </div>
          <div>
            <div className="v2-bento-achievements">
              {ACH_PREVIEW.map((a, i) => (
                <div key={i} className={`v2-bento-ach-icon v2-bento-ach-icon--${a.rarity}`}>
                  <img src={a.icon} alt="Achievement" loading="lazy" />
                </div>
              ))}
              <div className="v2-bento-ach-more">+83</div>
            </div>
            <div className="v2-bento-rarity-legend">
              <span className="v2-bento-rarity-item">
                <span className="v2-bento-rarity-dot v2-bento-rarity-dot--common" />
                {'Обычные'}
              </span>
              <span className="v2-bento-rarity-item">
                <span className="v2-bento-rarity-dot v2-bento-rarity-dot--rare" />
                {'Редкие'}
              </span>
              <span className="v2-bento-rarity-item">
                <span className="v2-bento-rarity-dot v2-bento-rarity-dot--legendary" />
                {'Легендарные'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)

export default FeaturesV2
