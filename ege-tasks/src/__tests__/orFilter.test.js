import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chunkArray, buildOrFilter, orChunks, OR_CHUNK_SIZE } from '../shared/utils/orFilter';

const getFullList = vi.fn();
vi.mock('../shared/services/pb/client.js', () => ({
  pb: { collection: () => ({ getFullList: (...args) => getFullList(...args) }) },
}));

const { getFullListByOr } = await import('../shared/services/pb/chunked.js');

const ids = (n, prefix = 'id') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('orFilter', () => {
  it('режет массив на куски заданного размера', () => {
    expect(chunkArray(ids(120)).map(c => c.length)).toEqual([50, 50, 20]);
    expect(chunkArray([], 10)).toEqual([]);
    expect(chunkArray(ids(3), 10).map(c => c.length)).toEqual([3]);
  });

  it('строит OR-фильтр с экранированием и заданным оператором', () => {
    expect(buildOrFilter('work', ['a', 'b'])).toBe('work = "a" || work = "b"');
    expect(buildOrFilter('tasks', ['a'], '~')).toBe('tasks ~ "a"');
    expect(buildOrFilter('id', ['a"b'])).toBe('id = "a\\"b"');
  });

  it('выбрасывает пустые значения и дубликаты', () => {
    expect(orChunks(['a', 'a', null, '', 'b'])).toEqual([['a', 'b']]);
  });

  // Порог подобран под лимиты PocketBase (400 примерно от 130 условий)
  // и nginx (414 на URL длиннее ~8 КБ).
  it('держит длину query в безопасных пределах', () => {
    const filter = buildOrFilter('work', ids(OR_CHUNK_SIZE, 'u8gvutq06zvs28'));
    expect(encodeURIComponent(filter).length).toBeLessThan(4000);
  });
});

describe('getFullListByOr', () => {
  beforeEach(() => {
    getFullList.mockReset();
    // Возвращаем по записи на каждое значение из фильтра — с уникальным id,
    // чтобы дедупликация не съедала записи разных кусков.
    getFullList.mockImplementation(({ filter }) => {
      const values = [...filter.matchAll(/"([^"]+)"/g)].map(m => m[1]);
      return Promise.resolve(values.map(v => ({ id: `rec-${v}` })));
    });
  });

  it('не ходит в сеть на пустом списке', async () => {
    expect(await getFullListByOr('work_sessions', 'work', [])).toEqual([]);
    expect(getFullList).not.toHaveBeenCalled();
  });

  it('делит 260 значений на 6 запросов и склеивает результат', async () => {
    const res = await getFullListByOr('work_sessions', 'work', ids(260), { fields: 'id,work' });
    expect(getFullList).toHaveBeenCalledTimes(6);
    expect(res).toHaveLength(260);
    expect(getFullList.mock.calls[0][0].fields).toBe('id,work');
  });

  it('добавляет extraFilter к каждому куску', async () => {
    await getFullListByOr('attempts', 'session', ids(60), {}, { extraFilter: 'status = "submitted"' });
    for (const [opts] of getFullList.mock.calls) {
      expect(opts.filter).toContain('&& status = "submitted"');
    }
  });

  it('дедуплицирует записи по id (актуально для оператора ~)', async () => {
    getFullList.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]);
    const res = await getFullListByOr('variants', 'tasks', ids(120), {}, { op: '~' });
    expect(res.map(r => r.id)).toEqual(['v1', 'v2']);
  });
});
