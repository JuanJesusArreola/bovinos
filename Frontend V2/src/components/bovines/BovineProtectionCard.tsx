/**
 * Card de proteccion por enfermedad para un bovino.
 *
 * Se monta arriba del listado de vacunas en BovineVaccinationsTab.
 * Consume GET /api/bovines/:id/protection que devuelve, ordenado por
 * daysUntilExpiry asc, las enfermedades cubiertas por las vacunas del
 * bovino + cuanto les queda de inmunidad.
 *
 * Reglas visuales por item:
 *   - daysUntilExpiry < 0    -> rojo "Vencida" (proteccion expirada)
 *   - daysUntilExpiry <= 30  -> amber "Por vencer"
 *   - daysUntilExpiry > 30   -> verde "Protegido"
 *
 * Cards mini con countdown del item. Si no hay vacunas que cubran
 * enfermedades, empty state neutro (no es alarma).
 */

import { useMemo } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldOff, AlertTriangle,
} from 'lucide-react';
import { useBovineProtection } from '@/hooks/useBovines';
import { formatDate, formatRelative } from '@/utils/formatters';

interface BovineProtectionCardProps {
  bovineId: string;
}

type ProtectionLevel = 'protected' | 'expiring' | 'expired';

function levelForDays(days: number): ProtectionLevel {
  if (days < 0)  return 'expired';
  if (days <= 30) return 'expiring';
  return 'protected';
}

export function BovineProtectionCard({ bovineId }: BovineProtectionCardProps) {
  const { data: items = [], isLoading } = useBovineProtection(bovineId);

  // KPIs derivados para el header del card.
  const summary = useMemo(() => {
    let protectedCount = 0;
    let expiringCount  = 0;
    let expiredCount   = 0;
    for (const it of items) {
      const lvl = levelForDays(it.daysUntilExpiry);
      if (lvl === 'protected') protectedCount++;
      else if (lvl === 'expiring') expiringCount++;
      else expiredCount++;
    }
    return { protectedCount, expiringCount, expiredCount, total: items.length };
  }, [items]);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-24">
        <Spinner />
      </Card>
    );
  }

  // Empty state - no es alarma. Sin vacunas que mapeen a catalogo.
  if (items.length === 0) {
    return (
      <Card className="!p-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sin proteccion vacunal documentada
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              El bovino no tiene vacunas aplicadas que cubran enfermedades del catalogo,
              o las vacunas no estan mapeadas a ninguna enfermedad.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <CardTitle className="flex items-center gap-2 mb-0">
          <ShieldCheck className="w-5 h-5 text-primary-600" />
          Proteccion por enfermedad
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            ({summary.total})
          </span>
        </CardTitle>
        <div className="flex items-center gap-1.5 text-xs">
          {summary.protectedCount > 0 && (
            <Badge variant="success">
              {summary.protectedCount} protegida{summary.protectedCount === 1 ? '' : 's'}
            </Badge>
          )}
          {summary.expiringCount > 0 && (
            <Badge variant="warning">
              {summary.expiringCount} por vencer
            </Badge>
          )}
          {summary.expiredCount > 0 && (
            <Badge variant="danger">
              {summary.expiredCount} vencida{summary.expiredCount === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => {
          const level = levelForDays(item.daysUntilExpiry);
          const tone = level === 'expired'
            ? 'border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20'
            : level === 'expiring'
              ? 'border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20'
              : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20';
          const Icon = level === 'expired' ? ShieldOff
            : level === 'expiring' ? ShieldAlert
            : ShieldCheck;
          const iconColor = level === 'expired'
            ? 'text-red-600 dark:text-red-400'
            : level === 'expiring'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400';

          // Doses pendientes para inmunidad completa
          const dosesShort = item.dosesApplied < item.dosesForImmunity;
          const dosesPending = item.dosesForImmunity - item.dosesApplied;

          return (
            <li
              key={item.diseaseId}
              className={`rounded-lg border p-3 ${tone}`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {item.diseaseName}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {item.vaccineTypes.join(', ')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {level === 'expired' ? (
                      <span className="text-red-700 dark:text-red-300 font-medium">
                        Vencida hace {Math.abs(item.daysUntilExpiry)} dias
                      </span>
                    ) : (
                      <span>
                        Protegida hasta{' '}
                        <strong className="text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(item.protectedUntil)}
                        </strong>{' '}
                        ({item.daysUntilExpiry} dias)
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Ultima aplicacion {formatRelative(item.lastApplicationDate)}
                    {' '}&middot;{' '}
                    {item.dosesApplied} de {item.dosesForImmunity} dosis
                  </p>
                  {dosesShort && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Falta{dosesPending === 1 ? '' : 'n'} {dosesPending} dosis para inmunidad completa
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
