import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-8xl font-bold text-primary-200 dark:text-primary-900">404</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Página no encontrada</h1>
        <p className="text-gray-500 dark:text-gray-400">
          La página que buscas no existe o ha sido movida.
        </p>
        <Link to="/dashboard">
          <Button icon={<Home className="w-4 h-4" />}>Ir al Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
