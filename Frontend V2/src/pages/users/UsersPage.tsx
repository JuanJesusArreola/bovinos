import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usersApi } from '@/api/users.api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { UserRole, type User } from '@/types';
import {
  Users, UserPlus, Search, Shield, ShieldCheck, ShieldAlert,
  Mail, Phone, Calendar, MoreVertical, CheckCircle2, XCircle,
  Eye, Edit3, UserX, UserCheck, Crown, Briefcase, Stethoscope,
  HardHat, EyeIcon,
} from 'lucide-react';

// ─── Role hierarchy (higher = more privilege) ─────────────────────────────

const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.OWNER]: 6,
  [UserRole.SUPER_ADMIN]: 5,
  [UserRole.RANCH_MANAGER]: 4,
  [UserRole.MANAGER]: 3,
  [UserRole.VETERINARIAN]: 2,
  [UserRole.WORKER]: 1,
  [UserRole.VIEWER]: 0,
};

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.OWNER]: 'Propietario',
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.RANCH_MANAGER]: 'Admin Rancho',
  [UserRole.MANAGER]: 'Gerente',
  [UserRole.VETERINARIAN]: 'Veterinario',
  [UserRole.WORKER]: 'Trabajador',
  [UserRole.VIEWER]: 'Observador',
};

const ROLE_ICON: Record<UserRole, React.ReactNode> = {
  [UserRole.OWNER]: <Crown className="w-3.5 h-3.5" />,
  [UserRole.SUPER_ADMIN]: <ShieldCheck className="w-3.5 h-3.5" />,
  [UserRole.RANCH_MANAGER]: <Shield className="w-3.5 h-3.5" />,
  [UserRole.MANAGER]: <Briefcase className="w-3.5 h-3.5" />,
  [UserRole.VETERINARIAN]: <Stethoscope className="w-3.5 h-3.5" />,
  [UserRole.WORKER]: <HardHat className="w-3.5 h-3.5" />,
  [UserRole.VIEWER]: <EyeIcon className="w-3.5 h-3.5" />,
};

type RoleBadgeVariant = 'purple' | 'danger' | 'info' | 'warning' | 'success' | 'default';

const ROLE_VARIANT: Record<UserRole, RoleBadgeVariant> = {
  [UserRole.OWNER]: 'purple',
  [UserRole.SUPER_ADMIN]: 'danger',
  [UserRole.RANCH_MANAGER]: 'info',
  [UserRole.MANAGER]: 'warning',
  [UserRole.VETERINARIAN]: 'success',
  [UserRole.WORKER]: 'default',
  [UserRole.VIEWER]: 'default',
};

// ─── Zod schemas ──────────────────────────────────────────────────────────

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/;

const createUserSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .max(72, 'Máximo 72 caracteres')
    .regex(passwordRegex, 'Debe contener mayúscula, minúscula, número y carácter especial'),
  confirmPassword: z.string().min(1, 'Confirma la contraseña'),
  firstName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  lastName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  phone: z.string().max(20).optional().or(z.literal('')),
  role: z.nativeEnum(UserRole, { error: 'Selecciona un rol' }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  firstName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  lastName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  phone: z.string().max(20).optional().or(z.literal('')),
  role: z.nativeEnum(UserRole, { error: 'Selecciona un rol' }),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────

function getAssignableRoles(currentRole: UserRole): { value: string; label: string }[] {
  const level = ROLE_LEVEL[currentRole];
  return Object.values(UserRole)
    .filter((r) => ROLE_LEVEL[r] < level) // Can only assign roles BELOW own level
    .sort((a, b) => ROLE_LEVEL[b] - ROLE_LEVEL[a])
    .map((r) => ({ value: r, label: ROLE_LABELS[r] }));
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getStatusBadge(user: User) {
  if (!user.isActive) {
    return <Badge variant="danger">Inactivo</Badge>;
  }
  if (user.status === 'SUSPENDED') {
    return <Badge variant="warning">Suspendido</Badge>;
  }
  if (user.status === 'BLOCKED') {
    return <Badge variant="danger">Bloqueado</Badge>;
  }
  if (user.status === 'PENDING_VERIFICATION' || !user.emailVerified) {
    return <Badge variant="warning">Pendiente</Badge>;
  }
  return <Badge variant="success">Activo</Badge>;
}

// ─── Component ────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ user: User; action: 'deactivate' | 'activate' } | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Queries
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter],
    queryFn: () => usersApi.list({ page, limit: 15, search: search || undefined }).then((r) => r.data.data),
  });

  // Normalize response — backend may return array or paginated object
  const users = useMemo(() => {
    if (!usersData) return [];
    if (Array.isArray(usersData)) return usersData as User[];
    if ('items' in (usersData as object)) return (usersData as { items: User[] }).items;
    if ('data' in (usersData as object)) return (usersData as unknown as { data: User[] }).data;
    return [];
  }, [usersData]);

  const totalPages = useMemo(() => {
    if (!usersData || Array.isArray(usersData)) return 1;
    return (usersData as { totalPages?: number }).totalPages || 1;
  }, [usersData]);

  const total = useMemo(() => {
    if (!usersData || Array.isArray(usersData)) return users.length;
    return (usersData as { total?: number }).total || users.length;
  }, [usersData, users.length]);

  // Filter locally by role if backend doesn't support it
  const filteredUsers = useMemo(() => {
    if (!roleFilter) return users;
    return users.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateUserFormData) =>
      usersApi.createUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario creado', 'El usuario fue registrado exitosamente.');
      setShowCreateModal(false);
    },
    onError: (err: any) => {
      toast.error('Error al crear usuario', err?.response?.data?.error?.message || 'Verifica los datos e intenta de nuevo.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditUserFormData }) =>
      usersApi.update(id, {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || undefined,
        role: data.role,
      } as Partial<User>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario actualizado', 'Los cambios fueron guardados correctamente.');
      setEditingUser(null);
    },
    onError: (err: any) => {
      toast.error('Error al actualizar', err?.response?.data?.error?.message || 'No se pudo actualizar el usuario.');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.warning('Usuario desactivado', 'El usuario ya no puede acceder al sistema.');
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo desactivar el usuario.');
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => usersApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario activado', 'El usuario puede acceder al sistema nuevamente.');
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo activar el usuario.');
    },
  });

  // Role filter options
  const roleOptions = [
    { value: '', label: 'Todos los roles' },
    ...Object.values(UserRole).map((r) => ({ value: r, label: ROLE_LABELS[r] })),
  ];

  const currentUserRole = currentUser?.role as UserRole;
  const canManageUser = (targetUser: User) => {
    if (targetUser.id === currentUser?.id) return false; // Can't manage self
    return ROLE_LEVEL[currentUserRole] > ROLE_LEVEL[targetUser.role as UserRole];
  };

  // Stats
  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive).length;
    const inactive = users.filter((u) => !u.isActive).length;
    const unverified = users.filter((u) => !u.emailVerified).length;
    return { total: users.length, active, inactive, unverified };
  }, [users]);

  // ── Table columns ─────────────────────────────────────────────────────

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'Usuario',
      render: (u) => (
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm shrink-0">
            {u.firstName?.[0]}{u.lastName?.[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {u.firstName} {u.lastName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (u) => (
        <Badge variant={ROLE_VARIANT[u.role as UserRole] || 'default'}>
          <span className="flex items-center gap-1">
            {ROLE_ICON[u.role as UserRole]}
            {ROLE_LABELS[u.role as UserRole] || u.role}
          </span>
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (u) => getStatusBadge(u),
    },
    {
      key: 'verification',
      header: 'Verificación',
      render: (u) => (
        <div className="flex items-center gap-2">
          <span title={u.emailVerified ? 'Email verificado' : 'Email no verificado'}>
            <Mail className={`w-4 h-4 ${u.emailVerified ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
          </span>
          <span title={u.phoneVerified ? 'Teléfono verificado' : 'Teléfono no verificado'}>
            <Phone className={`w-4 h-4 ${u.phoneVerified ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
          </span>
          {u.verificationScore != null && (
            <span className="text-xs text-gray-500">{u.verificationScore}%</span>
          )}
        </div>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Último acceso',
      render: (u) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Nunca'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Creado',
      render: (u) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(u.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (u) => canManageUser(u) ? (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActionMenuId(actionMenuId === u.id ? null : u.id);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>
          {actionMenuId === u.id && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
              <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => { setEditingUser(u); setActionMenuId(null); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Edit3 className="w-4 h-4" /> Editar
                </button>
                {u.isActive ? (
                  <button
                    onClick={() => { setConfirmAction({ user: u, action: 'deactivate' }); setActionMenuId(null); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <UserX className="w-4 h-4" /> Desactivar
                  </button>
                ) : (
                  <button
                    onClick={() => { setConfirmAction({ user: u, action: 'activate' }); setActionMenuId(null); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                  >
                    <UserCheck className="w-4 h-4" /> Activar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : null,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestión de usuarios y roles del sistema
            </p>
          </div>
        </div>
        <Button
          icon={<UserPlus className="w-4 h-4" />}
          onClick={() => setShowCreateModal(true)}
        >
          Crear Usuario
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 p-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
              <p className="text-xs text-gray-500">Activos</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-2">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inactive}</p>
              <p className="text-xs text-gray-500">Inactivos</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unverified}</p>
              <p className="text-xs text-gray-500">Sin verificar</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="!p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
          >
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <DataTable<User>
        columns={columns}
        data={filteredUsers}
        loading={isLoading}
        keyExtractor={(u) => u.id}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        emptyMessage="No se encontraron usuarios"
      />

      {/* ── Create User Modal ──────────────────────────────────────────── */}
      <CreateUserModal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); createMutation.reset(); }}
        currentUserRole={currentUserRole}
        mutation={createMutation}
      />

      {/* ── Edit User Modal ────────────────────────────────────────────── */}
      {editingUser && (
        <EditUserModal
          open={!!editingUser}
          onClose={() => { setEditingUser(null); updateMutation.reset(); }}
          user={editingUser}
          currentUserRole={currentUserRole}
          mutation={updateMutation}
        />
      )}

      {/* ── Confirm Activate/Deactivate Modal ──────────────────────────── */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.action === 'deactivate' ? 'Desactivar Usuario' : 'Activar Usuario'}
        size="sm"
      >
        {confirmAction && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              {confirmAction.action === 'deactivate' ? (
                <>
                  ¿Estás seguro de que deseas <span className="font-semibold text-red-600">desactivar</span> al usuario{' '}
                  <span className="font-semibold">{confirmAction.user.firstName} {confirmAction.user.lastName}</span>?
                  <br /><br />
                  El usuario no podrá acceder al sistema hasta que sea reactivado.
                </>
              ) : (
                <>
                  ¿Deseas <span className="font-semibold text-green-600">activar</span> al usuario{' '}
                  <span className="font-semibold">{confirmAction.user.firstName} {confirmAction.user.lastName}</span>?
                </>
              )}
            </p>

            {(deactivateMutation.error || activateMutation.error) && (
              <Alert variant="error">
                {extractError(confirmAction.action === 'deactivate' ? deactivateMutation.error : activateMutation.error)}
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                Cancelar
              </Button>
              <Button
                variant={confirmAction.action === 'deactivate' ? 'danger' : 'primary'}
                loading={deactivateMutation.isPending || activateMutation.isPending}
                onClick={() => {
                  if (confirmAction.action === 'deactivate') {
                    deactivateMutation.mutate(confirmAction.user.id);
                  } else {
                    activateMutation.mutate(confirmAction.user.id);
                  }
                }}
              >
                {confirmAction.action === 'deactivate' ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────

function CreateUserModal({
  open, onClose, currentUserRole, mutation,
}: {
  open: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  mutation: ReturnType<typeof useMutation<unknown, Error, CreateUserFormData>>;
}) {
  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '', password: '', confirmPassword: '',
      firstName: '', lastName: '', phone: '',
      role: undefined,
    },
  });

  const assignableRoles = useMemo(() => getAssignableRoles(currentUserRole), [currentUserRole]);

  const onSubmit = (data: CreateUserFormData) => {
    mutation.mutate(data, {
      onSuccess: () => form.reset(),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Crear Nuevo Usuario" size="lg">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {mutation.error && (
          <Alert variant="error">{extractError(mutation.error)}</Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nombre *"
            placeholder="Juan"
            error={form.formState.errors.firstName?.message}
            {...form.register('firstName')}
          />
          <Input
            label="Apellido *"
            placeholder="Pérez"
            error={form.formState.errors.lastName?.message}
            {...form.register('lastName')}
          />
        </div>

        <Input
          label="Email *"
          type="email"
          placeholder="juan@ejemplo.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Contraseña *"
            type="password"
            placeholder="••••••••"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <Input
            label="Confirmar Contraseña *"
            type="password"
            placeholder="••••••••"
            error={form.formState.errors.confirmPassword?.message}
            {...form.register('confirmPassword')}
          />
        </div>

        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <Shield className="w-3.5 h-3.5 inline mr-1" />
            La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y carácter especial.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Rol *"
            options={assignableRoles}
            placeholder="Seleccionar rol"
            error={form.formState.errors.role?.message}
            {...form.register('role')}
          />
          <Input
            label="Teléfono"
            placeholder="9931234567"
            error={form.formState.errors.phone?.message}
            {...form.register('phone')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            icon={<UserPlus className="w-4 h-4" />}
          >
            Crear Usuario
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────

function EditUserModal({
  open, onClose, user, currentUserRole, mutation,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  currentUserRole: UserRole;
  mutation: ReturnType<typeof useMutation<unknown, Error, { id: string; data: EditUserFormData }>>;
}) {
  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      role: user.role as UserRole,
    },
  });

  const assignableRoles = useMemo(() => getAssignableRoles(currentUserRole), [currentUserRole]);

  const onSubmit = (data: EditUserFormData) => {
    mutation.mutate({ id: user.id, data });
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar Usuario" size="md">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {mutation.error && (
          <Alert variant="error">{extractError(mutation.error)}</Alert>
        )}

        {/* User info card */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {getStatusBadge(user)}
              {user.emailVerified && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Mail className="w-3 h-3" /> Verificado
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nombre *"
            error={form.formState.errors.firstName?.message}
            {...form.register('firstName')}
          />
          <Input
            label="Apellido *"
            error={form.formState.errors.lastName?.message}
            {...form.register('lastName')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Rol *"
            options={assignableRoles}
            error={form.formState.errors.role?.message}
            {...form.register('role')}
          />
          <Input
            label="Teléfono"
            placeholder="9931234567"
            error={form.formState.errors.phone?.message}
            {...form.register('phone')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            icon={<Edit3 className="w-4 h-4" />}
          >
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Error extraction ─────────────────────────────────────────────────────

function extractError(error: unknown): string {
  if (!error) return 'Error desconocido';
  const err = error as { response?: { data?: { error?: { message?: string; details?: { fieldErrors?: { message: string }[] } } | string } } };
  const apiError = err?.response?.data?.error;
  if (typeof apiError === 'string') return apiError;
  if (apiError?.details?.fieldErrors?.[0]?.message) return apiError.details.fieldErrors[0].message;
  if (apiError?.message) return apiError.message;
  return 'Error al procesar la solicitud';
}
