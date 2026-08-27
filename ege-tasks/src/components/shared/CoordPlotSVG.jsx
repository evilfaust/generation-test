import { useMemo } from 'react';
import { parseCoordPlot, coordPlotSvg } from '../../utils/coordPlot';

// Координатная плоскость (график функции / векторы). Принимает текстовый DSL
// (`spec`) или готовую модель (`model`). Рендер делегирован общей функции
// coordPlotSvg → разметка идентична той, что строит конвейер теории.
export default function CoordPlotSVG({ spec, model, width, maxHeight, style }) {
  const html = useMemo(() => {
    const m = model || parseCoordPlot(spec || '');
    return coordPlotSvg(m, { width, maxHeight });
  }, [spec, model, width, maxHeight]);

  return (
    <span
      className="coordplot"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
