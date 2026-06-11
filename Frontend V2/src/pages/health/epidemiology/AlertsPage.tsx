/**
 * AlertsPage — listado de alertas epidemiológicas del rancho.
 *
 * Ruta: `/health/epidemiology/alerts`
 * Permisos: CLINICAL_ROLES (mismo que el dashboard epidemiológico).
 *
 * Permite filtrar por estado (OPEN / ACKNOWLEDGED / RESOLVED) y
 * ejecutar las acciones: Reconocer (ACKNOWLEDGED) y Resolver (RESOLVED).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { RanchFilterBanner, RanchFilterBannerEmpty } from '@/components/shared/RanchFilterBanner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { canUser } from '@/utils/permissions';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import {
  ArrowLeft, Bell, CheckCircle2, X, AlertTriangle, ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import {
  useEpidemiologyAlerts,
  useUpdateEpidemiologyAlert,
} from '@/hooks/useEpidemiology';
import type { AlertStatus, AlertSeverity, AlertType } from '@/types/epidemiology.dtos';

// ── Labels ────────────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  HIGH_INCIDENCE:     'Alta incidencia',
  OUTBREAK_DETECTED:  'Brote detectado',
  VACCINATION_GAP:    'Brecha vacunal',
  ZOONOTIC_RISK:      'Riesgo zoonótico',
  MORTALITY_SPIKE:    'Pico de mortalidad',
  NEW_CASES_SPIKE:    'Pico de nuevos casos',
};

const SEVERITY_VARIANT: Record<AlertSeverity, 'default' | 'warning' | 'danger' | 'error'> = {
  LOW:      'default',
  MEDIUM:   'warning',
  HIGH:     'danger',
  CRITICAL: 'error',
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  LOW:      'Baja',
  MEDIUM:   'Media',
  HIGH:     'Alta',
  CRITICAL: 'Crítica',
};

const STATUS_LABEL: Record<AlertStatus, string> = {
  OPEN:         'Abierta',
  ACKNOWLEDGED: 'Reconocida',
  RESOLVED:     'Resuelta',
};

const STATUS_CLASS: Record<AlertStatus, string> = {
  OPEN:         'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  ACKNOWLEDGED: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  RESOLVED:     'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
};

type FilterStatus = AlertStatus | 'ALL';

export function AlertsPage() {
  const { activeRanchId, user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('OPEN');
  const canManage = canUser(user?.role, 'VIEW_EPIDEMIOLOGY');

  const filters = {
    ...(activeRanchId ? { ranchId: activeRanchId } : {}),
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  };

  const { data: alerts = [], isLoading, refetch } = useEpidemiologyAlerts(filters, {
    enabled: !!activeRanchId,
  });

  const updateMutation = useUpdateEpidemiologyAlert();

  async function handleUpdate(id: string, status: AlertStatus) {
    try {
      await updateMutation.mutateAsync({ id, status });
      toastSuccess(
        'Alerta actualizada',
        status === 'ACKNOWLEDGED' ? 'Alerta reconocida.' : 'Alerta resuelta.',
      );
    } catch (err) {
      toastError('Error', (err as Error)?.message);
    }
  }

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: 'ALL',          label: 'Todas' },
    { value: 'OPEN',         label: 'Abiertas' },
    { value: 'ACKNOWLEDGED', label: 'Reconocidas' },
    { value: 'RESOLVED',     label: 'Resueltas' },
  ];

  return (
    <div className="space-y-6">
      <Link
        to="/health/epidemiology"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-50 dark:bg-red-900/30 p-3">
            <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Alertas Epidemiológicas
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Notificaciones automáticas del sistema de vigilancia sanitaria
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={() => refetch()}
        >
          Actualizar
        </Button>
      </div>

      <RanchFilterBanner
        activeHint="Alertas de este rancho."
        emptyHint="Selecciona un rancho para ver alertas."
      />

      {!activeRanchId && (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="Las alertas se calculan por rancho. Elige uno arriba para continuar."
        />
      )}

      {activeRanchId && (
        <>
          {/* Filtros de estado */}
          <div className="flex gap-2 flex-wrap">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  statusFilter === opt.value
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <Card className="flex items-center justify-center h-48">
              <Spinner />
            </Card>
          ) : alerts.length === 0 ? (
            <Alert variant="info" title="Sin alertas">
              No hay alertas {statusFilter !== 'ALL' ? `con estado "${STATUS_LABEL[statusFilter as AlertStatus]}"` : ''} para este rancho.
            </Alert>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Card key={alert.id}>
                  <div className="flex items-start gap-4 flex-wrap">
                    {/* Icono severidad */}
                    <div className={cn(
                      'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                      alert.severity === 'CRITICAL' && 'bg-red-100 dark:bg-red-900/30',
                      alert.severity === 'HIGH'     && 'bg-orange-100 dark:bg-orange-900/30',
                      alert.severity === 'MEDIUM'   && 'bg-amber-100 dark:bg-amber-900/30',
                      alert.severity === 'LOW'      && 'bg-gray-100 dark:bg-gray-800',
                    )}>
                      <AlertTriangle className={cn(
                        'w-5 h-5',
                        alert.severity === 'CRITICAL' && 'text-red-600 dark:text-red-400',
                        alert.severity === 'HIGH'     && 'text-orange-600 dark:text-orange-400',
                        alert.severity === 'MEDIUM'   && 'text-amber-600 dark:text-amber-400',
                        alert.severity === 'LOW'      && 'text-gray-500 dark:text-gray-400',
                      )} />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {alert.title}
                        </span>
                        <Badge variant={SEVERITY_VARIANT[alert.severity]}>
                          {SEVERITY_LABEL[alert.severity]}
                        </Badge>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          STATUS_CLASS[alert.status],
                        )}>
                          {STATUS_LABEL[alert.status]}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                          {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>{formatDate(alert.created_at)}</span>
                        {alert.disease && (
                          <Link
                            to={`/health/diseases/catalogo/${alert.disease.slug}`}
                            className="text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            {alert.disease.name}
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    {canManage && alert.status !== 'RESOLVED' && (
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {alert.status === 'OPEN' && (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<Bell className="w-3.5 h-3.5" />}
                            loading={updateMutation.isPending}
                            onClick={() => handleUpdate(alert.id, 'ACKNOWLEDGED')}
                          >
                            Reconocer
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                          loading={updateMutation.isPending}
                          onClick={() => handleUpdate(alert.id, 'RESOLVED')}
                        >
                          Resolver
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
