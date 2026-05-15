import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave, loadAutosave, clearAutosave } from '../hooks/useAutosave';

describe('loadAutosave / clearAutosave', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('возвращает null content если ничего не сохранено', () => {
    const { content, settings } = loadAutosave();
    expect(content).toBeNull();
    expect(settings).toBeNull();
  });

  it('возвращает сохранённый content', () => {
    localStorage.setItem('theory-editor-autosave', '# Заголовок');
    const { content } = loadAutosave();
    expect(content).toBe('# Заголовок');
  });

  it('возвращает распарсенные settings', () => {
    const data = { pageSettings: { size: 'A4' }, currentTheme: 'dark' };
    localStorage.setItem('theory-editor-settings', JSON.stringify(data));
    const { settings } = loadAutosave();
    expect(settings).toEqual(data);
  });

  it('возвращает null settings при невалидном JSON', () => {
    localStorage.setItem('theory-editor-settings', '{invalid json');
    const { settings } = loadAutosave();
    expect(settings).toBeNull();
  });

  it('articleId использует отдельный ключ', () => {
    localStorage.setItem('theory-editor-autosave-abc', 'для статьи abc');
    localStorage.setItem('theory-editor-autosave', 'общий');
    expect(loadAutosave('abc').content).toBe('для статьи abc');
    expect(loadAutosave().content).toBe('общий');
  });

  it('clearAutosave удаляет content и settings', () => {
    localStorage.setItem('theory-editor-autosave', 'x');
    localStorage.setItem('theory-editor-settings', '{}');
    clearAutosave();
    expect(localStorage.getItem('theory-editor-autosave')).toBeNull();
    expect(localStorage.getItem('theory-editor-settings')).toBeNull();
  });

  it('clearAutosave с articleId удаляет именно ключи статьи', () => {
    localStorage.setItem('theory-editor-autosave-xyz', 'статья');
    localStorage.setItem('theory-editor-autosave', 'общий');
    clearAutosave('xyz');
    expect(localStorage.getItem('theory-editor-autosave-xyz')).toBeNull();
    expect(localStorage.getItem('theory-editor-autosave')).toBe('общий');
  });
});

describe('useAutosave hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('сохраняет markdown сразу после монтирования', () => {
    renderHook(() => useAutosave('начальный текст', { size: 'A4' }, 'light'));
    expect(localStorage.getItem('theory-editor-autosave')).toBe('начальный текст');
  });

  it('обновляет markdown при изменении', () => {
    const { rerender } = renderHook(
      ({ md }) => useAutosave(md, {}, 'light'),
      { initialProps: { md: 'v1' } }
    );
    expect(localStorage.getItem('theory-editor-autosave')).toBe('v1');
    rerender({ md: 'v2' });
    expect(localStorage.getItem('theory-editor-autosave')).toBe('v2');
  });

  it('сохраняет settings по интервалу 30s', () => {
    renderHook(() => useAutosave('md', { size: 'A4' }, 'dark', null, { extra: 1 }));
    expect(localStorage.getItem('theory-editor-settings')).toBeNull();
    vi.advanceTimersByTime(30000);
    const settings = JSON.parse(localStorage.getItem('theory-editor-settings'));
    expect(settings).toMatchObject({
      pageSettings: { size: 'A4' },
      currentTheme: 'dark',
      extra: 1,
    });
  });

  it('articleId использует отдельный ключ хранения', () => {
    renderHook(() => useAutosave('контент', {}, 'light', 'article-1'));
    expect(localStorage.getItem('theory-editor-autosave-article-1')).toBe('контент');
    expect(localStorage.getItem('theory-editor-autosave')).toBeNull();
  });

  it('очищает интервал при размонтировании', () => {
    const { unmount } = renderHook(() => useAutosave('md', {}, 'light'));
    unmount();
    vi.advanceTimersByTime(60000);
    // После размонтирования settings не должны записаться
    expect(localStorage.getItem('theory-editor-settings')).toBeNull();
  });
});
