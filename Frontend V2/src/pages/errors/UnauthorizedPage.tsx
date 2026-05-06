import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ShieldOff, ArrowLeft } from 'lucide-react';

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-6">
            <ShieldOff className="w-12 h-12 text-red-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acceso no autorizado</h1>
        <p className="text-gray-500 dark:text-gray-400">
          No tienes permisos para acceder a esta sección. Contacta a tu administrador si crees que es un error.
        </p>
        <Link to="/dashboard">
          <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />}>
            Volver al Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
