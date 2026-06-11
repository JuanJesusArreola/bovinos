/**
 * Pagina dedicada de estadisticas de diagnosticos.
 *
 * Ruta: /health/diagnosis/stats
 * Permisos: VIEW_REPORTS (es vista de reporte, no requiere ser VET).
 *
 * Estructura:
 *   - Header con titulo + ranch banner.
 *   - DateRangeSelector controla el rango global.
 *   - DiagnosisStatsDashboard variante 'full' con todo el contenido.
 *
 * Sin rancho activo NO renderizamos el dashboard, igual que el resto
 * de modulos. Sin selector de rancho aqui porque ya esta el global
 * del topbar.
 */

import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import {
  RanchFilterBanner, RanchFilterBannerEmpty,
} from '@/components/shared/RanchFilterBanner';
import { Activity } from 'lucide-react';
import {
  DateRangeSelector, defaultDateRange,
  type DateRangeValue,
} from '@/components/health/DateRangeSelector';
import { DiagnosisStatsDashboard } from '@/components/health/DiagnosisStatsDashboard';

export function DiagnosisStatsPage() {
  const { activeRanchId } = useAuth();
  const [range, setRange] = useState<DateRangeValue>(() => defaultDateRange());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <Activity className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Estadisticas de diagnostico
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Distribucion clinica, top de diagnosticos y razon de
              confirmacion del rancho.
            </p>
          </div>
        </div>
        <DateRangeSelector value={range} onChange={setRange} />
      </div>

      <RanchFilterBanner
        activeHint="Estadisticas de diagnostico de este rancho."
        emptyHint="Selecciona un rancho para ver las estadisticas."
      />

      {!activeRanchId ? (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="Las estadisticas de diagnostico se calculan por rancho. Elige uno arriba para continuar."
        />
      ) : (
        <DiagnosisStatsDashboard
          filters={{
            ranchId:   activeRanchId,
            startDate: range.startDate,
            endDate:   range.endDate,
          }}
          variant="full"
        />
      )}
    </div>
  );
}
