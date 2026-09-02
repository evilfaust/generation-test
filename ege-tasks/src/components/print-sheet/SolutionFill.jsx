/**
 * Клетка / линейка в зоне решения.
 *
 * 🚨 Число линий считаем ТОЧНО под размер блока (запас максимум +1): лишние
 * абсолютные линии Chrome включает в расчёт печатной области и ужимает лист
 * (масштаб съезжал до ~65%).
 */
export default function SolutionFill({ fill, heightMm, widthMm }) {
  if (fill === 'blank') return null;

  if (fill === 'lines') {
    const step = 8;
    const n = Math.max(0, Math.ceil(heightMm / step) - 1);
    return (
      <div className="ps-fill" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <div key={`l-${i}`} className="ps-fill-h" style={{ top: `${(i + 1) * step}mm` }} />
        ))}
      </div>
    );
  }

  const h = Math.max(0, Math.ceil(heightMm / 5) - 1);
  const v = Math.max(0, Math.ceil(widthMm / 5) - 1);
  return (
    <div className="ps-fill" aria-hidden="true">
      {Array.from({ length: h }, (_, i) => (
        <div key={`h-${i}`} className="ps-fill-h" style={{ top: `${(i + 1) * 5}mm` }} />
      ))}
      {Array.from({ length: v }, (_, i) => (
        <div key={`v-${i}`} className="ps-fill-v" style={{ left: `${(i + 1) * 5}mm` }} />
      ))}
    </div>
  );
}
