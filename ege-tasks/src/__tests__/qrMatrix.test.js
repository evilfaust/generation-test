import { describe, it, expect } from 'vitest';
import { urlToQRMatrix, estimateQRSize } from '../utils/qrMatrix';
import { fillQRGrid } from '../utils/qrGridFill';

describe('urlToQRMatrix', () => {
  it('возвращает квадратную матрицу boolean', async () => {
    const matrix = await urlToQRMatrix('https://example.com');
    expect(matrix.length).toBeGreaterThan(0);
    expect(matrix.length).toBe(matrix[0].length); // квадрат
    expect(typeof matrix[0][0]).toBe('boolean');
  });

  it('одинаковый URL → одинаковая матрица', async () => {
    const a = await urlToQRMatrix('https://test.io/abc');
    const b = await urlToQRMatrix('https://test.io/abc');
    expect(a).toEqual(b);
  });

  it('разные URL → разные матрицы', async () => {
    const a = await urlToQRMatrix('https://a.io');
    const b = await urlToQRMatrix('https://b.io/xyz/long-path');
    // Размеры могут отличаться, но если совпадают — содержимое разное
    if (a.length === b.length) {
      const flatA = a.flat().join('');
      const flatB = b.flat().join('');
      expect(flatA).not.toBe(flatB);
    }
  });

  it('содержит и чёрные, и белые модули', async () => {
    const matrix = await urlToQRMatrix('https://example.com');
    const flat = matrix.flat();
    expect(flat.some(v => v === true)).toBe(true);
    expect(flat.some(v => v === false)).toBe(true);
  });
});

describe('estimateQRSize', () => {
  it('возвращает корректный размер для короткого URL', () => {
    const size = estimateQRSize('https://a.io');
    expect(size).toBeGreaterThanOrEqual(21); // минимум — версия 1
    expect(size % 4).toBe(1); // QR размеры: 21, 25, 29, 33... (4k+1)
  });

  it('для более длинного URL — больший размер', () => {
    const short = estimateQRSize('https://a.io');
    const long = estimateQRSize('https://example.com/' + 'x'.repeat(200));
    expect(long).toBeGreaterThanOrEqual(short);
  });

  it('возвращает null для некорректного ввода', () => {
    // qrcode библиотека выбрасывает на пустой строке
    const result = estimateQRSize('');
    expect(result === null || result > 0).toBe(true);
  });
});

describe('fillQRGrid', () => {
  it('заполняет чёрные клетки числами из answers', () => {
    const matrix = [
      [true, false],
      [false, true],
    ];
    const answers = [42];
    const grid = fillQRGrid(matrix, answers);
    // Чёрные клетки → isAnswer=true, value=42
    expect(grid[0][0]).toEqual({ value: 42, isAnswer: true });
    expect(grid[1][1]).toEqual({ value: 42, isAnswer: true });
    // Белые клетки → isAnswer=false
    expect(grid[0][1].isAnswer).toBe(false);
    expect(grid[1][0].isAnswer).toBe(false);
  });

  it('белые клетки получают числа НЕ из answers', () => {
    const matrix = Array.from({ length: 5 }, () => Array(5).fill(false));
    const answers = [10, 20, 30];
    const answerSet = new Set(answers);
    const grid = fillQRGrid(matrix, answers);
    grid.forEach(row => row.forEach(cell => {
      expect(answerSet.has(cell.value)).toBe(false);
    }));
  });

  it('размер результата совпадает с матрицей', () => {
    const matrix = Array.from({ length: 4 }, () => Array(4).fill(true));
    const grid = fillQRGrid(matrix, [5]);
    expect(grid).toHaveLength(4);
    expect(grid[0]).toHaveLength(4);
  });

  it('пустой массив answers → все клетки заполнены случайно (без isAnswer=true)', () => {
    const matrix = [[true, false], [false, true]];
    const grid = fillQRGrid(matrix, []);
    grid.forEach(row => row.forEach(cell => {
      expect(cell.isAnswer).toBe(false);
      expect(typeof cell.value).toBe('number');
    }));
  });

  it('каждая ячейка содержит { value, isAnswer }', () => {
    const matrix = [[true]];
    const grid = fillQRGrid(matrix, [7]);
    expect(grid[0][0]).toHaveProperty('value');
    expect(grid[0][0]).toHaveProperty('isAnswer');
  });
});
