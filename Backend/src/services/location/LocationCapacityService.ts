// services/location/LocationCapacityService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { LocationNotFoundError, CapacityError, CapacityLimitExceededError, CapacityNegativeError } from '../../utils/LocationErrors';
import { ensureError } from '../../utils/errorUtils';

import Location from '../../models/Location';
import LocationCapacity from '../../models/LocationCapacity';
import Bovine from '../../models/Bovine';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CapacityInfo {
  locationId: string;
  locationName?: string;
  maxAnimals: number;
  currentAnimals: number;
  available: number;
  occupancyPercentage: number;
  isFull: boolean;
  areaHa: number; // área en hectáreas
  carryingCapacity: number; // animales por hectárea
  waterSources: number;
  feedingStations: number;
  shelters: number;
  hasElectricity: boolean;
  hasWater: boolean;
  hasInternet: boolean;
  hasRoadAccess: boolean;
  securityLevel: string;
}

export interface CapacityStats extends CapacityInfo {
  recommendation?: string;
  lastUpdated: Date;
  updatedBy: string;
}

export interface Requirements {
  minAreaHa?: number;
  minWaterSources?: number;
  minFeedingStations?: number;
  minShelters?: number;
  requiresElectricity?: boolean;
  requiresWater?: boolean;
  requiresInternet?: boolean;
  requiresRoadAccess?: boolean;
  securityLevel?: string;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class LocationCapacityService {
  private readonly context = 'LocationCapacityService';

  /**
   * Obtiene la capacidad de una ubicación.
   */
  async getCapacity(locationId: string): Promise<LocationCapacity> {
    try {
      const capacity = await LocationCapacity.findByPk(locationId);
      if (!capacity) {
        throw new CapacityError(`No hay información de capacidad para la ubicación ${locationId}`);
      }
      return capacity;
    } catch (error) {
      logger.error(`Error obteniendo capacidad para ubicación ${locationId}`, this.context, { locationId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Obtiene el porcentaje de ocupación.
   */
  async getOccupancyPercentage(locationId: string): Promise<number> {
    const capacity = await this.getCapacity(locationId);
    if (capacity.maxAnimals === 0) return 0;
    return (capacity.currentAnimals / capacity.maxAnimals) * 100;
  }

  /**
   * Verifica si la ubicación está a máxima capacidad.
   */
  async isAtCapacity(locationId: string): Promise<boolean> {
    const capacity = await this.getCapacity(locationId);
    return capacity.currentAnimals >= capacity.maxAnimals;
  }

  /**
   * Obtiene la capacidad disponible (animales que aún pueden entrar).
   */
  async getAvailableCapacity(locationId: string): Promise<number> {
    const capacity = await this.getCapacity(locationId);
    return Math.max(0, capacity.maxAnimals - capacity.currentAnimals);
  }

  /**
   * Incrementa el contador de animales en una ubicación.
   * @param locationId ID de la ubicación
   * @param amount Cantidad a incrementar (default 1)
   * @param userId ID del usuario que realiza la operación
   * @param transaction Transacción opcional
   */
  async incrementAnimals(
    locationId: string,
    amount: number = 1,
    userId: string,
    transaction?: Transaction
  ): Promise<LocationCapacity> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      // Usar row lock para evitar condiciones de carrera
      const capacity = await LocationCapacity.findOne({
        where: { locationId },
        lock: isOwnTransaction ? t.LOCK.UPDATE : undefined,
        transaction: t,
      });
      if (!capacity) {
        throw new CapacityError(`No hay información de capacidad para la ubicación ${locationId}`);
      }

      const newCurrent = capacity.currentAnimals + amount;
      if (newCurrent > capacity.maxAnimals) {
        throw new CapacityLimitExceededError(locationId, newCurrent, capacity.maxAnimals);
      }
      if (newCurrent < 0) {
        throw new CapacityNegativeError(locationId, newCurrent);
      }

      capacity.currentAnimals = newCurrent;
      capacity.lastUpdated = new Date();
      capacity.updatedBy = userId;
      await capacity.save({ transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Incremento de animales en ubicación ${locationId}: +${amount} → ${newCurrent}`, this.context, {
        locationId,
        amount,
        userId,
        durationMs: Date.now() - startTime,
      });

      return capacity;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error incrementando animales en ubicación ${locationId}`, this.context, { locationId, amount }, ensureError(error));
      throw error;
    }
  }

  /**
   * Decrementa el contador de animales en una ubicación.
   */
  async decrementAnimals(
    locationId: string,
    amount: number = 1,
    userId: string,
    transaction?: Transaction
  ): Promise<LocationCapacity> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const capacity = await LocationCapacity.findOne({
        where: { locationId },
        lock: isOwnTransaction ? t.LOCK.UPDATE : undefined,
        transaction: t,
      });
      if (!capacity) {
        throw new CapacityError(`No hay información de capacidad para la ubicación ${locationId}`);
      }

      const newCurrent = capacity.currentAnimals - amount;
      if (newCurrent < 0) {
        throw new CapacityNegativeError(locationId, newCurrent);
      }

      capacity.currentAnimals = newCurrent;
      capacity.lastUpdated = new Date();
      capacity.updatedBy = userId;
      await capacity.save({ transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Decremento de animales en ubicación ${locationId}: -${amount} → ${newCurrent}`, this.context, {
        locationId,
        amount,
        userId,
        durationMs: Date.now() - startTime,
      });

      return capacity;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error decrementando animales en ubicación ${locationId}`, this.context, { locationId, amount }, ensureError(error));
      throw error;
    }
  }

  /**
   * Verifica si una ubicación cumple con los requisitos mínimos.
   * @param locationId ID de la ubicación
   * @param requirements Requisitos a verificar
   */
  async meetsRequirements(locationId: string, requirements: Requirements): Promise<{ meets: boolean; missing: string[] }> {
    const capacity = await this.getCapacity(locationId);
    const missing: string[] = [];

    if (requirements.minAreaHa !== undefined) {
      const areaHa = this.convertToHa(capacity.area, capacity.areaUnit);
      if (areaHa < requirements.minAreaHa) missing.push(`Área mínima requerida: ${requirements.minAreaHa} ha (actual: ${areaHa} ha)`);
    }
    if (requirements.minWaterSources !== undefined && capacity.waterSources < requirements.minWaterSources) {
      missing.push(`Fuentes de agua mínimas: ${requirements.minWaterSources} (actual: ${capacity.waterSources})`);
    }
    if (requirements.minFeedingStations !== undefined && capacity.feedingStations < requirements.minFeedingStations) {
      missing.push(`Estaciones de alimentación mínimas: ${requirements.minFeedingStations} (actual: ${capacity.feedingStations})`);
    }
    if (requirements.minShelters !== undefined && capacity.shelters < requirements.minShelters) {
      missing.push(`Refugios mínimos: ${requirements.minShelters} (actual: ${capacity.shelters})`);
    }
    if (requirements.requiresElectricity && !capacity.hasElectricity) missing.push('Requiere electricidad');
    if (requirements.requiresWater && !capacity.hasWater) missing.push('Requiere acceso a agua');
    if (requirements.requiresInternet && !capacity.hasInternet) missing.push('Requiere internet');
    if (requirements.requiresRoadAccess && !capacity.hasRoadAccess) missing.push('Requiere acceso por carretera');
    if (requirements.securityLevel && capacity.securityLevel !== requirements.securityLevel) {
      missing.push(`Nivel de seguridad: requiere ${requirements.securityLevel} (actual: ${capacity.securityLevel})`);
    }

    return { meets: missing.length === 0, missing };
  }

  /**
   * Obtiene estadísticas completas de capacidad.
   */
  async getCapacityStats(locationId: string): Promise<CapacityStats> {
    try {
      const capacity = await this.getCapacity(locationId);
      const location = await Location.findByPk(locationId, { attributes: ['id', 'name'] });
      const areaHa = this.convertToHa(capacity.area, capacity.areaUnit);
      const maxAnimals = capacity.maxAnimals;
      const currentAnimals = capacity.currentAnimals;
      const available = Math.max(0, maxAnimals - currentAnimals);
      const occupancyPercentage = maxAnimals === 0 ? 0 : (currentAnimals / maxAnimals) * 100;
      const isFull = currentAnimals >= maxAnimals;

      // Calcular recomendación simple
      let recommendation: string | undefined;
      if (occupancyPercentage > 90) {
        recommendation = 'Ocupación muy alta. Considere aumentar capacidad máxima o reducir animales.';
      } else if (occupancyPercentage < 20 && maxAnimals > 0) {
        recommendation = 'Ocupación baja. Podría reducir capacidad máxima para optimizar recursos.';
      } else {
        recommendation = 'Ocupación adecuada.';
      }

      const stats: CapacityStats = {
        locationId,
        locationName: location?.name,
        maxAnimals,
        currentAnimals,
        available,
        occupancyPercentage,
        isFull,
        areaHa,
        carryingCapacity: capacity.carryingCapacity,
        waterSources: capacity.waterSources,
        feedingStations: capacity.feedingStations,
        shelters: capacity.shelters,
        hasElectricity: capacity.hasElectricity,
        hasWater: capacity.hasWater,
        hasInternet: capacity.hasInternet,
        hasRoadAccess: capacity.hasRoadAccess,
        securityLevel: capacity.securityLevel,
        recommendation,
        lastUpdated: capacity.lastUpdated,
        updatedBy: capacity.updatedBy,
      };
      return stats;
    } catch (error) {
      logger.error(`Error obteniendo estadísticas de capacidad para ubicación ${locationId}`, this.context, { locationId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Recomienda ajustes de capacidad basados en métricas.
   * Por ahora, solo devuelve una recomendación textual.
   */
  async recommendCapacityAdjustment(locationId: string): Promise<string> {
    const stats = await this.getCapacityStats(locationId);
    return stats.recommendation || 'No se requiere ajuste.';
  }

  // ==========================================================================
  // Métodos auxiliares
  // ==========================================================================

  private convertToHa(area: number, unit: string): number {
    if (unit === 'HA') return area;
    if (unit === 'M2') return area / 10000;
    if (unit === 'ACRE') return area * 0.404686;
    return area;
  }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const locationCapacityService = new LocationCapacityService();