import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { getOutsideRanchBoundaryDetails } from '@/utils/errorHandler';
import { locationsApi } from '@/api/locations.api';
import { ranchApi } from '@/api/ranch.api';
import {
  LocationType,
  LocationStatus,
  PastureQuality,
} from '@/types/location.types';
import type { Location, LocationFormData, WaterSource, GeofenceConfig } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { MapView } from '@/components/maps/MapView';
import { MapPicker } from '@/components/maps/MapPicker';
import { GeofenceDrawer } from '@/components/maps/GeofenceDrawer';
import type { Coordinates } from '@/components/maps/MapPicker';
import { PageLoader } from '@/components/ui/Spinner';
import { RanchSelector } from '@/components/ui/RanchSelector';
import {
  MapPin, Plus, Edit2, Trash2, Warehouse, TreePine, Users,
  AlertTriangle, BarChart3, Droplets, Layers, X, ChevronDown, ChevronUp, ChevronRight,
  Gauge, Zap, Wifi, Route, Home,
} from 'lucide-react';
import type { LocationCapacityPayload } from '@/api/locations.api';

// ─── Zod schema matching backend Location model ────────────────────────────

const waterSourceSchema = z.object({
  type: z.enum(['WELL', 'RIVER', 'POND', 'STREAM', 'SPRING', 'TANK']),
  name: z.string().min(1, 'Nombre requerido'),
  capacity: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().positive().optional()),
  quality: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).optional(),
});

// Capacity sub-schema (1:1 LocationCapacity record).
// currentAnimals intentionally omitted — managed via /increment and /decrement only.
const capacitySchema = z.object({
  maxAnimals: z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().int().min(0).optional()),
  area: z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().positive().optional()),
  areaUnit: z.enum(['M2', 'HA', 'ACRE']).optional().or(z.literal('')),
  carryingCapacity: z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().min(0).optional()),
  waterSourcesCount: z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().int().min(0).optional()),
  feedingStations: z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().int().min(0).optional()),
  shelters: z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().int().min(0).optional()),
  hasElectricity: z.boolean().optional(),
  hasWater: z.boolean().optional(),
  hasInternet: z.boolean().optional(),
  hasRoadAccess: z.boolean().optional(),
  securityLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().or(z.literal('')),
});

const locationSchema = z.object({
  locationCode: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[A-Za-z0-9-]+$/, 'Solo letras, números y guiones')
    .transform((v) => v.toUpperCase()),
  name: z.string().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  ranchId: z.string().min(1, 'Rancho requerido'),
  type: z.nativeEnum(LocationType, { error: 'Selecciona un tipo' }),
  status: z.nativeEnum(LocationStatus).optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).refine((c) => !(c.latitude === 0 && c.longitude === 0), {
    message: 'Las coordenadas (0, 0) no son válidas',
  }),
  parentLocationId: z.string().optional().or(z.literal('')),
  soilType: z.string().max(100).optional().or(z.literal('')),
  elevation: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(-100).max(6000).optional()),
  slope: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(0).max(90).optional()),
  vegetation: z.array(z.string()).optional(),
  waterSources: z.array(waterSourceSchema).optional(),
  pastureQuality: z.nativeEnum(PastureQuality).optional().or(z.literal('')),
  geofenceConfig: z.any().optional(),
  capacity: capacitySchema.optional(),
});

type FormValues = z.infer<typeof locationSchema>;

// ─── Select options ────────────────────────────────────────────────────────

const locationTypeOptions = [
  { value: LocationType.PASTURE, label: 'Pastizal' },
  { value: LocationType.CORRAL, label: 'Corral' },
  { value: LocationType.BARN, label: 'Establo' },
  { value: LocationType.MILKING_PARLOR, label: 'Sala de Ordeño' },
  { value: LocationType.FEED_AREA, label: 'Área de Alimentación' },
  { value: LocationType.WATER_SOURCE, label: 'Fuente de Agua' },
  { value: LocationType.VETERINARY_CLINIC, label: 'Clínica Veterinaria' },
  { value: LocationType.QUARANTINE_AREA, label: 'Área de Cuarentena' },
  { value: LocationType.LOADING_AREA, label: 'Área de Carga' },
  { value: LocationType.STORAGE, label: 'Almacén' },
  { value: LocationType.OFFICE, label: 'Oficina' },
  { value: LocationType.RESIDENTIAL, label: 'Residencial' },
  { value: LocationType.PROCESSING_PLANT, label: 'Planta de Procesamiento' },
  { value: LocationType.BREEDING_CENTER, label: 'Centro de Reproducción' },
  { value: LocationType.LABORATORY, label: 'Laboratorio' },
  { value: LocationType.WASTE_MANAGEMENT, label: 'Manejo de Residuos' },
  { value: LocationType.EQUIPMENT_SHED, label: 'Bodega de Equipos' },
  { value: LocationType.ENTRANCE_GATE, label: 'Puerta de Entrada' },
  { value: LocationType.SECURITY_POST, label: 'Puesto de Seguridad' },
  { value: LocationType.EMERGENCY_POINT, label: 'Punto de Emergencia' },
  { value: LocationType.RESTRICTED_AREA, label: 'Área Restringida' },
  { value: LocationType.DANGER_ZONE, label: 'Zona de Peligro' },
  { value: LocationType.SAFE_ZONE, label: 'Zona Segura' },
  { value: LocationType.ROUTE, label: 'Ruta' },
  { value: LocationType.CHECKPOINT, label: 'Punto de Control' },
  { value: LocationType.OTHER, label: 'Otro' },
];

