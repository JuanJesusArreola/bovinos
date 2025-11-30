import { Router, Request, Response } from 'express';
import {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  requireActiveSubscription,
  generateToken,
  mockUserDatabase
} from '../middleware/auth';
import { validate, sanitizeInput, validateId } from '../middleware/validation';
import { createRateLimit, EndpointType } from '../middleware/rate-limit';
import { requestLogger, auditTrail } from '../middleware/logging';
import { UserRole } from '../models/User';
import {AuthController} from '../controllers/auth';

// Crear instancia del router
const router = Router();

const authController = new AuthController();

// Aplicar middleware global para todas las rutas de auth
router.use(requestLogger); // Logging de todas las requests
router.use(sanitizeInput); // Sanitización de input

// ============================================================================
// RUTAS PÚBLICAS (No requieren autenticación)
// ============================================================================

/**
 * @route   POST /auth/login
 * @desc    Iniciar sesión de usuario con email y contraseña
 * @access  Public
 * @body    { email: string, password: string, rememberMe?: boolean }
 */
router.post(
  '/login', authController.login);

/**
 * @route   POST /auth/register
 * @desc    Registrar nuevo usuario en el sistema
 * @access  Public
 * @body    { firstName: string, lastName: string, email: string, password: string, confirmPassword: string, phone?: string, role?: string }
 */
router.post(
  '/register',
  createRateLimit(EndpointType.AUTH),
  validate('search'), // Usando esquema disponible como placeholder
  auditTrail('CREATE', 'USER'),
  authController.register  
);

/**
 * @route   POST /auth/forgot-password
 * @desc    Solicitar restablecimiento de contraseña
 * @access  Public
 * @body    { email: string }
 */
router.post(
  '/forgot-password',
  createRateLimit(EndpointType.AUTH),
  validate('search'),
  authController.forgotPassword
);

/**
 * @route   POST /auth/reset-password
 * @desc    Restablecer contraseña con token de verificación
 * @access  Public
 * @body    { token: string, password: string, confirmPassword: string }
 */
router.post(
  '/reset-password',
  createRateLimit(EndpointType.AUTH),
  validate('search'),
  authController.resetPassword
);

/**
 * @route   POST /auth/verify-email
 * @desc    Verificar email con token de verificación
 * @access  Public
 * @body    { token: string }
 */
router.post(
  '/verify-email',
  createRateLimit(EndpointType.AUTH),
  authController.verifyEmail
);

/**
 * @route   POST /auth/refresh
 * @desc    Refrescar token de acceso usando refresh token
 * @access  Public
 * @body    { refreshToken: string }
 */
router.post(
  '/refresh',
  createRateLimit(EndpointType.AUTH),
  authController.refreshToken
);

// ============================================================================
// RUTAS PROTEGIDAS (Requieren autenticación)
// ============================================================================

/**
 * @route   POST /auth/logout
 * @desc    Cerrar sesión del usuario y invalidar tokens
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.post(
  '/logout',
  auditTrail('DELETE', 'AUTH_SESSION'),
  authenticateToken, authController.logout
);

/**
 * @route   GET /auth/profile
 * @desc    Obtener perfil del usuario autenticado
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get(
  '/profile',
  auditTrail('READ', 'USER_PROFILE'),
  authenticateToken, authController.getProfile
);

/**
 * @route   PUT /auth/profile
 * @desc    Actualizar perfil del usuario autenticado
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    { firstName?: string, lastName?: string, phone?: string }
 */
router.put(
  '/profile',
  authenticateToken,
  validate('search'), // Usar esquema apropiado cuando esté disponible
  auditTrail('UPDATE', 'USER_PROFILE'),
  authController.updateProfile
);

/**
 * @route   POST /auth/change-password
 * @desc    Cambiar contraseña del usuario autenticado
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    { currentPassword: string, newPassword: string, confirmPassword: string }
 */
router.post(
  '/change-password',
  authenticateToken,
  createRateLimit(EndpointType.AUTH),
  validate('search'), // Usar esquema apropiado cuando esté disponible
  auditTrail('UPDATE', 'USER_PASSWORD'),
  authController.changePassword
);

/**
 * @route   DELETE /auth/account
 * @desc    Eliminar cuenta del usuario autenticado
 * @access  Private
 * @headers Authorization: Bearer <token>
 * @body    { password: string, confirmation: string }
 */
router.delete(
  '/account',
  authenticateToken,
  createRateLimit(EndpointType.AUTH),
  auditTrail('DELETE', 'USER_ACCOUNT'),
  authController.deleteAccount
);

// ============================================================================
// RUTAS ADMINISTRATIVAS (Requieren rol específico)
// ============================================================================

