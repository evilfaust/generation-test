import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RouteStatementRenderer from '../components/route-sheet/RouteStatementRenderer';

describe('RouteStatementRenderer', () => {
  it('возвращает null для пустого content', () => {
    const { container } = render(<RouteStatementRenderer content="" />);
    expect(container.firstChild).toBeNull();
  });

  it('возвращает null для null content', () => {
    const { container } = render(<RouteStatementRenderer content={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('рендерит обычный текст', () => {
    const { container } = render(<RouteStatementRenderer content="Просто текст" />);
    expect(container.textContent).toBe('Просто текст');
  });

  it('обёрнут в span.rs-stmt-inline', () => {
    const { container } = render(<RouteStatementRenderer content="abc" />);
    expect(container.firstChild.className).toBe('rs-stmt-inline');
  });

  it('рендерит inline LaTeX $...$ через KaTeX', () => {
    const { container } = render(<RouteStatementRenderer content="вычислите $x^2$" />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).toContain('вычислите');
  });

  it('рендерит блочный LaTeX $$...$$ с классом rs-math-block', () => {
    const { container } = render(<RouteStatementRenderer content="$$\\frac{a}{b}$$" />);
    expect(container.querySelector('.rs-math-block')).not.toBeNull();
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('рендерит плейсхолдер [①] вне LaTeX как span.rs-ph с символом', () => {
    const { container } = render(<RouteStatementRenderer content="ответ [①]" />);
    const ph = container.querySelector('.rs-ph');
    expect(ph).not.toBeNull();
    expect(ph.textContent).toBe('①');
  });

  it('поддерживает несколько плейсхолдеров', () => {
    const { container } = render(
      <RouteStatementRenderer content="[①] и [②] и [③]" />
    );
    const phs = container.querySelectorAll('.rs-ph');
    expect(phs).toHaveLength(3);
    expect(phs[0].textContent).toBe('①');
    expect(phs[1].textContent).toBe('②');
    expect(phs[2].textContent).toBe('③');
  });

  it('комбинирует LaTeX и плейсхолдер', () => {
    const { container } = render(
      <RouteStatementRenderer content="$x = $ [①], $y = $ [②]" />
    );
    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll('.rs-ph')).toHaveLength(2);
  });

  it('плейсхолдер внутри LaTeX встраивается в \\textcolor', () => {
    // $x + [①] = 5$ — плейсхолдер должен быть вставлен в формулу
    const { container } = render(
      <RouteStatementRenderer content="$x + [①] = 5$" />
    );
    // Полный текст внутри katex должен содержать ①
    const katex = container.querySelector('.katex');
    expect(katex).not.toBeNull();
    expect(katex.textContent).toContain('①');
  });

  it('одинарный $ без закрытия идёт как обычный текст', () => {
    const { container } = render(<RouteStatementRenderer content="цена $5" />);
    expect(container.textContent).toContain('цена $5');
  });

  it('некорректный LaTeX не падает (throwOnError: false)', () => {
    expect(() =>
      render(<RouteStatementRenderer content="$\\invalidcmd{x}$" />)
    ).not.toThrow();
  });
});
