import { useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polygon, Rectangle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '@/utils/constants';
import { Input } from '@/components/ui/Input';
import { MapPin } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  checkPointVsRanch, checkPointVsParent, isPointInBoundary,
  formatDistance, ZONE_STYLES, PARENT_ZONE_STYLES,
} from '@/utils/geoValidation';
import type {
  DistanceResult, ParentZone, ParentZoneResult, BoundaryShape,
} from '@/utils/geoValidation';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// ─── Leaflet icon setup ───────────────────────────────────────────────────────

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export const defaultIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Ranch-center anchor — amber house icon rendered with CSS */
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface MapPickerProps {
  value?: Coordinates | null;
  onChange: (coords: Coordinates) => void;
  label?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
  /** Ranch center coordinates — enables Capa 1 (visual anchor) + Capa 2 (distance guard) */
  ranchCenter?: { latitude: number; longitude: number } | null;
  /** Distance in km where the badge turns amber (default 25) */
  warnDistanceKm?: number;
  /** Distance in km where the badge turns red (default 60) */
  blockDistanceKm?: number;
  /** Ranch name for display */
  ranchName?: string;
  /**
   * Parent location zone (Phase A — hierarchical safe zone).
   * When set, the point MUST be inside this circle (no override).
   * The ranch zone still renders as secondary reference.
   */
  parentZone?: ParentZone | null;
  /**
   * Real ranch boundary (Phase B — polygon/rectangle/circle/corridor).
   * When set, replaces the synthetic circle around `ranchCenter` with the
   * actual shape and is the authoritative ranch-level constraint.
   */
  ranchBoundary?: BoundaryShape | null;
  /**
   * Destination LOCATION boundary (e.g. the potrero where the bovine will be
   * assigned). Rendered on top of the ranch boundary in a distinct color
   * (emerald) so the user can see the real area of the potrero while picking
   * GPS coordinates. The point should fall inside this shape — the caller is
   * responsible for the hard validation, MapPicker only renders + auto-centers.
   */
  locationBoundary?: BoundaryShape | null;
  /** Name of the destination location (used in the info chip). */
  locationName?: string;
}

// ─── Map sub-components ───────────────────────────────────────────────────────

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

// ─── Distance badges ──────────────────────────────────────────────────────────

function DistanceBadge({ result, ranchName }: { result: DistanceResult; ranchName?: string }) {
  const style = ZONE_STYLES[result.zone];
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium',
      style.badge,
    )}>
      <span>{style.icon}</span>
      <span>
        <strong>{formatDistance(result.distanceKm)}</strong>
        {' '}del centro{ranchName ? ` de ${ranchName}` : ' del rancho'}
        {result.zone !== 'ok' && (
          <span className="ml-1 opacity-75">— {style.label.split('—')[1]?.trim()}</span>
        )}
      </span>
    </div>
  );
}

function ParentBadge({
  result, parent,
}: {
  result: ParentZoneResult;
  parent: ParentZone;
}) {
  const style = PARENT_ZONE_STYLES[result.status];
  const distLabel = result.distanceM < 1000
    ? `${Math.round(result.distanceM)} m`
    : `${(result.distanceM / 1000).toFixed(2)} km`;
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium',
      style.badge,
    )}>
      <span>{style.icon}</span>
      <span>
        <strong>{distLabel}</strong>
        {' '}del centro de <strong>"{parent.name}"</strong>
        {result.status === 'outside' && (
          <span className="ml-1 opacity-90">
            — está fuera del área del padre. No se permitirá guardar mientras esté fuera.
          </span>
        )}
        {result.status === 'warn' && (
          <span className="ml-1 opacity-90">— casi en el límite</span>
        )}
      </span>
    </div>
  );
}

// ─── MapPicker ────────────────────────────────────────────────────────────────

