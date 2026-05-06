import { cn } from '@/utils/cn';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import type { ReactNode } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

const config: Record<AlertVariant, { icon: typeof Info; bg: string; border: string; text: string }> = {
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400' },
  success: { icon: CheckCircle2, bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' },
  error: { icon: AlertCircle, bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
};

export function Alert({ variant = 'info', title, children, onClose, className }: AlertProps) {
  const { icon: Icon, bg, border, text } = config[variant];

  return (
    <div className={cn('flex gap-3 rounded-lg border p-4', bg, border, className)}>
      <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', text)} />
      <div className="flex-1 min-w-0">
        {title && <p className={cn('text-sm font-medium', text)}>{title}</p>}
        <div className={cn('text-sm', text, title && 'mt-1')}>{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className={cn('shrink-0', text)}>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
