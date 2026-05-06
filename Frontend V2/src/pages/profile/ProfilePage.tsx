import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { authApi } from '@/api/auth.api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { getRoleLabel, getRoleColor } from '@/utils/permissions';
import {
  User, Mail, Phone, Shield, Clock, CheckCircle2, KeyRound,
  Building2, Eye, EyeOff, Save,
} from 'lucide-react';

const profileSchema = z.object({
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmNewPassword: z.string().min(1, 'Confirma tu nueva contraseña'),
}).refine((d) => d.newPassword === d.confirmNewPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmNewPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const profileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => authApi.updateProfile(data),
    onSuccess: (res) => {
      updateUser(res.data.data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setProfileSuccess('Perfil actualizado correctamente');
      setTimeout(() => setProfileSuccess(''), 3000);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordFormData) => authApi.changePassword(data),
    onSuccess: () => {
      passwordForm.reset();
      setPasswordSuccess('Contraseña actualizada correctamente');
      setTimeout(() => setPasswordSuccess(''), 3000);
    },
  });

  const tabs = [
    { id: 'info' as const, label: 'Información Personal', icon: User },
    { id: 'security' as const, label: 'Seguridad', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary-700 dark:text-primary-400">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user?.firstName} {user?.lastName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={getRoleColor(user!.role)}>{getRoleLabel(user!.role)}</Badge>
            {user?.isVerified && (
              <Badge variant="success">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Verificado
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Edit Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardTitle>Editar Perfil</CardTitle>
              {profileSuccess && <Alert variant="success" className="mt-4">{profileSuccess}</Alert>}
              {profileMutation.error && (
                <Alert variant="error" className="mt-4">Error al actualizar el perfil</Alert>
              )}
              <form
                onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}
                className="mt-6 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Nombre"
                    icon={<User className="w-4 h-4" />}
                    error={profileForm.formState.errors.firstName?.message}
                    {...profileForm.register('firstName')}
                  />
                  <Input
                    label="Apellido"
                    icon={<User className="w-4 h-4" />}
                    error={profileForm.formState.errors.lastName?.message}
                    {...profileForm.register('lastName')}
                  />
                </div>
                <Input
                  label="Teléfono"
                  icon={<Phone className="w-4 h-4" />}
                  placeholder="+52 000 000 0000"
                  error={profileForm.formState.errors.phone?.message}
                  {...profileForm.register('phone')}
                />
                <Input
                  label="Correo Electrónico"
                  icon={<Mail className="w-4 h-4" />}
                  value={user?.email || ''}
                  disabled
                />
                <div className="flex justify-end pt-2">
                  <Button type="submit" loading={profileMutation.isPending} icon={<Save className="w-4 h-4" />}>
                    Guardar Cambios
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Account Details Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardTitle>Detalles de Cuenta</CardTitle>
              <div className="mt-4 space-y-4">
                <InfoRow icon={Mail} label="Email" value={user?.email || ''} />
                <InfoRow icon={Shield} label="Rol" value={getRoleLabel(user!.role)} />
                {user?.userCode && <InfoRow icon={KeyRound} label="Código" value={user.userCode} />}
                {user?.username && <InfoRow icon={User} label="Usuario" value={user.username} />}
                <InfoRow
                  icon={Clock}
                  label="Último acceso"
                  value={user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  }) : 'N/A'}
                />
                <InfoRow
                  icon={CheckCircle2}
                  label="Estado"
                  value={user?.isActive ? 'Activo' : 'Inactivo'}
                />
              </div>
            </Card>

            {/* Ranches */}
            {user?.ranchAccess && user.ranchAccess.length > 0 && (
              <Card>
                <CardTitle>Mis Ranchos</CardTitle>
                <div className="mt-4 space-y-3">
                  {user.ranchAccess.map((ranch) => (
                    <div
                      key={ranch.ranchId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {ranch.ranchName || ranch.ranchId}
                        </p>
                        <p className="text-xs text-gray-500">{ranch.accessLevel}</p>
                      </div>
                      <Badge variant={ranch.isActive ? 'success' : 'default'}>
                        {ranch.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="max-w-2xl">
          <Card>
            <CardTitle>Cambiar Contraseña</CardTitle>
            {passwordSuccess && <Alert variant="success" className="mt-4">{passwordSuccess}</Alert>}
            {passwordMutation.error && (
              <Alert variant="error" className="mt-4">Error al cambiar la contraseña</Alert>
            )}
            <form
              onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}
              className="mt-6 space-y-4"
            >
              <div className="relative">
                <Input
                  label="Contraseña Actual"
                  type={showCurrentPwd ? 'text' : 'password'}
                  icon={<KeyRound className="w-4 h-4" />}
                  error={passwordForm.formState.errors.currentPassword?.message}
                  {...passwordForm.register('currentPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  label="Nueva Contraseña"
                  type={showNewPwd ? 'text' : 'password'}
                  icon={<KeyRound className="w-4 h-4" />}
                  error={passwordForm.formState.errors.newPassword?.message}
                  {...passwordForm.register('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                >
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input
                label="Confirmar Nueva Contraseña"
                type="password"
                icon={<KeyRound className="w-4 h-4" />}
                error={passwordForm.formState.errors.confirmNewPassword?.message}
                {...passwordForm.register('confirmNewPassword')}
              />
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={passwordMutation.isPending} icon={<Shield className="w-4 h-4" />}>
                  Cambiar Contraseña
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5" />
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
