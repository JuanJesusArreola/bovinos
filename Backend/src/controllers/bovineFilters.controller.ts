// controllers/bovineFilters.controller.ts
// ============================================================================
// BOVINE FILTERS CONTROLLER
// ============================================================================
// Endpoint:
//   GET /api/bovines/filters/options
// Devuelve los catálogos para llenar dropdowns del listado y formularios.
// ============================================================================

import { Request, Response } from 'express';
import { bovineFiltersService } from '../services/BovineFiltersService';
import logger from '../utils/logger';

export class BovineFiltersController {
  private readonly context = 'BovineFiltersController';

  constructor() {
    this.getFilterOptions = this.getFilterOptions.bind(this);
  }

  /**
   * GET /api/bovines/filters/options
   *
   * Response:
   * {
   *   success: true,
   *   data: {
   *     cattleTypes:  [{ value, label }, ...],
   *     genders:      [...],
   *     healthStatuses: [...],
   *     vaccinationStatuses: [...],
   *     vaccineTypes: [...],
   *     applicationRoutes: [...],
   *     breeds: ["Holstein", "Angus", ...],
   *     computedAt: ISO,
   *     ttlSeconds: 3600
   *   }
   * }
   */
  async getFilterOptions(_req: Request, res: Response): Promise<void> {
    try {
      const data = await bovineFiltersService.getFilterOptions();
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getFilterOptions', this.context, {}, error as Error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo catálogo de filtros',
      });
    }
  }
}

export const bovineFiltersController = new BovineFiltersController();
