/**
 * BovineMapView — geographic view of bovines.
 *
 * Consumes `useBovineMapMarkers`, which returns a discriminated union:
 *   - mode: 'markers'  → individual `CircleMarker`s (zoom alto, count bajo)
 *   - mode: 'clusters' → cluster bubbles (zoom bajo, count alto)
 *
 * Backend decides the mode based on count and zoom; frontend just renders.
 *
 * Filters (ranchIds, healthStatus, breeds, ageRange, locationId, etc.) flow in
 * via the parent (BovinesListPage), which holds them in URL params. This
 * component is purely presentational + data-fetching.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Polygon,
  Rectangle,
  Circle,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';

import { Spinner } from '@/components/ui/Spinner';
import { useBovineMapMarkers } from '@/hooks/useBovines';
import { locationsApi } from '@/api/locations.api';
import type { Location } from '@/types';
import type {
  MapMarkersFilters,
  MapMarkersOptions,
  BovineMapMarkerResponse,
  BovineMapClusterResponse,
} from '@/types/bovine.dtos';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '@/utils/constants';
import { Beef, MapPin, HelpCircle } from 'lucide-react';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface BovineMapViewProps {
  /** Filters to apply (ranchIds, healthStatus, breeds, etc.). */
  filters: MapMarkersFilters;
  /** Optional initial center; if absent, defaults to MAP_DEFAULT_CENTER. */
  initialCenter?: { lat: number; lng: number };
  /** Optional initial zoom. */
  initialZoom?: number;
  /** Click handler for individual markers — typically navigates to detail. */
  onMarkerClick?: (bovineId: string) => void;
  /** Optional className for the map container. */
  className?: string;
}

// ─── Bounds tracker ─────────────────────────────────────────────────────────
// React-Leaflet exposes `useMapEvents` for hooks-style access. We capture the
// current viewport bounds + zoom on `moveend`, debounce 500ms, then notify
// the parent so it can refetch.

interface ViewportSnapshot {
  bbox: { north: number; south: number; east: number; west: number };
  zoom: number;
}

