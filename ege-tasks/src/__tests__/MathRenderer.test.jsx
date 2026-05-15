import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MathRenderer from '../shared/components/MathRenderer';

// KaTeX требует CSS, в jsdom нет стилей — формулы рендерятся как HTML-элементы
// Проверяем наличие контента и структуры, не визуальное отображение

describe('MathRenderer', () => {
  it('рендерит обычный текст', () => {
    render(<MathRenderer text="Привет мир" />);
    expect(screen.getByText('Привет мир')).toBeInTheDocument();
  });

  it('принимает prop content вместо text', () => {
    render(<MathRenderer content="через content" />);
    expect(screen.getByText('через content')).toBeInTheDocument();
  });

  it('возвращает null при отсутствии text и content', () => {
    const { container } = render(<MathRenderer />);
    expect(container.firstChild).toBeNull();
  });

  it('возвращает null для пустой строки', () => {
    const { container } = render(<MathRenderer text="" />);
    expect(container.firstChild).toBeNull();
  });

  it('рендерит markdown — жирный текст', () => {
    render(<MathRenderer text="**жирный**" />);
    const bold = document.querySelector('strong');
    expect(bold).not.toBeNull();
    expect(bold.textContent).toBe('жирный');
  });

  it('рендерит markdown — курсив', () => {
    render(<MathRenderer text="_курсив_" />);
    const em = document.querySelector('em');
    expect(em).not.toBeNull();
  });

  it('рендерит markdown — таблицу', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    render(<MathRenderer text={md} />);
    expect(document.querySelector('table')).not.toBeNull();
  });

  it('рендерит inline LaTeX формулу (KaTeX)', () => {
    render(<MathRenderer text="Найдите $x^2 + 1$" />);
    // KaTeX рендерит в span.katex
    const katexEl = document.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('рендерит блочную LaTeX формулу (KaTeX)', () => {
    // В jsdom rehype-katex рендерит блочную формулу внутри <p> без .katex-display,
    // поэтому проверяем только наличие .katex
    render(<MathRenderer text="$$\\frac{a}{b}$$" />);
    const katexEl = document.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('параграфы рендерятся с margin: 0', () => {
    render(<MathRenderer text="Текст параграфа" />);
    const p = document.querySelector('p');
    expect(p).not.toBeNull();
    expect(p.style.margin).toBe('0px');
  });

  it('text имеет приоритет над content', () => {
    render(<MathRenderer text="from text" content="from content" />);
    expect(screen.getByText('from text')).toBeInTheDocument();
  });
});
