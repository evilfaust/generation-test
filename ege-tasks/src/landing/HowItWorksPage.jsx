import React, { useEffect, useState } from 'react'
import { APP_VERSION, BUILD_DATE } from '@shared/version/buildInfo'

/* ─── static data ─── */

const formatDate = (iso) => iso ? iso.slice(0, 10) : ''

const HERO_FACTS = [
  { value: '7 000+', label: 'Задач в базе по всем темам ЕГЭ', color: 'cyan' },
  { value: '6+', label: 'Форматов работы: карточки, контрольные, маршрутные листы, QR-листы, pixel art', color: 'pink' },
  { value: '72', label: 'Достижения трёх уровней редкости для мотивации', color: 'purple' },
  { value: '100+', label: 'API-методов для работы с данными', color: 'orange' },
]

const CORE_MODULES = [
  {
    num: '01', color: 'cyan', wide: true,
    title: 'Управление задачами',
    desc: 'Полный контроль над базой ЕГЭ. Фильтрация по темам, подтемам, тегам, сложности, источникам, годам и наличию изображений. Массовые операции: добавление/замена тегов, изменение сложности и источника, удаление.',
    details: [
      'Поддержка LaTeX (KaTeX) и Markdown (GFM) с мгновенным предпросмотром',
      'Три способа добавления изображений: ссылка, файл, рисование в GeoGebra',
      'Обрезка изображений: слайдеры по 4 сторонам с визуальным предпросмотром',
      'Уникальные коды задач (14-001, M17-003), цветовые теги',
      'Импорт из Markdown-файлов и парсинг sdamgia.ru',
    ],
    tags: ['LaTeX & Markdown', 'GeoGebra Crop', 'Sdamgia Parser', 'Импорт YAML'],
  },
  {
    num: '02', color: 'pink',
    title: 'Генератор карточек',
    desc: 'Случайная выборка задач по критериям с мгновенной печатью. Подходит для карточек, маршрутных листов и других коротких печатных форматов.',
    details: [
      'Три формата: A6 (4 на лист), A5 (2 на лист), A4 (1 на лист)',
      'Автоматический лист с ответами',
      'Настраиваемый шрифт: 10–21px',
      'Сохранение карточек в БД',
    ],
    tags: ['A4/A5/A6', 'Ответы', 'PDF'],
  },
  {
    num: '03', color: 'purple',
    title: 'Генератор «Устный счёт»',
    desc: 'Распределение задач по тегам или сложности с точным контролем количества. Быстрое создание устного счёта, карточек и маршрутных листов.',
    details: [
      'Grid layout: 1–3 варианта на странице A4',
      'Drag & Drop задач внутри и между вариантами',
      'Фильтр типовых префиксов («Вычислите:», «Найдите…»)',
      'Горизонтальная раскладка + компактный режим',
      'Автоматическая прогрессия сложности',
    ],
    tags: ['Распределение', 'Drag & Drop', 'Компакт'],
  },
  {
    num: '04', color: 'orange', wide: true,
    title: 'Контрольные работы',
    desc: 'Мощный конструктор структуры с блоками задач из разных тем. Независимые фильтры для каждого блока. Три режима генерации: уникальные задачи / одинаковые с перемешиванием / одинаковые. Подходит и для печатных worksheets с нестандартной подачей.',
    details: [
      'Прогрессия сложности (опционально)',
      'Drag & Drop задач между вариантами + перемещение',
      'Замена и редактирование задач прямо в варианте',
      'Сохранение/загрузка работ из БД',
      'Настройки: колонки (1–3), шрифт (10–20pt), компактный режим, поля для ФИО',
    ],
    tags: ['Мульти-тема', '3 режима', 'Work Editor', 'PDF'],
  },
  {
    num: '05', color: 'orange',
    title: 'Маршрутные листы и Pixel Art',
    desc: 'Нестандартные форматы для вовлекающих уроков и самостоятельной работы: маршрутные листы, QR-механики и pixel art worksheets.',
    details: [
      'Маршрутные листы для пошаговой самостоятельной работы',
      'QR-листы с игровым сценарием проверки',
      'Pixel art worksheets с изображением, сеткой и ключом учителя',
      'Печать и сохранение готовых шаблонов',
    ],
    tags: ['Pixel Art', 'Маршруты', 'Печать'],
  },
  {
    num: '06', color: 'cyan',
    title: 'Модуль геометрии',
    desc: 'Отдельный раздел с полной интеграцией GeoGebra и системой ТДФ.',
    details: [
      'Сохранение состояния .ggb + экспорт PNG с обрезкой',
      'Два режима списка: таблица и карточки',
      'Визуальное A5-макетирование: drag&resize «Дано» и «Чертёж»',
      'Печатные листы A5 (6 задач/страница) с drag&drop порядка',
      'ТДФ — конспекты Теорем, Определений, Формул (7 типов: Теорема, Определение, Формула, Аксиома, Свойство, Признак, Следствие)',
      'Печать ТДФ A4: эталонный конспект + бланки вариантов для учеников',
    ],
    tags: ['GeoGebra', 'A5 Print', 'PNG Export', 'ТДФ'],
  },
  {
    num: '07', color: 'pink',
    title: 'Модуль теории',
    desc: 'Каталог теоретических конспектов с полноценным редактором.',
    details: [
      'Monaco Editor с кастомной Toolbar: заголовки, списки, таблицы, формулы',
      '5 тем оформления: от академической LaTeX до скетчбука Moleskine',
      'TOC sidebar с IntersectionObserver',
      'Конструктор конспектов для печати с выбором статей',
    ],
    tags: ['Monaco', '5 тем', 'Печать конспектов'],
  },
]

