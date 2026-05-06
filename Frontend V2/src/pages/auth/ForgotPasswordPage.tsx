import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Mail, ArrowLeft } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Email inválido'),
});

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: { email: string }) => {
    setError('');
    try {
      await authApi.forgotPassword(data);
      setSent(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Error al enviar el correo');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recuperar Contraseña</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Te enviaremos un enlace para restablecer tu contraseña
        </p>
      </div>

      {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}

      {sent ? (
        <Alert variant="success" title="Correo enviado">
          Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="email"
            type="email"
            label="Correo electrónico"
            placeholder="tu@email.com"
            icon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Enviar Enlace
          </Button>
        </form>
      )}

      <Link to="/login" className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-500">
        <ArrowLeft className="w-4 h-4" /> Volver a Iniciar Sesión
      </Link>
    </div>
  );
}
