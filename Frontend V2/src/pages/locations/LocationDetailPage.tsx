import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle, Polygon, Rectangle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { locationsApi } from '@/api/locations.api';
import type {
  LocationMovementEvent,
  MovementEventType,
  MovementReason,
  LocationMovementsParams,
} from '@/api/locations.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { getFriendlyMessage } from '@/utils/errorHandler';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import {
  MOVEMENT_REASON_LABELS as REASON_LABELS,
  getMovementReasonLabel,
  getServiceChipClasses,
  type ServiceKey,
} from '@/design-system/tokens';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Spinner, PageLoader } from '@/components/ui/Spinner';
import { LocationCapacityTab } from './tabs/LocationCapacityTab';
import { LocationBovinosTab } from './tabs/LocationBovinosTab';
import { MediaGallery } from '@/components/media/MediaGallery';
import { LocationMonitoringTab } from './tabs/LocationMonitoringTab';
import { LocationRelacionesTab } from './tabs/LocationRelacionesTab';
import type { Location, GeofenceConfig } from '@/types/location.types';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft, Edit, Trash2, MapPin, Droplets, AlertTriangle, Info, Users, Beef,
  Image as ImageIcon, Activity, Network, Leaf, Calendar, CheckCircle2, XCircle,
  Copy, ExternalLink, ArrowDown, ArrowUp, Filter, ChevronLeft, ChevronRight,
  Zap, Wifi, Route, Gauge,
} from 'lucide-react';

// ─── Label maps ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  PASTURE: 'Potrero', CORRAL: 'Corral', BARN: 'Establo',
  MILKING_PARLOR: 'Sala de Ordeño', FEED_AREA: 'Área de Alimentación',
  WATER_SOURCE: 'Fuente de Agua', VETERINARY_CLINIC: 'Clínica Veterinaria',
  QUARANTINE_AREA: 'Cuarentena', LOADING_AREA: 'Área de Carga',
  STORAGE: 'Almacén', OFFICE: 'Oficina', RESIDENTIAL: 'Residencial',
  PROCESSING_PLANT: 'Planta de Procesamiento', BREEDING_CENTER: 'Centro de Reproducción',
  LABORATORY: 'Laboratorio', WASTE_MANAGEMENT: 'Manejo de Residuos',
  EQUIPMENT_SHED: 'Bodega de Equipos', ENTRANCE_GATE: 'Puerta de Entrada',
  SECURITY_POST: 'Puesto de Seguridad', EMERGENCY_POINT: 'Punto de Emergencia',
  RESTRICTED_AREA: 'Área Restringida', DANGER_ZONE: 'Zona de Peligro',
  SAFE_ZONE: 'Zona Segura', ROUTE: 'Ruta', CHECKPOINT: 'Punto de Control', OTHER: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activa', INACTIVE: 'Inactiva', UNDER_CONSTRUCTION: 'En Construcción',
  UNDER_MAINTENANCE: 'En Mantenimiento', QUARANTINED: 'En Cuarentena',
  FLOODED: 'Inundada', DAMAGED: 'Dañada', CLOSED: 'Cerrada', RESTRICTED: 'Restringida',
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE: 'success', INACTIVE: 'default', UNDER_CONSTRUCTION: 'info',
  UNDER_MAINTENANCE: 'info', QUARANTINED: 'danger', FLOODED: 'danger',
  DAMAGED: 'warning', CLOSED: 'default', RESTRICTED: 'warning',
};

const PASTURE_QUALITY_LABELS: Record<string, string> = {
  EXCELLENT: 'Excelente', GOOD: 'Buena', FAIR: 'Regular', POOR: 'Pobre',
};

const WATER_TYPE_LABELS: Record<string, string> = {
  WELL: 'Pozo', RIVER: 'Río', POND: 'Estanque',
  STREAM: 'Arroyo', SPRING: 'Manantial', TANK: 'Tanque',
};

const SOIL_TYPE_LABELS: Record<string, string> = {
  CLAY: 'Arcilloso', SANDY: 'Arenoso', LOAM: 'Franco',
  SILT: 'Limoso', ROCKY: 'Rocoso', ORGANIC: 'Orgánico', MIXED: 'Mixto',
};

// `REASON_LABELS` y `getMovementReasonLabel` vienen importados desde
// `@/design-system/tokens` al inicio del archivo. Eliminamos la definición
// local duplicada que tenía solo 6 valores (vs los 8 canónicos del enum).

