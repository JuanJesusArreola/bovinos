import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { locationsApi } from '@/api/locations.api';
import { formatDate, formatRelative } from '@/utils/formatters';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { LocationType, type LocationMovement } from '@/types/location.types';
import {
  LOCATION_TYPE_LABELS,
  LOCATION_TYPE_BADGE_CLASSES,
  LOCATION_TYPE_DOT_CLASSES,
  LOCATION_TYPE_FALLBACK,
  getMovementReasonLabel,
} from '@/design-system/tokens';
import {
  MapPin, Trees, Home, Fence, Milk, Droplets,
  Stethoscope, ShieldAlert, TruckIcon, Package,
  ArrowRightLeft, Clock, CalendarDays, User,
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  Navigation, AlertTriangle,
  // Iconos añadidos para los 17 tipos nuevos del enum LocationType.
  Wheat, Microscope, HeartHandshake, Building2, House,
  Wrench, Route, Factory, Trash2, DoorOpen, Shield,
  CheckSquare, AlertOctagon, Ban, ShieldCheck, MoreHorizontal,
} from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BovineLocationHistoryTabProps {
  bovineId: string;
}

// ─── Location type config ─────────────────────────────────────────────────────

/**
 * Iconos por tipo de ubicación. Los iconos viven aquí (no en el design-system)
 * porque son componentes React de lucide-react — el token solo se ocupa de
 * colores/labels (presentation-data) y los iconos son markup.
 */
const LOCATION_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Operación ganadera
  [LocationType.PASTURE]:           Trees,
  [LocationType.CORRAL]:            Fence,
  [LocationType.BARN]:              Home,
  [LocationType.MILKING_PARLOR]:    Milk,
  [LocationType.FEED_AREA]:         Wheat,
  // Recursos hídricos
  [LocationType.WATER_SOURCE]:      Droplets,
  // Salud animal
  [LocationType.VETERINARY_CLINIC]: Stethoscope,
  [LocationType.QUARANTINE_AREA]:   ShieldAlert,
  [LocationType.LABORATORY]:        Microscope,
  // Reproducción
  [LocationType.BREEDING_CENTER]:   HeartHandshake,
  // Administración
  [LocationType.OFFICE]:            Building2,
  [LocationType.RESIDENTIAL]:       House,
  // Logística
  [LocationType.LOADING_AREA]:      TruckIcon,
  [LocationType.STORAGE]:           Package,
  [LocationType.EQUIPMENT_SHED]:    Wrench,
  [LocationType.ROUTE]:             Route,
  // Procesamiento industrial
  [LocationType.PROCESSING_PLANT]:  Factory,
  // Manejo de residuos
  [LocationType.WASTE_MANAGEMENT]:  Trash2,
  // Seguridad y acceso
  [LocationType.ENTRANCE_GATE]:     DoorOpen,
  [LocationType.SECURITY_POST]:     Shield,
  [LocationType.CHECKPOINT]:        CheckSquare,
  // Riesgo / Restricción
  [LocationType.EMERGENCY_POINT]:   AlertOctagon,
  [LocationType.RESTRICTED_AREA]:   Ban,
  [LocationType.DANGER_ZONE]:       AlertTriangle,
  // Zona segura
  [LocationType.SAFE_ZONE]:         ShieldCheck,
  // Misc
  [LocationType.OTHER]:             MoreHorizontal,
};

/**
 * Resuelve label + icono + clases (badge / dot) para un tipo de ubicación.
 * Labels y clases vienen del design-system; el icono se mapea localmente.
 * Defensive: type null/undefined → fallback gris para evitar TypeError
 * (este crash bloqueaba el tab "Potreros" anteriormente).
 */
