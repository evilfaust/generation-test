/**
 * <CanEdit> и <CanDelete> — обёртки, скрывающие контент для viewer.
 *
 * Использование:
 *   <CanEdit><Button>Создать</Button></CanEdit>
 *   <CanDelete><Button danger>Удалить</Button></CanDelete>
 *
 * Альтернатива — useAuth().canEdit напрямую:
 *   const { canEdit } = useAuth();
 *   {canEdit && <Button>...</Button>}
 *
 * Компоненты-обёртки удобнее когда нужно обернуть несколько узлов JSX
 * или когда контент сложный и conditional rendering загромождает код.
 */
import { useAuth } from '../../contexts/AuthContext';

export function CanEdit({ children, fallback = null }) {
  const { canEdit } = useAuth();
  return canEdit ? children : fallback;
}

export function CanDelete({ children, fallback = null }) {
  const { canDelete } = useAuth();
  return canDelete ? children : fallback;
}

export function SuperAdminOnly({ children, fallback = null }) {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? children : fallback;
}
