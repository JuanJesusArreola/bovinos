// services/BovineVaccinationStatusService.ts
// ============================================================================
// BOVINE VACCINATION STATUS SERVICE
// ============================================================================
// Calcula y mantiene actualizado el cache denormalizado
// `BovineVaccinationStatus` para cada bovino. Lo usan:
//   - El listado de bovinos para filtrar por `vaccinationStatus`.
//   - El endpoint `GET /api/bovines/:id/vaccination-status` (lectura puntual).
//
// Reglas de cálculo (basadas en VaccinationStatus de Bovine.ts):
//   - NONE        → totalApplied = 0
//   - OVERDUE     → existe alguna vacuna con nextDueDate < now
//   - PENDING     → tiene vacunas pero ninguna con nextDueDate, O hay próximas
//                    pero no ha llegado a un esquema considerado "completo".
//   - UP_TO_DATE  → todas las vacunas tienen nextDueDate > now y no hay vencidas.
//
// El "esquema completo" no está parametrizado todavía (calendario base por
// raza/edad). Por ahora aplicamos heurística simple.
// ============================================================================

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';

import Vaccination from '../models/Vaccination';
import BovineVaccinationStatus, {
  VaccinationStatus,
} from '../models/BovineVaccinationStatus';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface VaccinationStatusSnapshot {
  bovineId: string;
  status: VaccinationStatus;
  lastVaccinationAt: Date | null;
  lastVaccineType: string | null;
  nextDueAt: Date | null;
  overdueCount: number;
  totalApplied: number;
  computedAt: Date;
}

// ============================================================================
// SERVICIO
// ============================================================================

export class BovineVaccinationStatusService {
  private readonly context = 'BovineVaccinationStatusService';

  /**
   * Recalcula el estado de vacunación de un bovino y persiste el snapshot.
   * Idempotente. Llamar después de crear/actualizar/borrar una vacuna.
   *
   * @param bovineId   ID del bovino
   * @param transaction transacción opcional (si forma parte de una mayor)
   */
  async recompute(bovineId: string, transaction?: Transaction): Promise<VaccinationStatusSnapshot> {
    try {
      const now = new Date();

      // Traer todas las vacunas activas del bovino
      const vaccinations = await Vaccination.findAll({
        where: { bovineId },
        attributes: ['vaccineType', 'applicationDate', 'nextDueDate'],
        order: [['applicationDate', 'DESC']],
        transaction,
      });

      const totalApplied = vaccinations.length;

      // Caso simple: nunca vacunado
      if (totalApplied === 0) {
        const snapshot = {
          bovineId,
          status: VaccinationStatus.NONE,
          lastVaccinationAt: null,
          lastVaccineType: null,
          nextDueAt: null,
          overdueCount: 0,
          totalApplied: 0,
          computedAt: now,
        };
        await this.upsert(snapshot, transaction);
        return snapshot;
      }

      // Última vacuna aplicada (cualquier tipo)
      const last = vaccinations[0];
      const lastVaccinationAt = (last as any).applicationDate as Date;
      const lastVaccineType = (last as any).vaccineType as string;

      // Para cada tipo distinto, considerar la vacuna MÁS RECIENTE
      // y evaluar su nextDueDate contra `now`.
      const latestPerType = new Map<string, { applicationDate: Date; nextDueDate: Date | null }>();
      for (const v of vaccinations) {
        const type = (v as any).vaccineType as string;
        const appDate = (v as any).applicationDate as Date;
        const due = ((v as any).nextDueDate as Date | null) ?? null;
        const existing = latestPerType.get(type);
        if (!existing || appDate > existing.applicationDate) {
          latestPerType.set(type, { applicationDate: appDate, nextDueDate: due });
        }
      }

      let overdueCount = 0;
      let nextDueAt: Date | null = null;
      let hasFutureSchedule = false;

      for (const { nextDueDate } of latestPerType.values()) {
        if (!nextDueDate) continue;
        if (nextDueDate < now) {
          overdueCount += 1;
        } else {
          hasFutureSchedule = true;
          if (!nextDueAt || nextDueDate < nextDueAt) {
            nextDueAt = nextDueDate;
          }
        }
      }

      // Determinar status:
      //   - OVERDUE   → al menos un tipo vencido
      //   - UP_TO_DATE → ninguno vencido y al menos un tipo con nextDueDate futura
      //   - PENDING   → tiene vacunas pero ninguna con nextDueDate (esquema indefinido / única)
      let status: VaccinationStatus;
      if (overdueCount > 0) {
        status = VaccinationStatus.OVERDUE;
      } else if (hasFutureSchedule) {
        status = VaccinationStatus.UP_TO_DATE;
      } else {
        status = VaccinationStatus.PENDING;
      }

      const snapshot: VaccinationStatusSnapshot = {
        bovineId,
        status,
        lastVaccinationAt,
        lastVaccineType,
        nextDueAt,
        overdueCount,
        totalApplied,
        computedAt: now,
      };

      await this.upsert(snapshot, transaction);
      return snapshot;
    } catch (error) {
      logger.error(
        `Error recalculando estado de vacunación para bovino ${bovineId}`,
        this.context,
        { bovineId },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Devuelve el snapshot actual del bovino. Si no existe, lo calcula y crea.
   */
  async get(bovineId: string): Promise<VaccinationStatusSnapshot> {
    const existing = await BovineVaccinationStatus.findByPk(bovineId);
    if (existing) {
      return this.toSnapshot(existing);
    }
    // No existe: calcular y crear
    return this.recompute(bovineId);
  }

  /**
   * Crea el registro con `status = NONE` para un bovino recién creado.
   * Llamar desde `BovineService.createBovine` (afterCreate hook o explicit).
   */
  async initializeForNewBovine(bovineId: string, transaction?: Transaction): Promise<void> {
    await BovineVaccinationStatus.upsert(
      {
        bovineId,
        status: VaccinationStatus.NONE,
        lastVaccinationAt: null,
        lastVaccineType: null,
        nextDueAt: null,
        overdueCount: 0,
        totalApplied: 0,
        computedAt: new Date(),
      } as any,
      { transaction }
    );
  }

  // ==========================================================================
  // INTERNOS
  // ==========================================================================

  private async upsert(snapshot: VaccinationStatusSnapshot, transaction?: Transaction): Promise<void> {
    await BovineVaccinationStatus.upsert(
      {
        bovineId: snapshot.bovineId,
        status: snapshot.status,
        lastVaccinationAt: snapshot.lastVaccinationAt,
        lastVaccineType: snapshot.lastVaccineType,
        nextDueAt: snapshot.nextDueAt,
        overdueCount: snapshot.overdueCount,
        totalApplied: snapshot.totalApplied,
        computedAt: snapshot.computedAt,
      } as any,
      { transaction }
    );
  }

  private toSnapshot(row: BovineVaccinationStatus): VaccinationStatusSnapshot {
    return {
      bovineId: row.bovineId,
      status: row.status,
      lastVaccinationAt: row.lastVaccinationAt ?? null,
      lastVaccineType: row.lastVaccineType ?? null,
      nextDueAt: row.nextDueAt ?? null,
      overdueCount: row.overdueCount,
      totalApplied: row.totalApplied,
      computedAt: row.computedAt,
    };
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const bovineVaccinationStatusService = new BovineVaccinationStatusService();
