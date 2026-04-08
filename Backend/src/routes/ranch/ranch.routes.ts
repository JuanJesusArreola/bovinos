// routes/ranchCore.routes.ts
import { Router } from 'express';
import { ranchCoreController } from '../../controllers/ranch/ranch.controller';
import { authenticateToken } from '../../middleware/auth';
import { validateId } from '../../middleware/validation';
import { validateRanch } from '../../validators/ranch.validators';

const router = Router();

router.use(authenticateToken);

// Rutas CRUD
router.post('/', validateRanch('createRanch'), ranchCoreController.createRanch);
router.get('/', ranchCoreController.listRanches);
router.get('/:id', validateId('id'), ranchCoreController.getRanchById);
router.put('/:id', validateId('id'), validateRanch('updateRanch'), ranchCoreController.updateRanch);
router.delete('/:id', validateId('id'), ranchCoreController.deleteRanch);

// Métricas
router.get('/:id/occupancy', validateId('id'), ranchCoreController.getOccupancyRate);
router.get('/:id/available-capacity', validateId('id'), ranchCoreController.getAvailableCapacity);
router.get('/:id/at-capacity', validateId('id'), ranchCoreController.isAtCapacity);
router.get('/:id/cattle-density', validateId('id'), ranchCoreController.getCattleDensity);

// Resumen
router.get('/:id/summary', validateId('id'), ranchCoreController.getRanchSummary);

// Utilidades (etiquetas)
router.get('/type/:type/label', ranchCoreController.getRanchTypeLabel);
router.get('/status/:status/label', ranchCoreController.getStatusLabel);

export default router;