const locationStatusOptions = [
  { value: LocationStatus.ACTIVE, label: 'Activa' },
  { value: LocationStatus.INACTIVE, label: 'Inactiva' },
  { value: LocationStatus.UNDER_CONSTRUCTION, label: 'En Construcción' },
  { value: LocationStatus.UNDER_MAINTENANCE, label: 'En Mantenimiento' },
  { value: LocationStatus.QUARANTINED, label: 'En Cuarentena' },
  { value: LocationStatus.FLOODED, label: 'Inundada' },
  { value: LocationStatus.DAMAGED, label: 'Dañada' },
  { value: LocationStatus.CLOSED, label: 'Cerrada' },
  { value: LocationStatus.RESTRICTED, label: 'Restringida' },
];

const pastureQualityOptions = [
  { value: '', label: 'Sin especificar' },
  { value: PastureQuality.EXCELLENT, label: 'Excelente' },
  { value: PastureQuality.GOOD, label: 'Buena' },
  { value: PastureQuality.FAIR, label: 'Regular' },
  { value: PastureQuality.POOR, label: 'Pobre' },
];

const waterSourceTypeOptions = [
  { value: 'WELL', label: 'Pozo' },
  { value: 'RIVER', label: 'Río' },
  { value: 'POND', label: 'Estanque' },
  { value: 'STREAM', label: 'Arroyo' },
  { value: 'SPRING', label: 'Manantial' },
  { value: 'TANK', label: 'Tanque' },
];

const soilTypeOptions = [
  { value: '', label: 'Sin especificar' },
  { value: 'CLAY', label: 'Arcilloso' },
  { value: 'SANDY', label: 'Arenoso' },
  { value: 'LOAM', label: 'Franco' },
  { value: 'SILT', label: 'Limoso' },
  { value: 'ROCKY', label: 'Rocoso' },
  { value: 'ORGANIC', label: 'Orgánico' },
  { value: 'MIXED', label: 'Mixto' },
];

const typeLabels: Record<string, string> = Object.fromEntries(
  locationTypeOptions.map((o) => [o.value, o.label]),
);

const statusLabels: Record<string, string> = Object.fromEntries(
  locationStatusOptions.map((o) => [o.value, o.label]),
);

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  UNDER_CONSTRUCTION: 'info',
  UNDER_MAINTENANCE: 'info',
  QUARANTINED: 'danger',
  FLOODED: 'danger',
  DAMAGED: 'warning',
  CLOSED: 'default',
  RESTRICTED: 'warning',
};

