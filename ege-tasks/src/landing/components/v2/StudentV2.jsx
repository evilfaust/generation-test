const BENEFITS = [
  'Вход по ссылке или QR-коду',
  'Чистый, понятный интерфейс без лишнего',
  'Авто-сохранение ответов в процессе',
  'Мгновенный результат после отправки',
  'Несколько попыток и проходной балл',
  'Работа над ошибками по слабым темам',
  'Коллекция из 88 достижений за успехи',
  'Личный кабинет: прогресс и история попыток',
  'Светлая и тёмная тема',
]

const StudentV2 = () => (
  <section className="v2-student v2-section" id="students">
    <div className="v2-container">
      <div className="v2-student-inner">
        {/* Text */}
        <div className="v2-student-text v2-reveal">
          <span className="v2-label">{'\u0414\u043B\u044F \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432'}</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)', marginTop: 16 }}>
            {'\u0423\u0434\u043E\u0431\u043D\u043E \u043D\u0430 '}<span className="v2-gradient-text">{'\u043B\u044E\u0431\u043E\u043C'}</span>{' \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435'}
          </h2>
          <p>{'\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043D\u0435 \u043E\u0442\u0432\u043B\u0435\u043A\u0430\u0435\u0442. \u0420\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043D\u0430 \u043B\u044E\u0431\u043E\u043C \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0435.'}</p>
          <ul className="v2-student-list">
            {BENEFITS.map((b, i) => (
              <li key={i} className="v2-student-item v2-stagger">
                <span className="v2-student-check">{'\u2713'}</span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Phone */}
        <div className="v2-phone-wrap v2-reveal">
          <div className="v2-phone">
            <div className="v2-phone-notch" />
            <div className="v2-phone-screen">
              <div className="v2-phone-hdr">
                <div className="v2-phone-hdr-title">{'\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430\u044F \u0440\u0430\u0431\u043E\u0442\u0430 #5'}</div>
                <div className="v2-phone-hdr-sub">{'\u0412\u0430\u0440\u0438\u0430\u043D\u0442 2 \u2022 6 \u0437\u0430\u0434\u0430\u0447'}</div>
              </div>

              <div className="v2-phone-task">
                <div className="v2-phone-task-num">{'\u0417\u0430\u0434\u0430\u0447\u0430 1'}</div>
                <div className="v2-phone-task-text">{'\u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F 3\u00B2 + 4\u00B2'}</div>
                <input className="v2-phone-input" placeholder={'\u0412\u0430\u0448 \u043E\u0442\u0432\u0435\u0442...'} readOnly value="25" />
              </div>

              <div className="v2-phone-task">
                <div className="v2-phone-task-num">{'\u0417\u0430\u0434\u0430\u0447\u0430 2'}</div>
                <div className="v2-phone-task-text">{'\u0420\u0435\u0448\u0438\u0442\u0435 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435: 2x + 5 = 17'}</div>
                <input className="v2-phone-input" placeholder={'\u0412\u0430\u0448 \u043E\u0442\u0432\u0435\u0442...'} readOnly />
              </div>

              <div className="v2-phone-task">
                <div className="v2-phone-task-num">{'\u0417\u0430\u0434\u0430\u0447\u0430 3'}</div>
                <div className="v2-phone-task-text">{'(a + b)\u00B2 \u2212 a\u00B2'}</div>
                <input className="v2-phone-input" placeholder={'\u0412\u0430\u0448 \u043E\u0442\u0432\u0435\u0442...'} readOnly />
              </div>

              <button className="v2-phone-submit" disabled>{'\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043E\u0442\u0432\u0435\u0442\u044B'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)

export default StudentV2
