import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { bovinesApi } from '@/api/bovines.api';
import { locationsApi } from '@/api/locations.api';
import { invalidateOccupancyCaches } from '@/hooks/useBovines';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { isPointInBoundary, type BoundaryShape } from '@/utils/geoValidation';
import { MovementReason, MovementType } from '@/types/bovine.dtos';
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
import { getErrorCode, getFriendlyMessage, ErrorCodes, getBovineErrorMessage } from '@/utils/errorHandler';
import type { BovineFormData } from '@/types';
import type { BovineMediaItemResponse, InitialCaseInput } from '@/types/bovine.dtos';
import { ClinicalDataForm, isClinicalDataValid } from '@/components/bovines/ClinicalDataForm';
import {
  ArrowLeft, ArrowRight, Check, Tag, HeartPulse, MapPin,
  Save, Camera, X, ChevronDown, ChevronUp, Users,
  ShoppingCart, Beef, Home,
} from 'lucide-react';

// ─── Schema ────────────────────────────────────────────────────────────────────

/**
 * Allowed chars for the bovine name: Unicode letters (so it accepts accents,
 * ñ, etc.) plus spaces. No digits, no symbols, no underscores.
 *   Lola         → ok
 *   Vaca Blanca  → ok
 *   Lola123      → reject
 *   Vaca_01      → reject
 */
const NAME_REGEX = /^[\p{L}\s]+$/u;

/**
 * Strip every char that is NOT a Unicode letter or whitespace. Used to
 * sanitize the input live as the user types, so invalid chars never make
 * it into the form state (and therefore never into the submit payload).
 */
function sanitizeName(input: string): string {
  return input.replace(/[^\p{L}\s]/gu, '');
}

