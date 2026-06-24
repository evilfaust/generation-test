/**
 * Карточка-секция раздела «Моё пространство»: иконка + заголовок + опц. мета + опц. действие.
 * Единый визуальный язык для Today, Журнала, КТП, Библиотеки и т.д. (классы .ws-card).
 * iconColor — цвет значка (CSS var/hex). bodyClass переопределяет паддинг тела.
 */
export default function SectionCard({ icon, iconColor, title, meta, extra, actionLabel, onAction, bodyClass, children }) {
  return (
    <section className="ws-card">
      <div className="ws-card__head">
        {icon && <span className="ws-card__icon" style={{ color: iconColor }}>{icon}</span>}
        <span className="ws-card__title">{title}</span>
        {meta && <span className="ws-card__meta">{meta}</span>}
        {extra}
        {actionLabel && (
          <button type="button" className="ws-card__action" onClick={onAction}>{actionLabel}</button>
        )}
      </div>
      <div className={bodyClass || 'ws-card__body'}>{children}</div>
    </section>
  );
}
