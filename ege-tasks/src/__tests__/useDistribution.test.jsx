import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { App } from 'antd';
import { useDistribution } from '../hooks/useDistribution';

// useDistribution использует App.useApp() для message → нужен <App> wrapper
const wrapper = ({ children }) => <App>{children}</App>;

describe('useDistribution', () => {
  it('инициализируется пустым массивом', () => {
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.getTotal()).toBe(0);
  });

  it('addItem добавляет элемент с null ключом и count=1', () => {
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    act(() => result.current.addItem());
    expect(result.current.items).toEqual([{ tag: null, count: 1 }]);
  });

  it('removeItem удаляет элемент по индексу', () => {
    // Хук написан без functional setState — каждый вызов в отдельном act,
    // иначе используется stale closure и добавляется только последний.
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    act(() => result.current.addItem());
    act(() => result.current.addItem());
    act(() => result.current.addItem());
    expect(result.current.items).toHaveLength(3);
    act(() => result.current.removeItem(1));
    expect(result.current.items).toHaveLength(2);
  });

  it('updateItem меняет значение поля', () => {
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    act(() => result.current.addItem());
    act(() => result.current.updateItem(0, 'tag', 'алгебра'));
    expect(result.current.items[0].tag).toBe('алгебра');
  });

  it('getTotal суммирует count', () => {
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    act(() => result.current.addItem());
    act(() => result.current.addItem());
    act(() => result.current.updateItem(0, 'count', 5));
    act(() => result.current.updateItem(1, 'count', 3));
    expect(result.current.getTotal()).toBe(8);
  });

  it('onTotalChange вызывается при изменении count', () => {
    const onTotalChange = vi.fn();
    const { result } = renderHook(
      () => useDistribution('tag', { onTotalChange }),
      { wrapper }
    );
    act(() => result.current.addItem());
    // addItem с count=1 → onTotalChange(1)
    expect(onTotalChange).toHaveBeenCalledWith(1);
    act(() => result.current.updateItem(0, 'count', 10));
    expect(onTotalChange).toHaveBeenLastCalledWith(10);
  });

  it('onTotalChange НЕ вызывается при изменении не-count поля', () => {
    const onTotalChange = vi.fn();
    const { result } = renderHook(
      () => useDistribution('tag', { onTotalChange }),
      { wrapper }
    );
    act(() => result.current.addItem());
    onTotalChange.mockClear();
    act(() => result.current.updateItem(0, 'tag', 'геометрия'));
    expect(onTotalChange).not.toHaveBeenCalled();
  });

  it('validate возвращает false если ключевое поле пустое', () => {
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    act(() => result.current.addItem());
    expect(result.current.validate()).toBe(false);
  });

  it('validate возвращает false при дублях ключей', () => {
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    act(() => result.current.addItem());
    act(() => result.current.addItem());
    act(() => result.current.updateItem(0, 'tag', 'X'));
    act(() => result.current.updateItem(1, 'tag', 'X'));
    expect(result.current.validate()).toBe(false);
  });

  it('validate возвращает true при заполненных уникальных ключах', () => {
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    act(() => result.current.addItem());
    act(() => result.current.addItem());
    act(() => result.current.updateItem(0, 'tag', 'A'));
    act(() => result.current.updateItem(1, 'tag', 'B'));
    expect(result.current.validate()).toBe(true);
  });

  it('validate с expectedTotal проверяет совпадение суммы', () => {
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    act(() => result.current.addItem());
    act(() => result.current.updateItem(0, 'tag', 'A'));
    act(() => result.current.updateItem(0, 'count', 5));
    expect(result.current.validate(5)).toBe(true);
    expect(result.current.validate(10)).toBe(false);
  });

  it('reset очищает items', () => {
    const { result } = renderHook(() => useDistribution('tag'), { wrapper });
    act(() => result.current.addItem());
    act(() => result.current.addItem());
    act(() => result.current.reset());
    expect(result.current.items).toEqual([]);
  });

  it('работает с keyField=difficulty', () => {
    const { result } = renderHook(() => useDistribution('difficulty'), { wrapper });
    act(() => result.current.addItem());
    expect(result.current.items[0]).toEqual({ difficulty: null, count: 1 });
  });
});