const bovineSchema = z.object({
  // Step 1 — Identificación
  earTag: z.string().min(1, 'El arete es requerido').max(50, 'Máximo 50 caracteres'),
  name: z.string()
    .max(200, 'Máximo 200 caracteres')
    .regex(NAME_REGEX, 'Solo se permiten letras y espacios (sin números ni símbolos)')
    .optional()
    .or(z.literal('')),
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
  // F-31 / Backend P-02: `vaccinationStatus` removido del schema. El campo
  // ya no es captura manual ni se envia al backend. El UI tampoco lo expone.
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
  // Step 3 — Datos del PRIMER registro de entrada al potrero (opcionales;
  // solo se envían si el usuario seleccionó un `locationId`).
  entryReason: z.enum([
    'CREATION', 'GRAZING', 'MEDICAL', 'QUARANTINE',
    'BREEDING', 'TRANSFER', 'SALE', 'OTHER',
  ]).optional(),
  entryMovementType: z.enum(['MANUAL', 'AUTOMATED', 'SCHEDULED']).optional(),
  entryNotes: z.string().max(1000, 'Máximo 1000 caracteres').optional().or(z.literal('')),
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
  { value: 'CATTLE', label: 'Ganado General', minMonths: 0, maxMonths: null, genders: ['MALE', 'FEMALE'] },
  { value: 'BULL', label: 'Toro', minMonths: 18, maxMonths: null, genders: ['MALE'] },
  { value: 'COW', label: 'Vaca', minMonths: 24, maxMonths: null, genders: ['FEMALE'] },
  { value: 'CALF', label: 'Becerro/a', minMonths: 0, maxMonths: 12, genders: ['MALE', 'FEMALE'] },
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
    const genderOk = !gender || (opt.genders as readonly string[]).includes(gender);
    const minOk = months == null || months >= opt.minMonths;
    const maxOk = months == null || opt.maxMonths == null || months <= opt.maxMonths;
    const valid = genderOk && minOk && maxOk;

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

// F-31 / Backend P-02: `vaccinationStatusOptions` eliminado — el form
// ya no tiene el select de "Estado de vacunacion". El estado real se
// gestiona via el tab Vacunacion del detalle.

/**
 * Motivos disponibles para el PRIMER registro de entrada a un potrero al crear
 * un bovino. `CREATION` es el default y describe la asignación inicial.
 * Mapea 1:1 al enum `MovementReason` del backend.
 */
const entryReasonOptions = [
  { value: MovementReason.CREATION,   label: 'Asignación inicial (creación)' },
  { value: MovementReason.GRAZING,    label: 'Pastoreo' },
  { value: MovementReason.MEDICAL,    label: 'Tratamiento médico' },
  { value: MovementReason.QUARANTINE, label: 'Cuarentena' },
  { value: MovementReason.BREEDING,   label: 'Reproducción' },
  { value: MovementReason.TRANSFER,   label: 'Transferencia' },
  { value: MovementReason.SALE,       label: 'Venta' },
  { value: MovementReason.OTHER,      label: 'Otro' },
];

/**
 * Cómo se originó el movimiento. `MANUAL` es el default cuando el usuario lo
 * captura desde el formulario. Mapea 1:1 al enum `MovementType` del backend.
 */
const entryMovementTypeOptions = [
  { value: MovementType.MANUAL,    label: 'Manual (capturado por el usuario)' },
  { value: MovementType.AUTOMATED, label: 'Automatizado' },
  { value: MovementType.SCHEDULED, label: 'Programado' },
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
  /**
   * LEGACY — `photos` previously held URLs uploaded to the generic /uploads
   * endpoint, but they were NEVER attached to the bovine (the payload didn't
   * include them). Kept as `unknown[]` placeholder to avoid breaking any
   * reference outside this file, but no longer used in the submit flow.
   * The new media flow lives in `pendingFiles` / `existingMedia` / `mediaToDelete`.
   */
  const [photos, setPhotos] = useState<string[]>([]);

  // ── New media-upload flow (Phase: fix update flow) ─────────────────────
  /** Files chosen by the user that have NOT been uploaded yet. Sent after create/update. */
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  /** Blob URLs (URL.createObjectURL) for previews. Same index as pendingFiles. Revoked on cleanup. */
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  /** Existing media of the bovine (only populated in edit mode). */
  const [existingMedia, setExistingMedia] = useState<BovineMediaItemResponse[]>([]);
  /** IDs/storagePaths of existing media the user wants to delete on submit. */
  const [mediaToDelete, setMediaToDelete] = useState<Set<string>>(new Set());
  /** Surfaced errors of the per-file upload (after create/update). */
  const [mediaUploadErrors, setMediaUploadErrors] = useState<string[]>([]);
  /** Hidden input ref so the "Subir foto" button can trigger the picker. */
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locationId, setLocationId] = useState<string | null>(null);
  const [showGenealogy, setShowGenealogy] = useState(false);
  const [showAcquisition, setShowAcquisition] = useState(false);
  const [showGps, setShowGps] = useState(false);

  // F-22 / Backend C-01: bloque clinico inicial. Vive como state local
  // (NO en RHF) porque su shape es complejo y se hidrata desde un
  // componente controlado (ClinicalDataForm). Se envia en `initialCase`
  // del payload de create cuando `healthStatus` es enfermo.
  const [initialCase, setInitialCase] = useState<InitialCaseInput | null>(null);
  // Errores especificos del bloque clinico — se hidratan desde el onError
  // cuando el backend rechaza por MISSING_CLINICAL_DATA / VALIDATION_ERROR.
  const [clinicalErrors, setClinicalErrors] = useState<
    Partial<Record<keyof InitialCaseInput, string>>
  >({});

  // ── Load existing bovine when editing ────────────────────────────────────────
  const { data: bovine, isLoading } = useQuery({
    queryKey: ['bovine', id],
    queryFn: () => bovinesApi.getById(id!).then((r) => r.data.data),
    enabled: isEditing,
  });

  // ── Load existing media when editing (so the user can see / remove them) ──
  const { data: mediaRes } = useQuery({
    queryKey: ['bovine-media', id],
    queryFn: () => bovinesApi.getMedia(id!).then((r) => r.data.data),
    enabled: isEditing,
    staleTime: 60_000,
  });

  // Hydrate `existingMedia` from the API once the response arrives.
  // Only images are shown in this picker (the form is for photos, not docs).
  useEffect(() => {
    if (mediaRes?.images) {
      setExistingMedia(mediaRes.images);
    }
  }, [mediaRes]);

  // ── Load the selected destination location (for geofence validation) ──────
  // We need the location's `geofenceConfig` to check that, if the user picked
  // GPS coordinates AND a potrero, the coordinates fall inside the real area
  // of that potrero. Without this check the user could mark a bovine "in"
  // a potrero while pinning it on the map kilometers away.
  const { data: selectedLocation } = useQuery({
    queryKey: ['location', locationId],
    queryFn: () => locationsApi.getById(locationId!).then((r) => r.data.data),
    enabled: !!locationId,
    staleTime: 60_000,
  });

  // Revoke blob URLs on unmount to avoid memory leaks.
  useEffect(() => {
    return () => {
      pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      motherId: '',
      fatherId: '',
      acquisitionDate: '',
      acquisitionPrice: undefined,
      notes: '',
      location: undefined,
      entryReason: MovementReason.CREATION,
      entryMovementType: MovementType.MANUAL,
      entryNotes: '',
    },
  });

  const { register, control, formState: { errors }, trigger, watch, reset, setValue } = form;

  // ── Image-picker helpers ──────────────────────────────────────────────────
  // Constraints aligned with backend cattle_photos config (see FileUpload.tsx).
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB per file
  const MAX_IMAGES = 10;                      // Max files for cattle_photos category

  /**
   * Append files to the pending list. Validates per-file (size + MIME),
   * deduplicates by name+size and respects the max-files cap.
   */
  function handleFilesSelected(files: FileList | File[] | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const errors: string[] = [];
    const accepted: File[] = [];

    // Count of images already chosen (pending) + already-on-server not deleted.
    const currentImageCount =
      pendingFiles.length +
      existingMedia.filter((m) => !mediaToDelete.has(m.id)).length;

    for (const file of incoming) {
      // Skip if we'd exceed the cap.
      if (currentImageCount + accepted.length >= MAX_IMAGES) {
        errors.push(`Máximo ${MAX_IMAGES} imágenes por bovino.`);
        break;
      }
      // Dedupe by name+size against current pending files.
      if (pendingFiles.some((f) => f.name === file.name && f.size === file.size)) {
        errors.push(`"${file.name}" ya está en la lista.`);
        continue;
      }
      // MIME validation.
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        errors.push(`"${file.name}": tipo no permitido (solo JPG, PNG, WEBP, HEIC).`);
        continue;
      }
      // Size validation.
      if (file.size > MAX_IMAGE_SIZE) {
        const mb = (MAX_IMAGE_SIZE / 1_048_576).toFixed(0);
        errors.push(`"${file.name}": excede ${mb} MB.`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) {
      const newPreviews = accepted.map((f) => URL.createObjectURL(f));
      setPendingFiles((prev) => [...prev, ...accepted]);
      setPendingPreviews((prev) => [...prev, ...newPreviews]);
    }
    if (errors.length > 0) {
      toast.error('Algunos archivos no se agregaron', errors.join(' '));
    }
  }

  /** Remove a pending (not-yet-uploaded) file by index. */
  function removePendingFile(index: number) {
    const url = pendingPreviews[index];
    if (url) URL.revokeObjectURL(url);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  /** Toggle "mark for deletion" on an existing media item. */
  function toggleExistingMediaForDeletion(id: string) {
    setMediaToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /**
   * Real-time sanitization for the "Nombre" input.
   * Blocks digits/symbols as the user types so the form state can NEVER hold
   * an invalid value. Setting via RHF marks it dirty + triggers re-validation.
   */
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = sanitizeName(e.target.value);
    setValue('name', cleaned, { shouldDirty: true, shouldValidate: true });
  }

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
        // F-31 / Backend P-02: vaccinationStatus ya no es parte del form.
        motherId: '',
        fatherId: '',
        acquisitionDate: '',
        acquisitionPrice: undefined,
        notes: bovine.notes || '',
        location: bovine.location?.latitude
          ? { latitude: bovine.location.latitude, longitude: bovine.location.longitude }
          : undefined,
      });
      if (bovine.healthStatus) setShowGenealogy(false);
      if (bovine.location?.latitude) setShowGps(true);
      // In edit mode, all steps are already accessible
      setCompletedSteps(new Set([1, 2, 3]));
    }
  }, [bovine, reset]);

  // ── Mutation ──────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload: BovineFormData & { initialCase?: InitialCaseInput } = {
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
        // F-31: NO se envia vaccinationStatus. El backend ignoraria el campo
        // de todas formas (P-02 lo desacoplo), pero lo omitimos del payload
        // para mantener el body limpio y dejar claro que el FE no lo gestiona.
        motherId: data.motherId || undefined,
        fatherId: data.fatherId || undefined,
        acquisitionDate: data.acquisitionDate || undefined,
        acquisitionPrice: data.acquisitionPrice,
      };

      // F-22 / Backend C-01: si el healthStatus es enfermo y se capturaron
      // los datos clinicos, incluirlos en el payload. El backend valida
      // coherencia (C-03) y aborta toda la transaccion si faltan campos
      // requeridos. Si el usuario marca healthy, `initialCase` esta en null
      // por el effect anterior y no se incluye.
      const isSickStatus = data.healthStatus === 'SICK'
        || data.healthStatus === 'RECOVERING'
        || data.healthStatus === 'QUARANTINE';
      if (!isEditing && isSickStatus && initialCase && isClinicalDataValid(initialCase)) {
        payload.initialCase = {
          ...initialCase,
          // Limpiar strings vacios opcionales antes de enviar.
          diagnosedBy: initialCase.diagnosedBy?.trim() || undefined,
          notes:       initialCase.notes?.trim() || undefined,
        };
      }

      // Cast: legacy BovineFormData uses string fields for enums; the strict
      // CreateBovineInput uses enum types. The runtime values come from the
      // same enum strings, so the cast is safe. Will be removed in F8 when
      // the form is rewritten with strict typing.
      const res = isEditing
        ? await bovinesApi.update(id!, payload as unknown as Partial<import('@/types/bovine.dtos').CreateBovineInput>)
        : await bovinesApi.create(payload as unknown as import('@/types/bovine.dtos').CreateBovineInput);

      // If a potrero was selected, assign it. This is the "first registry"
      // of the bovine at that location — we forward the entry metadata
      // (reason / movementType / notes) so it is persisted in
      // BovineLocationHistory by the backend (`locationService.recordEntry`).
      // `enteredAt` is set client-side to "now" so the value is deterministic
      // regardless of clock drift between client and server.
      const bovineId: string = (res.data as any).data?.id || (isEditing ? id! : '');
      if (locationId && bovineId) {
        await bovinesApi.moveToLocation(bovineId, {
          locationId,
          // Fall back to safe defaults that match the backend's behavior
          // when these fields are omitted (CREATION + MANUAL).
          reason: data.entryReason
            || (isEditing ? MovementReason.TRANSFER : MovementReason.CREATION),
          movementType: data.entryMovementType || MovementType.MANUAL,
          enteredAt: new Date().toISOString(),
          notes: data.entryNotes || undefined,
        });
      }

      // ── Media persistence (Phase: fix update flow) ────────────────────
      // The previous implementation uploaded photos to the GENERIC /uploads
      // endpoint and stored the resulting URL in local state, but those URLs
      // were never linked to the bovine — the payload above does not carry
      // them. The correct path is to call the dedicated bovine media endpoint
      // AFTER the bovine record exists (so the route /bovines/:id/media works).
      //
      // We collect per-file errors but do NOT abort the whole save: the bovine
      // itself was saved successfully, the user can retry media later.
      if (bovineId) {
        const mediaErrors: string[] = [];

        // 1) Delete existing media flagged for removal (edit mode only).
        if (isEditing && mediaToDelete.size > 0) {
          for (const mediaId of mediaToDelete) {
            const item = existingMedia.find((m) => m.id === mediaId);
            if (!item || !item.storagePath) continue;
            try {
              await bovinesApi.deleteMedia(bovineId, item.storagePath, 'images');
            } catch (e: unknown) {
              mediaErrors.push(
                `Error al eliminar "${item.filename}": ${getBovineErrorMessage(e)}`,
              );
            }
          }
        }

        // 2) Upload pending files using the DEDICATED endpoint.
        //    Each file is sent as multipart/form-data with `file` + `mediaType=images`.
        //    Backend validates MIME and size; we already validated client-side too.
        for (const file of pendingFiles) {
          try {
            await bovinesApi.uploadMedia(bovineId, file, 'images');
          } catch (e: unknown) {
            mediaErrors.push(
              `Error al subir "${file.name}": ${getBovineErrorMessage(e)}`,
            );
          }
        }

        // Surface partial failures (the bovine itself is already saved).
        if (mediaErrors.length > 0) {
          setMediaUploadErrors(mediaErrors);
        }

        // Invalidate media + full cache so the detail page reflects the new state.
        queryClient.invalidateQueries({ queryKey: ['bovine-media', bovineId] });
        queryClient.invalidateQueries({ queryKey: ['bovines', 'full', bovineId] });
      }

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovines'] });
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['bovine', id] });
      // Refresh ranch + location occupancy widgets (current head count,
      // capacity bars, occupancy dots, KPI stat cards). This mutation runs
      // outside the centralized hooks so we call the helper directly.
      invalidateOccupancyCaches(queryClient);
      toast.success(
        isEditing ? 'Bovino actualizado' : 'Bovino registrado',
        isEditing ? 'Los cambios fueron guardados correctamente.' : 'El bovino fue registrado exitosamente.',
      );
      navigate(isEditing ? `/bovines/${id}` : '/bovines');
    },
    onError: (err: unknown) => {
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
        // F-18 / Backend M5: errores de validacion de padres. El backend
        // emite codigos sin el prefijo BOVINE_ (INVALID_PARENT, SELF_PARENT),
        // pero el catalogo de ErrorCodes del FE los tiene con prefijo
        // (BOVINE_INVALID_PARENT). Hasta alinear ambos lados (hallazgo H-4),
        // toleramos los dos.
        case 'INVALID_PARENT':
        case ErrorCodes.BOVINE_INVALID_PARENT: {
          const msg = getFriendlyMessage(err)
            || 'El bovino seleccionado no cumple las reglas (sexo, edad reproductiva, mismo rancho o inactivo).';
          // Mensaje en ambos campos — el backend no nos dice cual es el
          // problematico; el VET lo identifica al ver el form abierto.
          form.setError('motherId', { message: msg });
          form.setError('fatherId', { message: msg });
          setStep(2);
          toast.error('Padre/madre inválido', msg);
          break;
        }
        case 'SELF_PARENT':
        case ErrorCodes.BOVINE_SELF_PARENT: {
          const msg = 'Un bovino no puede ser su propio padre/madre ni padre directo de su progenitor.';
          form.setError('motherId', { message: msg });
          form.setError('fatherId', { message: msg });
          setStep(2);
          toast.error('Genealogía inválida', msg);
          break;
        }
        // F-23 / Backend C-03: coherencia clinica fallo en el backend
        // (faltan diseaseId/severity/diagnosedAt). Esto solo deberia
        // ocurrir si el guard local del submit fallo o si hay drift de
        // estado. Marcar errores en los tres campos minimos y volver al
        // paso 2 para que el usuario los corrija.
        case 'MISSING_CLINICAL_DATA': {
          setStep(2);
          setClinicalErrors({
            diseaseId:   'Captura la enfermedad.',
            severity:    'Captura la severidad.',
            diagnosedAt: 'Captura la fecha de diagnóstico.',
          });
          toast.error(
            'Faltan datos clínicos',
            'Faltan datos clínicos: enfermedad, severidad y fecha de diagnóstico.',
          );
          break;
        }
        case ErrorCodes.VALIDATION_ERROR:
          // Backend sent field-level errors — show a generic message; fields already shown
          toast.error('Datos inválidos', getFriendlyMessage(err));
          break;
        default:
          // Centralized handler: covers BOVINE_LOCATION_FULL, INVALID_PARENT,
          // SELF_PARENT, RANCH_MISMATCH with composed messages.
          toast.error('Error al guardar', getBovineErrorMessage(err));
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

  const handleFinalSubmit = form.handleSubmit((data) => {
    if (mutation.isPending) return;

    // Hard-block: if the user picked GPS coordinates AND a potrero, the
    // coordinates MUST fall inside the potrero's geofence boundary. Allowing
    // the save would create an inconsistency where a bovine is "in" a potrero
    // but its GPS position is far outside it.
    if (coordsOutsideBoundary) {
      setStep(3);
      const name = selectedLocation?.name ?? 'el potrero seleccionado';
      toast.error(
        'Ubicación GPS fuera del potrero',
        `Las coordenadas seleccionadas no están dentro del área de "${name}". `
        + 'Ajusta el pin en el mapa o cambia el potrero.',
      );
      return;
    }

    // F-22 / Backend C-03: si el usuario marco healthStatus enfermo, exigir
    // los datos clinicos minimos ANTES de submit. El backend tambien valida
    // (MISSING_CLINICAL_DATA), pero la UX es mucho mejor si bloqueamos
    // localmente y mostramos errores junto a los campos.
    const isSickStatus = data.healthStatus === 'SICK'
      || data.healthStatus === 'RECOVERING'
      || data.healthStatus === 'QUARANTINE';
    if (!isEditing && isSickStatus && !isClinicalDataValid(initialCase)) {
      setStep(2);
      const errs: Partial<Record<keyof InitialCaseInput, string>> = {};
      if (!initialCase?.diseaseId)   errs.diseaseId   = 'Selecciona la enfermedad.';
      if (!initialCase?.severity)    errs.severity    = 'Selecciona la severidad.';
      if (!initialCase?.diagnosedAt) errs.diagnosedAt = 'Captura la fecha de diagnóstico.';
      setClinicalErrors(errs);
      toast.error(
        'Faltan datos clínicos',
        'Para registrar un bovino enfermo, captura la enfermedad, severidad y fecha de diagnóstico.',
      );
      return;
    }

    mutation.mutate(data);
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const watchedValues = watch(['earTag', 'name', 'breed', 'cattleType', 'gender', 'birthDate', 'weight', 'healthStatus']);
  const [wEarTag, wName, wBreed, wCattleType, wGender, wBirthDate, wWeight, wHealth] = watchedValues;

  // F-22: si el usuario cambia healthStatus a HEALTHY/UNKNOWN/'', resetear
  // los datos clinicos para no enviar `initialCase` con basura. Tambien
  // limpia errores backend previos.
  useEffect(() => {
    const isSickStatus = wHealth === 'SICK' || wHealth === 'RECOVERING' || wHealth === 'QUARANTINE';
    if (!isSickStatus) {
      if (initialCase !== null) setInitialCase(null);
      if (Object.keys(clinicalErrors).length > 0) setClinicalErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wHealth]);

  // Watch GPS coords to validate them against the selected location's boundary
  // every time either changes. We do this in a memo so the validation badge
  // (and the submit button) react instantly without a re-render storm.
  const wLocationCoords = watch('location');

  /**
   * Reactive geofence containment check.
   *
   * Returns:
   *  - `null`              → no validation applies (no location chosen, no coords,
   *                          or the location has no geofence configured).
   *  - `{ inside: true }`  → GPS is inside the potrero's area → OK.
   *  - `{ inside: false }` → GPS is OUTSIDE → submit will be blocked.
   *
   * Uses the shared `isPointInBoundary` helper which already mirrors the
   * backend `isPointInBoundary` algorithm (CIRCULAR / RECTANGULAR / POLYGON).
   */
  const boundaryCheck = useMemo<{ inside: boolean } | null>(() => {
    if (!locationId) return null;
    if (!wLocationCoords?.latitude || !wLocationCoords?.longitude) return null;
    const gf = selectedLocation?.geofenceConfig as BoundaryShape | undefined;
    // No geofence configured → permissive (can't validate what isn't defined).
    if (!gf || !gf.type) return null;

    const inside = isPointInBoundary(
      { latitude: wLocationCoords.latitude, longitude: wLocationCoords.longitude },
      gf,
    );
    return { inside };
  }, [locationId, selectedLocation, wLocationCoords]);

  /** True if the user picked coords AND they fall outside the selected potrero. */
  const coordsOutsideBoundary = boundaryCheck?.inside === false;

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
      <form
        onSubmit={(e) => e.preventDefault()}
        className="space-y-4"
      >

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
                {/* Nombre — only letters and spaces allowed.
                    `handleNameChange` strips invalid chars (digits, symbols)
                    in real time. `register('name')` still wires `name`,
                    `onBlur`, `ref`; we just override `onChange`. */}
                <Input
                  label="Nombre (opcional)"
                  placeholder="Ej: La Bonita"
                  error={errors.name?.message}
                  {...register('name')}
                  onChange={handleNameChange}
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
                    onChange={(id) => {
                      // Cross-ranch defense: switching ranch invalidates any
                      // previously selected location (it belongs to another ranch).
                      if (id !== selectedRanchId) setLocationId(null);
                      setSelectedRanchId(id);
                      setRanchError('');
                    }}
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

              {/* ──────────────────────────────────────────────────────
                  Picker LOCAL (replaces the previous <FileUpload>).
                  The previous component uploaded to the GENERIC /uploads
                  endpoint immediately, but the resulting URL was never
                  associated with the bovine in the backend (see mutation
                  comments). The new flow keeps files in memory and uploads
                  them via the DEDICATED endpoint after the bovine is saved.
                  ────────────────────────────────────────────────────── */}

              {/* Hidden multi-file input + visible picker button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  // Reset the input so the same file can be reselected after removal.
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-amber-400 dark:hover:border-amber-500 bg-gray-50 dark:bg-gray-800/40 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
              >
                <Camera className="w-6 h-6 text-amber-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isEditing ? 'Agregar fotos del bovino' : 'Subir fotos del bovino'}
                </span>
                <span className="text-xs text-gray-500">
                  JPG, PNG, WEBP, HEIC · máx. 10 MB por imagen · hasta 10 imágenes
                </span>
              </button>

              {/* Existing media (edit mode) — marked for deletion ones are dimmed */}
              {existingMedia.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Imágenes actuales del bovino
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {existingMedia.map((m) => {
                      const markedForDelete = mediaToDelete.has(m.id);
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group',
                            markedForDelete && 'opacity-40 ring-2 ring-red-400',
                          )}
                        >
                          <img
                            src={m.thumbnailUrl ?? m.url}
                            alt={m.filename}
                            className="w-full h-full object-cover"
                          />
                          {markedForDelete && (
                            <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                              <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-semibold uppercase">
                                Se eliminará
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleExistingMediaForDeletion(m.id)}
                            className={cn(
                              'absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm',
                              markedForDelete
                                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                : 'bg-red-500 hover:bg-red-600 text-white',
                            )}
                            title={markedForDelete ? 'Cancelar eliminación' : 'Marcar para eliminar'}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pending files — to be uploaded after save */}
              {pendingFiles.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Pendientes de subir ({pendingFiles.length})
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {pendingFiles.map((file, i) => (
                      <div
                        key={`${file.name}-${file.size}-${i}`}
                        className="relative aspect-square rounded-lg overflow-hidden border border-amber-200 dark:border-amber-800 ring-1 ring-amber-300/50 group"
                      >
                        <img
                          src={pendingPreviews[i]}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-black/60 text-white text-[10px] truncate">
                          {file.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingFile(i)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="Quitar de la lista"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload errors surfaced from the mutation (post-save) */}
              {mediaUploadErrors.length > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                    El bovino se guardó, pero hubo errores al subir algunas imágenes:
                  </p>
                  <ul className="text-xs text-red-600 dark:text-red-300 space-y-0.5 list-disc pl-4">
                    {mediaUploadErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {/* legacy state — kept silent to avoid unused-var warnings */}
              {photos.length > 0 && null}
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
                {/* F-31 / Backend P-02: select "Estado de Vacunación" removido.
                    El estado no es captura manual — se deriva server-side de
                    las vacunas aplicadas (tabla `bovine_vaccination_status`).
                    El VET gestiona vacunas desde el tab Vacunación del
                    detalle, y el badge derivado aparece ahi automaticamente. */}
              </div>

              {/* F-22 / Backend C-01: seccion clinica condicional. Solo se
                  muestra cuando el usuario marca el bovino como enfermo. Se
                  envia en `initialCase` del payload y el backend abre el
                  caso clinico atomico (mismo trx que createBovine). En modo
                  edicion NO se muestra: enfermar a un bovino existente se
                  hace desde el modal "Marcar enfermo" (F-24) en el detail
                  page, que es un endpoint distinto (/sick). */}
              {!isEditing && (wHealth === 'SICK' || wHealth === 'RECOVERING' || wHealth === 'QUARANTINE') && (
                <div className="mt-4">
                  <ClinicalDataForm
                    value={initialCase}
                    onChange={(v) => {
                      setInitialCase(v);
                      // Limpiar errores previos del campo que el usuario edito
                      setClinicalErrors({});
                    }}
                    errors={clinicalErrors}
                  />
                </div>
              )}

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
                        label="Madre (hembra ≥ 15 meses)"
                        placeholder="Buscar por arete o nombre..."
                        // F-16 / G-07: purpose=dam aplica server-side
                        // FEMALE + edad reproductiva ≥ 15m. Reemplaza al
                        // filtro client-side por filterGender que no
                        // consideraba la edad reproductiva.
                        purpose="dam"
                        ranchId={activeRanchId}
                        value={field.value || null}
                        excludeIds={id ? [id] : []}
                        onChange={(bovineId) => field.onChange(bovineId || '')}
                        error={errors.motherId?.message}
                      />
                    )}
                  />
                  <Controller
                    name="fatherId"
                    control={control}
                    render={({ field }) => (
                      <BovineSelector
                        label="Padre (macho ≥ 18 meses)"
                        placeholder="Buscar por arete o nombre..."
                        // F-16 / G-07: purpose=sire aplica server-side
                        // MALE + edad reproductiva ≥ 18m.
                        purpose="sire"
                        ranchId={activeRanchId}
                        value={field.value || null}
                        excludeIds={id ? [id] : []}
                        onChange={(bovineId) => field.onChange(bovineId || '')}
                        error={errors.fatherId?.message}
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

              {/* Cross-ranch defense: filter potreros by the ranch picked in
                  Step 1, NOT the global activeRanchId. This prevents the user
                  from selecting a location belonging to a different ranch. */}
              <LocationSelector
                label="Potrero / Ubicación (opcional)"
                placeholder="Buscar potrero..."
                value={locationId}
                onChange={(id) => setLocationId(id)}
                ranchId={selectedRanchId || activeRanchId}
                clearable
              />

              {locationId && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  El animal será asignado a este potrero al guardar
                </p>
              )}

              {/* ── Entry metadata (only shown when a potrero is selected) ──
                  These three fields populate the BovineLocationHistory record
                  the backend creates via `locationService.recordEntry()` when
                  the bovine is first attached to a location:
                    reason       → MovementReason  (defaults to CREATION)
                    movementType → MovementType    (defaults to MANUAL)
                    notes        → free-form text  (optional)
                  Wrapped in an emerald-tinted panel so it visually belongs to
                  the "Asignar Potrero" card. */}
              {locationId && (
                <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Datos del primer registro de entrada
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Motivo de la entrada"
                      options={entryReasonOptions}
                      {...register('entryReason')}
                    />
                    <Select
                      label="Tipo de movimiento"
                      options={entryMovementTypeOptions}
                      {...register('entryMovementType')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Notas del movimiento (opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ej: Llegada del proveedor, condiciones del animal al ingresar..."
                      className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-none"
                      {...register('entryNotes')}
                    />
                    {errors.entryNotes?.message && (
                      <p className="mt-1 text-xs text-red-500">{errors.entryNotes.message}</p>
                    )}
                  </div>
                </div>
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
                <div className="mt-4 space-y-3">
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
                        // Render the selected potrero area on top of the map so
                        // the user can drop the pin INSIDE it visually.
                        locationBoundary={
                          (selectedLocation?.geofenceConfig as BoundaryShape | undefined) ?? null
                        }
                        locationName={selectedLocation?.name}
                      />
                    )}
                  />

                  {/* ── Geofence validation banner ───────────────────────
                      Reactive feedback: as soon as the user moves the pin
                      OR changes the selected potrero, we re-check whether
                      the GPS coordinates fall inside the potrero's real
                      area. Outcomes:
                        • no location chosen → no banner
                        • location has no geofenceConfig → info banner
                        • coords inside  → green badge
                        • coords outside → red badge + block submit */}
                  {locationId && wLocationCoords?.latitude != null && (
                    <>
                      {boundaryCheck === null && selectedLocation && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                          <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            El potrero <strong>{selectedLocation.name}</strong> no tiene
                            geocerca configurada — no es posible validar el punto contra
                            su área. Se guardará tal cual.
                          </p>
                        </div>
                      )}

                      {boundaryCheck?.inside === true && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-emerald-700 dark:text-emerald-300">
                            Las coordenadas están <strong>dentro</strong> del área de{' '}
                            <strong>{selectedLocation?.name}</strong>.
                          </p>
                        </div>
                      )}

                      {coordsOutsideBoundary && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <div className="text-xs text-red-700 dark:text-red-300">
                            <p className="font-semibold">
                              Las coordenadas están FUERA del área de "{selectedLocation?.name}".
                            </p>
                            <p className="mt-0.5">
                              No se puede registrar al bovino en un potrero y a la vez
                              ubicarlo geográficamente fuera de él. Mueve el pin dentro
                              del área o cambia el potrero seleccionado.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
                type="button"
                loading={mutation.isPending}
                disabled={coordsOutsideBoundary}
                onClick={handleFinalSubmit}
                icon={<Save className="w-4 h-4" />}
                title={coordsOutsideBoundary
                  ? 'Las coordenadas GPS están fuera del potrero seleccionado'
                  : undefined}
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
