/**
 * Geospatial validation utilities
 * Used to validate that locations and geofences belong to the correct ranch area.
 */

// ─── Haversine ────────────────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Returns the great-circle distance in **kilometers** between two geographic points.
 * Uses the Haversine formula — accurate enough for ranch-scale distances.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371; // Earth mean radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Zone classification ──────────────────────────────────────────────────────

/** ok = within safe range · warn = approaching limit · danger = clearly out of range */
export type DistanceZone = 'ok' | 'warn' | 'danger';

export function classifyDistance(
  distKm: number,
  warnKm: number,
  blockKm: number,
): DistanceZone {
  if (distKm <= warnKm) return 'ok';
  if (distKm <= blockKm) return 'warn';
  return 'danger';
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface DistanceResult {
  distanceKm: number;
  zone: DistanceZone;
}

// ─── Point check ─────────────────────────────────────────────────────────────

/**
 * Checks a single coordinate point against the ranch center.
 */
export function checkPointVsRanch(
  point: { latitude: number; longitude: number },
  ranchCenter: { latitude: number; longitude: number },
  warnKm = 25,
  blockKm = 60,
): DistanceResult {
  const distanceKm = haversineDistance(
    ranchCenter.latitude, ranchCenter.longitude,
    point.latitude,       point.longitude,
  );
  return { distanceKm, zone: classifyDistance(distanceKm, warnKm, blockKm) };
}

// ─── Geofence check ───────────────────────────────────────────────────────────

/**
 * Checks the *worst-case* distance from any geofence point to the ranch center:
 * - CIRCULAR  → checks the center point
 * - POLYGON   → checks every vertex
 * - RECTANGULAR → checks all 4 corners
 *
 * Returns the maximum distance found.
 */
export function checkGeofenceVsRanch(
  geofence: {
    type: string;
    center?: { latitude: number; longitude: number };
    coordinates?: { latitude: number; longitude: number }[];
    boundingBox?: { north: number; south: number; east: number; west: number };
  },
  ranchCenter: { latitude: number; longitude: number },
  warnKm = 25,
  blockKm = 60,
): DistanceResult {
  const points: { latitude: number; longitude: number }[] = [];

  if (geofence.type === 'CIRCULAR' && geofence.center) {
    points.push(geofence.center);
  } else if (geofence.type === 'POLYGON' && geofence.coordinates?.length) {
    points.push(...geofence.coordinates);
  } else if (geofence.type === 'RECTANGULAR' && geofence.boundingBox) {
    const { north, south, east, west } = geofence.boundingBox;
    points.push(
      { latitude: north, longitude: east },
      { latitude: north, longitude: west },
      { latitude: south, longitude: east },
      { latitude: south, longitude: west },
    );
  }

  if (points.length === 0) return { distanceKm: 0, zone: 'ok' };

  const maxDist = Math.max(
    ...points.map((p) =>
      haversineDistance(
        ranchCenter.latitude, ranchCenter.longitude,
        p.latitude, p.longitude,
      ),
    ),
  );

  return { distanceKm: maxDist, zone: classifyDistance(maxDist, warnKm, blockKm) };
}

// ─── Parent zone (hierarchical safe zone) ────────────────────────────────────

/**
 * Convert an area in hectares to the radius (in meters) of an equivalent circle.
 * area_m² = π · r²  →  r = √(area_m² / π)
 *
 * Example: 10 ha → 100 000 m² → ≈178 m radius.
 */
export function areaHaToRadiusMeters(areaHa: number): number {
  if (!areaHa || areaHa <= 0) return 0;
  const areaM2 = areaHa * 10_000;
  return Math.sqrt(areaM2 / Math.PI);
}

/**
 * Convert an area + unit to radius in meters.
 * Supported units: 'HA' (hectares), 'M2' (square meters), 'ACRE' (acres).
 */
export function areaToRadiusMeters(area: number, unit: string | null | undefined): number {
  if (!area || area <= 0) return 0;
  let m2: number;
  switch ((unit ?? 'HA').toUpperCase()) {
    case 'HA':   m2 = area * 10_000; break;
    case 'M2':   m2 = area;          break;
    case 'ACRE': m2 = area * 4046.8564224; break;
    default:     m2 = area * 10_000; break;
  }
  return Math.sqrt(m2 / Math.PI);
}

/** Default fallback radius (in meters) when parent has no capacity.area. */
export const PARENT_FALLBACK_RADIUS_M = 1_000;

export interface ParentZone {
  center: { latitude: number; longitude: number };
  /** Radius in meters used to define the safe zone. */
  radiusM: number;
  name: string;
  /** True if radius derived from parent's capacity.area; false if using fallback. */
  derivedFromArea: boolean;
}

export type ParentZoneStatus = 'inside' | 'warn' | 'outside';

export interface ParentZoneResult {
  distanceM: number;
  status: ParentZoneStatus;
}

/**
 * Check whether a point falls inside the parent's circular safe zone.
 *
 * - inside  : distance ≤ 90% of radius  → green, OK
 * - warn    : 90% < distance ≤ 100%     → yellow, advertencia
 * - outside : distance > 100% of radius → red, BLOCKED (no override per project decision)
 */
export function checkPointVsParent(
  point: { latitude: number; longitude: number },
  parent: ParentZone,
): ParentZoneResult {
  const distanceKm = haversineDistance(
    parent.center.latitude, parent.center.longitude,
    point.latitude,         point.longitude,
  );
  const distanceM = distanceKm * 1_000;
  const ratio = distanceM / parent.radiusM;
  let status: ParentZoneStatus;
  if (ratio <= 0.9)      status = 'inside';
  else if (ratio <= 1.0) status = 'warn';
  else                   status = 'outside';
  return { distanceM, status };
}

export const PARENT_ZONE_STYLES = {
  inside: {
    badge:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
    icon:   '✅',
    label:  'Dentro del área del padre',
  },
  warn: {
    badge:  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
    icon:   '⚠️',
    label:  'Cerca del límite del padre',
  },
  outside: {
    badge:  'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
    icon:   '⛔',
    label:  'Fuera del área del padre — bloqueado',
  },
} as const;

// ─── Point-in-shape (mirrors backend isPointInBoundary) ─────────────────────

/** Minimal subset of GeofenceConfig needed by the in-shape helpers. */
export interface BoundaryShape {
  type: 'CIRCULAR' | 'RECTANGULAR' | 'POLYGON' | 'CORRIDOR' | string;
  center?:      { latitude: number; longitude: number };
  radius?:      number;  // meters
  boundingBox?: { north: number; south: number; east: number; west: number };
  coordinates?: { latitude: number; longitude: number }[];
  width?:       number;  // for CORRIDOR (meters)
}

/**
 * Ray-casting point-in-polygon test.
 * Polygon is an array of {latitude, longitude} vertices (no need to close).
 */
export function isPointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: { latitude: number; longitude: number }[],
): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const x = point.longitude;
  const y = point.latitude;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Mirrors backend `isPointInBoundary`. Returns:
 * - true  if point is inside the boundary (or boundary is missing → permissive).
 * - false otherwise.
 *
 * Algorithm per type:
 * - CIRCULAR    : haversine × 1000 ≤ radius (meters)
 * - RECTANGULAR : within boundingBox
 * - POLYGON     : ray-casting (≥3 vertices)
 * - CORRIDOR    : permissive (TODO matches backend)
 * - missing     : permissive (no boundary configured)
 */
