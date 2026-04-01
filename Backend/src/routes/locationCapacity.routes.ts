// routes/locationCapacity.routes.ts
import { Router } from 'express';
import { locationCapacityController } from '../controllers/locationCapacity.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Rutas de consulta
router.get('/:locationId/capacity', locationCapacityController.getCapacity);
router.get('/:locationId/occupancy', locationCapacityController.getOccupancyPercentage);
router.get('/:locationId/at-capacity', locationCapacityController.isAtCapacity);
router.get('/:locationId/available', locationCapacityController.getAvailableCapacity);
router.get('/:locationId/stats', locationCapacityController.getCapacityStats);
router.get('/:locationId/recommend', locationCapacityController.recommendCapacityAdjustment);

// Rutas de modificación
router.post('/:locationId/increment', locationCapacityController.incrementAnimals);
router.post('/:locationId/decrement', locationCapacityController.decrementAnimals);
router.post('/:locationId/meets-requirements', locationCapacityController.meetsRequirements);

export default router;