function ViewportTracker({
  onChange,
  debounceMs = 500,
}: {
  onChange: (snap: ViewportSnapshot) => void;
  debounceMs?: number;
}) {
  const map = useMap();
  const timer = useRef<number | null>(null);

  // Initial snapshot on mount
  useEffect(() => {
    const b = map.getBounds();
    onChange({
      bbox: {
        north: b.getNorth(),
        south: b.getSouth(),
        east:  b.getEast(),
        west:  b.getWest(),
      },
      zoom: map.getZoom(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapEvents({
    moveend() {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const b = map.getBounds();
        onChange({
          bbox: {
            north: b.getNorth(),
            south: b.getSouth(),
            east:  b.getEast(),
            west:  b.getWest(),
          },
          zoom: map.getZoom(),
        });
      }, debounceMs);
    },
  });

  return null;
}

// ─── Marker icon helpers ────────────────────────────────────────────────────
// Color comes from the DTO's `color` field (backend-derived).
// We render Leaflet `CircleMarker` directly — no need for raster icons.

function getMarkerStyle(color: string) {
  return {
    color: '#ffffff',          // border
    fillColor: color,
    fillOpacity: 0.9,
    weight: 2,
  };
}

function getClusterIcon(count: number, color: string) {
  const size = count < 10 ? 36 : count < 50 ? 44 : count < 200 ? 52 : 60;
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px; height:${size}px;
        display:flex; align-items:center; justify-content:center;
        border-radius:50%;
        background:${color};
        color:#fff;
        font-weight:700;
        font-size:${count < 10 ? 14 : count < 100 ? 13 : 12}px;
        border:3px solid rgba(255,255,255,0.85);
        box-shadow:0 3px 10px rgba(0,0,0,.35);
      ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── Component ─────────────────────────────────────────────────────────────

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Zoom umbral: a partir de este nivel los clusters por potrero se "explotan"
 * y se renderizan los markers individuales + el boundary del potrero.
 * 15 ≈ ver un solo potrero en pantalla (ajustable).
 */
const EXPLODE_ZOOM = 15;

/**
 * Tope de markers individuales antes de que el backend agrupe en clusters
 * server-side (Opción A — bajado de 5000 a 100). Con esto, en zoom-out se
 * obtienen burbujas-por-grid del backend cuando hay muchos bovinos; con
 * pocos, llegan markers que el cliente agrupará por potrero localmente.
 */
const MAX_MARKERS = 100;

export function BovineMapView({
  filters,
  initialCenter,
  initialZoom = MAP_DEFAULT_ZOOM,
  onMarkerClick,
  className = 'h-[600px] w-full',
}: BovineMapViewProps) {
  const [viewport, setViewport] = useState<ViewportSnapshot | null>(null);

  const mapOptions: MapMarkersOptions | undefined = useMemo(() => {
    if (!viewport) return undefined;
    return {
      bbox: viewport.bbox,
      zoom: viewport.zoom,
      maxMarkers: MAX_MARKERS,
    };
  }, [viewport]);

  // Only fetch when we have at least one ranch context AND a viewport.
  // Without ranchIds the backend may refuse or return too much data.
  const enabled = !!viewport && (
    !filters.ranchIds ||
    filters.ranchIds === null ||
    filters.ranchIds.length > 0
  );

  const { data, isFetching, isError } = useBovineMapMarkers(filters, mapOptions, { enabled });

  // ── Locations del rancho activo ──────────────────────────────────────────
  // Las potreros se cachean 5 minutos — su geometría rara vez cambia, así
  // que pedirlas en cada pan/zoom sería desperdicio.
  const ranchIdForLocations = filters.ranchIds?.[0] ?? null;
  const { data: locationsRes } = useQuery({
    queryKey: ['locations-for-bovine-map', ranchIdForLocations],
    queryFn: () => locationsApi.list({ ranchId: ranchIdForLocations!, limit: 100 }),
    enabled: !!ranchIdForLocations,
    staleTime: 5 * 60 * 1000,
  });
  const locations: Location[] = locationsRes?.items ?? [];

  // ── Agrupación por location (solo cuando data.mode === 'markers') ────────
  // Cada bovino entrega su `locationId` (currentLocationId de la BD). Los
  // que no tienen potrero asignado caen en el grupo 'orphans'.
  const markersByLocation = useMemo(() => {
    if (data?.mode !== 'markers') return null;
    const groups = new Map<string, BovineMapMarkerResponse[]>();
    const orphans: BovineMapMarkerResponse[] = [];
    for (const m of data.items) {
      if (m.locationId) {
        const arr = groups.get(m.locationId) ?? [];
        arr.push(m);
        groups.set(m.locationId, arr);
      } else {
        orphans.push(m);
      }
    }
    return { groups, orphans };
  }, [data]);

  // ── Modo de render ──────────────────────────────────────────────────────
  // 1) Si hay filtro de locationId → mostrar SOLO ese potrero (boundary +
  //    markers individuales), sin clusters de otros.
  // 2) Si zoom >= EXPLODE_ZOOM → boundaries + markers individuales.
  // 3) Si zoom <  EXPLODE_ZOOM → burbujas-por-potrero con count.
  const currentZoom = viewport?.zoom ?? initialZoom;
  const hasLocationFilter = !!filters.locationId;
  const showAsBubbles = !hasLocationFilter && currentZoom < EXPLODE_ZOOM;

  // Locations visibles (las que tienen al menos 1 bovino del grupo o son
  // el filtro activo). Si no hay markers todavía, mostramos todas como hint.
  const visibleLocations = useMemo(() => {
    if (!markersByLocation) return [];
    if (hasLocationFilter) {
      // Solo el potrero del filtro.
      return locations.filter((l) => l.id === filters.locationId);
    }
    // Potreros que tienen al menos un bovino en el dataset actual.
    return locations.filter((l) => markersByLocation.groups.has(l.id));
  }, [locations, markersByLocation, hasLocationFilter, filters.locationId]);

  const center: [number, number] = initialCenter
    ? [initialCenter.lat, initialCenter.lng]
    : [MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng];

  return (
    <div className={`relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 ${className}`}>
      <MapContainer
        center={center}
        zoom={initialZoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ViewportTracker onChange={setViewport} />

        {/* ─────────────────────────────────────────────────────────────────
            MODO "MARKERS" — agrupación client-side por potrero.

            Dos sub-modos según el zoom / filtro:
              A) Burbujas-por-potrero  (zoom < EXPLODE_ZOOM y sin filtro)
                 - Una <LocationBubble> por cada potrero con count.
                 - Bovinos huérfanos (sin locationId) → markers individuales
                   en gris con etiqueta "Sin potrero asignado".
              B) Boundary + puntos     (zoom >= EXPLODE_ZOOM o filtro activo)
                 - <LocationBoundary> para cada potrero visible.
                 - <BovineMarker> individual por cada bovino con su color
                   real (HEALTH_COLORS) — el filtro no altera los colores.
            ─────────────────────────────────────────────────────────────────*/}
        {data?.mode === 'markers' && markersByLocation && showAsBubbles && (
          <>
            {/* A.1 — Burbujas por potrero */}
            {visibleLocations.map((loc) => {
              const bovines = markersByLocation.groups.get(loc.id) ?? [];
              if (bovines.length === 0) return null;
              return (
                <LocationBubble
                  key={loc.id}
                  location={loc}
                  bovines={bovines}
                />
              );
            })}

            {/* A.2 — Bovinos huérfanos (sin potrero asignado) — markers
                individuales con su color real, marcados claramente. */}
            {markersByLocation.orphans.map((m) => (
              <OrphanBovineMarker
                key={m.bovineId}
                bovine={m}
                onClick={onMarkerClick}
              />
            ))}
          </>
        )}

        {data?.mode === 'markers' && markersByLocation && !showAsBubbles && (
          <>
            {/* B.1 — Boundaries de los potreros visibles */}
            {visibleLocations.map((loc) => (
              <LocationBoundary key={`b-${loc.id}`} location={loc} />
            ))}

            {/* B.2 — Markers individuales (todos: con o sin potrero) */}
            {[
              ...Array.from(markersByLocation.groups.values()).flat(),
              ...markersByLocation.orphans,
            ].map((m) => (
              <BovineMarker
                key={m.bovineId}
                bovine={m}
                onClick={onMarkerClick}
                isOrphan={!m.locationId}
              />
            ))}
          </>
        )}

        {/* Clusters mode — aggregated bubbles */}
        {data?.mode === 'clusters' && data.items.map((c: BovineMapClusterResponse, i) => (
          <ClusterBubble
            key={`${c.lat},${c.lng},${i}`}
            cluster={c}
          />
        ))}
      </MapContainer>

      {/* Top-right info badge — count + mode */}
      <div className="absolute top-2 right-2 z-[400] flex items-center gap-2">
        {isFetching && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 shadow-sm text-xs text-gray-600 dark:text-gray-400">
            <Spinner size="sm" />
            Actualizando…
          </div>
        )}
        {data && (
          <div className="px-2.5 py-1 rounded-md bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 shadow-sm text-xs flex items-center gap-1.5">
            <Beef className="w-3.5 h-3.5 text-primary-600" />
            <span className="font-semibold text-gray-900 dark:text-white">{data.total.toLocaleString()}</span>
            <span className="text-gray-500">
              {data.mode === 'clusters' ? 'agrupados' : 'visibles'}
            </span>
          </div>
        )}
        {/* Badge de bovinos huérfanos (sin potrero) — solo cuando los hay.
            Hace al usuario consciente de que hay animales sin asignar. */}
        {markersByLocation && markersByLocation.orphans.length > 0 && (
          <div
            className="px-2.5 py-1 rounded-md bg-amber-50/95 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 shadow-sm text-xs flex items-center gap-1.5 text-amber-800 dark:text-amber-300"
            title="Bovinos sin potrero asignado (marcados con borde punteado)"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="font-semibold">{markersByLocation.orphans.length}</span>
            <span>sin potrero</span>
          </div>
        )}
      </div>

      {/* Empty state overlay */}
      {data && data.total === 0 && !isFetching && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
          <div className="px-4 py-3 rounded-lg bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-md flex flex-col items-center gap-1 max-w-xs text-center pointer-events-auto">
            <MapPin className="w-6 h-6 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No hay bovinos en esta área con los filtros aplicados.
            </p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {isError && (
        <div className="absolute top-2 left-2 z-[400] px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400 shadow-sm">
          Error al cargar bovinos. Intenta acercar el zoom o ajustar los filtros.
        </div>
      )}
    </div>
  );
}

// ─── Cluster bubble (Marker with custom HTML icon) ──────────────────────────
// Using `Marker` would conflict with our default icon setup elsewhere; we use
// `CircleMarker` for the hit area + a `divIcon` overlay via Leaflet's marker.
// Simpler: render a `CircleMarker` + Popup with the count.

function ClusterBubble({ cluster }: { cluster: BovineMapClusterResponse }) {
  const map = useMap();
  // Use a normal Leaflet marker via imperative API only when needed.
  // For simplicity, use a CircleMarker scaled by count, with a popup.
  const radius = cluster.count < 10 ? 14 : cluster.count < 50 ? 18 : cluster.count < 200 ? 22 : 28;

  return (
    <CircleMarker
      center={[cluster.lat, cluster.lng]}
      radius={radius}
      pathOptions={{
        color: '#ffffff',
        fillColor: cluster.dominantColor,
        fillOpacity: 0.85,
        weight: 3,
      }}
      eventHandlers={{
        click: () => {
          // Zoom into cluster on click to drill down. Backend will switch to
          // markers mode automatically once count fits.
          map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 16), {
            animate: true,
          });
        },
      }}
    >
      <Popup>
        <div className="text-xs text-center">
          <p className="font-semibold">{cluster.count} bovinos</p>
          <p className="text-gray-500">Click para acercar</p>
        </div>
      </Popup>
    </CircleMarker>
  );
}

// ─── BovineMarker — punto individual (con potrero o huérfano) ────────────────
// Mantiene el color real del bovino (HEALTH_COLORS server-side) sin
// importar si está o no en un potrero — la "orfandad" se comunica con un
// borde punteado y un label en el tooltip, NO cambiando el color de salud.

function BovineMarker({
  bovine, onClick, isOrphan,
}: {
  bovine: BovineMapMarkerResponse;
  onClick?: (id: string) => void;
  isOrphan?: boolean;
}) {
  const displayName = bovine.name || bovine.earTag || 'Sin identificar';
  return (
    <CircleMarker
      center={[bovine.lat, bovine.lng]}
      radius={7}
      pathOptions={{
        // El COLOR del fill es siempre el de salud (no se altera al ser huérfano).
        color: isOrphan ? '#9ca3af' : '#ffffff',
        fillColor: bovine.color,
        fillOpacity: 0.9,
        weight: isOrphan ? 2 : 2,
        dashArray: isOrphan ? '2 3' : undefined, // borde punteado = huérfano
      }}
      eventHandlers={{ click: () => onClick?.(bovine.bovineId) }}
    >
      <Tooltip direction="top" offset={[0, -6]} opacity={0.95} sticky>
        <div className="text-xs leading-tight">
          <p className="font-semibold text-gray-900">{displayName}</p>
          {bovine.name && bovine.earTag && (
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{bovine.earTag}</p>
          )}
          {isOrphan && (
            <p className="text-[10px] text-amber-700 mt-0.5 italic">Sin potrero asignado</p>
          )}
        </div>
      </Tooltip>
      <Popup>
        <div className="text-xs">
          <p className="font-semibold mb-0.5">{displayName}</p>
          {bovine.name && bovine.earTag && (
            <p className="font-mono text-[11px] text-gray-500 mb-1">{bovine.earTag}</p>
          )}
          <p className="text-gray-600">
            {bovine.healthStatus}
            {bovine.breed ? ` · ${bovine.breed}` : ''}
            {bovine.ageMonths != null ? ` · ${bovine.ageMonths} m` : ''}
          </p>
          {bovine.diagnosis && <p className="text-gray-500 italic mt-1">{bovine.diagnosis}</p>}
          {isOrphan && (
            <p className="text-amber-700 text-[11px] italic mt-1.5">
              ⚠ Este bovino no tiene un potrero asignado actualmente.
            </p>
          )}
          {onClick && (
            <button
              type="button"
              onClick={() => onClick(bovine.bovineId)}
              className="mt-1.5 text-primary-600 dark:text-primary-400 hover:underline"
            >
              Ver detalle →
            </button>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}

// ─── OrphanBovineMarker — alias semántico de BovineMarker(isOrphan=true) ─────
function OrphanBovineMarker({
  bovine, onClick,
}: {
  bovine: BovineMapMarkerResponse;
  onClick?: (id: string) => void;
}) {
  return <BovineMarker bovine={bovine} onClick={onClick} isOrphan />;
}

// ─── LocationBubble — burbuja con count, click hace fitBounds al potrero ─────
// Esta es la representación "agrupada" de un potrero en zoom-out: muestra el
// nombre del potrero + el count de bovinos. Al hacer click, el mapa se
// reencuadra al boundary del potrero (lo que típicamente lleva el zoom por
// encima de EXPLODE_ZOOM y dispara la transición a "boundary + puntos").

function LocationBubble({
  location, bovines,
}: {
  location: Location;
  bovines: BovineMapMarkerResponse[];
}) {
  const map = useMap();
  const count = bovines.length;

  // Centro del potrero: preferimos `coordinates`, si no usamos el centroide
  // del boundary, y como último recurso el promedio de los bovinos dentro.
  const center: [number, number] = useMemo(() => {
    if (location.coordinates?.latitude != null && location.coordinates?.longitude != null) {
      return [location.coordinates.latitude, location.coordinates.longitude];
    }
    const gf = location.geofenceConfig;
    if (gf?.type === 'CIRCULAR' && gf.center) {
      return [gf.center.latitude, gf.center.longitude];
    }
    if (gf?.type === 'POLYGON' && gf.coordinates?.length) {
      const cs = gf.coordinates;
      return [
        cs.reduce((s, c) => s + c.latitude, 0) / cs.length,
        cs.reduce((s, c) => s + c.longitude, 0) / cs.length,
      ];
    }
    // Fallback: centro promedio de los bovinos dentro.
    return [
      bovines.reduce((s, b) => s + b.lat, 0) / count,
      bovines.reduce((s, b) => s + b.lng, 0) / count,
    ];
  }, [location, bovines, count]);

  // Color predominante por estado de salud dentro del potrero.
  const dominantColor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bovines) counts.set(b.color, (counts.get(b.color) ?? 0) + 1);
    let best = '#22c55e';
    let max = 0;
    for (const [color, c] of counts) {
      if (c > max) { max = c; best = color; }
    }
    return best;
  }, [bovines]);

  // Si solo hay 1 bovino, mejor renderizar el marker individual directo
  // (una burbuja con "1" es confusa). El padre ya filtra esto, pero
  // mantenemos la guardia para reutilización futura.
  if (count === 1) {
    return <BovineMarker bovine={bovines[0]} />;
  }

  // Radio escalado por count (mismo escalado que ClusterBubble del backend).
  const radius = count < 10 ? 16 : count < 50 ? 20 : count < 200 ? 24 : 30;

  // Icono HTML con el número dentro — más legible que solo un círculo.
  const icon = L.divIcon({
    className: '',
    html: `
      <div style="
        width:${radius * 2}px; height:${radius * 2}px;
        display:flex; align-items:center; justify-content:center;
        border-radius:50%;
        background:${dominantColor};
        color:#fff;
        font-weight:700;
        font-size:${count < 10 ? 14 : count < 100 ? 13 : 12}px;
        border:3px solid rgba(255,255,255,0.9);
        box-shadow:0 3px 10px rgba(0,0,0,.35);
        cursor:pointer;
      ">${count}</div>`,
    iconSize: [radius * 2, radius * 2],
    iconAnchor: [radius, radius],
  });

  return (
    <Marker
      position={center}
      icon={icon}
      eventHandlers={{
        click: () => {
          // Hacer fit al boundary del potrero si existe; si no, zoom directo.
          const gf = location.geofenceConfig;
          if (gf?.type === 'POLYGON' && gf.coordinates?.length) {
            const bounds = L.latLngBounds(
              gf.coordinates.map((c) => [c.latitude, c.longitude] as [number, number]),
            );
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
          } else if (gf?.type === 'RECTANGULAR' && gf.boundingBox) {
            const bb = gf.boundingBox;
            map.fitBounds(
              [[bb.south, bb.west], [bb.north, bb.east]],
              { padding: [40, 40], maxZoom: 18 },
            );
          } else if (gf?.type === 'CIRCULAR' && gf.center && gf.radius) {
            // Aproximación: centramos y subimos a EXPLODE_ZOOM o más.
            map.setView([gf.center.latitude, gf.center.longitude],
              Math.max(map.getZoom(), EXPLODE_ZOOM + 1),
              { animate: true });
          } else {
            map.setView(center, Math.max(map.getZoom(), EXPLODE_ZOOM + 1),
              { animate: true });
          }
        },
      }}
    >
      <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
        <div className="text-xs leading-tight">
          <p className="font-semibold text-gray-900">{location.name}</p>
          <p className="text-[11px] text-gray-600">
            {count} bovino{count !== 1 ? 's' : ''}
          </p>
          <p className="text-[10px] text-gray-400 italic mt-0.5">Click para acercar</p>
        </div>
      </Tooltip>
    </Marker>
  );
}

// ─── LocationBoundary — pinta el shape del potrero en el mapa ────────────────
// Renderizado al hacer zoom-in (zoom >= EXPLODE_ZOOM) o cuando hay filtro de
// location activo. Color teal/verde-azulado para diferenciar del boundary
// del rancho (cuando se renderice junto). Soporta POLYGON / RECTANGULAR /
// CIRCULAR; CORRIDOR y missing → no se dibuja (skip silencioso).

function LocationBoundary({ location }: { location: Location }) {
  const gf = location.geofenceConfig;
  if (!gf?.type) return null;

  const style = {
    color: '#0d9488',       // teal-600
    fillColor: '#14b8a6',   // teal-500
    fillOpacity: 0.10,
    weight: 2,
    dashArray: '6 4',
  };

  if (gf.type === 'POLYGON' && gf.coordinates && gf.coordinates.length >= 3) {
    return (
      <Polygon
        positions={gf.coordinates.map((c) => [c.latitude, c.longitude]) as [number, number][]}
        pathOptions={style}
      >
        <Tooltip sticky direction="center" opacity={0.9}>
          <span className="text-xs font-medium">{location.name}</span>
        </Tooltip>
      </Polygon>
    );
  }
  if (gf.type === 'RECTANGULAR' && gf.boundingBox) {
    const bb = gf.boundingBox;
    return (
      <Rectangle
        bounds={[[bb.south, bb.west], [bb.north, bb.east]] as [[number, number], [number, number]]}
        pathOptions={style}
      >
        <Tooltip sticky direction="center" opacity={0.9}>
          <span className="text-xs font-medium">{location.name}</span>
        </Tooltip>
      </Rectangle>
    );
  }
  if (gf.type === 'CIRCULAR' && gf.center && gf.radius) {
    return (
      <Circle
        center={[gf.center.latitude, gf.center.longitude]}
        radius={gf.radius}
        pathOptions={style}
      >
        <Tooltip sticky direction="center" opacity={0.9}>
          <span className="text-xs font-medium">{location.name}</span>
        </Tooltip>
      </Circle>
    );
  }
  return null;
}