// ─── Leaflet default icon fix ─────────────────────────────────────────────────

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ─── DetailMap (map with geofence overlay) ────────────────────────────────────

function FitGeofence({ geofence, lat, lng }: { geofence?: GeofenceConfig; lat: number; lng: number }) {
  const map = useMap();
  useMemo(() => {
    try {
      if (geofence?.type === 'CIRCULAR' && geofence.center && geofence.radius) {
        const c = L.latLng(geofence.center.latitude, geofence.center.longitude);
        const bounds = c.toBounds(geofence.radius * 2);
        map.fitBounds(bounds, { padding: [16, 16] });
        return;
      }
      if (geofence?.type === 'POLYGON' && geofence.coordinates?.length) {
        const pts: L.LatLngExpression[] = geofence.coordinates.map((p) => [p.latitude, p.longitude]);
        map.fitBounds(L.latLngBounds(pts), { padding: [16, 16] });
        return;
      }
      if (geofence?.type === 'RECTANGULAR' && geofence.boundingBox) {
        const { north, south, east, west } = geofence.boundingBox;
        map.fitBounds([[south, west], [north, east]], { padding: [16, 16] });
        return;
      }
      map.setView([lat, lng], 16);
    } catch {
      map.setView([lat, lng], 16);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geofence, lat, lng]);
  return null;
}

function DetailMap({
  lat, lng, geofence, label,
}: {
  lat: number; lng: number; geofence?: GeofenceConfig; label: string;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitGeofence geofence={geofence} lat={lat} lng={lng} />
      <Marker position={[lat, lng]} title={label} />

      {geofence?.type === 'CIRCULAR' && geofence.center && geofence.radius && (
        <Circle
          center={[geofence.center.latitude, geofence.center.longitude]}
          radius={geofence.radius}
          pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.15, weight: 2 }}
        />
      )}
      {geofence?.type === 'POLYGON' && geofence.coordinates && geofence.coordinates.length >= 3 && (
        <Polygon
          positions={geofence.coordinates.map((p) => [p.latitude, p.longitude]) as L.LatLngExpression[]}
          pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.15, weight: 2 }}
        />
      )}
      {geofence?.type === 'RECTANGULAR' && geofence.boundingBox && (
        <Rectangle
          bounds={[
            [geofence.boundingBox.south, geofence.boundingBox.west],
            [geofence.boundingBox.north, geofence.boundingBox.east],
          ]}
          pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.15, weight: 2 }}
        />
      )}
    </MapContainer>
  );
}

// ─── InfoRow helper ───────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2.5 border-b border-gray-50 dark:border-gray-800/60 last:border-0">
      <span className="shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-32">
        {label}
      </span>
      <span className="text-sm text-gray-900 dark:text-white flex-1">{children}</span>
    </div>
  );
}

/**
 * Chip que indica si un servicio está disponible en la ubicación.
 * La clase visual se resuelve a través de `getServiceChipClasses` del
 * design-system — un único lugar gobierna los colores y elimina el bug
 * potencial del template-literal (`bg-${color}-50`) que el purge de
 * Tailwind no podía detectar.
 */
function ServiceChip({
  enabled, icon: Icon, label, service,
}: {
  enabled: boolean;
  icon: any;
  label: string;
  service: ServiceKey;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border',
        getServiceChipClasses(service, enabled),
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {enabled
        ? <CheckCircle2 className="w-3 h-3 ml-auto" />
        : <XCircle className="w-3 h-3 ml-auto" />}
    </div>
  );
}

// ─── Movements Panel (bottom-right quadrant) ──────────────────────────────────

