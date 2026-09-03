import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { categoryPlan, buildVariantsByPlan, generateByCategories, plannedTotal } from '../utils/questionPlan';
import { useSheetLayout } from '../hooks/useSheetLayout';
import OralCountingPrintLayout, { variantsPerPage } from '../components/trig/OralCountingPrintLayout';
import { generateLinearEquationVariants, DEFAULT_SETTINGS_LINEQ } from '../hooks/useLinearEquations';
import { generateOralCountingVariants, DEFAULT_SETTINGS } from '../hooks/useOralCounting';

describe('план заданий', () => {
  it('раскладывает включённые категории по кругу', () => {
    expect(categoryPlan(['a', 'b'], 5)).toEqual(['a', 'b', 'a', 'b', 'a']);
    expect(categoryPlan([], 5)).toEqual([]);
  });

  it('на каждой позиции — категория плана', () => {
    const variants = buildVariantsByPlan({
      plan: ['a', 'b', 'a'],
      variantsCount: 3,
      make: (cat) => ({ cat }),
    });
    expect(variants).toHaveLength(3);
    for (const v of variants) expect(v.map(q => q.cat)).toEqual(['a', 'b', 'a']);
  });

  it('если категория не даёт задания, позицию занимает другая', () => {
    const [variant] = buildVariantsByPlan({
      plan: ['bad', 'good'],
      variantsCount: 1,
      make: (cat) => (cat === 'bad' ? null : { cat }),
      attempts: 3,
      fallbackCats: ['good'],
    });
    expect(variant).toHaveLength(2);
    expect(variant[0].cat).toBe('good');
  });

  it('квота типа соблюдается, остальные делят остаток', () => {
    const plan = categoryPlan(['a', 'b', 'c'], 9, { c: 4 });
    expect(plan).toHaveLength(9);
    expect(plan.filter(x => x === 'c')).toHaveLength(4);
    // a и b делят оставшиеся пять: 3 и 2
    expect(plan.filter(x => x === 'a')).toHaveLength(3);
    expect(plan.filter(x => x === 'b')).toHaveLength(2);
    // типы чередуются, а не идут группой
    expect(new Set(plan.slice(0, 3)).size).toBe(3);
  });

  it('квоты могут задать весь лист и превысить ползунок', () => {
    const plan = categoryPlan(['a', 'b'], 5, { a: 4, b: 4 });
    expect(plan).toHaveLength(8);
    expect(plannedTotal({ a: true, b: true }, 5, { a: 4, b: 4 })).toBe(8);
  });

  it('квота выключенной категории не учитывается', () => {
    expect(plannedTotal({ a: true, b: false }, 6, { b: 5 })).toBe(6);
    expect(categoryPlan(['a'], 6, { b: 5 }).every(x => x === 'a')).toBe(true);
  });

  it('без квот распределение прежнее', () => {
    expect(categoryPlan(['a', 'b'], 5)).toEqual(['a', 'b', 'a', 'b', 'a']);
    expect(plannedTotal({ a: true, b: true }, 5)).toBe(5);
  });

  it('квоты доезжают до генерации заданий', () => {
    const variants = generateByCategories({
      categories: { a: true, b: true },
      counts: { a: 5 },
      questionsCount: 8,
      variantsCount: 2,
      make: (cat) => ({ cat }),
    });
    for (const v of variants) {
      expect(v.filter(q => q.cat === 'a')).toHaveLength(5);
      expect(v).toHaveLength(8);
    }
  });

  it('пустой набор категорий даёт пустой результат', () => {
    expect(generateByCategories({
      categories: { a: false },
      questionsCount: 5,
      variantsCount: 2,
      make: () => ({}),
    })).toEqual([]);
  });
});

