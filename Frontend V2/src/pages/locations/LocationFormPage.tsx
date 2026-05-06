import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { locationsApi } from '@/api/locations.api';
import type { LocationCapacityPayload } from '@/api/locations.api';
import { ranchApi } from '@/api/ranch.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { getFriendlyMessage, getOutsideRanchBoundaryDetails } from '@/utils/errorHandler';
import {
  checkPointVsRanch, checkPointVsParent, isPointInBoundary,
  areaToRadiusMeters, PARENT_FALLBACK_RADIUS_M,
  ZONE_STYLES,
} from '@/utils/geoValidation';
import type { ParentZone } from '@/utils/geoValidation';
import { cn } from '@/utils/cn';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { RanchSelector } from '@/components/ui/RanchSelector';
import { MapPicker } from '@/components/maps/MapPicker';
import { GeofenceDrawer } from '@/components/maps/GeofenceDrawer';
import type { Coordinates } from '@/components/maps/MapPicker';
import { LocationType, LocationStatus, PastureQuality } from '@/types/location.types';
import type { Location, LocationFormData, WaterSource } from '@/types';
import {
  ArrowLeft, ArrowRight, Check, Save, MapPin, Layers,
  Droplets, Leaf, Plus, Trash2, Info, Users, Home,
  AlertTriangle, ChevronDown, ChevronUp,
  Gauge, Zap, Wifi, Route,
} from 'lucide-react';

// ─── Options ──────────────────────────────────────────────────────────────────

const LOCATION_TYPE_OPTIONS = [
  { value: LocationType.PASTURE,           label: 'Potrero' },
  { value: LocationType.CORRAL,            label: 'Corral' },
  { value: LocationType.BARN,              label: 'Establo' },
  { value: LocationType.MILKING_PARLOR,    label: 'Sala de Ordeño' },
  { value: LocationType.FEED_AREA,         label: 'Área de Alimentación' },
  { value: LocationType.WATER_SOURCE,      label: 'Fuente de Agua' },
  { value: LocationType.VETERINARY_CLINIC, label: 'Clínica Veterinaria' },
  { value: LocationType.QUARANTINE_AREA,   label: 'Cuarentena' },
  { value: LocationType.LOADING_AREA,      label: 'Área de Carga' },
  { value: LocationType.STORAGE,           label: 'Almacén' },
  { value: LocationType.OFFICE,            label: 'Oficina' },
  { value: LocationType.RESIDENTIAL,       label: 'Residencial' },
  { value: LocationType.BREEDING_CENTER,   label: 'Centro de Reproducción' },
  { value: LocationType.EQUIPMENT_SHED,    label: 'Bodega de Equipos' },
  { value: LocationType.ENTRANCE_GATE,     label: 'Puerta de Entrada' },
  { value: LocationType.RESTRICTED_AREA,   label: 'Área Restringida' },
  { value: LocationType.DANGER_ZONE,       label: 'Zona de Peligro' },
  { value: LocationType.SAFE_ZONE,         label: 'Zona Segura' },
  { value: LocationType.ROUTE,             label: 'Ruta' },
  { value: LocationType.OTHER,             label: 'Otro' },
];

const LOCATION_STATUS_OPTIONS = [
  { value: LocationStatus.ACTIVE,             label: 'Activa' },
  { value: LocationStatus.INACTIVE,           label: 'Inactiva' },
  { value: LocationStatus.UNDER_CONSTRUCTION, label: 'En Construcción' },
  { value: LocationStatus.UNDER_MAINTENANCE,  label: 'En Mantenimiento' },
  { value: LocationStatus.QUARANTINED,        label: 'En Cuarentena' },
  { value: LocationStatus.CLOSED,             label: 'Cerrada' },
  { value: LocationStatus.RESTRICTED,         label: 'Restringida' },
];

const PASTURE_QUALITY_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: PastureQuality.EXCELLENT, label: 'Excelente' },
  { value: PastureQuality.GOOD,      label: 'Buena' },
  { value: PastureQuality.FAIR,      label: 'Regular' },
  { value: PastureQuality.POOR,      label: 'Pobre' },
];

const SOIL_TYPE_OPTIONS = [
  { value: '',        label: 'Sin especificar' },
  { value: 'CLAY',    label: 'Arcilloso' },
  { value: 'SANDY',   label: 'Arenoso' },
  { value: 'LOAM',    label: 'Franco' },
  { value: 'SILT',    label: 'Limoso' },
  { value: 'ROCKY',   label: 'Rocoso' },
  { value: 'ORGANIC', label: 'Orgánico' },
  { value: 'MIXED',   label: 'Mixto' },
];

const WATER_SOURCE_TYPE_OPTIONS = [
  { value: 'WELL',   label: 'Pozo' },
  { value: 'RIVER',  label: 'Río' },
  { value: 'POND',   label: 'Estanque' },
  { value: 'STREAM', label: 'Arroyo' },
  { value: 'SPRING', label: 'Manantial' },
  { value: 'TANK',   label: 'Tanque' },
];

const WATER_QUALITY_OPTIONS = [
  { value: '',          label: 'Sin especificar' },
  { value: 'EXCELLENT', label: 'Excelente' },
  { value: 'GOOD',      label: 'Buena' },
  { value: 'FAIR',      label: 'Regular' },
  { value: 'POOR',      label: 'Pobre' },
];

const VEGETATION_PRESETS = [
  'Pasto Bermuda', 'Pasto Estrella', 'Pasto Pangola', 'Pasto Guinea',
  'Pasto Jaragua', 'Pasto Brachiaria', 'Pasto Buffel', 'Leguminosas',
  'Arbustos', 'Árboles de sombra', 'Cercas vivas',
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const waterSourceSchema = z.object({
  type:     z.enum(['WELL', 'RIVER', 'POND', 'STREAM', 'SPRING', 'TANK']),
  name:     z.string().min(1, 'Nombre requerido'),
  capacity: z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().positive().optional()),
  quality:  z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).optional().or(z.literal('')),
});

