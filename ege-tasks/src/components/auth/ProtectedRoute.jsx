/**
 * ProtectedRoute — обёртка для приватных маршрутов.
 *
 * - Если пользователь не залогинен → редирект на /login с сохранением исходного пути.
 * - Если требуется конкретная секция или роль (опционально через props) и доступа нет →
 *   редирект на /app/tasks (это всегда доступная страница для любого учителя).
 *
 * Использование:
 *   <Route element={<ProtectedRoute />}>
 *     <Route element={<AppLayout />}>...</Route>
 *   </Route>
 *
 *   <Route element={<ProtectedRoute requireSuperAdmin />}>
 *     <Route path="/app/admin" element={<UserManager />} />
 *   </Route>
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ requireSuperAdmin = false, requireSection = null }) {
  const { isAuthenticated, isSuperAdmin, hasSection } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/app/tasks" replace />;
  }

  if (requireSection && !hasSection(requireSection)) {
    return <Navigate to="/app/tasks" replace />;
  }

  return <Outlet />;
}
