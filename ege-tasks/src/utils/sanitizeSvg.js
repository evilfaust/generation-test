import DOMPurify from 'dompurify';

/**
 * Санитайзинг SVG перед вставкой через dangerouslySetInnerHTML.
 *
 * Источники чертежей недоверенные: банк МЦНМО (внешний импорт 17к+ чертежей),
 * пользовательский SVG-редактор и конвертация GeoGebra→SVG. SVG умеет нести
 * <script>, обработчики (onload/onclick) и <foreignObject> с произвольным HTML —
 * при публичном API это реальный вектор stored-XSS.
 *
 * Профиль svg сохраняет геометрию (path/polygon/line/circle/text/g/marker,
 * presentation-атрибуты, viewBox), но вырезает скрипты, event-хендлеры и
 * foreignObject. Возвращает пустую строку для пустого/нестрокового входа.
 */
export function sanitizeSvg(svg) {
  if (!svg || typeof svg !== 'string') return '';
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
