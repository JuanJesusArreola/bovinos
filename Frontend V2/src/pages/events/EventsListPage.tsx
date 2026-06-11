/**
 * Listado paginado de Eventos del rancho activo.
 *
 * Ruta: /events
 * Permisos: VIEW abierto a todos los roles autenticados.
 *
 * Caracteristicas:
 *   - Filtros multi-select para eventType, status, priority.
 *   - Date range (startDate/endDate).
 *   - Tri-estado para isActive (Todos / Solo activos / Solo inactivos).
 *   - Tabla desktop + cards mobile.
 *   - Chip distintivo "Generado por chequeo de salud" en eventos auto-
 *     creados por la mejora 5 del backend (tienen healthRecordId).
 *   - Acciones inline por evento: Start / Complete / Cancel.
 *
 * Cuando un evento tiene `healthRecordId`, el chip incluye un link al
 * HealthRecord origen (ruta /health/records/:id - implementacion en
 * siguiente tarea).
 */

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import {
  RanchFilterBanner, RanchFilterBannerEmpty,
} from '@/components/shared/RanchFilterBanner';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { PageLoader } from '@/components/ui/Spinner';
import {
  CalendarDays, Filter, ChevronDown, ChevronUp, RotateCcw,
  ChevronLeft, ChevronRight, ExternalLink, HeartPulse,
  Play, CheckCircle2, XCircle, Clock, AlertTriangle, Plus,
} from 'lucide-react';
import { CreateEventModal } from '@/components/events/CreateEventModal';
import {
  useEventsList, useStartEvent, useCompleteEvent, useCancelEvent,
} from '@/hooks/useEvents';
import {
  EventType, EventStatus, type EventsListFilters, type Event,
} from '@/types/event.types';
import {
  getEventLabel, getEventBadgeClass,
} from '@/design-system/tokens/event.colors';
import { formatDate, formatRelative } from '@/utils/formatters';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: EventStatus.SCHEDULED,   label: 'Programado' },
  { value: EventStatus.PENDING,     label: 'Pendiente' },
  { value: EventStatus.IN_PROGRESS, label: 'En curso' },
  { value: EventStatus.COMPLETED,   label: 'Completado' },
  { value: EventStatus.OVERDUE,     label: 'Atrasado' },
  { value: EventStatus.POSTPONED,   label: 'Pospuesto' },
  { value: EventStatus.CANCELLED,   label: 'Cancelado' },
];

