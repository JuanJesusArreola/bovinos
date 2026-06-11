/**
 * ManualContactModal — captura manual de contacto epidemiológico.
 *
 * F-37 / Backend E-07. Consume `POST /api/epidemiology/contacts`.
 *
 * Casos de uso (contactos que el motor automático NO detecta):
 *   - Bovinos que compartieron transporte (ej. compra/venta en feria).
 *   - Contacto en exhibición ganadera.
 *   - Contacto nariz-nariz a través de cerca con vecino infectado.
 *   - Bebedero/saladero compartido entre ranchos.
 *
 * Tipos permitidos por el backend (E-07):
 *   - DIRECT_CONTACT  — contacto físico directo
 *   - SHARED_WATER    — agua compartida (bebedero, río)
 *   - SHARED_PASTURE  — pastura compartida (pasto fronterizo)
 *
 * SAME_LOCATION / AUTO_DETECTED están RESERVADOS para el motor automático
 * (detectPotentialContacts) y NO se permiten desde este form.
 */

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { BovineSelector } from '@/components/ui/BovineSelector';
import { useToast } from '@/store/ToastContext';
import { useCreateManualContact } from '@/hooks/useEpidemiology';
import { getFriendlyMessage } from '@/utils/errorHandler';
import { Network, Users } from 'lucide-react';
import type {
  CreateManualContactInput,
  ContactType,
} from '@/types/epidemiology.dtos';

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// Solo los 3 tipos validos para captura MANUAL.
type ManualContactType = Extract<ContactType, 'DIRECT_CONTACT' | 'SHARED_WATER' | 'SHARED_PASTURE'>;

const CONTACT_TYPE_OPTIONS: { value: ManualContactType; label: string; hint: string }[] = [
  {
    value: 'DIRECT_CONTACT',
    label: 'Contacto directo',
    hint: 'Nariz-nariz, lamido, mordedura, monta. Mayor probabilidad de contagio.',
  },
  {
    value: 'SHARED_WATER',
    label: 'Agua compartida',
    hint: 'Bebedero, río o estanque común. Vía oral / aerosoles.',
  },
  {
    value: 'SHARED_PASTURE',
    label: 'Pastura compartida',
    hint: 'Pasto colindante con vecino, deyecciones cruzadas, vector indirecto.',
  },
];

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ManualContactModalProps {
  open: boolean;
  onClose: () => void;
  /** Caso fuente — el contacto se atribuye desde aqui. */
  sourceCaseId: string;
  /** Bovino del caso fuente — para excluirlo del selector de destino
   *  (no se puede tener contacto consigo mismo). */
  sourceBovineId?: string;
  /** Para alimentar el selector de bovinos del rancho correcto. */
  ranchId?: string | null;
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function ManualContactModal({
  open, onClose, sourceCaseId, sourceBovineId, ranchId,
}: ManualContactModalProps) {
  const toast = useToast();
  const mutation = useCreateManualContact();

  // Estado del form. No uso RHF porque son 5 campos, hay un selector custom
  // (BovineSelector) y RHF anidado a un componente controlado externo no
  // aporta valor aqui.
  const [targetBovineId, setTargetBovineId] = useState<string | null>(null);
  const [contactType, setContactType]       = useState<ManualContactType>('DIRECT_CONTACT');
  const [contactDate, setContactDate]       = useState<string>(todayISO());
  const [confidence, setConfidence]         = useState<number>(0.7);
  const [notes, setNotes]                   = useState<string>('');
  const [error, setError]                   = useState<string | null>(null);

  function resetForm() {
    setTargetBovineId(null);
    setContactType('DIRECT_CONTACT');
    setContactDate(todayISO());
    setConfidence(0.7);
    setNotes('');
    setError(null);
    mutation.reset();
  }

  function handleClose() {
    if (mutation.isPending) return;
    resetForm();
    onClose();
  }

  function handleSubmit() {
    setError(null);
    if (!targetBovineId) {
      setError('Selecciona el bovino con el que tuvo contacto.');
      return;
    }
    if (confidence < 0 || confidence > 1) {
      setError('La confianza debe estar entre 0 y 1.');
      return;
    }

    const payload: CreateManualContactInput = {
      sourceCaseId,
      targetBovineId,
      // No enviamos `targetCaseId` aqui — el backend lo resuelve si el bovino
      // ya tiene caso activo de la misma enfermedad. Si no lo tiene, queda
      // como exposicion (targetCaseId=null) E-04.
      contactType,
      contactDate,
      confidence,
      notes: notes.trim() || undefined,
    };

    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(
          'Contacto registrado',
          'El contacto manual se agregó a la red epidemiológica del caso.',
        );
        resetForm();
        onClose();
      },
      onError: (err: unknown) => {
        setError(getFriendlyMessage(err) || 'No se pudo registrar el contacto.');
      },
    });
  }

  const selectedTypeHint = CONTACT_TYPE_OPTIONS.find((t) => t.value === contactType)?.hint;

  return (
    <Modal open={open} onClose={handleClose} title="Agregar contacto manual" size="lg">
      <div className="space-y-4">
        <Alert variant="info">
          <p className="text-sm">
            Captura contactos que el motor automático no detecta: contacto en
            transporte / feria, cerca con vecino, bebederos compartidos entre
            ranchos, etc. Los contactos por co-localización en potreros del mismo
            rancho los detecta el sistema solo.
          </p>
        </Alert>

        {/* Bovino destino */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bovino con el que tuvo contacto <span className="text-red-500">*</span>
          </label>
          <BovineSelector
            value={targetBovineId}
            onChange={(id) => setTargetBovineId(id)}
            ranchId={ranchId}
            excludeIds={sourceBovineId ? [sourceBovineId] : []}
            placeholder="Buscar por arete o nombre..."
            label=""
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 inline-flex items-center gap-1">
            <Users className="w-3 h-3" />
            Si el bovino ya tiene un caso activo de la misma enfermedad, se
            enlazará como <strong>contagio confirmado</strong>. Si no, queda
            como <strong>exposición asintomática</strong>.
          </p>
        </div>

        {/* Tipo + fecha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de contacto <span className="text-red-500">*</span>
            </label>
            <Select
              options={CONTACT_TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
              value={contactType}
              onChange={(e) => setContactType(e.target.value as ManualContactType)}
            />
            {selectedTypeHint && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{selectedTypeHint}</p>
            )}
          </div>
          <Input
            label="Fecha del contacto"
            type="date"
            max={todayISO()}
            value={contactDate}
            onChange={(e) => setContactDate(e.target.value)}
          />
        </div>

        {/* Confianza */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Confianza del contacto <span className="text-gray-400 font-normal">(0 a 1)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-14 text-sm font-semibold tabular-nums text-right">
              {confidence.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            0.7 (default) es razonable cuando el VET tiene observación directa.
            Bajar si el contacto es inferido o reportado por terceros.
          </p>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Circunstancias, fuente del reporte, observaciones clínicas..."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={<Network className="w-4 h-4" />}
            loading={mutation.isPending}
            disabled={!targetBovineId}
            onClick={handleSubmit}
          >
            Registrar contacto
          </Button>
        </div>
      </div>
    </Modal>
  );
}
