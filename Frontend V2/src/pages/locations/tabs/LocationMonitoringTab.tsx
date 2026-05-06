import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationsApi } from '@/api/locations.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { formatDate, formatRelative } from '@/utils/formatters';
import type { LocationMonitoring, MonitoringAlert, SensorReading } from '@/types/location.types';
import {
  Wifi, WifiOff, Battery, BatteryLow, Thermometer, Droplets, Wind,
  AlertTriangle, CheckCircle2, Settings, Plus, RefreshCw, Wrench,
  Activity, Signal,
} from 'lucide-react';

// ─── Config ───────────────────────────────────────────────────────────────────

const DEVICE_STATUS_CONFIG = {
  ONLINE:      { label: 'En línea',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Wifi },
  OFFLINE:     { label: 'Sin señal',     color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                 icon: WifiOff },
  MAINTENANCE: { label: 'Mantenimiento', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',         icon: Wrench },
  ERROR:       { label: 'Error',         color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                 icon: AlertTriangle },
  UNKNOWN:     { label: 'Desconocido',   color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',                icon: Activity },
};

const SEVERITY_CONFIG = {
  LOW:      { label: 'Baja',     badge: 'info'    as const },
  MEDIUM:   { label: 'Media',    badge: 'warning' as const },
  HIGH:     { label: 'Alta',     badge: 'danger'  as const },
  CRITICAL: { label: 'Crítica',  badge: 'danger'  as const },
};

const SENSOR_ICON: Record<string, React.ElementType> = {
  TEMPERATURE:   Thermometer,
  HUMIDITY:      Droplets,
  WIND_SPEED:    Wind,
  RAIN:          Droplets,
  SOIL_MOISTURE: Droplets,
};

// ─── Battery bar ──────────────────────────────────────────────────────────────

function BatteryBar({ level }: { level: number }) {
  const color = level <= 15 ? 'bg-red-500' : level <= 30 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      {level <= 30 ? <BatteryLow className="w-4 h-4 text-amber-500" /> : <Battery className="w-4 h-4 text-gray-400" />}
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${level}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{level}%</span>
    </div>
  );
}

// ─── SensorCard ───────────────────────────────────────────────────────────────

function SensorCard({ reading }: { reading: SensorReading }) {
  const SensorIcon = SENSOR_ICON[reading.type] ?? Activity;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white dark:bg-gray-900 shadow-sm">
        <SensorIcon className="w-4 h-4 text-primary-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 capitalize">{reading.type.replace('_', ' ').toLowerCase()}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">
          {reading.value} <span className="text-sm font-normal text-gray-400">{reading.unit}</span>
        </p>
      </div>
      <span className="text-xs text-gray-400">{formatRelative(reading.timestamp)}</span>
    </div>
  );
}

// ─── AlertRow ─────────────────────────────────────────────────────────────────

function AlertRow({
  alert, onResolve, resolving,
}: { alert: MonitoringAlert; onResolve: (id: string) => void; resolving: boolean }) {
  const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.LOW;

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl border',
      alert.isActive
        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
        : 'bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800',
    )}>
      <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5', alert.isActive ? 'text-red-500' : 'text-gray-400')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Badge variant={sev.badge}>{sev.label}</Badge>
          <span className="text-xs text-gray-400">{formatDate(alert.triggeredAt)}</span>
        </div>
        <p className="text-sm text-gray-800 dark:text-gray-200">{alert.message}</p>
        {alert.resolvedAt && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Resuelta {formatRelative(alert.resolvedAt)}
          </p>
        )}
      </div>
      {alert.isActive && (
        <Button
          size="sm"
          variant="outline"
          loading={resolving}
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          onClick={() => onResolve(alert.id)}
        >
          Resolver
        </Button>
      )}
    </div>
  );
}

// ─── LocationMonitoringTab ────────────────────────────────────────────────────

interface Props { locationId: string }