function MovementsPanel({ locationId }: { locationId: string }) {
  const [filters, setFilters] = useState<LocationMovementsParams>({ limit: 10, offset: 0 });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['location-movements', locationId, filters],
    queryFn: () => locationsApi.getMovements(locationId, filters).then((r) => r.data.data),
    enabled: !!locationId,
    staleTime: 30_000,
  });

  const total = data?.total ?? 0;
  const limit = filters.limit ?? 10;
  const offset = filters.offset ?? 0;
  const movements = data?.movements ?? [];
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const setFilter = <K extends keyof LocationMovementsParams>(k: K, v: LocationMovementsParams[K]) =>
    setFilters((f) => ({ ...f, [k]: v, offset: 0 }));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle>Historial de movimientos</CardTitle>
          {isFetching && <Spinner size="sm" />}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            showFilters
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800',
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <Select
            label="Tipo"
            placeholder="Todos"
            options={[
              { value: 'ENTRY', label: '↗ Entradas' },
              { value: 'EXIT', label: '↘ Salidas' },
            ]}
            value={filters.type ?? ''}
            onChange={(e) => setFilter('type', (e.target.value || undefined) as MovementEventType | undefined)}
          />
          <Select
            label="Motivo"
            placeholder="Todos"
            options={Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }))}
            value={filters.reason ?? ''}
            onChange={(e) => setFilter('reason', (e.target.value || undefined) as MovementReason | undefined)}
          />
          <Input
            label="Desde"
            type="date"
            value={filters.fromDate?.slice(0, 10) ?? ''}
            onChange={(e) => setFilter('fromDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          />
          <Input
            label="Hasta"
            type="date"
            value={filters.toDate?.slice(0, 10) ?? ''}
            onChange={(e) => setFilter('toDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Activity className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-500">Sin movimientos registrados</p>
          </div>
        ) : (
          movements.map((m) => <MovementRow key={m.historyId + m.type} m={m} />)
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 mt-2">
          <span className="text-xs text-gray-500">
            {offset + 1}–{Math.min(offset + limit, total)} de {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setFilters((f) => ({ ...f, offset: Math.max(0, (f.offset ?? 0) - (f.limit ?? 10)) }))}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 px-1.5">{page} / {totalPages}</span>
            <button
              type="button"
              disabled={offset + limit >= total}
              onClick={() => setFilters((f) => ({ ...f, offset: (f.offset ?? 0) + (f.limit ?? 10) }))}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MovementRow({ m }: { m: LocationMovementEvent }) {
  const isEntry = m.type === 'ENTRY';
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div
        className={cn(
          'shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
          isEntry
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400',
        )}
      >
        {isEntry ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {m.bovineName ?? m.bovineEarTag}
          </span>
          <span className="text-xs text-gray-400 font-mono">[{m.bovineEarTag}]</span>
          {m.reason && (
            <Badge variant={isEntry ? 'success' : 'info'}>
              {getMovementReasonLabel(m.reason)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5 flex-wrap">
          <span>{formatDate(m.occurredAt)}</span>
          <span>·</span>
          <span>{m.recordedByName ?? 'Usuario eliminado'}</span>
        </div>
        {m.notes && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">"{m.notes}"</p>
        )}
      </div>
    </div>
  );
}

// ─── Tab definitions (secondary section below quadrants) ──────────────────────

const TABS = [
  { id: 'capacity',   label: 'Capacidad',     icon: Users },
  { id: 'bovines',    label: 'Bovinos',       icon: Beef },
  { id: 'media',      label: 'Media',         icon: ImageIcon },
  { id: 'monitoring', label: 'Monitoreo IoT', icon: Activity },
  { id: 'relations',  label: 'Relaciones',    icon: Network },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── LocationDetailPage ───────────────────────────────────────────────────────

export function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>('capacity');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const canManage = canUser(user?.role, 'MANAGE_LOCATION');
  const canDelete = canUser(user?.role, 'DELETE_LOCATION');

  // Fetch location
  const { data: locationRes, isLoading, isError } = useQuery({
    queryKey: ['location', id],
    queryFn: () => locationsApi.getById(id!),
    enabled: !!id,
    staleTime: 1000 * 60,
  });
  const location: Location | undefined = locationRes?.data?.data;

  // Capacity comes inline from GET /locations/:id (post backend D).
  // Only fall back to GET /locations/:id/capacity if the inline field is undefined
  // (e.g. legacy endpoint that didn't include the eager-load).
  const needsCapacityFallback = !!location && location.capacity === undefined;
  const { data: capacityFallback } = useQuery({
    queryKey: ['location-capacity', id],
    queryFn: () => locationsApi.getCapacity(id!),
    enabled: needsCapacityFallback,
    staleTime: 30_000,
  });
  const capacity = location?.capacity ?? capacityFallback ?? null;

  const deleteMutation = useMutation({
    mutationFn: () => locationsApi.delete(id!),
    onSuccess: () => {
      toast.success('Ubicación eliminada');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      navigate('/locations');
    },
    onError: (err: any) => {
      toast.error('Error al eliminar', getFriendlyMessage(err));
      setDeleteOpen(false);
    },
  });

  if (isLoading) return <PageLoader />;

  if (isError || !location) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">Ubicación no encontrada</p>
          <p className="text-sm text-gray-400 mt-1">No se pudo cargar la información de esta ubicación.</p>
        </div>
        <Button variant="outline" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/locations')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const lat = Number(location.coordinates?.latitude);
  const lng = Number(location.coordinates?.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

  // Capacity numbers come straight from inline `capacity` (currentAnimals is live from BLH).
  const maxAnimals = Number(capacity?.maxAnimals) || 0;
  const currentAnimals = Number(capacity?.currentAnimals) || 0;
  const occupancyPct = maxAnimals > 0 ? Math.round((currentAnimals / maxAnimals) * 100) : 0;

  const statusVariant = STATUS_VARIANT[location.status] ?? 'default';

  const copyCoords = async () => {
    if (!hasCoords) return;
    try {
      await navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('No se pudo copiar', 'Tu navegador bloqueó el portapapeles');
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate('/locations')}
          className="mt-1 shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{location.name}</h1>
            <span className="text-sm text-gray-400 font-mono">[{location.locationCode}]</span>
            <Badge variant="info">{TYPE_LABELS[location.type] ?? location.type}</Badge>
            <Badge variant={statusVariant}>{STATUS_LABELS[location.status] ?? location.status}</Badge>
          </div>
          {maxAnimals > 0 && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
              <Users className="w-3.5 h-3.5" />
              <span>{currentAnimals} / {maxAnimals} animales ({occupancyPct}% ocupado)</span>
              {occupancyPct >= 100 && (
                <span className="px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 font-semibold">
                  Lleno
                </span>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              icon={<Edit className="w-3.5 h-3.5" />}
              onClick={() => navigate(`/locations/${id}/edit`)}
            >
              Editar
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setDeleteOpen(true)}
            >
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* ── Quadrant block ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top-Left: Map with geofence */}
        <Card noPadding className="overflow-hidden aspect-square lg:aspect-auto lg:h-[420px]">
          {hasCoords ? (
            <DetailMap
              key={`detail-map-${location.id}`}
              lat={lat}
              lng={lng}
              geofence={location.geofenceConfig}
              label={location.name}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
              <MapPin className="w-10 h-10" />
              <p className="text-sm">Sin coordenadas registradas</p>
            </div>
          )}
        </Card>

        {/* Top-Right: Details panel */}
        <Card className="lg:h-[420px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <Info className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
            </div>
            <CardTitle>Detalles</CardTitle>
          </div>

          <div>
            <InfoRow label="Código">{location.locationCode}</InfoRow>
            <InfoRow label="Tipo">{TYPE_LABELS[location.type] ?? location.type}</InfoRow>
            <InfoRow label="Estado">
              <Badge variant={statusVariant}>{STATUS_LABELS[location.status] ?? location.status}</Badge>
            </InfoRow>
            <InfoRow label="Activa">
              {location.isActive
                ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Sí</span>
                : <span className="inline-flex items-center gap-1 text-gray-400"><XCircle className="w-3.5 h-3.5" />No</span>}
            </InfoRow>

            {/* Capacity */}
            {maxAnimals > 0 && (
              <InfoRow label="Capacidad">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{currentAnimals} / {maxAnimals} animales</span>
                    <span className="text-gray-500">{occupancyPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all',
                        occupancyPct >= 100 ? 'bg-red-500' : occupancyPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(100, occupancyPct)}%` }}
                    />
                  </div>
                </div>
              </InfoRow>
            )}

            {/* Area */}
            {capacity?.area != null && (
              <InfoRow label="Área">
                {capacity.area} {capacity.areaUnit ?? 'HA'}
              </InfoRow>
            )}

            {capacity?.carryingCapacity != null && (
              <InfoRow label="Carga animal">{capacity.carryingCapacity} UA/ha</InfoRow>
            )}

            {/* Soil/geography compact */}
            {(location.soilType || location.elevation != null || location.pastureQuality) && (
              <InfoRow label="Geografía">
                <div className="flex flex-wrap gap-1.5">
                  {location.soilType && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                      <Leaf className="inline w-3 h-3 mr-1" />
                      {SOIL_TYPE_LABELS[location.soilType] ?? location.soilType}
                    </span>
                  )}
                  {location.elevation != null && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">{location.elevation} msnm</span>
                  )}
                  {location.pastureQuality && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                      Pasto: {PASTURE_QUALITY_LABELS[location.pastureQuality] ?? location.pastureQuality}
                    </span>
                  )}
                </div>
              </InfoRow>
            )}

            {/* Services */}
            {capacity && (capacity.hasElectricity || capacity.hasWater || capacity.hasInternet || capacity.hasRoadAccess) !== undefined && (
              <InfoRow label="Servicios">
                <div className="grid grid-cols-2 gap-1.5">
                  <ServiceChip enabled={!!capacity.hasElectricity} icon={Zap}      label="Electricidad" service="ELECTRICITY" />
                  <ServiceChip enabled={!!capacity.hasWater}       icon={Droplets} label="Agua"         service="WATER" />
                  <ServiceChip enabled={!!capacity.hasInternet}    icon={Wifi}     label="Internet"     service="INTERNET" />
                  <ServiceChip enabled={!!capacity.hasRoadAccess}  icon={Route}    label="Acceso vial"  service="ROAD_ACCESS" />
                </div>
              </InfoRow>
            )}

            {/* Water sources */}
            {location.waterSources && location.waterSources.length > 0 && (
              <InfoRow label="Fuentes de agua">
                <div className="flex flex-wrap gap-1">
                  {location.waterSources.map((ws, i) => (
                    <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      <Droplets className="inline w-3 h-3 mr-1" />
                      {ws.name} ({WATER_TYPE_LABELS[ws.type] ?? ws.type})
                    </span>
                  ))}
                </div>
              </InfoRow>
            )}

            <InfoRow label="Creada">
              <span className="inline-flex items-center gap-1 text-xs">
                <Calendar className="w-3 h-3" />
                {location.createdAt ? formatDate(location.createdAt) : '—'}
              </span>
            </InfoRow>
          </div>
        </Card>

        {/* Bottom-Left: Coordinates */}
        <Card className="lg:h-[280px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <CardTitle>Coordenadas y geocerca</CardTitle>
          </div>

          {hasCoords ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2.5">
                  <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Latitud</div>
                  <div className="font-mono text-sm text-gray-900 dark:text-white mt-0.5">{lat.toFixed(6)}°</div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2.5">
                  <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Longitud</div>
                  <div className="font-mono text-sm text-gray-900 dark:text-white mt-0.5">{lng.toFixed(6)}°</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyCoords}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    copied
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
                  )}
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '¡Copiadas!' : 'Copiar'}
                </button>

                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/60 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Google Maps
                </a>

                <a
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  OpenStreetMap
                </a>
              </div>

              {location.geofenceConfig && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Gauge className="w-3.5 h-3.5" />
                    Geocerca configurada
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Tipo: <strong>{location.geofenceConfig.type}</strong>
                    {location.geofenceConfig.type === 'CIRCULAR' && location.geofenceConfig.radius != null && (
                      <> · Radio: <strong>{location.geofenceConfig.radius} m</strong></>
                    )}
                    {location.geofenceConfig.type === 'POLYGON' && location.geofenceConfig.coordinates && (
                      <> · {location.geofenceConfig.coordinates.length} vértices</>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <MapPin className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-500">Sin coordenadas registradas</p>
            </div>
          )}
        </Card>

        {/* Bottom-Right: Movements history */}
        <Card className="lg:h-[280px]">
          <MovementsPanel locationId={id!} />
        </Card>
      </div>

      {/* ── Secondary tabs section ── */}
      <div className="pt-4">
        <div className="flex overflow-x-auto gap-1 border-b border-gray-200 dark:border-gray-800 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="pt-4 pb-10">
          {activeTab === 'capacity' && (
            <LocationCapacityTab locationId={id!} />
          )}
          {activeTab === 'bovines' && (
            <LocationBovinosTab locationId={id!} locationName={location.name} />
          )}
          {activeTab === 'media' && (
            <MediaGallery entityType="location" entityId={id!} />
          )}
          {activeTab === 'monitoring' && <LocationMonitoringTab locationId={id!} />}
          {activeTab === 'relations' && (
            <LocationRelacionesTab locationId={id!} ranchId={location.ranchId} />
          )}
        </div>
      </div>

      {/* ── Delete confirm modal ── */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar ubicación" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700 dark:text-red-400">
              <p className="font-medium">Esta acción no se puede deshacer.</p>
              <p className="mt-0.5">
                Se eliminará <strong>{location.name}</strong> [{location.locationCode}] permanentemente.
                Los bovinos asignados a esta ubicación quedarán sin ubicación activa.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Sí, eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
