import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  sheetOptions,
  sheetSpacingStyle,
  SHEET_DEFAULTS,
  LINE_SPACING_MIN,
  LINE_SPACING_MAX,
} from '../components/trig/sheetOptions';
import OralCountingPrintLayout from '../components/trig/OralCountingPrintLayout';
import TrigExprPrintLayout from '../components/trig/TrigExprPrintLayout';

const tasks = [[
  { exprLatex: '3x = 18', resultLatex: '6', varLatex: 'x' },
  { exprLatex: '5y = 20', resultLatex: '4', varLatex: 'y' },
]];

const base = { sideBySide: false, twoPerPage: false, showTeacherKey: false, columnsCount: 1 };

const renderOral = (settings = {}) => render(
  <OralCountingPrintLayout
    tasksData={tasks}
    settings={{ ...base, ...settings }}
    title="Устный счёт"
    screenMode
  />,
);

describe('настройки печатного листа', () => {
  it('без указаний ведёт себя как раньше', () => {
    expect(sheetOptions({})).toEqual(SHEET_DEFAULTS);
    expect(sheetOptions(undefined)).toEqual(SHEET_DEFAULTS);
  });

  it('читает флаги и зажимает интервал в допустимые границы', () => {
    expect(sheetOptions({ showClassField: false }).showClassField).toBe(false);
    expect(sheetOptions({ showHeader: false }).showHeader).toBe(false);
    expect(sheetOptions({ lineSpacing: 1.75 }).lineSpacing).toBe(1.75);
    expect(sheetOptions({ lineSpacing: 99 }).lineSpacing).toBe(LINE_SPACING_MAX);
    expect(sheetOptions({ lineSpacing: 0.1 }).lineSpacing).toBe(LINE_SPACING_MIN);
    // мусор в настройках не должен ломать печать
    expect(sheetOptions({ lineSpacing: 'абв' }).lineSpacing).toBe(1);
    expect(sheetOptions({ lineSpacing: 0 }).lineSpacing).toBe(1);
  });

  it('место для ответа выключается отдельно', () => {
    expect(sheetOptions({}).showAnswerSpace).toBe(true);
    expect(sheetOptions({ showAnswerSpace: false }).showAnswerSpace).toBe(false);
  });

  it('интервал уезжает в CSS-переменную', () => {
    expect(sheetSpacingStyle(1.5)).toEqual({ '--sheet-line-scale': 1.5 });
    expect(sheetSpacingStyle(undefined)).toEqual({ '--sheet-line-scale': 1 });
  });
});

