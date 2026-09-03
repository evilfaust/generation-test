import { describe, it, expect } from 'vitest';
import { filterTaskIds, hasNarrowingFilters } from '../utils/taskFilterIds';

const snapshot = [
  { id: 'a', topic: 't1', subtopic: ['s1'], tags: ['g1', 'g2'], difficulty: '1', source: 'ФИПИ', year: 2024, has_image: true },
  { id: 'b', topic: 't1', subtopic: ['s2'], tags: ['g2'], difficulty: '2', source: 'ФИПИ', year: 2025, has_image: false },
  { id: 'c', topic: 't2', subtopic: [], tags: [], difficulty: '1', source: 'Решу', year: 2024, has_image: false },
  { id: 'd', topic: 't1', subtopic: 's1', tags: 'g3', difficulty: 3, source: '', year: null, has_image: false },
];

describe('filterTaskIds', () => {
  it('без фильтров возвращает все id', () => {
    expect(filterTaskIds(snapshot, {})).toEqual(['a', 'b', 'c', 'd']);
  });

  it('фильтрует по теме', () => {
    expect(filterTaskIds(snapshot, { topic: 't1' })).toEqual(['a', 'b', 'd']);
  });

  it('сложность сравнивается как строка (в снимке бывает число)', () => {
    expect(filterTaskIds(snapshot, { difficulty: '3' })).toEqual(['d']);
    expect(filterTaskIds(snapshot, { difficulty: 1 })).toEqual(['a', 'c']);
  });

  it('теги — ИЛИ внутри поля, как в getTasks', () => {
    expect(filterTaskIds(snapshot, { tags: ['g1', 'g3'] })).toEqual(['a', 'd']);
  });

  it('подтемы — ИЛИ, строковое значение тоже понимается', () => {
    expect(filterTaskIds(snapshot, { subtopic: ['s1'] })).toEqual(['a', 'd']);
  });

  it('разные поля объединяются через И', () => {
    expect(filterTaskIds(snapshot, { topic: 't1', source: 'ФИПИ', year: 2025 })).toEqual(['b']);
  });

  it('год сравнивается как строка, пустой год не проходит фильтр', () => {
    expect(filterTaskIds(snapshot, { year: '2024' })).toEqual(['a', 'c']);
  });

  it('hasImage различает true/false', () => {
    expect(filterTaskIds(snapshot, { hasImage: true })).toEqual(['a']);
  });
});

describe('hasNarrowingFilters', () => {
  it('тема и подтема сами по себе не считаются сужением', () => {
    expect(hasNarrowingFilters({ topic: 't1', subtopic: ['s1'] })).toBe(false);
  });

  it('сложность, источник, год, теги и картинка — считаются', () => {
    expect(hasNarrowingFilters({ difficulty: '2' })).toBe(true);
    expect(hasNarrowingFilters({ source: 'ФИПИ' })).toBe(true);
    expect(hasNarrowingFilters({ year: 2024 })).toBe(true);
    expect(hasNarrowingFilters({ tags: ['g1'] })).toBe(true);
    expect(hasNarrowingFilters({ hasImage: false })).toBe(true);
  });

  it('пустые значения не считаются', () => {
    expect(hasNarrowingFilters({ difficulty: '', tags: [], year: null })).toBe(false);
  });
});
