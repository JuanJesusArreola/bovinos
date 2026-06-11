import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { healthApi } from '@/api/health.api';
import { bovinesApi } from '@/api/bovines.api';
import { bovineCasesApi } from '@/api/bovineCases.api';
import { useActiveDiseases } from '@/hooks/useDiseases';
import {
  CaseSeverity, CaseStatus,
  type CreateBovineCaseInput,
} from '@/types/bovineCase.dtos';
import {
  HealthRecordType,
  DiagnosisStatus,
  TreatmentStatus,
  SeverityLevel,
  OverallHealthStatus,
} from '@/types/health.types';
import type { HealthRecord, HealthStats } from '@/types';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { Alert } from '@/components/ui/Alert';
import { PageLoader } from '@/components/ui/Spinner';
import { FileUpload } from '@/components/ui/FileUpload';
import { PermissionGuard } from '@/components/ui/PermissionGuard';
import { RanchFilterBanner, RanchFilterBannerEmpty } from '@/components/shared/RanchFilterBanner';
import { Link } from 'react-router-dom';
import {
  HeartPulse, Plus, Activity, Stethoscope, AlertTriangle,
  Thermometer, ChevronDown, ChevronUp, Pill, FlaskConical,
  ClipboardCheck, X, Calendar, FileText, Microscope,
} from 'lucide-react';

// ─── Zod schema ────────────────────────────────────────────────────────────

const medicationSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  dosage: z.coerce.number().positive('Dosis requerida'),
  dosageUnit: z.string().min(1, 'Unidad requerida'),
  frequency: z.string().min(1, 'Frecuencia requerida'),
  duration: z.coerce.number().int().positive('Duración requerida'),
  route: z.enum(['ORAL', 'INJECTABLE', 'TOPICAL', 'INTRAVENOUS', 'INTRAMUSCULAR', 'SUBCUTANEOUS']),
  withdrawalPeriod: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(0).optional()),
  cost: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(0).optional()),
});

const healthRecordSchema = z.object({
  bovineId: z.string().min(1, 'Selecciona un bovino'),
  recordType: z.nativeEnum(HealthRecordType, { error: 'Selecciona tipo' }),
  recordDate: z.string().min(1, 'Fecha requerida'),
  isEmergency: z.boolean().optional(),
  chiefComplaint: z.string().max(500).optional().or(z.literal('')),
  overallHealthStatus: z.nativeEnum(OverallHealthStatus, { error: 'Estado requerido' }),

  // Vital signs
  temperature: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(35).max(45).optional()),
  heartRate: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(20).max(200).optional()),
  respiratoryRate: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(5).max(100).optional()),
  weight: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(1).max(2000).optional()),
  bodyConditionScore: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(1).max(9).optional()),

  // Symptoms
  primarySymptoms: z.string().optional().or(z.literal('')),
  symptomSeverity: z.nativeEnum(SeverityLevel).optional().or(z.literal('')),
  symptomOnset: z.enum(['SUDDEN', 'GRADUAL', 'CHRONIC']).optional().or(z.literal('')),
  appetiteChange: z.enum(['NORMAL', 'INCREASED', 'DECREASED', 'ABSENT']).optional().or(z.literal('')),

  // Diagnosis
  primaryDiagnosis: z.string().max(500).optional().or(z.literal('')),
  diagnosisStatus: z.nativeEnum(DiagnosisStatus),
  prognosis: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'GRAVE']).optional().or(z.literal('')),

  // Treatment
  treatmentPlan: z.string().max(2000).optional().or(z.literal('')),
  treatmentStatus: z.nativeEnum(TreatmentStatus).optional().or(z.literal('')),
  medications: z.array(medicationSchema).optional(),

  // Follow-up
  followUpRequired: z.boolean().optional(),
  followUpDate: z.string().optional().or(z.literal('')),
  followUpNotes: z.string().max(500).optional().or(z.literal('')),

  // Other
  notes: z.string().max(2000).optional().or(z.literal('')),
  cost: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(0).optional()),

  // ── Vinculación con módulo de Casos Clínicos (opción B) ───────────────
  // Cuando el VET registra una visita y selecciona una enfermedad del
  // catálogo, ofrecemos abrir automáticamente un BovineDiseaseCase paralelo.
  // El backend NO los sincroniza, así que hacemos 2 POST encadenados en
  // el frontend para que el VET no tenga que crear el caso aparte.
  /**
   * UUID de la enfermedad del catálogo. Cumple la mejora 4 del backend
   * (`diseaseId` en HealthRecord). Si el bovino está SICK / QUARANTINE,
   * activa la UI de "Abrir caso oficial" abajo.
   */
  diseaseId: z.string().optional().or(z.literal('')),
  /**
   * Si está marcado al enviar, además del HealthRecord se crea un
   * BovineDiseaseCase apuntando al mismo bovino + enfermedad. Default `true`
   * cuando hay diseaseId Y el estado del bovino es de enfermedad activa.
   */
  openCase: z.boolean().optional(),
  /** Severidad del CASO (LOW/MODERATE/HIGH/CRITICAL) — distinta del enum
   *  SeverityLevel del HealthRecord (que incluye MILD/SEVERE/FATAL). */
  caseSeverity: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']).optional(),
}).superRefine((data, ctx) => {
  // Calidad de datos: un diagnóstico marcado como CONFIRMED debe tener
  // texto. No tiene sentido "confirmar" un diagnóstico vacío. Para estados
  // DIFFERENTIAL / RULED_OUT el texto sigue siendo opcional.
  if (
    data.diagnosisStatus === DiagnosisStatus.CONFIRMED &&
    (!data.primaryDiagnosis || data.primaryDiagnosis.trim() === '')
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['primaryDiagnosis'],
      message: 'Escribe el diagnóstico para poder confirmarlo',
    });
  }
});

