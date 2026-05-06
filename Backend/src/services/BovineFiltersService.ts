// services/BovineFiltersService.ts
// ============================================================================
// BOVINE FILTERS SERVICE
// ============================================================================
// Provee catálogos para los dropdowns del frontend (vista de listado y
// formularios de creación/edición). Concentra los enums del modelo + las
// razas distintas obtenidas dinámicamente de la BD.
//
// Cache: in-memory con TTL 1h. Es seguro porque:
//   - El payload es pequeño (algunos cientos de bytes).
//   - Es idéntico para todos los usuarios (catálogo global).
//   - Si crece la flota a múltiples instancias, migrar a Redis (bloque 11).
//
// Invalidación: solo por TTL. Crear bovinos con razas nuevas se reflejará en
// el siguiente refresco. Si se necesita invalidación inmediata, exponer
// `bovineFiltersService.invalidate()` desde donde corresponda.
// ============================================================================

import { fn, col } from 'sequelize';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';

import Bovine, {
  CattleType,
  GenderType,
  HealthStatus,
  VaccinationStatus,
} from '../models/Bovine';
import { VaccineType, ApplicationRoute } from '../models/Vaccination';
import { cacheService } from './CacheService';

// ============================================================================
// TIPOS PÚBLICOS
// ============================================================================

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}

export interface BovineFilterOptions {
  cattleTypes: FilterOption<CattleType>[];
  genders: FilterOption<GenderType>[];
  healthStatuses: FilterOption<HealthStatus>[];
  vaccinationStatuses: FilterOption<VaccinationStatus>[];
  vaccineTypes: FilterOption<VaccineType>[];
  applicationRoutes: FilterOption<ApplicationRoute>[];
  breeds: string[];               // dinámico desde BD
  computedAt: Date;
  ttlSeconds: number;
}

// ============================================================================
// LABELS (locales en español)
// ============================================================================

const CATTLE_TYPE_LABELS: Record<CattleType, string> = {
  CATTLE: 'Ganado',
  BULL: 'Toro',
  COW: 'Vaca',
  CALF: 'Becerro',
};

const GENDER_LABELS: Record<GenderType, string> = {
  MALE: 'Macho',
  FEMALE: 'Hembra',
  UNKNOWN: 'Desconocido',
};

const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  HEALTHY: 'Saludable',
  SICK: 'Enfermo',
  RECOVERING: 'En recuperación',
  QUARANTINE: 'En cuarentena',
  DECEASED: 'Fallecido',
  UNKNOWN: 'Desconocido',
};

const VACCINATION_STATUS_LABELS: Record<VaccinationStatus, string> = {
  UP_TO_DATE: 'Al día',
  PENDING: 'Pendiente',
  OVERDUE: 'Vencida',
  NONE: 'Sin vacunar',
};

const VACCINE_TYPE_LABELS: Record<VaccineType, string> = {
  BRUCELLOSIS: 'Brucelosis',
  FOOT_AND_MOUTH: 'Fiebre aftosa',
  ANTHRAX: 'Carbunco (Ántrax)',
  RABIES: 'Rabia',
  BLACKLEG: 'Pierna negra',
  IBR: 'Rinotraqueítis (IBR)',
  BVD: 'Diarrea Viral Bovina (BVD)',
  LEPTOSPIROSIS: 'Leptospirosis',
  CLOSTRIDIAL: 'Clostridiales (polivalente)',
  PASTEURELLA: 'Pasteurella',
  TUBERCULOSIS: 'Tuberculosis',
  TETANUS: 'Tétanos',
  VIRAL_DIARRHEA: 'Diarrea viral',
  PARAINFLUENZA: 'Parainfluenza',
  RSV: 'Sincicial respiratorio (RSV)',
  OTHER: 'Otra',
};

const APPLICATION_ROUTE_LABELS: Record<ApplicationRoute, string> = {
  INTRAMUSCULAR: 'Intramuscular',
  SUBCUTANEOUS: 'Subcutánea',
  INTRANASAL: 'Intranasal',
  ORAL: 'Oral',
  INTRADERMAL: 'Intradérmica',
  OTHER: 'Otra',
};

// ============================================================================
// CACHE
// ============================================================================
// TTL 1h. Usa CacheService unificado (Redis con fallback a memoria).
// ============================================================================

const CACHE_KEY = 'bovine:filters:options';
const CACHE_TTL_SECONDS = 60 * 60; // 1 hora

// ============================================================================
// SERVICIO
// ============================================================================

export class BovineFiltersService {
  private readonly context = 'BovineFiltersService';

  /**
   * Devuelve el catálogo completo. Usa cache si está vigente.
   */
  async getFilterOptions(): Promise<BovineFilterOptions> {
    // Cache hit
    const cached = await cacheService.get<BovineFilterOptions>(CACHE_KEY);
    if (cached) {
      return cached;
    }

    try {
      // Razas distintas desde BD (solo bovinos activos / no soft-deleted)
      const breedRows = (await Bovine.findAll({
        attributes: [[fn('DISTINCT', col('breed')), 'breed']],
        where: { isActive: true } as any,
        order: [['breed', 'ASC']],
        raw: true,
      })) as any[];

      const breeds = breedRows
        .map((r) => r.breed as string | null)
        .filter((b): b is string => !!b && b.trim().length > 0);

      const data: BovineFilterOptions = {
        cattleTypes: this.toOptions(CattleType, CATTLE_TYPE_LABELS),
        genders: this.toOptions(GenderType, GENDER_LABELS),
        healthStatuses: this.toOptions(HealthStatus, HEALTH_STATUS_LABELS),
        vaccinationStatuses: this.toOptions(VaccinationStatus, VACCINATION_STATUS_LABELS),
        vaccineTypes: this.toOptions(VaccineType, VACCINE_TYPE_LABELS),
        applicationRoutes: this.toOptions(ApplicationRoute, APPLICATION_ROUTE_LABELS),
        breeds,
        computedAt: new Date(),
        ttlSeconds: CACHE_TTL_SECONDS,
      };

      await cacheService.set(CACHE_KEY, data, CACHE_TTL_SECONDS);

      logger.debug(
        `Catálogo de filtros recalculado (${breeds.length} razas)`,
        this.context
      );

      return data;
    } catch (error) {
      logger.error(
        'Error obteniendo catálogo de filtros de bovinos',
        this.context,
        {},
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Invalida el cache. Llamar cuando se sepa que una raza nueva se agregó
   * y se quiera ver de inmediato (opcional — el TTL hará el refresco solo).
   */
  async invalidate(): Promise<void> {
    await cacheService.del(CACHE_KEY);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private toOptions<T extends string>(
    enumObj: Record<string, T>,
    labels: Record<T, string>
  ): FilterOption<T>[] {
    return (Object.values(enumObj) as T[]).map((value) => ({
      value,
      label: labels[value] ?? value,
    }));
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const bovineFiltersService = new BovineFiltersService();
