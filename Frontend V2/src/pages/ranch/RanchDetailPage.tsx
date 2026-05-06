/**
 * RanchDetailPage — standalone page for `/ranch/:id`.
 *
 * Layout mirrors LocationDetailPage:
 *   • Header (back button, name, badges, edit/delete)
 *   • 2×2 grid of cards:
 *       - Top-Left  : mini-map with boundary (real shape)
 *       - Top-Right : details panel
 *       - Bottom-Left  : coordinates + helpers
 *       - Bottom-Right : summary stats
 *   • Tabs below: Info / Media / Ubicaciones
 *
 * Phase 9.5 will add the real boundary rendering in the mini-map.
 * Phase 9.4 will add the "Ubicaciones del rancho" tab.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Polygon, Rectangle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { ranchApi } from '@/api/ranch.api';
import { locationsApi } from '@/api/locations.api';
import { useToast } from '@/store/ToastContext';
import { useAuth } from '@/store/AuthContext';
import { canUser } from '@/utils/permissions';
import { getFriendlyMessage } from '@/utils/errorHandler';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';

import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/Spinner';
import { MediaGallery } from '@/components/media/MediaGallery';

import type { Ranch } from '@/types';
import type { GeofenceConfig } from '@/types/location.types';

import {
  ArrowLeft, Edit, Trash2, MapPin, Mountain, Ruler, Droplets, Thermometer,
  Globe, Calendar, AlertTriangle, Info, BarChart3, CheckCircle2, XCircle,
  Copy, ExternalLink, Home, Image as ImageIcon, Layers, MapPinned, Plus,
  Eye, Users,
} from 'lucide-react';

// ─── Label maps (kept local — could later move to a shared module) ─────────

const TYPE_LABELS: Record<string, string> = {
  DAIRY: 'Lechero', BEEF: 'Cárnico', MIXED: 'Mixto', BREEDING: 'Cría',
  FEEDLOT: 'Engorda', ORGANIC: 'Orgánico', SUSTAINABLE: 'Sustentable',
  COMMERCIAL: 'Comercial', FAMILY_FARM: 'Familiar', COOPERATIVE: 'Cooperativa',
  CORPORATE: 'Corporativo', RESEARCH: 'Investigación', EDUCATIONAL: 'Educativo',
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo', INACTIVE: 'Inactivo', UNDER_CONSTRUCTION: 'En Construcción',
  RENOVATION: 'Renovación', TEMPORARY_CLOSURE: 'Cierre Temporal',
  PERMANENT_CLOSURE: 'Cierre Permanente', QUARANTINE: 'Cuarentena',
  SUSPENDED: 'Suspendido', PENDING_APPROVAL: 'Pendiente',
};
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE: 'success', INACTIVE: 'default', UNDER_CONSTRUCTION: 'info',
  RENOVATION: 'info', TEMPORARY_CLOSURE: 'warning', PERMANENT_CLOSURE: 'danger',
  QUARANTINE: 'danger', SUSPENDED: 'warning', PENDING_APPROVAL: 'info',
};

// ─── Leaflet default icon ────────────────────────────────────────────────

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const ranchHomeIcon = L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;background:#f59e0b;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:14px;line-height:1;">🏠</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
      <span className="shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-32">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white flex-1">{children}</span>
    </div>
  );
}

// ─── Mini-map with boundary + location dots (Phase 9.5) ──────────────────

/**
 * Auto-fit the map to enclose: ranch center, boundary shape, and all the
 * location dots. Runs once on mount + whenever the bounds list changes.
 */
function FitToBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
      return;
    }
    map.fitBounds(points as L.LatLngBoundsLiteral, { padding: [24, 24], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);
  return null;
}

interface LocationDot {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  occupancyPct: number; // 0-100, used to color the dot
}

