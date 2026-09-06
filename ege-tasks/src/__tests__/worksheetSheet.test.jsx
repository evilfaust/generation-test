import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import PrintSheet from '../components/print-sheet/PrintSheet';
import { hasFigure } from '../components/print-sheet/SheetTask';
import { figureSizeVars } from '../utils/kimImageSize';
import {
  paginateFixedCount, paginateIntoColumns, MM, SOLUTION_GAP_MM, SOLUTION_SPACE_MM,
  TASK_GAP_PX, MARGIN_PRESETS, columnWidthMm, bodyWidthMm,
} from '../components/print-sheet/geometry';

const wrapper = ({ children }) => <App>{children}</App>;

const task = (n) => ({
  id: `t${n}`,
  code: `EGE-${n}`,
  statement_md: `Найдите значение выражения $${n} + ${n}$`,
  answer: String(n * 2),
});

const variants = [{ number: 1, tasks: [task(1), task(2)] }];
const meta = { title: 'Лист задач', showStudentFields: true };

const sheet = (props = {}) => render(
  <PrintSheet variants={variants} meta={meta} headerMode="compact" layout="workbook" {...props} />,
  { wrapper }
);

describe('paginateFixedCount — режим «N заданий на лист»', () => {
  const items = [1, 2, 3, 4, 5].map(n => ({ __key: `k${n}` }));
  const zero = new Map(items.map(it => [it.__key, 0]));

  it('набивает страницы ровно по N', () => {
    const pages = paginateFixedCount(items, zero, 2, 1000, 1000);
    expect(pages.map(p => p.items.length)).toEqual([2, 2, 1]);
  });

  it('весь остаток листа делит между заданиями поровну', () => {
    const capPx = 200 * MM;
    const heights = new Map([['k1', 10 * MM], ['k2', 20 * MM]]);
    const [page] = paginateFixedCount(
      [{ __key: 'k1' }, { __key: 'k2' }], heights, 2, capPx, capPx, 0
    );
    // (200 − 10 − 20 − 2 отступа зоны) / 2
    expect(page.solutionMm).toBeCloseTo((200 - 30 - 2 * SOLUTION_GAP_MM) / 2, 1);
  });

  it('неполную последнюю страницу считает по N — блоки одного размера', () => {
    const capPx = 200 * MM;
    const pages = paginateFixedCount(items, zero, 2, capPx, capPx, 0);
    expect(pages[2].items.length).toBe(1);
    expect(pages[2].solutionMm).toBeCloseTo(pages[0].solutionMm, 1);
  });

  it('когда места почти не осталось — зоны решения нет', () => {
    const heights = new Map([['k1', 190 * MM]]);
    const [page] = paginateFixedCount([{ __key: 'k1' }], heights, 1, 200 * MM, 200 * MM, 0);
    expect(page.solutionMm).toBe(0);
  });

  it('хвост (шифровка) отъедает место только у последней страницы', () => {
    const capPx = 200 * MM;
    const pages = paginateFixedCount(
      [{ __key: 'k1' }, { __key: 'k2' }], zero, 1, capPx, capPx, TASK_GAP_PX, 50 * MM
    );
    expect(pages[1].solutionMm).toBeLessThan(pages[0].solutionMm);
  });
});

describe('Лист задач — шапка', () => {
  it('компактная шапка: название, вариант и поля, без блока инструкции', () => {
    const { container } = sheet({
      meta: { ...meta, instruction: 'Работа состоит из 2 заданий.' },
    });
    expect(container.querySelector('.ps-page .ps-head--compact')).toBeTruthy();
    expect(screen.getAllByText('Лист задач').length).toBeGreaterThan(0);
    expect(container.querySelector('.ps-page .ps-note')).toBeNull();
    expect([...container.querySelectorAll('.ps-page .ps-field-label')].map(el => el.textContent))
      .toEqual(['Фамилия, имя', 'Класс', 'Дата']);
  });

  it('полная шапка печатает инструкцию и надзаголовок', () => {
    const { container } = sheet({
      headerMode: 'full',
      meta: { ...meta, eyebrow: 'Самостоятельная работа', instruction: 'Ответы записывайте рядом.' },
    });
    expect(container.querySelector('.ps-page .ps-head--compact')).toBeNull();
    expect(container.querySelector('.ps-page .ps-note')).toBeTruthy();
    expect(screen.getAllByText('Самостоятельная работа').length).toBeGreaterThan(0);
  });

  it('поля ФИО отключаются тумблером', () => {
    const { container } = sheet({ meta: { ...meta, showStudentFields: false } });
    expect(container.querySelector('.ps-fields')).toBeNull();
  });
});

