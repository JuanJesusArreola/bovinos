/**
 * Modal de captura de resultados de laboratorio para UN HealthRecord.
 *
 * Soporta N parametros por upload (hemograma, quimica, etc.). El backend
 * calcula interpretacion (NORMAL/ABNORMAL/CRITICAL) per parametro
 * comparando `value` contra `referenceRange`. Despues del POST, la UI
 * refresca el historial del bovino y los chips de interpretacion
 * aparecen en la seccion de laboratorio del record.
 *
 * Diseno del form:
 *   - Datos comunes arriba: testName + labName + testedAt - se
 *     auto-propagan a todas las filas en submit para no obligar al
 *     usuario a repetirlos por cada parametro (caso comun: un solo
 *     panel = un solo testName y labName).
 *   - Tabla de filas para parametros. Cada fila: parametro / valor /
 *     unidad / rango. + boton para eliminar fila si hay mas de 1.
 *   - Boton "Anadir parametro" al final.
 *
 * Lo que NO hacemos aqui:
 *   - Auto-completar parametros desde un catalogo (Hematocrito,
 *     Hemoglobina, etc.). El backend no expone catalogo de parametros
 *     todavia; cuando lo haga, anadimos un combobox.
 *   - Subir archivos PDF del lab. Soporta solo captura digital por ahora.
 */

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Plus, Trash2, FlaskConical, Save } from 'lucide-react';
import { useToast } from '@/store/ToastContext';
import { useUploadLabResults } from '@/hooks/useBovineHealth';
import type { UploadLabResultsInput } from '@/types/health.types';

interface UploadLabResultsModalProps {
  open: boolean;
  onClose: () => void;
  healthId: string;
  bovineId?: string;
}

const resultRowSchema = z.object({
  parameter: z.string().min(1, 'Requerido').max(150),
  // `value` puede ser numerico o texto cualitativo. La conversion la
  // hace el submit: si parsea a numero, va como numero; si no, como
  // string. El backend acepta ambos.
  value:          z.string().min(1, 'Requerido').max(50),
  unit:           z.string().max(20).optional().or(z.literal('')),
  referenceRange: z.string().max(50).optional().or(z.literal('')),
});

const schema = z.object({
  testName: z.string().max(150).optional().or(z.literal('')),
  labName:  z.string().max(150).optional().or(z.literal('')),
  testedAt: z.string().optional().or(z.literal('')),
  results:  z.array(resultRowSchema).min(1, 'Anade al menos un parametro'),
});

type FormValues = z.infer<typeof schema>;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parsea el campo `value`: si la cadena se puede convertir a numero
 * finito sin perder informacion, devuelve numero. Si no, string.
 * Esto deja el JSONB del backend con el tipo correcto para que su
 * interpretacion automatica funcione (la comparacion contra
 * `referenceRange` requiere number).
 */
function parseValue(raw: string): number | string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  // Reemplazamos coma decimal por punto (usuarios mexicanos a veces
  // tipean "18,5" en lugar de "18.5").
  const normalized = trimmed.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(normalized) ? n : trimmed;
}

export function UploadLabResultsModal({
  open, onClose, healthId, bovineId,
}: UploadLabResultsModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useUploadLabResults({ bovineId });

  const {
    register, handleSubmit, control, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      testName: 'Hemograma completo',
      labName:  '',
      testedAt: todayDate(),
      results:  [
        { parameter: '', value: '', unit: '', referenceRange: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'results',
  });

  async function onSubmit(values: FormValues) {
    try {
      // Construimos el payload aplanando los datos comunes a cada fila.
      // Asi el backend recibe un array auto-contenido sin necesitar
      // saber "estos N parametros vienen del mismo test".
      const testedAtIso = values.testedAt
        ? new Date(values.testedAt).toISOString()
        : undefined;
      const payload: UploadLabResultsInput = {
        healthId,
        results: values.results.map((r) => ({
          parameter:      r.parameter.trim(),
          value:          parseValue(r.value),
          unit:           r.unit?.trim() || undefined,
          referenceRange: r.referenceRange?.trim() || undefined,
          testName:       values.testName?.trim() || undefined,
          labName:        values.labName?.trim() || undefined,
          testedAt:       testedAtIso,
        })),
      };
      await mutation.mutateAsync(payload);
      toastSuccess(
        'Resultados guardados',
        `${values.results.length} ${values.results.length === 1 ? 'parametro' : 'parametros'} con interpretacion automatica.`,
      );
      reset();
      onClose();
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.error?.message
        ?? (err as Error)?.message
        ?? 'Verifica los datos e intenta nuevamente.';
      toastError('No se pudieron guardar los resultados', msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Subir resultados de laboratorio" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Alert variant="info">
          La interpretacion (Normal / Anormal / Critico) la calcula el
          backend automaticamente comparando el valor con el rango. Formatos
          validos de rango:{' '}
          <code className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-[11px]">24-46</code>,{' '}
          <code className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-[11px]">{'>'}0.5</code>,{' '}
          <code className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-[11px]">{'<='}100</code>.
        </Alert>

        {/* Datos comunes del test */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Test"
            placeholder="Hemograma completo"
            error={errors.testName?.message}
            {...register('testName')}
          />
          <Input
            label="Laboratorio"
            placeholder="Lab. Veterinario del Norte"
            error={errors.labName?.message}
            {...register('labName')}
          />
          <Input
            type="date"
            label="Fecha del muestreo"
            error={errors.testedAt?.message}
            {...register('testedAt')}
          />
        </div>

        {/* Filas de parametros */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary-600" />
              Parametros ({fields.length})
            </h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => append({
                parameter: '', value: '', unit: '', referenceRange: '',
              })}
            >
              Anadir parametro
            </Button>
          </div>

          {fields.map((f, idx) => (
            <div
              key={f.id}
              className="grid grid-cols-12 gap-2 items-end rounded-lg border border-gray-200 dark:border-gray-700 p-2"
            >
              <div className="col-span-12 sm:col-span-4">
                <Input
                  label={idx === 0 ? 'Parametro' : undefined}
                  placeholder="Hematocrito"
                  error={errors.results?.[idx]?.parameter?.message}
                  {...register(`results.${idx}.parameter`)}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input
                  label={idx === 0 ? 'Valor' : undefined}
                  placeholder="18.5"
                  error={errors.results?.[idx]?.value?.message}
                  {...register(`results.${idx}.value`)}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input
                  label={idx === 0 ? 'Unidad' : undefined}
                  placeholder="%"
                  {...register(`results.${idx}.unit`)}
                />
              </div>
              <div className="col-span-3 sm:col-span-3">
                <Input
                  label={idx === 0 ? 'Rango ref.' : undefined}
                  placeholder="24-46"
                  {...register(`results.${idx}.referenceRange`)}
                />
              </div>
              <div className="col-span-1 sm:col-span-1 flex justify-end">
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="p-2 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                    title="Eliminar parametro"
                    aria-label="Eliminar parametro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {errors.results && typeof errors.results.message === 'string' && (
            <p className="text-xs text-red-500">{errors.results.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            icon={<Save className="w-4 h-4" />}
          >
            Guardar resultados
          </Button>
        </div>
      </form>
    </Modal>
  );
}
