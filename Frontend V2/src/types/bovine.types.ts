/**
 * Legacy types for the Bovinos module.
 *
 * NEW CODE should import from `@/types/bovine.dtos` directly. The DTOs there
 * are the canonical source of truth (mirrored from backend).
 *
 * This file keeps the legacy `Bovine`, `BovineFilters`, `BovineFormData`,
 * `BovineStatistics` exports as re-aliases of the DTO types so existing
 * pages keep compiling. Migrate callers progressively.
 */

import type {
  BovineDetailResponse,
  BovineFilters as BovineFiltersDTO,
  BovineStatistics as BovineStatisticsDTO,
  CreateBovineInput,
  CattleType,
  GenderType,
  HealthStatus,
  VaccinationStatus,
  LocationData,
} from './bovine.dtos';

// Re-export the enums so existing imports `from '@/types'` keep working.
export {
  CattleType,
  GenderType,
  HealthStatus,
  VaccinationStatus,
  ApplicationRoute,
  VaccineType,
} from './bovine.dtos';

/** @deprecated alias for BovineDetailResponse from `@/types/bovine.dtos`. */
export type Bovine = BovineDetailResponse;

/** @deprecated alias for the strict DTO. Use `BovineFilters` from dtos. */
export type BovineFilters = BovineFiltersDTO;

/** @deprecated alias for the strict DTO. */
export type BovineStatistics = BovineStatisticsDTO;

/**
 * @deprecated The legacy form payload accepts plain strings for enum fields
 * (cattleType, gender, healthStatus, vaccinationStatus) because the existing
 * `BovineFormPage` builds inputs with `<select value={string}>`. New code
 * should use `CreateBovineInput` (strict enums) and cast at the boundary.
 */
export interface BovineFormData {
  earTag: string;
  name?: string;
  cattleType: string;          // strict equivalent: CattleType
  breed: string;
  gender: string;              // strict equivalent: GenderType
  birthDate: string;
  weight?: number;
  notes?: string;
  ranchId?: string;
  /** GPS coords — optional. Omit the field entirely when not set. */
  location?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
  };
  ownerId?: string;
  healthStatus?: string;        // strict equivalent: HealthStatus
  vaccinationStatus?: string;   // strict equivalent: VaccinationStatus
  motherId?: string;
  fatherId?: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
}

/** @deprecated alias for the legacy enum. Use `CattleType`. */
export { CattleType as BovineType } from './bovine.dtos';

/** @deprecated alias. Use `GenderType`. */
export { GenderType as BovineSex } from './bovine.dtos';

/** @deprecated alias. Backend uses `BovineStatus` for actual status, but here
 *  we keep this for compat — for cattle workflow status use HealthStatus. */
export enum BovineStatus {
  ACTIVE      = 'ACTIVE',
  SOLD        = 'SOLD',
  DECEASED    = 'DECEASED',
  QUARANTINED = 'QUARANTINED',
  TRANSFERRED = 'TRANSFERRED',
}

// Re-export shared types
export type { LocationData };