describe('Лист задач — поле ответа и место для решения', () => {
  it('строка ответа по умолчанию', () => {
    const { container } = sheet();
    expect(container.querySelectorAll('.ps-page .ps-answer').length).toBe(2);
    expect(container.querySelector('.ps-answer-box')).toBeNull();
  });

  it('«поле справа» рисует квадрат вместо строки', () => {
    const { container } = sheet({ options: { answerStyle: 'box' } });
    expect(container.querySelectorAll('.ps-page .ps-answer-box').length).toBe(2);
    expect(container.querySelector('.ps-page .ps-answer')).toBeNull();
  });

  it('«нет» убирает и строку, и поле — самый компактный вид', () => {
    const { container } = sheet({ options: { answerStyle: 'none' } });
    expect(container.querySelector('.ps-page .ps-answer')).toBeNull();
    expect(container.querySelector('.ps-page .ps-answer-box')).toBeNull();
    expect(container.querySelector('.ps-page .ps-solution')).toBeNull();
  });

  it('фиксированная зона решения задаёт высоту из пресета', () => {
    const { container } = sheet({ options: { solutionSpace: 'l' } });
    const solution = container.querySelector('.ps-page .ps-solution');
    expect(solution.style.height).toBe(`${SOLUTION_SPACE_MM.l}mm`);
  });

  it('готовый ответ под условием заменяет пустую строку', () => {
    const { container } = sheet({ options: { showAnswersInline: true } });
    expect(container.querySelectorAll('.ps-page .ps-task-answer').length).toBe(2);
    expect(container.querySelector('.ps-page .ps-answer')).toBeNull();
  });

  it('режим «N на лист» бьёт задачи по страницам ровно по N', () => {
    const { container } = render(
      <PrintSheet
        variants={[{ number: 1, tasks: [task(1), task(2), task(3), task(4)] }]}
        meta={meta}
        headerMode="compact"
        layout="workbook"
        showAnswersPage={false}
        options={{ solutionSpace: 'fit', tasksPerPage: 2 }}
      />,
      { wrapper }
    );
    expect(container.querySelectorAll('.ps-page').length).toBe(2);
    expect(container.querySelectorAll('.ps-page .ps-task').length).toBe(4);
  });
});

