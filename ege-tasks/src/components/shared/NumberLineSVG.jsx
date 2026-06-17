import { useMemo } from 'react';
import { parseNumberLine, numberLineSvg } from '../../utils/numberLine';

// Числовая прямая со штриховкой. Принимает текстовый DSL (`spec`) или готовую
// модель (`model`). Рендер делегирован общей функции numberLineSvg → разметка
// идентична той, что строит конвейер теории. Вставляем как inline-SVG-строку
// (одна и та же сборка для обоих конвейеров — единый источник истины).
export default function NumberLineSVG({ spec, model, width, height, style }) {
  const html = useMemo(() => {
    const m = model || parseNumberLine(spec || '');
    return numberLineSvg(m, { width, height });
  }, [spec, model, width, height]);

  return (
    <span
      className="numline"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
