import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Circle, Rectangle, Polygon, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { CardTitle } from '@/components/ui/Card';
import { cn } from '@/utils/cn';
import { MapPin, Circle as CircleIcon, Square, Trash2, AlertTriangle, Crosshair } from 'lucide-react';
import {
  checkGeofenceVsRanch, formatDistance, ZONE_STYLES,
  boundaryContainsPoint, boundaryAContainsBoundaryB, areaToRadiusMeters,
} from '@/utils/geoValidation';
import type { DistanceResult, BoundaryShape } from '@/utils/geoValidation';
import 'leaflet/dist/leaflet.css';

// ─── Ranch-center DivIcon (same as MapPicker) ────────────────────────────────

const ranchIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width:34px; height:34px;
      background:#f59e0b;
      border:3px solid #fff;
      border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
      font-size:16px; line-height:1;
    ">🏠</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// ─── Required-point pin (Phase 6) ────────────────────────────────────────────

const requiredPinIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width:30px; height:30px;
      background:#16a34a;
      border:3px solid #fff;
      border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
      font-size:14px; line-height:1;
    ">📍</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Component that imperatively recenters the map when key dependencies change.
function ReCenterOnPin({
  point,
  zoom,
}: {
  point: { latitude: number; longitude: number } | null | undefined;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    map.setView([point.latitude, point.longitude], zoom ?? 16, { animate: true });
    // run once when component mounts with a pin (parent passes `key` to remount when the pin changes if needed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type GeofenceType = 'CIRCULAR' | 'RECTANGULAR' | 'POLYGON' | 'CORRIDOR';

export interface GeofenceConfig {
  type: GeofenceType;
  center?: { latitude: number; longitude: number };
  radius?: number;
  boundingBox?: { north: number; south: number; east: number; west: number };
  coordinates?: { latitude: number; longitude: number }[];
  alertTriggers?: string[];
  isActive?: boolean;
  priority?: string;
}

interface GeofenceDrawerProps {
  value?: GeofenceConfig | null;
  onChange: (config: GeofenceConfig | null) => void;
  mapCenter?: { lat: number; lng: number };
  className?: string;
  /** Ranch center for Capa 1 (visual anchor) + Capa 2 (distance guard) */
  ranchCenter?: { latitude: number; longitude: number } | null;
  /** Km threshold for amber warning (default 25) */
  warnDistanceKm?: number;
  /** Km threshold for red block (default 60) */
  blockDistanceKm?: number;
  /** Ranch name for display */
  ranchName?: string;

  // ── Phase 6 — pin-aware drawing ─────────────────────────────────────────
  /**
   * Pin that the drawn geofence MUST contain. When set:
   *  - the map auto-centers on this point
   *  - a persistent marker renders this point
   *  - a hard validation runs: shape must contain the pin to be saved
   *  - quick-shape buttons appear (Circle 100/500/1000m centered on pin)
   */
  requiredPoint?: { latitude: number; longitude: number } | null;
  /** Label for the required-point marker (e.g. "Pin de la ubicación") */
  requiredPointLabel?: string;
  /**
   * Outer container boundary. When set, the drawn geofence must be FULLY inside.
   * Typical use: a child location's geofence must be inside the parent ranch boundary.
   */
  containerBoundary?: BoundaryShape | null;
  /** Label for the container in error messages (e.g. "perímetro del rancho \"X\"") */
  containerLabel?: string;
  /**
   * Optional area + unit. When provided, a quick "Rectangle from area" button
   * appears that creates a square of equivalent area centered on the pin.
   */
  areaForRectangle?: { area: number; unit: 'HA' | 'M2' | 'ACRE' } | null;
}

// ─── Options ─────────────────────────────────────────────────────────────────

const typeOptions = [
  { value: 'CIRCULAR',    label: 'Circular' },
  { value: 'RECTANGULAR', label: 'Rectangular' },
  { value: 'POLYGON',     label: 'Polígono' },
];

const alertOptions = [
  { value: 'ENTRY',               label: 'Entrada' },
  { value: 'EXIT',                label: 'Salida' },
  { value: 'BOTH',                label: 'Ambos' },
  { value: 'DWELL_TIME',          label: 'Permanencia' },
  { value: 'SPEED_LIMIT',         label: 'Velocidad' },
  { value: 'UNAUTHORIZED_ACCESS', label: 'Acceso no autorizado' },
];

const priorityOptions = [
  { value: 'LOW',      label: 'Baja' },
  { value: 'MEDIUM',   label: 'Media' },
  { value: 'HIGH',     label: 'Alta' },
  { value: 'CRITICAL', label: 'Crítica' },
];

// ─── Map helpers ──────────────────────────────────────────────────────────────

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [map, onMapClick]);
  return null;
}

