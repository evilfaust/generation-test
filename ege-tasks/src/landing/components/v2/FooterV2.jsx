import { APP_VERSION } from '@shared/version/buildInfo'

const FooterV2 = () => (
  <>
    {/* CTA */}
    <section className="v2-cta v2-section">
      <div className="v2-cta-mesh" />
      <div className="v2-container v2-cta-content">
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          {'\u041D\u0430\u0447\u043D\u0438\u0442\u0435 '}<span className="v2-gradient-text">{'\u0441\u0435\u0439\u0447\u0430\u0441'}</span>
        </h2>
        <p>{'\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E. \u0423\u0447\u0435\u043D\u0438\u043A\u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u044E\u0442\u0441\u044F \u043F\u043E \u0441\u0441\u044B\u043B\u043A\u0435 \u0438\u043B\u0438 QR-\u043A\u043E\u0434\u0443.'}</p>
        <a href="https://github.com/evilfaust/lemma" className="v2-btn v2-btn--primary">
          {'\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0443 \u2192'}
        </a>
        <a href="/how-it-works.html" className="v2-btn v2-btn--outline">
          Как работает приложение
        </a>
      </div>
    </section>

    {/* Footer */}
    <footer className="v2-footer">
      <div className="v2-container v2-footer-inner">
        <span>Lemma &copy; {new Date().getFullYear()} Oleg Pavlyuchenko • v{APP_VERSION}</span>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <a href="https://oipav.ru" className="v2-footer-link">oipav.ru</a>
          <a href="https://github.com/evilfaust/lemma" className="v2-footer-link">github.com/evilfaust/lemma</a>
          <a href="https://github.com/evilfaust/lemma/blob/main/LICENSE" className="v2-footer-link">AGPL-3.0</a>
        </div>
      </div>
    </footer>
  </>
)

export default FooterV2
