import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { healthApi } from '@/api/health.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { getErrorCode, getFriendlyMessage, ErrorCodes } from '@/utils/errorHandler';
import { formatDate, formatRelative } from '@/utils/formatters';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { HealthStatusBadge } from '@/components/ui/HealthStatusBadge';
import { cn } from '@/utils/cn';
import {
  HealthRecordType,
  OverallHealthStatus,
  DiagnosisStatus,
  type HealthRecord,
} from '@/types/health.types';
import {
  Plus, ChevronDown, ChevronUp, AlertTriangle, Stethoscope,
  Syringe, FlaskConical, ClipboardList, RefreshCw, Thermometer,
  Scale, Heart, Calendar, DollarSign, User, FileText,
  CheckCircle2, Clock, Pill, Zap, Activity,
} from 'lucide-react';

// ─── Record type config ───────────────────────────────────────────────────────

interface RecordTypeConfig {
  label: string;
  dotColor: string;
  badgeClasses: string;
  icon: React.ElementType;
}

const RECORD_TYPE_CONFIG: Record<string, RecordTypeConfig> = {
  ROUTINE_CHECKUP:       { label: 'Revisión Rutinaria',   dotColor: 'bg-emerald-500', badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Stethoscope },
  EMERGENCY_VISIT:       { label: 'Emergencia',           dotColor: 'bg-red-500',     badgeClasses: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',                 icon: Zap },
  FOLLOW_UP:             { label: 'Seguimiento',          dotColor: 'bg-sky-500',     badgeClasses: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',                 icon: RefreshCw },
  VACCINATION:           { label: 'Vacunación',           dotColor: 'bg-blue-500',    badgeClasses: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',             icon: Syringe },
  TREATMENT:             { label: 'Tratamiento',          dotColor: 'bg-amber-500',   badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',         icon: Pill },
  SURGERY:               { label: 'Cirugía',              dotColor: 'bg-rose-500',    badgeClasses: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',             icon: Activity },
  LABORATORY_TEST:       { label: 'Laboratorio',          dotColor: 'bg-purple-500',  badgeClasses: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',     icon: FlaskConical },
  PHYSICAL_EXAM:         { label: 'Examen Físico',        dotColor: 'bg-teal-500',    badgeClasses: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',             icon: ClipboardList },
  REPRODUCTIVE_EXAM:     { label: 'Examen Reproductivo',  dotColor: 'bg-pink-500',    badgeClasses: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',             icon: Heart },
  QUARANTINE_ASSESSMENT: { label: 'Cuarentena',           dotColor: 'bg-orange-500',  badgeClasses: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',     icon: AlertTriangle },
  OTHER:                 { label: 'Otro',                 dotColor: 'bg-gray-400',    badgeClasses: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',                icon: FileText },
};

function getRecordConfig(type: string): RecordTypeConfig {
  return RECORD_TYPE_CONFIG[type] ?? RECORD_TYPE_CONFIG['OTHER'];
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const consultaSchema = z.object({
  recordType:          z.nativeEnum(HealthRecordType, { error: 'Selecciona el tipo de consulta' }),
  recordDate:          z.string().min(1, 'La fecha es requerida'),
  isEmergency:         z.boolean().default(false),
  chiefComplaint:      z.string().max(500).optional().or(z.literal('')),
  overallHealthStatus: z.nativeEnum(OverallHealthStatus, { error: 'Selecciona el estado de salud' }),
  // Vital signs (optional)
  temperature: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().min(30, 'Mínimo 30°C').max(45, 'Máximo 45°C').optional(),
  ),
  weight: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().min(1).max(2000).optional(),
  ),
  // Diagnosis
  primaryDiagnosis: z.string().max(500).optional().or(z.literal('')),
  diagnosisStatus:  z.nativeEnum(DiagnosisStatus).default(DiagnosisStatus.DIFFERENTIAL),
  // Notes & follow-up
  notes:              z.string().max(2000).optional().or(z.literal('')),
  followUpRequired:   z.boolean().default(false),
  followUpDate:       z.string().optional().or(z.literal('')),
  cost: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().min(0).optional(),
  ),
  recommendations: z.string().max(1000).optional().or(z.literal('')),
});

type ConsultaFormValues = z.infer<typeof consultaSchema>;

// ─── Select options ───────────────────────────────────────────────────────────

const recordTypeOptions = Object.entries(HealthRecordType).map(([, v]) => ({
  value: v,
  label: RECORD_TYPE_CONFIG[v]?.label ?? v,
}));

const healthStatusOptions = [
  { value: OverallHealthStatus.HEALTHY,    label: 'Saludable' },
  { value: OverallHealthStatus.SICK,       label: 'Enfermo' },
  { value: OverallHealthStatus.RECOVERING, label: 'En Recuperación' },
  { value: OverallHealthStatus.QUARANTINE, label: 'Cuarentena' },
  { value: OverallHealthStatus.UNKNOWN,    label: 'Desconocido' },
];

const diagnosisStatusOptions = [
  { value: DiagnosisStatus.DIFFERENTIAL, label: 'Diagnóstico diferencial' },
  { value: DiagnosisStatus.CONFIRMED,    label: 'Confirmado' },
  { value: DiagnosisStatus.RULED_OUT,    label: 'Descartado' },
];

// ─── Today helper ─────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── TimelineRecord — single expandable row ───────────────────────────────────

function TimelineRecord({
  record,
  isLast,
}: {
  record: HealthRecord;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getRecordConfig(record.recordType ?? record.type ?? 'OTHER');
  const RecordIcon = cfg.icon;

  return (
    <div className="relative flex gap-4">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn('w-3 h-3 rounded-full mt-1.5 shrink-0 ring-2 ring-white dark:ring-gray-900', cfg.dotColor)} />
        {!isLast && <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-800 mt-1" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
        {/* Collapsed header — always visible */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full text-left group"
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
            {/* Left: badges + title */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {/* Emergency flash */}
                {record.isEmergency && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-red-500 text-white">
                    <Zap className="w-2.5 h-2.5" /> URGENTE
                  </span>
                )}
                {/* Record type */}
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.badgeClasses)}>
                  <RecordIcon className="w-3 h-3" />
                  {cfg.label}
                </span>
                {/* Health status */}
                <HealthStatusBadge status={record.overallHealthStatus} showIcon={false} size="sm" />
                {/* Completed */}
                {record.isCompleted && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Completado
                  </span>
                )}
              </div>

              {/* Chief complaint or primary diagnosis */}
              {(record.chiefComplaint || record.diagnosis?.primaryDiagnosis) && (
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {record.chiefComplaint || record.diagnosis?.primaryDiagnosis}
                </p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(record.recordDate || record.createdAt)}
                </span>
                {record.veterinarianName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {record.veterinarianName}
                  </span>
                )}
                {record.cost != null && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${record.cost.toLocaleString('es-MX')}
                  </span>
                )}
              </div>
            </div>

            {/* Expand toggle */}
            <div className="shrink-0 flex items-start">
              <span className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-primary-500 transition-colors mt-1">
                {expanded ? (
                  <><ChevronUp className="w-4 h-4" /> Contraer</>
                ) : (
                  <><ChevronDown className="w-4 h-4" /> Ver detalle</>
                )}
              </span>
            </div>
          </div>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">

            {/* Vital signs */}
            {(record.vitalSigns || record.temperature != null || record.weight != null) && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5" /> Signos Vitales
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(record.vitalSigns?.temperature ?? record.temperature) != null && (
                    <VitalItem icon={Thermometer} label="Temperatura" value={`${record.vitalSigns?.temperature ?? record.temperature}°C`} />
                  )}
                  {record.vitalSigns?.heartRate != null && (
                    <VitalItem icon={Heart} label="Frec. Cardíaca" value={`${record.vitalSigns.heartRate} bpm`} />
                  )}
                  {record.vitalSigns?.respiratoryRate != null && (
                    <VitalItem icon={Activity} label="Frec. Resp." value={`${record.vitalSigns.respiratoryRate} rpm`} />
                  )}
                  {(record.physicalExam?.weight ?? record.weight) != null && (
                    <VitalItem icon={Scale} label="Peso" value={`${record.physicalExam?.weight ?? record.weight} kg`} />
                  )}
                  {record.physicalExam?.bodyConditionScore != null && (
                    <VitalItem icon={Activity} label="Condición Corp." value={`${record.physicalExam.bodyConditionScore}/5`} />
                  )}
                </div>
              </section>
            )}

            {/* Symptoms */}
            {record.symptoms?.primary && record.symptoms.primary.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Síntomas</p>
                <div className="flex flex-wrap gap-1.5">
                  {record.symptoms.primary.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                      {s}
                    </span>
                  ))}
                </div>
                {record.symptoms.severity && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Severidad: <span className="font-medium">{record.symptoms.severity}</span>
                    {record.symptoms.progression && <> · Progresión: <span className="font-medium">{record.symptoms.progression}</span></>}
                  </p>
                )}
              </section>
            )}

            {/* Diagnosis */}
            {record.diagnosis && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5" /> Diagnóstico
                </p>
                {record.diagnosis.primaryDiagnosis && (
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{record.diagnosis.primaryDiagnosis}</p>
                )}
                {record.diagnosis.secondaryDiagnoses && record.diagnosis.secondaryDiagnoses.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {record.diagnosis.secondaryDiagnoses.map((d, i) => (
                      <span key={i} className="text-xs text-gray-500 italic">{d}</span>
                    ))}
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                  <span>Estado: <span className="font-medium capitalize">{record.diagnosis.status?.toLowerCase()}</span></span>
                  {record.diagnosis.prognosis && (
                    <span>Pronóstico: <span className="font-medium">{record.diagnosis.prognosis}</span></span>
                  )}
                  {record.diagnosis.confidence != null && (
                    <span>Confianza: <span className="font-medium">{record.diagnosis.confidence}%</span></span>
                  )}
                </div>
              </section>
            )}

            {/* Treatment summary */}
            {record.treatment && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Pill className="w-3.5 h-3.5" /> Tratamiento
                </p>
                {record.treatment.treatmentPlan && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{record.treatment.treatmentPlan}</p>
                )}
                {record.treatment.medications && record.treatment.medications.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {record.treatment.medications.map((med, i) => (
                      <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="font-medium">{med.name}</span>
                        <span className="text-gray-400">{med.dosage} {med.dosageUnit} · {med.route}</span>
                        {med.withdrawalPeriod != null && (
                          <span className="text-orange-500">Retiro: {med.withdrawalPeriod}d</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Recommendations */}
            {record.recommendations && record.recommendations.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recomendaciones</p>
                <ul className="space-y-1">
                  {record.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Follow-up */}
            {record.followUpRequired && record.followUpDate && (
              <section className="flex items-center gap-2 p-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800">
                <Clock className="w-4 h-4 text-sky-500 shrink-0" />
                <p className="text-sm text-sky-700 dark:text-sky-400">
                  Seguimiento programado: <span className="font-semibold">{formatDate(record.followUpDate)}</span>
                  {record.followUpNotes && <> — {record.followUpNotes}</>}
                </p>
              </section>
            )}

            {/* Notes */}
            {record.notes && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notas</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{record.notes}</p>
              </section>
            )}

            {/* Footer: created at */}
            <p className="text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
              Registrado {formatRelative(record.createdAt)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── VitalItem — small vital sign display ─────────────────────────────────────

function VitalItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-700/60 border border-gray-100 dark:border-gray-700">
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400 leading-none">{label}</p>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── BovineHealthTab ──────────────────────────────────────────────────────────

interface Props {
  bovineId: string;
}

export function BovineHealthTab({ bovineId }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [showVitals, setShowVitals] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const canRecord = canUser(user?.role, 'RECORD_HEALTH');

  // ── History query ───────────────────────────────────────────────────────────
  const { data: records, isLoading } = useQuery({
    queryKey: ['bovine-health', bovineId],
    queryFn: () => healthApi.getHealthHistory(bovineId).then((r) => r.data.data ?? []),
    enabled: !!bovineId,
  });

  // Sort newest first
  const sorted = [...(records ?? [])].sort(
    (a, b) => new Date(b.recordDate ?? b.createdAt).getTime() - new Date(a.recordDate ?? a.createdAt).getTime(),
  );

  // ── Form ────────────────────────────────────────────────────────────────────
  const form = useForm<ConsultaFormValues>({
    resolver: zodResolver(consultaSchema) as any,
    defaultValues: {
      recordType:          HealthRecordType.ROUTINE_CHECKUP,
      recordDate:          todayISO(),
      isEmergency:         false,
      chiefComplaint:      '',
      overallHealthStatus: OverallHealthStatus.HEALTHY,
      diagnosisStatus:     DiagnosisStatus.DIFFERENTIAL,
      notes:               '',
      followUpRequired:    false,
      followUpDate:        '',
      recommendations:     '',
    },
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = form;
  const watchFollowUp   = watch('followUpRequired');
  const watchEmergency  = watch('isEmergency');

  // ── Mutation ─────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (data: ConsultaFormValues) =>
      healthApi.createRecord({
        bovineId,
        recordType:          data.recordType,
        recordDate:          data.recordDate,
        isEmergency:         data.isEmergency,
        chiefComplaint:      data.chiefComplaint || undefined,
        overallHealthStatus: data.overallHealthStatus,
        vitalSigns: data.temperature != null
          ? { temperature: data.temperature }
          : undefined,
        physicalExam: data.weight != null
          ? { weight: data.weight }
          : undefined,
        diagnosis: {
          primaryDiagnosis: data.primaryDiagnosis || undefined,
          status:           data.diagnosisStatus,
        },
        notes:            data.notes || undefined,
        followUpRequired: data.followUpRequired,
        followUpDate:     data.followUpDate || undefined,
        cost:             data.cost,
        recommendations:  data.recommendations
          ? data.recommendations.split('\n').map((r) => r.trim()).filter(Boolean)
          : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovine-health', bovineId] });
      queryClient.invalidateQueries({ queryKey: ['bovine', bovineId] });
      toast.success('Consulta registrada', 'El registro de salud fue guardado correctamente.');
      setShowModal(false);
      reset();
    },
    onError: (err: any) => {
      const code = getErrorCode(err);
      switch (code) {
        case ErrorCodes.TREATMENT_ALREADY_ACTIVE:
          toast.warning(
            'Tratamiento activo',
            'Este bovino ya tiene un tratamiento activo. Completa o suspende el tratamiento actual antes de iniciar uno nuevo.',
          );
          break;
        case ErrorCodes.VACCINATION_TOO_SOON:
          toast.warning(
            'Vacunación demasiado reciente',
            'No ha transcurrido el intervalo mínimo desde la última vacunación. Revisa el historial de vacunas.',
          );
          break;
        case ErrorCodes.DIAGNOSIS_REQUIRES_SYMPTOMS:
          toast.warning(
            'Síntomas requeridos',
            'Un diagnóstico confirmado requiere al menos un síntoma registrado. Agrega los síntomas observados.',
          );
          break;
        default:
          toast.error('Error al guardar', getFriendlyMessage(err));
      }
    },
  });

  const handleClose = () => {
    setShowModal(false);
    setShowVitals(false);
    setShowFollowUp(false);
    reset();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <CardTitle>Historial de Salud</CardTitle>
            {sorted.length > 0 && (
              <p className="text-sm text-gray-400 mt-0.5">{sorted.length} registro{sorted.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          {canRecord && (
            <Button
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowModal(true)}
            >
              Nueva Consulta
            </Button>
          )}
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Stethoscope className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sin registros de salud</p>
              <p className="text-xs text-gray-400 mt-0.5">Aún no se han registrado consultas para este animal.</p>
            </div>
            {canRecord && (
              <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>
                Registrar primera consulta
              </Button>
            )}
          </div>
        ) : (
          <div className="pl-1">
            {sorted.map((record, i) => (
              <TimelineRecord
                key={record.id}
                record={record}
                isLast={i === sorted.length - 1}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL — NUEVA CONSULTA
          ════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showModal}
        onClose={handleClose}
        title="Nueva Consulta de Salud"
        size="lg"
      >
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-5">

          {/* Emergency banner */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                {...register('isEmergency')}
              />
              <span className={cn(
                'flex items-center gap-1.5 text-sm font-medium transition-colors',
                watchEmergency ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300',
              )}>
                <Zap className={cn('w-4 h-4', watchEmergency ? 'text-red-500' : 'text-gray-400')} />
                Consulta de emergencia
              </span>
            </label>
          </div>

          {/* Type + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Tipo de Consulta *"
              options={recordTypeOptions}
              error={errors.recordType?.message}
              {...register('recordType')}
            />
            <Input
              type="date"
              label="Fecha *"
              error={errors.recordDate?.message}
              {...register('recordDate')}
            />
          </div>

          {/* Chief complaint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Motivo de Consulta
            </label>
            <textarea
              rows={2}
              placeholder="Describe el motivo principal de la consulta..."
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-none"
              {...register('chiefComplaint')}
            />
          </div>

          {/* Health status */}
          <Select
            label="Estado de Salud General *"
            options={healthStatusOptions}
            error={errors.overallHealthStatus?.message}
            {...register('overallHealthStatus')}
          />

          {/* Diagnosis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Diagnóstico Principal
              </label>
              <textarea
                rows={2}
                placeholder="Diagnóstico o hallazgos relevantes..."
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-none"
                {...register('primaryDiagnosis')}
              />
            </div>
            <Select
              label="Estado del Diagnóstico"
              options={diagnosisStatusOptions}
              {...register('diagnosisStatus')}
            />
          </div>

          {/* Vitals — collapsible */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowVitals((v) => !v)}
              className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/60 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Thermometer className="w-4 h-4 text-gray-400" />
                Signos Vitales
                <span className="text-xs text-gray-400 font-normal">(opcional)</span>
              </span>
              {showVitals
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showVitals && (
              <div className="p-4 grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  step="0.1"
                  label="Temperatura (°C)"
                  placeholder="38.5"
                  error={errors.temperature?.message}
                  {...register('temperature')}
                />
                <Input
                  type="number"
                  step="0.1"
                  label="Peso (kg)"
                  placeholder="450"
                  error={errors.weight?.message}
                  {...register('weight')}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notas y Observaciones
            </label>
            <textarea
              rows={3}
              placeholder="Observaciones adicionales, hallazgos del examen físico, etc."
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-none"
              {...register('notes')}
            />
          </div>

          {/* Recommendations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Recomendaciones
              <span className="text-xs text-gray-400 font-normal ml-1">(una por línea)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Aislar del hato por 48 horas&#10;Ej: Revisar en 7 días"
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-none"
              {...register('recommendations')}
            />
          </div>

          {/* Follow-up — collapsible */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                {...register('followUpRequired')}
                onChange={(e) => {
                  register('followUpRequired').onChange(e);
                  setShowFollowUp(e.target.checked);
                }}
              />
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Clock className="w-4 h-4 text-gray-400" />
                Requiere seguimiento
              </span>
            </label>
            {(watchFollowUp || showFollowUp) && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="date"
                  label="Fecha de Seguimiento"
                  {...register('followUpDate')}
                />
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  label="Costo de la consulta (MXN)"
                  placeholder="500"
                  error={errors.cost?.message}
                  {...register('cost')}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={mutation.isPending}
              icon={<Plus className="w-4 h-4" />}
            >
              Guardar Consulta
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
