import { useNavigate } from 'react-router-dom';
import type { User, DashboardData } from '@/types';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HeartPulse, Milk, MapPin, ClipboardList, Plus } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';

interface Props {
  data: DashboardData;
  user: User;
}

export function WorkerDashboard({ data, user }: Props) {
  const navigate = useNavigate();
  const health = data.healthLight;
  const production = data.productionLight;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Hola, {user.firstName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Tareas y registros del día</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Bovinos Sanos"
          value={formatNumber(health?.healthy || 0)}
          icon={HeartPulse}
          color="emerald"
        />
        <StatCard
          title="Requieren Atención"
          value={formatNumber((health?.sick || 0) + (health?.critical || 0))}
          icon={HeartPulse}
          color="red"
        />
        <StatCard
          title="Producción Hoy"
          value={`${formatNumber(production?.totalToday || 0)} L`}
          icon={Milk}
          color="blue"
        />
        <StatCard
          title="Promedio Diario"
          value={`${formatNumber(production?.averageDaily || 0)} L`}
          icon={Milk}
          color="purple"
        />
      </div>

      {/* Quick actions */}
      <Card>
        <CardTitle>Acciones Rápidas</CardTitle>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            size="lg"
            icon={<MapPin className="w-5 h-5" />}
            className="justify-start"
            onClick={() => navigate('/locations')}
          >
            Registrar Ubicación
          </Button>
          <Button
            variant="outline"
            size="lg"
            icon={<Milk className="w-5 h-5" />}
            className="justify-start"
            onClick={() => navigate('/production')}
          >
            Registrar Producción
          </Button>
          <Button
            variant="outline"
            size="lg"
            icon={<ClipboardList className="w-5 h-5" />}
            className="justify-start"
            onClick={() => navigate('/events')}
          >
            Ver Tareas del Día
          </Button>
        </div>
      </Card>

      {/* New event shortcut */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Eventos Pendientes</CardTitle>
          <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/events')}>
            Ver Todos
          </Button>
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Revisa tus eventos pendientes y tareas asignadas en la sección de Eventos.
        </p>
      </Card>
    </div>
  );
}