describe('Лист задач — правка на экране', () => {
  const editing = { onEditTask: () => {}, onReplaceTask: () => {} };

  it('кнопки правки есть на листе и помечены no-print', () => {
    const { container } = sheet({ editing });
    const controls = container.querySelectorAll('.ps-page .ps-task-controls');
    expect(controls.length).toBe(2);
    controls.forEach(el => expect(el.classList.contains('no-print')).toBe(true));
  });

  it('в зоне измерения кнопок нет — иначе они попадут в высоту задачи', () => {
    const { container } = sheet({ editing });
    expect(container.querySelector('.ps-measure .ps-task-controls')).toBeNull();
  });

  it('лист остаётся монохромным даже с кнопками правки', () => {
    const { container } = sheet({ editing, options: { solutionSpace: 'm' } });
    const styled = [...container.querySelectorAll('.ps-page [style]')]
      .map(el => el.getAttribute('style'))
      .join(' ');
    expect(styled).not.toMatch(/#[0-9a-f]{3,8}|rgb|hsl/i);
  });
});

describe('Лист задач — хвостовой блок (шифровка)', () => {
  it('печатается на листе и участвует в измерении', () => {
    const { container } = sheet({
      renderTail: () => <section className="ps-crypt">Шифровка по ответам</section>,
    });
    expect(container.querySelectorAll('.ps-page .ps-crypt').length).toBe(1);
    expect(container.querySelectorAll('.ps-measure .ps-crypt').length).toBe(1);
  });

  it('без renderTail блока нет', () => {
    const { container } = sheet();
    expect(container.querySelector('.ps-crypt')).toBeNull();
  });
});

describe('paginateIntoColumns — вёрстка в две колонки', () => {
  const items = [1, 2, 3, 4, 5, 6].map(n => ({ __key: `k${n}` }));
  const heights = new Map(items.map(it => [it.__key, 100]));

  it('колонка набивается доверху, потом начинается вторая, потом новая страница', () => {
    const pages = paginateIntoColumns(items, heights, 250, 250, 20, 2);
    // последняя страница неполная — её остаток раскладывается поровну
    expect(pages.map(p => p.map(c => c.length))).toEqual([[2, 2], [1, 1]]);
  });

  it('остаток на последней странице не сваливается в одну колонку', () => {
    const four = [1, 2, 3, 4].map(n => ({ __key: `k${n}` }));
    const zero = new Map(four.map(it => [it.__key, 0]));
    expect(paginateIntoColumns(four, zero, 1000, 1000, 20, 2)[0].map(c => c.length))
      .toEqual([2, 2]);
  });

  it('шапка укорачивает обе колонки первой страницы', () => {
    const pages = paginateIntoColumns(items, heights, 100, 250, 20, 2);
    expect(pages[0].map(c => c.length)).toEqual([1, 1]);
    expect(pages[1][0].length).toBe(2);
  });

  it('задача выше колонки остаётся в ней одна', () => {
    const tall = new Map([['k1', 9999], ['k2', 50]]);
    const pages = paginateIntoColumns([{ __key: 'k1' }, { __key: 'k2' }], tall, 100, 100, 20, 2);
    expect(pages[0].map(c => c.length)).toEqual([1, 1]);
  });
});

describe('Геометрия полей', () => {
  it('узкие поля отдают под задачи 12 мм ширины', () => {
    expect(bodyWidthMm('narrow') - bodyWidthMm('normal')).toBe(12);
    expect(MARGIN_PRESETS.narrow.x).toBe(8);
  });

  it('ширина колонки = (лист − зазор) / 2', () => {
    expect(columnWidthMm('normal', 2)).toBe((bodyWidthMm('normal') - 8) / 2);
    expect(columnWidthMm('normal', 1)).toBe(bodyWidthMm('normal'));
  });
});

describe('Лист задач — колонки и поля', () => {
  const four = [{ number: 1, tasks: [task(1), task(2), task(3), task(4)] }];

  it('две колонки: сетка на листе, зона измерения сужается до колонки', () => {
    const { container } = render(
      <PrintSheet variants={four} meta={meta} headerMode="compact" columns={2} showAnswersPage={false} />,
      { wrapper }
    );
    expect(container.querySelector('.ps-body--cols')).toBeTruthy();
    expect(container.querySelectorAll('.ps-page .ps-col').length).toBe(2);
    const root = container.querySelector('.ps-root');
    expect(root.style.getPropertyValue('--ps-measure-w')).toBe(`${columnWidthMm('normal', 2)}mm`);
  });

  it('шапка меряется шириной листа, задачи — шириной колонки', () => {
    const { container } = render(
      <PrintSheet variants={four} meta={meta} headerMode="compact" columns={2} showAnswersPage={false} />,
      { wrapper }
    );
    // шапка в своей зоне полной ширины, задачи — в узкой
    expect(container.querySelectorAll('.ps-measure--head .ps-head').length).toBe(1);
    expect(container.querySelectorAll('.ps-measure--head .ps-task').length).toBe(0);
    const root = container.querySelector('.ps-root');
    expect(root.style.getPropertyValue('--ps-body-w')).toBe(`${bodyWidthMm('normal')}mm`);
  });

  it('одна колонка — сетки нет', () => {
    const { container } = sheet();
    expect(container.querySelector('.ps-body--cols')).toBeNull();
    expect(container.querySelector('.ps-col')).toBeNull();
  });

  it('узкие поля прокидываются в CSS-переменные листа', () => {
    const { container } = sheet({ margins: 'narrow' });
    const root = container.querySelector('.ps-root');
    expect(root.style.getPropertyValue('--ps-pad-x')).toBe('8mm');
    expect(root.style.getPropertyValue('--ps-pad-top')).toBe('8mm');
  });

  it('«N на лист» в двух колонках не включается — делить остаток не на что', () => {
    const { container } = render(
      <PrintSheet
        variants={four}
        meta={meta}
        headerMode="compact"
        layout="workbook"
        columns={2}
        showAnswersPage={false}
        options={{ solutionSpace: 'fit', tasksPerPage: 2 }}
      />,
      { wrapper }
    );
    expect(container.querySelectorAll('.ps-page .ps-col').length).toBe(2);
    expect(container.querySelector('.ps-solution')).toBeNull();
  });
});

describe('Лист задач — чертежи', () => {
  const figTask = {
    id: 'f1',
    code: 'EGE-09',
    statement_md: 'Найдите площадь (см. рис.).',
    has_image: true,
    image_url: 'https://example.test/figure.png',
    answer: '12',
  };

  it('hasFigure ловит и картинку задачи, и картинку markdown, и наш чертёж', () => {
    expect(hasFigure(figTask)).toBe(true);
    expect(hasFigure({ statement_md: 'Смотри ![](http://a/b.png)' })).toBe(true);
    expect(hasFigure({ statement_md: 'Прямая\n```numline\ndomain 0 2\n```' })).toBe(true);
    expect(hasFigure({ statement_md: 'Найдите $x$' })).toBe(false);
  });

  it('hasFigure ловит inline-форму из ячеек таблиц', () => {
    // «на каком рисунке изображено множество решений» — 4 прямые галереей
    const md = '{галерея}\n| 1) `numline: domain 0 3` | 2) `numline: ray left 1` |';
    expect(hasFigure({ statement_md: md })).toBe(true);
    expect(hasFigure({ statement_md: '| А) $x<0$ | `plot: x -3 3; f x^2` |' })).toBe(true);
  });

  it('общий размер чертежей раздаётся переменными листа', () => {
    const { container } = sheet({ options: { figureSize: 'l' } });
    const root = container.querySelector('.ps-root');
    expect(root.style.getPropertyValue('--ps-fig-w')).toBe('70%');
    expect(root.style.getPropertyValue('--ps-fig-h')).toBe('55mm');
    // у чертежа в ячейке таблицы своя база — ширина ячейки
    expect(root.style.getPropertyValue('--ps-fig-cell-w')).toBe('85%');
  });

  it('шкала для ячеек растёт вместе с общей и упирается в ширину ячейки', () => {
    const cell = (size) => figureSizeVars(size)['--ps-fig-cell-w'];
    expect([cell('s'), cell('m'), cell('l'), cell('xl')])
      .toEqual(['50%', '70%', '85%', '100%']);
  });

  it('чертёж из ячейки таблицы попадает на лист внутри ячейки — по ней и бьёт CSS', () => {
    const md = '| 1) `numline: domain 0 3` | 2) `numline: ray left 1` |\n| --- | --- |\n| | |';
    const { container } = render(
      <PrintSheet
        variants={[{ number: 1, tasks: [{ id: 'g1', statement_md: md, answer: '1' }] }]}
        meta={meta}
        headerMode="compact"
        showAnswersPage={false}
      />,
      { wrapper }
    );
    // первая строка таблицы у GFM всегда шапка — поэтому CSS обязан покрывать
    // и td, и th (в задачах-галереях варианты часто оказываются именно в th)
    const cellFigures = container.querySelectorAll(
      '.ps-page .ps-task-text td .numline > svg, .ps-page .ps-task-text th .numline > svg'
    );
    expect(cellFigures.length).toBe(2);
  });

  it('печать: порталы Ant скрыты, ширина документа ограничена листом', () => {
    // Регрессия 02.09.2026: тултип Ant от кнопок правки висит порталом в body
    // с экранными координатами. visibility:hidden прячет его, но не убирает из
    // потока — Chrome считал документ шириной ~1300px и ужимал лист до 62%,
    // прижимая к левому верхнему углу. Воспроизведено печатью в headless Chrome.
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/print-sheet/printSheet.css'), 'utf-8'
    );
    const print = css.slice(css.lastIndexOf('@media print'));
    expect(print).toMatch(/body:has\(\.ps-root\) \.ant-tooltip/);
    expect(print).toMatch(/body:has\(\.ps-root\) \.ant-modal-wrap/);
    expect(print).toMatch(/html:has\(\.ps-root\)[\s\S]{0,200}overflow:\s*hidden/);
    expect(print).toMatch(/max-width:\s*210mm/);
  });

  it('в CSS нет глобального правила по svg внутри условия', () => {
    // Регрессия 28.08.2026: `.ps-task-text svg { … }` схлопывает 400em-радикал
    // KaTeX. Масштабировать можно только наши чертежи — по .mr-figure и
    // .numline/.coordplot.
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/print-sheet/printSheet.css'), 'utf-8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/\.ps-task-text\s+svg\s*[,{]/);
    expect(css).toMatch(/\.ps-task-text td \.numline > svg/);
    expect(css).toMatch(/\.ps-task-text th \.numline > svg/);
  });

  it('личный размер задачи перебивает общий', () => {
    const { container } = render(
      <PrintSheet
        variants={[{ number: 1, tasks: [{ ...figTask, kimImageSize: 'xl' }] }]}
        meta={meta}
        headerMode="compact"
        showAnswersPage={false}
        options={{ figureSize: 's' }}
      />,
      { wrapper }
    );
    const article = container.querySelector('.ps-page .ps-task');
    expect(article.style.getPropertyValue('--ps-fig-w')).toBe('100%');
  });

  it('тумблер «показывать» вешает на лист класс скрытия чертежей', () => {
    const { container } = sheet({ options: { showFigures: false } });
    expect(container.querySelector('.ps-root--nofig')).toBeTruthy();
  });

  it('размер чертежа правится на карточке — только у задач с чертежом', () => {
    const { container } = render(
      <PrintSheet
        variants={[{ number: 1, tasks: [figTask, task(2)] }]}
        meta={meta}
        headerMode="compact"
        showAnswersPage={false}
        editing={{ onEditTask: () => {}, onSetFigureSize: () => {} }}
      />,
      { wrapper }
    );
    expect(container.querySelectorAll('.ps-page .ps-task-controls .ant-segmented').length).toBe(1);
  });
});

