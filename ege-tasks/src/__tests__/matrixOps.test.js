import { describe, it, expect } from 'vitest';
import { removeNoise, closeHoles, thicken, smooth, invertMatrix } from '../utils/matrixOps';

// Вспомогательная функция для создания матрицы из строк ('X' = true, '.' = false)
function m(rows) {
  return rows.map(row => row.split('').map(c => c === 'X'));
}
function str(matrix) {
  return matrix.map(row => row.map(c => c ? 'X' : '.').join('')).join('\n');
}

describe('invertMatrix', () => {
  it('инвертирует все клетки', () => {
    const input = m(['XO', 'OX'].map(r => r.replace(/O/g, '.')));
    const result = invertMatrix(input);
    expect(str(result)).toBe('.X\nX.');
  });

  it('двойная инверсия = исходник', () => {
    const input = m(['X.X', '.X.']);
    expect(invertMatrix(invertMatrix(input))).toEqual(input);
  });
});

describe('removeNoise', () => {
  it('удаляет одиночную тёмную клетку (0 тёмных соседей)', () => {
    const input = m([
      '.....',
      '..X..',
      '.....',
    ]);
    const result = removeNoise(input);
    // Одиночная клетка без 2+ тёмных соседей → становится светлой
    expect(result[1][2]).toBe(false);
  });

  it('сохраняет клетки с 2+ тёмными соседями', () => {
    // Три клетки подряд: центральная имеет 2 тёмных соседа
    const input = m([
      '.....',
      '.XXX.',
      '.....',
    ]);
    const result = removeNoise(input);
    expect(result[1][2]).toBe(true); // центр сохраняется
  });
});

describe('closeHoles', () => {
  it('закрывает белую дырку окружённую тёмными клетками', () => {
    // Центральная клетка светлая, вокруг неё 8 тёмных соседей
    const input = m([
      'XXX',
      'X.X',
      'XXX',
    ]);
    const result = closeHoles(input);
    expect(result[1][1]).toBe(true); // дырка закрылась
  });

  it('не закрывает изолированную светлую клетку (< 6 тёмных соседей)', () => {
    const input = m([
      '...',
      '...',
      '...',
    ]);
    const result = closeHoles(input);
    expect(result[1][1]).toBe(false);
  });
});

describe('thicken', () => {
  it('расширяет одиночную клетку на 4 ортогональных соседа', () => {
    const input = m([
      '.....',
      '.....',
      '..X..',
      '.....',
      '.....',
    ]);
    const result = thicken(input);
    // Сама клетка
    expect(result[2][2]).toBe(true);
    // Ортогональные соседи
    expect(result[1][2]).toBe(true); // верх
    expect(result[3][2]).toBe(true); // низ
    expect(result[2][1]).toBe(true); // лево
    expect(result[2][3]).toBe(true); // право
    // Диагональные — не затронуты
    expect(result[1][1]).toBe(false);
    expect(result[3][3]).toBe(false);
  });

  it('не выходит за границы матрицы', () => {
    const input = m([
      'X..',
      '...',
      '...',
    ]);
    expect(() => thicken(input)).not.toThrow();
    const result = thicken(input);
    expect(result[0][0]).toBe(true);
    expect(result[1][0]).toBe(true);
    expect(result[0][1]).toBe(true);
  });

  it('не мутирует исходную матрицу', () => {
    const input = m(['..X', '...', '...']);
    const copy = input.map(r => [...r]);
    thicken(input);
    expect(input).toEqual(copy);
  });
});

describe('smooth', () => {
  it('убирает клетки с менее чем 3 тёмными соседями', () => {
    // Одиночная клетка — 0 соседей → удаляется
    const input = m([
      '.....',
      '..X..',
      '.....',
    ]);
    const result = smooth(input);
    expect(result[1][2]).toBe(false);
  });

  it('сохраняет клетки с 3+ тёмными соседями', () => {
    // Плотный блок 3×3: центральная клетка имеет 8 соседей
    const input = m([
      'XXX',
      'XXX',
      'XXX',
    ]);
    const result = smooth(input);
    expect(result[1][1]).toBe(true);
  });
});