const PRIORITY_OPTIONS: Array<{
  value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; label: string;
}> = [
  { value: 'LOW',    label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH',   label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

const TRI_STATE = [
  { value: '',      label: 'Todos' },
  { value: 'true',  label: 'Solo activos' },
  { value: 'false', label: 'Solo inactivos' },
];

// ── Helpers visuales ────────────────────────────────────────────────────────

function statusBadgeVariant(s: string): 'default' | 'info' | 'success' | 'warning' | 'danger' {
  switch (String(s).toUpperCase()) {
    case 'SCHEDULED':
    case 'PENDING':     return 'info';
    case 'IN_PROGRESS': return 'warning';
    case 'COMPLETED':   return 'success';
    case 'OVERDUE':     return 'danger';
    case 'CANCELLED':   return 'default';
    case 'POSTPONED':   return 'default';
    default:            return 'default';
  }
}

function priorityBadgeVariant(p?: string): 'default' | 'info' | 'warning' | 'danger' {
  switch (p) {
    case 'URGENT': return 'danger';
    case 'HIGH':   return 'warning';
    case 'MEDIUM': return 'info';
    case 'LOW':    return 'default';
    default:       return 'default';
  }
}

// ── Page ────────────────────────────────────────────────────────────────────

export function EventsListPage() {
  const { activeRanchId } = useAuth();
  const toast = useToast();

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [statuses, setStatuses]     = useState<EventStatus[]>([]);
  const [priorities, setPriorities] = useState<Array<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>>([]);
  const [isActive, setIsActive]     = useState('');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [page, setPage]             = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen]   = useState(false);

  useEffect(() => { setPage(1); }, [
    eventTypes, statuses, priorities, isActive, startDate, endDate,
  ]);

  const filters: EventsListFilters = useMemo(() => ({
    ranchId: activeRanchId ?? undefined,
    page,
    limit: PAGE_SIZE,
    ...(eventTypes.length    ? { eventType: eventTypes }                    : {}),
    ...(statuses.length      ? { status: statuses }                         : {}),
    ...(priorities.length    ? { priority: priorities }                     : {}),
    ...(isActive             ? { isActive: isActive === 'true' }            : {}),
    ...(startDate            ? { startDate }                                : {}),
    ...(endDate              ? { endDate }                                  : {}),
  }), [
    activeRanchId, page, eventTypes, statuses, priorities,
    isActive, startDate, endDate,
  ]);

  const { data, isLoading, isError, error } = useEventsList(filters, {
    enabled: !!activeRanchId,
  });
  const events     = data?.data       ?? [];
  const pagination = data?.pagination;

  const startMutation    = useStartEvent();
  const completeMutation = useCompleteEvent();
  const cancelMutation   = useCancelEvent();

  async function handleStart(id: string) {
    try {
      await startMutation.mutateAsync(id);
      toast.success('Evento iniciado');
    } catch (err) {
      toast.error('No se pudo iniciar', (err as Error)?.message);
    }
  }
  async function handleComplete(id: string) {
    try {
      await completeMutation.mutateAsync(id);
      toast.success('Evento completado');
    } catch (err) {
      toast.error('No se pudo completar', (err as Error)?.message);
    }
  }
  async function handleCancel(id: string) {
    if (!confirm('Cancelar este evento?')) return;
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Evento cancelado');
    } catch (err) {
      toast.error('No se pudo cancelar', (err as Error)?.message);
    }
  }

  function toggleEventType(v: EventType) {
    setEventTypes((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }
  function toggleStatus(v: EventStatus) {
    setStatuses((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }
  function togglePriority(v: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') {
    setPriorities((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  function resetFilters() {
    setEventTypes([]); setStatuses([]); setPriorities([]);
    setIsActive(''); setStartDate(''); setEndDate('');
  }

  const activeFilterCount =
    eventTypes.length + statuses.length + priorities.length
    + (isActive ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0);

  // KPIs derivados de la pagina visible.
  const pageKpis = useMemo(() => {
    const scheduled = events.filter((e) =>
      e.status === EventStatus.SCHEDULED || e.status === EventStatus.PENDING,
    ).length;
    const overdue   = events.filter((e) => e.status === EventStatus.OVERDUE).length;
    const fromHealth = events.filter((e) => !!e.healthRecordId).length;
    return { scheduled, overdue, fromHealth };
  }, [events]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <CalendarDays className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Eventos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Calendario de tareas programadas, chequeos y seguimientos del rancho.
            </p>
          </div>
        </div>
        {activeRanchId && (
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Nuevo evento
          </Button>
        )}
      </div>

      <RanchFilterBanner
        activeHint="Eventos de este rancho."
        emptyHint="Selecciona un rancho para ver sus eventos."
      />

      {!activeRanchId && (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="Los eventos se listan por rancho. Elige uno arriba para continuar."
        />
      )}

      {activeRanchId && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat
              icon={<Clock className="w-4 h-4" />}
              label="Programados"
              value={pageKpis.scheduled}
              colorClass="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
            />
            <MiniStat
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Atrasados"
              value={pageKpis.overdue}
              colorClass="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
            />
            <MiniStat
              icon={<HeartPulse className="w-4 h-4" />}
              label="De chequeos de salud"
              value={pageKpis.fromHealth}
              colorClass="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
            />
          </div>

          {/* Filtros colapsables */}
          <Card noPadding className="overflow-hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Filtros</span>
                {activeFilterCount > 0 && (
                  <Badge variant="info">{activeFilterCount} activos</Badge>
                )}
              </div>
              {filtersOpen
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {filtersOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3 h-3" />} onClick={resetFilters}>
                    Limpiar filtros
                  </Button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    type="date"
                    label="Desde"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Input
                    type="date"
                    label="Hasta"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <Select
                    label="Activos"
                    options={TRI_STATE}
                    value={isActive}
                    onChange={(e) => setIsActive(e.target.value)}
                  />
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Tipo de evento
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(EventType).map((t) => {
                      const active = eventTypes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleEventType(t)}
                          className={[
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400',
                          ].join(' ')}
                        >
                          {getEventLabel(t)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Estado</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map((s) => {
                      const active = statuses.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => toggleStatus(s.value)}
                          className={[
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400',
                          ].join(' ')}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Prioridad</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITY_OPTIONS.map((p) => {
                      const active = priorities.includes(p.value);
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => togglePriority(p.value)}
                          className={[
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400',
                          ].join(' ')}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {isLoading ? (
            <PageLoader />
          ) : isError ? (
            <Alert variant="error" title="No se pudieron cargar los eventos">
              {(error as Error)?.message ?? 'Intenta nuevamente.'}
            </Alert>
          ) : events.length === 0 ? (
            <Card className="text-center py-12">
              <CalendarDays className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">Sin eventos que mostrar</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {activeFilterCount > 0
                  ? 'Prueba ajustando los filtros o limpiandolos.'
                  : 'Cuando se programe un evento aparecera aqui.'}
              </p>
            </Card>
          ) : (
            <>
              <DesktopTable
                events={events}
                onStart={handleStart}
                onComplete={handleComplete}
                onCancel={handleCancel}
                pendingId={
                  startMutation.isPending    ? startMutation.variables    :
                  completeMutation.isPending ? completeMutation.variables :
                  cancelMutation.isPending   ? cancelMutation.variables   : null
                }
              />
              <MobileList
                events={events}
                onStart={handleStart}
                onComplete={handleComplete}
                onCancel={handleCancel}
              />

              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Pagina {pagination.page} de {pagination.pages} &middot; {pagination.total} eventos
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      icon={<ChevronLeft className="w-4 h-4" />}
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      icon={<ChevronRight className="w-4 h-4" />}
                      iconPosition="right"
                      disabled={page >= pagination.pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal de creacion manual de evento. Se monta solo cuando esta
          abierto; tras crear, las caches se invalidan via useCreateEvent
          y el listado refresca automaticamente. */}
      <CreateEventModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}

function MiniStat({ icon, label, value, colorClass }: MiniStatProps) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-3">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </Card>
  );
}

interface TableProps {
  events: Event[];
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  pendingId?: string | null;
}

/**
 * Chip distintivo "Generado por chequeo de salud" cuando el evento fue
 * auto-creado por la mejora 5 del backend (tiene healthRecordId).
 * Incluye link al detalle del HealthRecord origen.
 */
function HealthOriginChip({ healthRecordId }: { healthRecordId: string }) {
  return (
    <Link
      to={`/health/records/${healthRecordId}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
      title="Evento generado automaticamente por un chequeo de salud"
    >
      <HeartPulse className="w-3 h-3" />
      Generado por chequeo de salud
      <ExternalLink className="w-2.5 h-2.5 opacity-70" />
    </Link>
  );
}

function ActionButtons({
  event, onStart, onComplete, onCancel, pendingId,
}: {
  event: Event;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  pendingId?: string | null;
}) {
  const isPending = pendingId === event.id;
  const status = String(event.status).toUpperCase();
  const canStart    = status === 'SCHEDULED' || status === 'PENDING';
  const canComplete = canStart || status === 'IN_PROGRESS';
  const canCancel   = status !== 'COMPLETED' && status !== 'CANCELLED';

  return (
    <div className="flex items-center gap-1.5">
      {canStart && (
        <button
          type="button"
          onClick={() => onStart(event.id)}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
          title="Marcar como en curso"
        >
          <Play className="w-3 h-3" />
          Iniciar
        </button>
      )}
      {canComplete && (
        <button
          type="button"
          onClick={() => onComplete(event.id)}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-50"
          title="Marcar como completado"
        >
          <CheckCircle2 className="w-3 h-3" />
          Completar
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          onClick={() => onCancel(event.id)}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
          title="Cancelar evento"
        >
          <XCircle className="w-3 h-3" />
          Cancelar
        </button>
      )}
    </div>
  );
}

function DesktopTable({
  events, onStart, onComplete, onCancel, pendingId,
}: TableProps) {
  return (
    <Card noPadding className="hidden lg:block overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 font-medium">Titulo</th>
              <th className="text-left px-4 py-3 font-medium">Bovino</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-left px-4 py-3 font-medium">Prioridad</th>
              <th className="text-left px-4 py-3 font-medium">Origen</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="text-gray-700 dark:text-gray-300">{formatDate(e.scheduledDate)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatRelative(e.scheduledDate)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getEventBadgeClass(e.type)}`}>
                    {getEventLabel(e.type)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white">{e.title}</p>
                  {e.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[280px]">
                      {e.description}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {e.bovineId ? (
                    <Link to={`/bovines/${e.bovineId}`} className="hover:underline">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {e.bovineEarTag ?? e.bovineId.slice(0, 8)}
                      </p>
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadgeVariant(e.status)}>{e.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  {e.priority ? (
                    <Badge variant={priorityBadgeVariant(e.priority)}>{e.priority}</Badge>
                  ) : (
                    <span className="text-xs text-gray-400">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {e.healthRecordId
                    ? <HealthOriginChip healthRecordId={e.healthRecordId} />
                    : <span className="text-xs text-gray-400">Manual</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionButtons
                    event={e}
                    onStart={onStart}
                    onComplete={onComplete}
                    onCancel={onCancel}
                    pendingId={pendingId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MobileList({ events, onStart, onComplete, onCancel }: TableProps) {
  return (
    <div className="lg:hidden grid grid-cols-1 gap-3">
      {events.map((e) => (
        <Card key={e.id} className="!p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">{e.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(e.scheduledDate)} &middot; {formatRelative(e.scheduledDate)}
              </p>
            </div>
            <Badge variant={statusBadgeVariant(e.status)}>{e.status}</Badge>
          </div>

          {e.description && (
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{e.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getEventBadgeClass(e.type)}`}>
              {getEventLabel(e.type)}
            </span>
            {e.priority && (
              <Badge variant={priorityBadgeVariant(e.priority)}>{e.priority}</Badge>
            )}
            {e.bovineId && (
              <Link to={`/bovines/${e.bovineId}`} className="text-primary-600 dark:text-primary-400 hover:underline">
                {e.bovineEarTag ?? 'Ver bovino'}
              </Link>
            )}
            {e.healthRecordId && <HealthOriginChip healthRecordId={e.healthRecordId} />}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <ActionButtons
              event={e}
              onStart={onStart}
              onComplete={onComplete}
              onCancel={onCancel}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
