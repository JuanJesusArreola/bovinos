import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { healthApi } from '@/api/health.api';
import { bovinesApi } from '@/api/bovines.api';
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
import {
  HeartPulse, Plus, Activity, Stethoscope, AlertTriangle,
  Thermometer, ChevronDown, ChevronUp, Pill, FlaskConical,
  ClipboardCheck, X, Calendar, FileText,
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

  const { data: bovinesData } = useQuery({
    queryKey: ['bovines-list'],
    queryFn: () => bovinesApi.list({ page: 1, limit: 200 }).then((r) => r.data.data),
  });

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
    },
  });

  const { fields: medFields, append: appendMed, remove: removeMed } = useFieldArray({
    control: form.control,
    name: 'medications',
  });

  const checkMutation = useMutation({
    mutationFn: (data: FormValues) => {
      // Build the nested payload matching backend HealthRecord structure
      const payload: any = {
        bovineId: data.bovineId,
        recordType: data.recordType,
        recordDate: data.recordDate,
        isEmergency: data.isEmergency || false,
        chiefComplaint: data.chiefComplaint || undefined,
        overallHealthStatus: data.overallHealthStatus,
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

      return healthApi.createRecord(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herd-health-stats'] });
      queryClient.invalidateQueries({ queryKey: ['bovines-list'] });
      toast.success('Registro guardado', 'El registro de salud fue creado exitosamente.');
      setModalOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      toast.error('Error al guardar', err?.response?.data?.error?.message || 'Verifica los datos e intenta de nuevo.');
    },
  });

  const bovineOptions = (bovinesData?.items || []).map((b) => ({
    value: b.id,
    label: `${b.earTag} — ${b.name || 'Sin nombre'}`,
  }));

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
    });
    setShowVitals(false);
    setShowSymptoms(false);
    setShowTreatment(false);
    setShowFollowUp(false);
    setModalOpen(true);
  }

  if (statsLoading) return <PageLoader />;

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
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => openNewCheck()}>
          Nuevo Registro
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} color={s.color} />
          ))}
        </div>
      )}

      {/* Health Distribution Bar */}
      {stats && stats.total > 0 && (
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

      {/* Bovines Grid */}
      <Card>
        <CardTitle>Bovinos del Hato</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Selecciona un bovino para registrar un nuevo chequeo de salud.
        </p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(bovinesData?.items || []).slice(0, 15).map((bovine) => (
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
        {(bovinesData?.items || []).length > 15 && (
          <p className="text-sm text-gray-400 mt-3 text-center">
            +{(bovinesData?.items || []).length - 15} bovinos más
          </p>
        )}
      </Card>

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
