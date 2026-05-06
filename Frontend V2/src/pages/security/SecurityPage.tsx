import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';
import { useToast } from '@/store/ToastContext';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2,
  XCircle, Clock, Globe, Monitor, Smartphone, Tablet, Search,
  Filter, RotateCcw, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

interface SecurityEvent {
  id: string;
  userId?: string;
  userEmail?: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  deviceInfo?: {
    type?: 'mobile' | 'desktop' | 'tablet';
    os?: string;
    browser?: string;
    version?: string;
  };
  sessionId?: string;
  tokenId?: string;
  additionalData?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt?: string;
  timeElapsed?: number; // minutes
}

interface SecurityStats {
  period: { days: number };
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  critical: number;
  unresolved: number;
  resolved: number;
  resolutionRate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Inicio de sesión',
  LOGIN_FAILED: 'Login fallido',
  LOGOUT: 'Cierre de sesión',
  PASSWORD_CHANGE: 'Cambio de contraseña',
  PASSWORD_CHANGED: 'Contraseña cambiada',
  PASSWORD_RESET_REQUEST: 'Solicitud de reset',
  PASSWORD_RESET_SUCCESS: 'Reset exitoso',
  PASSWORD_RESET_FAILED: 'Reset fallido',
  PASSWORD_RESET_RATE_LIMIT_EXCEEDED: 'Límite de resets excedido',
  EMAIL_VERIFICATION_REQUEST: 'Verificación solicitada',
  EMAIL_VERIFICATION_SUCCESS: 'Email verificado',
  ACCOUNT_LOCKED: 'Cuenta bloqueada',
  ACCOUNT_UNLOCKED: 'Cuenta desbloqueada',
  TOKEN_REVOKED: 'Token revocado',
  SUSPICIOUS_ACTIVITY: 'Actividad sospechosa',
  RATE_LIMIT_EXCEEDED: 'Límite de tasa excedido',
  INVALID_TOKEN: 'Token inválido',
  UNAUTHORIZED_ACCESS: 'Acceso no autorizado',
  ADMIN_ACTION: 'Acción administrativa',
};

