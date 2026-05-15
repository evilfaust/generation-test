import { describe, it, expect } from 'vitest';
import { shuffleArray } from '../shared/utils/shuffle';

describe('shuffleArray', () => {
  it('возвращает массив той же длины', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr)).toHaveLength(5);
  });

  it('содержит все исходные элементы', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffleArray(arr);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('не мутирует исходный массив', () => {
    const arr = [1, 2, 3];
    const original = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(original);
  });

  it('возвращает новый массив', () => {
    const arr = [1, 2, 3];
    expect(shuffleArray(arr)).not.toBe(arr);
  });

  it('корректно обрабатывает пустой массив', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it('корректно обрабатывает массив из одного элемента', () => {
    expect(shuffleArray([42])).toEqual([42]);
  });

  it('статистически создаёт хотя бы некоторое перемешивание (1000 прогонов)', () => {
    // Проверяем, что не всегда возвращает тот же порядок
    const arr = [1, 2, 3, 4, 5];
    let unchanged = 0;
    for (let i = 0; i < 1000; i++) {
      const r = shuffleArray(arr);
      if (r.join() === arr.join()) unchanged++;
    }
    // P(идентично) = 1/120 ≈ 0.83%, ожидаем < 3% за 1000 прогонов
    expect(unchanged).toBeLessThan(30);
  });
});
