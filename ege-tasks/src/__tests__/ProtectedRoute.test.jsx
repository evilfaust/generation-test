/**
 * Тесты ProtectedRoute.
 *
 * Проверяем редиректы на /login или /app/tasks в зависимости от роли
 * и требований маршрута.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock useAuth — управляем им из каждого теста через mockUseAuth.
let mockAuthState = {
  isAuthenticated: false,
  isSuperAdmin: false,
  canEdit: false,
  hasSection: () => false,
};
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Import после mock.
const { default: ProtectedRoute } = await import('../components/auth/ProtectedRoute');

const Page = ({ name }) => <div>page:{name}</div>;

function renderWith(initialPath, routeProps = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<Page name="login" />} />
        <Route path="/app/tasks" element={<Page name="tasks" />} />
        <Route element={<ProtectedRoute {...routeProps} />}>
          <Route path="/app/secret" element={<Page name="secret" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockAuthState = {
      isAuthenticated: false,
      isSuperAdmin: false,
      canEdit: false,
      hasSection: () => false,
    };
  });

  it('не залогинен → редирект на /login', () => {
    renderWith('/app/secret');
    expect(screen.getByText('page:login')).toBeInTheDocument();
    expect(screen.queryByText('page:secret')).toBeNull();
  });

  it('залогинен + нет ограничений → рендерит children', () => {
    mockAuthState.isAuthenticated = true;
    renderWith('/app/secret');
    expect(screen.getByText('page:secret')).toBeInTheDocument();
  });

  it('requireSuperAdmin: не superadmin → редирект на /app/tasks', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isSuperAdmin = false;
    renderWith('/app/secret', { requireSuperAdmin: true });
    expect(screen.getByText('page:tasks')).toBeInTheDocument();
    expect(screen.queryByText('page:secret')).toBeNull();
  });

  it('requireSuperAdmin: superadmin → рендерит', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isSuperAdmin = true;
    renderWith('/app/secret', { requireSuperAdmin: true });
    expect(screen.getByText('page:secret')).toBeInTheDocument();
  });

  it('requireEdit: viewer → редирект на /app/tasks', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.canEdit = false; // viewer
    renderWith('/app/secret', { requireEdit: true });
    expect(screen.getByText('page:tasks')).toBeInTheDocument();
  });

  it('requireEdit: editor → рендерит', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.canEdit = true;
    renderWith('/app/secret', { requireEdit: true });
    expect(screen.getByText('page:secret')).toBeInTheDocument();
  });

  it('requireSection: нет секции → редирект на /app/tasks', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.hasSection = (k) => k === 'tasks';
    renderWith('/app/secret', { requireSection: 'admin' });
    expect(screen.getByText('page:tasks')).toBeInTheDocument();
  });

  it('requireSection: есть секция → рендерит', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.hasSection = (k) => k === 'admin';
    renderWith('/app/secret', { requireSection: 'admin' });
    expect(screen.getByText('page:secret')).toBeInTheDocument();
  });
});
