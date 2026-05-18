import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { bovinesApi } from '@/api/bovines.api';
import type { HeatmapPoint, ClusterPoint, BovinePoint, GeoStats } from '@/api/bovines.api';
import { locationsApi } from '@/api/locations.api';
import { MapView, type MapMarker } from '@/components/maps/MapView';
import { MapFiltersPanel, type MapFilters } from '@/components/maps/MapFiltersPanel';
import { RanchFilterBanner, RanchFilterBannerEmpty } from '@/components/shared/RanchFilterBanner';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import type { Location } from '@/types';
import {
  Map, Layers, Thermometer, MapPin, Navigation, Activity, Eye,
  CircleDot,
} from 'lucide-react';

type MapLayer = 'bovines' | 'locations' | 'heatmap' | 'clusters';

const HEALTH_COLORS: Record<string, string> = {
  HEALTHY: '#22c55e',
  SICK: '#f59e0b',
  RECOVERING: '#3b82f6',
  QUARANTINE: '#a855f7',
  DECEASED: '#ef4444',
  UNKNOWN: '#6b7280',
};

const HEALTH_LABELS: Record<string, string> = {
  HEALTHY: 'Saludable',
  SICK: 'Enfermo',
  RECOVERING: 'Recuperación',
  QUARANTINE: 'Cuarentena',
  DECEASED: 'Fallecido',
  UNKNOWN: 'Desconocido',
};

const emptyFilters: MapFilters = {
  healthStatus: [],
  breeds: [],
  gender: [],
  ageMin: undefined,
  ageMax: undefined,
  diseases: [],
};