describe('Лист задач — редактируемая шапка', () => {
  it('заголовок, дата и класс печатаются из настроек', () => {
    const { container } = sheet({
      meta: { ...meta, title: 'Устный счёт', classLabel: '7 класс', dateLabel: '5 сентября' },
    });
    expect(screen.getAllByText('Устный счёт').length).toBeGreaterThan(0);
    const metaLine = container.querySelector('.ps-page .ps-meta').textContent;
    expect(metaLine).toContain('7 класс');
    expect(metaLine).toContain('5 сентября');
  });

  it('подпись в подвале задаётся вручную', () => {
    const { container } = sheet({ meta: { ...meta, footerNote: '7А · Петрова' } });
    expect(container.querySelector('.ps-page .ps-foot').textContent).toContain('7А · Петрова');
  });

  it('число заданий в метастроке убирается тумблером', () => {
    const on = sheet({ meta: { ...meta, classLabel: '7 класс' } });
    expect(on.container.querySelector('.ps-page .ps-meta').textContent).toContain('2 задания');
    on.unmount();

    const off = sheet({ meta: { ...meta, classLabel: '7 класс', showTasksCount: false } });
    const line = off.container.querySelector('.ps-page .ps-meta').textContent;
    expect(line).not.toContain('задания');
    expect(line).toContain('7 класс');   // остальное на месте
  });

  it('поле «Класс» убирается отдельно от остальных', () => {
    const { container } = sheet({ meta: { ...meta, showClassField: false } });
    expect([...container.querySelectorAll('.ps-page .ps-field-label')].map(el => el.textContent))
      .toEqual(['Фамилия, имя', 'Дата']);
  });
});