const TEACHER_FEATURES = [
  'StudentProgressDashboard с динамикой оценок и блоком «Проблемные задачи»',
  'Генерация сессионных ссылок и QR-кодов для раздачи классу',
  'Ручное распределение достижений ученикам',
  'Аналитика: распределение задач по темам, тегам, сложности, источникам',
  'Каталог справочников с CRUD, обнаружением и объединением дублей',
  'Облако тегов с переходом к задачам',
  'Архивирование работ без удаления данных',
]

const STUDENT_FEATURES = [
  'Вход по ссылке /student/{sessionId} — ничего лишнего',
  'Регистрация: имя + логин + пароль (PocketBase Auth)',
  'Автосохранение промежуточных ответов в localStorage',
  'Галерея достижений (common / rare / legendary)',
  'Привязка гостевых попыток к аккаунту',
  'Страница прогресса: история и статистика по всем сессиям',
  'Защита от читерства: round-robin вариантов',
]

const FLOW_STEPS = [
  { num: '01', title: 'Создание варианта', text: 'Учитель конструирует работу: настраивает фильтры, уровень сложности и количество вариантов. Задачи подбираются автоматически или вручную.', side: 'teacher' },
  { num: '02', title: 'Выдача сессии', text: 'Активация работы. Система генерирует короткую ссылку и QR-код для раздачи классу (вида /student/{id}). Можно настроить заголовок и включить достижения.', side: 'teacher' },
  { num: '03', title: 'Прохождение теста', text: 'Ученики открывают ссылку с телефона, регистрируются и получают вариант (round-robin распределение). Решают задачи, ответы автосохраняются.', side: 'student' },
  { num: '04', title: 'Автоматическая проверка', text: 'При отправке ответов сервер проверяет их: числовое сравнение с epsilon (1e-6), дроби (1/3), LaTeX-дроби (\\frac{1}{3}), альтернативы через «|». Моментальный результат.', side: 'student' },
  { num: '05', title: 'Система наград', text: 'Achievement Engine выдает случайные значки по проценту решаемости (90%+ → Legendary, 70–89% → Rare, 40–69% → Common) и условные достижения (скорость, кол-во попыток, время суток).', side: 'student' },
  { num: '06', title: 'Анализ результатов', text: 'Учитель видит статистику: средний балл, «проблемные задачи» класса. Может выдать достижения вручную и разрешить повторную попытку точечно.', side: 'teacher' },
]

const ACHIEVEMENTS_DATA = {
  total: 72,
  random: [
    { rarity: 'legendary', label: 'Легендарные', condition: '90%+ правильных', color: '#ffbe0b', examples: 'Железный человек, Джедай, Титан' },
    { rarity: 'rare', label: 'Редкие', condition: '70–89% правильных', color: '#8338ec', examples: 'Алхимик, Стратег, Мастер' },
    { rarity: 'common', label: 'Обычные', condition: '40–69% правильных', color: '#06d6a0', examples: 'Первые шаги, Упрямый, Искатель' },
  ],
  conditional: [
    { icon: '🎯', name: 'По результату', desc: '100% правильных, 90%+ правильных' },
    { icon: '⚡', name: 'По скорости', desc: 'За 5 минут, за 3 минуты' },
    { icon: '🔢', name: 'По количеству', desc: '1-я, 3-я, 10-я, 50-я, 100-я попытка' },
    { icon: '🌙', name: 'Специальные', desc: 'Ночная сова (после 22:00), ранняя пташка (до 08:00), воин выходных (сб/вс)' },
  ],
}

const TECH_STACK = [
  {
    title: 'Frontend Core',
    items: [
      { name: 'React', ver: '18.2', note: 'UI библиотека' },
      { name: 'Vite', ver: '5.0', note: 'Multi-page сборщик (3 entry points)' },
      { name: 'Ant Design', ver: '5.12', note: 'UI компоненты учителя' },
      { name: 'PocketBase SDK', ver: '0.21', note: 'API клиент' },
    ],
  },
  {
    title: 'Рендеринг & Редакторы',
    items: [
      { name: 'KaTeX', ver: '0.16.9', note: 'LaTeX формулы' },
      { name: 'react-markdown', ver: '10.1', note: 'Markdown + GFM' },
      { name: 'Monaco Editor', ver: '4.7', note: 'Редактор теории (lazy)' },
      { name: 'DOMPurify', ver: '3.3', note: 'HTML-санитизация' },
    ],
  },
  {
    title: 'Backend & Сервисы',
    items: [
      { name: 'PocketBase', ver: '0.36.4', note: 'SQLite + Auth + RLS + Files' },
      { name: 'Express.js', ver: '', note: 'backend-сервис: sdamgia + LaTeX + вектор' },
      { name: 'html2pdf.js', ver: '0.14', note: 'клиентский PDF-экспорт' },
      { name: 'Cheerio', ver: '', note: 'HTML-парсинг' },
    ],
  },
  {
    title: 'Инфраструктура',
    items: [
      { name: 'nginx', ver: '', note: 'Reverse proxy + SSL' },
      { name: 'Let\'s Encrypt', ver: '', note: 'Автоматические сертификаты' },
      { name: 'systemd', ver: '', note: '3 сервиса на VPS' },
      { name: 'Telegram Bot', ver: '', note: 'Мониторинг + статистика' },
    ],
  },
]