export function LocationMonitoringTab({ locationId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();
  const canManage = canUser(user?.role, 'MANAGE_LOCATION');

  const [showAddReading, setShowAddReading] = useState(false);
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Form state
  const [readingType, setReadingType] = useState('TEMPERATURE');
  const [readingValue, setReadingValue] = useState('');
  const [readingUnit, setReadingUnit] = useState('°C');

  const [alertType, setAlertType] = useState('SENSOR_FAULT');
  const [alertSeverity, setAlertSeverity] = useState('MEDIUM');
  const [alertMessage, setAlertMessage] = useState('');

  const [maintType, setMaintType] = useState('ROUTINE');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintNextDue, setMaintNextDue] = useState('');

  // ── Query ─────────────────────────────────────────────────────────────────
  // Backend returns null (via the API client) when no IoT record exists — this
  // is the normal case for locations without IoT hardware, not an error.
  const { data: monitoring, isLoading } = useQuery({
    queryKey: ['location-monitoring', locationId],
    queryFn: async () => {
      const raw = await locationsApi.getMonitoring(locationId);
      if (!raw) return null;
      // Defensive mapping: the backend model uses `deviceBattery`, `lastPingAt`
      // and scalar sensors (temperature/humidity/pressure). The UI here expects
      // `batteryLevel`, `lastPing`, `sensorReadings[]`, etc. Normalize both shapes.
      const r = raw as any;
      const scalarReadings: SensorReading[] = [];
      if (r.temperature != null) scalarReadings.push({ type: 'TEMPERATURE', value: Number(r.temperature), unit: '°C', timestamp: r.lastReadingAt ?? r.lastPingAt ?? r.lastUpdated ?? new Date().toISOString() });
      if (r.humidity != null)    scalarReadings.push({ type: 'HUMIDITY',    value: Number(r.humidity),    unit: '%',  timestamp: r.lastReadingAt ?? r.lastPingAt ?? r.lastUpdated ?? new Date().toISOString() });
      return {
        ...r,
        batteryLevel:       r.batteryLevel ?? r.deviceBattery ?? undefined,
        lastPing:           r.lastPing ?? r.lastPingAt ?? undefined,
        sensorReadings:     Array.isArray(r.sensorReadings) && r.sensorReadings.length ? r.sensorReadings : scalarReadings,
        activeAlerts:       Array.isArray(r.activeAlerts) ? r.activeAlerts : [],
        maintenanceHistory: Array.isArray(r.maintenanceHistory) ? r.maintenanceHistory : [],
      } as LocationMonitoring;
    },
    enabled: !!locationId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60, // auto-refresh every minute
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const pingMutation = useMutation({
    mutationFn: () => locationsApi.pingDevice(locationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-monitoring', locationId] });
      toast.success('Ping enviado', 'Dispositivo marcado como activo.');
    },
  });

  const readingMutation = useMutation({
    mutationFn: () => locationsApi.registerReading(locationId, {
      type: readingType, value: parseFloat(readingValue), unit: readingUnit,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-monitoring', locationId] });
      toast.success('Lectura registrada');
      setShowAddReading(false);
      setReadingValue('');
    },
    onError: () => toast.error('Error', 'No se pudo registrar la lectura.'),
  });

  const alertMutation = useMutation({
    mutationFn: () => locationsApi.registerAlert(locationId, {
      type: alertType, severity: alertSeverity, message: alertMessage,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-monitoring', locationId] });
      toast.success('Alerta registrada');
      setShowAddAlert(false);
      setAlertMessage('');
    },
    onError: () => toast.error('Error', 'No se pudo registrar la alerta.'),
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => locationsApi.resolveAlerts(locationId, [alertId]),
    onMutate: (id) => setResolvingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-monitoring', locationId] });
      toast.success('Alerta resuelta');
      setResolvingId(null);
    },
    onError: () => { toast.error('Error', 'No se pudo resolver la alerta.'); setResolvingId(null); },
  });

  const maintMutation = useMutation({
    mutationFn: () => locationsApi.registerMaintenance(locationId, {
      type: maintType, description: maintDesc || undefined, nextDue: maintNextDue || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-monitoring', locationId] });
      toast.success('Mantenimiento registrado');
      setShowMaintenance(false);
      setMaintDesc(''); setMaintNextDue('');
    },
    onError: () => toast.error('Error', 'No se pudo registrar el mantenimiento.'),
  });

  if (isLoading) {
    return <Card><div className="flex justify-center py-16"><Spinner size="md" /></div></Card>;
  }

  if (!monitoring) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Activity className="w-7 h-7 text-gray-300 dark:text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sin dispositivo IoT configurado</p>
            <p className="text-xs text-gray-400 mt-1">Esta ubicación no tiene monitoreo activo.</p>
          </div>
        </div>
      </Card>
    );
  }

  const statusCfg = DEVICE_STATUS_CONFIG[monitoring.deviceStatus] ?? DEVICE_STATUS_CONFIG.UNKNOWN;
  const StatusIcon = statusCfg.icon;
  const activeAlerts = (monitoring.activeAlerts ?? []).filter((a) => a.isActive);
  const resolvedAlerts = (monitoring.activeAlerts ?? []).filter((a) => !a.isActive);

  return (
    <div className="space-y-6">

      {/* ── Device Status ─────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <CardTitle>Estado del Dispositivo</CardTitle>
          </div>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              loading={pingMutation.isPending}
              onClick={() => pingMutation.mutate()}
            >
              Ping
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Status */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60">
            <div className={cn('flex items-center justify-center w-10 h-10 rounded-xl', statusCfg.color)}>
              <StatusIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Estado</p>
              <p className={cn('text-sm font-semibold', statusCfg.color.split(' ')[1])}>{statusCfg.label}</p>
            </div>
          </div>

          {/* Last ping */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60">
            <p className="text-xs text-gray-400 mb-0.5">Último contacto</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {monitoring.lastPing ? formatRelative(monitoring.lastPing) : 'Nunca'}
            </p>
          </div>

          {/* Battery */}
          {monitoring.batteryLevel != null && (
            <div className="sm:col-span-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60">
              <p className="text-xs text-gray-400 mb-2">Batería</p>
              <BatteryBar level={monitoring.batteryLevel} />
            </div>
          )}

          {/* Signal */}
          {monitoring.signalStrength != null && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60">
              <Signal className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Señal</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{monitoring.signalStrength} dBm</p>
              </div>
            </div>
          )}

          {/* Model / Firmware */}
          {(monitoring.deviceModel || monitoring.firmwareVersion) && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60">
              <p className="text-xs text-gray-400 mb-0.5">Dispositivo</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {monitoring.deviceModel ?? '—'} {monitoring.firmwareVersion ? `v${monitoring.firmwareVersion}` : ''}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Sensor Readings ───────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
              <Thermometer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <CardTitle>Lecturas de Sensores</CardTitle>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddReading(true)}>
              Registrar
            </Button>
          )}
        </div>

        {!monitoring.sensorReadings?.length ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin lecturas registradas</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {monitoring.sensorReadings.slice(0, 8).map((r, i) => (
              <SensorCard key={i} reading={r} />
            ))}
          </div>
        )}
      </Card>

      {/* ── Active Alerts ─────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Alertas</CardTitle>
            {activeAlerts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                {activeAlerts.length}
              </span>
            )}
          </div>
          {canManage && (
            <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddAlert(true)}>
              Registrar alerta
            </Button>
          )}
        </div>

        {activeAlerts.length === 0 && resolvedAlerts.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Sin alertas activas
          </div>
        ) : (
          <div className="space-y-2">
            {activeAlerts.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                onResolve={(id) => resolveMutation.mutate(id)}
                resolving={resolvingId === a.id}
              />
            ))}
            {resolvedAlerts.slice(0, 5).map((a) => (
              <AlertRow key={a.id} alert={a} onResolve={() => {}} resolving={false} />
            ))}
          </div>
        )}
      </Card>

      {/* ── Maintenance History ────────────────────────────────────────────── */}
      {(monitoring.maintenanceHistory?.length ?? 0) > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle>Historial de Mantenimiento</CardTitle>
            </div>
            {canManage && (
              <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setShowMaintenance(true)}>
                Registrar
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {monitoring.maintenanceHistory!.map((m, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                <Wrench className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.type}</p>
                  {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(m.performedAt)}{m.performedBy ? ` · ${m.performedBy}` : ''}</p>
                </div>
                {m.nextDue && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Próximo</p>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{formatDate(m.nextDue)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <Modal open={showAddReading} onClose={() => setShowAddReading(false)} title="Registrar Lectura" size="sm">
        <div className="space-y-4">
          <Select
            label="Tipo de sensor"
            value={readingType}
            onChange={(e) => {
              setReadingType(e.target.value);
              setReadingUnit(e.target.value === 'TEMPERATURE' ? '°C' : e.target.value === 'HUMIDITY' ? '%' : e.target.value === 'WIND_SPEED' ? 'km/h' : e.target.value === 'RAIN' ? 'mm' : '%');
            }}
            options={[
              { value: 'TEMPERATURE', label: 'Temperatura' },
              { value: 'HUMIDITY', label: 'Humedad' },
              { value: 'WIND_SPEED', label: 'Velocidad del viento' },
              { value: 'RAIN', label: 'Lluvia' },
              { value: 'SOIL_MOISTURE', label: 'Humedad del suelo' },
              { value: 'OTHER', label: 'Otro' },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor *"
              type="number"
              step="0.1"
              value={readingValue}
              onChange={(e) => setReadingValue(e.target.value)}
              placeholder="Ej: 28.5"
            />
            <Input
              label="Unidad"
              value={readingUnit}
              onChange={(e) => setReadingUnit(e.target.value)}
              placeholder="°C, %, km/h..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowAddReading(false)}>Cancelar</Button>
            <Button disabled={!readingValue} loading={readingMutation.isPending} onClick={() => readingMutation.mutate()}>Guardar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showAddAlert} onClose={() => setShowAddAlert(false)} title="Registrar Alerta" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo"
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
              options={[
                { value: 'SENSOR_FAULT', label: 'Falla de sensor' },
                { value: 'TEMPERATURE_HIGH', label: 'Temp. alta' },
                { value: 'TEMPERATURE_LOW', label: 'Temp. baja' },
                { value: 'HUMIDITY_HIGH', label: 'Humedad alta' },
                { value: 'HUMIDITY_LOW', label: 'Humedad baja' },
                { value: 'BATTERY_LOW', label: 'Batería baja' },
                { value: 'CONNECTIVITY', label: 'Conectividad' },
                { value: 'OTHER', label: 'Otro' },
              ]}
            />
            <Select
              label="Severidad"
              value={alertSeverity}
              onChange={(e) => setAlertSeverity(e.target.value)}
              options={[
                { value: 'LOW', label: 'Baja' },
                { value: 'MEDIUM', label: 'Media' },
                { value: 'HIGH', label: 'Alta' },
                { value: 'CRITICAL', label: 'Crítica' },
              ]}
            />
          </div>
          <Input
            label="Mensaje *"
            placeholder="Describe la alerta..."
            value={alertMessage}
            onChange={(e) => setAlertMessage(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowAddAlert(false)}>Cancelar</Button>
            <Button disabled={!alertMessage} loading={alertMutation.isPending} onClick={() => alertMutation.mutate()}>Registrar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showMaintenance} onClose={() => setShowMaintenance(false)} title="Registrar Mantenimiento" size="sm">
        <div className="space-y-4">
          <Select
            label="Tipo"
            value={maintType}
            onChange={(e) => setMaintType(e.target.value)}
            options={[
              { value: 'ROUTINE', label: 'Rutinario' },
              { value: 'REPAIR', label: 'Reparación' },
              { value: 'CALIBRATION', label: 'Calibración' },
              { value: 'BATTERY_CHANGE', label: 'Cambio de batería' },
              { value: 'FIRMWARE_UPDATE', label: 'Actualización firmware' },
              { value: 'OTHER', label: 'Otro' },
            ]}
          />
          <Input
            label="Descripción (opcional)"
            placeholder="Detalles del mantenimiento..."
            value={maintDesc}
            onChange={(e) => setMaintDesc(e.target.value)}
          />
          <Input
            type="date"
            label="Próximo mantenimiento (opcional)"
            value={maintNextDue}
            onChange={(e) => setMaintNextDue(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowMaintenance(false)}>Cancelar</Button>
            <Button loading={maintMutation.isPending} onClick={() => maintMutation.mutate()}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