export function MapsPage() {
  const { activeRanchId } = useAuth();
  const [activeLayer, setActiveLayer] = useState<MapLayer>('bovines');
  const [filters, setFilters] = useState<MapFilters>(emptyFilters);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  // Build filter query params for heatmap endpoint
  const heatmapParams = useMemo(() => {
    if (!activeRanchId) return null;
    const params: Record<string, string | number> = {};
    if (filters.healthStatus.length > 0) params.healthStatus = filters.healthStatus.join(',');
    if (filters.breeds.length > 0) params.breeds = filters.breeds.join(',');
    if (filters.ageMin !== undefined) params.ageMin = filters.ageMin;
    if (filters.ageMax !== undefined) params.ageMax = filters.ageMax;
    return params;
  }, [activeRanchId, filters]);

  // ── Fetch heatmap data (also used for bovine points) ───────────────────
  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['heatmap', activeRanchId, heatmapParams],
    queryFn: () =>
      bovinesApi
        .getHeatmap(activeRanchId!, heatmapParams as any)
        .then((r) => r.data.data),
    enabled: !!activeRanchId && (activeLayer === 'heatmap' || activeLayer === 'bovines'),
  });

  // ── Fetch clusters ─────────────────────────────────────────────────────
  // The clusters endpoint is `@deprecated`: it may respond with a non-array
  // shape (null, {}, error wrapper) which used to crash the page render
  // (`(clusterData as ClusterPoint[]).map is not a function`). We normalize
  // the response to an array here and let downstream code filter invalid
  // points safely.
  const { data: clusterData, isLoading: clusterLoading, isError: clusterError } = useQuery({
    queryKey: ['clusters', activeRanchId, filters],
    queryFn: async () => {
      const res = await bovinesApi.getClusters(activeRanchId!, {
        bounds: { north: 90, south: -90, east: 180, west: -180 },
        zoom: 10,
        filters: {
          healthStatus: filters.healthStatus.length ? filters.healthStatus : undefined,
          breeds: filters.breeds.length ? filters.breeds : undefined,
        },
      });
      const payload = res.data?.data;
      // Backend may return:
      //   • array directly
      //   • { items: [...] }   (older shape)
      //   • null / {}          (no clusters)
      if (Array.isArray(payload)) return payload;
      if (payload && typeof payload === 'object' && Array.isArray((payload as any).items)) {
        return (payload as any).items as ClusterPoint[];
      }
      return [] as ClusterPoint[];
    },
    enabled: !!activeRanchId && activeLayer === 'clusters',
    retry: false,
  });

  // ── Fetch locations ────────────────────────────────────────────────────
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['locations-map', activeRanchId],
    queryFn: () => locationsApi.list({ page: 1, limit: 100 }),
    enabled: !!activeRanchId,
  });

  // ── Fetch geo stats ────────────────────────────────────────────────────
  const { data: geoStats } = useQuery({
    queryKey: ['geo-stats', activeRanchId],
    queryFn: () => bovinesApi.getGeoStats(activeRanchId!).then((r) => r.data.data),
    enabled: !!activeRanchId,
  });

  // ── Build markers per layer ────────────────────────────────────────────

  const bovineMarkers: MapMarker[] = useMemo(() => {
    if (!heatmapData || activeLayer !== 'bovines') return [];
    const arr = Array.isArray(heatmapData) ? heatmapData : [];
    return (arr as (HeatmapPoint & { healthStatus?: string; bovineId?: string })[])
      // Use Number.isFinite — `p.lat && p.lng` rejects valid 0 coords and
      // accepts NaN (which crashes Leaflet downstream).
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p, i) => ({
        id: p.bovineId || `hp-${p.lat}-${p.lng}-${i}`,
        lat: p.lat,
        lng: p.lng,
        label: p.healthStatus ? (HEALTH_LABELS[p.healthStatus] || p.healthStatus) : 'Bovino',
        color: p.healthStatus ? HEALTH_COLORS[p.healthStatus] : '#22c55e',
        popup: p.healthStatus
          ? `Estado: ${HEALTH_LABELS[p.healthStatus] || p.healthStatus}`
          : undefined,
      }));
  }, [heatmapData, activeLayer]);

  const locationMarkers: MapMarker[] = useMemo(() => {
    const locations: Location[] = locationsData?.items || [];
    if (activeLayer !== 'locations') return [];
    return locations
      .filter((loc) =>
        loc.coordinates &&
        Number.isFinite(loc.coordinates.latitude) &&
        Number.isFinite(loc.coordinates.longitude))
      .map((loc) => ({
        id: loc.id,
        lat: loc.coordinates!.latitude,
        lng: loc.coordinates!.longitude,
        label: loc.name,
        popup: `${loc.type} — ${loc.capacity?.currentAnimals ?? 0}/${loc.capacity?.maxAnimals ?? '?'}`,
      }));
  }, [locationsData, activeLayer]);

  const clusterMarkers: MapMarker[] = useMemo(() => {
    if (!clusterData || activeLayer !== 'clusters') return [];
    // Defensive: clusterData IS an array (the queryFn guarantees it now),
    // but each item still needs lat/lng validation — Leaflet's LatLng will
    // throw "Invalid LatLng" if any coord is undefined/NaN, blanking the
    // whole page. We also fabricate a stable id when the backend omits it.
    const arr = Array.isArray(clusterData) ? clusterData : [];
    return arr
      .filter((c): c is ClusterPoint =>
        c != null &&
        Number.isFinite(c.lat) &&
        Number.isFinite(c.lng))
      .map((c, i) => ({
        id: c.id ?? `cluster-${c.lat}-${c.lng}-${i}`,
        lat: c.lat,
        lng: c.lng,
        label: `Cluster (${c.count ?? 0})`,
        count: c.count ?? 0,
        popup: c.healthBreakdown
          ? Object.entries(c.healthBreakdown)
              .map(([k, v]) => `${HEALTH_LABELS[k] || k}: ${v}`)
              .join(', ')
          : `${c.count ?? 0} bovinos`,
      }));
  }, [clusterData, activeLayer]);

  const activeMarkers = useMemo(() => {
    switch (activeLayer) {
      case 'bovines': return bovineMarkers;
      case 'locations': return locationMarkers;
      case 'clusters': return clusterMarkers;
      case 'heatmap': return []; // heatmap uses different rendering
      default: return [];
    }
  }, [activeLayer, bovineMarkers, locationMarkers, clusterMarkers]);

  const isLoading = heatmapLoading || locationsLoading || clusterLoading;

  const layers: { id: MapLayer; label: string; icon: typeof Map }[] = [
    { id: 'bovines', label: 'Bovinos', icon: CircleDot },
    { id: 'locations', label: 'Ubicaciones', icon: MapPin },
    { id: 'heatmap', label: 'Mapa de Calor', icon: Thermometer },
    { id: 'clusters', label: 'Clusters', icon: Layers },
  ];

  const stats = geoStats as GeoStats | undefined;

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    setSelectedMarker(marker);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <Map className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mapa Interactivo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Visualización geoespacial del ganado y ubicaciones</p>
          </div>
        </div>
      </div>

      {/* Global ranch filter — same convention as Bovinos / Salud /
          Ubicaciones. Multi-ranch users (or SUPER_ADMIN) can switch
          context here; single-ranch users see the auto-selected one
          and the banner stays hidden. */}
      <RanchFilterBanner
        activeHint="Mostrando bovinos y ubicaciones de este rancho."
        emptyHint="Selecciona un rancho para ver el mapa."
      />

      {/* If no ranch is selected, render the empty state and stop here —
          every layer below queries by ranchId and would yield nothing. */}
      {!activeRanchId && (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="El mapa interactivo, los mapas de calor, los clusters y las ubicaciones se cargan por rancho. Elige uno arriba para visualizar la información."
        />
      )}

      {/* Stats */}
      {activeRanchId && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Bovinos Rastreados" value={stats.trackedBovines || 0} icon={Navigation} color="primary" />
          <StatCard title="Ubicaciones Activas" value={stats.activeLocations || 0} icon={MapPin} color="blue" />
          <StatCard title="Dispositivos Online" value={stats.onlineDevices || 0} icon={Activity} color="emerald" />
          <StatCard title="Alertas Geofence" value={stats.geofenceAlerts || 0} icon={Eye} color="amber" />
        </div>
      )}

      {/* Everything below requires a ranch — wrap once so we don't have
          to gate every section individually. */}
      {activeRanchId && (
      <>
      {/* Layer Selector */}
      <div className="flex flex-wrap gap-2">
        {layers.map((layer) => (
          <Button
            key={layer.id}
            variant={activeLayer === layer.id ? 'primary' : 'outline'}
            size="sm"
            icon={<layer.icon className="w-4 h-4" />}
            onClick={() => setActiveLayer(layer.id)}
          >
            {layer.label}
          </Button>
        ))}
      </div>

      {/* Map + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters Panel (always visible) */}
          <MapFiltersPanel
            filters={filters}
            onChange={setFilters}
          />

          {isLoading ? (
            <Card className="flex items-center justify-center h-[600px]">
              <Spinner />
            </Card>
          ) : activeLayer === 'clusters' && clusterError ? (
            <Card className="flex flex-col items-center justify-center h-[600px] gap-2 text-center px-6">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                No se pudo cargar la capa de clusters
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
                El endpoint de clusters está en proceso de migración. Mientras tanto,
                puedes usar la capa <strong>"Bovinos"</strong> que muestra los puntos
                individuales con su estado de salud.
              </p>
            </Card>
          ) : (
            <MapView
              markers={activeMarkers}
              className="h-[600px] w-full"
              onMarkerClick={handleMarkerClick}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected Marker Details */}
          {selectedMarker && (
            <Card>
              <CardTitle>{selectedMarker.label}</CardTitle>
              {selectedMarker.popup && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{selectedMarker.popup}</p>
              )}
              {selectedMarker.count && (
                <Badge variant="info" className="mt-2">{selectedMarker.count} bovinos</Badge>
              )}
              {selectedMarker.color && (
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedMarker.color }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedMarker.label}
                  </span>
                </div>
              )}
            </Card>
          )}

          {/* Health Legend */}
          {(activeLayer === 'bovines' || activeLayer === 'heatmap') && (
            <Card>
              <CardTitle>Leyenda de Salud</CardTitle>
              <div className="mt-3 space-y-2">
                {Object.entries(HEALTH_COLORS).map(([key, color]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {HEALTH_LABELS[key] || key}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Heatmap Legend */}
          {activeLayer === 'heatmap' && (
            <Card>
              <CardTitle>Densidad</CardTitle>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Baja densidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Media densidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Alta densidad</span>
                </div>
              </div>
            </Card>
          )}

          {/* Locations List */}
          <Card>
            <CardTitle>Ubicaciones ({locationsData?.items?.length || 0})</CardTitle>
            <div className="mt-3 space-y-2 max-h-[350px] overflow-y-auto">
              {(locationsData?.items || []).length === 0 ? (
                <p className="text-sm text-gray-400">No hay ubicaciones registradas</p>
              ) : (
                (locationsData?.items || []).map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      if (loc.coordinates) {
                        setSelectedMarker({
                          id: loc.id,
                          lat: loc.coordinates.latitude,
                          lng: loc.coordinates.longitude,
                          label: loc.name,
                          popup: `${loc.type} — ${loc.capacity?.currentAnimals ?? 0}/${loc.capacity?.maxAnimals ?? '?'}`,
                        });
                        setActiveLayer('locations');
                      }
                    }}
                    className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{loc.name}</p>
                      <p className="text-xs text-gray-500">{loc.type}</p>
                    </div>
                    <Badge
                      variant={loc.status === 'ACTIVE' ? 'success' : 'default'}
                      className="shrink-0"
                    >
                      {loc.capacity?.currentAnimals ?? 0}/{loc.capacity?.maxAnimals ?? '?'}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