export function isPointInBoundary(
  point: { latitude: number; longitude: number },
  boundary: BoundaryShape | null | undefined,
): boolean {
  if (!boundary || !boundary.type) return true; // permissive

  switch (boundary.type) {
    case 'CIRCULAR': {
      if (!boundary.center || !boundary.radius || boundary.radius <= 0) return true;
      const distM = haversineDistance(
        boundary.center.latitude, boundary.center.longitude,
        point.latitude,            point.longitude,
      ) * 1000;
      return distM <= boundary.radius;
    }
    case 'RECTANGULAR': {
      const bb = boundary.boundingBox;
      if (!bb) return true;
      return (
        point.latitude  >= bb.south &&
        point.latitude  <= bb.north &&
        point.longitude >= bb.west  &&
        point.longitude <= bb.east
      );
    }
    case 'POLYGON': {
      if (!boundary.coordinates || boundary.coordinates.length < 3) return true;
      return isPointInPolygon(point, boundary.coordinates);
    }
    case 'CORRIDOR': {
      // Permissive — matches backend TODO. Refine when backend implements.
      return true;
    }
    default:
      return true;
  }
}

// ─── Geofence containment (Phase 6) ─────────────────────────────────────────

/**
 * Returns the list of vertices/representative points of a boundary shape.
 * Used to test whether a whole shape is contained inside another shape.
 */
