import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { healthApi } from '@/api/health.api';
import { eventsApi } from '@/api/events.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { formatDate, formatRelative } from '@/utils/formatters';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import {
  HealthRecordType,
  OverallHealthStatus,
  DiagnosisStatus,
  type HealthRecord,
} from '@/types/health.types';
import { EventType, EventStatus, type Event } from '@/types/event.types';
import {
  Syringe, Plus, CheckCircle2, Clock, AlertTriangle,
  Calendar, User, ChevronRight, DollarSign, BookOpen,
  CalendarPlus, ArrowRight, ShieldCheck, ShieldAlert,
  ShieldX, Shield,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── Status / priority configs ────────────────────────────────────────────────

const EVENT_STATUS_CONFIG: Record<string, { label: string; classes: string; icon: React.ElementType }> = {
  PENDING:     { label: 'Pendiente',    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  icon: Clock },
  OVERDUE:     { label: 'Vencida',      classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',          icon: AlertTriangle },
  IN_PROGRESS: { label: 'En Proceso',   classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',      icon: ArrowRight },
  COMPLETED:   { label: 'Completada',   classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  CANCELLED:   { label: 'Cancelada',    classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',          icon: ShieldX },
  POSTPONED:   { label: 'Pospuesta',    classes: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',           icon: CalendarPlus },
};

const PRIORITY_CONFIG: Record<string, { label: string; classes: string }> = {
  LOW:    { label: 'Baja',    classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  MEDIUM: { label: 'Media',   classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  HIGH:   { label: 'Alta',    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  URGENT: { label: 'Urgente', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const VACC_STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; classes: string }> = {
  UP_TO_DATE: { label: 'Al día',         icon: ShieldCheck,  classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  PENDING:    { label: 'Pendiente',       icon: Shield,       classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  OVERDUE:    { label: 'Atrasado',        icon: ShieldAlert,  classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  NONE:       { label: 'Sin vacunas',     icon: ShieldX,      classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const ROUTE_LABELS: Record<string, string> = {
  ORAL: 'Oral', INJECTABLE: 'Inyect.', INTRAMUSCULAR: 'IM',
  INTRAVENOUS: 'IV', SUBCUTANEOUS: 'SC', TOPICAL: 'Tópico',
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const applySchema = z.object({
  vaccineName:   z.string().min(1, 'Nombre requerido').max(200),
  appliedDate:   z.string().min(1, 'Fecha requerida'),
  dosage:        z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().min(0).optional()),
  dosageUnit:    z.string().optional().or(z.literal('')),
  route:         z.string().optional().or(z.literal('')),
  nextDoseDate:  z.string().optional().or(z.literal('')),
  cost:          z.preprocess((v) => (v === '' || v == null) ? undefined : v, z.coerce.number().min(0).optional()),
  notes:         z.string().max(500).optional().or(z.literal('')),
});

const scheduleSchema = z.object({
  vaccineName:    z.string().min(1, 'Nombre requerido').max(200),
  scheduledDate:  z.string().min(1, 'Fecha requerida'),
  priority:       z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  notes:          z.string().max(500).optional().or(z.literal('')),
});

type ApplyValues    = z.infer<typeof applySchema>;
type ScheduleValues = z.infer<typeof scheduleSchema>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, icon: Icon, color }: {
  title: string;
  count: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={cn('flex items-center justify-center w-7 h-7 rounded-lg', color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <CardTitle>{title}</CardTitle>
      {count > 0 && (
        <span className="text-sm text-gray-400 font-normal">({count})</span>
      )}
    </div>
  );
}

// ─── BovineVaccinationsTab ────────────────────────────────────────────────────

interface Props {
  bovineId: string;
  vaccinationStatus?: string;
}

export function BovineVaccinationsTab({ bovineId, vaccinationStatus }: Props) {
  const queryClient = useQueryClient();
  const { user, activeRanchId } = useAuth();
  const toast = useToast();

  const [showApplyModal,    setShowApplyModal]    = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [completingEventId, setCompletingEventId] = useState<string | null>(null);

  const canRecord  = canUser(user?.role, 'RECORD_HEALTH');
  const canManage  = canUser(user?.role, 'MANAGE_BOVINE');

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: healthRecords, isLoading: loadingHealth } = useQuery({
    queryKey: ['bovine-health', bovineId],
    queryFn: () => healthApi.getHealthHistory(bovineId).then((r) => r.data.data ?? []),
    enabled: !!bovineId,
  });

  const { data: bovineEvents, isLoading: loadingEvents } = useQuery({
    queryKey: ['bovine-events', bovineId],
    queryFn: () => eventsApi.getByBovine(bovineId).then((r) => r.data.data ?? []),
    enabled: !!bovineId,
  });

  // Filter applied vaccinations from health history
  const appliedVaccinations: HealthRecord[] = (healthRecords ?? [])
    .filter((r) => r.recordType === HealthRecordType.VACCINATION || r.type === 'VACCINATION')
    .sort((a, b) => new Date(b.recordDate ?? b.createdAt).getTime() - new Date(a.recordDate ?? a.createdAt).getTime());

  // Filter vaccination events (pending + completed)
  const allVaccEvents: Event[] = (bovineEvents ?? []).filter((e) => e.type === EventType.VACCINATION);
  const pendingEvents = allVaccEvents
    .filter((e) => e.status === EventStatus.PENDING || e.status === EventStatus.OVERDUE || e.status === EventStatus.IN_PROGRESS)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  const completedEvents = allVaccEvents
    .filter((e) => e.status === EventStatus.COMPLETED || e.status === EventStatus.CANCELLED || e.status === EventStatus.POSTPONED)
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  const isLoading = loadingHealth || loadingEvents;

  // ── Apply vaccination mutation ────────────────────────────────────────────────

  const applyForm = useForm<ApplyValues>({
    resolver: zodResolver(applySchema) as any,
    defaultValues: { vaccineName: '', appliedDate: todayISO(), dosageUnit: 'ml', route: 'INTRAMUSCULAR' },
  });

  const applyMutation = useMutation({
    mutationFn: (data: ApplyValues) =>
      healthApi.createRecord({
        bovineId,
        recordType:          HealthRecordType.VACCINATION,
        recordDate:          data.appliedDate,
        chiefComplaint:      data.vaccineName,
        overallHealthStatus: OverallHealthStatus.HEALTHY,
        diagnosis:           { status: DiagnosisStatus.CONFIRMED },
        treatment: data.dosage != null ? {
          medications: [{
            name:        data.vaccineName,
            dosage:      data.dosage,
            dosageUnit:  data.dosageUnit || 'ml',
            frequency:   'Dosis única',
            duration:    1,
            route:       (data.route || 'INTRAMUSCULAR') as any,
          }],
          status: 'COMPLETED' as any,
        } : undefined,
        notes:           data.notes || undefined,
        followUpRequired: !!data.nextDoseDate,
        followUpDate:    data.nextDoseDate || undefined,
        cost:            data.cost,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovine-health', bovineId] });
      queryClient.invalidateQueries({ queryKey: ['bovine', bovineId] });
      toast.success('Vacunación registrada', 'El registro de vacunación fue guardado.');
      setShowApplyModal(false);
      applyForm.reset();
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo guardar.');
    },
  });

  // ── Schedule vaccination mutation ─────────────────────────────────────────────

  const scheduleForm = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema) as any,
    defaultValues: { vaccineName: '', scheduledDate: '', priority: 'MEDIUM' },
  });

  const scheduleMutation = useMutation({
    mutationFn: (data: ScheduleValues) =>
      eventsApi.create({
        bovineId,
        type:          EventType.VACCINATION,
        title:         data.vaccineName,
        scheduledDate: data.scheduledDate,
        priority:      data.priority,
        notes:         data.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovine-events', bovineId] });
      toast.success('Vacunación programada', 'El evento fue agendado correctamente.');
      setShowScheduleModal(false);
      scheduleForm.reset();
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo programar.');
    },
  });

  // ── Complete event mutation ────────────────────────────────────────────────────

  const completeMutation = useMutation({
    mutationFn: (eventId: string) => eventsApi.complete(eventId),
    onMutate: (id) => setCompletingEventId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovine-events', bovineId] });
      toast.success('Evento completado', 'La vacunación fue marcada como aplicada.');
      setCompletingEventId(null);
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo completar.');
      setCompletingEventId(null);
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      </Card>
    );
  }

  const vaccStatusCfg = vaccinationStatus ? VACC_STATUS_CONFIG[vaccinationStatus] : null;
  const VaccIcon = vaccStatusCfg?.icon ?? Shield;

  return (
    <div className="space-y-6">

      {/* ── Header: vaccination status + actions ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {vaccStatusCfg && (
          <div className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium', vaccStatusCfg.classes)}>
            <VaccIcon className="w-4 h-4" />
            Estado de vacunación: <strong>{vaccStatusCfg.label}</strong>
          </div>
        )}
        <div className="flex gap-2 sm:ml-auto">
          {canRecord && (
            <Button
              size="sm"
              variant="outline"
              icon={<Syringe className="w-4 h-4" />}
              onClick={() => setShowApplyModal(true)}
            >
              Registrar Aplicada
            </Button>
          )}
          {canManage && (
            <Button
              size="sm"
              icon={<CalendarPlus className="w-4 h-4" />}
              onClick={() => setShowScheduleModal(true)}
            >
              Programar
            </Button>
          )}
        </div>
      </div>

      {/* ── Pending / Upcoming vaccinations ──────────────────────────────── */}
      <Card>
        <SectionHeader
          title="Programadas y Pendientes"
          count={pendingEvents.length}
          icon={Clock}
          color="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
        />

        {pendingEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-300 dark:text-emerald-700" />
            <p className="text-sm text-gray-400">Sin vacunaciones pendientes</p>
            {canManage && (
              <Button size="sm" variant="outline" icon={<CalendarPlus className="w-4 h-4" />} onClick={() => setShowScheduleModal(true)}>
                Programar vacunación
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                  {['Vacuna', 'Fecha Prog.', 'Estado', 'Prioridad', 'Acciones'].map((h) => (
                    <th key={h} className="px-6 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {pendingEvents.map((event) => {
                  const stCfg     = EVENT_STATUS_CONFIG[event.status] ?? EVENT_STATUS_CONFIG['PENDING'];
                  const StatusIcon = stCfg.icon;
                  const prCfg     = event.priority ? PRIORITY_CONFIG[event.priority] : null;
                  const overdue   = event.status === EventStatus.OVERDUE || isOverdue(event.scheduledDate);
                  const daysLeft  = daysUntil(event.scheduledDate);

                  return (
                    <tr key={event.id} className={cn(
                      'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30',
                      overdue && 'bg-red-50/50 dark:bg-red-900/5',
                    )}>
                      {/* Vaccine name */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Syringe className="w-4 h-4 text-gray-400 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{event.title}</p>
                            {event.notes && (
                              <p className="text-xs text-gray-400 truncate max-w-[160px]">{event.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Date */}
                      <td className="px-6 py-3">
                        <p className={cn('font-medium', overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300')}>
                          {formatDate(event.scheduledDate)}
                        </p>
                        <p className={cn('text-xs mt-0.5', overdue ? 'text-red-500' : 'text-gray-400')}>
                          {overdue
                            ? `Vencida hace ${Math.abs(daysLeft)}d`
                            : daysLeft === 0 ? 'Hoy'
                            : daysLeft === 1 ? 'Mañana'
                            : `En ${daysLeft} días`}
                        </p>
                      </td>
                      {/* Status */}
                      <td className="px-6 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', stCfg.classes)}>
                          <StatusIcon className="w-3 h-3" />
                          {stCfg.label}
                        </span>
                      </td>
                      {/* Priority */}
                      <td className="px-6 py-3">
                        {prCfg && (
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', prCfg.classes)}>
                            {prCfg.label}
                          </span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-3">
                        {canRecord && (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            loading={completingEventId === event.id}
                            onClick={() => completeMutation.mutate(event.id)}
                          >
                            Aplicar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Applied vaccinations history ──────────────────────────────────── */}
      <Card>
        <SectionHeader
          title="Historial de Vacunaciones Aplicadas"
          count={appliedVaccinations.length}
          icon={BookOpen}
          color="bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
        />

        {appliedVaccinations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Syringe className="w-10 h-10 text-gray-200 dark:text-gray-700" />
            <p className="text-sm text-gray-400">Sin vacunaciones registradas</p>
            {canRecord && (
              <Button size="sm" variant="outline" icon={<Syringe className="w-4 h-4" />} onClick={() => setShowApplyModal(true)}>
                Registrar vacunación
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                  {['Fecha', 'Vacuna', 'Dosis / Vía', 'Veterinario', 'Próxima Dosis'].map((h) => (
                    <th key={h} className="px-6 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {appliedVaccinations.map((record) => {
                  const med     = record.treatment?.medications?.[0];
                  const nextDose = record.followUpDate;

                  return (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      {/* Date */}
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-700 dark:text-gray-300">
                          {formatDate(record.recordDate || record.createdAt)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatRelative(record.createdAt)}</p>
                      </td>
                      {/* Vaccine name */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Syringe className="w-4 h-4 text-primary-400 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {record.chiefComplaint || med?.name || 'Vacunación'}
                            </p>
                            {record.notes && (
                              <p className="text-xs text-gray-400 truncate max-w-[150px]">{record.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Dosage & route */}
                      <td className="px-6 py-3">
                        {med ? (
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">
                              {med.dosage} {med.dosageUnit}
                            </p>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              {ROUTE_LABELS[med.route] ?? med.route}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* Vet */}
                      <td className="px-6 py-3">
                        {record.veterinarianName ? (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="text-sm">{record.veterinarianName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* Next dose */}
                      <td className="px-6 py-3">
                        {nextDose ? (
                          <div>
                            <p className={cn(
                              'font-medium text-sm',
                              isOverdue(nextDose)
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-700 dark:text-gray-300',
                            )}>
                              {formatDate(nextDose)}
                            </p>
                            {isOverdue(nextDose) && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-red-500 mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Vencida
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Completed vaccination events ──────────────────────────────────── */}
      {completedEvents.length > 0 && (
        <Card>
          <SectionHeader
            title="Eventos Completados / Cancelados"
            count={completedEvents.length}
            icon={CheckCircle2}
            color="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
          />
          <div className="space-y-2">
            {completedEvents.slice(0, 5).map((event) => {
              const stCfg = EVENT_STATUS_CONFIG[event.status] ?? EVENT_STATUS_CONFIG['COMPLETED'];
              const StatusIcon = stCfg.icon;
              return (
                <div key={event.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Syringe className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{event.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(event.scheduledDate)}</p>
                    </div>
                  </div>
                  <span className={cn('shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', stCfg.classes)}>
                    <StatusIcon className="w-3 h-3" />
                    {stCfg.label}
                  </span>
                </div>
              );
            })}
            {completedEvents.length > 5 && (
              <p className="text-xs text-gray-400 pt-1">
                +{completedEvents.length - 5} eventos más
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — REGISTRAR VACUNACIÓN APLICADA
          ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showApplyModal}
        onClose={() => { setShowApplyModal(false); applyForm.reset(); }}
        title="Registrar Vacunación Aplicada"
        size="md"
      >
        <form onSubmit={applyForm.handleSubmit((d) => applyMutation.mutate(d))} className="space-y-4">
          <Input
            label="Nombre de la Vacuna *"
            placeholder="Ej: Fiebre Aftosa, Brucelosis, Triple Bovina..."
            error={applyForm.formState.errors.vaccineName?.message}
            {...applyForm.register('vaccineName')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label="Fecha de Aplicación *"
              error={applyForm.formState.errors.appliedDate?.message}
              {...applyForm.register('appliedDate')}
            />
            <Input
              type="date"
              label="Próxima Dosis"
              {...applyForm.register('nextDoseDate')}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              type="number"
              step="0.1"
              min={0}
              label="Dosis"
              placeholder="5"
              {...applyForm.register('dosage')}
            />
            <Select
              label="Unidad"
              options={[
                { value: 'ml', label: 'ml' },
                { value: 'mg', label: 'mg' },
                { value: 'mcg', label: 'mcg' },
                { value: 'UI', label: 'UI' },
                { value: 'dosis', label: 'dosis' },
              ]}
              {...applyForm.register('dosageUnit')}
            />
            <Select
              label="Vía"
              options={[
                { value: 'INTRAMUSCULAR',  label: 'IM' },
                { value: 'SUBCUTANEOUS',   label: 'SC' },
                { value: 'INTRAVENOUS',    label: 'IV' },
                { value: 'ORAL',           label: 'Oral' },
                { value: 'TOPICAL',        label: 'Tópico' },
              ]}
              {...applyForm.register('route')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="0.01"
              min={0}
              label="Costo (MXN)"
              placeholder="150"
              {...applyForm.register('cost')}
            />
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notas</label>
              <textarea
                rows={2}
                placeholder="Observaciones..."
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-none"
                {...applyForm.register('notes')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowApplyModal(false); applyForm.reset(); }}>
              Cancelar
            </Button>
            <Button type="submit" loading={applyMutation.isPending} icon={<Syringe className="w-4 h-4" />}>
              Guardar Vacunación
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — PROGRAMAR VACUNACIÓN
          ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showScheduleModal}
        onClose={() => { setShowScheduleModal(false); scheduleForm.reset(); }}
        title="Programar Vacunación"
        size="sm"
      >
        <form onSubmit={scheduleForm.handleSubmit((d) => scheduleMutation.mutate(d))} className="space-y-4">
          <Input
            label="Vacuna a Programar *"
            placeholder="Ej: Refuerzo Fiebre Aftosa..."
            error={scheduleForm.formState.errors.vaccineName?.message}
            {...scheduleForm.register('vaccineName')}
          />
          <Input
            type="date"
            label="Fecha Programada *"
            error={scheduleForm.formState.errors.scheduledDate?.message}
            {...scheduleForm.register('scheduledDate')}
          />
          <Select
            label="Prioridad"
            options={[
              { value: 'LOW',    label: 'Baja' },
              { value: 'MEDIUM', label: 'Media' },
              { value: 'HIGH',   label: 'Alta' },
              { value: 'URGENT', label: 'Urgente' },
            ]}
            {...scheduleForm.register('priority')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notas</label>
            <textarea
              rows={2}
              placeholder="Instrucciones adicionales..."
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-none"
              {...scheduleForm.register('notes')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowScheduleModal(false); scheduleForm.reset(); }}>
              Cancelar
            </Button>
            <Button type="submit" loading={scheduleMutation.isPending} icon={<CalendarPlus className="w-4 h-4" />}>
              Programar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
