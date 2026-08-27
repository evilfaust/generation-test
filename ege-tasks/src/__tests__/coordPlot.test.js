import { describe, it, expect } from 'vitest';
import {
  parseCoordPlot, coordPlotSvg, coordPlotSvgFromSpec, compileExpr, plotToSpec,
} from '../utils/coordPlot';
import { buildPlotSnippet } from '../components/shared/PlotModal';

const at = (src, x) => compileExpr(src).fn(x);

describe('compileExpr', () => {
  it('арифметика и приоритет операций', () => {
    expect(at('2+3*4', 0)).toBe(14);
    expect(at('(2+3)*4', 0)).toBe(20);
  });

  it('неявное умножение: 2x, 3(x+1)', () => {
    expect(at('2x', 3)).toBe(6);
    expect(at('3(x+1)', 2)).toBe(9);
  });

  it('степень правоассоциативна, унарный минус слабее степени', () => {
    expect(at('2^3^2', 0)).toBe(512);
    expect(at('-x^2', 3)).toBe(-9);
  });

  it('школьные функции', () => {
    expect(at('sqrt(x)', 9)).toBe(3);
    expect(at('abs(x)', -4)).toBe(4);
    expect(at('log(2,x)', 8)).toBe(3);
    expect(at('lg(x)', 100)).toBe(2);
  });

  it('десятичная запятая не мешает аргументам функции', () => {
    expect(at('0,5x', 4)).toBe(2);
    expect(at('log(2, x)', 4)).toBe(2);
  });

  it('снимает префикс «y =»', () => {
    expect(at('y = 3x + 3', 1)).toBe(6);
  });

  it('вне области определения — NaN (график рвётся)', () => {
    expect(Number.isNaN(at('sqrt(x-1)', 0))).toBe(true);
  });

  it('ошибки: неизвестная переменная и незакрытая скобка', () => {
    expect(compileExpr('z+1').error).toMatch(/Неизвестное обозначение/);
    expect(compileExpr('(x').error).toBeTruthy();
    expect(compileExpr('').error).toBeTruthy();
    expect(compileExpr('zzz(x)').error).toMatch(/Неизвестная функция/);
  });

  it('не выполняет посторонний код (нет eval)', () => {
    expect(compileExpr('process.exit(1)').error).toBeTruthy();
    expect(compileExpr('alert(1)').error).toBeTruthy();
  });
});

describe('parseCoordPlot', () => {
  it('окно, клетка и размер', () => {
    const m = parseCoordPlot('x -4 4\ny -3 5\ngrid 0.5\nsize 300');
    expect(m.xrange).toEqual([-4, 4]);
    expect(m.yrange).toEqual([-3, 5]);
    expect(m.grid).toBe(0.5);
    expect(m.width).toBe(300);
  });

  it('битое окно (min>=max) игнорируется', () => {
    expect(parseCoordPlot('x 4 -4').xrange).toEqual([-5, 5]);
  });

  it('grid off выключает клетку', () => {
    expect(parseCoordPlot('grid off').grid).toBe(0);
  });

  it('кривая с модификаторами', () => {
    const [c] = parseCoordPlot('f x^2-4 color orange from -2 to 2 dash').curves;
    expect(c.expr).toBe('x^2-4');
    expect(c.color).toBe('orange');
    expect([c.from, c.to]).toEqual([-2, 2]);
    expect(c.dash).toBe(true);
    expect(c.fn(3)).toBe(5);
  });

  it('вектор: подпись + 4 координаты', () => {
    const [v] = parseCoordPlot('vec a 1 4 3 1').vectors;
    expect(v).toMatchObject({ label: 'a', x1: 1, y1: 4, x2: 3, y2: 1, color: 'ink' });
  });

  it('вектор из двух чисел — из начала координат', () => {
    const [v] = parseCoordPlot('vec b 2 3 color blue').vectors;
    expect(v).toMatchObject({ label: 'b', x1: 0, y1: 0, x2: 2, y2: 3, color: 'blue' });
  });

  it('вектор без подписи', () => {
    const [v] = parseCoordPlot('vec 1 1 4 3').vectors;
    expect(v).toMatchObject({ label: '', x1: 1, y1: 1, x2: 4, y2: 3 });
  });

  it('точки, отрезки, подписи и засечки', () => {
    const m = parseCoordPlot('point 1 3 fill\npoint 2 0 open\nseg 0 0 2 3 dash\nlabel 2 3 A\nxtick -5\nytick 3 три');
    expect(m.points).toEqual([
      { x: 1, y: 3, filled: true, color: 'ink' },
      { x: 2, y: 0, filled: false, color: 'ink' },
    ]);
    expect(m.segments[0]).toMatchObject({ x1: 0, y1: 0, x2: 2, y2: 3, dash: true });
    expect(m.labels[0]).toMatchObject({ x: 2, y: 3, text: 'A' });
    expect(m.xticks).toEqual([{ v: -5, label: '−5' }]);
    expect(m.yticks).toEqual([{ v: 3, label: 'три' }]);
  });

  it('inline-форма: «;» как разделитель команд', () => {
    const m = parseCoordPlot('x 0 6; y 0 5; vec a 1 4 3 1');
    expect(m.xrange).toEqual([0, 6]);
    expect(m.vectors.length).toBe(1);
  });

  it('комментарии и пустые строки пропускаются', () => {
    expect(parseCoordPlot('# коммент\n\nf x').curves.length).toBe(1);
  });

  it('буквы осей и отключение единичных отрезков', () => {
    const m = parseCoordPlot('axis t s\nunits off');
    expect([m.axisX, m.axisY]).toEqual(['t', 's']);
    expect(m.units).toBe(false);
  });
});

