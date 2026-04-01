// src/routes/admin.routes.ts
import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/role';
import { UserRole } from '../models/User';

const router = Router();

/**
 * POST /admin/jobs/update-production
 * Dispara manualmente el job de actualización de producción.
 * Requiere autenticación y rol de OWNER o SUPER_ADMIN.
 */
router.post(
  '/jobs/update-production',
  authenticateToken,
  requireMinimumRole(UserRole.OWNER), // o UserRole.SUPER_ADMIN según tu jerarquía
  adminController.triggerProductionUpdate
);

export default router;