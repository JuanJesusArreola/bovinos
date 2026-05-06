import { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { bovinesApi } from '@/api/bovines.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { BovineSelector } from '@/components/ui/BovineSelector';
import { LocationSelector } from '@/components/ui/LocationSelector';
import { RanchSelector } from '@/components/ui/RanchSelector';
import { MapPicker } from '@/components/maps/MapPicker';
import type { Coordinates } from '@/components/maps/MapPicker';
import { FileUpload } from '@/components/ui/FileUpload';
import { cn } from '@/utils/cn';
import { getErrorCode, getFriendlyMessage, ErrorCodes } from '@/utils/errorHandler';
import type { BovineFormData } from '@/types';
import {
  ArrowLeft, ArrowRight, Check, Tag, HeartPulse, MapPin,
  Save, Camera, X, ChevronDown, ChevronUp, Users,
  ShoppingCart, Beef, Home,
} from 'lucide-react';

// ─── Schema ────────────────────────────────────────────────────────────────────

const bovineSchema = z.object({
  // Step 1 — Identificación
  earTag: z.string().min(1, 'El arete es requerido').max(50, 'Máximo 50 caracteres'),
  name: z.string().max(200).optional().or(z.literal('')),
  breed: z.string().min(1, 'La raza es requerida').max(100),
  cattleType: z.enum(['CATTLE', 'BULL', 'COW', 'CALF'], { error: 'Selecciona el tipo' }),
  // Step 2 — Biológicos
  gender: z.enum(['MALE', 'FEMALE'], { error: 'Selecciona el sexo' }),
  birthDate: z.string().min(1, 'La fecha de nacimiento es requerida'),
  weight: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().min(1, 'Mínimo 1 kg').max(2000, 'Máximo 2000 kg').optional(),
  ),
  healthStatus: z.string().optional().or(z.literal('')),
  vaccinationStatus: z.string().optional().or(z.literal('')),
  motherId: z.string().optional().or(z.literal('')),
  fatherId: z.string().optional().or(z.literal('')),
  acquisitionDate: z.string().optional().or(z.literal('')),
  acquisitionPrice: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().min(0).optional(),
  ),
  notes: z.string().max(1000).optional().or(z.literal('')),
  // Step 3 — Ubicación (coordenadas opcionales)
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

type FormValues = z.infer<typeof bovineSchema>;

// Fields validated per step before allowing "Next"
const STEP_FIELDS: Record<1 | 2 | 3, (keyof FormValues)[]> = {
  1: ['earTag', 'breed', 'cattleType'],
  2: ['gender', 'birthDate'],
  3: [],
};

type WizardStep = 1 | 2 | 3;

// ─── Select options ────────────────────────────────────────────────────────────

const genderOptions = [
  { value: 'MALE', label: 'Macho' },
  { value: 'FEMALE', label: 'Hembra' },
];

/** All cattle type options — will be filtered at runtime based on gender + age */
const ALL_CATTLE_TYPE_OPTIONS = [
  { value: 'CATTLE', label: 'Ganado General',   minMonths: 0,   maxMonths: null, genders: ['MALE', 'FEMALE'] },
  { value: 'BULL',   label: 'Toro',             minMonths: 18,  maxMonths: null, genders: ['MALE'] },
  { value: 'COW',    label: 'Vaca',             minMonths: 24,  maxMonths: null, genders: ['FEMALE'] },
  { value: 'CALF',   label: 'Becerro/a',        minMonths: 0,   maxMonths: 12,   genders: ['MALE', 'FEMALE'] },
] as const;

/** Compute age in months from a date string (YYYY-MM-DD). Returns null when invalid. */
function ageInMonths(birthDate: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

/**
 * Returns filtered + annotated cattle type options based on gender and birthDate.
 * Options that don't fit are included but disabled so the user understands why.
 */
function getCattleTypeOptions(gender: string, birthDate: string) {
  const months = ageInMonths(birthDate);
  return ALL_CATTLE_TYPE_OPTIONS.map((opt) => {
    const genderOk  = !gender || (opt.genders as readonly string[]).includes(gender);
    const minOk     = months == null || months >= opt.minMonths;
    const maxOk     = months == null || opt.maxMonths == null || months <= opt.maxMonths;
    const valid     = genderOk && minOk && maxOk;

    let hint = '';
    if (!genderOk) hint = `Solo para ${opt.genders.map((g) => g === 'MALE' ? 'machos' : 'hembras').join('/')}`;
    else if (!minOk) hint = `Requiere ≥ ${opt.minMonths} meses de edad`;
    else if (!maxOk) hint = `Solo para animales < ${opt.maxMonths} meses`;

    return { value: opt.value, label: opt.label, disabled: !valid, hint };
  });
}

const healthStatusOptions = [
  { value: '', label: 'Sin especificar' },
  { value: 'HEALTHY', label: 'Saludable' },
  { value: 'SICK', label: 'Enfermo' },
  { value: 'RECOVERING', label: 'En Recuperación' },
  { value: 'QUARANTINE', label: 'Cuarentena' },
  { value: 'UNKNOWN', label: 'Desconocido' },
];

const vaccinationStatusOptions = [
  { value: '', label: 'Sin especificar' },
  { value: 'UP_TO_DATE', label: 'Al Día' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'OVERDUE', label: 'Atrasado' },
  { value: 'NONE', label: 'Sin Vacunas' },
];

const breedOptions = [
  { value: 'Holstein', label: 'Holstein' },
  { value: 'Brahman', label: 'Brahman' },
  { value: 'Angus', label: 'Angus' },
  { value: 'Hereford', label: 'Hereford' },
  { value: 'Charolais', label: 'Charolais' },
  { value: 'Simmental', label: 'Simmental' },
  { value: 'Limousin', label: 'Limousin' },
  { value: 'Jersey', label: 'Jersey' },
  { value: 'Gyr', label: 'Gyr' },
  { value: 'Suizo', label: 'Suizo Europeo' },
  { value: 'Cebu', label: 'Cebú' },
  { value: 'Nelore', label: 'Nelore' },
  { value: 'Criollo', label: 'Criollo' },
  { value: 'Otro', label: 'Otro' },
];

// ─── Wizard step definitions ───────────────────────────────────────────────────

const STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: 1, label: 'Identificación', icon: Tag },
  { id: 2, label: 'Biológicos', icon: HeartPulse },
  { id: 3, label: 'Ubicación', icon: MapPin },
];