const getLocationConfig = (type: string | undefined | null) => {
  if (!type || typeof type !== 'string') {
    return {
      label: LOCATION_TYPE_FALLBACK.label,
      icon:  MapPin,
      badgeClasses: LOCATION_TYPE_FALLBACK.badgeClasses,
      dotClasses:   LOCATION_TYPE_FALLBACK.dotClasses,
    };
  }
  const label = (LOCATION_TYPE_LABELS as Record<string, string>)[type];
  const badgeClasses = (LOCATION_TYPE_BADGE_CLASSES as Record<string, string>)[type];
  const dotClasses   = (LOCATION_TYPE_DOT_CLASSES as Record<string, string>)[type];
  const icon         = LOCATION_TYPE_ICONS[type];
  return {
    label:        label        ?? type.replace(/_/g, ' '),
    icon:         icon         ?? MapPin,
    badgeClasses: badgeClasses ?? LOCATION_TYPE_FALLBACK.badgeClasses,
    dotClasses:   dotClasses   ?? LOCATION_TYPE_FALLBACK.dotClasses,
  };
};

// ─── Duration badge ───────────────────────────────────────────────────────────
// Las razones de movimiento (incluyendo aliases legacy: HEALTH→MEDICAL,
// ROUTINE→GRAZING, SALE_PREP→SALE, etc.) se resuelven vía
// `getMovementReasonLabel` del design-system. Centraliza los 8 valores
// canónicos del enum `MovementReason` con fallback a "Otro".

function durationLabel(days?: number): string {
  if (days == null || days < 0) return '—';
  if (days === 0) return 'Menos de 1 día';
  if (days === 1) return '1 día';
  if (days < 30) return `${days} días`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  const base = months === 1 ? '1 mes' : `${months} meses`;
  return rem > 0 ? `${base} y ${rem} días` : base;
}

