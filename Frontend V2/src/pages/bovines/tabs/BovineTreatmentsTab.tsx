import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi } from '@/api/health.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { getErrorCode, getFriendlyMessage, ErrorCodes } from '@/utils/errorHandler';
import { formatDate } from '@/utils/formatters';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { TreatmentStatus, type HealthRecord, type TreatmentData } from '@/types/health.types';
import {
  Pill, CheckCircle2, AlertTriangle, Clock, ChevronDown,
  ChevronUp, Calendar, Syringe, FlaskConical, Droplets,
  Package, XCircle, Pause, Activity, DollarSign,
} from 'lucide-react';

// ─── Route badge config ───────────────────────────────────────────────────────

const ROUTE_CONFIG: Record<string, { label: string; classes: string }> = {
  ORAL:           { label: 'Oral',         classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  INJECTABLE:     { label: 'Inyectable',   classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  INTRAMUSCULAR:  { label: 'IM',           classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  INTRAVENOUS:    { label: 'IV',           classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  SUBCUTANEOUS:   { label: 'SC',           classes: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  TOPICAL:        { label: 'Tópico',       classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const TREATMENT_STATUS_CONFIG: Record<TreatmentStatus, { label: string; classes: string; icon: React.ElementType }> = {
  [TreatmentStatus.ACTIVE]:    { label: 'En Curso',   classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Activity },
  [TreatmentStatus.COMPLETED]: { label: 'Completado', classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',                icon: CheckCircle2 },
  [TreatmentStatus.SUSPENDED]: { label: 'Suspendido', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',         icon: Pause },
  [TreatmentStatus.FAILED]:    { label: 'Fallido',    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',                  icon: XCircle },
  [TreatmentStatus.CANCELLED]: { label: 'Cancelado',  classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',                 icon: XCircle },
};

// ─── Date arithmetic ──────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

interface WithdrawalStatus {
  phase: 'treatment' | 'withdrawal' | 'clear';
  daysRemaining: number;
  clearDate: Date;
}

function calcWithdrawal(
  startDate: string,
  durationDays: number,
  withdrawalDays: number,
): WithdrawalStatus {
  const today     = new Date();
  const start     = new Date(startDate);
  const treatEnd  = addDays(startDate, durationDays);
  const clearDate = addDays(treatEnd.toISOString(), withdrawalDays);

  if (today < treatEnd) {
    return { phase: 'treatment', daysRemaining: daysBetween(today, treatEnd), clearDate };
  }
  if (today < clearDate) {
    return { phase: 'withdrawal', daysRemaining: daysBetween(today, clearDate), clearDate };
  }
  return { phase: 'clear', daysRemaining: 0, clearDate };
}

// ─── MedicationCard ───────────────────────────────────────────────────────────

interface MedCardProps {
  med: NonNullable<TreatmentData['medications']>[number];
  startDate?: string;
  isActive: boolean;
}

function MedicationCard({ med, startDate, isActive }: MedCardProps) {
  const routeCfg = ROUTE_CONFIG[med.route] ?? { label: med.route, classes: 'bg-gray-100 text-gray-600' };

  // Duration progress
  let progressPct = 0;
  let daysElapsed = 0;
  if (startDate && isActive) {
    daysElapsed = Math.max(0, daysBetween(new Date(startDate), new Date()));
    progressPct = Math.min(100, (daysElapsed / med.duration) * 100);
  }

  // Withdrawal status
  let withdrawal: WithdrawalStatus | null = null;
  if (med.withdrawalPeriod && med.withdrawalPeriod > 0 && startDate) {
    withdrawal = calcWithdrawal(startDate, med.duration, med.withdrawalPeriod);
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Med header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <Pill className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{med.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {med.dosage} {med.dosageUnit} · {med.frequency}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', routeCfg.classes)}>
            {routeCfg.label}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {med.duration}d
          </span>
        </div>
      </div>

      {/* Duration progress bar */}
      {startDate && isActive && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Progreso del tratamiento</span>
            <span className="font-medium">
              {Math.min(daysElapsed, med.duration)}/{med.duration} días
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                progressPct >= 100 ? 'bg-emerald-500' : 'bg-primary-500',
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {startDate && (
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Inicio: {formatDate(startDate)}</span>
              <span>Fin: {formatDate(addDays(startDate, med.duration).toISOString())}</span>
            </div>
          )}
        </div>
      )}

      {/* Withdrawal warning */}
      {withdrawal && withdrawal.phase !== 'clear' && (
        <div className={cn(
          'mx-3 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border text-sm',
          withdrawal.phase === 'withdrawal'
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
        )}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            {withdrawal.phase === 'withdrawal' ? (
              <>
                <p className="font-semibold">⚠️ Período de retiro activo</p>
                <p className="text-xs mt-0.5">
                  Faltan <strong>{withdrawal.daysRemaining} días</strong> para uso libre.
                  Apto para consumo: <strong>{formatDate(withdrawal.clearDate.toISOString())}</strong>
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-xs">Retiro: {med.withdrawalPeriod} días después del tratamiento</p>
                <p className="text-xs mt-0.5">
                  Libre para consumo: <strong>{formatDate(withdrawal.clearDate.toISOString())}</strong>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Withdrawal clear */}
      {withdrawal && withdrawal.phase === 'clear' && (
        <div className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Período de retiro completado — libre para consumo</span>
        </div>
      )}

      {/* Cost */}
      {med.cost != null && (
        <div className="px-4 pb-3 flex items-center gap-1 text-xs text-gray-400">
          <DollarSign className="w-3 h-3" />
          Costo: ${med.cost.toLocaleString('es-MX')} MXN
        </div>
      )}
    </div>
  );
}

// ─── TreatmentCard ────────────────────────────────────────────────────────────

interface TreatmentCardProps {
  record: HealthRecord;
  onComplete: (treatmentId: string) => void;
  completing: boolean;
  canComplete: boolean;
}

function TreatmentCard({ record, onComplete, completing, canComplete }: TreatmentCardProps) {
  const [confirmComplete, setConfirmComplete] = useState(false);
  const treatment = record.treatment!;
  const statusCfg = TREATMENT_STATUS_CONFIG[treatment.status] ?? TREATMENT_STATUS_CONFIG[TreatmentStatus.ACTIVE];
  const StatusIcon = statusCfg.icon;
  const isActive = treatment.status === TreatmentStatus.ACTIVE;

  const startDate = treatment.startDate || record.recordDate;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      isActive
        ? 'border-primary-200 dark:border-primary-800 shadow-sm shadow-primary-100 dark:shadow-none'
        : 'border-gray-200 dark:border-gray-700',
    )}>
      {/* Card header */}
      <div className={cn(
        'flex items-start justify-between gap-4 p-4',
        isActive ? 'bg-primary-50/50 dark:bg-primary-900/10' : 'bg-gray-50 dark:bg-gray-800/40',
      )}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {/* Status badge */}
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', statusCfg.classes)}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusCfg.label}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </span>
            {/* Emergency */}
            {record.isEmergency && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                Urgente
              </span>
            )}
          </div>

          {/* Treatment plan */}
          {treatment.treatmentPlan && (
            <p className="text-sm font-medium text-gray-900 dark:text-white">{treatment.treatmentPlan}</p>
          )}

          {/* Diagnosis being treated */}
          {record.diagnosis?.primaryDiagnosis && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Motivo: {record.diagnosis.primaryDiagnosis}
            </p>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
            {startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Inicio: {formatDate(startDate)}
              </span>
            )}
            {treatment.endDate && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Fin: {formatDate(treatment.endDate)}
              </span>
            )}
            {record.veterinarianName && (
              <span className="flex items-center gap-1">
                Vet: {record.veterinarianName}
              </span>
            )}
          </div>
        </div>

        {/* Complete button */}
        {isActive && canComplete && (
          <div className="shrink-0">
            {!confirmComplete ? (
              <Button
                size="sm"
                variant="outline"
                icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => setConfirmComplete(true)}
              >
                <span className="hidden sm:inline">Completar</span>
              </Button>
            ) : (
              <div className="flex flex-col items-end gap-1.5">
                <p className="text-xs text-gray-500 text-right">¿Confirmar?</p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmComplete(false)}
                  >
                    No
                  </Button>
                  <Button
                    size="sm"
                    loading={completing}
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    onClick={() => onComplete(treatment.id || record.id)}
                  >
                    Sí
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Medications */}
      {treatment.medications && treatment.medications.length > 0 && (
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5" />
            Medicamentos ({treatment.medications.length})
          </p>
          {treatment.medications.map((med, i) => (
            <MedicationCard
              key={i}
              med={med}
              startDate={startDate}
              isActive={isActive}
            />
          ))}
        </div>
      )}

      {/* Procedures */}
      {treatment.procedures && treatment.procedures.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Procedimientos
          </p>
          <div className="space-y-1.5">
            {treatment.procedures.map((proc, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                <span className="font-medium text-gray-700 dark:text-gray-300">{proc.name}</span>
                {proc.outcome && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded',
                    proc.outcome === 'SUCCESS' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
                    proc.outcome === 'FAILURE'  ? 'text-red-600 bg-red-50 dark:bg-red-900/20' :
                    'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
                  )}>
                    {proc.outcome === 'SUCCESS' ? 'Exitoso' : proc.outcome === 'FAILURE' ? 'Fallido' : 'Parcial'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side effects */}
      {treatment.sideEffects && treatment.sideEffects.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Efectos Secundarios Observados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {treatment.sideEffects.map((s, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Response */}
      {treatment.response && !isActive && (
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-400">
            Respuesta al tratamiento:{' '}
            <span className={cn('font-semibold',
              treatment.response === 'EXCELLENT' || treatment.response === 'GOOD' ? 'text-emerald-600' :
              treatment.response === 'NO_RESPONSE' || treatment.response === 'POOR' ? 'text-red-600' :
              'text-amber-600',
            )}>
              {treatment.response === 'EXCELLENT' ? 'Excelente' :
               treatment.response === 'GOOD'      ? 'Buena' :
               treatment.response === 'FAIR'      ? 'Regular' :
               treatment.response === 'POOR'      ? 'Mala' :
               treatment.response === 'NO_RESPONSE' ? 'Sin respuesta' : treatment.response}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── BovineTreatmentsTab ──────────────────────────────────────────────────────

interface Props {
  bovineId: string;
}

export function BovineTreatmentsTab({ bovineId }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();
  const [showHistory, setShowHistory] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const canComplete = canUser(user?.role, 'COMPLETE_TREATMENT');

  // ── Query: health history (contains treatment data) ─────────────────────────
  const { data: records, isLoading } = useQuery({
    queryKey: ['bovine-health', bovineId],
    queryFn: () => healthApi.getHealthHistory(bovineId).then((r) => r.data.data ?? []),
    enabled: !!bovineId,
  });

  // Split active vs historical
  const allWithTreatments = (records ?? []).filter((r) => r.treatment);
  const active   = allWithTreatments.filter((r) => r.treatment!.status === TreatmentStatus.ACTIVE);
  const inactive = allWithTreatments.filter((r) => r.treatment!.status !== TreatmentStatus.ACTIVE);

  // Sort newest first
  const sortByDate = (arr: HealthRecord[]) =>
    [...arr].sort((a, b) => new Date(b.recordDate ?? b.createdAt).getTime() - new Date(a.recordDate ?? a.createdAt).getTime());

  // ── Mutation: complete treatment ─────────────────────────────────────────────
  const completeMutation = useMutation({
    mutationFn: (treatmentId: string) =>
      healthApi.completeTreatment({ treatmentId }),
    onMutate: (id) => setCompletingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovine-health', bovineId] });
      queryClient.invalidateQueries({ queryKey: ['bovine', bovineId] });
      toast.success('Tratamiento completado', 'El tratamiento fue marcado como completado.');
      setCompletingId(null);
    },
    onError: (err: any) => {
      const code = getErrorCode(err);
      switch (code) {
        case ErrorCodes.TREATMENT_NOT_ACTIVE:
          toast.warning(
            'Tratamiento no activo',
            'Este tratamiento ya no está activo. Recarga la página para ver el estado actualizado.',
          );
          // Refresh so the UI reflects reality
          queryClient.invalidateQueries({ queryKey: ['bovine-health', bovineId] });
          break;
        case ErrorCodes.WITHDRAWAL_PERIOD_ACTIVE:
          toast.warning(
            'Período de retiro activo',
            'El período de retiro del medicamento aún no ha terminado. Espera a que concluya antes de marcar el tratamiento como completado.',
          );
          break;
        default:
          toast.error('Error', getFriendlyMessage(err));
      }
      setCompletingId(null);
    },
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Active treatments ──────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <Pill className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle>Tratamientos Activos</CardTitle>
              {active.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {active.length} tratamiento{active.length !== 1 ? 's' : ''} en curso
                </p>
              )}
            </div>
          </div>
          {active.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {active.length} activo{active.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Pill className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sin tratamientos activos</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Este animal no tiene medicamentos en curso en este momento.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortByDate(active).map((record) => (
              <TreatmentCard
                key={record.id}
                record={record}
                canComplete={canComplete}
                completing={completingId === (record.treatment?.id || record.id)}
                onComplete={(id) => completeMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ── Treatment history ──────────────────────────────────────────────── */}
      {inactive.length > 0 && (
        <Card>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800">
                <Package className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <CardTitle>Tratamientos Anteriores</CardTitle>
              <span className="ml-1 text-sm text-gray-400 font-normal">({inactive.length})</span>
            </div>
            {showHistory
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showHistory && (
            <div className="mt-5 space-y-4">
              {sortByDate(inactive).map((record) => (
                <TreatmentCard
                  key={record.id}
                  record={record}
                  canComplete={false}
                  completing={false}
                  onComplete={() => {}}
                />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
