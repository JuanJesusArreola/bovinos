import type { User, DashboardData } from '@/types';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { Beef, HeartPulse, DollarSign, Users, TrendingUp } from 'lucide-react';
import { formatNumber, formatCurrency } from '@/utils/formatters';

interface Props {
  data: DashboardData;
  user: User;
}

export function OwnerDashboard({ data, user }: Props) {
  const health = data.healthFull;
  const production = data.productionFull;
  const financial = data.financialFull;
  const users = data.users;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bienvenido, {user.firstName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Dashboard de {(user as any).ranchName || 'tu rancho'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Bovinos"
          value={formatNumber(health?.stats?.total || 0)}
          icon={Beef}
          color="primary"
        />
        <StatCard
          title="Salud del Hato"
          value={`${formatNumber(health?.stats?.healthy || 0)} sanos`}
          icon={HeartPulse}
          color="emerald"
        />
        <StatCard
          title="Balance Neto"
          value={formatCurrency(financial?.netBalance || 0)}
          icon={DollarSign}
          color={financial?.netBalance && financial.netBalance >= 0 ? 'emerald' : 'red'}
        />
        <StatCard
          title="Usuarios del Rancho"
          value={formatNumber(users?.total || 0)}
          icon={Users}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production summary */}
        <Card>
          <CardTitle>Producción</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Producción hoy</span>
              <span className="text-lg font-semibold">{formatNumber(production?.totalToday || 0)} L</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Promedio diario</span>
              <span className="text-lg font-semibold">{formatNumber(production?.averageDaily || 0)} L</span>
            </div>
            {production?.topProducers && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 mb-2">Top productores</p>
                {(production.topProducers as { earTag: string; quantity: number }[]).slice(0, 3).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1">
                    <span className="text-gray-600 dark:text-gray-400">{p.earTag}</span>
                    <span className="font-medium">{formatNumber(p.quantity)} L</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Financial summary */}
        <Card>
          <CardTitle>Resumen Financiero</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Ingresos</span>
              <span className="text-lg font-semibold text-green-600">
                {formatCurrency(financial?.totalIncome || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Gastos</span>
              <span className="text-lg font-semibold text-red-600">
                {formatCurrency(financial?.totalExpenses || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Balance Neto</span>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(financial?.netBalance || 0)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
