import type { User, DashboardData } from '@/types';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { HeartPulse, Stethoscope, Baby, Syringe } from 'lucide-react';
import { formatNumber, formatPercentage } from '@/utils/formatters';

interface Props {
  data: DashboardData;
  user: User;
}

export function VeterinarianDashboard({ data, user }: Props) {
  const health = data.healthFull;
  const reproduction = data.reproductionMetrics;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dr. {user.lastName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Panel veterinario - salud y reproducción</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pacientes Críticos"
          value={formatNumber(health?.stats?.critical || 0)}
          icon={HeartPulse}
          color="red"
        />
        <StatCard
          title="En Tratamiento"
          value={formatNumber(health?.stats?.underTreatment || 0)}
          icon={Stethoscope}
          color="amber"
        />
        <StatCard
          title="Tasa de Concepción"
          value={formatPercentage(reproduction?.conceptionRate || 0)}
          icon={Baby}
          color="purple"
        />
        <StatCard
          title="Partos Recientes"
          value={formatNumber(reproduction?.recentBirths || 0)}
          icon={Syringe}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Estado General del Hato</CardTitle>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Sanos', value: health?.stats?.healthy || 0, total: health?.stats?.total || 1, color: 'bg-green-500' },
              { label: 'Enfermos', value: health?.stats?.sick || 0, total: health?.stats?.total || 1, color: 'bg-amber-500' },
              { label: 'Críticos', value: health?.stats?.critical || 0, total: health?.stats?.total || 1, color: 'bg-red-500' },
              { label: 'Recuperándose', value: health?.stats?.recovering || 0, total: health?.stats?.total || 1, color: 'bg-blue-500' },
            ].map((item) => {
              const pct = (item.value / item.total) * 100;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                    <span className="font-medium">{item.value} ({formatPercentage(pct)})</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardTitle>Reproducción</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Tasa de Concepción</span>
              <span className="text-lg font-bold text-primary-600">
                {formatPercentage(reproduction?.conceptionRate || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Intervalo entre Partos</span>
              <span className="text-lg font-bold">{reproduction?.calvingInterval || '—'} días</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Partos Recientes</span>
              <span className="text-lg font-bold text-purple-600">{reproduction?.recentBirths || 0}</span>
            </div>
            {reproduction?.upcomingDueDates && (reproduction.upcomingDueDates as unknown[]).length > 0 && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 mb-2">Próximos partos esperados</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {(reproduction.upcomingDueDates as unknown[]).length} bovino(s) con parto próximo
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
