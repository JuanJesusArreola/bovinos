/**
 * Modal: cerrar un caso clínico con outcome final.
 *
 * Outcomes posibles: RECOVERED, DECEASED, TRANSFERRED, UNKNOWN.
 * El status del caso lo derivará el backend desde el outcome
 * (RECOVERED outcome → RECOVERED status, DECEASED → DECEASED, etc.).
 *
 * Acción irreversible desde la UI — pedimos confirmación explícita
 * mostrando el outcome elegido en el botón submit, y dejamos warning
 * arriba para que el usuario entienda lo que está haciendo.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/store/ToastContext';
import { useCloseBovineCase } from '@/hooks/useBovineCases';
import {
  CaseOutcome, type CloseBovineCaseInput,
} from '@/types/bovineCase.dtos';
import { CASE_OUTCOME_LABELS, getCaseOutcomeLabel } from '@/design-system/tokens/case-status.colors';
import { CheckCircle2 } from 'lucide-react';

interface CloseCaseModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  bovineId: string;
}

const OUTCOME_OPTIONS = Object.values(CaseOutcome).map((o) => ({
  value: o, label: CASE_OUTCOME_LABELS[o],
}));

const schema = z.object({
  outcome:    z.nativeEnum(CaseOutcome, { error: 'Selecciona un resultado' }),
  resolvedAt: z.string().optional().or(z.literal('')),
  notes:      z.string().max(2000).optional().or(z.literal('')),
  // Confirmación explícita exigida solo cuando el outcome es DECEASED,
  // porque eso dispara la baja del animal en todo el sistema (X-05).
  confirmDeceased: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.outcome === CaseOutcome.DECEASED && !data.confirmDeceased) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmDeceased'],
      message: 'Debes confirmar la baja del animal para continuar',
    });
  }
});

type FormValues = z.infer<typeof schema>;

export function CloseCaseModal({ open, onClose, caseId, bovineId }: CloseCaseModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useCloseBovineCase(caseId, bovineId);

  const {
    register, handleSubmit, watch, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      outcome:    CaseOutcome.RECOVERED,
      resolvedAt: new Date().toISOString().slice(0, 10),
      notes:      '',
    },
  });
  const selectedOutcome = watch('outcome');

  async function onSubmit(values: FormValues) {
    try {
      const payload: CloseBovineCaseInput = {
        outcome:    values.outcome,
        resolvedAt: values.resolvedAt ? new Date(values.resolvedAt).toISOString() : undefined,
        notes:      values.notes?.trim() || undefined,
      };
      await mutation.mutateAsync(payload);
      toastSuccess('Caso cerrado', `Resultado: ${getCaseOutcomeLabel(values.outcome)}.`);
      reset();
      onClose();
    } catch (err) {
      toastError('No se pudo cerrar', (err as Error)?.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cerrar caso clínico">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Alert variant="warning">
          Al cerrar el caso ya no podrás añadir síntomas, tratamientos ni
          laboratorios nuevos. Asegúrate de haber registrado toda la información
          clínica antes de continuar.
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Resultado *"
            options={OUTCOME_OPTIONS}
            error={errors.outcome?.message}
            {...register('outcome')}
          />
          <Input
            type="date"
            label="Fecha de resolución"
            error={errors.resolvedAt?.message}
            {...register('resolvedAt')}
          />
        </div>

        {/* Confirmación reforzada para FALLECIDO: además de cerrar el caso,
            el backend da de BAJA al animal en todo el sistema (X-05). */}
        {selectedOutcome === CaseOutcome.DECEASED && (
          <Alert variant="error" title="Esto dará de baja al animal">
            <p>
              Cerrar el caso como <strong>fallecido</strong> registrará la muerte
              del animal y lo dará de baja en todo el sistema (hato, mapas, KPIs).
              Esta acción no se revierte fácilmente.
            </p>
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                {...register('confirmDeceased')}
              />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                Entiendo que el animal será dado de baja por muerte.
              </span>
            </label>
            {errors.confirmDeceased && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.confirmDeceased.message}
              </p>
            )}
          </Alert>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Notas finales
          </label>
          <textarea
            rows={3}
            placeholder="Resumen del caso, evolución, observaciones post-mortem si aplica…"
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('notes')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            // Color del botón comunica gravedad: muerte → rojo, resto → primary.
            variant={selectedOutcome === CaseOutcome.DECEASED ? 'danger' : 'primary'}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Cerrar como {getCaseOutcomeLabel(selectedOutcome).toLowerCase()}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
