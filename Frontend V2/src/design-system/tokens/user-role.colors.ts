export const USER_ROLE_COLORS = {
  SUPER_ADMIN: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    bgDark: 'dark:bg-purple-900/30',
    textDark: 'dark:text-purple-400',
  },
  OWNER: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    bgDark: 'dark:bg-blue-900/30',
    textDark: 'dark:text-blue-400',
  },
  RANCH_MANAGER: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    bgDark: 'dark:bg-indigo-900/30',
    textDark: 'dark:text-indigo-400',
  },
  MANAGER: {
    bg: 'bg-sky-100',
    text: 'text-sky-800',
    bgDark: 'dark:bg-sky-900/30',
    textDark: 'dark:text-sky-400',
  },
  VETERINARIAN: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    bgDark: 'dark:bg-emerald-900/30',
    textDark: 'dark:text-emerald-400',
  },
  WORKER: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    bgDark: 'dark:bg-amber-900/30',
    textDark: 'dark:text-amber-400',
  },
  VIEWER: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    bgDark: 'dark:bg-gray-800',
    textDark: 'dark:text-gray-400',
  },
} as const;

export type UserRoleKey = keyof typeof USER_ROLE_COLORS;

/**
 * Devuelve el `className` completo (light + dark) para un Badge de rol.
 * Centraliza la composición que antes vivía hardcodeada en `permissions.ts`.
 *
 * @example
 *   <span className={getRoleClassName('OWNER')}>Owner</span>
 *   // → "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
 */
export function getRoleClassName(role: UserRoleKey | string): string {
  const cfg = USER_ROLE_COLORS[role as UserRoleKey];
  if (!cfg) return 'bg-gray-100 text-gray-800';
  return `${cfg.bg} ${cfg.text} ${cfg.bgDark} ${cfg.textDark}`;
}