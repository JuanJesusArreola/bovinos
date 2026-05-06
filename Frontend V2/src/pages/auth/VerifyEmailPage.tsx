import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación no proporcionado.');
      return;
    }

    authApi.verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Tu correo electrónico ha sido verificado exitosamente.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Error al verificar el correo.');
      });
  }, [token]);

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verificación de Email</h2>

      {status === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Spinner size="lg" />
          <p className="text-gray-500">Verificando tu correo electrónico...</p>
        </div>
      )}

      {status === 'success' && (
        <Alert variant="success" title="Email verificado">{message}</Alert>
      )}

      {status === 'error' && (
        <Alert variant="error" title="Error de verificación">{message}</Alert>
      )}

      {status !== 'loading' && (
        <Link to="/login">
          <Button variant="outline" className="w-full">Ir a Iniciar Sesión</Button>
        </Link>
      )}
    </div>
  );
}
