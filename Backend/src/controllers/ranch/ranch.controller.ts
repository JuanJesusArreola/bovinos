// controllers/ranch/ranchCore.controller.ts
import { Request, Response } from 'express';
import { ranchCoreService } from '../../services/ranch/RanchService';
import { RanchError } from '../../utils/RanchErrors';
import logger from '../../utils/logger';

export class RanchCoreController {
  private readonly context = 'RanchCoreController';

  async createRanch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const ranch = await ranchCoreService.createRanch({
        ...req.body,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: ranch,
        message: 'Rancho creado exitosamente',
      });
    } catch (error) {
      logger.error('Error en createRanch', this.context, { body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async updateRanch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      const ranch = await ranchCoreService.updateRanch({
        id,
        ...req.body,
        updatedBy: userId,
      });

      res.json({
        success: true,
        data: ranch,
        message: 'Rancho actualizado',
      });
    } catch (error) {
      logger.error('Error en updateRanch', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async deleteRanch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      await ranchCoreService.deleteRanch(id, userId);

      res.json({ success: true, message: 'Rancho eliminado' });
    } catch (error) {
      logger.error('Error en deleteRanch', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getRanchById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const ranch = await ranchCoreService.getRanchById(id);
      if (!ranch) {
        res.status(404).json({ success: false, error: 'Rancho no encontrado' });
        return;
      }
      res.json({ success: true, data: ranch });
    } catch (error) {
      logger.error('Error en getRanchById', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async listRanches(req: Request, res: Response): Promise<void> {
    try {
      const { type, status, isActive, searchTerm, limit, offset } = req.query;

      const filters: any = {};
      if (type) filters.type = (type as string).split(',') as any;
      if (status) filters.status = (status as string).split(',') as any;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (searchTerm) filters.searchTerm = searchTerm as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const result = await ranchCoreService.listRanches(filters);
      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total: result.count,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
        },
      });
    } catch (error) {
      logger.error('Error en listRanches', this.context, { query: req.query }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getOccupancyRate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rate = await ranchCoreService.getOccupancyRate(id);
      res.json({ success: true, data: { occupancyRate: rate } });
    } catch (error) {
      logger.error('Error en getOccupancyRate', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getAvailableCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const capacity = await ranchCoreService.getAvailableCapacity(id);
      res.json({ success: true, data: { availableCapacity: capacity } });
    } catch (error) {
      logger.error('Error en getAvailableCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async isAtCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const atCapacity = await ranchCoreService.isAtCapacity(id);
      res.json({ success: true, data: { atCapacity } });
    } catch (error) {
      logger.error('Error en isAtCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getCattleDensity(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const density = await ranchCoreService.getCattleDensity(id);
      res.json({ success: true, data: { cattleDensity: density } });
    } catch (error) {
      logger.error('Error en getCattleDensity', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getRanchTypeLabel(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      const label = ranchCoreService.getRanchTypeLabel(type as any);
      res.json({ success: true, data: { type, label } });
    } catch (error) {
      logger.error('Error en getRanchTypeLabel', this.context, { params: req.params }, error as Error);
      res.status(500).json({ success: false, error: 'Error interno' });
    }
  }

  async getStatusLabel(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.params;
      const label = ranchCoreService.getStatusLabel(status as any);
      res.json({ success: true, data: { status, label } });
    } catch (error) {
      logger.error('Error en getStatusLabel', this.context, { params: req.params }, error as Error);
      res.status(500).json({ success: false, error: 'Error interno' });
    }
  }

  async getRanchSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const summary = await ranchCoreService.getRanchSummary(id);
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('Error en getRanchSummary', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno' });
      }
    }
  }
}

export const ranchCoreController = new RanchCoreController();