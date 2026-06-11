/**
 * BovineVaccinationScheduleCard — calendario sugerido del bovino.
 *
 * F-39 / Backend V-05. Consume `GET /api/bovines/:id/vaccination-schedule`
 * que devuelve `SuggestedScheduleItem[]` con estado por cada vacuna que
 * le toca al bovino segun su edad/sexo/raza:
 *
 *   - APPLIED_CURRENT  → verde · "Al día" + nextDueDate futura
 *   - OVERDUE          → rojo  · "Vencida" + nextDueDate pasada
 *   - MISSING          → ámbar · "Pendiente de aplicar"
 *   - ONE_TIME_DONE    → gris  · "Completa — dosis única"
 *
 * Si el calendario base no tiene entradas que apliquen a este perfil
 * (raza/sexo/edad), se renderiza un empty state neutro: NO es alarma
 * — significa que no hay protocolo configurado para ese animal.
 *
 * Se inserta entre el status summary y la lista historica del tab de
 * vacunaciones para que el VET vea en orden:
 *   1. Estado global del bovino (status summary)
 *   2. Que le falta / le toca (esta card)
 *   3. Que ya tiene (lista historica)
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import {
  CalendarClock, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useBovineVaccinationSchedule } from '@/hooks/useBovines';
import { formatDate } from '@/utils/formatters';
import type { SuggestedScheduleItem, SuggestedItemStatus } from '@/types/bovine.dtos';

// ─── Status visual config ───────────────────────────────────────────────────

interface StatusConfig {
  label:        string;
  variant:      'success' | 'warning' | 'danger' | 'default';
  Icon:         React.ElementType;
  iconClass:    string;
  toneClass:    string;
  /** Peso para ordenamiento — mayor = mas urgente al frente del listado. */
  priority:     number;
}

const STATUS_CONFIG: Record<SuggestedItemStatus, StatusConfig> = {
  OVERDUE: {
    label:     'Vencida',
    variant:   'danger',
    Icon:      ShieldAlert,
    iconClass: 'text-red-600 dark:text-red-400',
    toneClass: 'border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20',
    priority:  4,
  },
  MISSING: {
    label:     'Pendiente de aplicar',
    variant:   'warning',
    Icon:      AlertTriangle,
    iconClass: 'text-amber-600 dark:text-amber-400',
    toneClass: 'border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20',
    priority:  3,
  },
  APPLIED_CURRENT: {
    label:     'Al día',
    variant:   'success',
    Icon:      ShieldCheck,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    toneClass: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20',
    priority:  2,
  },
  ONE_TIME_DONE: {
    label:     'Completa — dosis única',
    variant:   'default',
    Icon:      CheckCircle2,
    iconClass: 'text-gray-500 dark:text-gray-400',
    toneClass: 'border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/20',
    priority:  1,
  },
};

