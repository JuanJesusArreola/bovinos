"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rate_limit_1 = require("../middleware/rate-limit");
const logging_1 = require("../middleware/logging");
const router = (0, express_1.Router)();
router.use(logging_1.requestLogger);
router.use(validation_1.sanitizeInput);
router.post('/login', (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), (0, validation_1.validate)('search'), (0, logging_1.auditTrail)('CREATE', 'AUTH_SESSION'), async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son requeridos',
                error: 'MISSING_CREDENTIALS'
            });
        }
        const userId = 'user_' + Date.now();
        const mockUser = {
            id: userId,
            email: email,
            firstName: 'Usuario',
            lastName: 'Prueba',
            role: auth_1.UserRole.ADMIN,
            isActive: true,
            isEmailVerified: true,
            lastLoginAt: new Date()
        };
        auth_1.mockUserDatabase[userId] = mockUser;
        const realToken = (0, auth_1.generateToken)(userId, email, auth_1.UserRole.ADMIN);
        res.status(200).json({
            success: true,
            message: 'Login exitoso',
            data: {
                user: mockUser,
                accessToken: realToken,
                refreshToken: 'mock_refresh_token_' + Date.now(),
                expiresIn: 3600
            }
        });
    }
    catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: 'INTERNAL_ERROR'
        });
    }
});
router.post('/register', (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), (0, validation_1.validate)('search'), (0, logging_1.auditTrail)('CREATE', 'USER'), async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword, phone, role } = req.body;
        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos',
                error: 'MISSING_FIELDS'
            });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Las contraseñas no coinciden',
                error: 'PASSWORD_MISMATCH'
            });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de email inválido',
                error: 'INVALID_EMAIL'
            });
        }
        const mockUser = {
            id: 'user_' + Date.now(),
            email: email,
            firstName: firstName,
            lastName: lastName,
            phone: phone || null,
            role: role || 'USER',
            isActive: true,
            emailVerified: false,
            createdAt: new Date().toISOString()
        };
        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente. Verifique su email.',
            data: {
                userId: mockUser.id,
                email: mockUser.email,
                user: mockUser
            }
        });
    }
    catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: 'INTERNAL_ERROR'
        });
    }
});
router.post('/forgot-password', (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), (0, validation_1.validate)('search'), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Si el email existe, recibirá instrucciones para restablecer su contraseña'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al procesar solicitud',
            error: 'FORGOT_PASSWORD_FAILED'
        });
    }
});
router.post('/reset-password', (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), (0, validation_1.validate)('search'), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Contraseña restablecida exitosamente'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Token inválido o expirado',
            error: 'INVALID_RESET_TOKEN'
        });
    }
});
router.post('/verify-email', (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Email verificado exitosamente'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Token de verificación inválido',
            error: 'INVALID_VERIFICATION_TOKEN'
        });
    }
});
router.post('/refresh', (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Token refrescado exitosamente',
            data: {}
        });
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: 'Refresh token inválido',
            error: 'INVALID_REFRESH_TOKEN'
        });
    }
});
router.post('/logout', auth_1.authenticateToken, (0, logging_1.auditTrail)('DELETE', 'AUTH_SESSION'), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Sesión cerrada exitosamente'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al cerrar sesión',
            error: 'LOGOUT_FAILED'
        });
    }
});
router.get('/profile', auth_1.authenticateToken, (0, logging_1.auditTrail)('READ', 'USER_PROFILE'), async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado',
                error: 'USER_NOT_FOUND'
            });
        }
        const { ...safeUserData } = user;
        res.status(200).json({
            success: true,
            message: 'Perfil obtenido exitosamente',
            data: {
                user: safeUserData
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener perfil',
            error: 'PROFILE_FETCH_FAILED'
        });
    }
});
router.put('/profile', auth_1.authenticateToken, (0, validation_1.validate)('search'), (0, logging_1.auditTrail)('UPDATE', 'USER_PROFILE'), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Perfil actualizado exitosamente',
            data: {}
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al actualizar perfil',
            error: 'PROFILE_UPDATE_FAILED'
        });
    }
});
router.post('/change-password', auth_1.authenticateToken, (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), (0, validation_1.validate)('search'), (0, logging_1.auditTrail)('UPDATE', 'USER_PASSWORD'), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Contraseña cambiada exitosamente'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al cambiar contraseña',
            error: 'PASSWORD_CHANGE_FAILED'
        });
    }
});
router.delete('/account', auth_1.authenticateToken, (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), (0, logging_1.auditTrail)('DELETE', 'USER_ACCOUNT'), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Cuenta eliminada exitosamente'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al eliminar cuenta',
            error: 'ACCOUNT_DELETION_FAILED'
        });
    }
});
router.get('/users', auth_1.authenticateToken, (0, auth_1.authorizeRoles)(auth_1.UserRole.ADMIN, auth_1.UserRole.OWNER), (0, validation_1.validate)('search'), (0, logging_1.auditTrail)('READ', 'USER_LIST'), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Usuarios obtenidos exitosamente',
            data: {}
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios',
            error: 'USERS_FETCH_FAILED'
        });
    }
});
router.put('/users/:userId/role', auth_1.authenticateToken, (0, auth_1.authorizeRoles)(auth_1.UserRole.ADMIN, auth_1.UserRole.OWNER), (0, validation_1.validateId)('userId'), (0, logging_1.auditTrail)('UPDATE', 'USER_ROLE'), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Rol de usuario actualizado exitosamente'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al actualizar rol',
            error: 'ROLE_UPDATE_FAILED'
        });
    }
});
router.put('/users/:userId/status', auth_1.authenticateToken, (0, auth_1.authorizeRoles)(auth_1.UserRole.ADMIN, auth_1.UserRole.OWNER), (0, validation_1.validateId)('userId'), (0, logging_1.auditTrail)('UPDATE', 'USER_STATUS'), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Estatus de usuario actualizado exitosamente'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al actualizar estatus',
            error: 'STATUS_UPDATE_FAILED'
        });
    }
});
router.get('/me', auth_1.authenticateToken, async (req, res) => {
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
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    isActive: user.isActive,
                    isEmailVerified: user.isEmailVerified,
                    lastLoginAt: user.lastLoginAt,
                    farm: user.farm
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al verificar usuario',
            error: 'USER_VERIFICATION_FAILED'
        });
    }
});
router.post('/resend-verification', auth_1.authenticateToken, (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Email de verificación enviado'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al enviar email de verificación',
            error: 'VERIFICATION_EMAIL_FAILED'
        });
    }
});
router.post('/check-email', (0, rate_limit_1.createRateLimit)(rate_limit_1.EndpointType.AUTH), async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Email verificado',
            data: {
                available: true
            }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al verificar email',
            error: 'EMAIL_CHECK_FAILED'
        });
    }
});
router.use((error, req, res, next) => {
    console.error('Auth Route Error:', {
        path: req.path,
        method: req.method,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
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
    return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: 'INTERNAL_SERVER_ERROR'
    });
});
exports.default = router;
//# sourceMappingURL=auth.js.map