import { describe, it, expect } from 'vitest';
import { buildPublicationItems } from '../shared/services/pb/courses';

describe('buildPublicationItems (проекция витрины курса)', () => {
  it('пустой/невалидный вход → []', () => {
    expect(buildPublicationItems(null)).toEqual([]);
    expect(buildPublicationItems(undefined)).toEqual([]);
    expect(buildPublicationItems([])).toEqual([]);
  });

  it('скрывает элементы с visible === false', () => {
    const out = buildPublicationItems([
      { type: 'material', title: 'Скрытый', url: 'u', visible: false },
      { type: 'material', title: 'Виден', url: 'v' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Виден');
  });

  it('type=work (учительская петля) НЕ уходит ученику', () => {
    const out = buildPublicationItems([
      { type: 'work', id: 'w1', title: 'Работа учителя' },
    ]);
    expect(out).toEqual([]);
  });

  it('material → file с url и ролью', () => {
    const out = buildPublicationItems([
      { type: 'material', title: 'ДЗ.pdf', url: 'https://f/x', role: 'homework' },
    ]);
    expect(out[0]).toEqual({ kind: 'file', role: 'homework', title: 'ДЗ.pdf', file_url: 'https://f/x' });
  });

  it('session → work со ссылкой на сессию', () => {
    const out = buildPublicationItems([
      { type: 'session', id: 'sess15charcode0', title: 'ДЗ №3', role: 'homework' },
    ]);
    expect(out[0]).toEqual({ kind: 'work', role: 'homework', title: 'ДЗ №3', session_id: 'sess15charcode0' });
  });

  it('text → text; неизвестная роль → class', () => {
    const out = buildPublicationItems([
      { type: 'text', text: 'Повторить формулы', role: 'whatever' },
    ]);
    expect(out[0]).toEqual({ kind: 'text', role: 'class', title: '', description: 'Повторить формулы' });
  });

  it('сохраняет порядок и разнотипность', () => {
    const out = buildPublicationItems([
      { type: 'material', title: 'A', url: 'a' },
      { type: 'session', id: 's', title: 'B' },
      { type: 'text', text: 'C' },
    ]);
    expect(out.map((i) => i.kind)).toEqual(['file', 'work', 'text']);
  });
});
