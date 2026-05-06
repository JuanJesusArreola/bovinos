import type { User, DashboardData } from '@/types';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { Users, Beef, Activity, Shield, Server, AlertTriangle } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';

interface Props {
  data: DashboardData;
  user: User;
}

export function SuperAdminDashboard({ data }: Props) {
  const health = data.healthFull;
  const system = data.systemMetrics;
  const users = data.users;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel de Super Administrador</h1>
        <p className="text-gray-500 dark:text-gray-400">Vista general del sistema completo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Usuarios"
          value={formatNumber(system?.totalUsers || 0)}
          icon={Users}
          color="blue"
          trend={system ? { value: system.activeUsers, label: 'activos' } : undefined}
        />
        <StatCard
          title="Total Bovinos"
          value={formatNumber(health?.stats?.total || 0)}
          icon={Beef}
          color="primary"
        />
        <StatCard
          title="Ranchos Activos"
          value={formatNumber(system?.totalRanches || 0)}
          icon={Server}
          color="purple"
        />
        <StatCard
          title="Eventos sin Resolver"
          value={formatNumber(system?.unresolvedEvents || 0)}
          icon={AlertTriangle}
          color={system?.unresolvedEvents ? 'red' : 'emerald'}
        />
      </div>

      {/* Health overview + Users overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Salud del Hato</CardTitle>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 text-center">
              <Activity className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {formatNumber(health?.stats?.healthy || 0)}
              </div>
              <div className="text-xs text-green-600">Sanos</div>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
              <Activity className="w-6 h-6 text-amber-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {formatNumber(health?.stats?.sick || 0)}
              </div>
              <div className="text-xs text-amber-600">Enfermos</div>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-center">
              <Activity className="w-6 h-6 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {formatNumber(health?.stats?.critical || 0)}
              </div>
              <div className="text-xs text-red-600">Críticos</div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 text-center">
              <Activity className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {formatNumber(health?.stats?.underTreatment || 0)}
              </div>
              <div className="text-xs text-blue-600">En Tratamiento</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Usuarios del Sistema</CardTitle>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Activos</span>
              <span className="text-sm font-semibold text-green-600">{system?.activeUsers || 0}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Inactivos</span>
              <span className="text-sm font-semibold text-gray-600">{system?.inactiveUsers || 0}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Bloqueados</span>
              <span className="text-sm font-semibold text-red-600">{system?.blockedUsers || 0}</span>
            </div>
            {users?.byRole && Object.entries(users.byRole).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">{role}</span>
                <span className="text-sm font-semibold">{String(count)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Security */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary-600" />
          <CardTitle>Seguridad</CardTitle>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {system?.unresolvedEvents
            ? `Hay ${system.unresolvedEvents} evento(s) de seguridad sin resolver que requieren atención.`
            : 'No hay eventos de seguridad pendientes. Todo está en orden.'}
        </p>
      </Card>
    </div>
  );
}
