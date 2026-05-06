import type { User, DashboardData } from '@/types';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { Beef, HeartPulse, CalendarDays, DollarSign } from 'lucide-react';
import { formatNumber, formatCurrency } from '@/utils/formatters';

interface Props {
  data: DashboardData;
  user: User;
}

export function ManagerDashboard({ data, user }: Props) {
  const health = data.healthFull;
  const production = data.productionLight || data.productionFull;
  const financial = data.financialLight;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Hola, {user.firstName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Gestión operativa del día</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Bovinos Activos"
          value={formatNumber(health?.stats?.total || 0)}
          icon={Beef}
          color="primary"
        />
        <StatCard
          title="Requieren Atención"
          value={formatNumber((health?.stats?.sick || 0) + (health?.stats?.critical || 0))}
          icon={HeartPulse}
          color="red"
        />
        <StatCard
          title="Producción Hoy"
          value={`${formatNumber(production?.totalToday || 0)} L`}
          icon={CalendarDays}
          color="blue"
        />
        <StatCard
          title="Balance"
          value={formatCurrency(financial?.netBalance || 0)}
          icon={DollarSign}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Estado de Salud del Hato</CardTitle>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Sanos', value: health?.stats?.healthy || 0, color: 'text-green-600' },
              { label: 'Enfermos', value: health?.stats?.sick || 0, color: 'text-amber-600' },
              { label: 'Críticos', value: health?.stats?.critical || 0, color: 'text-red-600' },
              { label: 'Recuperándose', value: health?.stats?.recovering || 0, color: 'text-blue-600' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-center">
                <div className={`text-xl font-bold ${item.color}`}>{formatNumber(item.value)}</div>
                <div className="text-xs text-gray-500">{item.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Resumen Financiero</CardTitle>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Ingresos</span>
              <span className="font-medium text-green-600">{formatCurrency(financial?.totalIncome || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Gastos</span>
              <span className="font-medium text-red-600">{formatCurrency(financial?.totalExpenses || 0)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-sm font-medium">Balance</span>
              <span className="font-bold">{formatCurrency(financial?.netBalance || 0)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