function daysElapsed(enteredAt: string | undefined | null, exitedAt?: string | null): number {
  // Sin enteredAt no podemos calcular nada — devolvemos 0 silenciosamente.
  if (!enteredAt) return 0;
  const start = new Date(enteredAt).getTime();
  if (!Number.isFinite(start)) return 0;
  const end = exitedAt ? new Date(exitedAt).getTime() : Date.now();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

// ─── Timeline entry card ──────────────────────────────────────────────────────

interface MovementCardProps {
  movement: LocationMovement;
  isCurrent: boolean;
  isFirst: boolean;
}

function MovementCard({ movement, isCurrent, isFirst }: MovementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getLocationConfig(movement.locationType);
  const Icon = cfg.icon;
  const days = movement.durationDays ?? daysElapsed(movement.enteredAt, movement.exitedAt);
  const hasExtra = !!(movement.reason || movement.movedByName || movement.notes);

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot + connector */}
      <div className="flex flex-col items-center">
        <div className={cn(
          'relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 shrink-0',
          isCurrent
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
        )}>
          {isCurrent ? (
            <Navigation className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          ) : (
            <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          )}
        </div>
        {/* Vertical line — hidden for last item */}
        {!isFirst && (
          <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-1 mb-1" />
        )}
      </div>

      {/* Card body */}
      <div className={cn(
        'flex-1 mb-4 rounded-xl border transition-shadow',
        isCurrent
          ? 'border-primary-200 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10 shadow-sm'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50',
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* Location type badge */}
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.badgeClasses)}>
                <Icon className="w-3 h-3" />
                {cfg.label}
              </span>

              {/* Current badge */}
              {isCurrent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" />
                  Actual
                </span>
              )}
            </div>

            {/* Location name */}
            <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {movement.locationName}
              {movement.locationCode && (
                <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">
                  #{movement.locationCode}
                </span>
              )}
            </p>

            {/* Date range */}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(movement.enteredAt)}
                {movement.exitedAt && (
                  <>
                    <ArrowRightLeft className="w-3 h-3 mx-1" />
                    {formatDate(movement.exitedAt)}
                  </>
                )}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                {durationLabel(days)}
              </span>
            </div>
          </div>

          {/* Expand toggle — only if extra info */}
          {hasExtra && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && hasExtra && (
          <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-3 space-y-2">
            {movement.reason && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 w-16 shrink-0">Motivo</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700">
                  {getMovementReasonLabel(movement.reason)}
                </span>
              </div>
            )}
            {movement.movedByName && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 w-16 shrink-0">Movido por</span>
                <span className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
                  <User className="w-3 h-3" />
                  {movement.movedByName}
                </span>
              </div>
            )}
            {movement.notes && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 w-16 shrink-0 pt-0.5">Notas</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{movement.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <MapPin className="w-8 h-8 text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sin historial de ubicaciones</p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        Los movimientos entre potreros aparecerán aquí.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BovineLocationHistoryTab({ bovineId }: BovineLocationHistoryTabProps) {
  const { data: raw, isLoading, isError } = useQuery({
    queryKey: ['bovine-location-history', bovineId],
    queryFn: async () => {
      const res = await locationsApi.getLocationHistory(bovineId);
      const rows = res.data.data ?? [];
      // ── Adapter ─────────────────────────────────────────────────────
      // El backend devuelve la entidad Sequelize `BovineLocationHistory`
      // cruda, con la location ANIDADA:
      //   { id, bovineId, locationId, enteredAt, exitedAt,
      //     location: { id, name, type } }
      // Pero la UI consume la shape PLANA `LocationMovement`:
      //   { locationName, locationType, locationCode, ... }
      //
      // Sin este adapter `locationType` llegaba undefined y el helper
      // `getLocationConfig(undefined)` crasheaba con
      // "Cannot read properties of undefined (reading 'replace')",
      // dejando el tab en pantalla blanca.
      return rows.map((r: any): LocationMovement => ({
        id:           r.id,
        bovineId:     r.bovineId,
        locationId:   r.locationId,
        locationName: r.location?.name        ?? r.locationName ?? 'Ubicación desconocida',
        locationType: (r.location?.type       ?? r.locationType ?? 'OTHER') as LocationType,
        locationCode: r.location?.locationCode ?? r.locationCode,
        enteredAt:    r.enteredAt,
        exitedAt:     r.exitedAt ?? undefined,
        durationDays: r.durationDays,
        reason:       r.reason,
        movementType: r.movementType,
        movedBy:      r.movedBy ?? r.recordedBy,
        movedByName:  r.movedByName ?? r.recordedByName,
        notes:        r.notes,
        coordinates:  r.coordinates,
      }));
    },
    enabled: !!bovineId,
  });

  // Sort newest-first; keep a separate "current" (no exitedAt) at the top
  const movements: LocationMovement[] = raw ?? [];
  const sorted = [...movements].sort(
    (a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime(),
  );
  const current = sorted.find((m) => !m.exitedAt);
  const history = sorted.filter((m) => !!m.exitedAt || m === current);

  // Stats
  const totalMoves = movements.length;
  const uniqueLocations = new Set(movements.map((m) => m.locationId)).size;
  const longestStay = movements.reduce<number>((max, m) => {
    const d = m.durationDays ?? daysElapsed(m.enteredAt, m.exitedAt);
    return d > max ? d : max;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header stats */}
      {totalMoves > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalMoves}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Movimientos</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{uniqueLocations}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ubicaciones distintas</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{longestStay}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Días estancia máx.</p>
          </div>
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary-500" />
          Historial de Ubicaciones
        </CardTitle>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-sm">No se pudo cargar el historial de ubicaciones.</p>
          </div>
        ) : history.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6">
            {history.map((movement, idx) => (
              <MovementCard
                key={movement.id}
                movement={movement}
                isCurrent={!movement.exitedAt}
                isFirst={idx === history.length - 1}
              />
            ))}

            {/* Timeline end marker */}
            <div className="flex gap-4 pl-1">
              <div className="flex flex-col items-center w-9">
                <div className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 pb-2 mt-0.5">
                Ingreso inicial · {history.length > 0 ? formatDate(history[history.length - 1].enteredAt) : '—'}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
