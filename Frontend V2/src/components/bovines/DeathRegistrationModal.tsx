/**
 * DeathRegistrationModal — captura el registro de muerte de un bovino.
 *
 * Backend Modulo 8 / F-26. Pega contra `POST /api/bovines/:id/decease`
 * (atomico: BovineDeath + healthStatus=DECEASED + cierra estancia + cierra
 * caso clinico activo si cause=DISEASE + elimina snapshot del mapa).
 *
 * UX:
 *   - Confirmacion enérgica al inicio (la accion es irreversible desde UI).
 *   - Causa requerida (select con labels en espanol).
 *   - Fecha requerida (default = hoy; max = hoy).
 *   - `weightAtDeath` opcional pero recomendado para reportes.
 *   - `slaughterValue` solo visible cuando cause=SLAUGHTER.
 *   - Necropsia: toggle + textarea condicional con los hallazgos.
 *   - Notas libres.
 *   - Manejo especifico de 409 ALREADY_DECEASED / 400 MISSING_DEATH_CAUSE /
 *     400 INVALID_DEATH_DATE.
 */

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LocationSelector } from '@/components/ui/LocationSelector';
import { useToast } from '@/store/ToastContext';
import { useDeceaseBovine } from '@/hooks/useBovines';
import { getErrorCode, getFriendlyMessage } from '@/utils/errorHandler';
import { Skull, AlertTriangle } from 'lucide-react';
import type { DeathCause, DeceaseBovineInput } from '@/types/bovine.dtos';
// F-35 / Hallazgo H-6: catalogo de causas centralizado en design-system.
// Antes estaba duplicado aqui y en `death.labels.ts` del backend — si el
// backend agregaba un valor al enum, esta lista quedaba stale. Ahora el
// FE y el BE referencian el mismo set (el BE via constants/death.labels.ts;
// el FE via design-system/tokens/death-cause.labels.ts).
import { DEATH_CAUSE_OPTIONS } from '@/design-system/tokens';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DeathRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  bovineId: string;
  bovineEarTag: string;
  bovineName?: string | null;
  /** Rancho actual para alimentar el LocationSelector. */
  ranchId?: string | null;
  /** Caso clinico activo si el bovino tiene uno. Si cause=DISEASE, se
   *  preselecciona este id. */
  activeCaseId?: string | null;
  /** Ubicacion actual del bovino — se preselecciona como locationId. */
  currentLocationId?: string | null;
  /** Callback opcional al exito (toast ya se maneja internamente). */
  onSuccess?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DeathRegistrationModal({
  open, onClose,
  bovineId, bovineEarTag, bovineName,
  ranchId, activeCaseId, currentLocationId,
  onSuccess,
}: DeathRegistrationModalProps) {
  const toast = useToast();
  const deceaseMutation = useDeceaseBovine(bovineId);

  // Estado del form. NO uso RHF: el form es chico (8 campos), tiene
  // condicionales y queremos sincronizar `slaughterValue`/`necropsyResults`
  // segun toggles. RHF aqui solo agrega ceremonia sin ganancia.
  const [cause,             setCause]             = useState<DeathCause | ''>('');
  const [deathDate,         setDeathDate]         = useState<string>(todayISO());
  const [weightAtDeath,     setWeightAtDeath]     = useState<string>('');
  const [slaughterValue,    setSlaughterValue]    = useState<string>('');
  const [necropsyPerformed, setNecropsyPerformed] = useState<boolean>(false);
  const [necropsyResults,   setNecropsyResults]   = useState<string>('');
  const [notes,             setNotes]             = useState<string>('');
  const [locationId,        setLocationId]        = useState<string | null>(currentLocationId ?? null);
  const [confirmAck,        setConfirmAck]        = useState<boolean>(false);
  const [error,             setError]             = useState<string | null>(null);

  function resetForm() {
    setCause('');
    setDeathDate(todayISO());
    setWeightAtDeath('');
    setSlaughterValue('');
    setNecropsyPerformed(false);
    setNecropsyResults('');
    setNotes('');
    setLocationId(currentLocationId ?? null);
    setConfirmAck(false);
    setError(null);
    deceaseMutation.reset();
  }

  function handleClose() {
    if (deceaseMutation.isPending) return;
    resetForm();
    onClose();
  }

  function handleSubmit() {
    setError(null);
    if (!cause) {
      setError('Selecciona la causa de muerte.');
      return;
    }
    if (!deathDate) {
      setError('Captura la fecha de muerte.');
      return;
    }
    if (!confirmAck) {
      setError('Confirma que entiendes que la acción es irreversible.');
      return;
    }

    const payload: DeceaseBovineInput = {
      cause: cause as DeathCause,
      deathDate,
      weightAtDeath:     weightAtDeath ? Number(weightAtDeath) : undefined,
      // slaughterValue solo aplica si cause=SLAUGHTER. El backend lo ignora
      // si llega con otra causa, pero no lo enviamos para mantener el body
      // limpio.
      slaughterValue:    cause === 'SLAUGHTER' && slaughterValue
                            ? Number(slaughterValue)
                            : undefined,
      necropsyPerformed,
      necropsyResults:   necropsyPerformed ? (necropsyResults.trim() || undefined) : undefined,
      notes:             notes.trim() || undefined,
      diseaseCaseId:     cause === 'DISEASE' && activeCaseId ? activeCaseId : undefined,
      locationId:        locationId ?? undefined,
    };

    deceaseMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(
          'Bovino registrado como fallecido',
          `Se cerró la ubicación, el snapshot y, si aplicaba, el caso clínico activo.`,
        );
        resetForm();
        onClose();
        onSuccess?.();
      },
      onError: (err: unknown) => {
        const code = getErrorCode(err);
        switch (code) {
          case 'ALREADY_DECEASED':
            setError('Este bovino ya fue registrado como fallecido. Recarga la página.');
            break;
          case 'MISSING_DEATH_CAUSE':
            setError('Selecciona la causa de muerte.');
            break;
          case 'INVALID_DEATH_DATE':
            setError(
              'La fecha de muerte no es válida: no puede ser futura ni anterior a la fecha de nacimiento del bovino.',
            );
            break;
          default:
            setError(getFriendlyMessage(err) || 'No se pudo registrar la muerte.');
        }
      },
    });
  }

  const displayName = bovineName?.trim() || bovineEarTag;
  const showSlaughterField = cause === 'SLAUGHTER';
  const showDiseaseHint = cause === 'DISEASE' && activeCaseId;

  return (
    <Modal open={open} onClose={handleClose} title="Registrar muerte" size="lg">
      <div className="space-y-4">
        {/* Confirmación enérgica */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <Skull className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">
            <p className="font-semibold">
              Vas a registrar la muerte de <span className="font-mono">[{bovineEarTag}]</span>
              {bovineName && <> · {bovineName}</>}
            </p>
            <p className="mt-1 text-xs">
              Esta acción es <strong>irreversible desde la UI</strong>. El bovino quedará
              marcado como fallecido, desaparecerá del mapa y del listado activo, su
              estancia actual se cerrará y cualquier caso clínico activo será cerrado
              con desenlace DECEASED. La acción queda auditada en el backend.
            </p>
          </div>
        </div>

        {/* Cause + date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Causa <span className="text-red-500">*</span>
            </label>
            <Select
              options={[{ value: '', label: 'Selecciona...' }, ...DEATH_CAUSE_OPTIONS.map((c) => ({ value: c.value, label: c.label }))]}
              value={cause}
              onChange={(e) => setCause(e.target.value as DeathCause | '')}
            />
            {cause && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {DEATH_CAUSE_OPTIONS.find((c) => c.value === cause)?.hint ?? ''}
              </p>
            )}
          </div>
          <Input
            label="Fecha de muerte *"
            type="date"
            max={todayISO()}
            value={deathDate}
            onChange={(e) => setDeathDate(e.target.value)}
          />
        </div>

        {/* Hint para DISEASE con caso activo */}
        {showDiseaseHint && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              El bovino tiene un caso clínico activo. Será cerrado automáticamente
              con desenlace DECEASED como parte de esta operación.
            </span>
          </div>
        )}

        {/* Peso + sacrificio condicional */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Peso al momento de la muerte (kg)"
            type="number"
            step="0.1"
            min={0}
            max={2000}
            placeholder="Opcional"
            value={weightAtDeath}
            onChange={(e) => setWeightAtDeath(e.target.value)}
          />
          {showSlaughterField && (
            <Input
              label="Valor del sacrificio (MXN)"
              type="number"
              step="0.01"
              min={0}
              placeholder="Precio de venta total"
              value={slaughterValue}
              onChange={(e) => setSlaughterValue(e.target.value)}
            />
          )}
        </div>

        {/* Ubicación donde ocurrió */}
        {ranchId && (
          <LocationSelector
            label="Ubicación donde ocurrió"
            value={locationId}
            onChange={(id) => setLocationId(id)}
            ranchId={ranchId}
            placeholder="Default: ubicación actual del bovino"
          />
        )}

        {/* Necropsia */}
        <div className="space-y-2">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={necropsyPerformed}
              onChange={(e) => setNecropsyPerformed(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              ¿Se realizó necropsia?
            </span>
          </label>
          {necropsyPerformed && (
            <textarea
              value={necropsyResults}
              onChange={(e) => setNecropsyResults(e.target.value)}
              rows={3}
              placeholder="Hallazgos macroscópicos, órganos afectados, conclusiones del veterinario..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          )}
        </div>

        {/* Notas libres */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notas adicionales
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Detalles del evento, circunstancias, etc."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
        </div>

        {/* Confirmación checkbox + error */}
        <label className="inline-flex items-start gap-2 cursor-pointer p-2.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <input
            type="checkbox"
            checked={confirmAck}
            onChange={(e) => setConfirmAck(e.target.checked)}
            className="mt-0.5 rounded border-amber-400 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            Confirmo que esta acción es <strong>irreversible</strong> y que los datos
            capturados son correctos. Quedará registrada bajo mi usuario.
          </span>
        </label>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={deceaseMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            icon={<Skull className="w-4 h-4" />}
            loading={deceaseMutation.isPending}
            disabled={!confirmAck || !cause || !deathDate}
            onClick={handleSubmit}
          >
            Registrar muerte de {displayName}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
