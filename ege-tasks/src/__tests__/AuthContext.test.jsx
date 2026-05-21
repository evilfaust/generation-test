/**
 * Тесты AuthContext / useAuth.
 *
 * Стратегия: мокаем `pb` из `../shared/services/pocketbase` целиком,
 * чтобы не делать сетевые запросы. Проверяем reactive поведение хука.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock pb (default export из pocketbase.js). Должен быть ДО import AuthContext.
const onChangeCallbacks = [];
const mockPb = {
  authStore: {
    model: null,
    isValid: false,
    clear: vi.fn(() => {
      mockPb.authStore.model = null;
      mockPb.authStore.isValid = false;
      onChangeCallbacks.forEach((cb) => cb(null, null));
    }),
    onChange: vi.fn((cb) => {
      onChangeCallbacks.push(cb);
      return () => {
        const idx = onChangeCallbacks.indexOf(cb);
        if (idx >= 0) onChangeCallbacks.splice(idx, 1);
      };
    }),
  },
  collection: vi.fn(() => ({
    authWithPassword: vi.fn(async (username) => {
      const record = {
        id: 'tch_' + username,
        collectionName: 'teachers',
        username,
        name: username,
        role: 'editor',
        allowed_sections: ['tasks', 'theory'],
      };
      mockPb.authStore.model = record;
      mockPb.authStore.isValid = true;
      onChangeCallbacks.forEach((cb) => cb('tok', record));
      return { token: 'tok', record };
    }),
    authRefresh: vi.fn(async () => ({ token: 'tok', record: mockPb.authStore.model })),
    update: vi.fn(async (id, data) => ({ id, ...data })),
  })),
};

vi.mock('../shared/services/pocketbase', () => ({
  default: mockPb,
  api: {},
}));

// Импортируем ПОСЛЕ mock.
const { AuthProvider, useAuth, ALL_SECTIONS } = await import('../contexts/AuthContext');

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext / useAuth', () => {
  beforeEach(() => {
    mockPb.authStore.model = null;
    mockPb.authStore.isValid = false;
    onChangeCallbacks.length = 0;
    localStorage.clear();
    sessionStorage.clear();
  });

  it('по умолчанию пользователь не залогинен', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.teacher).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('login сохраняет teacher и поднимает isAuthenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login('alice', 'pass1234', true);
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.teacher?.username).toBe('alice');
    expect(result.current.role).toBe('editor');
    expect(localStorage.getItem('pb_remember')).toBe('true');
  });

  it('login с remember=false НЕ ставит pb_remember', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login('alice', 'pass1234', false);
    });
    expect(localStorage.getItem('pb_remember')).toBeNull();
  });

  it('logout очищает teacher', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login('alice', 'pass1234', true);
    });
    act(() => {
      result.current.logout();
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.teacher).toBeNull();
    expect(localStorage.getItem('pb_remember')).toBeNull();
  });

  it('hasSection: editor с allowed_sections=["tasks","theory"]', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login('alice', 'pass1234', true);
    });
    expect(result.current.hasSection('tasks')).toBe(true);
    expect(result.current.hasSection('theory')).toBe(true);
    expect(result.current.hasSection('admin')).toBe(false);
    expect(result.current.hasSection('geometry')).toBe(false);
  });

  it('hasSection: superadmin всегда true (даже с пустым allowed_sections)', async () => {
    mockPb.collection = vi.fn(() => ({
      authWithPassword: vi.fn(async (username) => {
        const record = {
          id: 'tch_super',
          collectionName: 'teachers',
          username,
          name: username,
          role: 'superadmin',
          allowed_sections: [],
        };
        mockPb.authStore.model = record;
        mockPb.authStore.isValid = true;
        onChangeCallbacks.forEach((cb) => cb('tok', record));
        return { token: 'tok', record };
      }),
      authRefresh: vi.fn(),
      update: vi.fn(async () => ({})),
    }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login('admin', 'pass1234', true);
    });
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.hasSection('tasks')).toBe(true);
    expect(result.current.hasSection('admin')).toBe(true);
    expect(result.current.hasSection('any_random_key')).toBe(true);
  });

  it('canEdit: editor=true, superadmin=true, viewer=false', async () => {
    // editor (default из login mock)
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login('alice', 'pass1234', true);
    });
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });

  it('canEdit/canDelete: viewer=false', async () => {
    mockPb.collection = vi.fn(() => ({
      authWithPassword: vi.fn(async (username) => {
        const record = {
          id: 'tch_v', collectionName: 'teachers', username, name: username,
          role: 'viewer', allowed_sections: ['tasks'],
        };
        mockPb.authStore.model = record;
        mockPb.authStore.isValid = true;
        onChangeCallbacks.forEach((cb) => cb('tok', record));
        return { token: 'tok', record };
      }),
      authRefresh: vi.fn(),
      update: vi.fn(async () => ({})),
    }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login('vader', 'pass1234', true);
    });
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.isSuperAdmin).toBe(false);
  });

  it('ALL_SECTIONS экспортируется и содержит ключевые секции', () => {
    expect(ALL_SECTIONS).toContain('tasks');
    expect(ALL_SECTIONS).toContain('admin');
    expect(ALL_SECTIONS).toContain('worksheets');
    expect(ALL_SECTIONS).toContain('geometry');
    expect(ALL_SECTIONS).toContain('trig');
  });
});