describe('во всех вариантах задания одного типа на одинаковых местах', () => {
  const sameCatsByPosition = (variants) => {
    const first = variants[0].map(q => q.cat);
    for (const v of variants) expect(v.map(q => q.cat)).toEqual(first);
  };

  it('линейные уравнения', () => {
    const variants = generateLinearEquationVariants({
      ...DEFAULT_SETTINGS_LINEQ, variantsCount: 6, questionsCount: 12,
    });
    expect(variants).toHaveLength(6);
    sameCatsByPosition(variants);
  });

  it('устный счёт', () => {
    const variants = generateOralCountingVariants({
      ...DEFAULT_SETTINGS, variantsCount: 5, questionsCount: 15,
    });
    expect(variants).toHaveLength(5);
    sameCatsByPosition(variants);
  });
});

describe('план листа: порядок и черта', () => {
  const tasks = [[{ exprLatex: 'a' }, { exprLatex: 'b' }, { exprLatex: 'c' }]];

  it('начинается с естественного порядка', () => {
    const { result } = renderHook(() => useSheetLayout(tasks));
    expect(result.current.layout).toEqual([
      { kind: 'task', idx: 0 }, { kind: 'task', idx: 1 }, { kind: 'task', idx: 2 },
    ]);
  });

  it('перетаскивание меняет местами, сброс возвращает', () => {
    const { result } = renderHook(() => useSheetLayout(tasks));
    act(() => result.current.move(2, 0));
    expect(result.current.layout.map(i => i.idx)).toEqual([2, 0, 1]);

    act(() => result.current.reset());
    expect(result.current.layout.map(i => i.idx)).toEqual([0, 1, 2]);
  });

  it('черта добавляется и удаляется, задания при этом не трогаются', () => {
    const { result } = renderHook(() => useSheetLayout(tasks));
    act(() => result.current.addDivider(1));
    expect(result.current.layout.map(i => i.kind))
      .toEqual(['task', 'divider', 'task', 'task']);

    // задание по этому индексу удалить нельзя — убирается только черта
    act(() => result.current.removeAt(0));
    expect(result.current.layout).toHaveLength(4);

    act(() => result.current.removeAt(1));
    expect(result.current.layout.map(i => i.kind)).toEqual(['task', 'task', 'task']);
  });
});

describe('печать по плану листа', () => {
  const tasksData = [[
    { exprLatex: '2x = 8', resultLatex: '4', varLatex: 'x' },
    { exprLatex: '3y = 9', resultLatex: '3', varLatex: 'y' },
    { exprLatex: '5z = 5', resultLatex: '1', varLatex: 'z' },
  ]];
  const base = { showTeacherKey: false, columnsCount: 1, variantsPerPage: 1 };

  const renderSheet = (props) => render(
    <OralCountingPrintLayout
      tasksData={tasksData}
      settings={base}
      title="Лист"
      screenMode
      {...props}
    />,
  );

  it('без плана печатает задания подряд', () => {
    const { container } = renderSheet();
    expect(container.querySelectorAll('.oral-task')).toHaveLength(3);
    expect(container.querySelector('.oral-divider')).toBeNull();
  });

  it('черта печатается и не сдвигает нумерацию заданий', () => {
    const { container } = renderSheet({
      layout: [
        { kind: 'task', idx: 0 },
        { kind: 'divider', id: 'd1' },
        { kind: 'task', idx: 1 },
        { kind: 'task', idx: 2 },
      ],
    });
    expect(container.querySelectorAll('.oral-divider')).toHaveLength(1);
    const nums = [...container.querySelectorAll('.oral-task-num')].map(n => n.textContent);
    expect(nums).toEqual(['1)', '2)', '3)']);
  });

  it('порядок в плане определяет порядок на листе', () => {
    const { container } = renderSheet({
      layout: [
        { kind: 'task', idx: 2 },
        { kind: 'task', idx: 0 },
        { kind: 'task', idx: 1 },
      ],
    });
    const exprs = [...container.querySelectorAll('.oral-task-expr')].map(e => e.textContent);
    expect(exprs[0]).toContain('5');
    expect(exprs[1]).toContain('2');
  });
});

