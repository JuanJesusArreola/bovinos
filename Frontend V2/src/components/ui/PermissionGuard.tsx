import type { ReactNode } from 'react';
import { useAuth } from '@/store/AuthContext';
import { canUser, type Action } from '@/utils/permissions';

interface PermissionGuardProps {
  /** The action the user needs permission to perform */
  action: Action;
  /** Rendering strategy:
   *  - 'hide'    → renders nothing when no permission (default)
   *  - 'disable' → renders children wrapped in a dimmed, non-interactive shell with a tooltip
   */
  mode?: 'hide' | 'disable';
  /** Content to render when permission is granted (or in disable mode, always rendered) */
  children: ReactNode;
  /** Tooltip text shown in 'disable' mode (overrides default) */
  tooltip?: string;
  /** Fallback to render in 'hide' mode when permission is denied (optional) */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on the current user's role.
 *
 * Usage:
 *   <PermissionGuard action="DELETE_BOVINE">
 *     <DeleteButton />
 *   </PermissionGuard>
 *
 *   <PermissionGuard action="MANAGE_USERS" mode="disable">
 *     <ManageButton />
 *   </PermissionGuard>
 */
export function PermissionGuard({
  action,
  mode = 'hide',
  children,
  tooltip = 'No tienes permiso para esta acción',
  fallback = null,
}: PermissionGuardProps) {
  const { user } = useAuth();
  const allowed = canUser(user?.role, action);

  if (allowed) return <>{children}</>;

  if (mode === 'disable') {
    return (
      <span
        title={tooltip}
        className="inline-flex cursor-not-allowed opacity-40 pointer-events-none select-none"
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  // mode === 'hide'
  return <>{fallback}</>;
}
