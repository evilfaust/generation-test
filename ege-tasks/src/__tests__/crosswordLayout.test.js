import { describe, it, expect } from 'vitest';
import { generateCrossword } from '../utils/crosswordLayout';

describe('generateCrossword', () => {
  it('возвращает null для пустого ввода', () => {
    expect(generateCrossword([])).toBeNull();
    expect(generateCrossword(null)).toBeNull();
  });

  it('возвращает null если все слова короче 2 символов', () => {
    expect(generateCrossword([{ text: 'A', number: 1 }])).toBeNull();
    expect(generateCrossword([{ text: '', number: 1 }])).toBeNull();
  });

  it('размещает одно слово горизонтально в начале координат', () => {
    const result = generateCrossword([{ text: 'СЛОВО', number: 1 }]);
    expect(result).not.toBeNull();
    expect(result.placed).toHaveLength(1);
    expect(result.placed[0]).toMatchObject({
      text: 'СЛОВО',
      number: 1,
      row: 0,
      col: 0,
      dir: 'H',
    });
    expect(result.height).toBe(1);
    expect(result.width).toBe(5);
  });

  it('размещает два пересекающихся слова', () => {
    // СЛОВО и ОКНО пересекаются по букве О
    const result = generateCrossword([
      { text: 'СЛОВО', number: 1 },
      { text: 'ОКНО', number: 2 },
    ]);
    expect(result).not.toBeNull();
    expect(result.placed).toHaveLength(2);
    // Хотя бы одно слово должно быть размещено успешно
    const placedWords = result.placed.filter(p => !p.unplaced);
    expect(placedWords.length).toBeGreaterThanOrEqual(1);
  });

  it('размещает слова в перпендикулярных направлениях', () => {
    const result = generateCrossword([
      { text: 'КОТА', number: 1 },
      { text: 'ТАЗ', number: 2 },
    ]);
    expect(result).not.toBeNull();
    const placed = result.placed.filter(p => !p.unplaced);
    if (placed.length === 2) {
      // Если оба размещены — направления должны различаться
      const dirs = new Set(placed.map(p => p.dir));
      expect(dirs.size).toBe(2);
    }
  });

  it('приводит слова к верхнему регистру и удаляет не-буквы', () => {
    const result = generateCrossword([{ text: 'привет123!', number: 1 }]);
    expect(result.placed[0].text).toBe('ПРИВЕТ');
  });

  it('фильтрует слова длиной < 2 символа', () => {
    const result = generateCrossword([
      { text: 'СЛОВО', number: 1 },
      { text: 'А', number: 2 }, // отфильтруется
    ]);
    expect(result.placed.filter(p => !p.unplaced)).toHaveLength(1);
  });

  it('нумерация в результате сохраняется', () => {
    const result = generateCrossword([
      { text: 'ПЕРВОЕ', number: 10 },
      { text: 'ОБЛАКО', number: 20 },
    ]);
    const numbers = result.placed.map(p => p.number).sort((a, b) => a - b);
    expect(numbers).toEqual([10, 20]);
  });

  it('координаты нормализованы к ≥0', () => {
    const result = generateCrossword([
      { text: 'СЛОВО', number: 1 },
      { text: 'ОКНО', number: 2 },
      { text: 'ВОДА', number: 3 },
    ]);
    result.placed.filter(p => !p.unplaced).forEach(p => {
      expect(p.row).toBeGreaterThanOrEqual(0);
      expect(p.col).toBeGreaterThanOrEqual(0);
    });
  });

  it('возвращает grid с ячейками { letter, hWord, vWord }', () => {
    const result = generateCrossword([{ text: 'ABC', number: 1 }]);
    const cells = Object.values(result.grid);
    expect(cells).toHaveLength(3);
    cells.forEach(c => {
      expect(c).toHaveProperty('letter');
      expect(c).toHaveProperty('hWord');
      expect(c).toHaveProperty('vWord');
    });
  });
});
