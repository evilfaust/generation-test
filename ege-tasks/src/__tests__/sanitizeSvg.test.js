import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '../utils/sanitizeSvg';

describe('sanitizeSvg', () => {
  it('возвращает пустую строку для пустого/нестрокового входа', () => {
    expect(sanitizeSvg('')).toBe('');
    expect(sanitizeSvg(null)).toBe('');
    expect(sanitizeSvg(undefined)).toBe('');
    expect(sanitizeSvg(123)).toBe('');
    expect(sanitizeSvg({})).toBe('');
  });

  it('вырезает <script> внутри SVG (вместе с содержимым)', () => {
    const dirty = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/alert/i);
    expect(clean).toMatch(/circle/i); // легитимная геометрия сохранена
  });

  it('вырезает обработчики событий (onload/onclick)', () => {
    const dirty = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect onclick="steal()" width="10" height="10"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/onload/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/alert|steal/i);
    expect(clean).toMatch(/rect/i);
  });

  it('вырезает <foreignObject> (вектор внедрения произвольного HTML)', () => {
    const dirty = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><img src=x onerror="alert(1)"></foreignObject><path d="M0 0"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/foreignobject/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).toMatch(/path/i);
  });

  it('сохраняет типичный геометрический чертёж (path/polygon/text/line/g)', () => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
      '<g><line x1="0" y1="0" x2="100" y2="100" stroke="black"/>',
      '<polygon points="0,0 100,0 50,100" fill="none" stroke="black"/>',
      '<path d="M10 10 L90 90"/>',
      '<text x="50" y="50">A</text></g></svg>',
    ].join('');
    const clean = sanitizeSvg(svg);
    expect(clean).toMatch(/line/i);
    expect(clean).toMatch(/polygon/i);
    expect(clean).toMatch(/path/i);
    expect(clean).toMatch(/text/i);
    expect(clean).toMatch(/>A</); // подпись вершины сохранена
  });
});