const DB_COLLECTIONS = [
  { group: 'Задачи', items: [
    { name: 'tasks', desc: 'Основные задачи ЕГЭ', fields: 'code, topic, subtopic[], tags, difficulty, statement_md, answer, solution_md, image', rel: 'topics, subtopics, tags' },
    { name: 'geometry_tasks', desc: 'Задачи геометрии', fields: 'code, geogebra_base64, geogebra_image (file), preview_layout', rel: 'geometry_topics, geometry_subtopics' },
  ]},
  { group: 'Справочники', items: [
    { name: 'topics', desc: 'Темы ЕГЭ', fields: 'title, section, ege_number, order, slug', rel: '—' },
    { name: 'subtopics', desc: 'Подтемы', fields: 'name, order', rel: 'topics' },
    { name: 'tags', desc: 'Теги с цветами', fields: 'title, color (hex)', rel: '—' },
  ]},
  { group: 'Работы & Варианты', items: [
    { name: 'works', desc: 'Контрольные/самостоятельные', fields: 'title, class, time_limit', rel: 'topics' },
    { name: 'variants', desc: 'Варианты работ', fields: 'number, order (json)', rel: 'works, tasks[]' },
    { name: 'cards', desc: 'Сохранённые карточки', fields: 'format (А6/А5/А4), layout', rel: 'tasks[]' },
  ]},
  { group: 'Тестирование', items: [
    { name: 'students', desc: 'Auth-коллекция учеников', fields: 'username, name, student_class', rel: '—' },
    { name: 'work_sessions', desc: 'Сессии тестирования', fields: 'is_open, achievements_enabled', rel: 'works' },
    { name: 'attempts', desc: 'Попытки учеников', fields: 'status, score, total, duration_seconds', rel: 'sessions, students, variants, achievements[]' },
    { name: 'attempt_answers', desc: 'Ответы по задачам', fields: 'answer_raw, answer_normalized, is_correct', rel: 'attempts, tasks' },
  ]},
  { group: 'Достижения & Теория', items: [
    { name: 'achievements', desc: '72 достижения', fields: 'type (random/condition), rarity, condition_type', rel: '—' },
    { name: 'theory_categories', desc: 'Категории теории', fields: 'title, color, order', rel: '—' },
    { name: 'theory_articles', desc: 'Статьи теории', fields: 'content_md (100K символов), theme_settings', rel: 'theory_categories' },
  ]},
]

const API_GROUPS = [
  { name: 'Tasks', count: 10, desc: 'CRUD + getRandomTasks, getTasksWithProgressiveDifficulty, getTaskStatementsAndCodes' },
  { name: 'Works & Variants', count: 12, desc: 'CRUD + archive/unarchive, getVariantsByWork' },
  { name: 'Sessions & Attempts', count: 18, desc: 'createSession, createAttempt, getAttemptsByStudentAll, batchCreateAttemptAnswers' },
  { name: 'Achievements', count: 6, desc: 'CRUD + getAchievementsByIds' },
  { name: 'Students', count: 8, desc: 'register, login, logout, getStudents, updateStudent' },
  { name: 'Geometry', count: 15, desc: 'Tasks, topics, subtopics, print tests, getGeometryImageUrl' },
  { name: 'Theory', count: 10, desc: 'Articles, categories, getArticleCountByCategory' },
  { name: 'Stats & Catalog', count: 12, desc: 'Topics, subtopics, tags, getTasksStatsSnapshot, getTasksForDuplicateCheck' },
  { name: 'References', count: 8, desc: 'Cached in ReferenceDataContext — topics, tags, years, sources, snapshot' },
]

const VPS_ARCH = [
  { service: 'PocketBase', port: '8095', systemd: 'pocketbase-ege', desc: 'Backend API + Auth + Files + SQLite' },
  { service: 'Helper Service', port: '3001', systemd: 'pdf-service-ege', desc: 'sdamgia parser + LaTeX LLM + векторный поиск' },
  { service: 'Telegram Bot', port: '—', systemd: 'telegram-bot-ege', desc: 'Мониторинг VPS + статистика БД' },
]

const VERSION_MILESTONES = [
  { ver: '1.0', date: 'Январь 2026', title: 'Первый релиз', desc: 'Генераторы карточек и устного счёта, управление задачами, LaTeX, фильтрация, PDF экспорт', color: 'cyan' },
  { ver: '1.5', date: 'Январь 2026', title: 'PDF + Теория', desc: 'Puppeteer PDF-сервис, модуль теории (5 компонентов), Monaco Editor, создание задач через UI', color: 'cyan' },
  { ver: '2.0', date: 'Февраль 2026', title: 'Контрольные работы', desc: 'TestWorkGenerator, 3 режима генерации, drag&drop, архитектурные хуки (useWorksheetGeneration, useTaskDragDrop)', color: 'pink' },
  { ver: '3.0', date: 'Февраль 2026', title: 'Студенческий интерфейс', desc: 'Полный поток тестирования: авторизация → тест → автопроверка → результаты. WorkEditor, SessionPanel, QR-коды', color: 'purple' },
  { ver: '3.1', date: 'Февраль 2026', title: 'Достижения', desc: '30 (→ 72) достижений, авторизация учеников, StudentProgressDashboard, polling наград', color: 'orange' },
  { ver: '3.3', date: 'Февраль 2026', title: 'Редизайн теории', desc: '5 тем оформления, rich toolbar, TOC sidebar, drag-and-drop категорий, TableInsertPopover', color: 'pink' },
  { ver: '3.4', date: 'Февраль 2026', title: 'VPS миграция', desc: 'PocketBase на VPS (task-ege.oipav.ru), nginx, SSL, автобэкапы каждые 6 часов, Telegram-бот', color: 'cyan' },
  { ver: '3.6', date: 'Февраль 2026', title: 'Геометрия + Лендинг', desc: 'GeoGebra-интеграция, A5-макетирование, student.oipav.ru, лендинг (V1 → V2 neon)', color: 'purple' },
  { ver: '3.7', date: 'Март 2026', title: 'Рефакторинг', desc: 'CropModal, decomposition хуков, оптимизация загрузки (snapshot, lazy duplicate check), 72 ачивки', color: 'orange' },
  { ver: '3.8', date: 'Март 2026', title: 'ТДФ + Экспорт MD', desc: 'Модуль ТДФ (Теоремы, Определения, Формулы) с конспектами и вариантами, экспорт в Markdown, объединение аккаунтов учеников', color: 'cyan' },
  { ver: '3.9', date: 'Март 2026', title: 'ТДФ — улучшения', desc: 'Реструктуризация печатного вида (объединение Тема+Формулировка, вертикальная метка типа), новый тип «Следствие»', color: 'orange' },
  { ver: '4.0', date: 'Апрель 2026', title: 'Новые форматы работ', desc: 'Маршрутные листы, QR-механики и pixel art worksheets для более игровых и визуальных сценариев урока', color: 'pink' },
]

