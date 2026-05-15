import { describe, it, expect } from 'vitest';
import { splitMatrix, snapToTileCount } from '../utils/splitMatrix';

// Помощник: создать матрицу с уникальными значениями (для проверки разбиения)
function makeIdMatrix(size) {
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => r * size + c)
  );
}

describe('splitMatrix', () => {
  it('разбивает 4×4 матрицу на 2×2 плитки → 4 плитки 2×2', () => {
    const m = makeIdMatrix(4);
    const tiles = splitMatrix(m, 2);
    expect(tiles).toHaveLength(4);
    tiles.forEach(t => {
      expect(t).toHaveLength(2);
      expect(t[0]).toHaveLength(2);
    });
  });

  it('row-major порядок плиток: [0,0]=0, [0,1]=1, [1,0]=2, [1,1]=3', () => {
    const m = makeIdMatrix(4);
    const tiles = splitMatrix(m, 2);
    // Плитка 0 — верх-лево: содержит m[0..1][0..1]
    expect(tiles[0][0][0]).toBe(m[0][0]); // 0
    expect(tiles[0][1][1]).toBe(m[1][1]); // 5
    // Плитка 1 — верх-право: m[0..1][2..3]
    expect(tiles[1][0][0]).toBe(m[0][2]); // 2
    // Плитка 2 — низ-лево: m[2..3][0..1]
    expect(tiles[2][0][0]).toBe(m[2][0]); // 8
    // Плитка 3 — низ-право: m[2..3][2..3]
    expect(tiles[3][1][1]).toBe(m[3][3]); // 15
  });

  it('разбивает 9×9 на 3×3 → 9 плиток 3×3', () => {
    const m = makeIdMatrix(9);
    const tiles = splitMatrix(m, 3);
    expect(tiles).toHaveLength(9);
    expect(tiles[0]).toHaveLength(3);
    expect(tiles[0][0]).toHaveLength(3);
  });

  it('обрезает неделимые размеры до кратного', () => {
    // 5×5 / 2 = 2.5 → обрезаем до 2 на плитку → 4 плитки 2×2
    const m = makeIdMatrix(5);
    const tiles = splitMatrix(m, 2);
    expect(tiles).toHaveLength(4);
    tiles.forEach(t => {
      expect(t).toHaveLength(2);
      expect(t[0]).toHaveLength(2);
    });
  });

  it('сохраняет boolean-значения', () => {
    const m = [
      [true, false],
      [false, true],
    ];
    const tiles = splitMatrix(m, 2);
    expect(tiles).toHaveLength(4);
    expect(tiles[0][0][0]).toBe(true);
    expect(tiles[1][0][0]).toBe(false);
    expect(tiles[2][0][0]).toBe(false);
    expect(tiles[3][0][0]).toBe(true);
  });
});

describe('snapToTileCount', () => {
  it('возвращает ближайший кратный размер', () => {
    expect(snapToTileCount(30, 3)).toBe(30); // 30 кратно 3
    expect(snapToTileCount(31, 3)).toBe(30); // round(31/3)*3 = 30
    expect(snapToTileCount(32, 3)).toBe(33); // round(32/3)*3 = 33
  });

  it('кратно tileCount', () => {
    for (const target of [10, 17, 23, 50]) {
      for (const tc of [2, 3, 4]) {
        expect(snapToTileCount(target, tc) % tc).toBe(0);
      }
    }
  });

  it('минимум — tileCount*3 (3 клетки на плитку)', () => {
    expect(snapToTileCount(1, 2)).toBe(6); // min=6
    expect(snapToTileCount(1, 3)).toBe(9); // min=9
    expect(snapToTileCount(1, 4)).toBe(12); // min=12
  });

  it('большие целевые размеры не обрезаются', () => {
    expect(snapToTileCount(100, 4)).toBe(100);
    expect(snapToTileCount(99, 4)).toBe(100);
  });
});