describe('вариантов на листе', () => {
  it('новый ключ имеет приоритет над старыми', () => {
    expect(variantsPerPage({ variantsPerPage: 4 })).toBe(4);
    expect(variantsPerPage({ variantsPerPage: 1, sideBySide: true })).toBe(1);
  });

  it('без нового ключа работают старые настройки', () => {
    expect(variantsPerPage({ sideBySide: true })).toBe('2side');
    expect(variantsPerPage({ twoPerPage: true })).toBe('2half');
    expect(variantsPerPage({})).toBe(1);
  });

  // jsdom импортированный CSS не применяет, поэтому геометрию листа сторожим
  // по исходнику: квадрант обязан быть ячейкой сетки, а не листом 210 мм.
  const quadCss = () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/trig/OralCountingPrintLayout.css'),
      'utf-8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = (selector) => {
      const i = css.indexOf(selector);
      expect(i, selector).toBeGreaterThan(-1);
      const open = css.indexOf('{', i);      // селекторы выровнены пробелами
      return css.slice(open, css.indexOf('}', open));
    };
    return { css, rule };
  };

  it('на экране квадрант не тянет ширину целого листа', () => {
    const { rule } = quadCss();
    // .oral-page задаёт 210mm — для квадранта её обязательно снимать
    expect(rule('.oral-screen-root .oral-page')).toContain('width: 210mm');
    expect(rule('.oral-screen-root .oral-page--quad')).toContain('width: auto');
  });

  it('сетка листа — две колонки на две строки, линии реза внутри', () => {
    const { rule } = quadCss();
    for (const sel of ['.oral-quad-page', '.oral-screen-root .oral-quad-page']) {
      const r = rule(sel);
      expect(r).toContain('grid-template-columns: 1fr 1fr');
      expect(r).toContain('grid-template-rows: 1fr 1fr');
    }
    expect(rule('.oral-page--quad:nth-child(2n)')).toContain('border-right: none');
    expect(rule('.oral-page--quad:nth-child(n+3)')).toContain('border-bottom: none');
  });

  it('квадрант не прячет переполнение — иначе задания пропали бы молча', () => {
    const { rule } = quadCss();
    expect(rule('.oral-page--quad')).not.toContain('overflow: hidden');
    expect(rule('.oral-screen-root .oral-page--quad')).not.toContain('overflow: hidden');
  });

  it('режим «4 на листе» кладёт четыре варианта в одну сетку', () => {
    const four = Array.from({ length: 4 }, (_, v) => [
      { exprLatex: `${v}x = 1`, resultLatex: '1', varLatex: 'x' },
    ]);
    const { container } = render(
      <OralCountingPrintLayout
        tasksData={four}
        settings={{ variantsPerPage: 4, showTeacherKey: false }}
        title="Лист"
        screenMode
      />,
    );
    expect(container.querySelectorAll('.oral-quad-page')).toHaveLength(1);
    expect(container.querySelectorAll('.oral-page--quad')).toHaveLength(4);
    // порядок в сетке: 1-2 верхний ряд, 3-4 нижний
    const badges = [...container.querySelectorAll('.oral-variant-badge')].map(b => b.textContent);
    expect(badges).toEqual(['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4']);
    // задания печатаются в одну колонку — квадрант узкий
    expect(container.querySelectorAll('.oral-grid--1col')).toHaveLength(4);
  });

  it('восемь вариантов — два листа по четыре', () => {
    const eight = Array.from({ length: 8 }, (_, v) => [
      { exprLatex: `${v}x = 1`, resultLatex: '1', varLatex: 'x' },
    ]);
    const { container } = render(
      <OralCountingPrintLayout
        tasksData={eight}
        settings={{ variantsPerPage: 4, showTeacherKey: false }}
        title="Лист"
        screenMode
      />,
    );
    expect(container.querySelectorAll('.oral-quad-page')).toHaveLength(2);
    expect(container.querySelectorAll('.oral-page--quad')).toHaveLength(8);
  });
});
