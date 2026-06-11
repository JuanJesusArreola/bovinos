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
  isTreatmentActive,
  type HealthRecord,
  type TreatmentMedication,
} from '@/types/health.types';
import { RecordMedicationDoseModal } from '@/components/health/RecordMedicationDoseModal';
import { StartTreatmentModal } from '@/components/health/StartTreatmentModal';
import { CompleteTreatmentModal } from '@/components/health/CompleteTreatmentModal';
import { EditHealthRecordModal } from '@/components/health/EditHealthRecordModal';
import { DeleteHealthRecordModal } from '@/components/health/DeleteHealthRecordModal';
import { UploadLabResultsModal } from '@/components/health/UploadLabResultsModal';
import { LabResultsSection } from '@/components/health/LabResultsSection';
import { BovineLabTrendCard } from '@/components/health/BovineLabTrendCard';
import { BovineHealthSummaryCard } from '@/components/health/BovineHealthSummaryCard';
import { RegisterDiagnosisModal } from '@/components/health/RegisterDiagnosisModal';
import { useConfirmDiagnosis } from '@/hooks/useBovineHealth';
import { Link } from 'react-router-dom';
import {
  HEALTH_RECORD_TYPE_LABELS,
  HEALTH_RECORD_TYPE_DOT_CLASSES,
  HEALTH_RECORD_TYPE_BADGE_CLASSES,
  getHealthRecordTypeLabel,
} from '@/design-system/tokens';
import {
  Plus, ChevronDown, ChevronUp, AlertTriangle, Stethoscope,
  Syringe, FlaskConical, ClipboardList, RefreshCw, Thermometer,
  Scale, Heart, Calendar, DollarSign, User, FileText,
  CheckCircle2, Clock, Pill, Zap, Activity, Play,
  Pencil, Trash2, ExternalLink,
} from 'lucide-react';

// ─── Record type config ───────────────────────────────────────────────────────

interface RecordTypeConfig {
  label: string;
  dotColor: string;
  badgeClasses: string;
  icon: React.ElementType;
}

/**
 * Iconos por tipo de registro — viven local porque son componentes React.
 * Labels y clases vienen del design-system.
 */
const RECORD_TYPE_ICONS: Record<string, React.ElementType> = {
  ROUTINE_CHECKUP:       Stethoscope,
  EMERGENCY_VISIT:       Zap,
  FOLLOW_UP:             RefreshCw,
  VACCINATION:           Syringe,
  TREATMENT:             Pill,
  SURGERY:               Activity,
  LABORATORY_TEST:       FlaskConical,
  PHYSICAL_EXAM:         ClipboardList,
  REPRODUCTIVE_EXAM:     Heart,
  QUARANTINE_ASSESSMENT: AlertTriangle,
  OTHER:                 FileText,
};

/**
 * Resuelve label + dot + badge + icono para un tipo de registro de salud.
 * Si el tipo es desconocido, cae al config de `OTHER` para que el render
 * nunca falle (defensive: el backend podría agregar tipos nuevos).
 */