describe('coordPlotSvg', () => {
  it('клетка квадратная: одинаковый масштаб по осям', () => {
    const svg = coordPlotSvgFromSpec('x -5 5\ny -2 2', { width: 280 });
    const w = Number(/width="(\d+)"/.exec(svg)[1]);
    const h = Number(/height="(\d+)"/.exec(svg)[1]);
    // 10 клеток по X → 4 по Y; поля (18+14 и 12+18) прибавляются к сторонам
    const cellX = (w - 32) / 10;
    const cellY = (h - 30) / 4;
    expect(Math.abs(cellX - cellY)).toBeLessThan(0.3);
  });

  it('без defs/marker/pattern и ссылок url(#…) — проходит DOMPurify', () => {
    const svg = coordPlotSvgFromSpec('f x^2\nvec a 1 1 3 3\npoint 1 1 fill');
    expect(svg).not.toMatch(/<defs|<marker|<pattern|url\(#/);
  });

  it('рисует график, вектор и точку', () => {
    const svg = coordPlotSvgFromSpec('f x^2-4 color orange\nvec a 1 1 3 3\npoint 2 0 fill');
    expect(svg).toContain('#c8772e');
    expect(svg).toMatch(/<path d="M[\d.,-]+ L/); // путь графика
    expect(svg).toContain('<circle');
  });

  it('высота ограничена maxHeight (узкая колонка печати)', () => {
    const svg = coordPlotSvgFromSpec('x -2 2\ny -20 20', { width: 280, maxHeight: 200 });
    expect(Number(/height="(\d+)"/.exec(svg)[1])).toBeLessThanOrEqual(200);
  });

  it('экранирует подписи (без инъекции разметки)', () => {
    const svg = coordPlotSvgFromSpec('axis <b>x</b> y');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;');
  });

  it('разрыв в точке асимптоты: путь состоит из двух кусков', () => {
    const svg = coordPlotSvgFromSpec('x -5 5\ny -5 5\nf 1/x');
    const d = /<path d="(M[^"]+)" fill="none"/.exec(svg)[1];
    expect((d.match(/M/g) || []).length).toBe(2);
  });

  it('пустая модель всё равно даёт валидный svg с осями', () => {
    const svg = coordPlotSvg(parseCoordPlot(''));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });
});

describe('plotToSpec / buildPlotSnippet', () => {
  it('сериализует окно, кривые и векторы', () => {
    const spec = plotToSpec({
      view: { xrange: [-4, 4], yrange: [-3, 5], grid: 1, axisX: 'x', axisY: 'y', units: true },
      curves: [{ expr: 'x^2-4', color: 'orange', from: '', to: '' }],
      vectors: [{ label: 'a', x1: 1, y1: 4, x2: 3, y2: 1, color: 'ink', side: 'left' }],
      points: [{ x: 2, y: 0, filled: false, label: 'A' }],
    });
    expect(spec).toContain('x -4 4');
    expect(spec).toContain('y -3 5');
    expect(spec).toContain('f x^2-4 color orange');
    expect(spec).toContain('vec a 1 4 3 1');
    expect(spec).toContain('point 2 0 open');
    expect(spec).toContain('label 2 0 A');
    expect(spec).not.toContain('grid');
  });

  it('round-trip: сериализация → разбор даёт ту же картинку', () => {
    const state = {
      view: { xrange: [0, 6], yrange: [0, 5], grid: 1 },
      vectors: [{ label: 'a', x1: 1, y1: 4, x2: 3, y2: 1, color: 'blue', side: 'right' }],
    };
    const m = parseCoordPlot(plotToSpec(state));
    expect(m.xrange).toEqual([0, 6]);
    expect(m.vectors[0]).toMatchObject({ label: 'a', x1: 1, y1: 4, x2: 3, y2: 1, color: 'blue', side: 'right' });
  });

  it('сниппеты: блок и inline', () => {
    expect(buildPlotSnippet('x 0 2\nf x', 'block')).toBe('\n```plot\nx 0 2\nf x\n```\n');
    expect(buildPlotSnippet('x 0 2\nf x', 'inline')).toBe('`plot: x 0 2; f x`');
  });
});
