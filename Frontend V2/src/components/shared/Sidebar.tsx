import { NavLink } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';
import { sidebarRoutes } from '@/router/routes';
import {
  Beef,
  LayoutDashboard,
  HeartPulse,
  CalendarDays,
  Milk,
  Baby,
  DollarSign,
  MapPin,
  Map,
  Pill,
  Package,
  Home,
  Users,
  Bell,
  Shield,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Beef,
  HeartPulse,
  CalendarDays,
  Milk,
  Baby,
  DollarSign,
  MapPin,
  Map,
  Pill,
  Package,
  Home,
  Users,
  Bell,
  Shield,
  FileBarChart,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();

  const visibleRoutes = sidebarRoutes.filter(
    (route) => route.showInSidebar && (!route.roles || (user && route.roles.includes(user.role))),
  );

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-gray-200 dark:border-gray-800">
        <div className="bg-primary-700 rounded-lg p-1.5 shrink-0">
          <Beef className="w-6 h-6 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-gray-900 dark:text-white truncate">Bovino</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-thin">
        {visibleRoutes.map((route) => {
          const Icon = iconMap[route.icon] || LayoutDashboard;
          return (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white',
                  collapsed && 'justify-center px-2',
                )
              }
              title={collapsed ? route.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{route.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-2">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
}
