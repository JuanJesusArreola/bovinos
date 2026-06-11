/**
 * MapsPage — Dashboard geoespacial del rancho.
 *
 * Tres capas conmutables:
 *   • Bovinos    → reutiliza `BovineMapView` (mismo motor moderno que
 *                  `/bovines?view=map`: viewport-aware, clustering por
 *                  potrero, boundaries, hover tooltips, drill-down).
 *   • Ubicaciones → renderiza cada potrero como AREA (polygon/rect/circle)
 *                  con pin central. Hover → nombre + ocupancia. Click →
 *                  navega al detalle de la ubicación.
 *   • Mapa de Calor → leaflet.heat con puntos pesados por estado de salud
 *                  (críticos pesan más). Muestra DÓNDE se concentran los
 *                  problemas sanitarios.
 *
 * Capas independientes — cada una usa su propio fetch y renderiza solo
 * cuando está activa.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapContainer, TileLayer, Marker, Tooltip,
  Polygon, Rectangle, Circle, CircleMarker, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import { useAuth } from '@/store/AuthContext';
import { bovinesApi } from '@/api/bovines.api';
import type { HeatmapPoint, GeoStats } from '@/api/bovines.api';
import { locationsApi } from '@/api/locations.api';
import { BovineMapView } from '@/components/bovines/BovineMapView';
import { RanchFilterBanner, RanchFilterBannerEmpty } from '@/components/shared/RanchFilterBanner';
import { MapFiltersPanel, type MapFilters } from '@/components/maps/MapFiltersPanel';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '@/utils/constants';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import type { Location } from '@/types';
import type { MapMarkersFilters, HealthStatus, CattleType, GenderType } from '@/types/bovine.dtos';
import {
  // ⚠️ Aliasamos el icono `Map` → `MapIcon` para NO sombrear al `Map`
  // nativo de JS — sin alias, `new Map()` crasheaba con
  // "TypeError: Map is not a constructor" porque resolvía al componente
  // React del icono.
  Map as MapIcon,
  Layers, Thermometer, MapPin, Navigation, Activity, Eye, CircleDot,
  Stethoscope,
} from 'lucide-react';

import { useBovineCases } from '@/hooks/useBovineCases';
import { useActiveDiseases } from '@/hooks/useDiseases';
import { useEpidemiologyHeatmap } from '@/hooks/useEpidemiology';
import type { EpidemiologyHeatmapCell } from '@/types/epidemiology.dtos';
import {
  CaseStatus, type BovineCaseListItem,
} from '@/types/bovineCase.dtos';
import {
  CASE_STATUS_LABELS,
  getCaseStatusColor, getCaseStatusLabel,
  getCaseSeverityLabel,
} from '@/design-system/tokens/case-status.colors';

type MapLayer = 'bovines' | 'locations' | 'heatmap' | 'epidemiology';

// Status considerados "abiertos" para el mapa epidemiológico — un caso
// CERRADO no aporta información de propagación activa.
const EPIDEMIOLOGY_OPEN_STATUSES: CaseStatus[] = [
  CaseStatus.SUSPECTED, CaseStatus.CONFIRMED, CaseStatus.RECOVERING,
];

// Prioridad visual cuando un bovino tiene MÚLTIPLES casos abiertos
// (raro pero posible: distintas enfermedades concurrentes). El "peor"
// status define el color del marker.
const STATUS_PRIORITY: Record<CaseStatus, number> = {
  [CaseStatus.SUSPECTED]:  1,
  [CaseStatus.CONFIRMED]:  3,
  [CaseStatus.RECOVERING]: 2,
  [CaseStatus.RECOVERED]:  0,
  [CaseStatus.DECEASED]:   0,
  [CaseStatus.DISCARDED]:  0,
};

import {
  HEALTH_COLORS, getHealthLabel,
  HERD_HEALTH_BUCKETS,
  computeHerdHealthScore,
  getHerdHealthBucket,
} from '@/design-system/tokens';

// Los pesos del heatmap ahora viven en el design-system como
// `HERD_HEALTH_SCORE_WEIGHTS` (con signo: positivo = sano, negativo = enfermo)
// — usado por `computeHerdHealthScore` para el cálculo agregado por celda.

const emptyFilters: MapFilters = {
  healthStatus: [],
  breeds: [],
  gender: [],
  ageMin: undefined,
  ageMax: undefined,
  diseases: [],
};

// ─── Component ───────────────────────────────────────────────────────────────

export function MapsPage() {
  const { activeRanchId } = useAuth();
  const navigate = useNavigate();
  const [activeLayer, setActiveLayer] = useState<MapLayer>('bovines');
  const [filters, setFilters] = useState<MapFilters>(emptyFilters);
  const [epiSubLayer, setEpiSubLayer] = useState<'cases' | 'heatmap'>('cases');

  // ── Geo stats KPIs (capa-agnóstica) ──────────────────────────────────────
  const { data: geoStats } = useQuery({
    queryKey: ['geo-stats', activeRanchId],
    queryFn: () => bovinesApi.getGeoStats(activeRanchId!).then((r) => r.data.data),
    enabled: !!activeRanchId,
    staleTime: 60_000,
  });

  // ── Locations (alimenta capas Ubicaciones + Heatmap + sidebar) ───────────
  const { data: locationsData } = useQuery({
    queryKey: ['locations-map', activeRanchId],
    queryFn: () => locationsApi.list({ ranchId: activeRanchId!, limit: 100 }),
    enabled: !!activeRanchId,
    staleTime: 60_000,
  });
  const locations: Location[] = locationsData?.items ?? [];

  // ── Heatmap data (puntos por bovino) ─────────────────────────────────────
  // Solo se pide cuando la capa está activa — evita carga innecesaria.
  const heatmapParams = useMemo(() => {
    if (!activeRanchId) return null;
    const params: Record<string, string | number> = {};
    if (filters.healthStatus.length > 0) params.healthStatus = filters.healthStatus.join(',');
    if (filters.breeds.length > 0)       params.breeds       = filters.breeds.join(',');
    if (filters.ageMin !== undefined)    params.ageMin       = filters.ageMin;
    if (filters.ageMax !== undefined)    params.ageMax       = filters.ageMax;
    return params;
  }, [activeRanchId, filters]);

  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['heatmap', activeRanchId, heatmapParams],
    queryFn: () =>
      bovinesApi
        .getHeatmap(activeRanchId!, heatmapParams as any)
        .then((r) => r.data.data),
    enabled: !!activeRanchId && activeLayer === 'heatmap',
    staleTime: 30_000,
  });

  // ── Convierte filtros MapFilters → MapMarkersFilters (para BovineMapView)
  const bovineMapFilters: MapMarkersFilters = useMemo(() => ({
    ranchIds:     activeRanchId ? [activeRanchId] : null,
    healthStatus: filters.healthStatus as HealthStatus[],
    breeds:       filters.breeds,
    genders:      filters.gender as GenderType[],
    cattleTypes:  [] as CattleType[],
    diseases:     filters.diseases,
    ageRange:
      filters.ageMin != null || filters.ageMax != null
        ? { min: filters.ageMin ?? 0, max: filters.ageMax ?? 999 }
        : undefined,
  }), [activeRanchId, filters]);

  const layers: { id: MapLayer; label: string; icon: typeof MapIcon }[] = [
    { id: 'bovines',      label: 'Bovinos',       icon: CircleDot },
    { id: 'locations',    label: 'Ubicaciones',   icon: MapPin },
    { id: 'heatmap',      label: 'Mapa de Calor', icon: Thermometer },
    { id: 'epidemiology', label: 'Epidemiología', icon: Stethoscope },
  ];

  // ── Capa EPIDEMIOLOGÍA — datos ─────────────────────────────────────────
  //
  // Estrategia: traemos (a) markers del rancho y (b) casos abiertos.
  // En cliente los cruzamos por `bovineId` y solo pintamos los bovinos
  // que tienen ≥1 caso abierto. Color del marker = peor status según
  // STATUS_PRIORITY (CONFIRMED > RECOVERING > SUSPECTED).
  //
  // Filtro por enfermedad: si el usuario seleccionó UNA enfermedad en el
  // panel de filtros, restringimos `useBovineCases` a ese diseaseId. Con
  // múltiples enfermedades, el backend solo acepta una por query →
  // tomamos la primera y avisamos en la leyenda.
  const epidemiologyDiseaseId = filters.diseases[0] ?? undefined;
  const epidemiologyEnabled = activeLayer === 'epidemiology' && !!activeRanchId;

  const { data: openCasesData, isLoading: casesLoading } = useBovineCases(
    {
      ranchId: activeRanchId ?? undefined,
      status:  EPIDEMIOLOGY_OPEN_STATUSES,
      limit:   500,
      ...(epidemiologyDiseaseId ? { diseaseId: epidemiologyDiseaseId } : {}),
    },
    { enabled: epidemiologyEnabled },
  );
  const openCases: BovineCaseListItem[] = openCasesData?.data ?? [];

  const { data: epidemiologyMarkers, isLoading: markersLoading } = useQuery({
    queryKey: ['epidemiology-markers', activeRanchId],
    queryFn: () =>
      bovinesApi
        .getMapMarkers(
          { ranchIds: activeRanchId ? [activeRanchId] : null } as any,
          { maxMarkers: 5000 },
        )
        .then((r) => r.data.data),
    enabled: epidemiologyEnabled,
    staleTime: 60_000,
  });

  // Catálogo (solo para mostrar el nombre de la enfermedad filtrada en
  // la leyenda — el hook ya cachea 10 min).
  const { data: activeDiseases = [] } = useActiveDiseases({
    enabled: epidemiologyEnabled,
  });
  const filteredDiseaseName = epidemiologyDiseaseId
    ? activeDiseases.find((d) => d.id === epidemiologyDiseaseId)?.name
    : undefined;

  // Sub-capa EPIDEMIOLOGÍA → HEATMAP (NEW-2)
  const { data: epiHeatmapData, isLoading: epiHeatmapLoading } = useEpidemiologyHeatmap(
    {
      ranchId:   activeRanchId ?? '',
      diseaseId: epidemiologyDiseaseId,
    },
    { enabled: epidemiologyEnabled && epiSubLayer === 'heatmap' },
  );

  const stats = geoStats as GeoStats | undefined;
  const ranchCenter: [number, number] = useMemo(() => {
    // Calcular centro promedio de las locations del rancho — usado como
    // initial center del mapa cuando hay datos. Si no, usar default.
    const withCoords = locations.filter(
      (l) => l.coordinates?.latitude && l.coordinates?.longitude,
    );
    if (withCoords.length === 0) return [MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng];
    return [
      withCoords.reduce((s, l) => s + l.coordinates!.latitude, 0) / withCoords.length,
      withCoords.reduce((s, l) => s + l.coordinates!.longitude, 0) / withCoords.length,
    ];
  }, [locations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <MapIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mapa Interactivo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Visualización geoespacial del ganado y ubicaciones
            </p>
          </div>
        </div>
      </div>

      <RanchFilterBanner
        activeHint="Mostrando bovinos y ubicaciones de este rancho."
        emptyHint="Selecciona un rancho para ver el mapa."
      />

      {!activeRanchId && (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="El mapa interactivo, los mapas de calor y las ubicaciones se cargan por rancho. Elige uno arriba para visualizar la información."
        />
      )}

      {activeRanchId && (
        <>
          {/* Stats KPIs */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Bovinos Rastreados" value={stats.trackedBovines || 0} icon={Navigation} color="primary" />
              <StatCard title="Ubicaciones Activas" value={stats.activeLocations || 0} icon={MapPin} color="blue" />
              <StatCard title="Dispositivos Online" value={stats.onlineDevices || 0} icon={Activity} color="emerald" />
              <StatCard title="Alertas Geofence"   value={stats.geofenceAlerts || 0} icon={Eye}        color="amber" />
            </div>
          )}

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
            <div className="lg:col-span-3 space-y-4">
              {/* Filtros (bovinos / heatmap / epidemiología usan los mismos
                  — epidemiología solo respeta la primera enfermedad
                  seleccionada, ver `epidemiologyDiseaseId` arriba). */}
              {(activeLayer === 'bovines'
                || activeLayer === 'heatmap'
                || activeLayer === 'epidemiology') && (
                <MapFiltersPanel filters={filters} onChange={setFilters} />
              )}

              {/* ─── Capa BOVINOS — reusa BovineMapView ──────────────── */}
              {activeLayer === 'bovines' && (
                <BovineMapView
                  filters={bovineMapFilters}
                  initialCenter={{ lat: ranchCenter[0], lng: ranchCenter[1] }}
                  initialZoom={13}
                  onMarkerClick={(bovineId) => navigate(`/bovines/${bovineId}`)}
                  className="h-[600px] w-full"
                />
              )}

              {/* ─── Capa UBICACIONES ─────────────────────────────────── */}
              {activeLayer === 'locations' && (
                <LocationsLayerMap
                  locations={locations}
                  center={ranchCenter}
                  onLocationClick={(id) => navigate(`/locations/${id}`)}
                />
              )}

              {/* ─── Capa MAPA DE CALOR ──────────────────────────────── */}
              {activeLayer === 'heatmap' && (
                heatmapLoading ? (
                  <Card className="flex items-center justify-center h-[600px]">
                    <Spinner />
                  </Card>
                ) : (
                  <HeatmapLayerMap
                    points={heatmapData as HeatmapPoint[] | undefined}
                    locations={locations}
                    center={ranchCenter}
                  />
                )
              )}

              {/* ─── Capa EPIDEMIOLOGÍA ──────────────────────────────── */}
              {activeLayer === 'epidemiology' && (
                <>
                  {/* Sub-toggle: casos puntuales vs heatmap de enfermedad */}
                  <div className="flex gap-2">
                    <Button
                      variant={epiSubLayer === 'cases' ? 'primary' : 'outline'}
                      size="sm"
                      icon={<Stethoscope className="w-3.5 h-3.5" />}
                      onClick={() => setEpiSubLayer('cases')}
                    >
                      Casos
                    </Button>
                    <Button
                      variant={epiSubLayer === 'heatmap' ? 'primary' : 'outline'}
                      size="sm"
                      icon={<Thermometer className="w-3.5 h-3.5" />}
                      onClick={() => setEpiSubLayer('heatmap')}
                    >
                      Mapa de calor
                    </Button>
                  </div>

                  {epiSubLayer === 'cases' && (
                    (casesLoading || markersLoading) ? (
                      <Card className="flex items-center justify-center h-[600px]">
                        <Spinner />
                      </Card>
                    ) : (
                      <EpidemiologyLayerMap
                        openCases={openCases}
                        markers={epidemiologyMarkers}
                        locations={locations}
                        center={ranchCenter}
                        onMarkerClick={(caseId) => navigate(`/health/cases/${caseId}`)}
                      />
                    )
                  )}

                  {epiSubLayer === 'heatmap' && (
                    epiHeatmapLoading ? (
                      <Card className="flex items-center justify-center h-[600px]">
                        <Spinner />
                      </Card>
                    ) : (epiHeatmapData && epiHeatmapData.length > 0) ? (
                      <EpiHeatmapLayerMap
                        cells={epiHeatmapData}
                        locations={locations}
                        center={ranchCenter}
                      />
                    ) : (
                      <Card className="flex flex-col items-center justify-center h-[600px] gap-3">
                        <Thermometer className="w-10 h-10 text-gray-300 dark:text-gray-700" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No hay datos de heatmap epidemiológico para este rancho.
                        </p>
                      </Card>
                    )
                  )}
                </>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Health legend — bovinos + heatmap */}
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
                          {getHealthLabel(key)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Heatmap legend — "Indicador visual de salud del hato" */}
              {activeLayer === 'heatmap' && (
                <Card>
                  <CardTitle>Estado de salud del hato</CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Color por zona = promedio de salud del ganado allí.
                    Verde = saludable · Rojo = crítico.
                  </p>

                  {/* Score agregado del rancho — un solo número grande, en el
                      color del bucket correspondiente, leído de un vistazo. */}
                  {heatmapData && (heatmapData as HeatmapPoint[]).length > 0 && (() => {
                    const score = computeHerdHealthScore(
                      (heatmapData as HeatmapPoint[]).map((p: any) => ({ healthStatus: p.healthStatus })),
                    );
                    const bucket = getHerdHealthBucket(score);
                    return (
                      <div className="mt-3 p-3 rounded-lg border" style={{
                        borderColor: bucket.color,
                        backgroundColor: `${bucket.color}15`,
                      }}>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Estado general</p>
                        <p className="text-lg font-bold" style={{ color: bucket.color }}>
                          {bucket.label}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          Score: {score.toFixed(2)} · {(heatmapData as HeatmapPoint[]).length} bovinos
                        </p>
                      </div>
                    );
                  })()}

                  {/* Gradiente de la leyenda — invertido respecto al heatmap
                      clásico: izquierda = crítico (rojo), derecha = saludable
                      (verde). Refleja el orden de los buckets del token. */}
                  <div className="mt-3">
                    <div className="h-3 rounded-full" style={{
                      background: 'linear-gradient(90deg, #dc2626 0%, #f97316 25%, #facc15 50%, #84cc16 75%, #16a34a 100%)',
                    }} />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>Crítico</span><span>Mixto</span><span>Saludable</span>
                    </div>
                  </div>

                  {/* Detalle de cada bucket con su descripción semántica.
                      Pensado para que un usuario no técnico entienda qué
                      significa cada color al verlo en el mapa. */}
                  <div className="mt-4 space-y-1.5">
                    {[...HERD_HEALTH_BUCKETS].reverse().map((bucket) => (
                      <div key={bucket.label} className="flex items-start gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: bucket.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {bucket.label}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                            {bucket.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ─── Epidemiology legend ─────────────────────────────── */}
              {activeLayer === 'epidemiology' && (
                <Card>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-primary-600" />
                    Casos clínicos abiertos
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Solo se muestran bovinos con caso clínico activo (SUSPECTED / CONFIRMED / RECOVERING).
                    {filters.diseases.length > 1 && (
                      <span className="block mt-1 italic text-amber-600 dark:text-amber-400">
                        El filtro de enfermedades múltiples no aplica en esta capa — se está mostrando solo «
                        {filteredDiseaseName ?? 'la primera seleccionada'}».
                      </span>
                    )}
                  </p>

                  {/* Mini KPIs derivados de openCases */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {EPIDEMIOLOGY_OPEN_STATUSES.map((s) => {
                      const count = openCases.filter((c) => c.status === s).length;
                      return (
                        <div
                          key={s}
                          className="p-2 rounded-lg border text-center"
                          style={{
                            borderColor: getCaseStatusColor(s),
                            backgroundColor: `${getCaseStatusColor(s)}15`,
                          }}
                        >
                          <p
                            className="text-lg font-bold leading-none"
                            style={{ color: getCaseStatusColor(s) }}
                          >
                            {count}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
                            {CASE_STATUS_LABELS[s]}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Leyenda visual */}
                  <div className="mt-4 space-y-1.5">
                    {EPIDEMIOLOGY_OPEN_STATUSES.map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: getCaseStatusColor(s) }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {getCaseStatusLabel(s)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {epidemiologyMarkers?.mode === 'clusters' && (
                    <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400 italic">
                      Hay tantos bovinos que el backend devolvió clusters; los
                      marcadores epidemiológicos individuales pueden estar incompletos.
                      Acerca el zoom para ver casos puntuales.
                    </p>
                  )}
                </Card>
              )}

              {/* Locations list — siempre visible */}
              <Card>
                <CardTitle>Ubicaciones ({locations.length})</CardTitle>
                <div className="mt-3 space-y-2 max-h-[350px] overflow-y-auto">
                  {locations.length === 0 ? (
                    <p className="text-sm text-gray-400">No hay ubicaciones registradas</p>
                  ) : (
                    locations.map((loc) => (
                      <button
                        key={loc.id}
                        onClick={() => navigate(`/locations/${loc.id}`)}
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

// ════════════════════════════════════════════════════════════════════════════
// LocationsLayerMap — pines + áreas con hover/click
// ════════════════════════════════════════════════════════════════════════════

function LocationsLayerMap({
  locations, center, onLocationClick,
}: {
  locations: Location[];
  center: [number, number];
  onLocationClick: (id: string) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 h-[600px] w-full">
      <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Para cada ubicación: AREA (boundary) + PIN central + tooltip. */}
        {locations.map((loc) => (
          <LocationMapItem
            key={loc.id}
            location={loc}
            onClick={onLocationClick}
          />
        ))}

        <FitLocationsBounds locations={locations} />
      </MapContainer>
    </div>
  );
}

/** Pinta el shape (polygon/rect/circle) + pin + tooltip de una location. */
function LocationMapItem({
  location, onClick,
}: {
  location: Location;
  onClick: (id: string) => void;
}) {
  const gf = location.geofenceConfig;
  // Centro: coords si existen, si no centroide del boundary.
  const center: [number, number] | null = useMemo(() => {
    if (location.coordinates?.latitude != null && location.coordinates?.longitude != null) {
      return [location.coordinates.latitude, location.coordinates.longitude];
    }
    if (gf?.type === 'CIRCULAR' && gf.center) {
      return [gf.center.latitude, gf.center.longitude];
    }
    if (gf?.type === 'RECTANGULAR' && gf.boundingBox) {
      const bb = gf.boundingBox;
      return [(bb.north + bb.south) / 2, (bb.east + bb.west) / 2];
    }
    if (gf?.type === 'POLYGON' && gf.coordinates?.length) {
      const cs = gf.coordinates;
      return [
        cs.reduce((s, c) => s + c.latitude, 0) / cs.length,
        cs.reduce((s, c) => s + c.longitude, 0) / cs.length,
      ];
    }
    return null;
  }, [location, gf]);

  // Estilo del boundary teal (mismo que en BovineMapView para coherencia).
  const style = { color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 0.15, weight: 2 };

  // Texto del tooltip: nombre + ocupancia.
  const occupancyText = useMemo(() => {
    const cap = location.capacity;
    if (!cap || !cap.maxAnimals) return 'Sin capacidad configurada';
    const pct = Math.round((cap.currentAnimals / cap.maxAnimals) * 100);
    return `${cap.currentAnimals}/${cap.maxAnimals} bovinos (${pct}% ocupado)`;
  }, [location.capacity]);

  // Pin con click + tooltip — el área está sin handlers para no robar el click.
  const pinHandlers = { click: () => onClick(location.id) };

  return (
    <>
      {/* AREA — boundary del potrero */}
      {gf?.type === 'POLYGON' && gf.coordinates && gf.coordinates.length >= 3 && (
        <Polygon
          positions={gf.coordinates.map((c) => [c.latitude, c.longitude]) as [number, number][]}
          pathOptions={style}
        />
      )}
      {gf?.type === 'RECTANGULAR' && gf.boundingBox && (
        <Rectangle
          bounds={[
            [gf.boundingBox.south, gf.boundingBox.west],
            [gf.boundingBox.north, gf.boundingBox.east],
          ]}
          pathOptions={style}
        />
      )}
      {gf?.type === 'CIRCULAR' && gf.center && gf.radius && (
        <Circle
          center={[gf.center.latitude, gf.center.longitude]}
          radius={gf.radius}
          pathOptions={style}
        />
      )}

      {/* PIN central — hover muestra nombre + ocupancia, click navega. */}
      {center && (
        <Marker position={center} eventHandlers={pinHandlers}>
          <Tooltip direction="top" offset={[0, -10]} opacity={0.95} sticky>
            <div className="text-xs leading-tight">
              <p className="font-semibold text-gray-900">{location.name}</p>
              <p className="text-[11px] text-gray-600 mt-0.5">{location.type}</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">{occupancyText}</p>
              <p className="text-[10px] text-gray-400 italic mt-0.5">Click para ver detalle</p>
            </div>
          </Tooltip>
        </Marker>
      )}
    </>
  );
}

/** Hace fit a todos los pins de las locations en el primer render. */
function FitLocationsBounds({ locations }: { locations: Location[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || locations.length === 0) return;
    const points = locations
      .filter((l) => l.coordinates?.latitude && l.coordinates?.longitude)
      .map((l) => [l.coordinates!.latitude, l.coordinates!.longitude] as [number, number]);
    if (points.length === 0) return;
    try {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      fitted.current = true;
    } catch {
      /* swallow */
    }
  }, [locations, map]);
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// HeatmapLayerMap — "Indicador visual de salud del hato"
//
// DIFERENTE del heatmap clásico de densidad. Aquí:
//   • Los bovinos sanos aportan score POSITIVO (+1).
//   • Los enfermos / cuarentena / muertos aportan score NEGATIVO (-0.7 a -1).
//   • Se agrupan en celdas espaciales (~500m).
//   • El color por celda refleja el SCORE PROMEDIO del rebaño en esa zona.
//
// Resultado:
//   • Rancho 100% sano → manchas VERDES (no rojas por densidad).
//   • Rancho con brote → manchas ROJAS solo donde están los enfermos.
//   • Rancho mixto → tonos amarillos / naranja.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Resolución del grid de agregación. Más pequeño = más celdas (más detalle,
 * más cómputo). 0.005° ≈ 500m al ecuador — razonable para un rancho.
 */
const HERD_HEALTH_CELL_SIZE = 0.005;

interface HerdHealthCell {
  /** Centro promedio (promedio de lat/lng de los bovinos dentro). */
  lat: number;
  lng: number;
  /** Cuántos bovinos están dentro de esta celda. */
  count: number;
  /** Score agregado en [-1, +1]. */
  score: number;
}

/**
 * Agrupa los puntos en celdas de tamaño `HERD_HEALTH_CELL_SIZE` (lat × lng)
 * y devuelve por celda: centro, count, y score agregado de salud.
 */
function aggregateHerdHealthCells(points: HeatmapPoint[]): HerdHealthCell[] {
  const cells = new Map<string, { latSum: number; lngSum: number; statuses: string[] }>();

  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    // Cuantiza la lat/lng a celdas.
    const cellLat = Math.floor(p.lat / HERD_HEALTH_CELL_SIZE) * HERD_HEALTH_CELL_SIZE;
    const cellLng = Math.floor(p.lng / HERD_HEALTH_CELL_SIZE) * HERD_HEALTH_CELL_SIZE;
    const key = `${cellLat.toFixed(4)},${cellLng.toFixed(4)}`;

    const cell = cells.get(key) ?? { latSum: 0, lngSum: 0, statuses: [] };
    cell.latSum += p.lat;
    cell.lngSum += p.lng;
    cell.statuses.push(((p as any).healthStatus as string) ?? 'UNKNOWN');
    cells.set(key, cell);
  }

  const result: HerdHealthCell[] = [];
  for (const cell of cells.values()) {
    const count = cell.statuses.length;
    if (count === 0) continue;
    const score = computeHerdHealthScore(cell.statuses.map((s) => ({ healthStatus: s })));
    result.push({
      lat:   cell.latSum / count,
      lng:   cell.lngSum / count,
      count,
      score,
    });
  }
  return result;
}

/**
 * Radio del círculo en metros, escalado por count. Limita el radio para
 * que celdas con muchos bovinos no tapen el resto del mapa.
 */
function radiusForCount(count: number): number {
  // 1 bovino → 80m, 10 → ~180m, 50 → ~280m, ≥200 → 400m (capped).
  return Math.min(80 + Math.sqrt(count) * 30, 400);
}

function HeatmapLayerMap({
  points, locations, center,
}: {
  points: HeatmapPoint[] | undefined;
  locations: Location[];
  center: [number, number];
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 h-[600px] w-full">
      <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Boundaries semi-transparentes de fondo — dan contexto del rancho. */}
        {locations.map((loc) => {
          const gf = loc.geofenceConfig;
          const style = { color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.05, weight: 1, dashArray: '4 4' };
          if (gf?.type === 'POLYGON' && gf.coordinates && gf.coordinates.length >= 3) {
            return (
              <Polygon
                key={`bg-${loc.id}`}
                positions={gf.coordinates.map((c) => [c.latitude, c.longitude]) as [number, number][]}
                pathOptions={style}
              />
            );
          }
          if (gf?.type === 'RECTANGULAR' && gf.boundingBox) {
            return (
              <Rectangle
                key={`bg-${loc.id}`}
                bounds={[
                  [gf.boundingBox.south, gf.boundingBox.west],
                  [gf.boundingBox.north, gf.boundingBox.east],
                ]}
                pathOptions={style}
              />
            );
          }
          if (gf?.type === 'CIRCULAR' && gf.center && gf.radius) {
            return (
              <Circle
                key={`bg-${loc.id}`}
                center={[gf.center.latitude, gf.center.longitude]}
                radius={gf.radius}
                pathOptions={style}
              />
            );
          }
          return null;
        })}

        {/* Capa principal: indicador visual de salud por celda. */}
        <HerdHealthLayer points={points ?? []} />

        <FitLocationsBounds locations={locations} />
      </MapContainer>
    </div>
  );
}

// ─── Constantes del heatmap (Mejora A+B+C+D) ──────────────────────────────────
//
// Diseñado para que ZONAS CON POCOS BOVINOS sean claramente visibles incluso
// a zoom medio/bajo. Cambios respecto a la versión anterior:
//   • minOpacity: 0.35 → ningún blob queda transparente.
//   • Pesos +30-50% → un solo bovino ya alcanza colores visibles.
//   • Gradient stops desde 0.1 → primer 10% de intensidad ya pinta amarillo/verde.
//   • Radius/blur dinámicos por zoom → blobs grandes al alejar, finos al acercar.

/**
 * Pesos por estado de salud para la capa RIESGO (cálido).
 * Subidos respecto a la versión anterior para que pocos bovinos enfermos
 * en una zona ya generen una mancha visible (antes: 0.6/0.85/1.0).
 */
const HEATMAP_RISK_WEIGHT: Record<string, number> = {
  SICK:       0.8,
  QUARANTINE: 1.0,
  DECEASED:   1.2,  // crítico — supera el max para teñir rojo intenso al instante
};

/**
 * Pesos por estado de salud para la capa SALUD (frío).
 * Subidos para que ranchos pequeños 100% sanos muestren manchas verdes
 * sin necesidad de gran densidad (antes: 0.5/0.3).
 */
const HEATMAP_HEALTHY_WEIGHT: Record<string, number> = {
  HEALTHY:    0.7,
  RECOVERING: 0.5,
};

/**
 * Radio del kernel gaussiano (en píxeles) según el zoom de Leaflet.
 *
 * Por qué dinámico: leaflet.heat interpreta `radius` en PÍXELES DE PANTALLA,
 * no en metros. Sin compensar, un radius fijo de 50px se ve enorme cerca
 * (zoom 16 ≈ 100m de terreno) y diminuto lejos (zoom 8 ≈ 80km de terreno).
 * Escalando inversamente al zoom, las manchas mantienen presencia visual
 * coherente en todos los niveles.
 */
function heatmapRadiusForZoom(zoom: number): number {
  if (zoom <= 8)  return 80;   // vista regional: blobs grandes
  if (zoom <= 10) return 70;
  if (zoom <= 12) return 60;   // vista del rancho
  if (zoom <= 14) return 50;
  return 40;                    // vista de potrero: blobs precisos
}

/**
 * Blur (suavizado del borde) proporcional al radius. Mantenemos blur/radius
 * en ~0.7 para que los blobs tengan un halo difuminado coherente.
 */
function heatmapBlurForZoom(zoom: number): number {
  return Math.round(heatmapRadiusForZoom(zoom) * 0.7);
}

/**
 * Renderiza la capa de salud usando DOS heatmaps de `leaflet.heat`
 * superpuestos — uno para riesgo (cálido), otro para salud (frío).
 *
 * Beneficios sobre el render por celdas (circles):
 *   • Look continuo y suave estilo "blobs glowing" (como Google Heatmap).
 *   • Sin bordes duros — los blobs se difuminan y se mezclan naturalmente.
 *   • Donde hay sanos: verde. Donde hay enfermos: rojo. Donde hay mezcla:
 *     el alpha blending de Leaflet crea automáticamente tonos intermedios
 *     (amarillos/naranjas) sin necesidad de calcularlos.
 *
 * Reactividad al zoom (Mejora B):
 *   La capa se RE-CREA al hacer zoom para que `radius`/`blur` se ajusten
 *   al nuevo nivel. Sin esta lógica, los blobs se "encogen" relativo al
 *   terreno al alejar el mapa.
 *
 * Tooltips: leaflet.heat NO soporta tooltips por punto (es una capa
 * continua de píxels). El tooltip-per-zone vive en el sidebar (score global).
 */
function HerdHealthLayer({ points }: { points: HeatmapPoint[] }) {
  const map = useMap();
  const sickLayerRef    = useRef<L.Layer | null>(null);
  const healthyLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    // ── Función reutilizable que limpia y recrea ambas capas ──────────────
    // Se llama al mount inicial Y en cada cambio de zoom (re-render).
    const buildLayers = () => {
      // Cleanup capas previas
      if (sickLayerRef.current) {
        map.removeLayer(sickLayerRef.current);
        sickLayerRef.current = null;
      }
      if (healthyLayerRef.current) {
        map.removeLayer(healthyLayerRef.current);
        healthyLayerRef.current = null;
      }

      if (points.length === 0) return;

      const zoom   = map.getZoom();
      const radius = heatmapRadiusForZoom(zoom);
      const blur   = heatmapBlurForZoom(zoom);

      // ── Capa RIESGO: gradiente amarillo → naranja → rojo ────────────────
      const sickPoints = points
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => {
          const status = String((p as any).healthStatus ?? '').toUpperCase();
          const w = HEATMAP_RISK_WEIGHT[status] ?? 0;
          return [p.lat, p.lng, w] as [number, number, number];
        })
        .filter(([, , w]) => w > 0);

      if (sickPoints.length > 0) {
        const layer = (L as any).heatLayer(sickPoints, {
          radius,
          blur,
          maxZoom: 17,
          // max bajado de 1.5 → 1.0: satura más rápido para que pocos
          // bovinos críticos ya destaquen visualmente.
          max: 1.0,
          // minOpacity (Mejora A): NINGÚN píxel con calor queda transparente.
          // Antes (default 0.05) los bovinos aislados eran casi invisibles.
          minOpacity: 0.35,
          // Stops desde 0.1 (Mejora D): el primer 10% de intensidad YA
          // pinta amarillo visible. Antes empezaba en 0.2 → tramo "muerto"
          // de 0-20% donde no se veía nada.
          gradient: {
            0.1:  '#fde047',  // amarillo claro — visible desde el primer pico
            0.3:  '#facc15',  // amarillo
            0.55: '#f97316',  // naranja
            0.8:  '#ef4444',  // rojo
            1.0:  '#991b1b',  // rojo intenso
          },
        });
        layer.addTo(map);
        sickLayerRef.current = layer;
      }

      // ── Capa SALUD: gradiente azul → verde → verde intenso ──────────────
      const healthyPoints = points
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => {
          const status = String((p as any).healthStatus ?? '').toUpperCase();
          const w = HEATMAP_HEALTHY_WEIGHT[status] ?? 0;
          return [p.lat, p.lng, w] as [number, number, number];
        })
        .filter(([, , w]) => w > 0);

      if (healthyPoints.length > 0) {
        const layer = (L as any).heatLayer(healthyPoints, {
          radius,
          blur,
          maxZoom: 17,
          max: 1.0,
          minOpacity: 0.35,
          gradient: {
            0.1:  '#93c5fd',  // azul claro — visible desde el primer pico
            0.3:  '#3b82f6',  // azul
            0.55: '#22c55e',  // verde
            0.8:  '#16a34a',  // verde intenso
            1.0:  '#15803d',  // verde oscuro
          },
        });
        layer.addTo(map);
        healthyLayerRef.current = layer;
      }
    };

    // ── Mount inicial ─────────────────────────────────────────────────────
    buildLayers();

    // ── Re-render al cambiar zoom (Mejora B), con throttle ────────────────
    //
    // `zoomend` puede dispararse en ráfaga (especialmente con pinch en
    // mobile). Un throttle de 200ms evita re-crear las capas 10 veces
    // por segundo.
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const onZoomEnd = () => {
      if (throttleTimer) clearTimeout(throttleTimer);
      throttleTimer = setTimeout(buildLayers, 200);
    };
    map.on('zoomend', onZoomEnd);

    // ── Cleanup al desmontar ──────────────────────────────────────────────
    return () => {
      map.off('zoomend', onZoomEnd);
      if (throttleTimer) clearTimeout(throttleTimer);
      if (sickLayerRef.current) {
        map.removeLayer(sickLayerRef.current);
        sickLayerRef.current = null;
      }
      if (healthyLayerRef.current) {
        map.removeLayer(healthyLayerRef.current);
        healthyLayerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// EpidemiologyLayerMap — bovinos con caso clínico abierto.
//
// Renderiza CircleMarkers solo para los bovinos cuyo id aparece en
// `openCases`. El color refleja el peor status entre sus casos abiertos
// (STATUS_PRIORITY): rojo CONFIRMED > azul RECOVERING > gris SUSPECTED.
//
// Tooltip muestra: arete, enfermedad(es) activa(s), severidad y fecha
// del diagnóstico más reciente. Click → navega al detalle del caso
// más reciente (el más informativo para empezar la investigación).
//
// Boundaries de las locations se pintan como fondo gris tenue para
// orientar al lector geográficamente.
// ════════════════════════════════════════════════════════════════════════════

interface EpidemiologyLayerMapProps {
  openCases: BovineCaseListItem[];
  markers: import('@/types/bovine.dtos').BovineMapMarkersResponse | undefined;
  locations: Location[];
  center: [number, number];
  /** Callback con el caseId más reciente del bovino clickeado. */
  onMarkerClick: (caseId: string) => void;
}

function EpidemiologyLayerMap({
  openCases, markers, locations, center, onMarkerClick,
}: EpidemiologyLayerMapProps) {
  // Index: bovineId → array de casos abiertos (ordenados por diagnóstico desc).
  const casesByBovine = useMemo(() => {
    const map = new Map<string, BovineCaseListItem[]>();
    for (const c of openCases) {
      const arr = map.get(c.bovineId) ?? [];
      arr.push(c);
      map.set(c.bovineId, arr);
    }
    // Orden: caso más reciente primero (el "principal" para el tooltip/link).
    for (const arr of map.values()) {
      arr.sort((a, b) => +new Date(b.diagnosedAt) - +new Date(a.diagnosedAt));
    }
    return map;
  }, [openCases]);

  // Tomamos solo markers en modo 'markers' — clusters no tienen bovineId
  // individual y la página avisa al usuario en la leyenda.
  const individualMarkers = markers?.mode === 'markers' ? markers.items : [];
  const sickMarkers = individualMarkers.filter((m) => casesByBovine.has(m.bovineId));

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 h-[600px] w-full">
      <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Boundaries tenues como referencia geográfica del rancho. */}
        {locations.map((loc) => {
          const gf = loc.geofenceConfig;
          const style = { color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.04, weight: 1, dashArray: '4 4' };
          if (gf?.type === 'POLYGON' && gf.coordinates && gf.coordinates.length >= 3) {
            return (
              <Polygon
                key={`bg-${loc.id}`}
                positions={gf.coordinates.map((c) => [c.latitude, c.longitude]) as [number, number][]}
                pathOptions={style}
              />
            );
          }
          if (gf?.type === 'RECTANGULAR' && gf.boundingBox) {
            return (
              <Rectangle
                key={`bg-${loc.id}`}
                bounds={[
                  [gf.boundingBox.south, gf.boundingBox.west],
                  [gf.boundingBox.north, gf.boundingBox.east],
                ]}
                pathOptions={style}
              />
            );
          }
          if (gf?.type === 'CIRCULAR' && gf.center && gf.radius) {
            return (
              <Circle
                key={`bg-${loc.id}`}
                center={[gf.center.latitude, gf.center.longitude]}
                radius={gf.radius}
                pathOptions={style}
              />
            );
          }
          return null;
        })}

        {/* CircleMarkers por bovino afectado. */}
        {sickMarkers.map((m) => {
          const cases = casesByBovine.get(m.bovineId)!;
          // Peor status (mayor prioridad) define color del marker.
          const worst = cases.reduce((acc, c) =>
            STATUS_PRIORITY[c.status] > STATUS_PRIORITY[acc.status] ? c : acc,
          cases[0]);
          const color = getCaseStatusColor(worst.status);
          const principal = cases[0]; // el más reciente

          return (
            <CircleMarker
              key={m.bovineId}
              center={[m.lat, m.lng]}
              radius={9}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: color,
                fillOpacity: 0.9,
              }}
              eventHandlers={{ click: () => onMarkerClick(principal.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95} sticky>
                <div className="text-xs leading-tight max-w-[220px]">
                  <p className="font-semibold text-gray-900">
                    {m.earTag}
                    {m.name && <span className="font-normal text-gray-600"> · {m.name}</span>}
                  </p>
                  <p
                    className="text-[11px] font-medium mt-0.5"
                    style={{ color }}
                  >
                    {getCaseStatusLabel(worst.status)} · {getCaseSeverityLabel(worst.severity)}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {cases.slice(0, 3).map((c) => (
                      <li key={c.id} className="text-[11px] text-gray-700">
                        • {c.disease.name}
                      </li>
                    ))}
                    {cases.length > 3 && (
                      <li className="text-[11px] text-gray-400 italic">
                        +{cases.length - 3} más
                      </li>
                    )}
                  </ul>
                  <p className="text-[10px] text-gray-400 italic mt-1">
                    Click para abrir el caso más reciente
                  </p>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Mensaje cuando no hay nada que pintar (rancho con casos abiertos
            pero ningún bovino con geo conocido). Lo mostramos como overlay
            usando un Tooltip de Leaflet sería raro — mejor confiar en el
            empty state de la leyenda lateral. Aquí simplemente no se pintan
            markers y el mapa queda con las boundaries de fondo. */}

        <FitLocationsBounds locations={locations} />
      </MapContainer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EpiHeatmapLayerMap — heatmap de enfermedad epidemiológico (NEW-2).
//
// Usa datos de GET /api/epidemiology/heatmap que devuelven celdas con
// `lat`, `lng`, `weight` (0..1) y `activeCases`. Reutiliza leaflet.heat
// con gradiente cálido (mayor peso = más casos activos).
// ════════════════════════════════════════════════════════════════════════════

interface EpiHeatmapLayerMapProps {
  cells: EpidemiologyHeatmapCell[];
  locations: Location[];
  center: [number, number];
}

function EpiHeatmapLayerMap({ cells, locations, center }: EpiHeatmapLayerMapProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 h-[600px] w-full">
      <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((loc) => (
          <LocationMapItem key={loc.id} location={loc} onClick={() => {}} />
        ))}
        <EpiHeatLayer cells={cells} />
        <FitLocationsBounds locations={locations} />
      </MapContainer>
    </div>
  );
}

function EpiHeatLayer({ cells }: { cells: EpidemiologyHeatmapCell[] }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (cells.length === 0) return;

    const points = cells
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
      .map((c) => [c.lat, c.lng, c.weight] as [number, number, number]);

    if (points.length === 0) return;

    const layer = (L as any).heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 17,
      max: 1.0,
      minOpacity: 0.4,
      gradient: {
        0.1: '#fde047',
        0.35: '#f97316',
        0.65: '#ef4444',
        1.0:  '#7f1d1d',
      },
    });
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, cells]);

  return null;
}