export function MapPicker({
  value,
  onChange,
  label = 'Ubicación en Mapa',
  error,
  className = 'h-[300px]',
  disabled = false,
  ranchCenter,
  warnDistanceKm = 25,
  blockDistanceKm = 60,
  ranchName,
  parentZone,
  ranchBoundary,
  locationBoundary,
  locationName,
}: MapPickerProps) {
  const [manualLat, setManualLat] = useState(value?.latitude?.toString() || '');
  const [manualLng, setManualLng] = useState(value?.longitude?.toString() || '');

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (disabled) return;
      const rounded = {
        latitude:  Math.round(lat * 1_000_000) / 1_000_000,
        longitude: Math.round(lng * 1_000_000) / 1_000_000,
      };
      setManualLat(rounded.latitude.toString());
      setManualLng(rounded.longitude.toString());
      onChange(rounded);
    },
    [onChange, disabled],
  );

  const handleManualChange = useCallback(
    (field: 'latitude' | 'longitude', val: string) => {
      if (field === 'latitude') setManualLat(val);
      else setManualLng(val);

      const lat = field === 'latitude' ? parseFloat(val) : parseFloat(manualLat);
      const lng = field === 'longitude' ? parseFloat(val) : parseFloat(manualLng);

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        onChange({ latitude: lat, longitude: lng });
      }
    },
    [manualLat, manualLng, onChange],
  );

  // Capa 2: compute distance result whenever value or ranchCenter changes
  const distResult: DistanceResult | null = useMemo(() => {
    if (!value || !ranchCenter) return null;
    return checkPointVsRanch(value, ranchCenter, warnDistanceKm, blockDistanceKm);
  }, [value, ranchCenter, warnDistanceKm, blockDistanceKm]);

  // Phase A: parent-zone result (when a parent is configured)
  const parentResult: ParentZoneResult | null = useMemo(() => {
    if (!value || !parentZone) return null;
    return checkPointVsParent(value, parentZone);
  }, [value, parentZone]);

  // Phase B: real ranch-boundary check (when a boundary is configured).
  // True/false meaning matches the backend: inside (true) or outside (false).
  const insideBoundary: boolean | null = useMemo(() => {
    if (!value || !ranchBoundary) return null;
    return isPointInBoundary(value, ranchBoundary);
  }, [value, ranchBoundary]);

  // Destination-location boundary check (the potrero where the animal goes).
  // True if point is inside the location's geofence, false otherwise.
  const insideLocationBoundary: boolean | null = useMemo(() => {
    if (!value || !locationBoundary) return null;
    return isPointInBoundary(value, locationBoundary);
  }, [value, locationBoundary]);

  // Pick a representative center for the destination location (used as a
  // fallback for the map's initial center when nothing else is available).
  const locationCenter: { latitude: number; longitude: number } | null = useMemo(() => {
    if (!locationBoundary || !locationBoundary.type) return null;
    if (locationBoundary.type === 'CIRCULAR' && locationBoundary.center) {
      return locationBoundary.center;
    }
    if (locationBoundary.type === 'RECTANGULAR' && locationBoundary.boundingBox) {
      const bb = locationBoundary.boundingBox;
      return {
        latitude:  (bb.north + bb.south) / 2,
        longitude: (bb.east  + bb.west ) / 2,
      };
    }
    if (locationBoundary.type === 'POLYGON' && locationBoundary.coordinates?.length) {
      const cs = locationBoundary.coordinates;
      const lat = cs.reduce((s, c) => s + c.latitude,  0) / cs.length;
      const lng = cs.reduce((s, c) => s + c.longitude, 0) / cs.length;
      return { latitude: lat, longitude: lng };
    }
    return null;
  }, [locationBoundary]);

  // Map initial center: placed point → location center → parent → ranch → default
  const initialCenter: [number, number] = value
    ? [value.latitude, value.longitude]
    : locationCenter
      ? [locationCenter.latitude, locationCenter.longitude]
      : parentZone
        ? [parentZone.center.latitude, parentZone.center.longitude]
        : ranchCenter
          ? [ranchCenter.latitude, ranchCenter.longitude]
          : [MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng];

  const initialZoom = value
    ? 16
    : locationCenter
      ? 17       // closest zoom — we know exactly where the potrero is
      : parentZone
        ? 15
        : ranchCenter
          ? 13
          : MAP_DEFAULT_ZOOM;

  // Warn ring radius in meters
  const warnRingMeters = warnDistanceKm * 1000;

  return (
    <div className="space-y-3">
      {label && (
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          <MapPin className="w-4 h-4" />
          {label}
        </label>
      )}

      {/* Destination location info chip — shown whenever a location boundary
          is configured. Distinct teal palette so it doesn't collide with the
          ranch / parent chips. */}
      {locationBoundary && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-900/40 text-xs text-teal-700 dark:text-teal-300">
          <span>🌾</span>
          <span>
            {locationName
              ? <>Área del potrero <strong>"{locationName}"</strong> resaltada en el mapa.</>
              : <>Área del potrero destino resaltada en el mapa.</>}
            {' '}<strong>El pin debe caer dentro de la zona color verde-azulado.</strong>
          </span>
        </div>
      )}

      {/* Parent zone info chip (Phase A — takes precedence when present) */}
      {parentZone && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-700 dark:text-emerald-400">
          <span>📍</span>
          <span>
            Esta ubicación es <strong>hija de "{parentZone.name}"</strong>.
            El círculo verde delimita el área segura
            {' '}({parentZone.radiusM < 1000
              ? `${Math.round(parentZone.radiusM)} m`
              : `${(parentZone.radiusM / 1000).toFixed(2)} km`} de radio
            {parentZone.derivedFromArea ? ', derivado del área del padre' : ', valor por defecto al no tener área configurada'}).
            {' '}<strong>El punto debe estar dentro de esa área.</strong>
          </span>
        </div>
      )}

      {/* Ranch info chip (Capa 1) */}
      {ranchCenter && !parentZone && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 text-xs text-amber-700 dark:text-amber-400">
          <span>🏠</span>
          <span>
            <strong>{ranchName ? `Rancho "${ranchName}"` : 'Rancho'}</strong>{' '}
            {ranchBoundary
              ? <>marcado en el mapa. La forma verde muestra el <strong>perímetro real</strong> del rancho. El punto debe estar dentro.</>
              : <>centro marcado en el mapa. El círculo verde muestra el área segura ({warnDistanceKm} km).</>
            }
          </span>
        </div>
      )}

      {/* Hint: ranch has no boundary configured yet (only shown when admin can fix it) */}
      {ranchCenter && !ranchBoundary && !parentZone && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40 text-xs text-sky-700 dark:text-sky-400">
          <span>💡</span>
          <span>
            Este rancho aún no tiene un <strong>perímetro real</strong> configurado.
            Por ahora se usa una aproximación circular de {warnDistanceKm} km. Para mayor precisión,
            pídele al administrador del rancho que dibuje el contorno en la página del rancho.
          </span>
        </div>
      )}

      {/* Map */}
      <div className={cn(
        'rounded-xl overflow-hidden border',
        error ? 'border-red-500' : 'border-gray-200 dark:border-gray-800',
        className,
      )}>
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!disabled && <ClickHandler onClick={handleMapClick} />}

          {/* Capa 1 — Ranch boundary or fallback safe-zone ring.
              Priority:
                1) ranchBoundary configured → render the real shape (polygon/rect/circle).
                2) ranchCenter only         → render the legacy circle around the center.
              When a parentZone is set, the ranch shape is gray (secondary reference). */}
          {(() => {
            const isSecondary = !!parentZone;
            const primaryStyle = {
              color: '#16a34a',
              fillColor: '#16a34a',
              fillOpacity: 0.04,
              dashArray: '8 6',
              weight: 1.5,
            };
            const secondaryStyle = {
              color: '#9ca3af',
              fillColor: '#9ca3af',
              fillOpacity: 0.03,
              dashArray: '4 6',
              weight: 1,
            };
            const style = isSecondary ? secondaryStyle : primaryStyle;

            // Render real boundary shape when available
            if (ranchBoundary) {
              if (ranchBoundary.type === 'POLYGON' && ranchBoundary.coordinates && ranchBoundary.coordinates.length >= 3) {
                return (
                  <Polygon
                    positions={ranchBoundary.coordinates.map((c) => [c.latitude, c.longitude]) as [number, number][]}
                    pathOptions={style}
                  />
                );
              }
              if (ranchBoundary.type === 'RECTANGULAR' && ranchBoundary.boundingBox) {
                const bb = ranchBoundary.boundingBox;
                return (
                  <Rectangle
                    bounds={[[bb.south, bb.west], [bb.north, bb.east]] as [[number, number], [number, number]]}
                    pathOptions={style}
                  />
                );
              }
              if (ranchBoundary.type === 'CIRCULAR' && ranchBoundary.center && ranchBoundary.radius) {
                return (
                  <Circle
                    center={[ranchBoundary.center.latitude, ranchBoundary.center.longitude]}
                    radius={ranchBoundary.radius}
                    pathOptions={style}
                  />
                );
              }
              // CORRIDOR or unknown → fall back to legacy circle below
            }

            // Legacy fallback: circle around ranchCenter using warn distance
            if (ranchCenter) {
              return (
                <Circle
                  center={[ranchCenter.latitude, ranchCenter.longitude]}
                  radius={warnRingMeters}
                  pathOptions={style}
                />
              );
            }
            return null;
          })()}

          {/* Ranch-center marker (always shown when we have coords) */}
          {ranchCenter && (
            <Marker
              position={[ranchCenter.latitude, ranchCenter.longitude]}
              icon={ranchIcon}
            />
          )}

          {/* Phase A — parent zone (primary safe zone for child locations) */}
          {parentZone && (
            <>
              {/* Outer ring at full radius (limit) */}
              <Circle
                center={[parentZone.center.latitude, parentZone.center.longitude]}
                radius={parentZone.radiusM}
                pathOptions={{
                  color: '#16a34a',
                  fillColor: '#16a34a',
                  fillOpacity: 0.08,
                  weight: 2,
                }}
              />
              {/* Inner safe ring at 90% (transition warn → inside) */}
              <Circle
                center={[parentZone.center.latitude, parentZone.center.longitude]}
                radius={parentZone.radiusM * 0.9}
                pathOptions={{
                  color: '#16a34a',
                  fillColor: 'transparent',
                  weight: 1,
                  dashArray: '4 4',
                  opacity: 0.5,
                }}
              />
              {/* Parent center marker */}
              <Marker
                position={[parentZone.center.latitude, parentZone.center.longitude]}
                icon={L.divIcon({
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
                })}
              />
            </>
          )}

          {/* Destination LOCATION boundary — emerald shape rendered on top of
              the ranch boundary so the user sees exactly where the potrero is
              and where they can safely drop the pin. */}
          {locationBoundary && (() => {
            const style = {
              color: '#0d9488',          // teal-600
              fillColor: '#14b8a6',      // teal-500
              fillOpacity: 0.18,
              weight: 2,
            };
            if (locationBoundary.type === 'POLYGON'
                && locationBoundary.coordinates
                && locationBoundary.coordinates.length >= 3) {
              return (
                <Polygon
                  positions={locationBoundary.coordinates.map((c) => [c.latitude, c.longitude]) as [number, number][]}
                  pathOptions={style}
                />
              );
            }
            if (locationBoundary.type === 'RECTANGULAR' && locationBoundary.boundingBox) {
              const bb = locationBoundary.boundingBox;
              return (
                <Rectangle
                  bounds={[[bb.south, bb.west], [bb.north, bb.east]] as [[number, number], [number, number]]}
                  pathOptions={style}
                />
              );
            }
            if (locationBoundary.type === 'CIRCULAR'
                && locationBoundary.center && locationBoundary.radius) {
              return (
                <Circle
                  center={[locationBoundary.center.latitude, locationBoundary.center.longitude]}
                  radius={locationBoundary.radius}
                  pathOptions={style}
                />
              );
            }
            return null;
          })()}

          {/* Location pin */}
          {value && (
            <Marker position={[value.latitude, value.longitude]} icon={defaultIcon} />
          )}
        </MapContainer>
      </div>

      {/* Lat / Lng manual inputs */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Latitud"
          type="number"
          step="0.000001"
          min={-90}
          max={90}
          placeholder="17.9892"
          value={manualLat}
          onChange={(e) => handleManualChange('latitude', e.target.value)}
          disabled={disabled}
        />
        <Input
          label="Longitud"
          type="number"
          step="0.000001"
          min={-180}
          max={180}
          placeholder="-92.9475"
          value={manualLng}
          onChange={(e) => handleManualChange('longitude', e.target.value)}
          disabled={disabled}
        />
      </div>

      {/* Phase A — Parent zone badge (primary when parent is configured) */}
      {parentResult && parentZone && (
        <ParentBadge result={parentResult} parent={parentZone} />
      )}

      {/* Destination-location badge — green when inside, red when outside.
          This drives the caller's hard validation (button disabled / submit blocked). */}
      {insideLocationBoundary === true && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40">
          <span>✅</span>
          <span>
            El pin está dentro del área de
            {locationName ? <> <strong>"{locationName}"</strong>.</> : <> el potrero destino.</>}
          </span>
        </div>
      )}
      {insideLocationBoundary === false && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40">
          <span>⛔</span>
          <span>
            El pin está fuera del área de
            {locationName ? <> <strong>"{locationName}"</strong>.</> : <> el potrero destino.</>}
            <span className="ml-1 opacity-90">Muévelo dentro de la zona verde-azulada para continuar.</span>
          </span>
        </div>
      )}

      {/* Phase B — Ranch boundary badge (only shown when point is outside the real boundary) */}
      {insideBoundary === false && !parentZone && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40">
          <span>⛔</span>
          <span>
            Fuera del perímetro del rancho{ranchName ? ` "${ranchName}"` : ''}.
            <span className="ml-1 opacity-90">Mueve el punto dentro de la forma verde para continuar.</span>
          </span>
        </div>
      )}

      {/* Capa 2 — Legacy distance badge (only when no real boundary configured) */}
      {distResult && !ranchBoundary && (
        <DistanceBadge result={distResult} ranchName={ranchName} />
      )}

      {value && !distResult && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Coordenadas: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