function RanchMiniMap({
  ranch,
  locationDots,
}: {
  ranch: Ranch;
  locationDots: LocationDot[];
}) {
  const navigate = useNavigate();
  const lat = Number(ranch.coordinates?.latitude);
  const lng = Number(ranch.coordinates?.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

  const boundary = ranch.boundary as GeofenceConfig | null | undefined;

  // Compute the points used to auto-fit the map. Includes:
  //   - ranch center
  //   - boundary vertices (or sampled circle perimeter for CIRCULAR)
  //   - all location dots
  const fitPoints = useMemo<Array<[number, number]>>(() => {
    const out: Array<[number, number]> = [];
    if (hasCoords) out.push([lat, lng]);

    if (boundary) {
      if (boundary.type === 'POLYGON' && boundary.coordinates) {
        boundary.coordinates.forEach((c) => out.push([c.latitude, c.longitude]));
      } else if (boundary.type === 'RECTANGULAR' && boundary.boundingBox) {
        const bb = boundary.boundingBox;
        out.push([bb.north, bb.east]);
        out.push([bb.north, bb.west]);
        out.push([bb.south, bb.east]);
        out.push([bb.south, bb.west]);
      } else if (boundary.type === 'CIRCULAR' && boundary.center && boundary.radius) {
        // Sample 4 cardinal points on the circle perimeter
        const c = L.latLng(boundary.center.latitude, boundary.center.longitude);
        const bounds = c.toBounds(boundary.radius * 2);
        out.push([bounds.getNorth(), bounds.getEast()]);
        out.push([bounds.getSouth(), bounds.getWest()]);
      }
    } else if (hasCoords && ranch.boundaryRadius && ranch.boundaryRadius > 0) {
      // Fallback circle from boundaryRadius (km → m)
      const c = L.latLng(lat, lng);
      const bounds = c.toBounds(ranch.boundaryRadius * 1000 * 2);
      out.push([bounds.getNorth(), bounds.getEast()]);
      out.push([bounds.getSouth(), bounds.getWest()]);
    }

    locationDots.forEach((d) => out.push([d.lat, d.lng]));
    return out;
  }, [hasCoords, lat, lng, boundary, ranch.boundaryRadius, locationDots]);

  if (!hasCoords) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
        <MapPin className="w-10 h-10" />
        <p className="text-sm">Sin coordenadas registradas</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={13}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToBounds points={fitPoints} />

      {/* Real boundary shape */}
      {boundary?.type === 'CIRCULAR' && boundary.center && boundary.radius && (
        <Circle
          center={[boundary.center.latitude, boundary.center.longitude]}
          radius={boundary.radius}
          pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.12, weight: 2 }}
        />
      )}
      {boundary?.type === 'POLYGON' && boundary.coordinates && boundary.coordinates.length >= 3 && (
        <Polygon
          positions={boundary.coordinates.map((c) => [c.latitude, c.longitude]) as [number, number][]}
          pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.12, weight: 2 }}
        />
      )}
      {boundary?.type === 'RECTANGULAR' && boundary.boundingBox && (
        <Rectangle
          bounds={[
            [boundary.boundingBox.south, boundary.boundingBox.west],
            [boundary.boundingBox.north, boundary.boundingBox.east],
          ] as [[number, number], [number, number]]}
          pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.12, weight: 2 }}
        />
      )}

      {/* Fallback: boundaryRadius circle when no real boundary */}
      {!boundary && ranch.boundaryRadius && ranch.boundaryRadius > 0 && (
        <Circle
          center={[lat, lng]}
          radius={ranch.boundaryRadius * 1000}
          pathOptions={{ color: '#9ca3af', fillColor: '#9ca3af', fillOpacity: 0.05, dashArray: '6 4', weight: 1 }}
        />
      )}

      {/* Ranch home marker */}
      <Marker position={[lat, lng]} icon={ranchHomeIcon}>
        <Popup>
          <strong>{ranch.name}</strong>
          <br />
          <span style={{ fontSize: '0.75rem', color: '#666' }}>{ranch.ranchCode}</span>
        </Popup>
      </Marker>

      {/* Location dots — color by occupancy */}
      {locationDots.map((d) => {
        const color =
          d.occupancyPct >= 100 ? '#dc2626' :
          d.occupancyPct >= 80  ? '#f59e0b' :
          d.occupancyPct > 0    ? '#16a34a' :
                                  '#9ca3af';
        return (
          <CircleMarker
            key={d.id}
            center={[d.lat, d.lng]}
            radius={6}
            pathOptions={{
              color: '#fff',
              fillColor: color,
              fillOpacity: 0.95,
              weight: 2,
            }}
            eventHandlers={{
              click: () => navigate(`/locations/${d.id}`),
            }}
          >
            <Popup>
              <strong>{d.name}</strong>
              <br />
              <span style={{ fontSize: '0.7rem', color: '#666', fontFamily: 'monospace' }}>{d.code}</span>
              {d.occupancyPct > 0 && (
                <>
                  <br />
                  <span style={{ fontSize: '0.7rem' }}>Ocupación: {Math.round(d.occupancyPct)}%</span>
                </>
              )}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'info',      label: 'Información', icon: Info },
  { id: 'locations', label: 'Ubicaciones', icon: MapPinned },
  { id: 'media',     label: 'Multimedia',  icon: ImageIcon },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── Locations panel (tab) ────────────────────────────────────────────────
// Shows the ranch's locations as a table. Click → navigate to detail.
// "+ Nueva ubicación" deep-links to /locations/new?ranchId=<id> so the form
// preselects this ranch.

const LOCATION_TYPE_LABELS: Record<string, string> = {
  PASTURE: 'Potrero', CORRAL: 'Corral', BARN: 'Establo',
  MILKING_PARLOR: 'Sala de Ordeño', FEED_AREA: 'Área de Alimentación',
  WATER_SOURCE: 'Fuente de Agua', VETERINARY_CLINIC: 'Clínica Veterinaria',
  QUARANTINE_AREA: 'Cuarentena', LOADING_AREA: 'Área de Carga',
  STORAGE: 'Almacén', OFFICE: 'Oficina', RESIDENTIAL: 'Residencial',
  BREEDING_CENTER: 'Centro de Reproducción', EQUIPMENT_SHED: 'Bodega',
  ENTRANCE_GATE: 'Puerta', RESTRICTED_AREA: 'Restringida',
  DANGER_ZONE: 'Peligro', SAFE_ZONE: 'Segura', ROUTE: 'Ruta', OTHER: 'Otro',
};

const LOCATION_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE: 'success', INACTIVE: 'default', UNDER_CONSTRUCTION: 'info',
  UNDER_MAINTENANCE: 'info', QUARANTINED: 'danger', FLOODED: 'danger',
  DAMAGED: 'warning', CLOSED: 'default', RESTRICTED: 'warning',
};

function RanchLocationsPanel({ ranchId, ranchName }: { ranchId: string; ranchName: string }) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['ranch-locations', ranchId],
    queryFn: () => locationsApi.list({ ranchId, limit: 100 }),
    staleTime: 1000 * 60,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <MapPinned className="w-4 h-4 text-primary-600" />
          <strong>{items.length}</strong> ubicación{items.length === 1 ? '' : 'es'} en {ranchName}
        </div>
        <Button
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => navigate(`/locations/new?ranchId=${ranchId}`)}
        >
          Nueva ubicación
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-10"><PageLoader /></div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <MapPinned className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Este rancho aún no tiene ubicaciones registradas.
          </p>
          <Button
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => navigate(`/locations/new?ranchId=${ranchId}`)}
          >
            Crear la primera
          </Button>
        </div>
      )}

      {/* Table */}
      {!isLoading && items.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ubicación</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Tipo</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Ocupación</th>
                <th className="px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((loc) => {
                const cap = loc.capacity;
                const pct = cap && cap.maxAnimals > 0 ? (cap.currentAnimals / cap.maxAnimals) * 100 : 0;
                const variant = LOCATION_STATUS_VARIANT[loc.status] ?? 'default';
                return (
                  <tr
                    key={loc.id}
                    onClick={() => navigate(`/locations/${loc.id}`)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{loc.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{loc.locationCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      {LOCATION_TYPE_LABELS[loc.type] ?? loc.type}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={variant}>{loc.status}</Badge>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      {cap && cap.maxAnimals > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Users className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {cap.currentAnimals}/{cap.maxAnimals}
                            </span>
                          </div>
                          <div className="w-20 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={cn(
                                'h-full',
                                pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500',
                              )}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Sin capacidad</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/locations/${loc.id}`); }}
                        className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export function RanchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const canManage = canUser(user?.role, 'MANAGE_RANCH');
  const canDelete = canUser(user?.role, 'MANAGE_RANCH');

  const { data: ranchRes, isLoading, isError } = useQuery({
    queryKey: ['ranch', id],
    queryFn: () => ranchApi.getById(id!),
    enabled: !!id,
    staleTime: 1000 * 60,
  });
  const ranch: Ranch | undefined = ranchRes?.data?.data;

  // Live KPIs (live currentCattleCount calculated by backend)
  const { data: summaryRes } = useQuery({
    queryKey: ['ranch-summary', id],
    queryFn: () => ranchApi.getSummary(id!),
    enabled: !!id,
    staleTime: 1000 * 60,
  });
  const summary = summaryRes?.data?.data;

  // Locations for the mini-map dots and the "Ubicaciones" tab.
  // Single fetch reused by both — no duplicate request.
  const { data: locationsData } = useQuery({
    queryKey: ['ranch-locations', id],
    queryFn: () => locationsApi.list({ ranchId: id!, limit: 100 }),
    enabled: !!id,
    staleTime: 1000 * 60,
  });
  const locationDots = useMemo(() => {
    const items = locationsData?.items ?? [];
    return items
      .filter((l) => l.coordinates?.latitude && l.coordinates?.longitude)
      .map((l) => {
        const cap = l.capacity;
        const pct = cap && cap.maxAnimals > 0 ? (cap.currentAnimals / cap.maxAnimals) * 100 : 0;
        return {
          id: l.id,
          name: l.name,
          code: l.locationCode,
          lat: l.coordinates!.latitude,
          lng: l.coordinates!.longitude,
          occupancyPct: pct,
        };
      });
  }, [locationsData]);

  const deleteMutation = useMutation({
    mutationFn: () => ranchApi.delete(id!),
    onSuccess: () => {
      toast.success('Rancho eliminado');
      queryClient.invalidateQueries({ queryKey: ['ranches'] });
      navigate('/ranch');
    },
    onError: (err: any) => {
      toast.error('Error al eliminar', getFriendlyMessage(err));
      setDeleteOpen(false);
    },
  });

  const lat = Number(ranch?.coordinates?.latitude);
  const lng = Number(ranch?.coordinates?.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

  const cattleCurrent = summary?.currentCattleCount ?? ranch?.currentCattleCount ?? 0;
  const cattleMax     = summary?.maxCattleCapacity   ?? ranch?.maxCattleCapacity   ?? 0;
  const occupancyPct  = cattleMax > 0 ? Math.round((cattleCurrent / cattleMax) * 100) : 0;
  const density = useMemo(() => {
    if (!ranch?.totalArea || ranch.totalArea <= 0) return null;
    return cattleCurrent / ranch.totalArea;
  }, [ranch?.totalArea, cattleCurrent]);

  if (isLoading) return <PageLoader />;

  if (isError || !ranch) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">Rancho no encontrado</p>
          <p className="text-sm text-gray-400 mt-1">No se pudo cargar la información del rancho.</p>
        </div>
        <Button variant="outline" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/ranch')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const statusVariant = STATUS_VARIANT[ranch.status] ?? 'default';

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
          onClick={() => navigate('/ranch')}
          className="mt-1 shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{ranch.name}</h1>
            <span className="text-sm text-gray-400 font-mono">[{ranch.ranchCode}]</span>
            <Badge variant="info">{TYPE_LABELS[ranch.type] ?? ranch.type}</Badge>
            <Badge variant={statusVariant}>{STATUS_LABELS[ranch.status] ?? ranch.status}</Badge>
            {ranch.isVerified && <Badge variant="success">Verificado</Badge>}
          </div>
          {cattleMax > 0 && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
              <Home className="w-3.5 h-3.5" />
              <span>{cattleCurrent} / {cattleMax} cabezas ({occupancyPct}% ocupado)</span>
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
              onClick={() => navigate(`/ranch?edit=${id}`)}
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

      {/* ── Quadrant block (2×2) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top-Left: mini-map with boundary + location dots */}
        <Card noPadding className="overflow-hidden aspect-square lg:aspect-auto lg:h-[420px]">
          <RanchMiniMap ranch={ranch} locationDots={locationDots} />
        </Card>

        {/* Top-Right: details panel */}
        <Card className="lg:h-[420px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <Info className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
            </div>
            <CardTitle>Detalles</CardTitle>
          </div>

          <div>
            <InfoRow label="Código">{ranch.ranchCode}</InfoRow>
            <InfoRow label="Tipo">{TYPE_LABELS[ranch.type] ?? ranch.type}</InfoRow>
            <InfoRow label="Estado">
              <Badge variant={statusVariant}>{STATUS_LABELS[ranch.status] ?? ranch.status}</Badge>
            </InfoRow>
            <InfoRow label="Activo">
              {ranch.isActive
                ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Sí</span>
                : <span className="inline-flex items-center gap-1 text-gray-400"><XCircle className="w-3.5 h-3.5" />No</span>}
            </InfoRow>
            {ranch.description && <InfoRow label="Descripción">{ranch.description}</InfoRow>}

            <InfoRow label="Dirección">{ranch.address}</InfoRow>
            <InfoRow label="Ciudad">{ranch.city}, {ranch.state}</InfoRow>
            <InfoRow label="País">
              <span className="inline-flex items-center gap-1">
                <Globe className="w-3 h-3 text-gray-400" />
                {ranch.country}
              </span>
            </InfoRow>
            {ranch.postalCode && <InfoRow label="C.P.">{ranch.postalCode}</InfoRow>}
            <InfoRow label="Zona horaria">{ranch.timezone}</InfoRow>

            {ranch.elevation != null && (
              <InfoRow label="Elevación">
                <span className="inline-flex items-center gap-1">
                  <Mountain className="w-3 h-3 text-amber-500" />
                  {ranch.elevation} msnm
                </span>
              </InfoRow>
            )}
            {ranch.annualRainfall != null && (
              <InfoRow label="Precipitación">
                <span className="inline-flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-sky-500" />
                  {ranch.annualRainfall} mm/año
                </span>
              </InfoRow>
            )}
            {ranch.averageTemperature != null && (
              <InfoRow label="Temperatura">
                <span className="inline-flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-rose-500" />
                  {ranch.averageTemperature}°C
                </span>
              </InfoRow>
            )}

            <InfoRow label="Creado">
              <span className="inline-flex items-center gap-1 text-xs">
                <Calendar className="w-3 h-3" />
                {ranch.createdAt ? formatDate(ranch.createdAt) : '—'}
              </span>
            </InfoRow>
          </div>
        </Card>

        {/* Bottom-Left: Coordinates + boundary summary */}
        <Card className="lg:h-[280px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <CardTitle>Coordenadas y perímetro</CardTitle>
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

              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Layers className="w-3.5 h-3.5" />
                  Perímetro
                </div>
                {ranch.boundary ? (
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    Tipo: <strong>{ranch.boundary.type}</strong>
                    {ranch.boundary.type === 'CIRCULAR' && ranch.boundary.radius != null && (
                      <> · Radio: <strong>{ranch.boundary.radius} m</strong></>
                    )}
                    {ranch.boundary.type === 'POLYGON' && ranch.boundary.coordinates && (
                      <> · {ranch.boundary.coordinates.length} vértices</>
                    )}
                  </div>
                ) : ranch.boundaryRadius && ranch.boundaryRadius > 0 ? (
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    <strong>Radio operativo:</strong> {ranch.boundaryRadius} km{' '}
                    <span className="text-gray-400">(círculo aproximado, sin perímetro real)</span>
                  </div>
                ) : (
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    Sin perímetro configurado. Edita el rancho para dibujarlo.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <MapPin className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-500">Sin coordenadas registradas</p>
            </div>
          )}
        </Card>

        {/* Bottom-Right: Summary stats */}
        <Card className="lg:h-[280px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle>Superficie y capacidad</CardTitle>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3">
              <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider flex items-center gap-1">
                <Ruler className="w-3 h-3" /> Área Total
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                {ranch.totalArea} <span className="text-xs font-normal text-gray-400">ha</span>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3">
              <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider flex items-center gap-1">
                <Ruler className="w-3 h-3" /> Pastoreo
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                {ranch.grazingArea} <span className="text-xs font-normal text-gray-400">ha</span>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3">
              <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider flex items-center gap-1">
                <Home className="w-3 h-3" /> Capacidad
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                {cattleMax} <span className="text-xs font-normal text-gray-400">cabezas</span>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3">
              <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider flex items-center gap-1">
                <Home className="w-3 h-3" /> Ganado actual
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                {cattleCurrent}
              </div>
            </div>
            {density != null && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 col-span-2">
                <div className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Densidad ganadera</div>
                <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                  {density.toFixed(2)} <span className="text-xs font-normal text-gray-400">cabezas/ha</span>
                </div>
              </div>
            )}
          </div>

          {cattleMax > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Ocupación</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{occupancyPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    occupancyPct >= 100 ? 'bg-red-500' : occupancyPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${Math.min(100, occupancyPct)}%` }}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Tabs (Info / Media — Ubicaciones llega en 9.4) ── */}
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
          {activeTab === 'info' && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Toda la información clave del rancho ya está visible en los cuadrantes superiores.
            </div>
          )}
          {activeTab === 'locations' && (
            <RanchLocationsPanel ranchId={id!} ranchName={ranch.name} />
          )}
          {activeTab === 'media' && <MediaGallery entityType="ranch" entityId={id!} />}
        </div>
      </div>

      {/* ── Delete confirm modal ── */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar rancho" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700 dark:text-red-400">
              <p className="font-medium">Esta acción no se puede deshacer.</p>
              <p className="mt-0.5">
                Se eliminará <strong>{ranch.name}</strong> [{ranch.ranchCode}] y todas las ubicaciones asociadas.
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