export function boundaryVertices(b: BoundaryShape): { latitude: number; longitude: number }[] {
  if (!b || !b.type) return [];
  switch (b.type) {
    case 'POLYGON':
      return b.coordinates ?? [];
    case 'RECTANGULAR': {
      const bb = b.boundingBox;
      if (!bb) return [];
      return [
        { latitude: bb.north, longitude: bb.east },
        { latitude: bb.north, longitude: bb.west },
        { latitude: bb.south, longitude: bb.east },
        { latitude: bb.south, longitude: bb.west },
      ];
    }
    case 'CIRCULAR': {
      // Sample 16 points on the circle perimeter.
      if (!b.center || !b.radius) return [];
      const pts: { latitude: number; longitude: number }[] = [];
      const samples = 16;
      const earthR = 6_371_000;
      const dRad = b.radius / earthR;
      for (let i = 0; i < samples; i++) {
        const angle = (2 * Math.PI * i) / samples;
        const lat1 = (b.center.latitude * Math.PI) / 180;
        const lon1 = (b.center.longitude * Math.PI) / 180;
        const lat2 = Math.asin(
          Math.sin(lat1) * Math.cos(dRad) +
          Math.cos(lat1) * Math.sin(dRad) * Math.cos(angle),
        );
        const lon2 = lon1 + Math.atan2(
          Math.sin(angle) * Math.sin(dRad) * Math.cos(lat1),
          Math.cos(dRad) - Math.sin(lat1) * Math.sin(lat2),
        );
        pts.push({ latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI });
      }
      // Plus the center for safety
      pts.push(b.center);
      return pts;
    }
    case 'CORRIDOR':
      return b.coordinates ?? [];
    default:
      return [];
  }
}

/**
 * Checks that ALL representative points of an inner shape lie inside an outer
 * boundary. Used to validate that a child geofence is fully within its parent
 * ranch boundary.
 *
 * - If `outer` is null/undefined → permissive (returns true).
 * - If `inner` has no vertices    → permissive (true).
 * - For circles, the perimeter is sampled (16 pts + center).
 *
 * Returns:
 *   { ok: true } on success
 *   { ok: false, outsideCount, totalCount, firstOutside } on failure
 */
export interface ContainmentResult {
  ok: boolean;
  outsideCount: number;
  totalCount: number;
  firstOutside?: { latitude: number; longitude: number };
}

export function boundaryAContainsBoundaryB(
  outer: BoundaryShape | null | undefined,
  inner: BoundaryShape | null | undefined,
): ContainmentResult {
  if (!outer || !outer.type) return { ok: true, outsideCount: 0, totalCount: 0 };
  if (!inner || !inner.type) return { ok: true, outsideCount: 0, totalCount: 0 };

  const verts = boundaryVertices(inner);
  if (verts.length === 0) return { ok: true, outsideCount: 0, totalCount: 0 };

  let outsideCount = 0;
  let firstOutside: { latitude: number; longitude: number } | undefined;
  for (const v of verts) {
    if (!isPointInBoundary(v, outer)) {
      outsideCount++;
      if (!firstOutside) firstOutside = v;
    }
  }
  return {
    ok: outsideCount === 0,
    outsideCount,
    totalCount: verts.length,
    firstOutside,
  };
}

/**
 * Convenience wrapper: returns true when the boundary contains the given point.
 * If boundary is null/undefined → permissive (true).
 */
export function boundaryContainsPoint(
  boundary: BoundaryShape | null | undefined,
  point: { latitude: number; longitude: number },
): boolean {
  if (!boundary || !boundary.type) return true;
  return isPointInBoundary(point, boundary);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export const ZONE_STYLES = {
  ok: {
    badge:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
    icon:   '✅',
    label:  'Dentro del área del rancho',
  },
  warn: {
    badge:  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
    icon:   '⚠️',
    label:  'Zona de advertencia — lejos del centro del rancho',
  },
  danger: {
    badge:  'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
    icon:   '🔴',
    label:  'Fuera de rango — muy lejos del centro del rancho',
  },
} as const;
