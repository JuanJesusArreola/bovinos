/**
 * Modal de edicion de un HealthRecord existente.
 *
 * Decision de diseno: este modal NO permite cambiar absolutamente todo.
 * Solo expone los campos que se modifican con mas frecuencia tras la
 * captura inicial:
 *   - Estado clinico general (overallHealthStatus)
 *   - Enfermedad del catalogo (diseaseId, opt-in)
 *   - Diagnostico primario (texto libre dentro del JSONB diagnosis)
 *   - Plan de tratamiento (texto libre dentro del JSONB treatment)
 *   - Seguimiento (followUp* trio)
 *   - Notas generales y costo
 *
 * Los campos NO editables aqui:
 *   - bovineId / recordType / recordDate / createdBy: prohibidos por el
 *     backend (devuelve 400 si se mandan). El backend protege la
 *     identidad inmutable del record.
 *   - Vitales / sintomas / fisico-exam: son SNAPSHOT del momento de la
 *     visita. Editarlos despues distorsiona la trazabilidad clinica.
 *     Si se capturaron mal, lo correcto es eliminar y recrear.
 *   - Medications / labResults: tienen su propio flow (Treatment start,
 *     dose record, lab results).
 *
 * Para "deshacer" un campo libre, el usuario envia cadena vacia. Lo
 * convertimos a `null` en el payload (el backend tiene comportamiento
 * distinto entre undefined y null para diseaseId — null desvincula).
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Save } from 'lucide-react';
import { useToast } from '@/store/ToastContext';
import { useUpdateHealthRecord } from '@/hooks/useBovineHealth';
import { useActiveDiseases } from '@/hooks/useDiseases';
import {
  OverallHealthStatus,
  type HealthRecord,
  type UpdateHealthRecordInput,
} from '@/types/health.types';

interface EditHealthRecordModalProps {
  open: boolean;
  onClose: () => void;
  record: HealthRecord;
  bovineId: string;
}

const HEALTH_STATUS_OPTIONS = [
  { value: OverallHealthStatus.HEALTHY,    label: 'Saludable' },
  { value: OverallHealthStatus.SICK,       label: 'Enfermo' },
  { value: OverallHealthStatus.RECOVERING, label: 'En recuperacion' },
  { value: OverallHealthStatus.QUARANTINE, label: 'Cuarentena' },
  { value: OverallHealthStatus.DECEASED,   label: 'Fallecido' },
  { value: OverallHealthStatus.UNKNOWN,    label: 'Desconocido' },
];

const schema = z.object({
  overallHealthStatus: z.nativeEnum(OverallHealthStatus),
  diseaseId:           z.string().optional().or(z.literal('')),
  primaryDiagnosis:    z.string().max(500).optional().or(z.literal('')),
  treatmentPlan:       z.string().max(2000).optional().or(z.literal('')),
  followUpRequired:    z.boolean(),
  followUpDate:        z.string().optional().or(z.literal('')),
  followUpNotes:       z.string().max(500).optional().or(z.literal('')),
  notes:               z.string().max(2000).optional().or(z.literal('')),
  cost: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().min(0).optional(),
  ),
  isEmergency: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function EditHealthRecordModal({
  open, onClose, record, bovineId,
}: EditHealthRecordModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useUpdateHealthRecord({ bovineId });
  // Solo necesitamos el catalogo cuando el modal esta abierto.
  const { data: diseases = [] } = useActiveDiseases({ enabled: open });

  // Convertimos a string seguro para el date input (YYYY-MM-DD).
  const followUpInitial = record.followUpDate
    ? new Date(record.followUpDate).toISOString().slice(0, 10)
    : '';

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      overallHealthStatus: (record.overallHealthStatus as OverallHealthStatus)
        ?? OverallHealthStatus.UNKNOWN,
      diseaseId:           (record as any).diseaseId ?? '',
      primaryDiagnosis:    record.diagnosis?.primaryDiagnosis ?? '',
      treatmentPlan:       (record as any).treatment?.treatmentPlan ?? '',
      followUpRequired:    !!record.followUpRequired,
      followUpDate:        followUpInitial,
      followUpNotes:       record.followUpNotes ?? '',
      notes:               (record as any).notes ?? '',
      cost:                record.cost ?? undefined,
      isEmergency:         !!record.isEmergency,
    },
  });

  // Cuando cambia el record (caller abre el modal sobre uno distinto),
  // re-llenamos los defaults. Si no se hace, react-hook-form mantiene
  // los valores del record anterior.
  useEffect(() => {
    if (open) {
      reset({
        overallHealthStatus: (record.overallHealthStatus as OverallHealthStatus)
          ?? OverallHealthStatus.UNKNOWN,
        diseaseId:           (record as any).diseaseId ?? '',
        primaryDiagnosis:    record.diagnosis?.primaryDiagnosis ?? '',
        treatmentPlan:       (record as any).treatment?.treatmentPlan ?? '',
        followUpRequired:    !!record.followUpRequired,
        followUpDate:        followUpInitial,
        followUpNotes:       record.followUpNotes ?? '',
        notes:               (record as any).notes ?? '',
        cost:                record.cost ?? undefined,
        isEmergency:         !!record.isEmergency,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record.id]);

  const watchFollowUp = watch('followUpRequired');

  async function onSubmit(values: FormValues) {
    try {
      // Construimos el payload manteniendo la semantica del backend:
      // - diseaseId vacio -> null explicito (desvincular).
      // - diagnosis y treatment son JSONB; enviamos los subcampos que
      //   editamos sin tocar el resto del objeto (el backend hace merge).
      const payload: UpdateHealthRecordInput = {
        overallHealthStatus: values.overallHealthStatus,
        diseaseId: values.diseaseId === '' ? null : values.diseaseId,
        diagnosis: values.primaryDiagnosis
          ? { primaryDiagnosis: values.primaryDiagnosis.trim() }
          : undefined,
        treatment: values.treatmentPlan
          ? { treatmentPlan: values.treatmentPlan.trim() }
          : undefined,
        followUpRequired: values.followUpRequired,
        followUpDate: values.followUpRequired
          ? (values.followUpDate
              ? new Date(values.followUpDate).toISOString()
              : null)
          : null,
        followUpNotes: values.followUpRequired
          ? (values.followUpNotes?.trim() || null)
          : null,
        notes: values.notes?.trim() || null,
        cost: values.cost ?? null,
        isEmergency: values.isEmergency,
      };
      await mutation.mutateAsync({ id: record.id, data: payload });
      toastSuccess('Registro actualizado', 'Los cambios se guardaron correctamente.');
      onClose();
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.error?.message
        ?? (err as Error)?.message
        ?? 'No se pudo guardar. Verifica que el registro siga existiendo.';
      toastError('Error al actualizar', msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar registro de salud" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Alert variant="info">
          Solo se pueden editar campos clinicos generales. La fecha del
          registro, el tipo y el bovino son inmutables. Si necesitas
          corregir alguno de esos, elimina este registro y crea uno nuevo.
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Estado general de salud *"
            options={HEALTH_STATUS_OPTIONS}
            error={errors.overallHealthStatus?.message}
            {...register('overallHealthStatus')}
          />
          <Select
            label="Enfermedad del catalogo"
            options={[
              { value: '', label: 'Sin vincular' },
              ...diseases.map((d) => ({ value: d.id, label: d.name })),
            ]}
            {...register('diseaseId')}
          />
        </div>

        <Input
          label="Diagnostico primario"
          placeholder="Anaplasmosis bovina"
          error={errors.primaryDiagnosis?.message}
          {...register('primaryDiagnosis')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Plan de tratamiento
          </label>
          <textarea
            rows={2}
            placeholder="Descripcion del plan terapeutico..."
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('treatmentPlan')}
          />
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
              {...register('followUpRequired')}
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Requiere seguimiento
            </span>
          </label>
          {watchFollowUp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="date"
                label="Fecha de seguimiento"
                error={errors.followUpDate?.message}
                {...register('followUpDate')}
              />
              <Input
                label="Notas de seguimiento"
                placeholder="Verificar respuesta al tratamiento"
                error={errors.followUpNotes?.message}
                {...register('followUpNotes')}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="number"
            step="0.01"
            min={0}
            label="Costo (opcional)"
            placeholder="450.00"
            error={errors.cost?.message}
            {...register('cost')}
          />
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer pb-2.5">
              <input
                type="checkbox"
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                {...register('isEmergency')}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Marcar como emergencia
              </span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Notas generales
          </label>
          <textarea
            rows={2}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('notes')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={!isDirty}
            icon={<Save className="w-4 h-4" />}
          >
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