const SEVERITY_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; icon: React.ReactNode }> = {
  LOW: { label: 'Baja', variant: 'default', icon: <Shield className="w-3.5 h-3.5" /> },
  MEDIUM: { label: 'Media', variant: 'warning', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  HIGH: { label: 'Alta', variant: 'danger', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  CRITICAL: { label: 'Crítica', variant: 'purple', icon: <XCircle className="w-3.5 h-3.5" /> },
};

const SEVERITY_OPTIONS = [
  { value: '', label: 'Todas las severidades' },
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'CRITICAL', label: 'Crítica' },
];

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  ...Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const RESOLVED_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'false', label: 'Sin resolver' },
  { value: 'true', label: 'Resueltos' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getDeviceIcon(type?: string) {
  switch (type) {
    case 'mobile': return <Smartphone className="w-4 h-4" />;
    case 'tablet': return <Tablet className="w-4 h-4" />;
    default: return <Monitor className="w-4 h-4" />;
  }
}

function formatElapsedTime(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

// ─── Component ────────────────────────────────────────────────────────────

export function SecurityPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // State
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Queries
  const { data: eventsRaw, isLoading } = useQuery({
    queryKey: ['security-events', page, severityFilter, typeFilter, resolvedFilter],
    queryFn: () => usersApi.getSecurityEvents({
      page,
      limit: 20,
      ...(severityFilter ? { severity: severityFilter } : {}),
      ...(typeFilter ? { eventType: typeFilter } : {}),
      ...(resolvedFilter ? { resolved: resolvedFilter } : {}),
    } as Record<string, unknown> as { page: number; limit: number }).then((r) => r.data.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['security-stats'],
    queryFn: () => usersApi.getSecurityStats().then((r) => r.data.data as SecurityStats),
  });

  const { data: unresolvedData } = useQuery({
    queryKey: ['security-unresolved'],
    queryFn: () => usersApi.getUnresolvedEvents().then((r) => r.data.data as SecurityEvent[]),
  });

  // Normalize events
  const events = useMemo((): SecurityEvent[] => {
    if (!eventsRaw) return [];
    if (Array.isArray(eventsRaw)) return eventsRaw as SecurityEvent[];
    if ('items' in (eventsRaw as object)) return (eventsRaw as { items: SecurityEvent[] }).items;
    if ('data' in (eventsRaw as object)) return (eventsRaw as unknown as { data: SecurityEvent[] }).data;
    return [];
  }, [eventsRaw]);

  const totalPages = useMemo(() => {
    if (!eventsRaw || Array.isArray(eventsRaw)) return 1;
    return (eventsRaw as { totalPages?: number }).totalPages || 1;
  }, [eventsRaw]);

  const totalCount = useMemo(() => {
    if (!eventsRaw || Array.isArray(eventsRaw)) return events.length;
    return (eventsRaw as { total?: number }).total || events.length;
  }, [eventsRaw, events.length]);

  const unresolvedCount = unresolvedData?.length || 0;

  // Mutations
  const resolveMutation = useMutation({
    mutationFn: (id: string) => usersApi.resolveEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-events'] });
      queryClient.invalidateQueries({ queryKey: ['security-stats'] });
      queryClient.invalidateQueries({ queryKey: ['security-unresolved'] });
      toast.success('Evento resuelto', 'El evento de seguridad fue marcado como resuelto.');
      setSelectedEvent(null);
      setResolutionNotes('');
    },
    onError: (err: any) => {
      toast.error('Error al resolver', err?.response?.data?.error?.message || 'No se pudo resolver el evento.');
    },
  });

  const batchResolveMutation = useMutation({
    mutationFn: (ids: string[]) => usersApi.resolveBatch(ids),
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['security-events'] });
      queryClient.invalidateQueries({ queryKey: ['security-stats'] });
      queryClient.invalidateQueries({ queryKey: ['security-unresolved'] });
      toast.success('Eventos resueltos', `${ids.length} evento(s) marcados como resueltos.`);
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast.error('Error al resolver', err?.response?.data?.error?.message || 'No se pudieron resolver los eventos.');
    },
  });

  // Checkbox toggle
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const unresolvedOnPage = events.filter((e) => !e.resolved);
    if (selectedIds.size === unresolvedOnPage.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unresolvedOnPage.map((e) => e.id)));
    }
  };

  // Stats
  const stats = statsData || { total: 0, critical: 0, unresolved: 0, resolved: 0, resolutionRate: 0, byType: {}, bySeverity: {}, period: { days: 7 } };

  // ── Table columns ─────────────────────────────────────────────────────

  const columns: Column<SecurityEvent>[] = [
    {
      key: 'select',
      header: '',
      className: 'w-10',
      render: (e) => !e.resolved ? (
        <input
          type="checkbox"
          checked={selectedIds.has(e.id)}
          onChange={() => toggleSelect(e.id)}
          onClick={(ev) => ev.stopPropagation()}
          className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
        />
      ) : null,
    },
    {
      key: 'severity',
      header: 'Severidad',
      className: 'w-28',
      render: (e) => {
        const cfg = SEVERITY_CONFIG[e.severity] || SEVERITY_CONFIG.LOW;
        return (
          <Badge variant={cfg.variant}>
            <span className="flex items-center gap-1">{cfg.icon} {cfg.label}</span>
          </Badge>
        );
      },
    },
    {
      key: 'event',
      header: 'Evento',
      render: (e) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            {EVENT_TYPE_LABELS[e.eventType] || e.eventType}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
            {e.description}
          </p>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Usuario',
      render: (e) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {e.userEmail || '—'}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Origen',
      render: (e) => (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {e.deviceInfo?.type && (
            <span title={`${e.deviceInfo.os} - ${e.deviceInfo.browser}`}>
              {getDeviceIcon(e.deviceInfo.type)}
            </span>
          )}
          {e.ipAddress && (
            <span className="flex items-center gap-1" title={e.location?.city ? `${e.location.city}, ${e.location.country}` : undefined}>
              <Globe className="w-3.5 h-3.5" />
              {e.ipAddress}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (e) => (
        <div className="text-sm">
          <p className="text-gray-700 dark:text-gray-300">{formatDateTime(e.createdAt)}</p>
          {e.timeElapsed != null && !e.resolved && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" /> Hace {formatElapsedTime(e.timeElapsed)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      className: 'w-28',
      render: (e) => e.resolved ? (
        <Badge variant="success">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Resuelto
          </span>
        </Badge>
      ) : (
        <Badge variant="warning">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pendiente
          </span>
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (e) => (
        <button
          onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Ver detalles"
        >
          <Eye className="w-4 h-4 text-gray-500" />
        </button>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <Shield className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Seguridad</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Eventos de seguridad y auditoría del sistema
            </p>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <Button
            variant="primary"
            icon={<CheckCircle2 className="w-4 h-4" />}
            loading={batchResolveMutation.isPending}
            onClick={() => batchResolveMutation.mutate([...selectedIds])}
          >
            Resolver {selectedIds.size} evento{selectedIds.size > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 p-2">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500">Total ({stats.period.days}d)</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-2">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.critical}</p>
              <p className="text-xs text-gray-500">Críticos</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-2">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{unresolvedCount}</p>
              <p className="text-xs text-gray-500">Sin resolver</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-2">
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.resolutionRate ? `${Math.round(stats.resolutionRate)}%` : '—'}
              </p>
              <p className="text-xs text-gray-500">Tasa resolución</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="!p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 w-full text-left"
        >
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">Filtros</span>
          {showFilters ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            >
              {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            >
              {EVENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={resolvedFilter}
              onChange={(e) => { setResolvedFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            >
              {RESOLVED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
      </Card>

      {/* Batch error */}
      {batchResolveMutation.error && (
        <Alert variant="error">Error al resolver eventos en lote</Alert>
      )}

      {/* Select all for unresolved */}
      {events.some((e) => !e.resolved) && (
        <div className="flex items-center gap-3 px-1">
          <input
            type="checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === events.filter((e) => !e.resolved).length}
            onChange={toggleSelectAll}
            className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Seleccionar todos los pendientes de esta página
          </span>
        </div>
      )}

      {/* Events Table */}
      <DataTable<SecurityEvent>
        columns={columns}
        data={events}
        loading={isLoading}
        keyExtractor={(e) => e.id}
        page={page}
        totalPages={totalPages}
        total={totalCount}
        onPageChange={setPage}
        onRowClick={setSelectedEvent}
        emptyMessage="No se encontraron eventos de seguridad"
      />

      {/* ── Event Detail Modal ─────────────────────────────────────────── */}
      <Modal
        open={!!selectedEvent}
        onClose={() => { setSelectedEvent(null); setResolutionNotes(''); resolveMutation.reset(); }}
        title="Detalle del Evento"
        size="lg"
      >
        {selectedEvent && (
          <div className="space-y-5">
            {/* Header badges */}
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const cfg = SEVERITY_CONFIG[selectedEvent.severity] || SEVERITY_CONFIG.LOW;
                return (
                  <Badge variant={cfg.variant}>
                    <span className="flex items-center gap-1">{cfg.icon} {cfg.label}</span>
                  </Badge>
                );
              })()}
              <Badge variant={selectedEvent.resolved ? 'success' : 'warning'}>
                {selectedEvent.resolved ? 'Resuelto' : 'Pendiente'}
              </Badge>
              <Badge variant="info">
                {EVENT_TYPE_LABELS[selectedEvent.eventType] || selectedEvent.eventType}
              </Badge>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Descripción</h4>
              <p className="text-gray-900 dark:text-white">{selectedEvent.description}</p>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedEvent.userEmail && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Usuario</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedEvent.userEmail}</p>
                </div>
              )}
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Fecha</h4>
                <p className="text-sm text-gray-900 dark:text-white">{formatDateTime(selectedEvent.createdAt)}</p>
              </div>
              {selectedEvent.ipAddress && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Dirección IP</h4>
                  <p className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-gray-400" /> {selectedEvent.ipAddress}
                  </p>
                </div>
              )}
              {selectedEvent.location?.city && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Ubicación</h4>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {[selectedEvent.location.city, selectedEvent.location.region, selectedEvent.location.country]
                      .filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* Device info */}
            {selectedEvent.deviceInfo && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Dispositivo</h4>
                <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                  {getDeviceIcon(selectedEvent.deviceInfo.type)}
                  <span>
                    {[selectedEvent.deviceInfo.os, selectedEvent.deviceInfo.browser, selectedEvent.deviceInfo.version]
                      .filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>
            )}

            {/* Additional data */}
            {selectedEvent.additionalData && Object.keys(selectedEvent.additionalData).length > 0 && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Datos adicionales</h4>
                <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                  {JSON.stringify(selectedEvent.additionalData, null, 2)}
                </pre>
              </div>
            )}

            {/* Resolution info (if resolved) */}
            {selectedEvent.resolved && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <h4 className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Resolución</h4>
                <p className="text-sm text-green-800 dark:text-green-300">
                  Resuelto el {selectedEvent.resolvedAt ? formatDateTime(selectedEvent.resolvedAt) : '—'}
                </p>
                {selectedEvent.resolutionNotes && (
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    {selectedEvent.resolutionNotes}
                  </p>
                )}
              </div>
            )}

            {/* Resolve action (if not resolved) */}
            {!selectedEvent.resolved && (
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Resolver este evento</h4>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={2}
                  placeholder="Notas de resolución (opcional)..."
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />

                {resolveMutation.error && (
                  <Alert variant="error">Error al resolver el evento</Alert>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { setSelectedEvent(null); setResolutionNotes(''); }}
                  >
                    Cerrar
                  </Button>
                  <Button
                    variant="primary"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    loading={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate(selectedEvent.id)}
                  >
                    Marcar como Resuelto
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
