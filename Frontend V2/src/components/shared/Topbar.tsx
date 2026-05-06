import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import { getRoleLabel, getRoleColor } from '@/utils/permissions';
import { Bell, Sun, Moon, LogOut, User, Menu, ChevronDown, Building2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface TopbarProps {
  onMenuToggle: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout, activeRanchId, activeRanchName, setActiveRanch } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [ranchMenuOpen, setRanchMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ranchMenuRef = useRef<HTMLDivElement>(null);

  const hasMultipleRanches = (user?.ranchAccess?.length || 0) > 1;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (ranchMenuRef.current && !ranchMenuRef.current.contains(e.target as Node)) setRanchMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 sm:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Ranch selector */}
      {activeRanchName && (
        <div ref={ranchMenuRef} className="relative">
          <button
            onClick={() => hasMultipleRanches && setRanchMenuOpen(!ranchMenuOpen)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700',
              hasMultipleRanches ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : 'cursor-default',
            )}
          >
            <Building2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <span className="text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{activeRanchName}</span>
            {hasMultipleRanches && <ChevronDown className="w-3 h-3 text-gray-400" />}
          </button>
          {ranchMenuOpen && hasMultipleRanches && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 py-1 z-50">
              <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Cambiar rancho</p>
              {user?.ranchAccess?.filter((r) => r.isActive).map((ranch) => (
                <button
                  key={ranch.ranchId}
                  onClick={() => { setActiveRanch(ranch.ranchId); setRanchMenuOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors',
                    ranch.ranchId === activeRanchId
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
                  )}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="truncate">{ranch.ranchName || ranch.ranchId}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.firstName} {user?.lastName}
              </div>
              <div className={cn('text-xs px-1.5 py-0.5 rounded-full inline-block', user ? getRoleColor(user.role) : '')}>
                {user ? getRoleLabel(user.role) : ''}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 hidden sm:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {activeRanchName || 'Sin rancho asignado'}
                </p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <User className="w-4 h-4" /> Mi Perfil
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="w-4 h-4" /> Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
