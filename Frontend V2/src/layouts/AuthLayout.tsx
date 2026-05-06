import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { Beef } from 'lucide-react';

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-primary-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Left: decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative text-center text-white space-y-8 max-w-md">
          <div className="flex justify-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6">
              <Beef className="w-16 h-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Bovino</h1>
          <p className="text-lg text-primary-100 leading-relaxed">
            Sistema integral de gestión ganadera. Controla tu hato, optimiza la producción y toma decisiones basadas en datos.
          </p>
          <div className="flex justify-center gap-8 pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold">GPS</div>
              <div className="text-sm text-primary-200">Rastreo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">Salud</div>
              <div className="text-sm text-primary-200">Monitoreo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">ROI</div>
              <div className="text-sm text-primary-200">Análisis</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: form outlet */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="bg-primary-700 rounded-xl p-3">
              <Beef className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Bovino</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
