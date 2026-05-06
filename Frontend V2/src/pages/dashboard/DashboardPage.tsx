import { useAuth } from '@/store/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics.api';
import { UserRole } from '@/types';
import { PageLoader } from '@/components/ui/Spinner';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { OwnerDashboard } from './components/OwnerDashboard';
import { ManagerDashboard } from './components/ManagerDashboard';
import { VeterinarianDashboard } from './components/VeterinarianDashboard';
import { WorkerDashboard } from './components/WorkerDashboard';
import { ViewerDashboard } from './components/ViewerDashboard';

export function DashboardPage() {
  const { user, activeRanchId } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', activeRanchId],
    queryFn: () => analyticsApi.getDashboard({ ranchId: activeRanchId! }).then((r) => r.data.data),
    enabled: !!activeRanchId,
    refetchInterval: 60000,
  });

  if (isLoading) return <PageLoader />;

  const dashboardProps = { data: data || {}, user: user! };

  switch (user?.role) {
    case UserRole.SUPER_ADMIN:
      return <SuperAdminDashboard {...dashboardProps} />;
    case UserRole.OWNER:
      return <OwnerDashboard {...dashboardProps} />;
    case UserRole.RANCH_MANAGER:
    case UserRole.MANAGER:
      return <ManagerDashboard {...dashboardProps} />;
    case UserRole.VETERINARIAN:
      return <VeterinarianDashboard {...dashboardProps} />;
    case UserRole.WORKER:
      return <WorkerDashboard {...dashboardProps} />;
    case UserRole.VIEWER:
    default:
      return <ViewerDashboard {...dashboardProps} />;
  }
}
