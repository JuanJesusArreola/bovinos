/**
 * Modal de creacion manual de Eventos.
 *
 * El backend (POST /api/events) setea automaticamente createdBy con
 * el usuario autenticado del token, asi que aqui solo capturamos los
 * campos clinicos/operativos del evento.
 *
 * Campos:
 *   - title (requerido)
 *   - description (opcional, texto libre)
 *   - type (EventType - 13 valores)
 *   - scheduledDate (datetime-local)
 *   - bovineId opcional via BovineSelector filtrado por rancho activo
 *   - priority (LOW/MEDIUM/HIGH/URGENT)
 *   - notes (opcional, texto libre largo)
 *
 * NO incluimos status en el form: el backend lo setea a SCHEDULED por
 * default al crear. Las transiciones de status van por endpoints
 * dedicados (start/complete/cancel/postpone).
 */

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { BovineSelector } from '@/components/ui/BovineSelector';
import { Save } from 'lucide-react';
import { useToast } from '@/store/ToastContext';
import { useAuth } from '@/store/AuthContext';
import { useCreateEvent } from '@/hooks/useEvents';
import { EventType } from '@/types/event.types';
import { getEventLabel } from '@/design-system/tokens/event.colors';

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_OPTIONS = Object.values(EventType).map((t) => ({
  value: t, label: getEventLabel(t),
}));

const PRIORITY_OPTIONS = [
  { value: 'LOW',    label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH',   label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

const schema = z.object({
  title:         z.string().min(1, 'Titulo requerido').max(150),
  description:   z.string().max(2000).optional().or(z.literal('')),
  type:          z.nativeEnum(EventType, { error: 'Selecciona el tipo' }),
  // datetime-local: YYYY-MM-DDTHH:mm
  scheduledDate: z.string().min(1, 'Fecha y hora requeridas'),
  bovineId:      z.string().optional().or(z.literal('')),
  priority:      z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  notes:         z.string().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateEventModal({ open, onClose }: CreateEventModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const { activeRanchId } = useAuth();
  const mutation = useCreateEvent();

  const {
    register, handleSubmit, control, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:         '',
      description:   '',
      type:          EventType.CHECKUP,
      scheduledDate: nowLocal(),
      bovineId:      '',
      priority:      'MEDIUM',
      notes:         '',
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      // datetime-local -> ISO. El new Date() lo interpreta en TZ local del
      // navegador, que es lo deseado (el usuario marca la hora local).
      await mutation.mutateAsync({
        title:         values.title.trim(),
        description:   values.description?.trim() || undefined,
        type:          values.type,
        scheduledDate: new Date(values.scheduledDate).toISOString(),
        bovineId:      values.bovineId?.trim() || undefined,
        priority:      values.priority,
        notes:         values.notes?.trim() || undefined,
        // Mandamos ranchId tambien para que el backend lo asocie al rancho
        // activo; si el backend ya lo deriva del usuario, no estorba.
        ranchId:       activeRanchId ?? undefined,
      });
      toastSuccess('Evento creado', 'Aparecera en el calendario del rancho.');
      reset({
        title:         '',
        description:   '',
        type:          EventType.CHECKUP,
        scheduledDate: nowLocal(),
        bovineId:      '',
        priority:      'MEDIUM',
        notes:         '',
      });
      onClose();
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.error
        ?? (err as Error)?.message
        ?? 'No se pudo crear el evento.';
      toastError('Error al crear', msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Crear evento" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Titulo *"
          placeholder="Ej: Vacunacion masiva del lote norte"
          error={errors.title?.message}
          {...register('title')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Descripcion <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Detalles adicionales del evento..."
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('description')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Tipo *"
            options={TYPE_OPTIONS}
            error={errors.type?.message}
            {...register('type')}
          />
          <Select
            label="Prioridad"
            options={PRIORITY_OPTIONS}
            {...register('priority')}
          />
        </div>

        <Input
          type="datetime-local"
          label="Fecha y hora programada *"
          error={errors.scheduledDate?.message}
          {...register('scheduledDate')}
        />

        <Controller
          control={control}
          name="bovineId"
          render={({ field }) => (
            <BovineSelector
              label="Bovino (opcional)"
              ranchId={activeRanchId}
              value={field.value || null}
              onChange={(id) => field.onChange(id ?? '')}
              error={errors.bovineId?.message}
              clearable
            />
          )}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Notas <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Recordatorios, instrucciones especiales..."
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('notes')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending} icon={<Save className="w-4 h-4" />}>
            Crear evento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
