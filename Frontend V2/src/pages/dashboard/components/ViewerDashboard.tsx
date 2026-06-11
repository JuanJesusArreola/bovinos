import type { User, DashboardData } from '@/types';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { Beef, HeartPulse, Milk, Eye } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';

interface Props {
  data: DashboardData;
  user: User;
}

export function ViewerDashboard({ data, user }: Props) {
  const health     = (data as any).health;
  const production = (data as any).production;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vista General</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          Bienvenido, {user.firstName}. Tienes acceso de solo lectura.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Bovinos"
          value={formatNumber(health?.totalBovines || 0)}
          icon={Beef}
          color="primary"
        />
        <StatCard
          title="Sanos"
          value={formatNumber(health?.byStatus?.HEALTHY || 0)}
          icon={HeartPulse}
          color="emerald"
        />
        <StatCard
          title="Enfermos / Críticos"
          value={formatNumber((health?.byStatus?.SICK || 0) + (health?.criticalCount || 0))}
          icon={HeartPulse}
          color="red"
        />
        <StatCard
          title="Producción del Período"
          value={`${formatNumber(production?.milkProduction?.total || 0)} L`}
          icon={Milk}
          color="blue"
        />
      </div>

      <Card>
        <CardTitle>Información</CardTitle>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Como usuario con rol de Visitante, puedes consultar los resúmenes de salud y producción.
          Para acciones de escritura, contacta al administrador del rancho.
        </p>
      </Card>
    </div>
  );
}