// ─── Distance badge ───────────────────────────────────────────────────────────

function DistanceBadge({ result, ranchName }: { result: DistanceResult; ranchName?: string }) {
  const style = ZONE_STYLES[result.zone];
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium',
      style.badge,
    )}>
      <span>{style.icon}</span>
      <span>
        Geocerca a{' '}
        <strong>{formatDistance(result.distanceKm)}</strong>
        {' '}del centro{ranchName ? ` de "${ranchName}"` : ' del rancho'}
        {result.zone !== 'ok' && (
          <span className="ml-1 opacity-75">— {style.label.split('—')[1]?.trim()}</span>
        )}
      </span>
    </div>
  );
}

// ─── GeofenceDrawer ───────────────────────────────────────────────────────────

export function GeofenceDrawer({
  value,
  onChange,
  mapCenter,
  className = 'h-[400px]',
  ranchCenter,
  warnDistanceKm = 25,
  blockDistanceKm = 60,
  ranchName,
  requiredPoint,
  requiredPointLabel = 'Pin',
  containerBoundary,
  containerLabel,
  areaForRectangle,
}: GeofenceDrawerProps) {
  const [geoType, setGeoType]   = useState<GeofenceType>(value?.type || 'CIRCULAR');
  const [radius, setRadius]     = useState(value?.radius || 500);
  const [center, setCenter]     = useState(value?.center || null);
  const [points, setPoints]     = useState<{ latitude: number; longitude: number }[]>(value?.coordinates || []);
  const [bbox, setBbox]         = useState(value?.boundingBox || null);
  const [alerts, setAlerts]     = useState<string[]>(value?.alertTriggers || ['ENTRY', 'EXIT']);
  const [priority, setPriority] = useState(value?.priority || 'MEDIUM');
  const [isActive, setIsActive] = useState(value?.isActive ?? true);
  const clickCountRef = useRef(0);

  // Effective map center — priority:
  //   1) requiredPoint  (Phase 6 — strongest signal)
  //   2) explicit mapCenter passed by parent
  //   3) ranch center
  //   4) global default
  const effectiveCenter = requiredPoint
    ? { lat: requiredPoint.latitude, lng: requiredPoint.longitude }
    : mapCenter
      ?? (ranchCenter ? { lat: ranchCenter.latitude, lng: ranchCenter.longitude } : MAP_DEFAULT_CENTER);

  const initialZoom = requiredPoint ? 16 : MAP_DEFAULT_ZOOM;

  const buildConfig = useCallback((): GeofenceConfig => {
    const config: GeofenceConfig = { type: geoType, alertTriggers: alerts, isActive, priority };
    if (geoType === 'CIRCULAR' && center) {
      config.center = center; config.radius = radius;
    } else if (geoType === 'RECTANGULAR' && bbox) {
      config.boundingBox = bbox;
    } else if (geoType === 'POLYGON' && points.length >= 3) {
      config.coordinates = points;
    }
    return config;
  }, [geoType, center, radius, bbox, points, alerts, isActive, priority]);

  // ── Phase 6 — containment checks ─────────────────────────────────────────
  // Build a BoundaryShape view of the current draft (for the helpers).
  const currentShape: BoundaryShape | null = useMemo(() => {
    if (geoType === 'CIRCULAR' && center) return { type: 'CIRCULAR', center, radius };
    if (geoType === 'RECTANGULAR' && bbox) return { type: 'RECTANGULAR', boundingBox: bbox };
    if (geoType === 'POLYGON' && points.length >= 3) return { type: 'POLYGON', coordinates: points };
    return null;
  }, [geoType, center, radius, bbox, points]);

  /** True when there's a requiredPoint and the current shape does NOT contain it. */
  const pinOutside = useMemo(() => {
    if (!requiredPoint || !currentShape) return false;
    return !boundaryContainsPoint(currentShape, requiredPoint);
  }, [requiredPoint, currentShape]);

  /** Vertices that fall outside the container (when configured). */
  const containerCheck = useMemo(() => {
    if (!containerBoundary || !currentShape) return null;
    return boundaryAContainsBoundaryB(containerBoundary, currentShape);
  }, [containerBoundary, currentShape]);

  /** Aggregate validity used for `onChange` gating. */
  const isShapeContainmentValid =
    !pinOutside && (containerCheck === null || containerCheck.ok);

  useEffect(() => {
    const config = buildConfig();
    const hasGeometry =
      (geoType === 'CIRCULAR' && center && radius > 0) ||
      (geoType === 'RECTANGULAR' && bbox) ||
      (geoType === 'POLYGON' && points.length >= 3);
    if (hasGeometry && isShapeContainmentValid) {
      onChange(config);
    } else if (!hasGeometry) {
      // No shape → null in the parent (geofence is optional).
      onChange(null);
    } else {
      // Has geometry but it's invalid (pin outside or breaks container).
      // Set parent to null so the entity saves without geofence rather than
      // with a broken one.
      onChange(null);
    }
    // eslint-disable-next-line
  }, [geoType, center, radius, bbox, points, alerts, isActive, priority, isShapeContainmentValid]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const coord = {
        latitude:  Math.round(lat * 1_000_000) / 1_000_000,
        longitude: Math.round(lng * 1_000_000) / 1_000_000,
      };
      if (geoType === 'CIRCULAR') {
        setCenter(coord);
      } else if (geoType === 'RECTANGULAR') {
        clickCountRef.current += 1;
        if (clickCountRef.current === 1) {
          setBbox({ north: coord.latitude, south: coord.latitude, east: coord.longitude, west: coord.longitude });
        } else {
          const prev = bbox || { north: coord.latitude, south: coord.latitude, east: coord.longitude, west: coord.longitude };
          setBbox({
            north: Math.max(prev.north, coord.latitude),
            south: Math.min(prev.south, coord.latitude),
            east:  Math.max(prev.east,  coord.longitude),
            west:  Math.min(prev.west,  coord.longitude),
          });
          clickCountRef.current = 0;
        }
      } else if (geoType === 'POLYGON') {
        setPoints((prev) => [...prev, coord]);
      }
    },
    [geoType, bbox],
  );

  const clearGeofence = () => {
    setCenter(null); setPoints([]); setBbox(null);
    clickCountRef.current = 0;
    // Explicitly notify parent that the geofence is now null.
    onChange(null);
  };

  // ── Phase 6 — Quick-shape buttons ────────────────────────────────────────
  // Convert meters → degrees roughly (1° lat ≈ 111 km; lng scaled by cos(lat)).
  function metersToLatDeg(m: number) { return m / 111_320; }
  function metersToLngDeg(m: number, lat: number) {
    return m / (111_320 * Math.cos((lat * Math.PI) / 180));
  }

  const quickCircleAtPin = useCallback((meters: number) => {
    if (!requiredPoint) return;
    setGeoType('CIRCULAR');
    setCenter({ latitude: requiredPoint.latitude, longitude: requiredPoint.longitude });
    setRadius(meters);
    setPoints([]); setBbox(null);
    clickCountRef.current = 0;
  }, [requiredPoint]);

  const quickRectangleFromArea = useCallback(() => {
    if (!requiredPoint || !areaForRectangle) return;
    const radiusM = areaToRadiusMeters(areaForRectangle.area, areaForRectangle.unit);
    if (radiusM <= 0) return;
    // Build a SQUARE of equivalent area centered on the pin.
    // side = sqrt(area_m²) → half = side / 2.
    let m2: number;
    switch (areaForRectangle.unit) {
      case 'HA':   m2 = areaForRectangle.area * 10_000; break;
      case 'M2':   m2 = areaForRectangle.area; break;
      case 'ACRE': m2 = areaForRectangle.area * 4046.8564224; break;
      default:     m2 = areaForRectangle.area * 10_000;
    }
    const halfSideM = Math.sqrt(m2) / 2;
    const dLat = metersToLatDeg(halfSideM);
    const dLng = metersToLngDeg(halfSideM, requiredPoint.latitude);
    setGeoType('RECTANGULAR');
    setBbox({
      north: requiredPoint.latitude  + dLat,
      south: requiredPoint.latitude  - dLat,
      east:  requiredPoint.longitude + dLng,
      west:  requiredPoint.longitude - dLng,
    });
    setCenter(null); setPoints([]);
    clickCountRef.current = 0;
  }, [requiredPoint, areaForRectangle]);

  // Auto-fix: shift the current shape so it contains the pin.
  const centerShapeOnPin = useCallback(() => {
    if (!requiredPoint || !currentShape) return;
    if (geoType === 'CIRCULAR') {
      // Move the circle's center to the pin (radius unchanged).
      setCenter({ latitude: requiredPoint.latitude, longitude: requiredPoint.longitude });
    } else if (geoType === 'RECTANGULAR' && bbox) {
      // Keep the rectangle dimensions, recenter on pin.
      const halfLat = (bbox.north - bbox.south) / 2;
      const halfLng = (bbox.east  - bbox.west)  / 2;
      setBbox({
        north: requiredPoint.latitude  + halfLat,
        south: requiredPoint.latitude  - halfLat,
        east:  requiredPoint.longitude + halfLng,
        west:  requiredPoint.longitude - halfLng,
      });
    } else if (geoType === 'POLYGON' && points.length >= 3) {
      // Compute centroid, then shift all points so the centroid sits on the pin.
      const cLat = points.reduce((s, p) => s + p.latitude,  0) / points.length;
      const cLng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
      const dLat = requiredPoint.latitude  - cLat;
      const dLng = requiredPoint.longitude - cLng;
      setPoints(points.map((p) => ({
        latitude:  p.latitude  + dLat,
        longitude: p.longitude + dLng,
      })));
    }
  }, [requiredPoint, currentShape, geoType, bbox, points]);

  const toggleAlert = (alert: string) =>
    setAlerts((prev) =>
      prev.includes(alert) ? prev.filter((a) => a !== alert) : [...prev, alert],
    );

  // Capa 2 — compute distance result from current geofence to ranch center
  const currentGeofenceForCheck = useMemo(() => ({
    type: geoType,
    center: center ?? undefined,
    coordinates: points.length >= 3 ? points : undefined,
    boundingBox: bbox ?? undefined,
  }), [geoType, center, points, bbox]);

  const hasGeofence =
    (geoType === 'CIRCULAR' && !!center) ||
    (geoType === 'RECTANGULAR' && !!bbox) ||
    (geoType === 'POLYGON' && points.length >= 3);

  const distResult: DistanceResult | null = useMemo(() => {
    if (!ranchCenter || !hasGeofence) return null;
    return checkGeofenceVsRanch(currentGeofenceForCheck, ranchCenter, warnDistanceKm, blockDistanceKm);
  }, [ranchCenter, hasGeofence, currentGeofenceForCheck, warnDistanceKm, blockDistanceKm]);

  // Warn-ring radius in meters
  const warnRingMeters = warnDistanceKm * 1000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>Configuración de Geocerca</CardTitle>
        <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={clearGeofence}>
          Limpiar
        </Button>
      </div>

      {/* Required pin chip (Phase 6 — primary, takes precedence over ranch anchor) */}
      {requiredPoint && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-700 dark:text-emerald-400">
          <span>📍</span>
          <span>
            <strong>{requiredPointLabel}</strong> visible en el mapa.
            La geocerca debe <strong>contener</strong> este punto. Usa los botones rápidos abajo o dibuja sobre el pin.
          </span>
        </div>
      )}

      {/* Ranch anchor chip (Capa 1) — only when no requiredPoint */}
      {ranchCenter && !requiredPoint && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 text-xs text-amber-700 dark:text-amber-400">
          <span>🏠</span>
          <span>
            Centro del rancho{ranchName ? ` "${ranchName}"` : ''} visible en el mapa.
            El círculo verde indica el área segura ({warnDistanceKm} km).
          </span>
        </div>
      )}

      {/* Quick-shape buttons (Phase 6.3) — only when there's a pin */}
      {requiredPoint && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Crear rápido:</span>
          <button
            type="button"
            onClick={() => quickCircleAtPin(100)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
          >
            <CircleIcon className="w-3 h-3" />
            Círculo 100 m
          </button>
          <button
            type="button"
            onClick={() => quickCircleAtPin(500)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
          >
            <CircleIcon className="w-3 h-3" />
            Círculo 500 m
          </button>
          <button
            type="button"
            onClick={() => quickCircleAtPin(1000)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
          >
            <CircleIcon className="w-3 h-3" />
            Círculo 1 km
          </button>
          {areaForRectangle && areaForRectangle.area > 0 && (
            <button
              type="button"
              onClick={quickRectangleFromArea}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40"
            >
              <Square className="w-3 h-3" />
              Rectángulo del área ({areaForRectangle.area} {areaForRectangle.unit.toLowerCase()})
            </button>
          )}
        </div>
      )}

      {/* Hard-validation banner — pin outside (Phase 6.4) */}
      {pinOutside && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>
              <strong>La geocerca no contiene el {requiredPointLabel?.toLowerCase() ?? 'pin'}.</strong>{' '}
              Mientras esté así, la geocerca <strong>no se guardará</strong>.
              Mueve la forma sobre el pin o usa los botones rápidos.
            </p>
            <button
              type="button"
              onClick={centerShapeOnPin}
              className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-800 dark:text-red-300"
            >
              <Crosshair className="w-3 h-3" />
              Centrar forma en el pin
            </button>
          </div>
        </div>
      )}

      {/* Hard-validation banner — outside container (Phase 6.5) */}
      {containerCheck && !containerCheck.ok && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong>{containerCheck.outsideCount} de {containerCheck.totalCount}</strong> vértices
            de la geocerca están fuera{containerLabel ? ` ${containerLabel}` : ' del contenedor'}.
            La geocerca no se guardará hasta corregirse.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Tipo de Geocerca"
          options={typeOptions}
          value={geoType}
          onChange={(e) => { setGeoType(e.target.value as GeofenceType); clearGeofence(); }}
        />
        {geoType === 'CIRCULAR' && (
          <Input
            label="Radio (metros)"
            type="number"
            min={10}
            max={50000}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        )}
        <Select
          label="Prioridad"
          options={priorityOptions}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
      </div>

      {/* Instructions */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {geoType === 'CIRCULAR'    && 'Haz clic en el mapa para colocar el centro del círculo.'}
        {geoType === 'RECTANGULAR' && 'Haz clic en dos esquinas opuestas del rectángulo.'}
        {geoType === 'POLYGON'     && `Haz clic para agregar vértices (mínimo 3). Actual: ${points.length} puntos.`}
      </p>

      {/* Map */}
      <div className={cn(
        'rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800',
        className,
      )}>
        <MapContainer
          center={[effectiveCenter.lat, effectiveCenter.lng]}
          zoom={initialZoom}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Phase 6 — required pin (always rendered above all shapes) */}
          {requiredPoint && (
            <>
              <ReCenterOnPin point={requiredPoint} zoom={16} />
              <Marker
                position={[requiredPoint.latitude, requiredPoint.longitude]}
                icon={requiredPinIcon}
              />
            </>
          )}

          {/* Capa 1 — Ranch center anchor + safe-zone ring */}
          {ranchCenter && (
            <>
              <Circle
                center={[ranchCenter.latitude, ranchCenter.longitude]}
                radius={warnRingMeters}
                pathOptions={{
                  color: '#16a34a',
                  fillColor: '#16a34a',
                  fillOpacity: 0.04,
                  dashArray: '8 6',
                  weight: 1.5,
                }}
              />
              <Marker
                position={[ranchCenter.latitude, ranchCenter.longitude]}
                icon={ranchIcon}
              />
            </>
          )}

          <FeatureGroup>
            {geoType === 'CIRCULAR' && center && (
              <Circle
                center={[center.latitude, center.longitude]}
                radius={radius}
                pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.2 }}
              />
            )}
            {geoType === 'RECTANGULAR' && bbox && (
              <Rectangle
                bounds={[[bbox.south, bbox.west], [bbox.north, bbox.east]]}
                pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.2 }}
              />
            )}
            {geoType === 'POLYGON' && points.length >= 3 && (
              <Polygon
                positions={points.map((p) => [p.latitude, p.longitude])}
                pathOptions={{ color: '#9333ea', fillColor: '#9333ea', fillOpacity: 0.2 }}
              />
            )}
            {/* Polygon in-progress dots */}
            {geoType === 'POLYGON' && points.length > 0 && points.length < 3 && points.map((p, i) => (
              <Circle
                key={i}
                center={[p.latitude, p.longitude]}
                radius={8}
                pathOptions={{ color: '#9333ea', fillColor: '#9333ea', fillOpacity: 0.8 }}
              />
            ))}
          </FeatureGroup>
        </MapContainer>
      </div>

      {/* Capa 2 — Distance badge */}
      {distResult && <DistanceBadge result={distResult} ranchName={ranchName} />}

      {/* Alert Triggers */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Disparadores de Alerta
        </label>
        <div className="flex flex-wrap gap-2">
          {alertOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleAlert(opt.value)}
              className="transition-all"
            >
              <Badge variant={alerts.includes(opt.value) ? 'success' : 'default'}>
                {opt.label}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Active toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">Geocerca activa</span>
      </label>
    </div>
  );
}
