/**
 * Selector de rango de fechas reutilizable.
 *
 * Soporta dos modos:
 *   1. Preset (ultimos 7/30/90/365 dias).
 *   2. Personalizado (date pickers de "desde" y "hasta").
 *
 * El valor que expone hacia el padre es siempre el rango concreto
 * (`startDate` + `endDate` en YYYY-MM-DD). Los presets se calculan
 * relativo a HOY al cambiarlos. Si el usuario selecciona "Personalizado",
 * los date pickers quedan visibles para que ajuste manualmente.
 *
 * Convencion: ambas fechas son inclusivas. "Ultimos 7 dias" = hoy y
 * los 6 anteriores. El backend espera el mismo formato.
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Calendar } from 'lucide-react';

export interface DateRangeValue {
  /** YYYY-MM-DD inclusive. */
  startDate: string;
  endDate:   string;
}

export type DateRangePreset = '7' | '30' | '90' | '365' | 'custom';

interface DateRangeSelectorProps {
  value:    DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  /** Preset inicial. Si no se pasa, se infiere de `value` (custom si no
   *  coincide con ningun preset). Default '30'. */
  defaultPreset?: DateRangePreset;
  className?: string;
}

const PRESET_OPTIONS = [
  { value: '7',      label: 'Ultimos 7 dias'  },
  { value: '30',     label: 'Ultimos 30 dias' },
  { value: '90',     label: 'Ultimos 90 dias' },
  { value: '365',    label: 'Ultimo ano'      },
  { value: 'custom', label: 'Personalizado'   },
];

/**
 * Calcula start/end para un preset. Hoy es siempre `endDate`. La
 * duracion incluye `hoy` mas (N-1) dias previos.
 *
 * Usamos UTC para que el preset sea reproducible independientemente
 * de la TZ del navegador (el backend espera YYYY-MM-DD plano).
 */
function computePresetRange(days: number): DateRangeValue {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(todayUtc.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate:   todayUtc.toISOString().slice(0, 10),
  };
}

/**
 * Detecta si un rango coincide con un preset conocido. Util para
 * inicializar el selector cuando el padre nos pasa un value ya formado
 * (e.g. al volver de un drill-down via URL params).
 */
function detectPreset(value: DateRangeValue): DateRangePreset {
  for (const days of [7, 30, 90, 365] as const) {
    const ref = computePresetRange(days);
    if (ref.startDate === value.startDate && ref.endDate === value.endDate) {
      return String(days) as DateRangePreset;
    }
  }
  return 'custom';
}

export function DateRangeSelector({
  value,
  onChange,
  defaultPreset,
  className,
}: DateRangeSelectorProps) {
  const [preset, setPreset] = useState<DateRangePreset>(
    defaultPreset ?? detectPreset(value),
  );

  // Si el padre cambia `value` sin pasar por aqui (e.g. reset externo),
  // re-detectamos el preset para que el dropdown refleje la realidad.
  useEffect(() => {
    setPreset(detectPreset(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.startDate, value.endDate]);

  function handlePresetChange(next: DateRangePreset) {
    setPreset(next);
    if (next !== 'custom') {
      onChange(computePresetRange(Number(next)));
    }
    // En modo custom no tocamos value - el usuario edita los pickers.
  }

  function handleStartChange(s: string) {
    onChange({ startDate: s, endDate: value.endDate });
    setPreset('custom');
  }
  function handleEndChange(e: string) {
    onChange({ startDate: value.startDate, endDate: e });
    setPreset('custom');
  }

  // Validacion visual minima: si start > end, marcamos error inline.
  const invalid = value.startDate && value.endDate && value.startDate > value.endDate;

  return (
    <div className={['space-y-2', className ?? ''].join(' ')}>
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
        <Select
          options={PRESET_OPTIONS}
          value={preset}
          onChange={(e) => handlePresetChange(e.target.value as DateRangePreset)}
          className="!py-1.5 text-xs min-w-[180px]"
        />
        {preset === 'custom' && (
          <>
            <span className="text-xs text-gray-500 dark:text-gray-400">Desde</span>
            <Input
              type="date"
              value={value.startDate}
              onChange={(e) => handleStartChange(e.target.value)}
              className="!py-1.5 text-xs"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">Hasta</span>
            <Input
              type="date"
              value={value.endDate}
              onChange={(e) => handleEndChange(e.target.value)}
              className="!py-1.5 text-xs"
            />
          </>
        )}
      </div>
      {invalid && (
        <p className="text-xs text-red-500">
          La fecha de inicio no puede ser posterior a la fecha de fin.
        </p>
      )}
    </div>
  );
}

// ── Helper exportado para que callers puedan obtener un valor inicial ─────

/** Devuelve el rango de los ultimos 30 dias (preset default). */
export function defaultDateRange(): DateRangeValue {
  return computePresetRange(30);
}