describe('надпись «Вариант N» (meta.showVariant)', () => {
  const oneVariant = [{ number: 1, tasks: [{ id: 't1', statement_md: 'Задача', answer: '5' }] }];
  const twoVariants = [
    { number: 1, tasks: [{ id: 't1', statement_md: 'Задача', answer: '5' }] },
    { number: 2, tasks: [{ id: 't2', statement_md: 'Задача', answer: '6' }] },
  ];

  it('без флага работает авто-правило: один вариант — без надписи, два — с надписью', () => {
    const one = render(<PrintSheet variants={oneVariant} meta={{ title: 'Лист' }} />, { wrapper });
    expect(one.container.querySelector('.ps-variant')).toBeNull();
    one.unmount();

    const two = render(<PrintSheet variants={twoVariants} meta={{ title: 'Лист' }} />, { wrapper });
    expect(two.container.querySelector('.ps-variant')).toBeTruthy();
  });

  it('showVariant=true добавляет надпись единственному варианту', () => {
    const { container } = render(
      <PrintSheet variants={oneVariant} meta={{ title: 'Лист', showVariant: true }} />,
      { wrapper },
    );
    expect(container.querySelector('.ps-variant')).toBeTruthy();
  });

  it('showVariant=false убирает надпись даже при нескольких вариантах', () => {
    const { container } = render(
      <PrintSheet variants={twoVariants} meta={{ title: 'Лист', showVariant: false }} />,
      { wrapper },
    );
    expect(container.querySelector('.ps-variant')).toBeNull();
  });

  it('в ключе учителя заголовок варианта скрывается только когда вариант один', () => {
    const one = render(
      <PrintSheet variants={oneVariant} meta={{ title: 'Лист', showVariant: false }} showAnswersPage />,
      { wrapper },
    );
    expect(one.container.querySelector('.ps-key-variant')).toBeNull();
    one.unmount();

    const two = render(
      <PrintSheet variants={twoVariants} meta={{ title: 'Лист', showVariant: false }} showAnswersPage />,
      { wrapper },
    );
    expect(two.container.querySelector('.ps-key-variant')).toBeTruthy();
  });
});
