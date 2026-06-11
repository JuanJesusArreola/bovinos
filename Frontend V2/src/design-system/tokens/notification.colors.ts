export const NOTIFICATION_COLORS = {
  ALERT: '#ef4444',
  INFO: '#3b82f6',
  SUCCESS: '#22c55e',
  WARNING: '#f59e0b',
} as const;

export const NOTIFICATION_LABELS = {
  ALERT: 'Alerta',
  INFO: 'Información',
  SUCCESS: 'Éxito',
  WARNING: 'Advertencia',
} as const;

export type NotificationTypeKey = keyof typeof NOTIFICATION_COLORS;

// ── Helpers defensivos ────────────────────────────────────────────────────
//
// El token usa MAYÚSCULAS (ALERT, INFO, ...). Algunos consumidores (toasts UI)
// usan minúsculas (error, info, ...). Los helpers aceptan ambos casos y
// mapean los aliases comunes hacia los keys canónicos.

const NOTIFICATION_TYPE_ALIAS: Record<string, NotificationTypeKey> = {
  alert:   'ALERT',
  error:   'ALERT',
  danger:  'ALERT',
  info:    'INFO',
  success: 'SUCCESS',
  ok:      'SUCCESS',
  warning: 'WARNING',
  warn:    'WARNING',
};

function resolveKey(input: string | undefined | null): NotificationTypeKey | null {
  if (!input) return null;
  const upper = input.toUpperCase();
  if (upper in NOTIFICATION_COLORS) return upper as NotificationTypeKey;
  return NOTIFICATION_TYPE_ALIAS[input.toLowerCase()] ?? null;
}

/** Devuelve el color hex del tipo de notificación, fallback INFO (azul). */
export function getNotificationColor(type: string | undefined | null): string {
  const k = resolveKey(type);
  if (!k) return NOTIFICATION_COLORS.INFO;
  return NOTIFICATION_COLORS[k];
}

/** Devuelve la etiqueta localizada del tipo de notificación. */
export function getNotificationLabel(type: string | undefined | null): string {
  const k = resolveKey(type);
  if (!k) return NOTIFICATION_LABELS.INFO;
  return NOTIFICATION_LABELS[k];
}