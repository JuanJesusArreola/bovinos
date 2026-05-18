/**
 * RanchFilterBanner — global ranch picker for module-level pages.
 *
 * Used by pages that scope all their data by `activeRanchId` (Bovinos,
 * Salud, Mapas, Ubicaciones, etc.). Encapsulates the convention used in
 * `BovinesListPage`: show a banner with a `RanchSelector` for users who
 * have access to more than one ranch (or for SUPER_ADMINs without a
 * default ranch).
 *
 * Visibility rules:
 *   - SUPER_ADMIN              → always shown (they can pick any ranch).
 *   - User with > 1 ranch      → shown (let them switch context).
 *   - User with exactly 1 ranch and `activeRanchId` already set → hidden
 *     (single-ranch users don't need to choose).
 *   - User with 0 ranches      → hidden (nothing to pick).
 *
 * The component does NOT block rendering of the parent page when no
 * ranch is selected; it's the parent's responsibility to decide what to
 * render in that case. For convenience, `<RanchFilterBanner.Empty />` is
 * provided as the recommended empty state to render when `activeRanchId
 * === null` and the page needs a ranch to function.
 */

import { useAuth } from '@/store/AuthContext';
import { RanchSelector } from '@/components/ui/RanchSelector';
import { Home, Info } from 'lucide-react';

interface RanchFilterBannerProps {
  /** Hint text shown next to the selector when a ranch is active. */
  activeHint?: string;
  /** Hint text shown when no ranch is selected. */
  emptyHint?: string;
  /** When false the user cannot clear to "Todos los ranchos". Default true. */
  clearable?: boolean;
}

export function RanchFilterBanner({
  activeHint = 'Mostrando información de este rancho.',
  emptyHint = 'Selecciona un rancho para ver la información.',
  clearable = true,
}: RanchFilterBannerProps) {
  const { user, activeRanchId, setActiveRanch } = useAuth();

  const ranchAccessCount = user?.ranchAccess?.length ?? 0;
  const isSuperAdmin     = user?.role === 'SUPER_ADMIN';
  // Only show when the user has more than one ranch OR they're a SUPER_ADMIN.
  // Single-ranch users get the ranch auto-selected by AuthContext.
  const shouldShow = isSuperAdmin || ranchAccessCount > 1;

  if (!shouldShow) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
      <Home className="w-4 h-4 text-amber-500 shrink-0" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
        Filtrar por rancho:
      </span>
      <div className="flex-1 max-w-sm">
        <RanchSelector
          value={activeRanchId}
          onChange={(rid) => setActiveRanch(rid)}
          placeholder={isSuperAdmin ? 'Todos los ranchos' : 'Selecciona un rancho...'}
          clearable={clearable}
          label=""
        />
      </div>
      {activeRanchId ? (
        <span className="text-xs text-gray-500 shrink-0 hidden md:inline">
          {activeHint}
        </span>
      ) : (
        <span className="text-xs text-amber-700 dark:text-amber-400 shrink-0 hidden md:inline">
          {emptyHint}
        </span>
      )}
    </div>
  );
}

/**
 * Empty-state block to render when `activeRanchId === null` and the parent
 * page needs a ranch to be useful. Usage:
 *
 *   if (!activeRanchId) {
 *     return (
 *       <div className="space-y-6">
 *         <RanchFilterBanner />
 *         <RanchFilterBannerEmpty />
 *       </div>
 *     );
 *   }
 */
export function RanchFilterBannerEmpty({
  title = 'Selecciona un rancho',
  description = 'Esta página necesita un rancho seleccionado para cargar la información.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
        <Info className="w-7 h-7 text-amber-500" />
      </div>
      <div>
        <p className="text-base font-semibold text-gray-800 dark:text-gray-200">{title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md">
          {description}
        </p>
      </div>
    </div>
  );
}
