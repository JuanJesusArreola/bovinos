// controllers/location/locationCapacity.controller.ts
import { Request, Response } from 'express';
import { locationCapacityService } from '../services/location/LocationCapacityService';
import { LocationError } from '../utils/LocationErrors';
import logger from '../utils/logger';

export class LocationCapacityController {
  private readonly context = 'LocationCapacityController';

  async getCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const capacity = await locationCapacityService.getCapacity(locationId);
      res.json({ success: true, data: capacity });
    } catch (error) {
      logger.error('Error en getCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getOccupancyPercentage(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const percentage = await locationCapacityService.getOccupancyPercentage(locationId);
      res.json({ success: true, data: { percentage } });
    } catch (error) {
      logger.error('Error en getOccupancyPercentage', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async isAtCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const atCapacity = await locationCapacityService.isAtCapacity(locationId);
      res.json({ success: true, data: { atCapacity } });
    } catch (error) {
      logger.error('Error en isAtCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getAvailableCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const available = await locationCapacityService.getAvailableCapacity(locationId);
      res.json({ success: true, data: { available } });
    } catch (error) {
      logger.error('Error en getAvailableCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async incrementAnimals(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }
      const { locationId } = req.params;
      const { amount = 1 } = req.body;
      const capacity = await locationCapacityService.incrementAnimals(locationId, amount, userId);
      res.json({ success: true, data: capacity, message: `Animales incrementados en ${amount}` });
    } catch (error) {
      logger.error('Error en incrementAnimals', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async decrementAnimals(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }
      const { locationId } = req.params;
      const { amount = 1 } = req.body;
      const capacity = await locationCapacityService.decrementAnimals(locationId, amount, userId);
      res.json({ success: true, data: capacity, message: `Animales decrementados en ${amount}` });
    } catch (error) {
      logger.error('Error en decrementAnimals', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async meetsRequirements(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const requirements = req.body;
      const result = await locationCapacityService.meetsRequirements(locationId, requirements);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error en meetsRequirements', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getCapacityStats(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const stats = await locationCapacityService.getCapacityStats(locationId);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error en getCapacityStats', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async recommendCapacityAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const recommendation = await locationCapacityService.recommendCapacityAdjustment(locationId);
      res.json({ success: true, data: { recommendation } });
    } catch (error) {
      logger.error('Error en recommendCapacityAdjustment', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }
}

export const locationCapacityController = new LocationCapacityController();