const ANSWER_CHECKER_FEATURES = [
  { icon: '🔢', title: 'Числовое сравнение', desc: 'Epsilon = 1e-6 для учёта погрешности вычислений' },
  { icon: '½', title: 'Дроби', desc: 'Парсинг 1/3, \\frac{1}{3}, смешанных дробей' },
  { icon: '|', title: 'Альтернативы', desc: 'Несколько правильных ответов через разделитель «|»' },
  { icon: 'Aa', title: 'Текстовый fallback', desc: 'Для нечисловых ответов — точное строковое сравнение' },
]

const TEACHER_NAV = [
  { key: 'tasks', label: 'Все задачи', comp: 'TaskList' },
  { key: 'stats', label: 'Аналитика', comp: 'TaskStatsDashboard' },
  { key: 'catalog', label: 'Каталог', comp: 'TaskCatalogManager' },
  { key: 'generator', label: 'Устный счёт', comp: 'OralWorksheetGenerator' },
  { key: 'test-generator', label: 'Контрольные', comp: 'TestWorkGenerator' },
  { key: 'work-manager', label: 'Работы', comp: 'WorkManager' },
  { key: 'students', label: 'Прогресс учеников', comp: 'StudentProgressDashboard' },
  { key: 'achievements', label: 'Достижения', comp: 'AchievementManager' },
  { key: 'import', label: 'Импорт', comp: 'TaskImporter' },
  { key: 'geometry', label: 'Геометрия', comp: 'GeometryTaskList' },
  { key: 'tdf', label: 'ТДФ (3 экрана)', comp: 'TDFManager / TDFEditor / TDFVariantBuilder' },
  { key: 'theory', label: 'Теория (4 экрана)', comp: 'Browser / Editor / View / Print' },
]

/* ─── component ─── */

