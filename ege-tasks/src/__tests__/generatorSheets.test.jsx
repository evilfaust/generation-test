import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  isFlatTasksData, taskCount, patchTask, replaceTask,
  removeTaskEverywhere, appendTaskEverywhere, tasksAtPosition,
} from '../utils/sheetTasks';
import {
  SHEET_GENERATORS, SHEET_GENERATOR_TYPES, getSheetGenerator,
  sheetGeneratorLabel, sheetKind, regenerateOneTask,
} from '../utils/sheetRegistry';
import { useSheetLayout } from '../hooks/useSheetLayout';
import { useSheetTaskEditing } from '../hooks/useSheetTaskEditing';

const task = (id, cat = 'a') => ({ exprLatex: `expr${id}`, resultLatex: `ans${id}`, cat });
const flat = () => [
  [task(1), task(2), task(3)],
  [task(4), task(5), task(6)],
];

describe('снимок заданий листа', () => {
  it('распознаёт плоскую форму', () => {
    expect(isFlatTasksData(flat())).toBe(true);
    expect(isFlatTasksData(null)).toBe(false);
    expect(isFlatTasksData([])).toBe(false);
    // смешанная работа — другая форма, поштучная правка к ней не применяется
    expect(isFlatTasksData([{ number: 1, sections: [] }])).toBe(false);
    expect(taskCount(flat())).toBe(3);
  });

  it('правка задания меняет только его вариант и позицию', () => {
    const src = flat();
    const next = patchTask(src, 1, 0, { exprLatex: 'правка' });
    expect(next[1][0].exprLatex).toBe('правка');
    expect(next[1][0].resultLatex).toBe('ans4');   // остальные поля целы
    expect(next[0][0].exprLatex).toBe('expr1');    // первый вариант не тронут
    expect(next).not.toBe(src);                    // новый массив, без мутации
    expect(src[1][0].exprLatex).toBe('expr4');
  });

  it('замена задания подставляет новое целиком', () => {
    const next = replaceTask(flat(), 0, 2, task(99, 'b'));
    expect(next[0][2]).toEqual(task(99, 'b'));
    expect(next[1][2]).toEqual(task(6));
  });

  it('удаление позиции убирает её во всех вариантах', () => {
    const next = removeTaskEverywhere(flat(), 1);
    expect(next[0].map(t => t.exprLatex)).toEqual(['expr1', 'expr3']);
    expect(next[1].map(t => t.exprLatex)).toEqual(['expr4', 'expr6']);
  });

  it('несуществующая позиция ничего не ломает', () => {
    const src = flat();
    expect(removeTaskEverywhere(src, 9)).toBe(src);
    expect(removeTaskEverywhere(null, 0)).toBe(null);
  });

  it('своё задание одинаково во всех вариантах', () => {
    const next = appendTaskEverywhere(flat(), { exprLatex: 'моё', resultLatex: '7' });
    expect(next[0]).toHaveLength(4);
    expect(next[1][3].exprLatex).toBe('моё');
    // копия, а не общий объект: правка в одном варианте не тронет другие
    expect(next[0][3]).not.toBe(next[1][3]);
  });

  it('одна позиция во всех вариантах — для модалки правки', () => {
    const rows = tasksAtPosition(flat(), 2);
    expect(rows.map(r => r.variantIndex)).toEqual([0, 1]);
    expect(rows.map(r => r.task.exprLatex)).toEqual(['expr3', 'expr6']);
  });
});

describe('реестр листовых генераторов', () => {
  const appSource = readFileSync(resolve(__dirname, '../App.jsx'), 'utf-8');

  it('маршруты реестра совпадают с маршрутами приложения', () => {
    // Реестр лежит в utils/ и не может импортировать R из App.jsx (цикл),
    // поэтому пути продублированы строками — этот тест их и сторожит.
    for (const [type, meta] of Object.entries(SHEET_GENERATORS)) {
      expect(appSource, `маршрут генератора ${type}`).toContain(`'${meta.route}'`);
    }
  });

  it('у плоских генераторов есть чистая функция генерации', () => {
    for (const type of SHEET_GENERATOR_TYPES) {
      const meta = getSheetGenerator(type);
      if (sheetKind(type) === 'flat') {
        expect(typeof meta.generate, `generate у ${type}`).toBe('function');
      }
    }
  });

  it('смешанные работы помечены другой формой снимка', () => {
    expect(sheetKind('oral_mixed')).toBe('sections');
    expect(sheetKind('trig_mixed')).toBe('sections');
    expect(sheetKind('linear_equations')).toBe('flat');
    // неизвестный тип считаем плоским — так вела себя вся прежняя раскладка
    expect(sheetKind('нет такого')).toBe('flat');
  });

  it('метка неизвестного типа не пустая', () => {
    expect(sheetGeneratorLabel('linear_equations')).toBe('Линейные уравнения');
    expect(sheetGeneratorLabel('старый_генератор')).toBe('старый_генератор');
  });
});