// ─── Small helper to show a read-only summary item ────────────────────────────

function SummaryItem({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{value}</span>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function BovineFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeRanchId, activeRanchName, user } = useAuth();
  const toast = useToast();
  const isEditing = !!id;

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());

  // Ranch — managed outside Zod schema (similar to locationId)
  // SUPER_ADMIN has no ranchAccess so activeRanchId is null → must select manually
  const [selectedRanchId, setSelectedRanchId] = useState<string | null>(activeRanchId);
  const [ranchError, setRanchError] = useState('');

  // Whether we need to show a full ranch selector (no active ranch or SUPER_ADMIN)
  const needsRanchPicker = !activeRanchId || user?.role === 'SUPER_ADMIN';

  // Extra state not in the Zod schema
  const [photos, setPhotos] = useState<string[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [showGenealogy, setShowGenealogy] = useState(false);
  const [showAcquisition, setShowAcquisition] = useState(false);
  const [showGps, setShowGps] = useState(false);

  // ── Load existing bovine when editing ────────────────────────────────────────
  const { data: bovine, isLoading } = useQuery({
    queryKey: ['bovine', id],
    queryFn: () => bovinesApi.getById(id!).then((r) => r.data.data),
    enabled: isEditing,
  });

  // ── Form ──────────────────────────────────────────────────────────────────────
  const form = useForm<FormValues>({
    resolver: zodResolver(bovineSchema) as any,
    defaultValues: {
      earTag: '',
      name: '',
      breed: '',
      cattleType: undefined,
      gender: undefined,
      birthDate: '',
      weight: undefined,
      healthStatus: '',
      vaccinationStatus: '',
      motherId: '',
      fatherId: '',
      acquisitionDate: '',
      acquisitionPrice: undefined,
      notes: '',
      location: undefined,
    },
  });

  const { register, control, formState: { errors }, trigger, watch, reset } = form;

  // Populate form when loading an existing bovine
  useEffect(() => {
    if (bovine) {
      reset({
        earTag: bovine.earTag,
        name: bovine.name || '',
        breed: bovine.breed,
        cattleType: bovine.cattleType as FormValues['cattleType'],
        gender: bovine.gender as FormValues['gender'],
        birthDate: bovine.birthDate?.split('T')[0] || '',
        weight: bovine.weight || undefined,
        healthStatus: bovine.healthStatus || '',
        vaccinationStatus: bovine.vaccinationStatus || '',
        motherId: '',
        fatherId: '',
        acquisitionDate: '',
        acquisitionPrice: undefined,
        notes: bovine.notes || '',
        location: bovine.location?.latitude
          ? { latitude: bovine.location.latitude, longitude: bovine.location.longitude }
          : undefined,
      });
      if (bovine.healthStatus || bovine.vaccinationStatus) setShowGenealogy(false);
      if (bovine.location?.latitude) setShowGps(true);
      // In edit mode, all steps are already accessible
      setCompletedSteps(new Set([1, 2, 3]));
    }
  }, [bovine, reset]);

  // ── Mutation ──────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload: BovineFormData = {
        earTag: data.earTag,
        name: data.name || undefined,
        breed: data.breed,
        gender: data.gender,
        cattleType: data.cattleType,
        birthDate: data.birthDate,
        weight: data.weight,
        notes: data.notes || undefined,
        ranchId: selectedRanchId || undefined,
        // Only include location when the user explicitly set real coordinates.
        // Sending {latitude:0, longitude:0} causes a backend validation error ("Null Island").
        location: data.location?.latitude ? data.location : undefined,
        healthStatus: data.healthStatus || undefined,
        vaccinationStatus: data.vaccinationStatus || undefined,
        motherId: data.motherId || undefined,
        fatherId: data.fatherId || undefined,
        acquisitionDate: data.acquisitionDate || undefined,
        acquisitionPrice: data.acquisitionPrice,
      };

      const res = isEditing
        ? await bovinesApi.update(id!, payload)
        : await bovinesApi.create(payload);

      // If a potrero was selected, assign it
      const bovineId: string = (res.data as any).data?.id || (isEditing ? id! : '');
      if (locationId && bovineId) {
        await bovinesApi.moveToLocation(bovineId, {
          locationId,
          reason: isEditing ? 'Actualización de potrero' : 'Asignación inicial',
        });
      }

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovines'] });
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['bovine', id] });
      toast.success(
        isEditing ? 'Bovino actualizado' : 'Bovino registrado',
        isEditing ? 'Los cambios fueron guardados correctamente.' : 'El bovino fue registrado exitosamente.',
      );
      navigate(isEditing ? `/bovines/${id}` : '/bovines');
    },
    onError: (err: any) => {
      const code = getErrorCode(err);
      switch (code) {
        case ErrorCodes.BOVINE_DUPLICATE_EAR_TAG:
          form.setError('earTag', { message: 'Ya existe un bovino con ese arete en este rancho' });
          setStep(1);
          toast.error('Arete duplicado', 'Ese número de arete ya está registrado en el rancho.');
          break;
        case ErrorCodes.BOVINE_INVALID_AGE_FOR_TYPE:
          form.setError('cattleType', { message: getFriendlyMessage(err) });
          setStep(1);
          toast.error('Tipo inválido', getFriendlyMessage(err));
          break;
        case ErrorCodes.BOVINE_INVALID_GENDER_FOR_TYPE:
          form.setError('cattleType', { message: getFriendlyMessage(err) });
          form.setError('gender', { message: 'El sexo no es compatible con el tipo seleccionado' });
          setStep(1);
          toast.error('Combinación inválida', getFriendlyMessage(err));
          break;
        case ErrorCodes.RANCH_MISMATCH:
          setStep(3);
          toast.error('Rancho incorrecto', 'La ubicación seleccionada no pertenece a este rancho.');
          break;
        case ErrorCodes.VALIDATION_ERROR:
          // Backend sent field-level errors — show a generic message; fields already shown
          toast.error('Datos inválidos', getFriendlyMessage(err));
          break;
        default:
          toast.error('Error al guardar', getFriendlyMessage(err));
      }
    },
  });

  // ── Wizard navigation ─────────────────────────────────────────────────────────
  const handleNext = async () => {
    // Step 1: also validate ranchId manually (not in Zod schema)
    if (step === 1 && !selectedRanchId) {
      setRanchError('Selecciona el rancho al que pertenece este animal');
      return;
    }
    setRanchError('');
    const valid = await trigger(STEP_FIELDS[step] as any);
    if (!valid) return;
    setCompletedSteps((prev) => new Set([...prev, step]));
    setStep((s) => (s + 1) as WizardStep);
  };

  const handleBack = () => {
    setStep((s) => (s - 1) as WizardStep);
  };

  const handleStepClick = (target: WizardStep) => {
    // Can jump back freely; can jump forward only if that step was already reached
    if (target < step || completedSteps.has(target) || isEditing) {
      setStep(target);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const watchedValues = watch(['earTag', 'name', 'breed', 'cattleType', 'gender', 'birthDate', 'weight', 'healthStatus']);
  const [wEarTag, wName, wBreed, wCattleType, wGender, wBirthDate, wWeight, wHealth] = watchedValues;

  // Reactive filtered cattle type options — updated whenever gender or birthDate changes
  const filteredCattleTypeOptions = getCattleTypeOptions(wGender ?? '', wBirthDate ?? '');
  const cattleTypeLabel = filteredCattleTypeOptions.find((o) => o.value === wCattleType)?.label;
  const genderLabel = genderOptions.find((o) => o.value === wGender)?.label;
  const healthLabel = healthStatusOptions.find((o) => o.value === wHealth)?.label;

  if (isEditing && isLoading) return <PageLoader />;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Editar Bovino' : 'Registrar Bovino'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isEditing ? `Editando arete ${bovine?.earTag || ''}` : 'Completa los 3 pasos para registrar un nuevo animal'}
          </p>
        </div>
      </div>

      {/* ── Step indicator ─────────────────────────────────────────────────── */}
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const isCompleted = completedSteps.has(s.id) && step !== s.id;
          const isActive = step === s.id;
          const isReachable = s.id < step || completedSteps.has(s.id) || isEditing;

          return (
            <Fragment key={s.id}>
              <button
                type="button"
                onClick={() => handleStepClick(s.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 group',
                  isReachable ? 'cursor-pointer' : 'cursor-default',
                )}
                disabled={!isReachable}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200',
                    isCompleted
                      ? 'bg-primary-500 text-white shadow-sm shadow-primary-200 dark:shadow-none'
                      : isActive
                        ? 'bg-primary-500 text-white ring-4 ring-primary-100 dark:ring-primary-900/50 shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    isActive
                      ? 'text-primary-600 dark:text-primary-400'
                      : isCompleted
                        ? 'text-primary-500 dark:text-primary-400'
                        : 'text-gray-400 dark:text-gray-500',
                  )}
                >
                  {s.label}
                </span>
              </button>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-3 mb-5 transition-colors duration-300',
                    step > i + 1 ? 'bg-primary-400 dark:bg-primary-600' : 'bg-gray-200 dark:bg-gray-700',
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">

        {/* ════════════════════════════════════════════════════════════════════
            PASO 1 — IDENTIFICACIÓN
            ════════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <>
            {/* Datos de identificación */}
            <Card>
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40">
                  <Beef className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <CardTitle>Datos de Identificación</CardTitle>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Arete *"
                  placeholder="MX-001"
                  error={errors.earTag?.message}
                  {...register('earTag')}
                />
                <Input
                  label="Nombre (opcional)"
                  placeholder="Ej: La Bonita"
                  error={errors.name?.message}
                  {...register('name')}
                />
                <Select
                  label="Raza *"
                  options={breedOptions}
                  placeholder="Selecciona raza"
                  error={errors.breed?.message}
                  {...register('breed')}
                />
                <Select
                  label="Tipo de Ganado *"
                  options={filteredCattleTypeOptions}
                  placeholder="Seleccionar tipo"
                  error={errors.cattleType?.message}
                  {...register('cattleType')}
                />
              </div>

              {/* Ranch field — full width below the 2-col grid */}
              <div className="mt-4">
                {needsRanchPicker ? (
                  /* SUPER_ADMIN or no active ranch: show searchable picker */
                  <RanchSelector
                    label="Rancho *"
                    placeholder="Selecciona el rancho..."
                    value={selectedRanchId}
                    onChange={(id) => { setSelectedRanchId(id); setRanchError(''); }}
                    error={ranchError}
                    clearable={false}
                  />
                ) : (
                  /* Other roles: active ranch is pre-set, show as read-only chip */
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Rancho
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                      <Home className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {activeRanchName ?? 'Rancho activo'}
                      </span>
                      <span className="ml-auto text-xs text-gray-400">Asignado automáticamente</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Foto */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <Camera className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <CardTitle>Foto del Animal</CardTitle>
                <span className="text-xs text-gray-400 ml-1">(opcional)</span>
              </div>

              <FileUpload
                category="cattle_photos"
                onUploadComplete={(result) => setPhotos((prev) => [...prev, result.url])}
                label="Subir foto del bovino"
              />

              {photos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
                      <img
                        src={url}
                        alt={`Foto ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 2 — DATOS BIOLÓGICOS
            ════════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <>
            {/* Datos biológicos */}
            <Card>
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40">
                  <HeartPulse className="w-4 h-4 text-red-500 dark:text-red-400" />
                </div>
                <CardTitle>Datos Biológicos</CardTitle>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Sexo *"
                  options={genderOptions}
                  placeholder="Seleccionar"
                  error={errors.gender?.message}
                  {...register('gender')}
                />
                <Input
                  type="date"
                  label="Fecha de Nacimiento *"
                  error={errors.birthDate?.message}
                  {...register('birthDate')}
                />
                <Input
                  type="number"
                  step="0.1"
                  min={1}
                  max={2000}
                  label="Peso actual (kg)"
                  placeholder="450"
                  error={errors.weight?.message}
                  {...register('weight')}
                />
                <Select
                  label="Estado de Salud"
                  options={healthStatusOptions}
                  {...register('healthStatus')}
                />
                <Select
                  label="Estado de Vacunación"
                  options={vaccinationStatusOptions}
                  {...register('vaccinationStatus')}
                />
              </div>

              {/* Notes */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Notas y Observaciones
                </label>
                <textarea
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-none"
                  placeholder="Observaciones adicionales sobre el animal..."
                  {...register('notes')}
                />
              </div>
            </Card>

            {/* Genealogía — collapsible */}
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => setShowGenealogy(!showGenealogy)}
                className="flex items-center gap-2 w-full text-left"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 shrink-0">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="flex-1">Genealogía</CardTitle>
                <span className="text-xs text-gray-400 mr-2">opcional</span>
                {showGenealogy
                  ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {showGenealogy && (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Controller
                    name="motherId"
                    control={control}
                    render={({ field }) => (
                      <BovineSelector
                        label="Madre (hembra)"
                        placeholder="Buscar por arete o nombre..."
                        filterGender="FEMALE"
                        ranchId={activeRanchId}
                        value={field.value || null}
                        excludeIds={id ? [id] : []}
                        onChange={(bovineId) => field.onChange(bovineId || '')}
                      />
                    )}
                  />
                  <Controller
                    name="fatherId"
                    control={control}
                    render={({ field }) => (
                      <BovineSelector
                        label="Padre (macho)"
                        placeholder="Buscar por arete o nombre..."
                        filterGender="MALE"
                        ranchId={activeRanchId}
                        value={field.value || null}
                        excludeIds={id ? [id] : []}
                        onChange={(bovineId) => field.onChange(bovineId || '')}
                      />
                    )}
                  />
                </div>
              )}
            </Card>

            {/* Adquisición — collapsible */}
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAcquisition(!showAcquisition)}
                className="flex items-center gap-2 w-full text-left"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 shrink-0">
                  <ShoppingCart className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="flex-1">Datos de Adquisición</CardTitle>
                <span className="text-xs text-gray-400 mr-2">opcional</span>
                {showAcquisition
                  ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {showAcquisition && (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    type="date"
                    label="Fecha de Adquisición"
                    {...register('acquisitionDate')}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    label="Precio de Adquisición (MXN)"
                    placeholder="15000"
                    error={errors.acquisitionPrice?.message}
                    {...register('acquisitionPrice')}
                  />
                </div>
              )}
            </Card>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 3 — UBICACIÓN + RESUMEN
            ════════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <>
            {/* Summary of previous steps */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Check className="w-5 h-5 text-primary-500" />
                <CardTitle>Resumen del Registro</CardTitle>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                <SummaryItem label="Arete" value={wEarTag} />
                <SummaryItem label="Nombre" value={wName || '—'} />
                <SummaryItem label="Raza" value={wBreed} />
                <SummaryItem label="Tipo" value={cattleTypeLabel} />
                <SummaryItem label="Sexo" value={genderLabel} />
                <SummaryItem label="Nacimiento" value={wBirthDate} />
                <SummaryItem label="Peso" value={wWeight ? `${wWeight} kg` : '—'} />
                <SummaryItem label="Salud" value={healthLabel || '—'} />
              </div>
            </Card>

            {/* Potrero assignment */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle>Asignar Potrero</CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Selecciona el potrero o ubicación inicial del animal
                  </p>
                </div>
              </div>

              <LocationSelector
                label="Potrero / Ubicación (opcional)"
                placeholder="Buscar potrero..."
                value={locationId}
                onChange={(id) => setLocationId(id)}
                ranchId={activeRanchId}
                clearable
              />

              {locationId && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  El animal será asignado a este potrero al guardar
                </p>
              )}
            </Card>

            {/* GPS coordinates — collapsible */}
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => setShowGps(!showGps)}
                className="flex items-center gap-2 w-full text-left"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/40 shrink-0">
                  <MapPin className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                </div>
                <div className="flex-1">
                  <CardTitle>Coordenadas GPS</CardTitle>
                </div>
                <span className="text-xs text-gray-400 mr-2">opcional</span>
                {showGps
                  ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {showGps && (
                <div className="mt-4">
                  <Controller
                    name="location"
                    control={control}
                    render={({ field, fieldState }) => (
                      <MapPicker
                        label="Selecciona la ubicación en el mapa"
                        value={
                          field.value?.latitude != null && field.value?.longitude != null
                            ? field.value as Coordinates
                            : null
                        }
                        onChange={(coords: Coordinates) => field.onChange(coords)}
                        error={fieldState.error?.message}
                        className="h-[280px]"
                      />
                    )}
                  />
                </div>
              )}
            </Card>
          </>
        )}

        {/* ── Navigation buttons ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                icon={<ArrowLeft className="w-4 h-4" />}
              >
                Anterior
              </Button>
            )}
            {step === 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(-1)}
              >
                Cancelar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Step counter */}
            <span className="text-sm text-gray-400 dark:text-gray-500">
              Paso {step} de {STEPS.length}
            </span>

            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                icon={<ArrowRight className="w-4 h-4" />}
                iconPosition="right"
              >
                Siguiente
              </Button>
            ) : (
              <Button
                type="submit"
                loading={mutation.isPending}
                icon={<Save className="w-4 h-4" />}
              >
                {isEditing ? 'Guardar Cambios' : 'Crear Bovino'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
