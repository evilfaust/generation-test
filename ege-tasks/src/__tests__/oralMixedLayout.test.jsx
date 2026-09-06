import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import OralMixedPrintLayout from '../components/trig/OralMixedPrintLayout';
import { variantsPerPage } from '../components/trig/OralCountingPrintLayout';

// Смешанная работа устного счёта: раскладка листа. Ячейки и CSS общие с
// OralCountingPrintLayout, поэтому проверяем именно группировку вариантов.
const task = (n) => ({ exprLatex: `${n} + ${n}`, resultLatex: String(n * 2) });

const variant = (number) => ({
  number,
  sections: [
    { id: 'oral_counting', label: 'Устный счёт', tasks: [task(1), task(2)] },
    { id: 'oral_fractions', label: 'Дроби', tasks: [task(3)] },
  ],
});

const variants = (n) => Array.from({ length: n }, (_, i) => variant(i + 1));

const renderSheet = (count, settings) =>
  render(
    <OralMixedPrintLayout
      variants={variants(count)}
      title="Смешанная работа"
      settings={{ showTeacherKey: false, ...settings }}
    />,
  );

describe('OralMixedPrintLayout — вариантов на листе', () => {
  it('4 варианта на A4: одна сетка, четыре ячейки-четверти', () => {
    const { container } = renderSheet(4, { variantsPerPage: 4 });
    expect(container.querySelectorAll('.oral-quad-page')).toHaveLength(1);
    expect(container.querySelectorAll('.oral-page--quad')).toHaveLength(4);
    // разделы внутри четверти никуда не делись
    expect(container.querySelectorAll('.oral-page--quad .oral-mixed-section').length).toBe(8);
  });

  it('восемь вариантов при раскладке 4 — два листа по четыре', () => {
    const { container } = renderSheet(8, { variantsPerPage: 4 });
    expect(container.querySelectorAll('.oral-quad-page')).toHaveLength(2);
    expect(container.querySelectorAll('.oral-page--quad')).toHaveLength(8);
  });

  it('раскладки 6 и 8 получают свой модификатор ряда', () => {
    const six = renderSheet(6, { variantsPerPage: 6 });
    expect(six.container.querySelector('.oral-quad-page--r3')).toBeTruthy();
    six.unmount();

    const eight = renderSheet(8, { variantsPerPage: 8 });
    expect(eight.container.querySelector('.oral-quad-page--r4')).toBeTruthy();
  });

  it('прежние раскладки на месте: 2 рядом, 2 верх/низ, 1 на лист', () => {
    const side = renderSheet(2, { variantsPerPage: '2side' });
    expect(side.container.querySelectorAll('.oral-pair-page')).toHaveLength(1);
    expect(side.container.querySelectorAll('.oral-page--side')).toHaveLength(2);
    side.unmount();

    const half = renderSheet(2, { variantsPerPage: '2half' });
    expect(half.container.querySelectorAll('.oral-page--half')).toHaveLength(2);
    half.unmount();

    const full = renderSheet(2, { variantsPerPage: 1 });
    expect(full.container.querySelectorAll('.oral-page--full')).toHaveLength(2);
  });

  it('сохранённые листы со старыми ключами читаются по-прежнему', () => {
    expect(variantsPerPage({ sideBySide: true })).toBe('2side');
    expect(variantsPerPage({ sideBySide: false, twoPerPage: true })).toBe('2half');
    expect(variantsPerPage({ sideBySide: false, twoPerPage: false })).toBe(1);

    const { container } = renderSheet(2, { sideBySide: true });
    expect(container.querySelectorAll('.oral-pair-page')).toHaveLength(1);
  });
});