// ─── Helper: dias entre hoy y la fecha objetivo ────────────────────────────

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface BovineVaccinationScheduleCardProps {
  bovineId: string;
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function BovineVaccinationScheduleCard({ bovineId }: BovineVaccinationScheduleCardProps) {
  const { data: items = [], isLoading, error } = useBovineVaccinationSchedule(bovineId);

  // KPIs derivados + orden por prioridad clinica.
  const { sorted, summary } = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const pa = STATUS_CONFIG[a.status]?.priority ?? 0;
      const pb = STATUS_CONFIG[b.status]?.priority ?? 0;
      if (pb !== pa) return pb - pa;
      // Tiebreak: nextDueDate ascendente (mas urgente primero).
      const da = a.nextDueDate ? new Date(a.nextDueDate).getTime() : Infinity;
      const db = b.nextDueDate ? new Date(b.nextDueDate).getTime() : Infinity;
      return da - db;
    });
    const summary = {
      overdue:  items.filter((i) => i.status === 'OVERDUE').length,
      missing:  items.filter((i) => i.status === 'MISSING').length,
      current:  items.filter((i) => i.status === 'APPLIED_CURRENT').length,
      done:     items.filter((i) => i.status === 'ONE_TIME_DONE').length,
      total:    items.length,
    };
    return { sorted, summary };
  }, [items]);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-24">
        <Spinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert variant="error">No se pudo cargar el calendario sugerido.</Alert>
      </Card>
    );
  }

  // Empty state neutro — no hay calendario aplicable a este perfil.
  if (items.length === 0) {
    return (
      <Card className="!p-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sin calendario sugerido
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No hay protocolo de vacunación configurado que aplique al perfil
              de este bovino (edad/sexo/raza). Si esperabas verlo, revisa el
              catálogo en <span className="font-mono">/admin/vaccination-schedules</span>.
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
          <CalendarClock className="w-5 h-5 text-primary-600" />
          Calendario sugerido
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            ({summary.total})
          </span>
        </CardTitle>
        <div className="flex items-center gap-1.5 text-xs">
          <Link
            to="/vaccinations/schedules"
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline shrink-0"
            title="Editar el catálogo de calendarios"
          >
            Editar catálogo →
          </Link>
          {summary.overdue > 0 && (
            <Badge variant="danger">
              {summary.overdue} vencida{summary.overdue === 1 ? '' : 's'}
            </Badge>
          )}
          {summary.missing > 0 && (
            <Badge variant="warning">
              {summary.missing} pendiente{summary.missing === 1 ? '' : 's'}
            </Badge>
          )}
          {summary.current > 0 && (
            <Badge variant="success">
              {summary.current} al día
            </Badge>
          )}
          {summary.done > 0 && (
            <Badge variant="default">
              {summary.done} completa{summary.done === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sorted.map((item) => (
          <ScheduleItem key={item.scheduleId} item={item} />
        ))}
      </ul>
    </Card>
  );
}

// ─── Sub-componente por item ────────────────────────────────────────────────

function ScheduleItem({ item }: { item: SuggestedScheduleItem }) {
  const cfg = STATUS_CONFIG[item.status];
  const Icon = cfg.Icon;

  // Calculo del badge de tiempo segun status.
  let timeHint: string | null = null;
  if (item.status === 'OVERDUE' && item.nextDueDate) {
    const days = Math.abs(daysUntil(item.nextDueDate));
    timeHint = `Vencida hace ${days} día${days === 1 ? '' : 's'}`;
  } else if (item.status === 'APPLIED_CURRENT' && item.nextDueDate) {
    const days = daysUntil(item.nextDueDate);
    timeHint = days === 0
      ? 'Próxima dosis hoy'
      : `Próxima dosis en ${days} día${days === 1 ? '' : 's'}`;
  } else if (item.status === 'MISSING') {
    timeHint = 'Sin aplicación previa';
  } else if (item.status === 'ONE_TIME_DONE' && item.lastApplicationDate) {
    timeHint = `Aplicada el ${formatDate(item.lastApplicationDate)}`;
  }

  // Display de frecuencia.
  const frequencyHint = item.frequencyMonths != null
    ? item.frequencyMonths === 12
      ? 'Refuerzo anual'
      : `Refuerzo cada ${item.frequencyMonths} meses`
    : 'Dosis única';

  return (
    <li className={`rounded-lg border p-3 ${cfg.toneClass}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconClass}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {item.vaccineTypeLabel || item.vaccineType}
            </p>
            {!item.isRequired && (
              <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                opcional
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            {cfg.label}
          </p>
          {timeHint && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {timeHint}
              {item.status === 'APPLIED_CURRENT' && item.nextDueDate && (
                <> · {formatDate(item.nextDueDate)}</>
              )}
            </p>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
            {frequencyHint}
            {item.lastApplicationDate && item.status !== 'ONE_TIME_DONE' && (
              <> · Última: {formatDate(item.lastApplicationDate)}</>
            )}
          </p>
          {item.notes && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 italic mt-1 line-clamp-2">
              {item.notes}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