const HowItWorksPage = () => {
  const [navScrolled, setNavScrolled] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('v2-visible'); obs.unobserve(e.target) }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    )
    document.querySelectorAll('.v2-reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const scrollTo = id => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="v2-page v2-how-page">
      {/* NAV */}
      <nav className={`v2-nav ${navScrolled ? 'v2-nav--scrolled' : ''}`}>
        <div className="v2-container v2-nav-inner">
          <a href="/landing.html" className="v2-nav-logo">
            <img src="/lemma-logo-new.png" alt="Lemma" className="v2-nav-logo-img" />
          </a>
          <ul className={`v2-nav-links ${mobileOpen ? 'v2-nav-links--open' : ''}`}>
            <li><a onClick={() => scrollTo('overview')}>Обзор</a></li>
            <li><a onClick={() => scrollTo('modules')}>Модули</a></li>
            <li><a onClick={() => scrollTo('interfaces')}>Интерфейсы</a></li>
            <li><a onClick={() => scrollTo('flow')}>Поток работы</a></li>
            <li><a onClick={() => scrollTo('achievements')}>Достижения</a></li>
            <li><a onClick={() => scrollTo('tech')}>Технологии</a></li>
            <li><a onClick={() => scrollTo('versions')}>Версии</a></li>
            <li>
              <a href="https://github.com/evilfaust/lemma" className="v2-btn v2-btn--primary v2-nav-cta">
                Открыть платформу
              </a>
            </li>
          </ul>
          <button className="v2-nav-burger" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <header className="v2-how-hero" id="overview">
        <div className="v2-how-hero-mesh" />
        <div className="v2-container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="v2-how-hero-badge">v{APP_VERSION} • {formatDate(BUILD_DATE)}</div>

          <h1 className="v2-how-title">
            Lemma —<br />
            <span className="v2-gradient-text">полный обзор платформы</span>
          </h1>

          <p className="v2-how-subtitle">
            Веб-платформа для учителя математики: база задач, автоматическая генерация вариантов, модуль геометрии с GeoGebra, ТДФ-конспекты, онлайн-тестирование и система достижений. Три изолированных интерфейса — учитель, ученик и промо-лендинг.
          </p>

          <div className="v2-how-hero-actions">
            <a href="https://github.com/evilfaust/lemma" className="v2-btn v2-btn--primary">Открыть платформу</a>
            <a href="/landing.html" className="v2-btn v2-btn--outline">← На главную</a>
          </div>

          <div className="v2-how-facts">
            {HERO_FACTS.map(f => (
              <div className="v2-how-fact" key={f.value}>
                <div className="v2-how-fact-value" style={{ color: `var(--v2-${f.color})` }}>{f.value}</div>
                <p>{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ═══════════════════ CORE MODULES (Bento Grid) ═══════════════════ */}
      <section className="v2-section" id="modules">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Экосистема</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
              Основные <span className="v2-gradient-text">модули</span>
            </h2>
            <p>Платформа разделена на специализированные зоны — от базы задач и генераторов до геометрии и теории.</p>
          </div>

          <div className="v2-bento v2-reveal">
            {CORE_MODULES.map((m, i) => (
              <article key={i} className={`v2-bento-card v2-bento-card--${m.color} ${m.wide ? 'v2-bento-card--wide' : ''} v2-stagger`}>
                <div className={`v2-bento-num v2-bento-num--${m.color}`}>{m.num}</div>
                <h3 className="v2-bento-title">{m.title}</h3>
                <p className="v2-bento-desc">{m.desc}</p>
                {m.details && (
                  <ul className="v2-how-list" style={{ marginTop: 12 }}>
                    {m.details.map((d, j) => <li key={j}>{d}</li>)}
                  </ul>
                )}
                <div className="v2-bento-tags" style={{ marginTop: 12 }}>
                  {m.tags.map((t, j) => (
                    <span key={j} className={`v2-bento-tag v2-bento-tag--${m.color}`}>{t}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ WORK EDITOR & ANALYTICS ═══════════════════ */}
      <section className="v2-section v2-how-interfaces" id="work-tools">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Инструменты</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Редактор работ и <span className="v2-gradient-text--hot">аналитика</span>
            </h2>
          </div>

          <div className="v2-how-feature-grid v2-reveal">
            <div className="v2-how-feature-card v2-stagger">
              <h3 style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-display)', fontSize: 20 }}>
                WorkEditor
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65 }}>
                Список сохранённых работ с поиском и фильтрами (тема, статус). Метрики: количество сессий, попыток, средний результат. Drag & Drop задач между вариантами. Панель выдачи: QR-код, ссылка для учеников, просмотр результатов.
              </p>
              <ul className="v2-how-list" style={{ marginTop: 12 }}>
                <li>Замена и редактирование задач прямо в варианте</li>
                <li>Перемещение задач между вариантами</li>
                <li>Защита: при наличии попыток — только «Сохранить как новую»</li>
                <li>Архивирование работ без удаления</li>
              </ul>
            </div>

            <div className="v2-how-feature-card v2-stagger">
              <h3 style={{ color: 'var(--v2-pink)', fontFamily: 'var(--v2-font-display)', fontSize: 20 }}>
                Аналитика & Каталог
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65 }}>
                Дашборд статистики по темам, подтемам, тегам, сложности и источникам. Облако тегов с переходом к задачам. Поиск «белых пятен» в базе. Каталог справочников с CRUD, обнаружением и объединением дублей.
              </p>
              <ul className="v2-how-list" style={{ marginTop: 12 }}>
                <li>Кнопка перехода «Аналитика → Каталог» для быстрого управления</li>
                <li>Оптимизированный snapshot: лёгкая загрузка без тяжёлых полей</li>
                <li>Ленивая загрузка дубликатов (statement_md) только при открытии вкладки</li>
                <li>Shared кеш между Stats и Catalog — мгновенное переключение</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TWO INTERFACES ═══════════════════ */}
      <section className="v2-section" id="interfaces" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Архитектура</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Два изолированных <span className="v2-gradient-text">интерфейса</span>
            </h2>
            <p>Учитель и ученик работают в разных приложениях. Общий код (pocketbase, MathRenderer, shuffle) вынесен в shared/.</p>
          </div>

          <div className="v2-how-columns v2-reveal">
            {/* Teacher */}
            <div className="v2-how-column v2-stagger" style={{ borderColor: 'rgba(0,245,212,0.2)' }}>
              <h3 style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-display)' }}>
                Учитель <span style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 14, color: 'var(--v2-text-muted)' }}>teacher/main.jsx</span>
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65, marginBottom: 16 }}>
                Административная панель для управления базой данных задач, генерации работ, проведения тестирования и анализа результатов.
              </p>
              <div className="v2-how-student-list">
                {TEACHER_FEATURES.map((f, i) => (
                  <div className="v2-how-student-item" key={i}>
                    <span style={{ background: 'var(--v2-cyan)', boxShadow: '0 0 18px rgba(0,245,212,0.6)' }} />
                    <p>{f}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Student */}
            <div className="v2-how-column v2-stagger" style={{ borderColor: 'rgba(131,56,236,0.2)' }}>
              <h3 style={{ color: 'var(--v2-purple)', fontFamily: 'var(--v2-font-display)' }}>
                Ученик <span style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 14, color: 'var(--v2-text-muted)' }}>student.oipav.ru</span>
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65, marginBottom: 16 }}>
                Mobile-first SPA для учащихся. Деплоится отдельно на собственный домен. Никаких отвлекающих элементов — только решение задач.
              </p>
              <div className="v2-how-student-list">
                {STUDENT_FEATURES.map((f, i) => (
                  <div className="v2-how-student-item" key={i}>
                    <span style={{ background: 'var(--v2-purple)', boxShadow: '0 0 18px rgba(131,56,236,0.6)' }} />
                    <p>{f}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Teacher navigation */}
          <div className="v2-reveal" style={{ marginTop: 40 }}>
            <h3 style={{ fontFamily: 'var(--v2-font-display)', fontSize: 20, marginBottom: 16 }}>
              Навигация учителя — <span style={{ color: 'var(--v2-text-muted)' }}>{TEACHER_NAV.length} экранов</span>
            </h3>
            <div className="v2-how-modules">
              {TEACHER_NAV.map(n => (
                <div className="v2-how-module" key={n.key}>
                  <h3 style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 13, color: 'var(--v2-cyan)' }}>{n.label}</h3>
                  <p style={{ fontSize: 13 }}>{n.comp}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TESTING FLOW ═══════════════════ */}
      <section className="v2-section v2-how-process" id="flow">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Поток тестирования</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              От <span className="v2-gradient-text--hot">создания</span> до <span className="v2-gradient-text--hot">анализа</span>
            </h2>
            <p>Полный цикл: учитель создаёт работу → ученики решают → автопроверка → достижения → статистика</p>
          </div>

          <div className="v2-how-flow v2-reveal">
            {FLOW_STEPS.map(step => (
              <div className="v2-how-flow-item v2-stagger" key={step.num} style={{
                borderLeft: `3px solid var(--v2-${step.side === 'teacher' ? 'cyan' : 'purple'})`,
              }}>
                <div className="v2-how-flow-num" style={{
                  background: step.side === 'teacher' ? 'rgba(0,245,212,0.15)' : 'rgba(131,56,236,0.15)',
                  color: step.side === 'teacher' ? 'var(--v2-cyan)' : 'var(--v2-purple)',
                }}>{step.num}</div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {step.title}
                    <span style={{
                      fontSize: 11,
                      fontFamily: 'var(--v2-font-mono)',
                      color: step.side === 'teacher' ? 'var(--v2-cyan)' : 'var(--v2-purple)',
                      opacity: 0.7,
                      textTransform: 'uppercase',
                    }}>{step.side === 'teacher' ? 'учитель' : 'ученик'}</span>
                  </h4>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ ACHIEVEMENT SYSTEM ═══════════════════ */}
      <section className="v2-section" id="achievements">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Мотивация</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              <span className="v2-gradient-text">{ACHIEVEMENTS_DATA.total}</span> достижения
            </h2>
            <p>Геймификация учебного процесса: случайные бейджи за каждую попытку + условные разблокировки. Глобальная дедупликация по всем сессиям.</p>
          </div>

          {/* Random badges */}
          <div className="v2-how-tech-grid v2-reveal">
            {ACHIEVEMENTS_DATA.random.map(r => (
              <div className="v2-how-tech-card v2-stagger" key={r.rarity} style={{ borderColor: `${r.color}33` }}>
                <h3 style={{ color: r.color, fontFamily: 'var(--v2-font-display)', fontSize: 18 }}>
                  {r.label}
                </h3>
                <p style={{ color: 'var(--v2-text-dim)', marginTop: 8, lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--v2-text)' }}>{r.condition}</strong><br />
                  {r.examples}
                </p>
              </div>
            ))}
          </div>

          {/* Conditional achievements */}
          <div className="v2-how-feature-grid v2-reveal" style={{ marginTop: 20 }}>
            {ACHIEVEMENTS_DATA.conditional.map(c => (
              <div className="v2-how-feature-card v2-stagger" key={c.name} style={{ padding: 16 }}>
                <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{c.icon}</span> {c.name}
                </h3>
                <p style={{ color: 'var(--v2-text-dim)', marginTop: 6, lineHeight: 1.5, fontSize: 14 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Extra info */}
          <div className="v2-reveal" style={{ marginTop: 24 }}>
            <div className="v2-how-feature-card" style={{ background: 'linear-gradient(135deg, rgba(0,245,212,0.04), rgba(131,56,236,0.04))' }}>
              <ul className="v2-how-list">
                <li>Учитель может выдать достижения вручную из панели результатов</li>
                <li>Включение/отключение достижений на уровне сессии</li>
                <li>Polling каждые 10 секунд для обновления наград от учителя</li>
                <li>Achievement Engine: <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>utils/achievementEngine.js</code></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ ANSWER CHECKER ═══════════════════ */}
      <section className="v2-section v2-how-interfaces">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Автопроверка</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Умная проверка <span className="v2-gradient-text--hot">ответов</span>
            </h2>
            <p>Математический парсер, который понимает дроби, LaTeX и альтернативные ответы.</p>
          </div>

          <div className="v2-how-feature-grid v2-reveal">
            {ANSWER_CHECKER_FEATURES.map(f => (
              <div className="v2-how-feature-card v2-stagger" key={f.title}>
                <h3 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24, fontFamily: 'var(--v2-font-mono)', color: 'var(--v2-cyan)' }}>{f.icon}</span>
                  {f.title}
                </h3>
                <p style={{ color: 'var(--v2-text-dim)', marginTop: 8, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="v2-reveal" style={{ marginTop: 20 }}>
            <div className="v2-how-feature-card" style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 14, lineHeight: 1.8, color: 'var(--v2-text-dim)' }}>
              <span style={{ color: 'var(--v2-text-muted)' }}>// Примеры эквивалентных ответов:</span><br />
              <span style={{ color: 'var(--v2-cyan)' }}>0.333...</span> ≈ <span style={{ color: 'var(--v2-cyan)' }}>1/3</span> ≈ <span style={{ color: 'var(--v2-cyan)' }}>\frac{'{1}{3}'}</span><br />
              <span style={{ color: 'var(--v2-pink)' }}>3|3.0|3.00</span> — альтернативные формы через «|»<br />
              <span style={{ color: 'var(--v2-text-muted)' }}>// epsilon = 1e-6, utils/answerChecker.js</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ PDF EXPORT & IMPORT ═══════════════════ */}
      <section className="v2-section">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Ввод / Вывод</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              PDF-экспорт и <span className="v2-gradient-text">импорт задач</span>
            </h2>
          </div>

          <div className="v2-how-feature-grid v2-reveal">
            <div className="v2-how-feature-card v2-stagger">
              <h3 style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-display)', fontSize: 20 }}>
                High-Quality PDF
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65, marginBottom: 12 }}>
                Печать и экспорт прямо из браузера — без серверных зависимостей.
              </p>
              <ul className="v2-how-list">
                <li><strong style={{ color: 'var(--v2-text)' }}>Печать:</strong> нативный диалог браузера с подготовленными @media print стилями (точная вёрстка А4/А5, клетка, поля)</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>PDF:</strong> html2pdf.js — клиентский рендеринг, идеальный KaTeX, ничего не уходит на сервер</li>
              </ul>
            </div>

            <div className="v2-how-feature-card v2-stagger">
              <h3 style={{ color: 'var(--v2-pink)', fontFamily: 'var(--v2-font-display)', fontSize: 20 }}>
                Импорт задач
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65, marginBottom: 12 }}>
                Несколько способов наполнения базы задач.
              </p>
              <ul className="v2-how-list">
                <li><strong style={{ color: 'var(--v2-text)' }}>Markdown + YAML frontmatter:</strong> файлы с метаданными (тема, подтема, сложность, теги)</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>sdamgia.ru:</strong> парсинг задач через POST /parse-sdamgia, автоконвертация HTML-таблиц</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>Создание через UI:</strong> полная форма с редактором и предпросмотром LaTeX</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>Прокси изображений:</strong> POST /fetch-image для сохранения картинок локально</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TECH STACK ═══════════════════ */}
      <section className="v2-section v2-how-process" id="tech">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Под капотом</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Технологический <span className="v2-gradient-text">стек</span>
            </h2>
          </div>

          <div className="v2-how-tech-grid v2-reveal" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {TECH_STACK.map(group => (
              <div className="v2-how-tech-card v2-stagger" key={group.title}>
                <h3 style={{ fontFamily: 'var(--v2-font-mono)', color: 'var(--v2-cyan)', fontSize: 14 }}>
                  // {group.title}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                  {group.items.map(item => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ width: 4, height: 4, background: 'var(--v2-cyan)', borderRadius: '50%', flexShrink: 0, marginTop: 8 }} />
                      <div>
                        <span style={{ color: 'var(--v2-text)', fontWeight: 600 }}>{item.name}</span>
                        {item.ver && <span style={{ color: 'var(--v2-text-muted)', fontFamily: 'var(--v2-font-mono)', fontSize: 12, marginLeft: 6 }}>{item.ver}</span>}
                        <span style={{ color: 'var(--v2-text-dim)', fontSize: 13, marginLeft: 6 }}>— {item.note}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ DATABASE SCHEMA ═══════════════════ */}
      <section className="v2-section" id="database">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Данные</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              База данных — <span className="v2-gradient-text">{DB_COLLECTIONS.reduce((s, g) => s + g.items.length, 0)} коллекций</span>
            </h2>
            <p>PocketBase (SQLite) — единая база: REST API, Auth, File Storage, Row-Level Security.</p>
          </div>

          {DB_COLLECTIONS.map(group => (
            <div className="v2-reveal" key={group.group} style={{ marginBottom: 28 }}>
              <h3 style={{ fontFamily: 'var(--v2-font-display)', fontSize: 18, marginBottom: 12, color: 'var(--v2-text)' }}>
                {group.group}
              </h3>
              <div className="v2-how-data-grid">
                {group.items.map(item => (
                  <div className="v2-how-data-card" key={item.name}>
                    <h3>{item.name}</h3>
                    <p style={{ marginBottom: 6 }}>{item.desc}</p>
                    <div style={{ fontSize: 12, color: 'var(--v2-text-muted)', fontFamily: 'var(--v2-font-mono)', lineHeight: 1.5 }}>
                      {item.fields}
                    </div>
                    {item.rel !== '—' && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <span style={{ color: 'var(--v2-text-muted)' }}>rel: </span>
                        <span style={{ color: 'var(--v2-purple)' }}>{item.rel}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Schema diagram */}
          <div className="v2-reveal">
            <div className="v2-how-feature-card" style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 13, lineHeight: 1.9, color: 'var(--v2-text-dim)', background: '#0a0a0a' }}>
              <h3 style={{ fontFamily: 'var(--v2-font-display)', fontSize: 16, color: 'var(--v2-text)', marginBottom: 12 }}>Схема связей</h3>
              <span style={{ color: 'var(--v2-cyan)' }}>topics</span> ←── subtopics.topic, tasks.topic, works.topic<br />
              <span style={{ color: 'var(--v2-cyan)' }}>tags</span> ←── tasks.tags<br />
              <span style={{ color: 'var(--v2-pink)' }}>tasks</span> ←── cards.tasks, variants.tasks, attempt_answers.task<br />
              <span style={{ color: 'var(--v2-pink)' }}>works</span> ←── variants.work, work_sessions.work<br />
              <span style={{ color: 'var(--v2-purple)' }}>variants</span> ←── attempts.variant<br />
              <span style={{ color: 'var(--v2-purple)' }}>work_sessions</span> ←── attempts.session<br />
              <span style={{ color: 'var(--v2-orange)' }}>students</span> ←── attempts.student<br />
              <span style={{ color: 'var(--v2-orange)' }}>achievements</span> ←── attempts.achievement, attempts.unlocked_achievements
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ VPS DEPLOY ═══════════════════ */}
      <section className="v2-section v2-how-interfaces">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Инфраструктура</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Архитектура <span className="v2-gradient-text">деплоя</span>
            </h2>
          </div>

          {/* VPS Architecture diagram */}
          <div className="v2-reveal">
            <div className="v2-how-feature-card" style={{ background: '#0a0a0a', fontFamily: 'var(--v2-font-mono)', fontSize: 13, lineHeight: 2, color: 'var(--v2-text-dim)' }}>
              <span style={{ color: 'var(--v2-cyan)', fontWeight: 600 }}>nginx (443)</span> → task-ege.oipav.ru<br />
              {'  '}<span style={{ color: 'var(--v2-text-muted)' }}>/api/, /_/</span>{'    '}→ PocketBase <span style={{ color: 'var(--v2-purple)' }}>(:8095)</span>{'   '}systemd: pocketbase-ege<br />
              {'  '}<span style={{ color: 'var(--v2-text-muted)' }}>/pdf/</span>{'        '}→ PDF Service <span style={{ color: 'var(--v2-purple)' }}>(:3001)</span>{'  '}systemd: pdf-service-ege<br />
              {'  '}<span style={{ color: 'var(--v2-text-muted)' }}>Telegram Bot</span>{'                       '}systemd: telegram-bot-ege<br />
              <br />
              <span style={{ color: 'var(--v2-cyan)', fontWeight: 600 }}>nginx (443)</span> → student.oipav.ru<br />
              {'  '}<span style={{ color: 'var(--v2-text-muted)' }}>/</span>{'            '}→ /var/www/student-ege/student.html <span style={{ color: 'var(--v2-purple)' }}>(SPA)</span>
            </div>
          </div>

          <div className="v2-how-tech-grid v2-reveal" style={{ marginTop: 20 }}>
            {VPS_ARCH.map(s => (
              <div className="v2-how-tech-card v2-stagger" key={s.service}>
                <h3 style={{ fontFamily: 'var(--v2-font-display)', color: 'var(--v2-cyan)', fontSize: 16, marginBottom: 4 }}>
                  {s.service}
                </h3>
                <div style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 12, color: 'var(--v2-text-muted)', marginBottom: 10 }}>
                  порт {s.port} • {s.systemd}
                </div>
                <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.5, fontSize: 14, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Backup info */}
          <div className="v2-reveal" style={{ marginTop: 20 }}>
            <div className="v2-how-feature-card" style={{ background: 'linear-gradient(135deg, rgba(0,245,212,0.04), rgba(131,56,236,0.04))' }}>
              <h3 style={{ fontFamily: 'var(--v2-font-display)', fontSize: 18, marginBottom: 12 }}>Резервное копирование</h3>
              <ul className="v2-how-list">
                <li>Автоматические бэкапы на VPS каждые 6 часов (cron, до 20 копий)</li>
                <li>Безопасный бэкап через <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>sqlite3 .backup</code> — safe while running</li>
                <li>Скрипты: <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>backup.sh</code> / <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>restore.sh</code> с двойным подтверждением</li>
                <li>macOS LaunchAgent: автобэкап каждый день в 02:00</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ API OVERVIEW ═══════════════════ */}
      <section className="v2-section" id="api">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">API</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              <span className="v2-gradient-text--hot">{API_GROUPS.reduce((s, g) => s + g.count, 0)}+</span> методов API
            </h2>
            <p>Единый файл <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>pocketbase.js</code> — все запросы к серверу. Реэкспорт для обратной совместимости.</p>
          </div>

          <div className="v2-how-data-grid v2-reveal">
            {API_GROUPS.map(g => (
              <div className="v2-how-data-card v2-stagger" key={g.name}>
                <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{g.name}</span>
                  <span style={{ fontSize: 18, color: 'var(--v2-text)', fontFamily: 'var(--v2-font-display)' }}>{g.count}</span>
                </h3>
                <p style={{ fontSize: 12, fontFamily: 'var(--v2-font-mono)', lineHeight: 1.5 }}>{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ VERSION HISTORY ═══════════════════ */}
      <section className="v2-section v2-how-process" id="versions">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Эволюция</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              История <span className="v2-gradient-text">версий</span>
            </h2>
            <p>Ключевые вехи развития платформы — от первого генератора до полной экосистемы.</p>
          </div>

          <div className="v2-how-flow v2-reveal">
            {VERSION_MILESTONES.map(m => (
              <div className="v2-how-flow-item v2-stagger" key={m.ver} style={{
                borderLeft: `3px solid var(--v2-${m.color})`,
              }}>
                <div className="v2-how-flow-num" style={{
                  background: `rgba(${m.color === 'cyan' ? '0,245,212' : m.color === 'pink' ? '255,0,110' : m.color === 'purple' ? '131,56,236' : '251,86,7'},0.15)`,
                  color: `var(--v2-${m.color})`,
                  fontSize: 12,
                  width: 36,
                  height: 36,
                }}>v{m.ver}</div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.title}
                    <span style={{ fontSize: 12, fontFamily: 'var(--v2-font-mono)', color: 'var(--v2-text-muted)' }}>{m.date}</span>
                  </h4>
                  <p>{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA + FOOTER ═══════════════════ */}
      <section className="v2-section">
        <div className="v2-container">
          <div className="v2-how-highlight v2-reveal">
            <div className="v2-how-highlight-card">
              <span className="v2-label">Готовы начать?</span>
              <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
                Управляйте учебным процессом <span className="v2-gradient-text">эффективно</span>
              </h2>
              <p>
                Бесплатная платформа. Ученики подключаются по ссылке или QR-коду. Учитель контролирует всё — от создания задач до анализа результатов. Карточки, контрольные, маршрутные листы, QR-листы, pixel art worksheets, 72 достижения и автопроверка ответов.
              </p>
              <div className="v2-how-highlight-actions">
                <a href="https://github.com/evilfaust/lemma" className="v2-btn v2-btn--primary">Открыть платформу →</a>
                <a href="/landing.html" className="v2-btn v2-btn--outline">← На главную</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="v2-footer">
        <div className="v2-container v2-footer-inner">
          <span>Lemma &copy; {new Date().getFullYear()} • v{APP_VERSION}</span>
          <a href="https://github.com/evilfaust/lemma" className="v2-footer-link">github.com/evilfaust/lemma</a>
        </div>
      </footer>
    </div>
  )
}

export default HowItWorksPage