/**
 * @route   GET /auth/users
 * @desc    Obtener lista de usuarios (solo administradores)
 * @access  Private (Admin only)
 * @headers Authorization: Bearer <token>
 * @query   ?page=1&limit=10&search=term&role=ADMIN&status=active
 */
router.get(
  '/users',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
  validate('search'),
  auditTrail('READ', 'USER_LIST'),
  async (req: Request, res: Response) => {
    try {
      // TODO: Implementar lógica de listado de usuarios
      // const { page = 1, limit = 10, search, role, status } = req.query;

      res.status(200).json({
        success: true,
        message: 'Usuarios obtenidos exitosamente',
        data: {
          // users: usersList,
          // pagination: paginationInfo
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuarios',
        error: 'USERS_FETCH_FAILED'
      });
    }
  }
);

/**
 * @route   PUT /auth/users/:userId/role
 * @desc    Actualizar rol de un usuario (solo administradores)
 * @access  Private (Admin only)
 * @headers Authorization: Bearer <token>
 * @body    { role: string }
 */
router.put(
  '/users/:userId/role',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
  validateId('userId'),
  auditTrail('UPDATE', 'USER_ROLE'),
  async (req: Request, res: Response) => {
    try {
      // TODO: Implementar lógica de actualización de rol
      // const { userId } = req.params;
      // const { role } = req.body;

      res.status(200).json({
        success: true,
        message: 'Rol de usuario actualizado exitosamente'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error al actualizar rol',
        error: 'ROLE_UPDATE_FAILED'
      });
    }
  }
);

/**
 * @route   PUT /auth/users/:userId/status
 * @desc    Activar/desactivar usuario (solo administradores)
 * @access  Private (Admin only)
 * @headers Authorization: Bearer <token>
 * @body    { status: 'active' | 'inactive' | 'suspended' }
 */
router.put(
  '/users/:userId/status',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
  validateId('userId'),
  auditTrail('UPDATE', 'USER_STATUS'),
  async (req: Request, res: Response) => {
    try {
      // TODO: Implementar lógica de actualización de estatus
      // const { userId } = req.params;
      // const { status } = req.body;

      res.status(200).json({
        success: true,
        message: 'Estatus de usuario actualizado exitosamente'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error al actualizar estatus',
        error: 'STATUS_UPDATE_FAILED'
      });
    }
  }
);

// ============================================================================
// RUTAS DE UTILIDAD
// ============================================================================

/**
 * @route   GET /auth/me
 * @desc    Verificar si el token es válido y obtener datos del usuario
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.get(
  '/me',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Usuario autenticado',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.personalInfo.firstName,
            lastName: user.personalInfo.lastName,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.emailVerified,
            lastLoginAt: user.lastLoginAt
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al verificar usuario',
        error: 'USER_VERIFICATION_FAILED'
      });
    }
  }
);

/**
 * @route   POST /auth/resend-verification
 * @desc    Reenviar email de verificación
 * @access  Private
 * @headers Authorization: Bearer <token>
 */
router.post(
  '/resend-verification',
  authenticateToken,
  createRateLimit(EndpointType.AUTH),
  async (req: Request, res: Response) => {
    try {
      // TODO: Implementar reenvío de email de verificación

      res.status(200).json({
        success: true,
        message: 'Email de verificación enviado'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error al enviar email de verificación',
        error: 'VERIFICATION_EMAIL_FAILED'
      });
    }
  }
);

/**
 * @route   POST /auth/check-email
 * @desc    Verificar si un email ya está registrado
 * @access  Public
 * @body    { email: string }
 */
router.post(
  '/check-email',
  createRateLimit(EndpointType.AUTH),
  async (req: Request, res: Response) => {
    try {
      // TODO: Implementar verificación de email
      // const { email } = req.body;

      res.status(200).json({
        success: true,
        message: 'Email verificado',
        data: {
          available: true // o false si ya existe
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error al verificar email',
        error: 'EMAIL_CHECK_FAILED'
      });
    }
  }
);

// ============================================================================
// MANEJO DE ERRORES ESPECÍFICOS PARA RUTAS DE AUTH
// ============================================================================

/**
 * Middleware de manejo de errores específico para autenticación
 */
router.use((error: any, req: Request, res: Response, next: any) => {
  // Log del error para debugging
  console.error('Auth Route Error:', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Errores específicos de autenticación
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
      error: 'INVALID_TOKEN'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado',
      error: 'TOKEN_EXPIRED'
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      error: 'VALIDATION_ERROR',
      details: error.details
    });
  }

  // Error genérico
  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: 'INTERNAL_SERVER_ERROR'
  });
});

export default router;