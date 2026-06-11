export const HEATMAP_GRADIENT = {
  0.1: '#3b82f6',
  0.3: '#22c55e',
  0.5: '#facc15',
  0.7: '#f97316',
  1.0: '#ef4444',
} as const;

export const CLUSTER_SEVERITY_COLORS = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
} as const;

export const MAP_BOUNDARY_COLORS = {
  RANCH: '#16a34a',
  LOCATION: '#14b8a6',
  PARENT_ZONE: '#16a34a',
  ORPHAN: '#9ca3af',
} as const;

export type ClusterSeverityKey = keyof typeof CLUSTER_SEVERITY_COLORS;
export type MapBoundaryKey     = keyof typeof MAP_BOUNDARY_COLORS;

// ── Helpers defensivos ────────────────────────────────────────────────────

/** Color del cluster según la severidad sanitaria predominante. Fallback LOW. */
export function getClusterSeverityColor(severity: string | undefined | null): string {
  if (!severity) return CLUSTER_SEVERITY_COLORS.LOW;
  return (CLUSTER_SEVERITY_COLORS as Record<string, string>)[severity] ?? CLUSTER_SEVERITY_COLORS.LOW;
}

/** Color del boundary del mapa por tipo (RANCH / LOCATION / PARENT_ZONE / ORPHAN). */
export function getMapBoundaryColor(kind: string | undefined | null): string {
  if (!kind) return MAP_BOUNDARY_COLORS.LOCATION;
  return (MAP_BOUNDARY_COLORS as Record<string, string>)[kind] ?? MAP_BOUNDARY_COLORS.LOCATION;
}
