/**
 * Единая шапка страниц раздела «Моё пространство».
 * Слева — цветной значок (accent из 5-палитры) + заголовок + подпись,
 * справа — действия (extra). Заменяет разнобой Title level={3|4} + Space/Row.
 */
export default function WorkspacePageHeader({
  icon,
  accent = 'blue',
  title,
  subtitle,
  extra,
  style,
}) {
  return (
    <div className="ws-header" style={style}>
      <div className="ws-header__main">
        {icon && <span className={`ws-header__icon ws-icon--${accent}`}>{icon}</span>}
        <div className="ws-header__text">
          <h1 className="ws-header__title">{title}</h1>
          {subtitle && <div className="ws-header__subtitle">{subtitle}</div>}
        </div>
      </div>
      {extra && <div className="ws-header__actions">{extra}</div>}
    </div>
  );
}