describe('межстрочный интервал влияет на реальную высоту строки', () => {
  // jsdom импортированный CSS не применяет — сторожим по исходнику.
  const cssRule = (file, selector) => {
    const css = readFileSync(resolve(process.cwd(), file), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // именно это правило, а не первое совпадение подстроки: «.oral-task» иначе
    // попадает в «.oral-page--quad .oral-task», а «.texpr-question» — в «...s»
    const re = new RegExp(`(?:^|\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`);
    const m = css.match(re);
    expect(m, selector).toBeTruthy();
    const open = css.indexOf('{', m.index);
    return css.slice(open, css.indexOf('}', open));
  };

  const ORAL = 'src/components/trig/OralCountingPrintLayout.css';

  it('строка получает добавочный зазор, а не только минимальную высоту', () => {
    // min-height одной формулы не хватает: строка с дробью и так выше 7 мм,
    // поэтому ползунок обязан добавлять место сверху через margin
    for (const sel of ['.oral-task', '.oral-screen-root .oral-task']) {
      const rule = cssRule(ORAL, sel);
      expect(rule).toContain('min-height: calc(7mm * var(--sheet-line-scale, 1))');
      expect(rule).toContain('margin-bottom: calc((var(--sheet-line-scale, 1) - 1) * 6mm)');
    }
  });

  it('при интервале 1 добавка нулевая — прежний вид листа', () => {
    const rule = cssRule(ORAL, '.oral-task');
    const formula = rule.match(/margin-bottom: calc\(\(var\(--sheet-line-scale, 1\) - 1\) \* (\d+(?:\.\d+)?)mm\)/);
    expect(formula).toBeTruthy();
    const step = Number(formula[1]);
    expect((1 - 1) * step).toBe(0);      // масштаб 1 → 0 мм
    expect((2 - 1) * step).toBeGreaterThan(0);
    expect((0.75 - 1) * step).toBeLessThan(0);   // «Плотно» — строки ближе
  });

  it('в тригонометрических раскладках тот же зазор', () => {
    expect(cssRule('src/components/trig/TrigExprPrintLayout.css', '.texpr-question'))
      .toContain('margin-bottom: calc((var(--sheet-line-scale, 1) - 1) * 6mm)');
    expect(cssRule('src/components/trig/TrigMixedPrintLayout.css', '.tmixed-question'))
      .toContain('margin-bottom: calc((var(--sheet-line-scale, 1) - 1) * 6mm)');
  });
});

describe('раскладка устного счёта уважает настройки листа', () => {
  it('по умолчанию печатает шапку, класс, название и инструкцию', () => {
    renderOral();
    expect(screen.getByText(/Вариант 1/)).toBeInTheDocument();
    expect(screen.getByText(/ФИО:/)).toBeInTheDocument();
    expect(screen.getByText(/Класс:/)).toBeInTheDocument();
    expect(screen.getByText('Устный счёт')).toBeInTheDocument();
    expect(screen.getByText('Вычислите:')).toBeInTheDocument();
  });

  it('скрывает только поле «Класс», оставляя остальную шапку', () => {
    renderOral({ showClassField: false });
    expect(screen.queryByText(/Класс:/)).not.toBeInTheDocument();
    expect(screen.getByText(/ФИО:/)).toBeInTheDocument();
    expect(screen.getByText(/Дата:/)).toBeInTheDocument();
  });

  it('скрывает шапку целиком', () => {
    renderOral({ showHeader: false });
    expect(screen.queryByText(/ФИО:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Класс:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Вариант 1/)).not.toBeInTheDocument();
    // задания при этом на месте
    expect(screen.getByText('1)')).toBeInTheDocument();
  });

  it('скрывает название листа и строку задания по отдельности', () => {
    const { unmount } = renderOral({ showTitle: false });
    expect(screen.queryByText('Устный счёт')).not.toBeInTheDocument();
    expect(screen.getByText('Вычислите:')).toBeInTheDocument();
    unmount();

    renderOral({ showInstruction: false });
    expect(screen.getByText('Устный счёт')).toBeInTheDocument();
    expect(screen.queryByText('Вычислите:')).not.toBeInTheDocument();
  });

  it('без места для ответа строка кончается условием', () => {
    const { container, unmount } = renderOral();
    expect(container.querySelectorAll('.oral-task-eq')).toHaveLength(2);
    unmount();

    const withoutSpace = renderOral({ showAnswerSpace: false });
    expect(withoutSpace.container.querySelector('.oral-task-eq')).toBeNull();
    expect(withoutSpace.container.querySelector('.oral-task-x-prompt')).toBeNull();
    // сами задания на месте
    expect(withoutSpace.container.querySelectorAll('.oral-task')).toHaveLength(2);
  });

  it('в режиме уравнений «x =» тоже убирается', () => {
    const { container } = render(
      <OralCountingPrintLayout
        tasksData={tasks}
        settings={{ ...base, showAnswerSpace: false }}
        title="Уравнения"
        equationMode
        screenMode
      />,
    );
    expect(container.querySelector('.oral-task-x-prompt')).toBeNull();
    expect(container.querySelectorAll('.oral-task')).toHaveLength(2);
  });

  it('межстрочный интервал доезжает до корня раскладки', () => {
    const { container } = renderOral({ lineSpacing: 2 });
    const root = container.querySelector('.oral-screen-root');
    expect(root.style.getPropertyValue('--sheet-line-scale')).toBe('2');
  });
});

describe('тригонометрическая раскладка уважает настройки листа', () => {
  const renderTrig = (settings = {}) => render(
    <TrigExprPrintLayout
      tasksData={tasks}
      settings={{ twoPerPage: false, showTeacherKey: false, ...settings }}
      title="Значения функций"
      instruction="Вычислите:"
    />,
  );

  it('по умолчанию печатает класс, название и инструкцию', () => {
    renderTrig();
    expect(screen.getByText(/Класс:/)).toBeInTheDocument();
    expect(screen.getByText('Значения функций')).toBeInTheDocument();
    expect(screen.getByText('Вычислите:')).toBeInTheDocument();
  });

  it('скрывает класс, шапку, название и инструкцию', () => {
    const { unmount, container } = renderTrig({ showClassField: false });
    expect(screen.queryByText(/Класс:/)).not.toBeInTheDocument();
    expect(screen.getByText(/ФИО:/)).toBeInTheDocument();
    expect(container.querySelector('.texpr-print-root').style
      .getPropertyValue('--sheet-line-scale')).toBe('1');
    unmount();

    renderTrig({ showHeader: false, showTitle: false, showInstruction: false, lineSpacing: 1.25 });
    expect(screen.queryByText(/ФИО:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Значения функций')).not.toBeInTheDocument();
    expect(screen.queryByText('Вычислите:')).not.toBeInTheDocument();
  });
});
