import { describe, it, expect } from 'vitest';
import { parseSdamgiaSearch } from '../shared/utils/sdamgiaSearch';
import { tasksApi } from '../shared/services/pb/tasks';

describe('parseSdamgiaSearch', () => {
  it('достаёт номер из ссылки на задачу', () => {
    expect(parseSdamgiaSearch('https://math-oge.sdamgia.ru/problem?id=311151'))
      .toEqual({ id: '311151', exact: true });
    expect(parseSdamgiaSearch('https://math-ege.sdamgia.ru/problem?id=526912&print=true'))
      .toEqual({ id: '526912', exact: true });
  });

  it('понимает подпись со страницы решу', () => {
    expect(parseSdamgiaSearch('Задание 6 № 311151')).toEqual({ id: '311151', exact: true });
    expect(parseSdamgiaSearch('№311151')).toEqual({ id: '311151', exact: true });
  });

  it('голое число считает подсказкой, а не точным номером', () => {
    expect(parseSdamgiaSearch('311151')).toEqual({ id: '311151', exact: false });
  });

  it('короткие числа и обычный текст номером не считает', () => {
    expect(parseSdamgiaSearch('10')).toEqual({ id: '', exact: false });
    expect(parseSdamgiaSearch('треугольник')).toEqual({ id: '', exact: false });
    expect(parseSdamgiaSearch('')).toEqual({ id: '', exact: false });
  });
});

describe('_buildTasksFilter — номер решу', () => {
  it('по ссылке ищет только по sdamgia_id', () => {
    expect(tasksApi._buildTasksFilter({ search: 'https://math-oge.sdamgia.ru/problem?id=311151' }))
      .toBe('(sdamgia_id != "" && sdamgia_id = "311151")');
    expect(tasksApi._buildTasksFilter({ search: 'Задание 6 № 311151' }))
      .toBe('(sdamgia_id != "" && sdamgia_id = "311151")');
  });

  it('к голому числу добавляет номер решу вариантом к обычному поиску', () => {
    const f = tasksApi._buildTasksFilter({ search: '311151' });
    expect(f).toBe('(code ~ "311151" || statement_md ~ "311151" || sdamgia_id = "311151")');
  });

  it('точный поиск идёт под частичный индекс — с условием непустоты', () => {
    // PocketBase заводит индекс необязательного поля как
    // `CREATE INDEX … WHERE sdamgia_id != ''`, и SQLite использует его, только
    // если это же условие есть в запросе (замер на проде: 26 мс → 0 мс).
    expect(tasksApi._buildTasksFilter({ search: '№ 311151' })).toContain('sdamgia_id != ""');
  });

  it('текстовый поиск номером решу не трогает', () => {
    expect(tasksApi._buildTasksFilter({ search: 'куб' })).not.toContain('sdamgia_id');
  });

  it('соединяется с остальными фильтрами через &&', () => {
    const f = tasksApi._buildTasksFilter({ search: '№ 311151', topic: 'top1' });
    expect(f).toBe('(sdamgia_id != "" && sdamgia_id = "311151") && topic = "top1"');
  });
});
