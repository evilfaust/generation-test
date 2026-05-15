import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Мокаем PocketBase API — useMarathon импортирует api из ../services/pocketbase
vi.mock('../services/pocketbase', () => ({
  api: {
    getMarathons: vi.fn().mockResolvedValue([]),
    createMarathon: vi.fn().mockResolvedValue({ id: 'mr-1' }),
    updateMarathon: vi.fn().mockResolvedValue({}),
  },
}));

import { useMarathon } from '../hooks/useMarathon';
import { api } from '../services/pocketbase';

const makeTask = (id) => ({ id, code: `T-${id}`, statement_md: `задача ${id}` });

describe('useMarathon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('инициализируется с дефолтными значениями', () => {
    const { result } = renderHook(() => useMarathon());
    expect(result.current.title).toBe('Марафон');
    expect(result.current.classNumber).toBe(8);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.students).toEqual([]);
    expect(result.current.saveStatus).toBe('idle');
  });

  describe('управление задачами', () => {
    it('addTasks добавляет уникальные задачи', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addTasks([makeTask('a'), makeTask('b')]));
      expect(result.current.tasks).toHaveLength(2);
    });

    it('addTasks не добавляет дубли по id', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addTasks([makeTask('a')]));
      act(() => result.current.addTasks([makeTask('a'), makeTask('b')]));
      expect(result.current.tasks).toHaveLength(2);
      expect(result.current.tasks.map(t => t.id)).toEqual(['a', 'b']);
    });

    it('removeTask удаляет задачу по id', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addTasks([makeTask('a'), makeTask('b')]));
      act(() => result.current.removeTask('a'));
      expect(result.current.tasks.map(t => t.id)).toEqual(['b']);
    });

    it('moveTask переставляет задачи', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addTasks([makeTask('a'), makeTask('b'), makeTask('c')]));
      act(() => result.current.moveTask(0, 2));
      expect(result.current.tasks.map(t => t.id)).toEqual(['b', 'c', 'a']);
    });
  });

  describe('управление учениками', () => {
    it('addStudent добавляет имя', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addStudent('Аня'));
      expect(result.current.students).toEqual(['Аня']);
    });

    it('addStudent обрезает пробелы', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addStudent('  Аня  '));
      expect(result.current.students).toEqual(['Аня']);
    });

    it('addStudent игнорирует пустые имена', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addStudent('   '));
      expect(result.current.students).toEqual([]);
    });

    it('addStudent не добавляет дубли', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => {
        result.current.addStudent('Аня');
        result.current.addStudent('Аня');
      });
      expect(result.current.students).toEqual(['Аня']);
    });

    it('removeStudent удаляет ученика', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => {
        result.current.addStudent('Аня');
        result.current.addStudent('Боря');
      });
      act(() => result.current.removeStudent('Аня'));
      expect(result.current.students).toEqual(['Боря']);
    });

    it('updateStudentName переименовывает + переносит tracking', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => {
        result.current.addStudent('Аня');
        result.current.addTasks([makeTask('t1')]);
      });
      act(() => result.current.initTracking());
      act(() => result.current.updateStudentName('Аня', 'Анна'));
      expect(result.current.students).toContain('Анна');
      expect(result.current.students).not.toContain('Аня');
      expect(result.current.trackingData['Анна']).toBeDefined();
      expect(result.current.trackingData['Аня']).toBeUndefined();
    });

    it('updateStudentName игнорирует пустое или совпадающее имя', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addStudent('Аня'));
      act(() => result.current.updateStudentName('Аня', ''));
      expect(result.current.students).toEqual(['Аня']);
      act(() => result.current.updateStudentName('Аня', 'Аня'));
      expect(result.current.students).toEqual(['Аня']);
    });
  });

  describe('трекинг', () => {
    it('initTracking создаёт пустые записи для всех учеников', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => {
        result.current.addStudent('Аня');
        result.current.addStudent('Боря');
        result.current.addTasks([makeTask('t1'), makeTask('t2')]);
      });
      act(() => result.current.initTracking());
      expect(result.current.trackingData['Аня']).toEqual({
        '0': { attempts: 0, solved: false, failed: false },
        '1': { attempts: 0, solved: false, failed: false },
      });
      expect(result.current.trackingData['Боря']['0'].attempts).toBe(0);
    });

    it('initTracking сбрасывает прогресс по всем ученикам', () => {
      // startedAt не экспортируется наружу — проверяем побочный эффект:
      // повторный initTracking перетирает старые попытки.
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addStudent('Аня'));
      act(() => result.current.addTasks([makeTask('t1')]));
      act(() => result.current.initTracking());
      act(() => result.current.markAttempt('Аня', 0, false));
      expect(result.current.trackingData['Аня']['0'].attempts).toBe(1);
      act(() => result.current.initTracking());
      expect(result.current.trackingData['Аня']['0'].attempts).toBe(0);
    });

    it('markAttempt success=true → solved', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => {
        result.current.addStudent('Аня');
        result.current.addTasks([makeTask('t1')]);
      });
      act(() => result.current.initTracking());
      act(() => result.current.markAttempt('Аня', 0, true));
      expect(result.current.trackingData['Аня']['0'].solved).toBe(true);
    });

    it('markAttempt success=false → attempts++', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => {
        result.current.addStudent('Аня');
        result.current.addTasks([makeTask('t1')]);
      });
      act(() => result.current.initTracking());
      act(() => result.current.markAttempt('Аня', 0, false));
      expect(result.current.trackingData['Аня']['0'].attempts).toBe(1);
      expect(result.current.trackingData['Аня']['0'].failed).toBe(false);
    });

    it('markAttempt после 3 неудач → failed=true', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => {
        result.current.addStudent('Аня');
        result.current.addTasks([makeTask('t1')]);
      });
      act(() => result.current.initTracking());
      act(() => {
        result.current.markAttempt('Аня', 0, false);
        result.current.markAttempt('Аня', 0, false);
        result.current.markAttempt('Аня', 0, false);
      });
      expect(result.current.trackingData['Аня']['0'].attempts).toBe(3);
      expect(result.current.trackingData['Аня']['0'].failed).toBe(true);
    });

    it('markAttempt не меняет финальное состояние (solved)', () => {
      const { result } = renderHook(() => useMarathon());
      act(() => {
        result.current.addStudent('Аня');
        result.current.addTasks([makeTask('t1')]);
      });
      act(() => result.current.initTracking());
      act(() => result.current.markAttempt('Аня', 0, true));
      const before = result.current.trackingData['Аня']['0'];
      act(() => result.current.markAttempt('Аня', 0, false));
      expect(result.current.trackingData['Аня']['0']).toEqual(before);
    });
  });

  describe('сохранение', () => {
    it('saveMarathon создаёт через api.createMarathon если savedId=null', async () => {
      const { result } = renderHook(() => useMarathon());
      act(() => result.current.addTasks([makeTask('t1')]));
      await act(async () => {
        await result.current.saveMarathon();
      });
      expect(api.createMarathon).toHaveBeenCalled();
    });

    it('saveMarathon не вызывает api без задач', async () => {
      const { result } = renderHook(() => useMarathon());
      await act(async () => {
        await result.current.saveMarathon();
      });
      expect(api.createMarathon).not.toHaveBeenCalled();
    });

    it('loadSavedList вызывает api.getMarathons', async () => {
      const { result } = renderHook(() => useMarathon());
      await act(async () => {
        await result.current.loadSavedList();
      });
      expect(api.getMarathons).toHaveBeenCalled();
    });
  });
});