const locationFormSchema = z.object({
  // Step 1 — Identificación
  locationCode:     z.string().min(3, 'Mínimo 3 caracteres').max(50, 'Máximo 50 caracteres')
                      .regex(/^[A-Za-z0-9-]+$/, 'Solo letras, números y guiones')
                      .transform((v) => v.toUpperCase()),
  name:             z.string().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  type:             z.nativeEnum(LocationType, { error: 'Selecciona un tipo' }),
  status:           z.nativeEnum(LocationStatus).optional().default(LocationStatus.ACTIVE),
  description:      z.string().max(500).optional().or(z.literal('')),
  parentLocationId: z.string().optional().or(z.literal('')),
  capacity:         z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().int().min(1, 'Mínimo 1 animal').max(100000).optional(),
  ),

  // Step 2 — Geografía
  coordinates: z.object({
    latitude:  z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  area:           z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().positive().optional()),
  areaUnit:       z.enum(['ha', 'm2', 'acres']).optional().default('ha'),
  soilType:       z.string().optional().or(z.literal('')),
  elevation:      z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().optional()),
  slope:          z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().min(0).max(100).optional()),
  pastureQuality: z.string().optional().or(z.literal('')),
  vegetation:     z.array(z.string()).optional().default([]),
  waterSources:   z.array(waterSourceSchema).optional().default([]),
  geofenceConfig: z.any().optional(),

  // Step 2 — Capacidad y Servicios (LocationCapacity table)
  carryingCapacity:  z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().min(0).optional()),
  feedingStations:   z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().int().min(0).optional()),
  shelters:          z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().int().min(0).optional()),
  hasElectricity:    z.boolean().optional(),
  hasWater:          z.boolean().optional(),
  hasInternet:       z.boolean().optional(),
  hasRoadAccess:     z.boolean().optional(),
  securityLevel:     z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof locationFormSchema>;

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Identificación', icon: Info },
  { id: 2, label: 'Geografía',      icon: MapPin },
  { id: 3, label: 'Revisión',       icon: Check },
];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = s.id < current;
        const active = s.id === current;
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all',
                done   ? 'bg-primary-600 border-primary-600 text-white'
                       : active ? 'bg-white dark:bg-gray-900 border-primary-600 text-primary-600'
                       : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400',
              )}>
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={cn(
                'text-xs font-medium whitespace-nowrap',
                active ? 'text-primary-700 dark:text-primary-400' : done ? 'text-primary-600 dark:text-primary-500' : 'text-gray-400',
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-2 mb-5',
                done ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── FieldLabel ───────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-500">{msg}</p>;
}

// ─── ReviewRow ────────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
      <span className="shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-36">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

// ─── LocationFormPage ─────────────────────────────────────────────────────────

export function LocationFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const toast     = useToast();
  const { activeRanchId, activeRanchName, user } = useAuth();
  const queryClient = useQueryClient();

  const isEdit = !!id;
  const [step, setStep] = useState(1);

  // Distance thresholds (km) — derived from ranch.boundaryRadius (Capa 3)
  // If the ranch has a configured boundaryRadius, use it as the warn threshold
  // and 2.4× as the block threshold (mirrors the 25/60 default ratio).
  // Falls back to 25/60 when the ranch hasn't set a boundary radius yet.

  // SUPER_ADMIN or users without an active ranch must pick one manually.
  // When the URL carries `?ranchId=<uuid>` (deep-link from RanchDetailPage's
  // "+ Nueva ubicación" button), preselect that ranch instead.
  const [searchParams] = useSearchParams();
  const ranchIdFromQuery = searchParams.get('ranchId');
  const [selectedRanchId, setSelectedRanchId] = useState<string | null>(
    ranchIdFromQuery || activeRanchId,
  );
  const [ranchError, setRanchError] = useState('');
  const needsRanchPicker = !activeRanchId || user?.role === 'SUPER_ADMIN';
  const [showGeofence, setShowGeofence] = useState(false);
  const [showWaterSources, setShowWaterSources] = useState(false);
  const [showCapacitySection, setShowCapacitySection] = useState(false);
  const [customVeg, setCustomVeg] = useState('');

  // Distance-override: user explicitly confirms placement outside safe zone
  const [distanceOverride, setDistanceOverride] = useState(false);

  // Fetch active ranch info — lightweight via the dedicated /boundary endpoint.
  // We also need `maxCattleCapacity` for the cross-capacity validation, so we
  // run a second small query against /summary (which now exposes boundary too,
  // but `getBoundary` is even lighter for the geo concerns).
  const effectiveRanchId = selectedRanchId || activeRanchId;
  const { data: ranchBoundaryRes } = useQuery({
    queryKey: ['ranch-boundary', effectiveRanchId],
    queryFn: () => ranchApi.getBoundary(effectiveRanchId!),
    enabled: !!effectiveRanchId,
    staleTime: 1000 * 60 * 10,
  });
  const ranchInfo = ranchBoundaryRes?.data?.data;
  const ranchCenter = ranchInfo?.coordinates ?? null;
  const ranchDisplayName = ranchInfo?.name ?? activeRanchName ?? undefined;
  const ranchBoundaryRadius = ranchInfo?.boundaryRadius;
  // Phase B — real ranch boundary (polygon/rectangle/circle/corridor).
  // When configured, takes precedence over the legacy boundaryRadius circle.
  const ranchBoundary = ranchInfo?.boundary ?? null;

  // Capacity-side info (for cross-validation against ranch.maxCattleCapacity).
  // Cached separately with longer staleTime — capacity changes are rare.
  const { data: ranchSummaryRes } = useQuery({
    queryKey: ['ranch-summary-form', effectiveRanchId],
    queryFn: () => ranchApi.getSummary(effectiveRanchId!),
    enabled: !!effectiveRanchId,
    staleTime: 1000 * 60 * 10,
  });
  const ranchMaxCapacity = ranchSummaryRes?.data?.data?.maxCattleCapacity ?? 0;
  /** Warn threshold: ranch's configured radius, or 25 km default */
  const WARN_KM  = ranchBoundaryRadius ?? 25;
  /** Block threshold: 2.4× warn (preserves the default 25/60 ratio) */
  const BLOCK_KM = ranchBoundaryRadius ? Math.round(ranchBoundaryRadius * 2.4) : 60;

  // Fetch existing location (edit mode)
  const { data: existingRes, isLoading: loadingExisting } = useQuery({
    queryKey: ['location', id],
    queryFn: () => locationsApi.getById(id!),
    enabled: isEdit,
    staleTime: 1000 * 60,
  });
  const existing: Location | undefined = existingRes?.data?.data;

  // Fetch parent location options
  const { data: locList } = useQuery({
    queryKey: ['locations-list-form'],
    queryFn: () => locationsApi.list({ limit: 100 } as any).then((r) => r.items),
    staleTime: 1000 * 60 * 5,
  });
  // Parent options are filtered to the SAME ranch as the location being created/edited.
  // (effectiveRanchId is computed below from selectedRanchId/activeRanchId — defined here
  // for early use; the constant is computed again later for ranchRes query.)
  const parentRanchScopeId = selectedRanchId || activeRanchId || (existing as any)?.ranchId || null;
  const parentOptions = (locList ?? [])
    .filter((l) => l.id !== id)
    .filter((l) => !parentRanchScopeId || l.ranchId === parentRanchScopeId)
    .map((l) => ({ value: l.id, label: `${l.name} [${l.locationCode}]` }));
  // Whether the parent dropdown can be used at all (need a ranch context first).
  const parentDropdownDisabled = !parentRanchScopeId;

  // Form
  const {
    register, handleSubmit, control, watch, setValue, getValues, trigger, setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(locationFormSchema) as any,
    defaultValues: {
      locationCode:     '',
      name:             '',
      type:             LocationType.PASTURE,
      status:           LocationStatus.ACTIVE,
      description:      '',
      parentLocationId: '',
      capacity:         undefined,
      coordinates:      undefined,
      area:             undefined,
      areaUnit:         'ha',
      soilType:         '',
      elevation:        undefined,
      slope:            undefined,
      pastureQuality:   '',
      vegetation:       [],
      waterSources:     [],
      geofenceConfig:   undefined,
      // capacity sub-fields
      carryingCapacity: undefined,
      feedingStations:  undefined,
      shelters:         undefined,
      hasElectricity:   false,
      hasWater:         false,
      hasInternet:      false,
      hasRoadAccess:    false,
      securityLevel:    '',
    },
  });

  // Fetch capacity record when editing (separate from Location)
  const { data: existingCapacity } = useQuery({
    queryKey: ['location-capacity', id],
    queryFn: () => locationsApi.getCapacity(id!),
    enabled: !!id && isEdit,
    staleTime: 0,
  });

  const { fields: waterFields, append: appendWater, remove: removeWater } = useFieldArray({
    control,
    name: 'waterSources',
  });

  const vegetationValue   = watch('vegetation') ?? [];
  const coordsValue       = watch('coordinates');
  const parentLocationId  = watch('parentLocationId');

  // Phase A — Build the hierarchical safe zone from the selected parent.
  // Center: parent.coordinates. Radius: derived from parent.capacity.area, or
  // PARENT_FALLBACK_RADIUS_M (1 km) if the parent has no area configured.
  const parentZone: ParentZone | null = useMemo(() => {
    if (!parentLocationId) return null;
    const parent = (locList ?? []).find((l) => l.id === parentLocationId);
    if (!parent || !parent.coordinates) return null;
    const area    = parent.capacity?.area ?? null;
    const areaUnit = parent.capacity?.areaUnit ?? null;
    const derivedR = area && area > 0 ? areaToRadiusMeters(area, areaUnit) : 0;
    const radiusM  = derivedR > 0 ? derivedR : PARENT_FALLBACK_RADIUS_M;
    return {
      center: {
        latitude:  parent.coordinates.latitude,
        longitude: parent.coordinates.longitude,
      },
      radiusM,
      name: parent.name,
      derivedFromArea: derivedR > 0,
    };
  }, [parentLocationId, locList]);

  // Populate form when editing — Location table fields
  useEffect(() => {
    if (existing) {
      setValue('locationCode',     existing.locationCode);
      setValue('name',             existing.name);
      setValue('type',             existing.type);
      setValue('status',           existing.status);
      setValue('description',      (existing as any).description ?? '');
      setValue('parentLocationId', existing.parentLocationId ?? '');
      setValue('coordinates',      existing.coordinates?.latitude ? existing.coordinates : undefined);
      setValue('soilType',         existing.soilType ?? '');
      setValue('elevation',        existing.elevation);
      setValue('slope',            existing.slope);
      setValue('pastureQuality',   existing.pastureQuality ?? '');
      setValue('vegetation',       existing.vegetation ?? []);
      setValue('waterSources',     (existing.waterSources ?? []) as any);
      setValue('geofenceConfig',   existing.geofenceConfig);
      if (existing.waterSources && existing.waterSources.length > 0) setShowWaterSources(true);
      if (existing.geofenceConfig) setShowGeofence(true);
      if (existing.ranchId) setSelectedRanchId(existing.ranchId);
    }
  }, [existing, setValue]);

  // If the user changes the ranch and the currently selected parent belongs to a
  // different ranch, clear it to avoid orphan/cross-ranch parents.
  useEffect(() => {
    const current = getValues('parentLocationId');
    if (!current || !parentRanchScopeId || !Array.isArray(locList)) return;
    const stillValid = locList.some(
      (l) => l.id === current && l.ranchId === parentRanchScopeId,
    );
    if (!stillValid) setValue('parentLocationId', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentRanchScopeId, locList]);

  // Populate form when editing — LocationCapacity table fields
  useEffect(() => {
    if (existingCapacity) {
      setValue('capacity',         existingCapacity.maxAnimals);
      setValue('area',             existingCapacity.area);
      // Backend stores 'HA'/'M2'/'ACRE'; UI uses lowercase variants
      const unitMap: Record<string, 'ha' | 'm2' | 'acres'> = {
        HA: 'ha', M2: 'm2', ACRE: 'acres',
      };
      setValue('areaUnit', unitMap[existingCapacity.areaUnit ?? ''] ?? 'ha');
      setValue('carryingCapacity', existingCapacity.carryingCapacity);
      setValue('feedingStations',  existingCapacity.feedingStations);
      setValue('shelters',         existingCapacity.shelters);
      setValue('hasElectricity',   !!existingCapacity.hasElectricity);
      setValue('hasWater',         !!existingCapacity.hasWater);
      setValue('hasInternet',      !!existingCapacity.hasInternet);
      setValue('hasRoadAccess',    !!existingCapacity.hasRoadAccess);
      setValue('securityLevel',    (existingCapacity.securityLevel as any) ?? '');
      setShowCapacitySection(true);
    }
  }, [existingCapacity, setValue]);

  // Build the LocationCapacity payload from form values.
  // Returns null if user did not provide ANY capacity field (we skip the upsert).
  function buildCapacityPayload(data: FormValues): LocationCapacityPayload | null {
    const unitToBackend: Record<string, 'M2' | 'HA' | 'ACRE'> = {
      ha: 'HA', m2: 'M2', acres: 'ACRE',
    };
    const payload: LocationCapacityPayload = {};
    if (data.capacity != null)         payload.maxAnimals = data.capacity;
    if (data.area != null)             payload.area = data.area;
    if (data.area != null && data.areaUnit) payload.areaUnit = unitToBackend[data.areaUnit] ?? 'HA';
    if (data.carryingCapacity != null) payload.carryingCapacity = data.carryingCapacity;
    if (data.feedingStations != null)  payload.feedingStations = data.feedingStations;
    if (data.shelters != null)         payload.shelters = data.shelters;
    if (data.hasElectricity != null)   payload.hasElectricity = data.hasElectricity;
    if (data.hasWater != null)         payload.hasWater = data.hasWater;
    if (data.hasInternet != null)      payload.hasInternet = data.hasInternet;
    if (data.hasRoadAccess != null)    payload.hasRoadAccess = data.hasRoadAccess;
    if (data.securityLevel)            payload.securityLevel = data.securityLevel as 'LOW' | 'MEDIUM' | 'HIGH';
    return Object.keys(payload).length > 0 ? payload : null;
  }

  // Mutation — split into 2 sequential calls:
  //   1) POST/PUT /locations          (Location table)
  //   2) PATCH    /locations/:id/capacity (LocationCapacity table)
  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const locationPayload: Partial<LocationFormData> & { description?: string } = {
        locationCode:     data.locationCode,
        name:             data.name,
        ranchId:          (selectedRanchId || activeRanchId || (existing as any)?.ranchId)!,
        type:             data.type,
        status:           data.status,
        description:      data.description || undefined,
        parentLocationId: data.parentLocationId || undefined,
        coordinates:      data.coordinates?.latitude ? data.coordinates : undefined,
        soilType:         data.soilType || undefined,
        elevation:        data.elevation,
        slope:            data.slope,
        pastureQuality:   (data.pastureQuality as PastureQuality) || undefined,
        vegetation:       data.vegetation?.length ? data.vegetation : undefined,
        waterSources:     data.waterSources?.length ? data.waterSources as WaterSource[] : undefined,
        geofenceConfig:   data.geofenceConfig || undefined,
      };

      const capPayload = buildCapacityPayload(data);
      const isCreating = !isEdit;

      // 1) Upsert the Location itself
      const locRes = isEdit
        ? await locationsApi.update(id!, locationPayload as Partial<LocationFormData>)
        : await locationsApi.create(locationPayload as LocationFormData);

      const savedLoc = locRes.data?.data as Location | undefined;
      const locId = savedLoc?.id ?? id;

      // 2) Upsert capacity if user provided any field. On CREATE, rollback on failure.
      if (capPayload && locId) {
        try {
          await locationsApi.upsertCapacity(locId, capPayload);
        } catch (capErr: any) {
          if (isCreating) {
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
              : `La ubicación se creó pero la capacidad falló (${reason}) y la reversión automática no pudo completarse. Contacta al administrador con el código de ubicación: ${data.locationCode}.`;
            const err: any = new Error(msg);
            err.__handled = true;
            throw err;
          }
          throw capErr;
        }
      }

      return locRes;
    },
    onSuccess: (res) => {
      toast.success(isEdit ? 'Ubicación actualizada' : 'Ubicación creada');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['ranch-aggregated-occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['ranch-summary'] });
      const saved = res.data?.data as Location | undefined;
      if (saved?.id) {
        queryClient.invalidateQueries({ queryKey: ['location', saved.id] });
        queryClient.invalidateQueries({ queryKey: ['location-capacity', saved.id] });
        navigate(`/locations/${saved.id}`);
      } else {
        navigate('/locations');
      }
    },
    onError: (err: any) => {
      // Special-case POINT_OUTSIDE_RANCH_BOUNDARY: show ranch name + jump back
      // to Step 2 so the user can fix the coordinates.
      const outside = getOutsideRanchBoundaryDetails(err);
      if (outside) {
        toast.error(
          `Punto fuera del rancho${outside.ranchName ? ` "${outside.ranchName}"` : ''}`,
          `Las coordenadas (${outside.point.latitude.toFixed(5)}, ${outside.point.longitude.toFixed(5)}) están fuera del perímetro del rancho. Mueve el punto dentro de la forma verde y vuelve a guardar.`,
        );
        setStep(2);
        return;
      }
      const msg = err?.__handled ? err.message : getFriendlyMessage(err);
      toast.error('Error al guardar', msg);
    },
  });

  // Step validation — check required fields per step
  const STEP1_FIELDS: (keyof FormValues)[] = ['locationCode', 'name', 'type'];

  const goNext = async () => {
    let valid = false;
    if (step === 1) {
      valid = await trigger(STEP1_FIELDS);
      // Also validate ranch for SUPER_ADMIN
      if (valid && needsRanchPicker && !selectedRanchId) {
        setRanchError('Selecciona el rancho');
        valid = false;
      }
    } else if (step === 2) {
      valid = await trigger(['coordinates', 'area', 'elevation', 'slope']);

      const coords = getValues('coordinates');

      // Phase A — parent zone is the PRIMARY constraint when a parent is set.
      // BLOCKED without override (per project decision #3).
      if (valid && parentZone && coords?.latitude) {
        const parentResult = checkPointVsParent(coords, parentZone);
        if (parentResult.status === 'outside') {
          toast.error(
            `Ubicación fuera del área de "${parentZone.name}"`,
            `El punto está a ${
              parentResult.distanceM < 1000
                ? `${Math.round(parentResult.distanceM)} m`
                : `${(parentResult.distanceM / 1000).toFixed(2)} km`
            } del centro del padre, pero el área permitida tiene un radio de ${
              parentZone.radiusM < 1000
                ? `${Math.round(parentZone.radiusM)} m`
                : `${(parentZone.radiusM / 1000).toFixed(2)} km`
            }${parentZone.derivedFromArea
              ? ' (derivado del área del padre).'
              : ' (valor por defecto).'} Mueve el punto dentro del círculo verde para continuar.`,
          );
          valid = false;
        }
      }

      // Phase B — real ranch boundary (polygon/rectangle/circle).
      // BLOCKED without override (mirrors backend POINT_OUTSIDE_RANCH_BOUNDARY).
      // Only applies when no parentZone is constraining (parent is the inner constraint).
      if (valid && !parentZone && ranchBoundary && coords?.latitude) {
        const inside = isPointInBoundary(coords, ranchBoundary);
        if (!inside) {
          toast.error(
            `Ubicación fuera del rancho${ranchDisplayName ? ` "${ranchDisplayName}"` : ''}`,
            `El punto está fuera del perímetro real del rancho. Mueve el punto dentro de la forma verde para continuar. (El backend rechazará el guardado si insistes.)`,
          );
          valid = false;
        }
      }

      // Capa 2 (legacy fallback): if no real boundary, check distance to center.
      // When parentZone is set, the ranch check is INFORMATIVE only (the parent
      // is the binding constraint), so we don't block on it.
      if (valid && !parentZone && !ranchBoundary && ranchCenter && coords?.latitude) {
        const result = checkPointVsRanch(coords, ranchCenter, WARN_KM, BLOCK_KM);
        if (result.zone === 'danger' && !distanceOverride) {
          // Don't advance — the UI shows the override checkbox (see Step 2 JSX)
          valid = false;
        }
      }
    } else {
      valid = true;
    }
    if (valid) setStep((s) => Math.min(s + 1, 3));
  };

  const onSubmit = handleSubmit((data) => {
    // Effective ranchId: selected → active → existing (edit mode fallback)
    const effectiveRid = selectedRanchId || activeRanchId || (existing as any)?.ranchId;
    if (!effectiveRid) {
      setRanchError('Selecciona el rancho');
      setStep(1); // go back to step 1 so user can fix
      return;
    }

    // If user provided ANY capacity field but no LocationCapacity exists yet,
    // maxAnimals AND area are both mandatory (backend schema requires
    // area DECIMAL(12,2) > 0 and maxAnimals at create time).
    const capPayload = buildCapacityPayload(data);
    const hasExistingCapacity = !!existingCapacity;
    if (capPayload && !hasExistingCapacity) {
      const missing: { field: string; label: string; step: 1 | 2 }[] = [];
      if (capPayload.maxAnimals == null || capPayload.maxAnimals <= 0) {
        missing.push({ field: 'capacity', label: 'capacidad máxima de animales', step: 1 });
      }
      if (capPayload.area == null || capPayload.area <= 0) {
        missing.push({ field: 'area', label: 'área (debe ser > 0)', step: 2 });
      }
      if (missing.length > 0) {
        const fieldsList = missing.map((m) => m.label).join(' y ');
        toast.error(
          'Capacidad incompleta',
          `Para guardar los datos de capacidad y servicios necesitas indicar: ${fieldsList}.`,
        );
        // Mark fields as errored so the user sees the inline error too
        missing.forEach((m) => {
          if (m.field === 'capacity' || m.field === 'area') {
            setError(m.field as keyof FormValues, {
              type: 'manual',
              message: 'Requerido para guardar capacidad',
            });
          }
        });
        // Jump to the earliest step that has a missing field
        const earliestStep = Math.min(...missing.map((m) => m.step));
        setStep(earliestStep);
        // If `area` is missing, ensure the collapsible "Capacidad y Servicios"
        // section is open so the user can see the field that needs attention.
        if (missing.some((m) => m.field === 'area')) {
          setShowCapacitySection(true);
        }
        return;
      }
    }

    // Validación cruzada: maxAnimals + Σ hermanos ≤ Ranch.maxCattleCapacity.
    // Backend también valida esto, pero detectarlo en frontend evita roundtrip
    // y muestra mensaje específico. Usa locList (ya cargado) + ranchSummary.
    if (capPayload && capPayload.maxAnimals != null && capPayload.maxAnimals > 0) {
      const ranchMaxAvailable = ranchMaxCapacity;
      if (ranchMaxAvailable > 0 && Array.isArray(locList)) {
        const siblingsSum = locList
          .filter((l) => l.ranchId === effectiveRid && l.id !== id)
          .reduce((s, l) => s + (l.capacity?.maxAnimals ?? 0), 0);
        const totalIfSaved = siblingsSum + capPayload.maxAnimals;
        if (totalIfSaved > ranchMaxAvailable) {
          const overflow = totalIfSaved - ranchMaxAvailable;
          const available = Math.max(0, ranchMaxAvailable - siblingsSum);
          toast.error(
            'Excede la capacidad del rancho',
            `La capacidad solicitada supera al rancho en ${overflow} animales. Disponible: ${available} (rancho: ${ranchMaxAvailable}, ya asignado a otras ubicaciones: ${siblingsSum}).`,
          );
          setError('capacity', {
            type: 'manual',
            message: `Máximo permitido: ${available} animales (capacidad del rancho menos lo ya asignado).`,
          });
          setStep(1);
          return;
        }
      }
    }

    mutation.mutate(data);
  });

  const toggleVegetation = (v: string) => {
    const current = getValues('vegetation') ?? [];
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    setValue('vegetation', next);
  };

  const addCustomVeg = () => {
    const trimmed = customVeg.trim();
    if (!trimmed) return;
    const current = getValues('vegetation') ?? [];
    if (!current.includes(trimmed)) setValue('vegetation', [...current, trimmed]);
    setCustomVeg('');
  };

  if (isEdit && loadingExisting) return <PageLoader />;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      {/* Back */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (isEdit && id ? navigate(`/locations/${id}`) : navigate('/locations'))}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {isEdit ? `Editar ubicación` : 'Nueva ubicación'}
        </h1>
      </div>

      {/* Step bar */}
      <StepBar current={step} />

      <form onSubmit={onSubmit} className="space-y-4">
        {/* ── Step 1 — Identificación ── */}
        {step === 1 && (
          <Card className="space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                <Info className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              </div>
              <CardTitle>Identificación</CardTitle>
            </div>

            {/* Name */}
            <div>
              <FieldLabel required>Nombre</FieldLabel>
              <Input
                {...register('name')}
                placeholder="Ej: Potrero Norte 1"
                error={errors.name?.message}
              />
            </div>

            {/* Code */}
            <div>
              <FieldLabel required>Código</FieldLabel>
              <Input
                {...register('locationCode')}
                placeholder="Ej: POT-N1"
                className="uppercase"
                error={errors.locationCode?.message}
              />
              <p className="mt-1 text-xs text-gray-400">Solo letras, números y guiones. Se guardará en mayúsculas.</p>
            </div>

            {/* Type + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Tipo</FieldLabel>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onChange={(v) => field.onChange(v)}
                      options={LOCATION_TYPE_OPTIONS}
                      error={errors.type?.message}
                    />
                  )}
                />
              </div>
              <div>
                <FieldLabel>Estado</FieldLabel>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? LocationStatus.ACTIVE}
                      onChange={(v) => field.onChange(v)}
                      options={LOCATION_STATUS_OPTIONS}
                    />
                  )}
                />
              </div>
            </div>

            {/* Ranch selector */}
            {needsRanchPicker ? (
              <RanchSelector
                label="Rancho *"
                placeholder="Selecciona el rancho…"
                value={selectedRanchId}
                onChange={(rid) => { setSelectedRanchId(rid); setRanchError(''); }}
                error={ranchError}
                clearable={false}
              />
            ) : (
              <div>
                <FieldLabel>Rancho</FieldLabel>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  <Home className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {activeRanchName ?? 'Rancho activo'}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">Asignado automáticamente</span>
                </div>
              </div>
            )}

            {/* Capacity */}
            <div>
              <FieldLabel>Capacidad máxima (animales)</FieldLabel>
              <Input
                {...register('capacity')}
                type="number"
                min={1}
                placeholder="Ej: 50"
                error={errors.capacity?.message}
                icon={<Users className="w-4 h-4 text-gray-400" />}
              />
              <p className="mt-1 text-xs text-gray-400">Número máximo de bovinos que puede albergar esta ubicación.</p>
            </div>

            {/* Parent */}
            <div>
              <FieldLabel>Ubicación padre (opcional)</FieldLabel>
              <div
                title={
                  parentDropdownDisabled
                    ? 'Selecciona primero un rancho para ver sus ubicaciones disponibles como padre.'
                    : undefined
                }
              >
                <Controller
                  name="parentLocationId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onChange={(v) => field.onChange(v)}
                      disabled={parentDropdownDisabled}
                      options={[
                        {
                          value: '',
                          label: parentDropdownDisabled
                            ? 'Selecciona un rancho primero…'
                            : 'Sin ubicación padre',
                        },
                        ...parentOptions,
                      ]}
                    />
                  )}
                />
              </div>
              {parentDropdownDisabled ? (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Selecciona un rancho para habilitar este campo.
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  Si esta ubicación está contenida en otra más grande.
                  {parentOptions.length === 0 && (
                    <span className="block mt-0.5 text-amber-600 dark:text-amber-400">
                      Este rancho aún no tiene otras ubicaciones registradas.
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <FieldLabel>Descripción (opcional)</FieldLabel>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Descripción adicional de la ubicación…"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <FieldError msg={errors.description?.message} />
            </div>
          </Card>
        )}

        {/* ── Step 2 — Geografía ── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Coordinates */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                </div>
                <CardTitle>Coordenadas GPS</CardTitle>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Haz clic en el mapa para fijar las coordenadas de esta ubicación. Es opcional.
              </p>
              <Controller
                name="coordinates"
                control={control}
                render={({ field }) => (
                  <MapPicker
                    value={field.value?.latitude ? (field.value as Coordinates) : null}
                    onChange={(c) => { field.onChange(c ?? undefined); setDistanceOverride(false); }}
                    ranchCenter={ranchCenter}
                    ranchName={ranchDisplayName}
                    warnDistanceKm={WARN_KM}
                    blockDistanceKm={BLOCK_KM}
                    parentZone={parentZone}
                    ranchBoundary={ranchBoundary}
                    className="h-[320px]"
                  />
                )}
              />

              {/* Danger-zone override (Capa 2) */}
              {(() => {
                if (!ranchCenter || !coordsValue?.latitude) return null;
                const result = checkPointVsRanch(coordsValue, ranchCenter, WARN_KM, BLOCK_KM);
                if (result.zone !== 'danger') return null;
                const style = ZONE_STYLES.danger;
                return (
                  <div className={`flex items-start gap-3 px-3 py-3 rounded-lg border ${style.badge}`}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium">Ubicación muy lejos del rancho</p>
                      <p className="text-xs opacity-80 mt-0.5">
                        La coordenada seleccionada está a más de {BLOCK_KM} km del centro del rancho
                        {ranchDisplayName ? ` "${ranchDisplayName}"` : ''}.
                        Verifica que sea correcta antes de continuar.
                      </p>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={distanceOverride}
                          onChange={(e) => setDistanceOverride(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-xs font-medium">
                          Confirmo que esta ubicación es correcta aunque esté lejos del rancho
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })()}

              {coordsValue?.latitude != null && (
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>Lat: {coordsValue.latitude.toFixed(6)}°</span>
                  <span>Lng: {coordsValue.longitude.toFixed(6)}°</span>
                  <button
                    type="button"
                    onClick={() => { setValue('coordinates', undefined); setDistanceOverride(false); }}
                    className="text-red-400 hover:text-red-600 ml-auto"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </Card>

            {/* Area + Soil */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Leaf className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle>Características del terreno</CardTitle>
              </div>

              <div className="space-y-4">
                {/* NOTE: Área se trasladó a la sección "Capacidad y Servicios" — pertenece
                    a LocationCapacity, junto con maxAnimals y carryingCapacity. Aquí solo
                    quedan las características descriptivas del terreno. */}

                {/* Soil + Elevation + Slope */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <FieldLabel>Tipo de suelo</FieldLabel>
                    <Controller
                      name="soilType"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value ?? ''}
                          onChange={(v) => field.onChange(v)}
                          options={SOIL_TYPE_OPTIONS}
                        />
                      )}
                    />
                  </div>
                  <div>
                    <FieldLabel>Elevación (m)</FieldLabel>
                    <Input
                      {...register('elevation')}
                      type="number"
                      step="1"
                      placeholder="msnm"
                      error={errors.elevation?.message}
                    />
                  </div>
                  <div>
                    <FieldLabel>Pendiente (%)</FieldLabel>
                    <Input
                      {...register('slope')}
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      placeholder="0–100"
                      error={errors.slope?.message}
                    />
                  </div>
                </div>

                {/* Pasture quality */}
                <div>
                  <FieldLabel>Calidad de pasto</FieldLabel>
                  <Controller
                    name="pastureQuality"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onChange={(v) => field.onChange(v)}
                        options={PASTURE_QUALITY_OPTIONS}
                      />
                    )}
                  />
                </div>

                {/* Vegetation */}
                <div>
                  <FieldLabel>Vegetación</FieldLabel>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {VEGETATION_PRESETS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleVegetation(v)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          vegetationValue.includes(v)
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-300',
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {/* Custom tag */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customVeg}
                      onChange={(e) => setCustomVeg(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomVeg())}
                      placeholder="Otra vegetación…"
                      className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={addCustomVeg}>
                      Agregar
                    </Button>
                  </div>
                  {vegetationValue.filter((v) => !VEGETATION_PRESETS.includes(v)).map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 mr-1 mt-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      {v}
                      <button type="button" onClick={() => toggleVegetation(v)} className="text-gray-400 hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            {/* Capacidad y Servicios */}
            <Card className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCapacitySection((s) => !s)}
                className="w-full flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                    <Gauge className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    Capacidad y Servicios
                    <span className="ml-2 text-xs text-gray-400 font-normal">— opcional</span>
                  </span>
                </div>
                {showCapacitySection ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {showCapacitySection && (
                <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                    El número de <strong>animales actuales</strong> se gestiona automáticamente al mover bovinos entre ubicaciones.
                    La <strong>capacidad máxima</strong> se llena en el paso 1 y el <strong>área</strong> aquí abajo.
                  </div>

                  {/* Área + Unidad — pertenecen a LocationCapacity, no al Location base */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <FieldLabel>Área</FieldLabel>
                      <Input
                        {...register('area')}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Ej: 12.5"
                        error={errors.area?.message}
                      />
                    </div>
                    <div>
                      <FieldLabel>Unidad</FieldLabel>
                      <Controller
                        name="areaUnit"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value ?? 'ha'}
                            onChange={(v) => field.onChange(v)}
                            options={[
                              { value: 'ha',    label: 'ha' },
                              { value: 'm2',    label: 'm²' },
                              { value: 'acres', label: 'acres' },
                            ]}
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Carga animal (UA/ha)</FieldLabel>
                      <Input
                        {...register('carryingCapacity')}
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="Ej: 1.5"
                        error={errors.carryingCapacity?.message}
                      />
                    </div>
                    <div>
                      <FieldLabel>Estaciones de alimentación</FieldLabel>
                      <Input
                        {...register('feedingStations')}
                        type="number"
                        min={0}
                        placeholder="0"
                        error={errors.feedingStations?.message}
                      />
                    </div>
                    <div>
                      <FieldLabel>Refugios / sombras</FieldLabel>
                      <Input
                        {...register('shelters')}
                        type="number"
                        min={0}
                        placeholder="0"
                        error={errors.shelters?.message}
                      />
                    </div>
                    <div>
                      <FieldLabel>Nivel de seguridad</FieldLabel>
                      <Controller
                        name="securityLevel"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value ?? ''}
                            onChange={(v) => field.onChange(v)}
                            options={[
                              { value: '',       label: 'Sin especificar' },
                              { value: 'LOW',    label: 'Bajo' },
                              { value: 'MEDIUM', label: 'Medio' },
                              { value: 'HIGH',   label: 'Alto' },
                            ]}
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Servicios disponibles</FieldLabel>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60">
                        <input type="checkbox" {...register('hasElectricity')} className="rounded" />
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs">Electricidad</span>
                      </label>
                      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60">
                        <input type="checkbox" {...register('hasWater')} className="rounded" />
                        <Droplets className="w-3.5 h-3.5 text-sky-500" />
                        <span className="text-xs">Agua</span>
                      </label>
                      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60">
                        <input type="checkbox" {...register('hasInternet')} className="rounded" />
                        <Wifi className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs">Internet</span>
                      </label>
                      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60">
                        <input type="checkbox" {...register('hasRoadAccess')} className="rounded" />
                        <Route className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs">Acceso vial</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Water sources */}
            <Card className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowWaterSources((s) => !s)}
                className="w-full flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <Droplets className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    Fuentes de agua
                    {waterFields.length > 0 && (
                      <span className="ml-2 text-xs text-gray-400">({waterFields.length})</span>
                    )}
                  </span>
                </div>
                {showWaterSources ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {showWaterSources && (
                <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                  {waterFields.map((field, idx) => (
                    <div key={field.id} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">Fuente #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeWater(idx)}
                          className="text-red-400 hover:text-red-600 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <FieldLabel required>Tipo</FieldLabel>
                          <Controller
                            name={`waterSources.${idx}.type`}
                            control={control}
                            render={({ field: f }) => (
                              <Select
                                value={f.value}
                                onChange={(v) => f.onChange(v)}
                                options={WATER_SOURCE_TYPE_OPTIONS}
                              />
                            )}
                          />
                        </div>
                        <div>
                          <FieldLabel required>Nombre</FieldLabel>
                          <Input
                            {...register(`waterSources.${idx}.name`)}
                            placeholder="Ej: Jagüey norte"
                            error={(errors.waterSources?.[idx] as any)?.name?.message}
                          />
                        </div>
                        <div>
                          <FieldLabel>Capacidad (L)</FieldLabel>
                          <Input
                            {...register(`waterSources.${idx}.capacity`)}
                            type="number"
                            min={0}
                            placeholder="Litros"
                          />
                        </div>
                        <div>
                          <FieldLabel>Calidad</FieldLabel>
                          <Controller
                            name={`waterSources.${idx}.quality`}
                            control={control}
                            render={({ field: f }) => (
                              <Select
                                value={f.value ?? ''}
                                onChange={(v) => f.onChange(v || undefined)}
                                options={WATER_QUALITY_OPTIONS}
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => appendWater({ type: 'WELL', name: '', capacity: undefined, quality: undefined } as any)}
                  >
                    Agregar fuente
                  </Button>
                </div>
              )}
            </Card>

            {/* Geofence */}
            <Card className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowGeofence((s) => !s)}
                className="w-full flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    Geocerca (geofence)
                    <span className="ml-2 text-xs text-gray-400 font-normal">— opcional</span>
                  </span>
                </div>
                {showGeofence ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {showGeofence && (
                <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">
                  <Controller
                    name="geofenceConfig"
                    control={control}
                    render={({ field }) => (
                      <GeofenceDrawer
                        value={field.value ?? null}
                        onChange={(cfg) => field.onChange(cfg)}
                        mapCenter={coordsValue?.latitude
                          ? { lat: coordsValue.latitude, lng: coordsValue.longitude }
                          : ranchCenter
                            ? { lat: ranchCenter.latitude, lng: ranchCenter.longitude }
                            : undefined
                        }
                        ranchCenter={ranchCenter}
                        ranchName={ranchDisplayName}
                        warnDistanceKm={WARN_KM}
                        blockDistanceKm={BLOCK_KM}
                        // Phase 6 — geocerca debe contener el pin de la ubicación
                        requiredPoint={coordsValue?.latitude
                          ? { latitude: coordsValue.latitude, longitude: coordsValue.longitude }
                          : null}
                        requiredPointLabel="Pin de la ubicación"
                        // Y debe estar fully dentro del boundary del rancho (jerarquía)
                        containerBoundary={ranchBoundary as any}
                        containerLabel={ranchDisplayName ? `del rancho "${ranchDisplayName}"` : 'del rancho'}
                        areaForRectangle={
                          (() => {
                            const a = watch('area');
                            const u = watch('areaUnit');
                            if (!a || a <= 0) return null;
                            const unitMap: Record<string, 'HA' | 'M2' | 'ACRE'> = {
                              ha: 'HA', m2: 'M2', acres: 'ACRE',
                            };
                            return { area: a, unit: unitMap[u ?? 'ha'] ?? 'HA' };
                          })()
                        }
                      />
                    )}
                  />
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Step 3 — Revisión ── */}
        {step === 3 && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              </div>
              <CardTitle>Resumen — {isEdit ? 'actualizar' : 'confirmar creación'}</CardTitle>
            </div>

            {(() => {
              const vals = getValues();
              const typeLabel = LOCATION_TYPE_OPTIONS.find((o) => o.value === vals.type)?.label ?? vals.type;
              const statusLabel = LOCATION_STATUS_OPTIONS.find((o) => o.value === vals.status)?.label ?? vals.status;
              return (
                <div className="space-y-1">
                  <ReviewRow label="Rancho"      value={activeRanchName ?? selectedRanchId ?? undefined} />
                  <ReviewRow label="Nombre"      value={vals.name} />
                  <ReviewRow label="Código"      value={vals.locationCode} />
                  <ReviewRow label="Tipo"        value={typeLabel} />
                  <ReviewRow label="Estado"      value={statusLabel} />
                  <ReviewRow label="Capacidad"   value={vals.capacity ? `${vals.capacity} animales` : undefined} />
                  <ReviewRow label="Descripción" value={vals.description || undefined} />
                  <ReviewRow label="Área"        value={vals.area ? `${vals.area} ${vals.areaUnit ?? 'ha'}` : undefined} />
                  <ReviewRow label="Suelo"       value={SOIL_TYPE_OPTIONS.find((o) => o.value === vals.soilType)?.label || undefined} />
                  <ReviewRow label="Elevación"   value={vals.elevation != null ? `${vals.elevation} msnm` : undefined} />
                  <ReviewRow label="Pendiente"   value={vals.slope != null ? `${vals.slope}%` : undefined} />
                  <ReviewRow label="Calidad pasto" value={PASTURE_QUALITY_OPTIONS.find((o) => o.value === vals.pastureQuality)?.label || undefined} />
                  <ReviewRow
                    label="Vegetación"
                    value={vals.vegetation?.length
                      ? <div className="flex flex-wrap gap-1">{vals.vegetation.map((v) => <span key={v} className="px-1.5 py-0.5 text-xs rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{v}</span>)}</div>
                      : undefined}
                  />
                  <ReviewRow label="Coordenadas" value={vals.coordinates?.latitude ? `${vals.coordinates.latitude.toFixed(6)}°, ${vals.coordinates.longitude.toFixed(6)}°` : undefined} />
                  <ReviewRow label="Fuentes agua" value={vals.waterSources?.length ? `${vals.waterSources.length} fuente(s)` : undefined} />
                  <ReviewRow label="Geocerca"    value={vals.geofenceConfig ? `Tipo: ${vals.geofenceConfig.type}` : undefined} />
                  <ReviewRow label="Carga animal"  value={vals.carryingCapacity != null ? `${vals.carryingCapacity} UA/ha` : undefined} />
                  <ReviewRow label="Estaciones aliment." value={vals.feedingStations != null ? `${vals.feedingStations}` : undefined} />
                  <ReviewRow label="Refugios"      value={vals.shelters != null ? `${vals.shelters}` : undefined} />
                  <ReviewRow label="Seguridad"     value={vals.securityLevel ? ({ LOW: 'Bajo', MEDIUM: 'Medio', HIGH: 'Alto' } as any)[vals.securityLevel] : undefined} />
                  <ReviewRow
                    label="Servicios"
                    value={
                      [
                        vals.hasElectricity && 'Electricidad',
                        vals.hasWater && 'Agua',
                        vals.hasInternet && 'Internet',
                        vals.hasRoadAccess && 'Acceso vial',
                      ].filter(Boolean).join(' · ') || undefined
                    }
                  />
                </div>
              );
            })()}

            {mutation.isError && (
              <div className="mt-4 flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{getFriendlyMessage(mutation.error)}</p>
              </div>
            )}
          </Card>
        )}

        {/* ── Navigation buttons ── */}
        <div className="flex justify-between pt-2">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                icon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => setStep((s) => s - 1)}
              >
                Anterior
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(isEdit && id ? `/locations/${id}` : '/locations')}
            >
              Cancelar
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                icon={<ArrowRight className="w-4 h-4" />}
                iconPosition="right"
                onClick={goNext}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                type="submit"
                loading={mutation.isPending}
                icon={<Save className="w-4 h-4" />}
              >
                {isEdit ? 'Guardar cambios' : 'Crear ubicación'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
