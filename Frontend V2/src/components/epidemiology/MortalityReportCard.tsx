/**
 * MortalityReportCard — reporte agregado de mortalidad por rancho.
 *
 * F-29 / Backend X-07. Consume `GET /api/ranches/:ranchId/mortality` con
 * groupBy en {cause, month, location}. El backend devuelve labels listos
 * para mostrar; el FE solo arma la barra horizontal proporcional.
 */

import { useState, useMemo } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Skull, Calendar, MapPin, Filter } from 'lucide-react';
import { useRanchMortality } from '@/hooks/useBovines';
import type { MortalityGroupBy, DeathCause } from '@/types/bovine.dtos';
// F-35 / Hallazgo H-6: paleta semafórica por causa, centralizada.
import { getDeathCauseBarColor } from '@/design-system/tokens';

// ─── Helpers de fechas ──────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function isoAgoMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}

// ─── Presets de rango ────────────────────────────────────────────────────────

const RANGE_PRESETS = [
  { value: '3m',  label: 'Últimos 3 meses',  months: 3 },
  { value: '6m',  label: 'Últimos 6 meses',  months: 6 },
  { value: '12m', label: 'Últimos 12 meses', months: 12 },
  { value: '24m', label: 'Últimos 24 meses', months: 24 },
] as const;

const GROUP_BY_OPTIONS: { value: MortalityGroupBy; label: string; Icon: React.ElementType }[] = [
  { value: 'cause',    label: 'Por causa',     Icon: Filter },
  { value: 'month',    label: 'Por mes',       Icon: Calendar },
  { value: 'location', label: 'Por ubicación', Icon: MapPin },
];

// ─── Props ───────────────────────────────────────────────────────────────────

export interface MortalityReportCardProps {
  ranchId: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function MortalityReportCard({ ranchId }: MortalityReportCardProps) {
  const [rangeKey, setRangeKey]     = useState<typeof RANGE_PRESETS[number]['value']>('12m');
  const [groupBy,  setGroupBy]      = useState<MortalityGroupBy>('cause');

  const rangeMonths = useMemo(
    () => RANGE_PRESETS.find((p) => p.value === rangeKey)?.months ?? 12,
    [rangeKey],
  );

  const filters = useMemo(
    () => ({
      from:    isoAgoMonths(rangeMonths),
      to:      todayISO(),
      groupBy,
    }),
    [rangeMonths, groupBy],
  );

  const { data, isLoading, error } = useRanchMortality(ranchId, filters);

  // Color del bar segun groupBy + key (semantica visual leve).
  // F-35: helper de design-system. Solo se aplica cuando agrupamos por causa
  // (en month/location no hay semantica de color por categoria).
  function barColor(key: string, gb: MortalityGroupBy): string {
    if (gb !== 'cause') return 'bg-gray-500 dark:bg-gray-600';
    return getDeathCauseBarColor(key as DeathCause);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <CardTitle className="flex items-center gap-2">
          <Skull className="w-4 h-4 text-red-500" />
          Reporte de mortalidad
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select
            options={RANGE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value as typeof RANGE_PRESETS[number]['value'])}
            className="!py-1 text-xs"
          />
          <Select
            options={GROUP_BY_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as MortalityGroupBy)}
            className="!py-1 text-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : error ? (
        <Alert variant="error">No se pudo cargar el reporte de mortalidad.</Alert>
      ) : !data || data.total === 0 ? (
        <div className="text-center py-8">
          <Skull className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sin muertes registradas en el período seleccionado.
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {RANGE_PRESETS.find((p) => p.value === rangeKey)?.label}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                {data.total}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                muerte{data.total !== 1 ? 's' : ''} en {RANGE_PRESETS.find((p) => p.value === rangeKey)?.label?.toLowerCase()}
              </p>
            </div>
            <Badge variant="default" className="text-[10px]">
              {GROUP_BY_OPTIONS.find((g) => g.value === groupBy)?.label}
            </Badge>
          </div>

          <ul className="space-y-2">
            {data.groups.map((g) => (
              <li key={g.key}>
                <div className="flex items-center justify-between text-sm mb-0.5">
                  <span className="text-gray-700 dark:text-gray-300 truncate" title={g.label}>
                    {g.label}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 shrink-0 ml-2 tabular-nums">
                    {g.count} · {g.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full ${barColor(g.key, groupBy)} transition-all`}
                    style={{ width: `${Math.min(100, g.percentage)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
