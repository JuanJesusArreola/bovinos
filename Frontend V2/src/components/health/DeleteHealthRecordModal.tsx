/**
 * Confirmacion para eliminar un HealthRecord (soft delete).
 *
 * El backend hace `record.destroy()` con paranoid: true, asi que el
 * registro queda en BD con `deletedAt = NOW()` pero deja de aparecer en
 * cualquier query normal. NO hay forma desde la UI de restaurarlo: si
 * el usuario se equivoca, requeriria intervencion manual en BD.
 *
 * Por eso esta confirmacion es deliberada:
 *   - Resumen del registro que se va a eliminar (fecha, tipo, estado)
 *     para que el VET pueda verificar que es el correcto.
 *   - Boton "Eliminar" en rojo y separado.
 *   - El boton solo se habilita cuando el usuario escribe la palabra
 *     "ELIMINAR" en mayusculas (anti-click-accidental).
 */

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/store/ToastContext';
import { useDeleteHealthRecord } from '@/hooks/useBovineHealth';
import { formatDate } from '@/utils/formatters';
import type { HealthRecord } from '@/types/health.types';
import { HEALTH_RECORD_TYPE_LABELS } from '@/design-system/tokens/health-record-type.colors';

interface DeleteHealthRecordModalProps {
  open: boolean;
  onClose: () => void;
  record: HealthRecord;
  bovineId: string;
}

const CONFIRM_KEYWORD = 'ELIMINAR';

export function DeleteHealthRecordModal({
  open, onClose, record, bovineId,
}: DeleteHealthRecordModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useDeleteHealthRecord({ bovineId });
  const [confirmInput, setConfirmInput] = useState('');

  // Reset del input al abrir/cerrar para que la palabra no quede
  // memorizada y permita un segundo borrado accidental.
  useEffect(() => {
    if (open) setConfirmInput('');
  }, [open]);

  const canConfirm = confirmInput.trim().toUpperCase() === CONFIRM_KEYWORD;

  async function handleDelete() {
    if (!canConfirm) return;
    try {
      await mutation.mutateAsync(record.id);
      toastSuccess(
        'Registro eliminado',
        'El registro fue archivado correctamente (soft delete).',
      );
      onClose();
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.error?.message
        ?? (err as Error)?.message
        ?? 'No se pudo eliminar. Intenta nuevamente en unos segundos.';
      toastError('Error al eliminar', msg);
    }
  }

  const recordLabel = HEALTH_RECORD_TYPE_LABELS[record.recordType]
    ?? record.recordType;

  return (
    <Modal open={open} onClose={onClose} title="Eliminar registro de salud">
      <div className="space-y-4">
        <Alert variant="error" title="Accion no reversible desde la UI">
          El registro pasara a estado "archivado" (soft delete). Dejara de
          aparecer en historial, estadisticas y reportes. Restaurarlo
          requiere intervencion manual del administrador de BD.
        </Alert>

        {/* Resumen del registro a eliminar - el VET verifica antes de borrar. */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>Estas a punto de eliminar:</span>
          </div>
          <p className="text-gray-700 dark:text-gray-300">
            <strong>{recordLabel}</strong>
            {' del '}
            <strong>{formatDate(record.recordDate ?? (record as any).createdAt ?? '')}</strong>
          </p>
          {record.chiefComplaint && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Motivo: <em>{record.chiefComplaint}</em>
            </p>
          )}
          {record.diagnosis?.primaryDiagnosis && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Diagnostico: <em>{record.diagnosis.primaryDiagnosis}</em>
            </p>
          )}
          {record.overallHealthStatus && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Estado: <em>{record.overallHealthStatus}</em>
            </p>
          )}
        </div>

        {/* Anti-click-accidental: requiere tipear la palabra exacta. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Para confirmar, escribe <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 text-xs">ELIMINAR</code>
          </label>
          <Input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="ELIMINAR"
            autoComplete="off"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!canConfirm}
            loading={mutation.isPending}
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDelete}
          >
            Eliminar registro
          </Button>
        </div>
      </div>
    </Modal>
  );
}
