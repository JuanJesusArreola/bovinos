/**
 * Tipos de ganado — gradientes para avatares, emojis y labels.
 *
 * Antes vivía duplicado como `TYPE_GRADIENT` + `TYPE_EMOJI` en
 * `BovineDetailPage.tsx`. Espejea el enum `CattleType` de
 * `types/bovine.dtos.ts`.
 *
 * Los GRADIENTES son clases Tailwind ya formadas — se concatenan con
 * `bg-gradient-to-br` o equivalente en el consumidor. No usamos hex aquí
 * porque los avatares siempre se renderizan con utility classes (sin
 * `style={}` inline), así que el formato más útil es la clase Tailwind.
 */

export const CATTLE_TYPE_LABELS = {
  CATTLE: 'Ganado',
  BULL:   'Toro',
  COW:    'Vaca',
  CALF:   'Becerro',
} as const;

/** Gradientes Tailwind (sin el prefijo `bg-gradient-to-*` — eso lo añade
 *  el consumidor según la dirección que quiera). */
export const CATTLE_TYPE_GRADIENTS = {
  CATTLE: 'from-amber-400 to-orange-500',
  BULL:   'from-rose-500 to-red-700',
  COW:    'from-pink-400 to-rose-600',
  CALF:   'from-emerald-300 to-teal-500',
} as const;

/** Emoji representativo del tipo de ganado (para avatares cuando no hay foto). */
export const CATTLE_TYPE_EMOJI = {
  CATTLE: '🐄',
  BULL:   '🐂',
  COW:    '🐄',
  CALF:   '🐮',
} as const;

/** Gradiente fallback cuando el tipo no está mapeado (datos legacy o desconocidos). */
export const CATTLE_TYPE_GRADIENT_FALLBACK = 'from-gray-400 to-gray-600';
export const CATTLE_TYPE_EMOJI_FALLBACK = '🐄';

export type CattleTypeKey = keyof typeof CATTLE_TYPE_GRADIENTS;

/**
 * Resuelve el gradiente Tailwind para un tipo de ganado, con fallback gris.
 * @example
 *   const grad = getCattleTypeGradient(bovine.cattleType);
 *   // → 'from-emerald-300 to-teal-500' (para CALF)
 *   <div className={`bg-gradient-to-br ${grad}`} />
 */
export function getCattleTypeGradient(type: string | undefined | null): string {
  if (!type) return CATTLE_TYPE_GRADIENT_FALLBACK;
  return (CATTLE_TYPE_GRADIENTS as Record<string, string>)[type] ?? CATTLE_TYPE_GRADIENT_FALLBACK;
}

/** Resuelve el emoji del tipo, con fallback `🐄`. */
export function getCattleTypeEmoji(type: string | undefined | null): string {
  if (!type) return CATTLE_TYPE_EMOJI_FALLBACK;
  return (CATTLE_TYPE_EMOJI as Record<string, string>)[type] ?? CATTLE_TYPE_EMOJI_FALLBACK;
}