describe('перегенерация одного задания', () => {
  it('уравнение приходит той же категории, что заменяемое', () => {
    const settings = {
      questionsCount: 10,
      variantsCount: 4,
      categories: { intCoef: true, likeTerms: true, brackets: true },
    };
    const fresh = regenerateOneTask('linear_equations', settings, 'intCoef');
    expect(fresh).toBeTruthy();
    expect(fresh.cat).toBe('intCoef');
    expect(fresh.exprLatex).toContain('=');
    expect(fresh.resultLatex).toBeTruthy();
  });

  it('устный счёт отдаёт одно задание, а не весь лист', () => {
    const fresh = regenerateOneTask('oral_counting', {
      questionsCount: 12, variantsCount: 8,
      categories: { fracTimesInt: true },
    }, 'fracTimesInt');
    expect(fresh).toBeTruthy();
    expect(fresh).not.toBeInstanceOf(Array);
    expect(fresh.exprLatex).toBeTruthy();
  });

  it('у смешанной работы перегенерации нет — возвращается null', () => {
    expect(regenerateOneTask('oral_mixed', {}, null)).toBe(null);
    expect(regenerateOneTask('нет такого', {}, null)).toBe(null);
  });
});

describe('порядок заданий при загрузке и правке листа', () => {
  it('apply ставит сохранённый порядок и не даёт сбросить его на естественный', () => {
    const data = flat();
    const { result, rerender } = renderHook(({ td }) => useSheetLayout(td), {
      initialProps: { td: null },
    });

    const saved = [
      { kind: 'task', idx: 2 },
      { kind: 'divider', id: 'd1' },
      { kind: 'task', idx: 0 },
      { kind: 'task', idx: 1 },
    ];
    act(() => result.current.apply(data, saved));
    rerender({ td: data });

    expect(result.current.layout).toEqual(saved);
  });

  it('сохранённый порядок с чужими индексами чинится, а не роняет лист', () => {
    const data = flat();
    const { result } = renderHook(() => useSheetLayout(data));

    act(() => result.current.apply(data, [
      { kind: 'task', idx: 5 },   // задания уже нет
      { kind: 'task', idx: 1 },
      { kind: 'task', idx: 1 },   // дубль
    ]));

    const idxs = result.current.layout.filter(i => i.kind === 'task').map(i => i.idx);
    expect(idxs).toEqual([1, 0, 2]);  // порядок сохранён, недостающие дописаны
  });

  it('удаление задания сдвигает номера следующих', () => {
    const data = flat();
    const { result } = renderHook(() => useSheetLayout(data));
    act(() => result.current.removeTask(1));
    expect(result.current.layout).toEqual([
      { kind: 'task', idx: 0 },
      { kind: 'task', idx: 1 },   // было idx 2
    ]);
  });

  it('новая генерация возвращает естественный порядок', () => {
    const { result, rerender } = renderHook(({ td }) => useSheetLayout(td), {
      initialProps: { td: flat() },
    });
    act(() => result.current.move(0, 2));
    expect(result.current.layout[2].idx).toBe(0);

    rerender({ td: flat() });   // «Сформировать» — новый снимок
    expect(result.current.layout).toEqual([
      { kind: 'task', idx: 0 }, { kind: 'task', idx: 1 }, { kind: 'task', idx: 2 },
    ]);
  });
});

describe('правка листа сохраняет расстановку заданий', () => {
  // Правка меняет tasksData — без переноса порядка лист бы «распрямлялся»
  // на каждую опечатку (useSheetLayout пересчитывает layout на новый снимок).
  function setup(initial) {
    return renderHook(() => {
      const [tasksData, setTasksData] = require('react').useState(initial);
      const order = useSheetLayout(tasksData);
      const editing = useSheetTaskEditing({
        generator: 'linear_equations',
        settings: { categories: { intCoef: true } },
        tasksData,
        setTasksData,
        order,
      });
      return { tasksData, order, editing };
    });
  }

  it('правка текста не сбрасывает порядок и черту', () => {
    const { result } = setup(flat());
    act(() => result.current.order.move(0, 2));
    act(() => result.current.order.addDivider(1));
    const before = result.current.order.layout;

    act(() => result.current.editing.patch(0, 0, { exprLatex: 'исправлено' }));

    expect(result.current.tasksData[0][0].exprLatex).toBe('исправлено');
    expect(result.current.order.layout).toEqual(before);
  });

  it('удаление задания убирает позицию из листа и из порядка', () => {
    const { result } = setup(flat());
    act(() => result.current.editing.remove(0));

    expect(result.current.tasksData[0]).toHaveLength(2);
    expect(result.current.tasksData[1]).toHaveLength(2);
    expect(result.current.order.layout).toEqual([
      { kind: 'task', idx: 0 }, { kind: 'task', idx: 1 },
    ]);
  });

  it('своё задание попадает во все варианты и в порядок листа', () => {
    const { result } = setup(flat());
    act(() => result.current.editing.append({ exprLatex: 'моё', resultLatex: '5' }));

    expect(result.current.tasksData[1][3].exprLatex).toBe('моё');
    expect(result.current.tasksData[1][3].cat).toBe('manual');
    expect(result.current.order.layout).toHaveLength(4);
  });
});
