/**
 * Banner de período de retiro de un bovino.
 *
 * Componente con funcion LEGAL critica: si el bovino tiene medicamentos
 * en período de retiro, su leche / carne NO pueden ir a consumo humano
 * hasta que `finalClearedAt` ya haya pasado. Mostramos esto de forma
 * imposible de ignorar (banner rojo en el header del detalle del bovino).
 *
 * Estados:
 *   - **Loading**     → render vacío (no parpadeamos falsas alertas).
 *   - **Sin retiro**  → render vacío (no es noticia; ahorra ruido visual).
 *                       Opcional: el caller puede pasar `showClearedState`
 *                       para mostrar un chip verde "Apto para consumo".
 *   - **En retiro**   → Alert rojo con conteo + medicamentos + countdown.
 *   - **Error**       → render vacío (no podemos garantizar la respuesta,
 *                       no queremos mostrar "OK para consumo" si falló).
 *
 * Caller usa `useBovineWithdrawalStatus(bovineId)` o lo recibe por prop.
 */

import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Beef, Milk, ShieldOff, ShieldCheck, Clock } from 'lucide-react';
import { formatDate, formatRelative } from '@/utils/formatters';
import type { BovineWithdrawalAggregate } from '@/types/health.types';

interface WithdrawalStatusBannerProps {
  /** Resultado del hook `useBovineWithdrawalStatus`. */
  status: BovineWithdrawalAggregate | undefined;
  /** Si el hook todavía está cargando, no renderizamos nada (silencio mejor que ruido). */
  isLoading?: boolean;
  /**
   * Cuando es `true` Y NO hay retiro activo, mostramos un chip verde
   * confirmando "Apto para consumo". Útil en la página de detalle.
   * Default `false` (silencio).
   */
  showClearedState?: boolean;
  className?: string;
}

export function WithdrawalStatusBanner({
  status,
  isLoading,
  showClearedState = false,
  className,
}: WithdrawalStatusBannerProps) {
  if (isLoading || !status) return null;

  // ── Caso "sin retiro" ─────────────────────────────────────────────────
  if (!status.hasActiveWithdrawal) {
    if (!showClearedState) return null;
    return (
      <div
        className={[
          'flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800',
          'bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm text-green-700 dark:text-green-300',
          className ?? '',
        ].join(' ')}
      >
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span className="font-medium">Apto para consumo</span>
        <span className="text-xs text-green-600/80 dark:text-green-400/80">
          · sin medicamentos en período de retiro
        </span>
      </div>
    );
  }

  // ── Caso "en retiro" (el crítico) ─────────────────────────────────────
  const finalCleared = status.finalClearedAt
    ? new Date(status.finalClearedAt)
    : null;
  const nextEnds = status.nextEndsAt ? new Date(status.nextEndsAt) : null;

  return (
    <Alert
      variant="error"
      title="Animal en periodo de retiro - NO apto para sacrificio ni aprovechamiento de leche"
      className={className}
    >
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="danger" className="inline-flex items-center gap-1">
            <Beef className="w-3 h-3" /> No apto carne
          </Badge>
          <Badge variant="danger" className="inline-flex items-center gap-1">
            <Milk className="w-3 h-3" /> No apto leche
          </Badge>
          <Badge variant="default" className="inline-flex items-center gap-1">
            <ShieldOff className="w-3 h-3" />
            {status.activeCount}{' '}
            {status.activeCount === 1 ? 'medicamento activo' : 'medicamentos activos'}
          </Badge>
        </div>

        {finalCleared && (
          <p className="text-red-700 dark:text-red-300">
            Apto para consumo a partir del{' '}
            <strong className="whitespace-nowrap">
              {formatDate(status.finalClearedAt!)}
            </strong>
            {' '}
            <span className="text-xs text-red-600/80 dark:text-red-400/80">
              ({formatRelative(status.finalClearedAt!)})
            </span>
            {nextEnds && status.activeCount > 1
              && nextEnds.getTime() !== finalCleared.getTime() && (
                <>
                  {' · '}primer retiro vence el{' '}
                  <span className="whitespace-nowrap">{formatDate(status.nextEndsAt!)}</span>
                </>
              )}
          </p>
        )}

        <ul className="mt-1 space-y-1 border-t border-red-200/40 dark:border-red-800/40 pt-2">
          {status.active.map((w, idx) => (
            <li
              key={`${w.medicationName}-${idx}`}
              className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300"
            >
              <Clock className="w-3 h-3 mt-0.5 shrink-0" />
              <span className="flex-1 min-w-0">
                <strong>{w.medicationName}</strong>
                {' · última dosis '}
                {formatDate(w.lastAdministrationDate)}
                {' · libera '}
                {formatDate(w.withdrawalEndDate)}
                {' · '}
                <span className="font-semibold">
                  {w.daysRemaining} {w.daysRemaining === 1 ? 'día' : 'días'} restantes
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Alert>
  );
}
