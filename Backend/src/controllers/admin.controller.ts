// src/controllers/admin.controller.ts
import { Request, Response } from 'express';
import { updateRanchProductionJob } from '../jobs/updateRanchProduction';
import logger from '../utils/logger';

export class AdminController {
  private readonly context = 'AdminController';

  /**
   * Dispara manualmente el job de actualización de producción.
   * Se ejecuta en segundo plano sin bloquear la respuesta.
   */
  async triggerProductionUpdate(req: Request, res: Response): Promise<void> {
    try {
      // Lanzar el job en segundo plano (no esperamos su finalización)
      updateRanchProductionJob().catch(err => {
        logger.error('Error en job ejecutado manualmente', this.context, { error: err });
      });

      res.status(202).json({
        success: true,
        message: 'Job de actualización de producción iniciado en segundo plano',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error al iniciar job manual', this.context, { error });
      res.status(500).json({
        success: false,
        error: 'Error interno al iniciar el job',
      });
    }
  }
}

export const adminController = new AdminController();