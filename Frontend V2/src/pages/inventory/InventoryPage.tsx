import { Package } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
          <Package className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventario</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gestión de inventario general</p>
        </div>
      </div>
      <Card>
        <p className="text-gray-500 dark:text-gray-400">Módulo en desarrollo. Próximamente disponible.</p>
      </Card>
    </div>
  );
}
