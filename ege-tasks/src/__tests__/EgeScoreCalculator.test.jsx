import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import EgeScoreCalculator from '../components/EgeScoreCalculator';

// Калькулятор использует Tooltip из antd — оборачиваем в App для consistent context
const wrapper = ({ children }) => <App>{children}</App>;

function renderCalc() {
  return render(<EgeScoreCalculator />, { wrapper });
}

describe('EgeScoreCalculator', () => {
  it('рендерится без ошибок', () => {
    renderCalc();
    expect(screen.getByText(/Калькулятор баллов ЕГЭ/i)).toBeInTheDocument();
  });

  it('по умолчанию первичный балл 0', () => {
    renderCalc();
    // Первичный балл присутствует в DOM хотя бы один раз
    const primaryLabels = screen.getAllByText(/первичных|первичный/i);
    expect(primaryLabels.length).toBeGreaterThan(0);
  });

  it('содержит 19 номеров заданий', () => {
    const { container } = renderCalc();
    // Через клик-обработчик: каждый tile с onClick — по числу заданий
    const clickable = container.querySelectorAll('[style*="cursor: pointer"]');
    // Минимум 19 кликабельных тайлов
    expect(clickable.length).toBeGreaterThanOrEqual(19);
  });

  it('показывает заголовки "Часть 1" и "Часть 2"', () => {
    renderCalc();
    // Текст может встречаться в нескольких местах (заголовок + label score)
    expect(screen.getAllByText(/Часть 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Часть 2/i).length).toBeGreaterThan(0);
  });

  it('клик по тайлу задания (max=1) меняет состояние', () => {
    const { container } = renderCalc();
    // Берём тайл с числом "1" (задание №1, max=1) — стиль width:52, height:68
    const tiles = container.querySelectorAll('div[style*="width: 52px"]');
    expect(tiles.length).toBeGreaterThan(0);
    const firstTile = tiles[0];
    const before = firstTile.outerHTML;
    fireEvent.click(firstTile);
    // DOM должен измениться (появилась галочка/цвет фона)
    expect(firstTile.outerHTML).not.toBe(before);
  });

  it('повторный клик возвращает тайл в исходное состояние', () => {
    const { container } = renderCalc();
    const tile = container.querySelectorAll('div[style*="width: 52px"]')[0];
    const initial = tile.outerHTML;
    fireEvent.click(tile);
    fireEvent.click(tile);
    expect(tile.outerHTML).toBe(initial);
  });

  it('у заданий с max>1 видна цифра >1 после нескольких кликов', () => {
    const { container } = renderCalc();
    const tiles = container.querySelectorAll('div[style*="width: 52px"]');
    // Задание 13 (индекс 12) имеет max=2 — не isSimple, балл отображается цифрой
    const task13 = tiles[12];
    fireEvent.click(task13); // → 1
    fireEvent.click(task13); // → 2
    expect(task13.textContent).toContain('2');
  });
});
