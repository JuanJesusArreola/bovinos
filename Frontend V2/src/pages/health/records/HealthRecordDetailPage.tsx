/**
 * Pagina dedicada de detalle de un HealthRecord.
 *
 * Ruta: /health/records/:id
 * Permisos: lectura abierta a todos los roles autenticados; las acciones
 *           (editar, eliminar, diagnostico, lab, tratamiento) usan los
 *           mismos modales que BovineHealthTab y estan gated por
 *           RECORD_HEALTH.
 *
 * Estructura de la pagina:
 *   - Header con tipo + fecha + bovino + status + acciones
 *   - Seccion principal con vitales, sintomas, diagnostico (con accion
 *     de actualizar y confirmar), tratamiento, laboratorio, follow-up,
 *     notas, costo
 *
 * Reutiliza los modales de BovineHealthTab para todas las acciones para
 * evitar duplicar logica.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { PageLoader } from '@/components/ui/Spinner';
import { HealthStatusBadge } from '@/components/ui/HealthStatusBadge';
import { PermissionGuard } from '@/components/ui/PermissionGuard';
import {
  ArrowLeft, ClipboardList, Pill, FlaskConical, Stethoscope, Bell,
  Calendar, User, DollarSign, FileText, Activity, Heart, Scale,
  Thermometer, Pencil, Trash2, CheckCircle2, Play, AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  useHealthRecord, useConfirmDiagnosis,
} from '@/hooks/useBovineHealth';
import {
  HEALTH_RECORD_TYPE_LABELS,
  HEALTH_RECORD_TYPE_BADGE_CLASSES,
} from '@/design-system/tokens/health-record-type.colors';
import { formatDate, formatRelative } from '@/utils/formatters';
import { isTreatmentActive, type TreatmentMedication } from '@/types/health.types';

// Modales reutilizados
import { EditHealthRecordModal } from '@/components/health/EditHealthRecordModal';
import { DeleteHealthRecordModal } from '@/components/health/DeleteHealthRecordModal';
import { RegisterDiagnosisModal } from '@/components/health/RegisterDiagnosisModal';
import { UploadLabResultsModal } from '@/components/health/UploadLabResultsModal';
import { LabResultsSection } from '@/components/health/LabResultsSection';
import { RecordMedicationDoseModal } from '@/components/health/RecordMedicationDoseModal';
import { StartTreatmentModal } from '@/components/health/StartTreatmentModal';
import { CompleteTreatmentModal } from '@/components/health/CompleteTreatmentModal';

export function HealthRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const { data: record, isLoading, isError, error } = useHealthRecord(id);

  // Estado de modales
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [uploadLabOpen, setUploadLabOpen] = useState(false);
  const [startTreatmentOpen, setStartTreatmentOpen] = useState(false);
  const [completeTreatmentOpen, setCompleteTreatmentOpen] = useState(false);
  const [doseTarget, setDoseTarget] = useState<{
    medicationIndex: number;
    medication: TreatmentMedication;
  } | null>(null);

  const confirmMutation = useConfirmDiagnosis({ bovineId: record?.bovineId });

  async function handleConfirmDiagnosis() {
    if (!record) return;
    try {
      await confirmMutation.mutateAsync({ healthId: record.id });
      toast.success('Diagnostico confirmado');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message;
      toast.error('No se pudo confirmar', msg);
    }
  }

  if (isLoading) return <PageLoader />;

  if (isError || !record) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Link
          to="/health/records"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al listado
        </Link>
        <Alert variant="error" title="No se pudo cargar el registro">
          {(error as Error)?.message ?? 'El registro no existe o fue eliminado.'}
        </Alert>
      </div>
    );
  }

  const recordTypeLabel = HEALTH_RECORD_TYPE_LABELS[record.recordType] ?? record.recordType;
  const recordTypeBadge = HEALTH_RECORD_TYPE_BADGE_CLASSES[record.recordType]
    ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  const treatmentActive = isTreatmentActive((record as any).treatment?.status);
  const medications: TreatmentMedication[] =
    (record as any).treatment?.medications ?? [];
  const labResults = (record as any).laboratoryResults ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          to="/health/records"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al listado
        </Link>
        <PermissionGuard action="RECORD_HEALTH">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Pencil className="w-3.5 h-3.5" />}
              onClick={() => setEditOpen(true)}
            >
              Editar
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setDeleteOpen(true)}
            >
              Eliminar
            </Button>
          </div>
        </PermissionGuard>
      </div>

      {/* Header del record */}
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${recordTypeBadge}`}>
                {recordTypeLabel}
              </span>
              <HealthStatusBadge status={record.overallHealthStatus} showIcon size="md" />
              {record.isEmergency && (
                <Badge variant="danger" className="inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  URGENTE
                </Badge>
              )}
              {record.isCompleted && (
                <Badge variant="success">Completado</Badge>
              )}
            </div>

            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {record.chiefComplaint ?? recordTypeLabel}
            </h1>

            <div className="mt-3 flex items-center gap-4 flex-wrap text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(record.recordDate ?? record.createdAt ?? '')}
                <span className="text-xs text-gray-400">
                  ({formatRelative(record.recordDate ?? record.createdAt ?? '')})
                </span>
              </span>
              {record.bovineId && (
                <Link
                  to={`/bovines/${record.bovineId}`}
                  className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <User className="w-3.5 h-3.5" />
                  {record.bovineEarTag ?? `Bovino ${record.bovineId.slice(0, 8)}`}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
              {record.veterinarianName && (
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5" />
                  {record.veterinarianName}
                </span>
              )}
              {record.cost != null && (
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  ${record.cost.toLocaleString('es-MX')}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Vitales */}
      {((record as any).vitalSigns
        || record.temperature != null
        || record.weight != null
        || (record as any).physicalExam) && (
        <Card>
          <CardTitle className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary-600" />
            Signos vitales y examen fisico
          </CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <VitalCell
              icon={<Thermometer className="w-4 h-4" />}
              label="Temperatura"
              value={(record as any).vitalSigns?.temperature ?? record.temperature}
              unit="degC"
            />
            <VitalCell
              icon={<Heart className="w-4 h-4" />}
              label="Frec. cardiaca"
              value={(record as any).vitalSigns?.heartRate}
              unit="bpm"
            />
            <VitalCell
              icon={<Activity className="w-4 h-4" />}
              label="Frec. respiratoria"
              value={(record as any).vitalSigns?.respiratoryRate}
              unit="rpm"
            />
            <VitalCell
              icon={<Scale className="w-4 h-4" />}
              label="Peso"
              value={(record as any).physicalExam?.weight ?? record.weight}
              unit="kg"
            />
            <VitalCell
              icon={<Activity className="w-4 h-4" />}
              label="Condicion corporal"
              value={(record as any).physicalExam?.bodyConditionScore}
              unit="/5"
            />
          </div>
        </Card>
      )}

      {/* Sintomas */}
      {(record as any).symptoms?.primary
        && Array.isArray((record as any).symptoms.primary)
        && (record as any).symptoms.primary.length > 0 && (
        <Card>
          <CardTitle className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-primary-600" />
            Sintomas observados
          </CardTitle>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(record as any).symptoms.primary.map((s: string, i: number) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              >
                {s}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            {(record as any).symptoms.severity && (
              <span>Severidad: <strong>{(record as any).symptoms.severity}</strong></span>
            )}
            {(record as any).symptoms.onset && (
              <span>Inicio: <strong>{(record as any).symptoms.onset}</strong></span>
            )}
            {(record as any).symptoms.duration && (
              <span>Duracion: <strong>{(record as any).symptoms.duration}</strong></span>
            )}
            {(record as any).symptoms.appetiteChange && (
              <span>Apetito: <strong>{(record as any).symptoms.appetiteChange}</strong></span>
            )}
          </div>
        </Card>
      )}

      {/* Diagnostico */}
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 mb-0">
            <ClipboardList className="w-5 h-5 text-primary-600" />
            Diagnostico
            {record.diagnosis?.confirmedAt && (
              <Badge variant="success" className="ml-1 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Confirmado
              </Badge>
            )}
          </CardTitle>
          <PermissionGuard action="RECORD_HEALTH">
            <div className="flex items-center gap-2">
              {record.diagnosis?.primaryDiagnosis && !record.diagnosis?.confirmedAt && (
                <button
                  type="button"
                  onClick={handleConfirmDiagnosis}
                  disabled={confirmMutation.isPending}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDiagnosisOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                {record.diagnosis?.primaryDiagnosis ? 'Actualizar' : 'Registrar diagnostico'}
              </button>
            </div>
          </PermissionGuard>
        </div>

        {record.diagnosis?.primaryDiagnosis ? (
          <div className="space-y-2">
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {record.diagnosis.primaryDiagnosis}
            </p>
            {(record.diagnosis as any).differentialDiagnosis
              && Array.isArray((record.diagnosis as any).differentialDiagnosis)
              && (record.diagnosis as any).differentialDiagnosis.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Diferenciales: </span>
                {(record.diagnosis as any).differentialDiagnosis.join(', ')}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              {record.diagnosis.status && (
                <span>Estado: <strong>{record.diagnosis.status}</strong></span>
              )}
              {record.diagnosis.prognosis && (
                <span>Pronostico: <strong>{record.diagnosis.prognosis}</strong></span>
              )}
              {(record.diagnosis as any).diagnosticMethod && (
                <span>Metodo: <strong>{(record.diagnosis as any).diagnosticMethod}</strong></span>
              )}
              {(record.diagnosis as any).icd10Code && (
                <span>ICD-10: <strong>{(record.diagnosis as any).icd10Code}</strong></span>
              )}
            </div>
            {(record.diagnosis as any).notes && (
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                {(record.diagnosis as any).notes}
              </p>
            )}
            {record.diagnosis.confirmedAt && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Confirmado el {formatDate(record.diagnosis.confirmedAt)}
                {(record.diagnosis as any).confirmedBy
                  && <> por {(record.diagnosis as any).confirmedBy}</>}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            Sin diagnostico registrado para este registro.
          </p>
        )}
      </Card>

      {/* Tratamiento */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <CardTitle className="flex items-center gap-2 mb-0">
            <Pill className="w-5 h-5 text-primary-600" />
            Tratamiento
            {(record as any).treatment?.status && (
              <span
                className={[
                  'ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  treatmentActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                ].join(' ')}
              >
                {(record as any).treatment.status}
              </span>
            )}
          </CardTitle>
          <PermissionGuard action="RECORD_HEALTH">
            {treatmentActive ? (
              <button
                type="button"
                onClick={() => setCompleteTreatmentOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completar tratamiento
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStartTreatmentOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                <Play className="w-3.5 h-3.5" />
                Iniciar tratamiento
              </button>
            )}
          </PermissionGuard>
        </div>

        {(record as any).treatment?.treatmentPlan && (
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            {(record as any).treatment.treatmentPlan}
          </p>
        )}

        {medications.length > 0 ? (
          <ul className="space-y-2">
            {medications.map((med, i) => {
              const dosesGiven = med.administeredAt?.length ?? med.administeredCount ?? 0;
              return (
                <li
                  key={i}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-start justify-between gap-2 flex-wrap"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{med.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {med.dosage ?? `${med.dosageAmount ?? '?'} ${med.dosageUnit ?? ''}`}
                      {' '}&middot;{' '}{med.route ?? (med as any).applicationRoute}
                      {med.frequency && <> &middot; {med.frequency}</>}
                      {med.duration != null && <> &middot; {med.duration} dias</>}
                    </p>
                    {med.withdrawalPeriod != null && (
                      <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5">
                        Periodo de retiro: {med.withdrawalPeriod} dias
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        dosesGiven > 0
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                      ].join(' ')}
                    >
                      {dosesGiven} dosis aplicada{dosesGiven === 1 ? '' : 's'}
                    </span>
                    <PermissionGuard action="RECORD_HEALTH">
                      <button
                        type="button"
                        onClick={() => setDoseTarget({ medicationIndex: i, medication: med })}
                        className="inline-flex items-center gap-1 text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        <Pill className="w-3 h-3" />
                        Registrar dosis
                      </button>
                    </PermissionGuard>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            Sin medicamentos registrados.
          </p>
        )}
      </Card>

      {/* Laboratorio - usa el mismo componente que BovineHealthTab */}
      {(labResults.length > 0 || user) && (
        <Card>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 mb-0">
              <FlaskConical className="w-5 h-5 text-primary-600" />
              Laboratorio
            </CardTitle>
            <PermissionGuard action="RECORD_HEALTH">
              <button
                type="button"
                onClick={() => setUploadLabOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Subir resultados
              </button>
            </PermissionGuard>
          </div>
          {labResults.length > 0 ? (
            <LabResultsSection
              results={labResults}
              onAddMore={() => setUploadLabOpen(true)}
            />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Sin resultados de laboratorio para este registro.
            </p>
          )}
        </Card>
      )}

      {/* Follow-up */}
      {record.followUpRequired && (
        <Card>
          <CardTitle className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-primary-600" />
            Seguimiento
          </CardTitle>
          <div className="space-y-1 text-sm">
            {record.followUpDate && (
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Fecha programada:</strong> {formatDate(record.followUpDate)}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  ({formatRelative(record.followUpDate)})
                </span>
              </p>
            )}
            {record.followUpNotes && (
              <p className="text-gray-600 dark:text-gray-400 italic">{record.followUpNotes}</p>
            )}
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
              Si este record fue marcado con `followUpRequired:true`, el sistema
              auto-genero un evento de tipo HEALTH_CHECK en{' '}
              <Link
                to="/events"
                className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-0.5"
              >
                /events
                <ExternalLink className="w-2.5 h-2.5" />
              </Link>.
            </p>
          </div>
        </Card>
      )}

      {/* Recomendaciones + Notas generales */}
      {(record.recommendations?.length || record.notes) && (
        <Card>
          <CardTitle className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-primary-600" />
            Notas y recomendaciones
          </CardTitle>
          {record.recommendations && record.recommendations.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Recomendaciones
              </p>
              <ul className="space-y-1">
                {record.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {record.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Notas generales
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {record.notes}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Modales reutilizados */}
      {record.bovineId && (
        <>
          <EditHealthRecordModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            record={record}
            bovineId={record.bovineId}
          />
          <DeleteHealthRecordModal
            open={deleteOpen}
            onClose={() => {
              setDeleteOpen(false);
              // Tras eliminar, volver al listado.
              if (!record) navigate('/health/records');
            }}
            record={record}
            bovineId={record.bovineId}
          />
          <RegisterDiagnosisModal
            open={diagnosisOpen}
            onClose={() => setDiagnosisOpen(false)}
            record={record}
            bovineId={record.bovineId}
          />
          <UploadLabResultsModal
            open={uploadLabOpen}
            onClose={() => setUploadLabOpen(false)}
            healthId={record.id}
            bovineId={record.bovineId}
          />
          <StartTreatmentModal
            open={startTreatmentOpen}
            onClose={() => setStartTreatmentOpen(false)}
            healthId={record.id}
            bovineId={record.bovineId}
            defaultDiagnosis={record.diagnosis?.primaryDiagnosis}
            defaultVet={user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : undefined}
          />
          <CompleteTreatmentModal
            open={completeTreatmentOpen}
            onClose={() => setCompleteTreatmentOpen(false)}
            healthId={record.id}
            bovineId={record.bovineId}
            medications={medications}
          />
          {doseTarget && (
            <RecordMedicationDoseModal
              open={!!doseTarget}
              onClose={() => setDoseTarget(null)}
              healthId={record.id}
              medicationIndex={doseTarget.medicationIndex}
              medication={doseTarget.medication}
              bovineId={record.bovineId}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

interface VitalCellProps {
  icon: React.ReactNode;
  label: string;
  value: number | undefined | null;
  unit?: string;
}

function VitalCell({ icon, label, value, unit }: VitalCellProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">
        {icon}
        {label}
      </div>
      {value != null ? (
        <p className="text-base font-semibold text-gray-900 dark:text-white tabular-nums">
          {value}
          {unit && <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-1">{unit}</span>}
        </p>
      ) : (
        <p className="text-base text-gray-400">&mdash;</p>
      )}
    </div>
  );
}