type FormValues = z.infer<typeof healthRecordSchema>;

// ─── Select options ────────────────────────────────────────────────────────

const recordTypeOptions = [
  { value: HealthRecordType.ROUTINE_CHECKUP, label: 'Chequeo Rutinario' },
  { value: HealthRecordType.EMERGENCY_VISIT, label: 'Emergencia' },
  { value: HealthRecordType.FOLLOW_UP, label: 'Seguimiento' },
  { value: HealthRecordType.VACCINATION, label: 'Vacunación' },
  { value: HealthRecordType.TREATMENT, label: 'Tratamiento' },
  { value: HealthRecordType.SURGERY, label: 'Cirugía' },
  { value: HealthRecordType.LABORATORY_TEST, label: 'Laboratorio' },
  { value: HealthRecordType.PHYSICAL_EXAM, label: 'Examen Físico' },
  { value: HealthRecordType.REPRODUCTIVE_EXAM, label: 'Examen Reproductivo' },
  { value: HealthRecordType.QUARANTINE_ASSESSMENT, label: 'Evaluación Cuarentena' },
  { value: HealthRecordType.PRE_TRANSPORT_EXAM, label: 'Pre-Transporte' },
  { value: HealthRecordType.NUTRITION_ASSESSMENT, label: 'Evaluación Nutricional' },
  { value: HealthRecordType.BEHAVIORAL_ASSESSMENT, label: 'Evaluación Conductual' },
  { value: HealthRecordType.NECROPSY, label: 'Necropsia' },
  { value: HealthRecordType.OTHER, label: 'Otro' },
];

const healthStatusOptions = [
  { value: OverallHealthStatus.HEALTHY, label: 'Saludable' },
  { value: OverallHealthStatus.SICK, label: 'Enfermo' },
  { value: OverallHealthStatus.RECOVERING, label: 'En Recuperación' },
  { value: OverallHealthStatus.QUARANTINE, label: 'Cuarentena' },
  { value: OverallHealthStatus.DECEASED, label: 'Fallecido' },
  { value: OverallHealthStatus.UNKNOWN, label: 'Desconocido' },
];

const diagnosisStatusOptions = [
  { value: DiagnosisStatus.CONFIRMED, label: 'Confirmado' },
  { value: DiagnosisStatus.DIFFERENTIAL, label: 'Diferencial' },
  { value: DiagnosisStatus.RULED_OUT, label: 'Descartado' },
];

const severityOptions = [
  { value: '', label: 'Sin especificar' },
  { value: SeverityLevel.MILD, label: 'Leve' },
  { value: SeverityLevel.MODERATE, label: 'Moderado' },
  { value: SeverityLevel.SEVERE, label: 'Severo' },
  { value: SeverityLevel.CRITICAL, label: 'Crítico' },
  { value: SeverityLevel.FATAL, label: 'Fatal' },
];

const prognosisOptions = [
  { value: '', label: 'Sin especificar' },
  { value: 'EXCELLENT', label: 'Excelente' },
  { value: 'GOOD', label: 'Bueno' },
  { value: 'FAIR', label: 'Regular' },
  { value: 'POOR', label: 'Pobre' },
  { value: 'GRAVE', label: 'Grave' },
];

const treatmentStatusOptions = [
  { value: '', label: 'Sin tratamiento' },
  { value: TreatmentStatus.ACTIVE, label: 'Activo' },
  { value: TreatmentStatus.COMPLETED, label: 'Completado' },
  { value: TreatmentStatus.SUSPENDED, label: 'Suspendido' },
  { value: TreatmentStatus.FAILED, label: 'Fallido' },
  { value: TreatmentStatus.CANCELLED, label: 'Cancelado' },
];

const routeOptions = [
  { value: 'ORAL', label: 'Oral' },
  { value: 'INJECTABLE', label: 'Inyectable' },
  { value: 'TOPICAL', label: 'Tópico' },
  { value: 'INTRAVENOUS', label: 'Intravenoso' },
  { value: 'INTRAMUSCULAR', label: 'Intramuscular' },
  { value: 'SUBCUTANEOUS', label: 'Subcutáneo' },
];

const onsetOptions = [
  { value: '', label: 'Sin especificar' },
  { value: 'SUDDEN', label: 'Súbito' },
  { value: 'GRADUAL', label: 'Gradual' },
  { value: 'CHRONIC', label: 'Crónico' },
];

const appetiteOptions = [
  { value: '', label: 'Sin especificar' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'INCREASED', label: 'Aumentado' },
  { value: 'DECREASED', label: 'Disminuido' },
  { value: 'ABSENT', label: 'Ausente' },
];

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  HEALTHY: 'success', SICK: 'warning', RECOVERING: 'info',
  QUARANTINE: 'danger', DECEASED: 'danger', UNKNOWN: 'default',
  CRITICAL: 'danger',
};