function getRecordConfig(type: string): RecordTypeConfig {
  const labels = HEALTH_RECORD_TYPE_LABELS as Record<string, string>;
  const dots   = HEALTH_RECORD_TYPE_DOT_CLASSES as Record<string, string>;
  const badges = HEALTH_RECORD_TYPE_BADGE_CLASSES as Record<string, string>;
  return {
    label:        labels[type] ?? labels.OTHER,
    dotColor:     dots[type]   ?? dots.OTHER,
    badgeClasses: badges[type] ?? badges.OTHER,
    icon:         RECORD_TYPE_ICONS[type] ?? RECORD_TYPE_ICONS.OTHER,
  };
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
  // Usa el helper defensivo del design-system — antes referenciaba el
  // `RECORD_TYPE_CONFIG` local que se eliminó en la migración a tokens.
  label: getHealthRecordTypeLabel(v),
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
  canManage,
  onEdit,
  onDelete,
  onAddLab,
  onRegisterDiagnosis,
  onConfirmDiagnosis,
  confirmingDiagnosisId,
}: {
  record: HealthRecord;
  isLast: boolean;
  /** Si true, se muestran los botones de editar/eliminar/subir lab/diagnosis. */
  canManage?: boolean;
  /** Click "Editar" - el caller abre el modal correspondiente. */
  onEdit?: (record: HealthRecord) => void;
  /** Click "Eliminar" - el caller abre el modal de confirmacion. */
  onDelete?: (record: HealthRecord) => void;
  /** Click "Subir resultados de lab" - abre el modal de upload. */
  onAddLab?: (healthId: string) => void;
  /** Click "Registrar/actualizar diagnostico" - abre el modal. */
  onRegisterDiagnosis?: (record: HealthRecord) => void;
  /** Click "Confirmar diagnostico" - dispara la mutacion inline. */
  onConfirmDiagnosis?: (healthId: string) => void;
  /** Si la mutacion de confirmar esta corriendo para ESTE record, el
   *  caller pasa el healthId aqui para deshabilitar el boton mientras. */
  confirmingDiagnosisId?: string | null;
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

            {/* Expand toggle + edit/delete actions.
                Los botones de editar/eliminar NO van DENTRO del <button>
                expand-toggle (anidar buttons rompe accesibilidad). Los
                ponemos como hermanos en el contenedor flex y usan
                stopPropagation para evitar disparar el toggle al hacer
                click. Solo se muestran si canManage es true. */}
            <div className="shrink-0 flex items-start gap-2">
              {canManage && (
                <div className="flex items-center gap-1 mt-0.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEdit?.(record); }}
                    className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                    title="Editar registro"
                    aria-label="Editar registro"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete?.(record); }}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="Eliminar registro (soft delete)"
                    aria-label="Eliminar registro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Link a la pagina completa del record. NO anidado dentro del
                  button del expand-toggle (rompe accesibilidad), por eso
                  hermano en el flex container con stopPropagation. */}
              <Link
                to={`/health/records/${record.id}`}
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors mt-0.5"
                title="Ver pagina completa del registro"
                aria-label="Ver pagina completa"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
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

            {/* Diagnosis - SIEMPRE se renderiza si el usuario tiene
                permiso (asi puede registrar uno aunque el record no
                tenga). Si el record SI tiene diagnosis, mostramos
                detalles + opciones de Actualizar / Confirmar. */}
            {(record.diagnosis?.primaryDiagnosis || canManage) && (
              <section>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5" /> Diagnostico
                    {record.diagnosis?.confirmedAt && (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Confirmado
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    {canManage && record.diagnosis?.primaryDiagnosis
                      && !record.diagnosis.confirmedAt
                      && onConfirmDiagnosis && (
                        <button
                          type="button"
                          onClick={() => onConfirmDiagnosis(record.id)}
                          disabled={confirmingDiagnosisId === record.id}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Confirmar diagnostico (anade confirmedAt + confirmedBy)"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {confirmingDiagnosisId === record.id ? 'Confirmando...' : 'Confirmar'}
                        </button>
                      )}
                    {canManage && onRegisterDiagnosis && (
                      <button
                        type="button"
                        onClick={() => onRegisterDiagnosis(record)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        <Stethoscope className="w-3 h-3" />
                        {record.diagnosis?.primaryDiagnosis ? 'Actualizar' : 'Registrar diagnostico'}
                      </button>
                    )}
                  </div>
                </div>
                {record.diagnosis?.primaryDiagnosis && (
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{record.diagnosis.primaryDiagnosis}</p>
                )}
                {!record.diagnosis?.primaryDiagnosis && canManage && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    Sin diagnostico registrado. Usa el boton arriba cuando tengas los datos.
                  </p>
                )}
                {record.diagnosis?.secondaryDiagnoses && record.diagnosis.secondaryDiagnoses.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {record.diagnosis.secondaryDiagnoses.map((d, i) => (
                      <span key={i} className="text-xs text-gray-500 italic">{d}</span>
                    ))}
                  </div>
                )}
                {record.diagnosis && (
                <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  {record.diagnosis.status && (
                    <span>Estado: <span className="font-medium capitalize">{record.diagnosis.status?.toLowerCase()}</span></span>
                  )}
                  {record.diagnosis.prognosis && (
                    <span>Pronostico: <span className="font-medium">{record.diagnosis.prognosis}</span></span>
                  )}
                  {record.diagnosis.confidence != null && (
                    <span>Confianza: <span className="font-medium">{record.diagnosis.confidence}%</span></span>
                  )}
                </div>
                )}
              </section>
            )}

            {/* Treatment summary */}
            {record.treatment && (
              <section>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Pill className="w-3.5 h-3.5" /> Tratamiento
                    {record.treatment.status && (
                      <span
                        className={cn(
                          'ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          isTreatmentActive(record.treatment.status)
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                        )}
                      >
                        {record.treatment.status}
                      </span>
                    )}
                  </p>
                  {/* Boton contextual: si no hay treatment activo, ofrecer
                      "Iniciar tratamiento"; si esta abierto, ofrecer
                      "Completar". El permiso usa RECORD_HEALTH (mismo
                      gate que la creacion de records y la dosis). */}
                  {canRecord && (() => {
                    const active = isTreatmentActive(record.treatment.status);
                    if (active) {
                      return (
                        <button
                          type="button"
                          onClick={() => setCompleteTreatmentTarget({
                            healthId: record.id,
                            medications: record.treatment?.medications as
                              TreatmentMedication[] | undefined,
                          })}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Completar tratamiento
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => setStartTreatmentTarget({
                          healthId: record.id,
                          defaultDiagnosis:
                            record.diagnosis?.primaryDiagnosis ?? undefined,
                        })}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        <Play className="w-3 h-3" />
                        Iniciar tratamiento
                      </button>
                    );
                  })()}
                </div>
                {record.treatment.treatmentPlan && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{record.treatment.treatmentPlan}</p>
                )}
                {record.treatment.medications && record.treatment.medications.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {record.treatment.medications.map((med, i) => {
                      // Conteo de dosis aplicadas a la fecha. Si el backend
                      // no envia administeredAt[], asumimos 0 y dejamos el
                      // boton disponible para registrar la primera.
                      const dosesGiven = med.administeredAt?.length
                        ?? med.administeredCount
                        ?? 0;
                      // No tenemos forma robusta de calcular "dosis planeadas
                      // totales" desde frequency + duration sin parsear
                      // texto libre ("cada 48h"), asi que mostramos solo el
                      // conteo aplicadas. Si el backend expone un total
                      // calculado en futuro lo agregamos aqui.
                      return (
                        <li
                          key={i}
                          className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5 flex-wrap"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="font-medium">{med.name}</span>
                          <span className="text-gray-400">
                            {med.dosage} {med.dosageUnit} &middot; {med.route}
                          </span>
                          {med.withdrawalPeriod != null && (
                            <span className="text-orange-500">
                              Retiro: {med.withdrawalPeriod}d
                            </span>
                          )}
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                              dosesGiven > 0
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                            )}
                          >
                            {dosesGiven} {dosesGiven === 1 ? 'dosis' : 'dosis'} aplicada{dosesGiven === 1 ? '' : 's'}
                          </span>
                          {canRecord && (
                            <button
                              type="button"
                              onClick={() => setDoseTarget({
                                healthId: record.id,
                                medicationIndex: i,
                                medication: med,
                              })}
                              className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
                              title="Registrar una dosis aplicada hoy"
                            >
                              <Pill className="w-3 h-3" />
                              Registrar dosis
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {/* Laboratorio - resultados con auto-interpretacion.
                LabResultsSection se autocontrola (filtros, agrupacion
                por testName, badges de NORMAL/ABNORMAL/CRITICAL). Si
                no hay resultados, no se renderiza nada. */}
            {(() => {
              const labResults = (record as any).laboratoryResults
                ?? (record as any).labResults
                ?? [];
              const hasLab = Array.isArray(labResults) && labResults.length > 0;
              if (hasLab) {
                return (
                  <LabResultsSection
                    results={labResults}
                    onAddMore={canManage && onAddLab
                      ? () => onAddLab(record.id)
                      : undefined}
                  />
                );
              }
              // Sin resultados todavia: si el usuario tiene permiso,
              // ofrecemos un atajo para subir el primer resultado.
              if (canManage && onAddLab) {
                return (
                  <section>
                    <button
                      type="button"
                      onClick={() => onAddLab(record.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      Subir resultados de laboratorio
                    </button>
                  </section>
                );
              }
              return null;
            })()}

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
  // Estado del modal "Registrar dosis aplicada". Guardamos el contexto
  // completo (record + medicamento + indice) en una sola entrada para
  // que el modal sepa que mostrar y a donde mandar el POST.
  const [doseTarget, setDoseTarget] = useState<{
    healthId:        string;
    medicationIndex: number;
    medication:      TreatmentMedication;
  } | null>(null);
  // Targets de los modales de start / complete. Cada uno guarda el id
  // del HealthRecord sobre el que se acciona + datos auxiliares para
  // pre-llenar el form. Solo uno puede estar abierto a la vez.
  const [startTreatmentTarget, setStartTreatmentTarget] = useState<{
    healthId:         string;
    defaultDiagnosis?: string;
  } | null>(null);
  const [completeTreatmentTarget, setCompleteTreatmentTarget] = useState<{
    healthId:    string;
    medications?: TreatmentMedication[];
  } | null>(null);
  // Targets de los modales de edit/delete. Cada uno guarda el record
  // completo para que el modal pre-llene defaults y muestre resumen.
  const [editRecordTarget, setEditRecordTarget] = useState<HealthRecord | null>(null);
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<HealthRecord | null>(null);
  // Target del modal de upload de lab. Solo el healthId hace falta -
  // el modal no necesita el record entero porque siempre agrega
  // (POST acumula) en lugar de editar.
  const [uploadLabTarget, setUploadLabTarget] = useState<string | null>(null);
  // Target del modal de diagnostico (capa 2). Guarda el record completo
  // para que el modal sepa si pre-llenar campos o no.
  const [diagnosisTarget, setDiagnosisTarget] = useState<HealthRecord | null>(null);

  // Mutacion para "Confirmar diagnostico" (boton inline, sin modal).
  // No necesita confirmacion - es un click idempotente desde la UI
  // (la UI oculta el boton tras confirmar para evitar dobles).
  const confirmMutation = useConfirmDiagnosis({ bovineId });
  async function handleConfirmDiagnosis(healthId: string) {
    try {
      await confirmMutation.mutateAsync({ healthId });
      toast.success(
        'Diagnostico confirmado',
        'Se registro confirmedAt + confirmedBy en el registro.',
      );
    } catch (err) {
      toast.error(
        'No se pudo confirmar',
        (err as any)?.response?.data?.error?.message
          ?? (err as Error)?.message
          ?? 'Intenta nuevamente.',
      );
    }
  }

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
      {/* Summary card - hero del tab de salud. Muestra estado clinico
          actual, caso activo, KPIs operativos y desglose por tipo.
          Es la primera vista que el VET tiene al entrar al tab. */}
      <div className="mb-4">
        <BovineHealthSummaryCard bovineId={bovineId} />
      </div>

      {/* Tendencia de laboratorio - se renderiza ANTES del historial
          como vista "panoramica": el VET ve si el bovino ha tenido
          parametros fuera de rango y si estan mejorando o empeorando,
          antes de entrar al detalle de cada visita. Se autocontrola
          (collapse, empty state, etc.) - aqui solo lo montamos. */}
      <div className="mb-4">
        <BovineLabTrendCard bovineId={bovineId} />
      </div>

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
                canManage={canRecord}
                onEdit={(r) => setEditRecordTarget(r)}
                onDelete={(r) => setDeleteRecordTarget(r)}
                onAddLab={(id) => setUploadLabTarget(id)}
                onRegisterDiagnosis={(r) => setDiagnosisTarget(r)}
                onConfirmDiagnosis={handleConfirmDiagnosis}
                confirmingDiagnosisId={
                  confirmMutation.isPending
                    // El hook no nos dice CUAL fue el ultimo healthId,
                    // asi que pasamos el id del record si la mutacion
                    // esta pending. Como solo puede haber una activa
                    // a la vez en este componente, es razonable.
                    ? (confirmMutation.variables?.healthId ?? record.id)
                    : null
                }
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

      {/* Modal de "Registrar dosis aplicada" - se monta solo si hay
          un medicamento seleccionado como target. El propio modal
          maneja submit, validacion, toasts e invalidacion de caches
          via useRecordMedicationDose(). */}
      {doseTarget && (
        <RecordMedicationDoseModal
          open={!!doseTarget}
          onClose={() => setDoseTarget(null)}
          healthId={doseTarget.healthId}
          medicationIndex={doseTarget.medicationIndex}
          medication={doseTarget.medication}
          bovineId={bovineId}
        />
      )}

      {/* Modal de iniciar tratamiento - solo se monta si hay target. */}
      {startTreatmentTarget && (
        <StartTreatmentModal
          open={!!startTreatmentTarget}
          onClose={() => setStartTreatmentTarget(null)}
          healthId={startTreatmentTarget.healthId}
          bovineId={bovineId}
          defaultDiagnosis={startTreatmentTarget.defaultDiagnosis}
          defaultVet={user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : undefined}
        />
      )}

      {/* Modal de completar tratamiento - solo si hay target. */}
      {completeTreatmentTarget && (
        <CompleteTreatmentModal
          open={!!completeTreatmentTarget}
          onClose={() => setCompleteTreatmentTarget(null)}
          healthId={completeTreatmentTarget.healthId}
          bovineId={bovineId}
          medications={completeTreatmentTarget.medications}
        />
      )}

      {/* Modal de edicion de record - solo si hay target. */}
      {editRecordTarget && (
        <EditHealthRecordModal
          open={!!editRecordTarget}
          onClose={() => setEditRecordTarget(null)}
          record={editRecordTarget}
          bovineId={bovineId}
        />
      )}

      {/* Modal de eliminacion (con confirmacion estricta). */}
      {deleteRecordTarget && (
        <DeleteHealthRecordModal
          open={!!deleteRecordTarget}
          onClose={() => setDeleteRecordTarget(null)}
          record={deleteRecordTarget}
          bovineId={bovineId}
        />
      )}

      {/* Modal de upload de resultados de laboratorio (Capa 4). */}
      {uploadLabTarget && (
        <UploadLabResultsModal
          open={!!uploadLabTarget}
          onClose={() => setUploadLabTarget(null)}
          healthId={uploadLabTarget}
          bovineId={bovineId}
        />
      )}

      {/* Modal de registrar / actualizar diagnostico (Capa 2). */}
      {diagnosisTarget && (
        <RegisterDiagnosisModal
          open={!!diagnosisTarget}
          onClose={() => setDiagnosisTarget(null)}
          record={diagnosisTarget}
          bovineId={bovineId}
        />
      )}
    </>
  );
}
