import { UserRole } from '@/types';

export interface RouteConfig {
  path: string;
  label: string;
  icon: string;
  roles?: UserRole[];
  showInSidebar?: boolean;
}

const ALL_ROLES = Object.values(UserRole);
const MANAGEMENT_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER, UserRole.MANAGER];
const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER];
const USER_MGMT_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER];

export const sidebarRoutes: RouteConfig[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: ALL_ROLES, showInSidebar: true },
  { path: '/bovines', label: 'Bovinos', icon: 'Beef', roles: ALL_ROLES, showInSidebar: true },
  { path: '/health', label: 'Salud', icon: 'HeartPulse', roles: ALL_ROLES, showInSidebar: true },
  { path: '/events', label: 'Eventos', icon: 'CalendarDays', roles: ALL_ROLES, showInSidebar: true },
  { path: '/production', label: 'Producción', icon: 'Milk', roles: ALL_ROLES, showInSidebar: true },
  { path: '/reproduction', label: 'Reproducción', icon: 'Baby', roles: ALL_ROLES, showInSidebar: true },
  { path: '/finance', label: 'Finanzas', icon: 'DollarSign', roles: ALL_ROLES, showInSidebar: true },
  { path: '/maps', label: 'Mapa', icon: 'Map', roles: ALL_ROLES, showInSidebar: true },
  { path: '/locations', label: 'Ubicaciones', icon: 'MapPin', roles: ALL_ROLES, showInSidebar: true },
  { path: '/medications', label: 'Medicamentos', icon: 'Pill', roles: ALL_ROLES, showInSidebar: true },
  { path: '/inventory', label: 'Inventario', icon: 'Package', roles: ALL_ROLES, showInSidebar: true },
  { path: '/ranch', label: 'Rancho', icon: 'Home', roles: MANAGEMENT_ROLES, showInSidebar: true },
  { path: '/users', label: 'Usuarios', icon: 'Users', roles: USER_MGMT_ROLES, showInSidebar: true },
  { path: '/notifications', label: 'Notificaciones', icon: 'Bell', roles: ALL_ROLES, showInSidebar: true },
  { path: '/security', label: 'Seguridad', icon: 'Shield', roles: ADMIN_ROLES, showInSidebar: true },
  { path: '/reports', label: 'Reportes', icon: 'FileBarChart', roles: ALL_ROLES, showInSidebar: true },
];