const statusLabels: Record<string, string> = {
  HEALTHY: 'Saludable', SICK: 'Enfermo', RECOVERING: 'Recuperación',
  QUARANTINE: 'Cuarentena', DECEASED: 'Fallecido', UNKNOWN: 'Desconocido',
  CRITICAL: 'Crítico', UNDER_TREATMENT: 'Tratamiento',
};

const recordTypeLabels: Record<string, string> = Object.fromEntries(
  recordTypeOptions.map((o) => [o.value, o.label]),
);

// ─── Component ─────────────────────────────────────────────────────────────

export function HealthListPage() {
  const { activeRanchId } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showVitals, setShowVitals] = useState(false);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [showTreatment, setShowTreatment] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────

  const { data: herdStats, isLoading: statsLoading } = useQuery({
    queryKey: ['herd-health-stats', activeRanchId],
    queryFn: () => healthApi.getHerdStats(activeRanchId!).then((r) => r.data.data),
    enabled: !!activeRanchId,
  });

  // Scope the bovines list to the active ranch. Previously this query ran
  // ALWAYS (no `enabled` gate, no `ranchId` filter) — without an active ranch
  // the backend could 500 or return an unexpected shape, and the page used
  // `bovinesData?.items` (legacy alias) which crashes the grid render when
  // the canonical `bovines` field is populated but `items` is not.
  const { data: bovinesData } = useQuery({
    queryKey: ['bovines-list', activeRanchId],
    queryFn: () =>
      bovinesApi
        // The backend validator caps `limit` at 100 (returns 400 with
        // "El límite debe estar entre 1 y 100" if exceeded). 100 is enough
        // for the "select a bovine" picker — the rest are paginated.
        .list({ page: 1, limit: 100, ranchId: activeRanchId! })
        .then((r) => r.data.data),
    enabled: !!activeRanchId,
  });

  /**
   * Canonical bovines array. The backend returns `bovines`; the optional
   * `items` alias is kept for backward compatibility. Always prefer the
   * canonical field — using only `items` (as the previous code did) yielded
   * an empty grid when the alias wasn't populated.
   */
  const bovineList = bovinesData?.bovines ?? bovinesData?.items ?? [];

  // ── Form ───────────────────────────────────────────────────────────────

  const form = useForm<FormValues>({
    resolver: zodResolver(healthRecordSchema) as any,
    defaultValues: {
      bovineId: '',
      recordType: HealthRecordType.ROUTINE_CHECKUP,
      recordDate: new Date().toISOString().split('T')[0],
      isEmergency: false,
      chiefComplaint: '',
      overallHealthStatus: OverallHealthStatus.HEALTHY,
      diagnosisStatus: DiagnosisStatus.CONFIRMED,
      medications: [],
      followUpRequired: false,
      diseaseId: '',
      // `openCase` arranca en true para que cuando el VET escoja una
      // enfermedad y un estado de "enfermo", el checkbox ya esté tildado
      // y el flujo sea de un solo click. Si lo desmarca, solo se crea el
      // HealthRecord, no el BovineDiseaseCase.
      openCase: true,
      caseSeverity: 'MODERATE',
    },
  });

  // Catálogo de enfermedades activas para el Select de diagnóstico.
  // Lazy: se trae solo cuando el modal está abierto (`enabled: modalOpen`).
  // Devuelve UUIDs (no slugs) → compatible con el backend que espera
  // `diseaseId` UUID tanto en POST /health/records como en POST /bovine-cases.
  const { data: activeDiseases = [] } = useActiveDiseases({ enabled: modalOpen });

  // ── Watch reactivo para mostrar la UI condicional de "Abrir caso" ──────
  // Mostramos el panel cuando:
  //   - El bovino está en un estado de enfermedad activa (SICK/QUARANTINE), Y
  //   - El VET seleccionó una enfermedad concreta del catálogo.
  // No tiene sentido ofrecer "abrir caso" para HEALTHY ni para DECEASED.
  const watchedHealthStatus = form.watch('overallHealthStatus');
  const watchedDiseaseId    = form.watch('diseaseId');
  const watchedDiagStatus   = form.watch('diagnosisStatus');
  const isActiveDisease =
    watchedHealthStatus === OverallHealthStatus.SICK ||
    watchedHealthStatus === OverallHealthStatus.QUARANTINE ||
    watchedHealthStatus === OverallHealthStatus.RECOVERING;
  const canSuggestCase = isActiveDisease && !!watchedDiseaseId;

  const { fields: medFields, append: appendMed, remove: removeMed } = useFieldArray({
    control: form.control,
    name: 'medications',
  });

  const checkMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Build the nested payload matching backend HealthRecord structure
      const payload: any = {
        bovineId: data.bovineId,
        recordType: data.recordType,
        recordDate: data.recordDate,
        isEmergency: data.isEmergency || false,
        chiefComplaint: data.chiefComplaint || undefined,
        overallHealthStatus: data.overallHealthStatus,
        // Mejora 4 del backend — diseaseId va plano en el HealthRecord.
        // Vacío → omitir (no se manda el campo) para no sobrescribir
        // un valor existente al hacer update; en create es indistinto.
        diseaseId: data.diseaseId || undefined,
        diagnosis: {
          primaryDiagnosis: data.primaryDiagnosis || undefined,
          status: data.diagnosisStatus,
          prognosis: data.prognosis || undefined,
        },
        notes: data.notes || undefined,
        cost: data.cost ?? undefined,
        followUpRequired: data.followUpRequired || false,
        followUpDate: data.followUpDate || undefined,
        followUpNotes: data.followUpNotes || undefined,
      };

      // Vital signs
      if (data.temperature || data.heartRate || data.respiratoryRate) {
        payload.vitalSigns = {
          temperature: data.temperature ?? undefined,
          heartRate: data.heartRate ?? undefined,
          respiratoryRate: data.respiratoryRate ?? undefined,
        };
      }

      // Physical exam
      if (data.weight || data.bodyConditionScore) {
        payload.physicalExam = {
          weight: data.weight ?? undefined,
          bodyConditionScore: data.bodyConditionScore ?? undefined,
        };
      }

      // Symptoms
      if (data.primarySymptoms) {
        payload.symptoms = {
          primary: data.primarySymptoms.split(',').map((s) => s.trim()).filter(Boolean),
          severity: data.symptomSeverity || undefined,
          onset: data.symptomOnset || undefined,
          appetiteChange: data.appetiteChange || undefined,
        };
      }

      // Treatment
      if (data.treatmentPlan || data.treatmentStatus || (data.medications && data.medications.length > 0)) {
        payload.treatment = {
          treatmentPlan: data.treatmentPlan || undefined,
          status: data.treatmentStatus || TreatmentStatus.ACTIVE,
          medications: data.medications?.length ? data.medications : undefined,
        };
      }

      // ── Paso 1: crear el HealthRecord (siempre) ─────────────────────────
      const recordRes = await healthApi.createRecord(payload);
      const createdRecord: any = (recordRes as any)?.data?.data ?? null;

      // ── Paso 2 (opcional): abrir BovineDiseaseCase paralelo ─────────────
      //
      // Condiciones para crear el caso:
      //   - El usuario marcó `openCase` (default true cuando aplica),
      //   - hay diseaseId del catálogo,
      //   - el estado clínico no es "saludable" ni "fallecido",
      //   - hay rancho activo en contexto (requerido por el backend).
      //
      // Si el POST del caso falla, NO hacemos rollback del HealthRecord —
      // el registro de salud ya quedó guardado correctamente y es valioso
      // por sí mismo. Reportamos el error secundario en un toast aparte.
      const shouldOpenCase =
        data.openCase === true &&
        !!data.diseaseId &&
        !!activeRanchId &&
        data.overallHealthStatus !== OverallHealthStatus.HEALTHY &&
        data.overallHealthStatus !== OverallHealthStatus.DECEASED &&
        data.overallHealthStatus !== OverallHealthStatus.UNKNOWN;

      let createdCase: any = null;
      let caseError: unknown = null;
      if (shouldOpenCase) {
        try {
          const casePayload: CreateBovineCaseInput = {
            bovineId:  data.bovineId,
            diseaseId: data.diseaseId!,
            ranchId:   activeRanchId!,
            severity:  (data.caseSeverity as CaseSeverity) ?? CaseSeverity.MODERATE,
            // Mapeo overallHealthStatus → CaseStatus:
            //   RECOVERING        → RECOVERING (idéntico)
            //   SICK + Confirmado → CONFIRMED
            //   SICK / QUARANTINE → SUSPECTED (el VET todavía investiga)
            status:
              data.overallHealthStatus === OverallHealthStatus.RECOVERING
                ? CaseStatus.RECOVERING
                : data.diagnosisStatus === DiagnosisStatus.CONFIRMED
                  ? CaseStatus.CONFIRMED
                  : CaseStatus.SUSPECTED,
            diagnosedAt: data.recordDate
              ? new Date(data.recordDate).toISOString()
              : undefined,
            notes: [data.primaryDiagnosis, data.notes].filter(Boolean).join(' · ')
              || undefined,
          };
          const caseRes = await bovineCasesApi.create(casePayload);
          createdCase = caseRes?.data?.data ?? null;
        } catch (err) {
          caseError = err;
        }
      }

      return { record: createdRecord, case: createdCase, caseError, shouldOpenCase };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['herd-health-stats'] });
      // Listado de bovinos: el queryKey real es `['bovines', 'list']`
      // (bovineKeys.lists()). El anterior `['bovines-list']` NO matcheaba
      // ninguna cache y los chips de salud no se refrescaban tras crear
      // un registro o abrir un caso.
      queryClient.invalidateQueries({ queryKey: ['bovines', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['bovines'] });
      // Si abrimos un caso, también invalidamos las cachés del módulo de
      // casos clínicos + epidemiología (snapshots, top diseases, trend).
      if (result?.case) {
        queryClient.invalidateQueries({ queryKey: ['bovine-cases'] });
        queryClient.invalidateQueries({ queryKey: ['epidemiology'] });
      }

      // Mensaje contextualizado al usuario:
      //   - Solo registro creado
      //   - Registro + caso creado
      //   - Registro creado pero caso falló (no es bloqueante)
      if (result?.case) {
        toast.success(
          'Registro y caso clínico creados',
          'Se registró la visita y se abrió el caso oficial en el módulo de Casos Clínicos.',
        );
      } else if (result?.shouldOpenCase && result?.caseError) {
        toast.warning(
          'Registro guardado, pero falló abrir el caso',
          `El HealthRecord se creó correctamente. El caso clínico paralelo no pudo crearse — puedes abrirlo manualmente desde /health/cases. (${(result.caseError as Error)?.message ?? 'error desconocido'})`,
        );
      } else {
        toast.success('Registro guardado', 'El registro de salud fue creado exitosamente.');
      }
      setModalOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      toast.error('Error al guardar', err?.response?.data?.error?.message || 'Verifica los datos e intenta de nuevo.');
    },
  });

  const bovineOptions = bovineList.map((b) => ({
    value: b.id,
    label: `${b.earTag} — ${b.name || 'Sin nombre'}`,
  }));

  // If we're still loading the herd stats AND a ranch is selected, show
  // the page loader. Without a ranch we fall through to the banner-only
  // render below — never block the UI on a query that's disabled.
  if (activeRanchId && statsLoading) return <PageLoader />;

  const stats = herdStats as HealthStats | undefined;

  const statCards = stats ? [
    { title: 'Saludables', value: stats.healthy, icon: HeartPulse, color: 'emerald' as const },
    { title: 'Enfermos', value: stats.sick, icon: Stethoscope, color: 'amber' as const },
    { title: 'Críticos', value: stats.critical, icon: AlertTriangle, color: 'red' as const },
    { title: 'En Tratamiento', value: stats.underTreatment, icon: Activity, color: 'purple' as const },
  ] : [];

  function openNewCheck(bovineId?: string) {
    form.reset({
      bovineId: bovineId || '',
      recordType: HealthRecordType.ROUTINE_CHECKUP,
      recordDate: new Date().toISOString().split('T')[0],
      isEmergency: false,
      overallHealthStatus: OverallHealthStatus.HEALTHY,
      diagnosisStatus: DiagnosisStatus.CONFIRMED,
      medications: [],
      followUpRequired: false,
      // Defaults para los campos nuevos (vinculación al catálogo + caso).
      // `openCase: true` solo se materializa cuando además hay diseaseId y
      // el bovino está enfermo (ver `canSuggestCase`). Para un chequeo
      // rutinario de un bovino sano, el panel ni siquiera se muestra.
      diseaseId: '',
      openCase: true,
      caseSeverity: 'MODERATE',
    });
    setShowVitals(false);
    setShowSymptoms(false);
    setShowTreatment(false);
    setShowFollowUp(false);
    setModalOpen(true);
  }

  const errorMessage = checkMutation.error
    ? ((checkMutation.error as any)?.response?.data?.error?.message || 'Error al registrar el chequeo')
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <HeartPulse className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Salud del Hato</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Monitoreo, diagnóstico y tratamiento</p>
          </div>
        </div>
        {/* Acciones del header. El acceso al catálogo de enfermedades NO
            depende del rancho seleccionado — es material de referencia
            global, así que se muestra siempre. */}
        <div className="flex items-center gap-2 flex-wrap">
          <PermissionGuard action="VIEW_EPIDEMIOLOGY">
            <Link
              to="/health/epidemiology"
              className="inline-flex items-center gap-2 px-3 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Activity className="w-4 h-4" />
              Epidemiología
            </Link>
          </PermissionGuard>
          <Link
            to="/health/records"
            className="inline-flex items-center gap-2 px-3 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <FileText className="w-4 h-4" />
            Registros
          </Link>
          <Link
            to="/health/diagnosis/stats"
            className="inline-flex items-center gap-2 px-3 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Stethoscope className="w-4 h-4" />
            Stats diagnostico
          </Link>
          <Link
            to="/health/cases"
            className="inline-flex items-center gap-2 px-3 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Stethoscope className="w-4 h-4" />
            Casos clínicos
          </Link>
          <Link
            to="/health/diseases/catalogo"
            className="inline-flex items-center gap-2 px-3 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Microscope className="w-4 h-4" />
            Catálogo de enfermedades
          </Link>
          {activeRanchId && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => openNewCheck()}>
              Nuevo Registro
            </Button>
          )}
        </div>
      </div>

      {/* Global ranch filter — same convention as Bovinos / Locations. */}
      <RanchFilterBanner
        activeHint="Mostrando información de salud de este rancho."
        emptyHint="Selecciona un rancho para ver la información de salud."
      />

      {/* Empty state when no ranch is selected — prevents downstream
          renders that depend on `activeRanchId` from crashing. */}
      {!activeRanchId && (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="Los registros de salud, estadísticas del hato y nuevos chequeos se cargan por rancho. Elige uno arriba para continuar."
        />
      )}

      {/* Stats */}
      {activeRanchId && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} color={s.color} />
          ))}
        </div>
      )}

      {/* Health Distribution Bar */}
      {activeRanchId && stats && stats.total > 0 && (
        <Card>
          <CardTitle>Distribución de Salud del Hato</CardTitle>
          <div className="mt-4">
            <div className="flex h-8 rounded-lg overflow-hidden">
              {stats.healthy > 0 && (
                <div className="bg-green-500 flex items-center justify-center text-white text-xs font-medium" style={{ width: `${(stats.healthy / stats.total) * 100}%` }}>
                  {Math.round((stats.healthy / stats.total) * 100)}%
                </div>
              )}
              {stats.sick > 0 && (
                <div className="bg-amber-500 flex items-center justify-center text-white text-xs font-medium" style={{ width: `${(stats.sick / stats.total) * 100}%` }}>
                  {Math.round((stats.sick / stats.total) * 100)}%
                </div>
              )}
              {stats.critical > 0 && (
                <div className="bg-red-500 flex items-center justify-center text-white text-xs font-medium" style={{ width: `${(stats.critical / stats.total) * 100}%` }}>
                  {Math.round((stats.critical / stats.total) * 100)}%
                </div>
              )}
              {stats.recovering > 0 && (
                <div className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium" style={{ width: `${(stats.recovering / stats.total) * 100}%` }}>
                  {Math.round((stats.recovering / stats.total) * 100)}%
                </div>
              )}
              {stats.underTreatment > 0 && (
                <div className="bg-purple-500 flex items-center justify-center text-white text-xs font-medium" style={{ width: `${(stats.underTreatment / stats.total) * 100}%` }}>
                  {Math.round((stats.underTreatment / stats.total) * 100)}%
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              <LegendItem color="bg-green-500" label="Saludable" count={stats.healthy} />
              <LegendItem color="bg-amber-500" label="Enfermo" count={stats.sick} />
              <LegendItem color="bg-red-500" label="Crítico" count={stats.critical} />
              <LegendItem color="bg-blue-500" label="Recuperación" count={stats.recovering} />
              <LegendItem color="bg-purple-500" label="Tratamiento" count={stats.underTreatment} />
            </div>
          </div>
        </Card>
      )}

      {/* Bovines Grid — only when a ranch is selected, otherwise the
          grid would be empty and the empty-state banner above already
          tells the user what to do. */}
      {activeRanchId && (
      <Card>
        <CardTitle>Bovinos del Hato</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Selecciona un bovino para registrar un nuevo chequeo de salud.
        </p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bovineList.slice(0, 15).map((bovine) => (
            <button
              key={bovine.id}
              onClick={() => openNewCheck(bovine.id)}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary-700 dark:text-primary-400">
                  {bovine.earTag?.slice(-3) || '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {bovine.name || bovine.earTag}
                </p>
                <p className="text-xs text-gray-500">{bovine.earTag}</p>
              </div>
              <Badge variant={statusVariant[bovine.healthStatus || ''] || 'default'}>
                {bovine.healthStatusLabel || statusLabels[bovine.healthStatus || ''] || '—'}
              </Badge>
            </button>
          ))}
        </div>
        {bovineList.length > 15 && (
          <p className="text-sm text-gray-400 mt-3 text-center">
            +{bovineList.length - 15} bovinos más
          </p>
        )}
      </Card>
      )}

      {/* ── New Health Record Modal ──────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Registro de Salud" size="xl">
        {errorMessage && <Alert variant="error" className="mb-4">{errorMessage}</Alert>}

        <form
          onSubmit={form.handleSubmit((d) => checkMutation.mutate(d))}
          className="space-y-6 max-h-[70vh] overflow-y-auto pr-1"
        >
          {/* ── Core Info ──────────────────────────────────────────────── */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary-600" />
              Información General
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Bovino *"
                options={bovineOptions}
                placeholder="Selecciona bovino"
                error={form.formState.errors.bovineId?.message}
                {...form.register('bovineId')}
              />
              <Select
                label="Tipo de Registro *"
                options={recordTypeOptions}
                error={form.formState.errors.recordType?.message}
                {...form.register('recordType')}
              />
              <Input
                type="date"
                label="Fecha del Registro *"
                error={form.formState.errors.recordDate?.message}
                {...form.register('recordDate')}
              />
              <Select
                label="Estado General de Salud *"
                options={healthStatusOptions}
                error={form.formState.errors.overallHealthStatus?.message}
                {...form.register('overallHealthStatus')}
              />
            </div>
            {/* Aviso: crear el registro propaga este estado al bovino en
                TODO el sistema (lista de hato, KPIs, mapas). Solo se muestra
                cuando el estado elegido no es "Saludable". */}
            {watchedHealthStatus && watchedHealthStatus !== OverallHealthStatus.HEALTHY && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Este registro marcará al animal como{' '}
                  <strong>
                    {healthStatusOptions.find((o) => o.value === watchedHealthStatus)?.label
                      ?? watchedHealthStatus}
                  </strong>{' '}
                  en todo el sistema (lista del hato, KPIs y mapas), no solo en este registro.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Input
                label="Motivo de Consulta"
                placeholder="Fiebre alta, pérdida de apetito..."
                {...form.register('chiefComplaint')}
              />
              <label className="flex items-center gap-2 self-end pb-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  {...form.register('isEmergency')}
                />
                <span className="text-sm font-medium text-red-600">Emergencia</span>
              </label>
            </div>
          </fieldset>

          {/* ── Vital Signs ────────────────────────────────────────────── */}
          <fieldset>
            <button type="button" onClick={() => setShowVitals(!showVitals)} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
              <Thermometer className="w-4 h-4 text-primary-600" />
              Signos Vitales y Examen Físico
              {showVitals ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showVitals && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Input label="Temperatura (°C)" type="number" step="0.1" min={35} max={45} placeholder="38.5" {...form.register('temperature')} />
                <Input label="Frecuencia Cardíaca (lpm)" type="number" min={20} max={200} placeholder="60" {...form.register('heartRate')} />
                <Input label="Frecuencia Respiratoria" type="number" min={5} max={100} placeholder="20" {...form.register('respiratoryRate')} />
                <Input label="Peso (kg)" type="number" step="0.1" min={1} max={2000} placeholder="450" {...form.register('weight')} />
                <Input label="Condición Corporal (1-9)" type="number" step="0.5" min={1} max={9} placeholder="5" {...form.register('bodyConditionScore')} />
              </div>
            )}
          </fieldset>

          {/* ── Symptoms ───────────────────────────────────────────────── */}
          <fieldset>
            <button type="button" onClick={() => setShowSymptoms(!showSymptoms)} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
              <AlertTriangle className="w-4 h-4 text-primary-600" />
              Síntomas
              {showSymptoms ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showSymptoms && (
              <div className="space-y-4">
                <Input
                  label="Síntomas Principales (separados por coma)"
                  placeholder="Fiebre, pérdida de apetito, letargia"
                  {...form.register('primarySymptoms')}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Select label="Severidad" options={severityOptions} {...form.register('symptomSeverity')} />
                  <Select label="Inicio" options={onsetOptions} {...form.register('symptomOnset')} />
                  <Select label="Apetito" options={appetiteOptions} {...form.register('appetiteChange')} />
                </div>
              </div>
            )}
          </fieldset>

          {/* ── Diagnosis (always visible) ─────────────────────────────── */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-primary-600" />
              Diagnóstico
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Diagnóstico Principal"
                placeholder="Mastitis subclínica"
                {...form.register('primaryDiagnosis')}
              />
              <Select
                label="Estado del Diagnóstico *"
                options={diagnosisStatusOptions}
                error={form.formState.errors.diagnosisStatus?.message}
                {...form.register('diagnosisStatus')}
              />
              <Select
                label="Pronóstico"
                options={prognosisOptions}
                {...form.register('prognosis')}
              />
            </div>

            {/* ── Enfermedad del catálogo (mejora 4) ────────────────────
                Permite vincular el registro a una entrada concreta del
                catálogo global de enfermedades. Habilita además la UI
                de "abrir caso clínico oficial" más abajo cuando el
                estado del bovino es de enfermedad activa. */}
            <div className="mt-4">
              <Select
                label="Enfermedad del catálogo (opcional)"
                options={[
                  { value: '', label: 'Sin vincular al catálogo' },
                  ...activeDiseases.map((d) => ({ value: d.id, label: d.name })),
                ]}
                {...form.register('diseaseId')}
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Vincular permite que este registro aparezca en las estadísticas
                epidemiológicas y, si el bovino está enfermo, abrir un caso oficial.
              </p>
            </div>

            {/* ── Panel "Abrir caso clínico" — solo si tiene sentido ────
                Aparece cuando el bovino está enfermo Y hay enfermedad
                del catálogo seleccionada. El checkbox controla si se
                hace el segundo POST (a /bovine-cases) tras crear el
                HealthRecord. Default checked para que el flujo común
                (un VET reportando un enfermo) sea de un solo click. */}
            {canSuggestCase && (
              <div className="mt-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-4 space-y-3">
                <Controller
                  control={form.control}
                  name="openCase"
                  render={({ field }) => (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                          Abrir también un caso clínico oficial
                        </p>
                        <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                          Crea una entrada en <strong>Casos Clínicos</strong> para
                          dar seguimiento al ciclo SUSPECTED → CONFIRMED → RECOVERED
                          y que aparezca en el dashboard de epidemiología y en el
                          mapa de brotes. El registro de salud y el caso quedan
                          ligados al mismo bovino y enfermedad.
                        </p>
                      </div>
                    </label>
                  )}
                />

                {/* Severity solo aplica si se abre el caso. */}
                {form.watch('openCase') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-blue-200/50 dark:border-blue-700/30">
                    <Select
                      label="Severidad del caso"
                      options={[
                        { value: 'LOW',      label: 'Baja' },
                        { value: 'MODERATE', label: 'Moderada' },
                        { value: 'HIGH',     label: 'Alta' },
                        { value: 'CRITICAL', label: 'Crítica' },
                      ]}
                      {...form.register('caseSeverity')}
                    />
                    <div className="flex flex-col justify-center text-xs text-blue-700/80 dark:text-blue-300/80">
                      Status inicial del caso se derivará de:
                      <span className="font-mono mt-0.5">
                        {watchedHealthStatus === OverallHealthStatus.RECOVERING
                          ? 'RECOVERING'
                          : watchedDiagStatus === DiagnosisStatus.CONFIRMED
                            ? 'CONFIRMED'
                            : 'SUSPECTED'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {/* ── Treatment ──────────────────────────────────────────────── */}
          <fieldset>
            <button type="button" onClick={() => setShowTreatment(!showTreatment)} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
              <Pill className="w-4 h-4 text-primary-600" />
              Tratamiento y Medicamentos
              {showTreatment ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showTreatment && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select label="Estado del Tratamiento" options={treatmentStatusOptions} {...form.register('treatmentStatus')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Plan de Tratamiento</label>
                  <textarea
                    rows={2}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                    placeholder="Descripción del plan de tratamiento..."
                    {...form.register('treatmentPlan')}
                  />
                </div>

                {/* Medications */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Medicamentos</label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<Plus className="w-3 h-3" />}
                      onClick={() => appendMed({
                        name: '', dosage: 0, dosageUnit: 'ml', frequency: '',
                        duration: 0, route: 'INTRAMUSCULAR', withdrawalPeriod: undefined, cost: undefined,
                      })}
                    >
                      Agregar
                    </Button>
                  </div>
                  {medFields.map((field, index) => (
                    <div key={field.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg mb-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Medicamento {index + 1}</span>
                        <button type="button" onClick={() => removeMed(index)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Input label="Nombre *" placeholder="Oxitetraciclina" error={form.formState.errors.medications?.[index]?.name?.message} {...form.register(`medications.${index}.name`)} />
                        <Input label="Dosis *" type="number" step="0.1" placeholder="5" error={form.formState.errors.medications?.[index]?.dosage?.message} {...form.register(`medications.${index}.dosage`)} />
                        <Input label="Unidad *" placeholder="ml" {...form.register(`medications.${index}.dosageUnit`)} />
                        <Input label="Frecuencia *" placeholder="Cada 12h" {...form.register(`medications.${index}.frequency`)} />
                        <Input label="Duración (días) *" type="number" placeholder="5" {...form.register(`medications.${index}.duration`)} />
                        <Select label="Vía *" options={routeOptions} {...form.register(`medications.${index}.route`)} />
                        <Input label="Retiro (días)" type="number" placeholder="21" {...form.register(`medications.${index}.withdrawalPeriod`)} />
                        <Input label="Costo" type="number" step="0.01" placeholder="250" {...form.register(`medications.${index}.cost`)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          {/* ── Follow-up ──────────────────────────────────────────────── */}
          <fieldset>
            <button type="button" onClick={() => setShowFollowUp(!showFollowUp)} className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
              <Calendar className="w-4 h-4 text-primary-600" />
              Seguimiento y Costos
              {showFollowUp ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showFollowUp && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" {...form.register('followUpRequired')} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Requiere seguimiento</span>
                </label>
                {form.watch('followUpRequired') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input type="date" label="Fecha de Seguimiento" {...form.register('followUpDate')} />
                    <Input label="Notas de Seguimiento" placeholder="Reevaluar en 7 días..." {...form.register('followUpNotes')} />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input type="number" step="0.01" min={0} label="Costo Total (MXN)" placeholder="1500" {...form.register('cost')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notas Generales</label>
                  <textarea
                    rows={3}
                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                    placeholder="Observaciones adicionales..."
                    {...form.register('notes')}
                  />
                </div>

                {/* File uploads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FileUpload
                    category="health_reports"
                    label="Reportes de Salud (PDF/DOC)"
                  />
                  <FileUpload
                    category="veterinary_docs"
                    label="Documentos Veterinarios"
                  />
                </div>
              </div>
            )}
          </fieldset>

          {/* ── Actions ────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={checkMutation.isPending} icon={<HeartPulse className="w-4 h-4" />}>
              Registrar
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Record Detail Modal ─────────────────────────────────────────── */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Detalle del Registro" size="lg">
        {selectedRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="Bovino" value={selectedRecord.bovineName || selectedRecord.bovineEarTag || selectedRecord.bovineId} />
              <InfoItem label="Tipo" value={recordTypeLabels[selectedRecord.recordType] || selectedRecord.recordType || selectedRecord.type || ''} />
              <InfoItem label="Estado" value={statusLabels[selectedRecord.overallHealthStatus || selectedRecord.status || ''] || ''} />
              <InfoItem label="Fecha" value={selectedRecord.recordDate ? new Date(selectedRecord.recordDate).toLocaleDateString() : selectedRecord.createdAt ? new Date(selectedRecord.createdAt).toLocaleDateString() : ''} />
              {selectedRecord.veterinarianName && <InfoItem label="Veterinario" value={selectedRecord.veterinarianName} />}
              {selectedRecord.cost && <InfoItem label="Costo" value={`$${selectedRecord.cost.toLocaleString()} MXN`} />}
            </div>
            {selectedRecord.vitalSigns && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Signos Vitales</p>
                <div className="grid grid-cols-3 gap-2">
                  {selectedRecord.vitalSigns.temperature && <InfoItem label="Temperatura" value={`${selectedRecord.vitalSigns.temperature}°C`} />}
                  {selectedRecord.vitalSigns.heartRate && <InfoItem label="FC" value={`${selectedRecord.vitalSigns.heartRate} lpm`} />}
                  {selectedRecord.vitalSigns.respiratoryRate && <InfoItem label="FR" value={`${selectedRecord.vitalSigns.respiratoryRate} rpm`} />}
                </div>
              </div>
            )}
            {selectedRecord.diagnosis?.primaryDiagnosis && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Diagnóstico</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedRecord.diagnosis.primaryDiagnosis}</p>
                <Badge variant={selectedRecord.diagnosis.status === 'CONFIRMED' ? 'success' : 'warning'} className="mt-1">
                  {selectedRecord.diagnosis.status}
                </Badge>
              </div>
            )}
            {selectedRecord.treatment?.treatmentPlan && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Tratamiento</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedRecord.treatment.treatmentPlan}</p>
              </div>
            )}
            {selectedRecord.notes && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Notas</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedRecord.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Helper components ─────────────────────────────────────────────────────

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-gray-600 dark:text-gray-400">{label}: <strong>{count}</strong></span>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
