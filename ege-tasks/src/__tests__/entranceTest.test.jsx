import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import EntranceTestPrint, { paginateByHeight, BODY_W_MM } from '../components/entrance-test/EntranceTestPrint';
import { getPreset, ENTRANCE_PRESETS, SOLUTION_SPACE_MM } from '../components/entrance-test/presets';

// jsdom импортированный CSS не применяет, а `?raw` на .css в vitest отдаёт
// пустую строку — поэтому печатные стили сторожим по исходнику с диска.
const printCss = () =>
  readFileSync(
    resolve(process.cwd(), 'src/components/print-sheet/printSheet.css'),
    'utf-8'
  ).replace(/\/\*[\s\S]*?\*\//g, '');

const wrapper = ({ children }) => <App>{children}</App>;

const task = (n, extra = {}) => ({
  id: `t${n}`,
  code: `EGE-${n}`,
  statement_md: `Найдите значение выражения $${n} + ${n}$`,
  answer: String(n * 2),
  ...extra,
});

const meta = {
  eyebrow: 'Входная контрольная работа',
  title: 'Математика',
  subtitle: 'Диагностика на входе в 10 класс',
  classLabel: '10 класс',
  duration: 45,
  dateLabel: '1 сентября 2026',
  instruction: 'Работа состоит из 2 заданий.\nКалькулятором пользоваться нельзя.',
  notesTitle: 'Дополнительная информация',
  notes: 'Работа не влияет на оценку за четверть.',
  showStudentFields: true,
};

const variants = [{ number: 1, tasks: [task(1), task(2)] }];

describe('paginateByHeight', () => {
  const h = (map) => new Map(Object.entries(map));

  it('складывает задачи в страницы по измеренным высотам с учётом зазора', () => {
    const tasks = [1, 2, 3, 4].map(n => ({ __key: `k${n}` }));
    const heights = h({ k1: 100, k2: 100, k3: 100, k4: 100 });
    // зазор 20: на первой 100+20+100=220, третья не влезает (340 > 220)
    const pages = paginateByHeight(tasks, heights, 220, 340, 20);
    expect(pages.map(p => p.length)).toEqual([2, 2]);
  });

  it('первая страница меньше остальных — хвост уезжает дальше', () => {
    const tasks = [1, 2, 3].map(n => ({ __key: `k${n}` }));
    const pages = paginateByHeight(tasks, h({ k1: 100, k2: 100, k3: 100 }), 110, 400, 20);
    expect(pages.map(p => p.length)).toEqual([1, 2]);
  });

  it('задача выше страницы остаётся одна на своей странице', () => {
    const tasks = [1, 2].map(n => ({ __key: `k${n}` }));
    const pages = paginateByHeight(tasks, h({ k1: 50, k2: 9999 }), 100, 100, 20);
    expect(pages.map(p => p.length)).toEqual([1, 1]);
  });

  it('зазор по умолчанию не нулевой — задачи не липнут друг к другу', () => {
    const tasks = [1, 2].map(n => ({ __key: `k${n}` }));
    // 100 + gap + 100 не влезает в 205 только если gap > 5
    const pages = paginateByHeight(tasks, h({ k1: 100, k2: 100 }), 205, 205);
    expect(pages.map(p => p.length)).toEqual([1, 1]);
  });

  it('пустой список задач не даёт страниц', () => {
    expect(paginateByHeight([], new Map(), 100, 100)).toEqual([]);
  });
});

describe('пресеты входной работы', () => {
  it('содержат три школьных сценария и «свой шаблон»', () => {
    expect(ENTRANCE_PRESETS.map(p => p.id)).toEqual([
      'oge_9_10', 'base_10_11', 'profile_10_11', 'custom',
    ]);
  });

  it('getPreset возвращает первый пресет для неизвестного id', () => {
    expect(getPreset('нет такого').id).toBe('oge_9_10');
  });

  it('у каждого пресета есть заголовок, время и тип экзамена в мете', () => {
    ENTRANCE_PRESETS.forEach(p => {
      expect(p.meta.title).toBeTruthy();
      expect(p.meta.duration).toBeGreaterThan(0);
    });
  });
});

describe('EntranceTestPrint — макет «набор задач»', () => {
  it('печатает шапку: надзаголовок, название и поля ученика', () => {
    render(<EntranceTestPrint variants={variants} meta={meta} />, { wrapper });

    expect(screen.getAllByText('Входная контрольная работа').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Математика').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Фамилия, имя').length).toBeGreaterThan(0);
  });

  it('поле «Класс» убирается отдельным тумблером, остальные остаются', () => {
    const withClass = render(<EntranceTestPrint variants={variants} meta={meta} />, { wrapper });
    const labels = (r) =>
      [...r.container.querySelectorAll('.ps-page .ps-field-label')].map(el => el.textContent);
    expect(labels(withClass)).toEqual(['Фамилия, имя', 'Класс', 'Дата']);
    withClass.unmount();

    const noClass = render(
      <EntranceTestPrint variants={variants} meta={{ ...meta, showClassField: false }} />,
      { wrapper }
    );
    expect(labels(noClass)).toEqual(['Фамилия, имя', 'Дата']);
  });

  it('метаданные идут одной строкой с правильным склонением', () => {
    const { container } = render(<EntranceTestPrint variants={variants} meta={meta} />, { wrapper });
    const line = container.querySelector('.ps-page .ps-meta').textContent;
    expect(line).toContain('10 класс');
    expect(line).toContain('45 мин');
    expect(line).toContain('2 задания');
    expect(line).toContain('1 сентября 2026');
  });

  it('разбивает инструкцию на абзацы и печатает доп. информацию врезкой', () => {
    const { container } = render(<EntranceTestPrint variants={variants} meta={meta} />, { wrapper });
    expect(screen.getAllByText('Работа состоит из 2 заданий.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Калькулятором пользоваться нельзя.').length).toBeGreaterThan(0);

    const labels = [...container.querySelectorAll('.ps-page .ps-note-label')].map(el => el.textContent.trim());
    expect(labels).toEqual(['Инструкция.', 'Дополнительная информация.']);
  });

  it('лист монохромный: ни один инлайн-стиль не тащит цвет', () => {
    const { container } = render(
      <EntranceTestPrint variants={variants} meta={meta} layout="workbook" />, { wrapper }
    );
    const styled = [...container.querySelectorAll('.ps-page [style]')]
      .map(el => el.getAttribute('style'))
      .join(' ');
    expect(styled).not.toMatch(/#[0-9a-f]{3,8}|rgb|hsl/i);
  });

  it('в режиме «набор задач» есть строка ответа и нет зоны решения', () => {
    const { container } = render(<EntranceTestPrint variants={variants} meta={meta} />, { wrapper });
    expect(container.querySelectorAll('.ps-answer').length).toBeGreaterThan(0);
    expect(container.querySelector('.ps-solution')).toBeNull();
  });

  it('строку ответа можно выключить', () => {
    const { container } = render(
      <EntranceTestPrint variants={variants} meta={meta} options={{ answerLine: false }} />,
      { wrapper }
    );
    expect(container.querySelector('.ps-answer')).toBeNull();
  });

  it('лист ответов показывает ответы задач и его можно отключить', () => {
    const { container, unmount } = render(
      <EntranceTestPrint variants={variants} meta={meta} />, { wrapper }
    );
    expect(container.querySelector('.ps-page--key')).toBeTruthy();
    expect(screen.getAllByText('Ответы').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.ps-page--key .ps-key-cell').length).toBe(2);
    unmount();

    const second = render(
      <EntranceTestPrint variants={variants} meta={meta} showAnswersPage={false} />, { wrapper }
    );
    expect(second.container.querySelector('.ps-page--key')).toBeNull();
  });

  it('нижний колонтитул печатается по умолчанию и выключается тумблером', () => {
    const on = render(<EntranceTestPrint variants={variants} meta={meta} />, { wrapper });
    expect(on.container.querySelectorAll('.ps-page .ps-foot').length).toBeGreaterThan(0);
    on.unmount();

    const off = render(
      <EntranceTestPrint variants={variants} meta={meta} options={{ showFooter: false }} />,
      { wrapper }
    );
    expect(off.container.querySelector('.ps-foot')).toBeNull();
    // шапка и задачи на месте — выключается только подвал
    expect(off.container.querySelectorAll('.ps-page .ps-task').length).toBe(2);
  });

  it('номер варианта показывается, когда вариантов больше одного', () => {
    const { container } = render(
      <EntranceTestPrint
        variants={[{ number: 1, tasks: [task(1)] }, { number: 2, tasks: [task(3)] }]}
        meta={{ ...meta, alwaysShowVariant: false }}
      />,
      { wrapper }
    );
    expect(container.querySelectorAll('.ps-page .ps-variant').length).toBe(2);
  });

  it('без вариантов ничего не рендерит', () => {
    const { container } = render(<EntranceTestPrint variants={[]} meta={meta} />, { wrapper });
    expect(container.querySelector('.ps-root')).toBeNull();
  });
});

describe('EntranceTestPrint — формулы', () => {
  const sqrtTask = {
    id: 'sq',
    code: 'EGE-16',
    statement_md: String.raw`Найдите значение выражения $-4\sqrt{3}\sin(-780^\circ)$`,
    answer: '6',
  };

  it('радикал \\sqrt рендерится на печатном листе', () => {
    const { container } = render(
      <EntranceTestPrint variants={[{ number: 1, tasks: [sqrtTask] }]} meta={meta} />,
      { wrapper }
    );
    const page = container.querySelector('.ps-page');
    expect(page.querySelector('.katex .sqrt')).toBeTruthy();
    // KaTeX рисует знак корня инлайновым <svg> внутри .hide-tail
    expect(page.querySelectorAll('.katex .hide-tail svg').length).toBeGreaterThan(0);
  });

  it('в CSS нет глобального правила по svg внутри условия', () => {
    // Регрессия 28.08.2026: `.ps-task-text svg { max-width: 100% }` (добавлено
    // ради встроенных numline/plot) схлопывало 400em-радикал KaTeX в ноль —
    // на печати вместо «−4√3 sin(−780°)» выходило «−4  3 sin(−780°)».
    // jsdom импортированный CSS не применяет, а `?raw` на .css отдаёт пустую
    // строку (vitest глушит CSS) — поэтому читаем файл с диска.
    const cssPath = resolve(process.cwd(), 'src/components/print-sheet/printSheet.css');
    const css = readFileSync(cssPath, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.length).toBeGreaterThan(1000);
    expect(css).not.toMatch(/\.ps-task-text\s+svg\s*[,{]/);
  });
});

describe('EntranceTestPrint — чертежи и пагинация', () => {
  // image_url отдаётся getTaskImageUrl как есть — не требует живого PocketBase
  const imgTask = {
    id: 'img1',
    code: 'EGE-09',
    statement_md: 'Найдите площадь четырёхугольника (см. рис.).',
    has_image: true,
    image_url: 'https://example.test/figure.png',
    kimImageSize: 'l',
    answer: '12',
  };

  it('чертёж попадает и в зону измерения, и на лист', () => {
    const { container } = render(
      <EntranceTestPrint variants={[{ number: 1, tasks: [imgTask] }]} meta={meta} />,
      { wrapper }
    );
    // без картинки в measure-зоне пагинации нечего дожидаться, и высота задачи
    // будет посчитана без чертежа
    expect(container.querySelectorAll('.ps-measure img').length).toBe(1);
    expect(container.querySelectorAll('.ps-page img').length).toBe(1);
  });

  it('лист не обрезает контент: min-height вместо height + overflow:hidden', () => {
    // Регрессия 28.08.2026: чертежи догружались уже после замера, задача
    // вырастала, и хвост страницы молча съедался overflow:hidden — с листа
    // пропадали целые задания. Лист обязан расти, а не резать.
    const rule = printCss().match(/^\.ps-page \{([^}]*)\}/m);
    expect(rule).toBeTruthy();
    expect(rule[1]).toMatch(/min-height:\s*297mm/);
    expect(rule[1]).not.toMatch(/overflow:\s*hidden/);
    expect(rule[1]).not.toMatch(/[^-]height:\s*297mm/);
  });
});

describe('EntranceTestPrint — макет «рабочая тетрадь»', () => {
  it('добавляет зону решения заданной высоты с клеткой', () => {
    const { container } = render(
      <EntranceTestPrint
        variants={variants}
        meta={meta}
        layout="workbook"
        options={{ solutionSpace: 'l', solutionFill: 'grid' }}
      />,
      { wrapper }
    );
    const solution = container.querySelector('.ps-page .ps-solution');
    expect(solution).toBeTruthy();
    expect(solution.style.height).toBe(`${SOLUTION_SPACE_MM.l}mm`);
    // линии клетки считаются точно под блок, без запаса (иначе Chrome ужимает лист)
    const vLines = solution.querySelectorAll('.ps-fill-v');
    expect(vLines.length).toBe(Math.ceil((BODY_W_MM - 10) / 5) - 1);
    const lastLeft = parseFloat(vLines[vLines.length - 1].style.left);
    expect(lastLeft).toBeLessThan(BODY_W_MM - 10);
  });

  it('разлиновка «линейка» рисует только горизонтальные линии', () => {
    const { container } = render(
      <EntranceTestPrint
        variants={variants}
        meta={meta}
        layout="workbook"
        options={{ solutionSpace: 'm', solutionFill: 'lines' }}
      />,
      { wrapper }
    );
    expect(container.querySelectorAll('.ps-page .ps-fill-h').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.ps-page .ps-fill-v').length).toBe(0);
  });

  it('разлиновка «пусто» не рисует линий', () => {
    const { container } = render(
      <EntranceTestPrint
        variants={variants}
        meta={meta}
        layout="workbook"
        options={{ solutionSpace: 'm', solutionFill: 'blank' }}
      />,
      { wrapper }
    );
    expect(container.querySelector('.ps-fill')).toBeNull();
  });

  it('«Нет места для решения» убирает зону целиком', () => {
    const { container } = render(
      <EntranceTestPrint
        variants={variants}
        meta={meta}
        layout="workbook"
        options={{ solutionSpace: 'none' }}
      />,
      { wrapper }
    );
    expect(container.querySelector('.ps-solution')).toBeNull();
  });
});