const typeIcons: Record<string, typeof MapPin> = {
  PASTURE: TreePine,
  BARN: Warehouse,
  CORRAL: Warehouse,
  QUARANTINE_AREA: AlertTriangle,
  WATER_SOURCE: Droplets,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const VEGETATION_OPTIONS = [
  'Pasto Bermuda', 'Pasto Estrella', 'Pasto Pangola', 'Pasto Guinea',
  'Pasto Jaragua', 'Pasto Signal', 'Pasto Brachiaria', 'Pasto Buffel',
  'Leguminosas', 'Arbustos', 'Árboles de sombra', 'Cercas vivas',
];

const emptyCapacityValues: NonNullable<FormValues['capacity']> = {
  maxAnimals: undefined,
  area: undefined,
  areaUnit: '',
  carryingCapacity: undefined,
  waterSourcesCount: undefined,
  feedingStations: undefined,
  shelters: undefined,
  hasElectricity: false,
  hasWater: false,
  hasInternet: false,
  hasRoadAccess: false,
  securityLevel: '',
};

function getDefaultValues(ranchId: string): FormValues {
  return {
    locationCode: '',
    name: '',
    ranchId,
    type: LocationType.PASTURE,
    status: LocationStatus.ACTIVE,
    coordinates: { latitude: 0, longitude: 0 },
    parentLocationId: '',
    soilType: '',
    elevation: undefined,
    slope: undefined,
    vegetation: [],
    waterSources: [],
    pastureQuality: '',
    geofenceConfig: undefined,
    capacity: emptyCapacityValues,
  };
}

// Accepts both shapes: full LocationCapacity (from /capacity endpoint) and
// LocationCapacityInline (from inline eager-load in /locations[/:id]).
// Both share the same field names; only nullability of optional fields differs.
type AnyCapacityShape =
  | import('@/types').LocationCapacity
  | import('@/types/location.types').LocationCapacityInline;

function locationToFormValues(
  loc: Location,
  ranchId: string,
  cap?: AnyCapacityShape | null,
): FormValues {
  return {
    locationCode: loc.locationCode || '',
    name: loc.name,
    ranchId: loc.ranchId || ranchId,
    type: loc.type,
    status: loc.status,
    coordinates: loc.coordinates || { latitude: 0, longitude: 0 },
    parentLocationId: loc.parentLocationId || '',
    soilType: loc.soilType || '',
    elevation: loc.elevation,
    slope: loc.slope,
    vegetation: loc.vegetation || [],
    waterSources: (loc.waterSources || []) as WaterSource[],
    pastureQuality: loc.pastureQuality || '',
    geofenceConfig: loc.geofenceConfig,
    capacity: cap
      ? {
          maxAnimals: cap.maxAnimals,
          area: cap.area ?? undefined,
          areaUnit: cap.areaUnit ?? '',
          carryingCapacity: cap.carryingCapacity ?? undefined,
          waterSourcesCount: 'waterSources' in cap ? (cap as any).waterSources : undefined,
          feedingStations: cap.feedingStations,
          shelters: cap.shelters,
          hasElectricity: cap.hasElectricity ?? false,
          hasWater: cap.hasWater ?? false,
          hasInternet: cap.hasInternet ?? false,
          hasRoadAccess: cap.hasRoadAccess ?? false,
          securityLevel: cap.securityLevel ?? '',
        }
      : emptyCapacityValues,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────

export function LocationsPage() {
  const { user, activeRanchId, setActiveRanch } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Location | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [page, setPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGeofence, setShowGeofence] = useState(false);
  const [showCapacity, setShowCapacity] = useState(false);

  // Show the global ranch filter only for users that have access to >1 ranch
  // (or SUPER_ADMIN, who can see everything regardless of ranchAccess length).
  const ranchAccessCount = user?.ranchAccess?.length ?? 0;
  const showRanchFilter = user?.role === 'SUPER_ADMIN' || ranchAccessCount > 1;

  // ── Queries ────────────────────────────────────────────────────────────
  // Server-side ranchId filter: when activeRanchId is set, only that ranch's
  // locations are returned. When null, the backend returns everything visible
  // to the current user (scoped by RBAC).

  const { data, isLoading } = useQuery({
    queryKey: ['locations', page, activeRanchId],
    queryFn: () => locationsApi.list({
      page,
      limit: 20,
      ...(activeRanchId ? { ranchId: activeRanchId } : {}),
    }),
  });

  // Reset to page 1 whenever the ranch filter changes
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRanchId]);

  const items = data?.items || [];
  // The effective ranch for KPI #2 is now simply activeRanchId. When it's null,
  // KPI #2 shows a "select a ranch" message instead of trying to derive one.
  const effectiveRanchId = activeRanchId;

  // Ranch-level capacity (Ranch.maxCattleCapacity + live currentCattleCount).
  // Calculated by backend on-the-fly from BovineLocationHistory (post backend D).
  const { data: ranchSummary } = useQuery({
    queryKey: ['ranch-summary', effectiveRanchId],
    queryFn: () => ranchApi.getSummary(effectiveRanchId!).then((r) => r.data.data),
    enabled: !!effectiveRanchId,
    staleTime: 1000 * 60 * 2,
  });

  // Capacity of the location currently being edited.
  // FALLBACK: only fires if `editingLoc.capacity` did NOT come inline (older endpoint
  // or component opening this modal with a partial Location object).
  // Backend D guarantees `capacity: <obj>|null` on every Location returned by
  // GET /locations and GET /locations/:id, so the inline path is the normal one.
  const needsCapacityFallback = !!editingLoc && editingLoc.capacity === undefined;
  const { data: editingCapacityFallback, isLoading: loadingEditingCapFallback } = useQuery({
    queryKey: ['location-capacity', editingLoc?.id],
    queryFn: () => locationsApi.getCapacity(editingLoc!.id),
    enabled: needsCapacityFallback,
    staleTime: 0,
  });
  // Resolved capacity for the form: inline → fallback query → null.
  const editingCapacity = editingLoc?.capacity ?? editingCapacityFallback ?? null;
  const loadingEditingCap = needsCapacityFallback && loadingEditingCapFallback;

  // Per-location capacity map (for table rows + map popups).
  // Built from inline `capacity` field — no extra petitions needed.
  const capacityByLocationId = (() => {
    const map = new Map<string, { currentAnimals: number; maxAnimals: number; percentage: number; isFull: boolean }>();
    items.forEach((l) => {
      const c = l.capacity;
      if (!c || c.maxAnimals <= 0) return;
      const percentage = (c.currentAnimals / c.maxAnimals) * 100;
      map.set(l.id, {
        currentAnimals: c.currentAnimals,
        maxAnimals: c.maxAnimals,
        percentage,
        isFull: c.currentAnimals >= c.maxAnimals,
      });
    });
    return map;
  })();

  // ── Form ───────────────────────────────────────────────────────────────

  const form = useForm<FormValues>({
    resolver: zodResolver(locationSchema) as any,
    defaultValues: getDefaultValues(activeRanchId || ''),
  });

  const { fields: waterFields, append: appendWater, remove: removeWater } = useFieldArray({
    control: form.control,
    name: 'waterSources',
  });

  // Re-hydrate form when the fetched capacity arrives (edit mode only).
  // openEdit() already seeded Location fields synchronously; here we merge
  // capacity once the query resolves so the user sees numbers pre-filled.
  useEffect(() => {
    if (!editingLoc) return;
    if (loadingEditingCap) return;
    form.reset(locationToFormValues(editingLoc, activeRanchId || '', editingCapacity ?? null));
    // Auto-expand capacity section if there is already data
    if (editingCapacity) setShowCapacity(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLoc?.id, editingCapacity, loadingEditingCap]);

  /**
   * Build the LocationCapacity payload from form values.
   * Returns null if the user left every capacity field empty (nothing to persist).
   */
  function buildCapacityPayload(cap?: FormValues['capacity']): LocationCapacityPayload | null {
    if (!cap) return null;
    const payload: LocationCapacityPayload = {};
    if (cap.maxAnimals != null) payload.maxAnimals = cap.maxAnimals;
    if (cap.area != null) payload.area = cap.area;
    if (cap.areaUnit) payload.areaUnit = cap.areaUnit as 'M2' | 'HA' | 'ACRE';
    if (cap.carryingCapacity != null) payload.carryingCapacity = cap.carryingCapacity;
    if (cap.waterSourcesCount != null) payload.waterSources = cap.waterSourcesCount;
    if (cap.feedingStations != null) payload.feedingStations = cap.feedingStations;
    if (cap.shelters != null) payload.shelters = cap.shelters;
    if (cap.hasElectricity != null) payload.hasElectricity = cap.hasElectricity;
    if (cap.hasWater != null) payload.hasWater = cap.hasWater;
    if (cap.hasInternet != null) payload.hasInternet = cap.hasInternet;
    if (cap.hasRoadAccess != null) payload.hasRoadAccess = cap.hasRoadAccess;
    if (cap.securityLevel) payload.securityLevel = cap.securityLevel as 'LOW' | 'MEDIUM' | 'HIGH';
    return Object.keys(payload).length > 0 ? payload : null;
  }

  const saveMutation = useMutation({
    mutationFn: async (formData: FormValues) => {
      const locationPayload: LocationFormData = {
        locationCode: formData.locationCode,
        name: formData.name,
        ranchId: (activeRanchId || (editingLoc as any)?.ranchId)!,
        type: formData.type,
        coordinates: formData.coordinates,
        parentLocationId: formData.parentLocationId || undefined,
        soilType: formData.soilType || undefined,
        elevation: formData.elevation ?? undefined,
        slope: formData.slope ?? undefined,
        vegetation: formData.vegetation?.length ? formData.vegetation : undefined,
        waterSources: formData.waterSources?.length ? formData.waterSources as WaterSource[] : undefined,
        pastureQuality: (formData.pastureQuality as PastureQuality) || undefined,
        geofenceConfig: formData.geofenceConfig || undefined,
        status: formData.status || undefined,
      };

      const capPayload = buildCapacityPayload(formData.capacity);
      const isCreating = !editingLoc;

      // 1) Upsert the Location itself
      const locRes = editingLoc
        ? await locationsApi.update(editingLoc.id, locationPayload)
        : await locationsApi.create(locationPayload);

      const locId = locRes.data.data.id;

      // 2) If the user provided any capacity field, upsert the LocationCapacity record.
      //    On CREATE, if this step fails, ROLLBACK by deleting the freshly created Location
      //    so we don't leave an orphan without capacity. On UPDATE there's nothing to roll
      //    back (the location existed before).
      if (capPayload) {
        try {
          await locationsApi.upsertCapacity(locId, capPayload);
        } catch (capErr: any) {
          if (isCreating) {
            // Best-effort rollback. If it also fails we still surface the original error.
            let rollbackOk = true;
            try {
              await locationsApi.delete(locId);
            } catch {
              rollbackOk = false;
            }
            const reason =
              capErr?.response?.data?.error?.message ||
              capErr?.response?.data?.error ||
              'el backend rechazó la capacidad';
            const msg = rollbackOk
              ? `No se guardó la ubicación: ${reason}. Se revirtió la creación para no dejar un registro incompleto.`
              : `La ubicación se creó pero la capacidad falló (${reason}) y la reversión automática no pudo completarse. Contacta al administrador con este código de ubicación: ${formData.locationCode}.`;
            const err: any = new Error(msg);
            err.__handled = true; // signal to onError that we already composed the message
            throw err;
          }
          // On UPDATE: just bubble up the original error.
          throw capErr;
        }
      }

      return locRes;
    },
    onSuccess: () => {
      // Invalidate everything that depends on location OR capacity
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['ranch-aggregated-occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['ranch-summary'] });
      if (editingLoc) {
        queryClient.invalidateQueries({ queryKey: ['location', editingLoc.id] });
        queryClient.invalidateQueries({ queryKey: ['location-capacity', editingLoc.id] });
      }
      toast.success(
        editingLoc ? 'Ubicación actualizada' : 'Ubicación creada',
        editingLoc
          ? 'Los cambios y la capacidad fueron guardados correctamente.'
          : 'La ubicación fue registrada exitosamente.',
      );
      closeModal();
    },
    onError: (err: any) => {
      // Special-case POINT_OUTSIDE_RANCH_BOUNDARY: extract details from backend.
      const outside = getOutsideRanchBoundaryDetails(err);
      if (outside) {
        toast.error(
          `Punto fuera del rancho${outside.ranchName ? ` "${outside.ranchName}"` : ''}`,
          `Las coordenadas (${outside.point.latitude.toFixed(5)}, ${outside.point.longitude.toFixed(5)}) están fuera del perímetro. Ajusta el punto y vuelve a guardar.`,
        );
        return;
      }
      // If our mutationFn already composed a user-facing message (e.g. capacity rollback),
      // use it as-is. Otherwise extract from axios response.
      const msg = err?.__handled
        ? err.message
        : err?.response?.data?.error?.message || 'Verifica los datos e intenta de nuevo.';
      toast.error('Error al guardar', msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => locationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Ubicación eliminada', 'La ubicación fue eliminada correctamente.');
      setDeleteConfirm(null);
    },
    onError: (err: any) => {
      toast.error('Error al eliminar', err?.response?.data?.error?.message || 'No se pudo eliminar la ubicación.');
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────

  function openCreate() {
    setEditingLoc(null);
    form.reset(getDefaultValues(activeRanchId || ''));
    setShowAdvanced(false);
    setShowGeofence(false);
    setShowCapacity(false);
    setModalOpen(true);
  }

  function openEdit(loc: Location) {
    setEditingLoc(loc);
    // Seed Location fields immediately; capacity will be merged in via useEffect
    // once the /capacity query resolves.
    form.reset(locationToFormValues(loc, activeRanchId || '', null));
    setShowAdvanced(!!(loc.soilType || loc.elevation || loc.slope || loc.vegetation?.length || loc.waterSources?.length));
    setShowGeofence(!!loc.geofenceConfig);
    setShowCapacity(false); // will auto-expand in the effect if capacity exists
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingLoc(null);
    setShowCapacity(false);
    form.reset(getDefaultValues(activeRanchId || ''));
  }

  const handleVegetationToggle = useCallback(
    (veg: string) => {
      const current = form.getValues('vegetation') || [];
      const updated = current.includes(veg)
        ? current.filter((v) => v !== veg)
        : [...current, veg];
      form.setValue('vegetation', updated, { shouldDirty: true });
    },
    [form],
  );

  // ── Stats ──────────────────────────────────────────────────────────────

  const activeCount = items.filter((l) => l.status === 'ACTIVE').length;

  // KPI #1 — Aggregated (sum across listed locations, computed locally from inline capacity).
  // NOTE: this aggregates the CURRENT page only. For accurate ranch-wide totals when
  // pagination is on, the backend should return totals in the list payload (future work).
  const aggCurrent = items.reduce((s, l) => s + (l.capacity?.currentAnimals ?? 0), 0);
  const aggMax     = items.reduce((s, l) => s + (l.capacity?.maxAnimals ?? 0), 0);
  const locsWithCap = items.filter((l) => l.capacity != null).length;
  const locsTotal   = data?.total ?? items.length;
  // Weighted average occupancy across locations that DO have capacity.
  const aggPct      = aggMax > 0 ? (aggCurrent / aggMax) * 100 : 0;

  // KPI #2 — Ranch-level (Ranch.maxCattleCapacity + live currentCattleCount from backend).
  const ranchCurrent = ranchSummary?.currentCattleCount ?? 0;
  const ranchMax     = ranchSummary?.maxCattleCapacity ?? 0;
  const ranchPct     = ranchSummary?.occupancyRate ?? 0;

  // Desincronización: ambos valores existen y difieren >5%
  const capacityMismatch =
    ranchMax > 0 && aggMax > 0 && Math.abs(ranchMax - aggMax) / Math.max(ranchMax, aggMax) > 0.05;
  const animalsMismatch =
    (ranchCurrent > 0 || aggCurrent > 0) && Math.abs(ranchCurrent - aggCurrent) > Math.max(1, ranchCurrent * 0.05);

  const mapMarkers = items
    .filter((l) => l.coordinates)
    .map((l) => {
      const cap = capacityByLocationId.get(l.id);
      const popup = cap && cap.maxAnimals > 0
        ? `${typeLabels[l.type] || l.type} — ${cap.currentAnimals}/${cap.maxAnimals} (${cap.percentage.toFixed(0)}%)`
        : `${typeLabels[l.type] || l.type} — sin capacidad configurada`;
      return {
        id: l.id,
        lat: l.coordinates!.latitude,
        lng: l.coordinates!.longitude,
        label: l.name,
        popup,
      };
    });

  // ── Table columns ──────────────────────────────────────────────────────

  const columns: Column<Location>[] = [
    {
      key: 'name',
      header: 'Ubicación',
      render: (loc) => {
        const Icon = typeIcons[loc.type] || MapPin;
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{loc.name}</p>
              <p className="text-xs text-gray-500">{loc.locationCode}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (loc) => <Badge variant="info">{typeLabels[loc.type] || loc.type}</Badge>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (loc) => (
        <Badge variant={statusVariant[loc.status] || 'default'}>
          {statusLabels[loc.status] || loc.status}
        </Badge>
      ),
    },
    {
      key: 'occupancy',
      header: 'Ocupación',
      render: (loc) => {
        const cap = capacityByLocationId.get(loc.id);
        if (!cap || cap.maxAnimals === 0) {
          return <span className="text-xs text-gray-400">Sin capacidad</span>;
        }
        const pct = cap.percentage;
        return (
          <div className="space-y-1">
            <span className="text-sm">{cap.currentAnimals} / {cap.maxAnimals}</span>
            <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'pastureQuality',
      header: 'Calidad',
      render: (loc) => {
        if (!loc.pastureQuality) return <span className="text-sm text-gray-400">—</span>;
        const colorMap: Record<string, string> = {
          EXCELLENT: 'success', GOOD: 'info', FAIR: 'warning', POOR: 'danger',
        };
        return <Badge variant={(colorMap[loc.pastureQuality] || 'default') as any}>{loc.pastureQuality}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32',
      render: (loc) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/locations/${loc.id}`); }}
            className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400"
            title="Ver detalle"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(loc); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(loc); }}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) return <PageLoader />;

  const errorMessage = saveMutation.error
    ? ((saveMutation.error as any)?.response?.data?.error?.details?.fieldErrors?.[0]?.message
      || 'Error al guardar la ubicación. Verifica los datos e intenta de nuevo.')
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <MapPin className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ubicaciones</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gestión de potreros, corrales y áreas del rancho</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            icon={<BarChart3 className="w-4 h-4" />}
          >
            Tabla
          </Button>
          <Button
            variant={viewMode === 'map' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('map')}
            icon={<MapPin className="w-4 h-4" />}
          >
            Mapa
          </Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/locations/new')}>
            Nueva Ubicación
          </Button>
        </div>
      </div>

      {/* Global ranch filter — affects table, map and KPIs */}
      {showRanchFilter && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
          <Home className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
            Filtrar por rancho:
          </span>
          <div className="flex-1 max-w-sm">
            <RanchSelector
              value={activeRanchId}
              onChange={(rid) => setActiveRanch(rid)}
              placeholder="Todos los ranchos"
              clearable
              label=""
            />
          </div>
          {activeRanchId && (
            <span className="text-xs text-gray-500 shrink-0 hidden md:inline">
              Mostrando solo ubicaciones de este rancho.
            </span>
          )}
        </div>
      )}

      {/* Stats — top row: counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Ubicaciones" value={locsTotal} icon={MapPin} color="primary" />
        <StatCard title="Activas" value={activeCount} icon={MapPin} color="emerald" />
        <StatCard
          title="Con capacidad configurada"
          value={`${locsWithCap}/${locsTotal}`}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Con Geocerca"
          value={items.filter((l) => l.geofenceConfig).length}
          icon={Layers}
          color="amber"
        />
      </div>

      {/* Ocupación — dual view (por ubicaciones vs por rancho) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Por suma de ubicaciones (real) */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Ocupación por ubicaciones
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Σ LocationCapacity — dato real en terreno
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {aggCurrent}
            </span>
            <span className="text-lg text-gray-400">/ {aggMax || '—'}</span>
            <span className="ml-auto text-sm font-semibold text-gray-600 dark:text-gray-300">
              {aggMax > 0 ? `${aggPct.toFixed(1)}%` : '—'}
            </span>
          </div>
          <div className="mt-3 h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                aggPct >= 90 ? 'bg-red-500' : aggPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(aggPct, 100)}%` }}
            />
          </div>
          {locsTotal > locsWithCap && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {locsTotal - locsWithCap} ubicación{locsTotal - locsWithCap !== 1 ? 'es' : ''} sin capacidad configurada
            </p>
          )}
        </div>

        {/* Por rancho (capacidad registrada en Ranch) */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Capacidad registrada del rancho
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Ranch.maxCattleCapacity — valor manual en el rancho
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <Warehouse className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          {effectiveRanchId ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {ranchCurrent}
                </span>
                <span className="text-lg text-gray-400">/ {ranchMax || '—'}</span>
                <span className="ml-auto text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {ranchMax > 0 ? `${ranchPct.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="mt-3 h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    ranchPct >= 90 ? 'bg-red-500' : ranchPct >= 70 ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(ranchPct, 100)}%` }}
                />
              </div>
              {ranchSummary?.cattleDensity != null && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Densidad: {ranchSummary.cattleDensity.toFixed(2)} animales/ha
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-2">
              Selecciona un rancho activo para ver su capacidad declarada.
            </p>
          )}
        </div>
      </div>

      {/* Aviso de desincronización si los dos totales no cuadran */}
      {(capacityMismatch || animalsMismatch) && (
        <Alert variant="warning">
          <div className="space-y-1">
            <p className="font-semibold">Datos desincronizados</p>
            <p className="text-sm">
              La capacidad registrada del rancho ({ranchMax} animales) y la suma de capacidades por ubicación ({aggMax} animales) no coinciden.
              {' '}El valor real en terreno es el de las ubicaciones ({aggCurrent} animales actuales).
            </p>
          </div>
        </Alert>
      )}

      {/* Content */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(l) => l.id}
          page={page}
          totalPages={data?.totalPages || 1}
          total={data?.total || 0}
          onPageChange={setPage}
        />
      ) : (
        <MapView markers={mapMarkers} className="h-[600px] w-full" />
      )}

      {/* ── Create/Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingLoc ? 'Editar Ubicación' : 'Nueva Ubicación'}
        size="xl"
      >
        {errorMessage && <Alert variant="error" className="mb-4">{errorMessage}</Alert>}

        <form
          onSubmit={form.handleSubmit((d) => {
            // Validación: si el usuario provee algún campo de capacidad y NO existe
            // aún un registro LocationCapacity para esta ubicación, maxAnimals Y area
            // son obligatorios (el backend exige ambos al crear LocationCapacity por
            // primera vez — schema canónico: area DECIMAL(12,2) > 0 + maxAnimals ≥ 0).
            const cap = buildCapacityPayload(d.capacity);
            const hasExistingCapacity = !!editingCapacity;
            if (cap && !hasExistingCapacity) {
              const missing: string[] = [];
              if (cap.maxAnimals == null || cap.maxAnimals <= 0) {
                form.setError('capacity.maxAnimals', {
                  type: 'manual',
                  message: 'Capacidad máxima es obligatoria al definir la capacidad por primera vez',
                });
                missing.push('maxAnimals');
              }
              if (cap.area == null || cap.area <= 0) {
                form.setError('capacity.area', {
                  type: 'manual',
                  message: 'Área es obligatoria al definir la capacidad por primera vez (debe ser > 0)',
                });
                missing.push('area');
              }
              if (missing.length > 0) {
                setShowCapacity(true);
                return;
              }
            }

            // Validación cruzada: maxAnimals + Σ hermanos ≤ Ranch.maxCattleCapacity
            // El backend ya valida esto, pero detectarlo aquí evita el roundtrip y
            // muestra un mensaje específico antes de enviar.
            if (cap && cap.maxAnimals != null && cap.maxAnimals > 0) {
              const targetRanchId = editingLoc?.ranchId || activeRanchId;
              const ranchMaxAvailable = ranchSummary?.maxCattleCapacity ?? 0;
              if (targetRanchId && ranchMaxAvailable > 0) {
                const siblingsSum = items
                  .filter((l) => l.ranchId === targetRanchId && l.id !== editingLoc?.id)
                  .reduce((s, l) => s + (l.capacity?.maxAnimals ?? 0), 0);
                const totalIfSaved = siblingsSum + cap.maxAnimals;
                if (totalIfSaved > ranchMaxAvailable) {
                  const overflow = totalIfSaved - ranchMaxAvailable;
                  form.setError('capacity.maxAnimals', {
                    type: 'manual',
                    message: `Excede la capacidad del rancho en ${overflow} animales. Disponible: ${Math.max(0, ranchMaxAvailable - siblingsSum)} (rancho: ${ranchMaxAvailable}, ya asignado en otras ubicaciones: ${siblingsSum}).`,
                  });
                  setShowCapacity(true);
                  return;
                }
              }
            }

            saveMutation.mutate(d);
          })}
          className="space-y-6 max-h-[70vh] overflow-y-auto pr-1"
        >
          {/* ── Sección 1: Identidad ──────────────────────────────────────── */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-600" />
              Identificación
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Código *"
                placeholder="LOC-001"
                error={form.formState.errors.locationCode?.message}
                {...form.register('locationCode')}
              />
              <Input
                label="Nombre *"
                placeholder="Potrero Norte"
                error={form.formState.errors.name?.message}
                {...form.register('name')}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Select
                label="Tipo *"
                options={locationTypeOptions}
                placeholder="Selecciona tipo"
                error={form.formState.errors.type?.message}
                {...form.register('type')}
              />
              <Select
                label="Estado"
                options={locationStatusOptions}
                error={form.formState.errors.status?.message}
                {...form.register('status')}
              />
            </div>
          </fieldset>

          {/* ── Sección 2: Coordenadas ────────────────────────────────────── */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-600" />
              Ubicación en Mapa
            </legend>
            <Controller
              name="coordinates"
              control={form.control}
              render={({ field, fieldState }) => (
                <MapPicker
                  label="Coordenadas *"
                  value={field.value.latitude !== 0 || field.value.longitude !== 0 ? field.value : null}
                  onChange={(coords: Coordinates) => field.onChange(coords)}
                  error={fieldState.error?.message || (form.formState.errors.coordinates as any)?.root?.message}
                  className="h-[250px]"
                />
              )}
            />
          </fieldset>

          {/* ── Sección 3: Terreno y Pastoreo ─────────────────────────────── */}
          <fieldset>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3"
            >
              <TreePine className="w-4 h-4 text-primary-600" />
              Terreno, Pastoreo y Agua
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {showAdvanced && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Select
                    label="Tipo de Suelo"
                    options={soilTypeOptions}
                    {...form.register('soilType')}
                  />
                  <Select
                    label="Calidad del Pastizal"
                    options={pastureQualityOptions}
                    {...form.register('pastureQuality')}
                  />
                  <Input
                    label="Elevación (msnm)"
                    type="number"
                    step="0.1"
                    min={-100}
                    max={6000}
                    placeholder="850"
                    {...form.register('elevation')}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Pendiente (grados)"
                    type="number"
                    step="0.1"
                    min={0}
                    max={90}
                    placeholder="5"
                    {...form.register('slope')}
                  />
                </div>

                {/* Vegetation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vegetación Predominante
                  </label>
                  <Controller
                    name="vegetation"
                    control={form.control}
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-1.5">
                        {VEGETATION_OPTIONS.map((veg) => (
                          <button
                            key={veg}
                            type="button"
                            onClick={() => handleVegetationToggle(veg)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              (field.value || []).includes(veg)
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400'
                            }`}
                          >
                            {veg}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>

                {/* Water Sources */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Droplets className="w-4 h-4" />
                      Fuentes de Agua
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<Plus className="w-3 h-3" />}
                      onClick={() => appendWater({ type: 'WELL', name: '', capacity: undefined, quality: undefined })}
                    >
                      Agregar
                    </Button>
                  </div>
                  {waterFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 mb-2 items-end">
                      <Select
                        label={index === 0 ? 'Tipo' : undefined}
                        options={waterSourceTypeOptions}
                        {...form.register(`waterSources.${index}.type`)}
                      />
                      <Input
                        label={index === 0 ? 'Nombre' : undefined}
                        placeholder="Pozo principal"
                        error={form.formState.errors.waterSources?.[index]?.name?.message}
                        {...form.register(`waterSources.${index}.name`)}
                      />
                      <Input
                        label={index === 0 ? 'Capacidad (L)' : undefined}
                        type="number"
                        placeholder="5000"
                        className="w-28"
                        {...form.register(`waterSources.${index}.capacity`)}
                      />
                      <Select
                        label={index === 0 ? 'Calidad' : undefined}
                        options={[
                          { value: '', label: '—' },
                          { value: 'EXCELLENT', label: 'Excelente' },
                          { value: 'GOOD', label: 'Buena' },
                          { value: 'FAIR', label: 'Regular' },
                          { value: 'POOR', label: 'Pobre' },
                        ]}
                        {...form.register(`waterSources.${index}.quality`)}
                      />
                      <button
                        type="button"
                        onClick={() => removeWater(index)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          {/* ── Sección 3.5: Capacidad y Servicios ────────────────────────── */}
          <fieldset>
            <button
              type="button"
              onClick={() => setShowCapacity(!showCapacity)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3"
            >
              <Gauge className="w-4 h-4 text-primary-600" />
              Capacidad y Servicios
              {showCapacity ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {showCapacity && (
              <div className="space-y-4">
                {loadingEditingCap && editingLoc && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Cargando datos de capacidad…
                  </div>
                )}

                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  El campo <strong>animales actuales</strong> no se edita aquí: se gestiona automáticamente al mover bovinos de una ubicación a otra.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Capacidad máxima (animales)"
                    type="number"
                    min={0}
                    placeholder="Ej. 150"
                    {...form.register('capacity.maxAnimals')}
                    error={form.formState.errors.capacity?.maxAnimals?.message}
                  />
                  <Input
                    label="Carga animal (UA/ha)"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Ej. 1.5"
                    {...form.register('capacity.carryingCapacity')}
                    error={form.formState.errors.capacity?.carryingCapacity?.message}
                  />
                  <Input
                    label="Área"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Ej. 25"
                    {...form.register('capacity.area')}
                    error={form.formState.errors.capacity?.area?.message}
                  />
                  <Select
                    label="Unidad de área"
                    placeholder="— Seleccionar —"
                    options={[
                      { value: 'M2', label: 'm²' },
                      { value: 'HA', label: 'Hectáreas' },
                      { value: 'ACRE', label: 'Acres' },
                    ]}
                    {...form.register('capacity.areaUnit')}
                  />
                  <Input
                    label="Fuentes de agua (#)"
                    type="number"
                    min={0}
                    placeholder="0"
                    {...form.register('capacity.waterSourcesCount')}
                    error={form.formState.errors.capacity?.waterSourcesCount?.message}
                  />
                  <Input
                    label="Estaciones de alimentación (#)"
                    type="number"
                    min={0}
                    placeholder="0"
                    {...form.register('capacity.feedingStations')}
                    error={form.formState.errors.capacity?.feedingStations?.message}
                  />
                  <Input
                    label="Refugios / sombras (#)"
                    type="number"
                    min={0}
                    placeholder="0"
                    {...form.register('capacity.shelters')}
                    error={form.formState.errors.capacity?.shelters?.message}
                  />
                  <Select
                    label="Nivel de seguridad"
                    placeholder="— Seleccionar —"
                    options={[
                      { value: 'LOW', label: 'Bajo' },
                      { value: 'MEDIUM', label: 'Medio' },
                      { value: 'HIGH', label: 'Alto' },
                    ]}
                    {...form.register('capacity.securityLevel')}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" {...form.register('capacity.hasElectricity')} className="rounded" />
                    <Zap className="w-4 h-4 text-amber-500" />
                    Electricidad
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" {...form.register('capacity.hasWater')} className="rounded" />
                    <Droplets className="w-4 h-4 text-sky-500" />
                    Agua
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" {...form.register('capacity.hasInternet')} className="rounded" />
                    <Wifi className="w-4 h-4 text-blue-500" />
                    Internet
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" {...form.register('capacity.hasRoadAccess')} className="rounded" />
                    <Route className="w-4 h-4 text-gray-500" />
                    Acceso vial
                  </label>
                </div>
              </div>
            )}
          </fieldset>

          {/* ── Sección 4: Geocerca ───────────────────────────────────────── */}
          <fieldset>
            <button
              type="button"
              onClick={() => setShowGeofence(!showGeofence)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3"
            >
              <Layers className="w-4 h-4 text-primary-600" />
              Configurar Geocerca
              {showGeofence ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {showGeofence && (
              <Controller
                name="geofenceConfig"
                control={form.control}
                render={({ field }) => (
                  <GeofenceDrawer
                    value={field.value as GeofenceConfig | null}
                    onChange={(config) => field.onChange(config)}
                    mapCenter={
                      form.watch('coordinates')?.latitude
                        ? { lat: form.watch('coordinates').latitude, lng: form.watch('coordinates').longitude }
                        : undefined
                    }
                    // Phase 6 — geocerca debe contener el pin de la ubicación
                    requiredPoint={
                      form.watch('coordinates')?.latitude
                        ? {
                            latitude:  form.watch('coordinates').latitude,
                            longitude: form.watch('coordinates').longitude,
                          }
                        : null
                    }
                    requiredPointLabel="Pin de la ubicación"
                    areaForRectangle={
                      (() => {
                        const cap = form.watch('capacity');
                        if (!cap || !cap.area || cap.area <= 0) return null;
                        const unit = (cap.areaUnit as 'HA' | 'M2' | 'ACRE') || 'HA';
                        return { area: cap.area, unit };
                      })()
                    }
                    className="h-[350px]"
                  />
                )}
              />
            )}
          </fieldset>

          {/* ── Form Actions ──────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {editingLoc ? 'Guardar Cambios' : 'Crear Ubicación'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar Eliminación"
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          ¿Estás seguro de que deseas eliminar{' '}
          <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.locationCode})?
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
