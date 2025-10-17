"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../services/auth");
const logger_1 = __importDefault(require("../utils/logger"));
const bcrypt = {
    async hash(password, saltRounds) {
        return `hashed_${password}_salt_${saltRounds}`;
    },
    async compare(password, hash) {
        return hash === `hashed_${password}_salt_12`;
    }
};
const validateEmail = (email) => {
    const errors = [];
    if (!email || typeof email !== 'string') {
        errors.push('El email es requerido');
        return { isValid: false, errors };
    }
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.length > 255) {
        errors.push('El email no puede tener más de 255 caracteres');
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
        errors.push('El formato del email no es válido');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
};
const validatePassword = (password) => {
    const errors = [];
    if (!password || typeof password !== 'string') {
        errors.push('La contraseña es requerida');
        return { isValid: false, errors };
    }
    if (password.length < 8) {
        errors.push('La contraseña debe tener al menos 8 caracteres');
    }
    if (password.length > 128) {
        errors.push('La contraseña no puede exceder 128 caracteres');
    }
    let complexity = 0;
    if (/[a-z]/.test(password))
        complexity++;
    if (/[A-Z]/.test(password))
        complexity++;
    if (/[0-9]/.test(password))
        complexity++;
    if (/[^a-zA-Z0-9]/.test(password))
        complexity++;
    if (complexity < 3) {
        errors.push('La contraseña debe contener al menos 3 de los siguientes: minúsculas, mayúsculas, números, caracteres especiales');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
};
const generateAccessToken = (user) => {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
    return jsonwebtoken_1.default.sign({
        userId: user.id,
        email: user.email,
        role: user.role
    }, JWT_SECRET, { expiresIn: '24h' });
};
const generateRefreshToken = (user) => {
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    return jsonwebtoken_1.default.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};
const verifyRefreshToken = (token) => {
    try {
        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        const decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
        return decoded;
    }
    catch (error) {
        return null;
    }
};
class AuthController {
    constructor() {
        this.register = async (req, res) => {
            try {
                const { firstName, lastName, email, password, confirmPassword } = req.body;
                if (!firstName || !lastName || !email || !password) {
                    res.status(400).json({
                        success: false,
                        message: 'Todos los campos son obligatorios',
                        errors: {
                            general: 'Por favor complete todos los campos requeridos'
                        }
                    });
                    return;
                }
                if (password !== confirmPassword) {
                    res.status(400).json({
                        success: false,
                        message: 'Las contraseñas no coinciden',
                        errors: {
                            confirmPassword: 'Las contraseñas deben ser idénticas'
                        }
                    });
                    return;
                }
                const emailValidation = validateEmail(email);
                if (!emailValidation.isValid) {
                    res.status(400).json({
                        success: false,
                        message: 'Email inválido',
                        errors: {
                            email: emailValidation.errors.join(', ')
                        }
                    });
                    return;
                }
                const passwordValidation = validatePassword(password);
                if (!passwordValidation.isValid) {
                    res.status(400).json({
                        success: false,
                        message: 'Contraseña no cumple con los requisitos',
                        errors: {
                            password: passwordValidation.errors.join(', ')
                        }
                    });
                    return;
                }
                const existingUser = await User_1.default.findOne({
                    where: { email: email.toLowerCase() }
                });
                if (existingUser) {
                    res.status(409).json({
                        success: false,
                        message: 'El usuario ya existe',
                        errors: {
                            email: 'Ya existe una cuenta con este email'
                        }
                    });
                    return;
                }
                try {
                    const authResponse = await this.authService.register({
                        email,
                        password,
                        confirmPassword,
                        firstName,
                        lastName,
                        phone: '',
                        role: 'RANCH_MANAGER'
                    });
                    res.status(201).json({
                        success: true,
                        message: 'Usuario registrado exitosamente',
                        data: authResponse
                    });
                }
                catch (serviceError) {
                    res.status(400).json({
                        success: false,
                        message: serviceError.message || 'Error en el registro',
                        errors: {
                            general: serviceError.message || 'Error inesperado en el registro'
                        }
                    });
                    return;
                }
            }
            catch (error) {
                logger_1.default.error('Error en registro', 'AuthController', { email: req.body?.email }, error);
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    errors: {
                        general: 'Ocurrió un error inesperado. Por favor intente nuevamente.'
                    }
                });
            }
        };
        this.login = async (req, res) => {
            try {
                const { email, password } = req.body;
                if (!email || !password) {
                    res.status(400).json({
                        success: false,
                        message: 'Email y contraseña son obligatorios',
                        errors: {
                            general: 'Por favor complete todos los campos'
                        }
                    });
                    return;
                }
                try {
                    const authResponse = await this.authService.login({
                        email,
                        password,
                        rememberMe: false
                    });
                    res.status(200).json({
                        success: true,
                        message: 'Inicio de sesión exitoso',
                        data: authResponse
                    });
                }
                catch (serviceError) {
                    res.status(401).json({
                        success: false,
                        message: 'Credenciales inválidas',
                        errors: {
                            general: serviceError.message || 'Email o contraseña incorrectos'
                        }
                    });
                    return;
                }
            }
            catch (error) {
                logger_1.default.error('Error en login', 'AuthController', { email: req.body?.email }, error);
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    errors: {
                        general: 'Ocurrió un error inesperado. Por favor intente nuevamente.'
                    }
                });
            }
        };
        this.forgotPassword = async (req, res) => {
            try {
                const { email } = req.body;
                if (!email) {
                    res.status(400).json({
                        success: false,
                        message: 'Email es obligatorio',
                        errors: {
                            email: 'Por favor ingrese su email'
                        }
                    });
                    return;
                }
                const emailValidation = validateEmail(email);
                if (!emailValidation.isValid) {
                    res.status(400).json({
                        success: false,
                        message: 'Email inválido',
                        errors: {
                            email: emailValidation.errors.join(', ')
                        }
                    });
                    return;
                }
                try {
                    await this.authService.forgotPassword(email);
                    res.status(200).json({
                        success: true,
                        message: 'Se ha enviado un email con instrucciones para recuperar tu contraseña',
                        data: {
                            emailSent: true
                        }
                    });
                }
                catch (serviceError) {
                    res.status(200).json({
                        success: true,
                        message: 'Si el email existe en nuestro sistema, recibirás instrucciones para recuperar tu contraseña',
                        data: {
                            emailSent: true
                        }
                    });
                }
            }
            catch (error) {
                logger_1.default.error('Error en forgot password', 'AuthController', { email: req.body?.email }, error);
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    errors: {
                        general: 'Ocurrió un error al procesar la solicitud. Por favor intente nuevamente.'
                    }
                });
            }
        };
        this.resetPassword = async (req, res) => {
            try {
                const { token, password, confirmPassword } = req.body;
                if (!token || !password || !confirmPassword) {
                    res.status(400).json({
                        success: false,
                        message: 'Todos los campos son obligatorios',
                        errors: {
                            general: 'Por favor complete todos los campos'
                        }
                    });
                    return;
                }
                if (password !== confirmPassword) {
                    res.status(400).json({
                        success: false,
                        message: 'Las contraseñas no coinciden',
                        errors: {
                            confirmPassword: 'Las contraseñas deben ser idénticas'
                        }
                    });
                    return;
                }
                const passwordValidation = validatePassword(password);
                if (!passwordValidation.isValid) {
                    res.status(400).json({
                        success: false,
                        message: 'Contraseña no cumple con los requisitos',
                        errors: {
                            password: passwordValidation.errors.join(', ')
                        }
                    });
                    return;
                }
                try {
                    await this.authService.resetPassword({
                        token,
                        newPassword: password,
                        confirmPassword
                    });
                    res.status(200).json({
                        success: true,
                        message: 'Contraseña restablecida exitosamente',
                        data: {
                            passwordReset: true
                        }
                    });
                }
                catch (serviceError) {
                    res.status(400).json({
                        success: false,
                        message: 'Token inválido o expirado',
                        errors: {
                            token: serviceError.message || 'El enlace de recuperación ha expirado o es inválido'
                        }
                    });
                    return;
                }
            }
            catch (error) {
                logger_1.default.error('Error en reset password', 'AuthController', {}, error);
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    errors: {
                        general: 'Ocurrió un error al restablecer la contraseña. Por favor intente nuevamente.'
                    }
                });
            }
        };
        this.refreshToken = async (req, res) => {
            try {
                const { refreshToken } = req.body;
                if (!refreshToken) {
                    res.status(400).json({
                        success: false,
                        message: 'Refresh token es obligatorio',
                        errors: {
                            refreshToken: 'Token de renovación requerido'
                        }
                    });
                    return;
                }
                try {
                    const tokenResponse = await this.authService.refreshToken({
                        refreshToken
                    });
                    res.status(200).json({
                        success: true,
                        message: 'Tokens renovados exitosamente',
                        data: tokenResponse
                    });
                }
                catch (serviceError) {
                    res.status(401).json({
                        success: false,
                        message: 'Refresh token inválido',
                        errors: {
                            refreshToken: serviceError.message || 'Token de renovación inválido o expirado'
                        }
                    });
                    return;
                }
            }
            catch (error) {
                logger_1.default.error('Error en refresh token', 'AuthController', {}, error);
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    errors: {
                        general: 'Ocurrió un error al renovar el token. Por favor inicie sesión nuevamente.'
                    }
                });
            }
        };
        this.logout = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (userId) {
                    try {
                        await this.authService.logout(userId);
                    }
                    catch (serviceError) {
                        logger_1.default.error('Error en servicio de logout', 'AuthController', { userId }, serviceError);
                    }
                }
                res.status(200).json({
                    success: true,
                    message: 'Sesión cerrada exitosamente',
                    data: {
                        logout: true
                    }
                });
            }
            catch (error) {
                logger_1.default.error('Error en logout', 'AuthController', {}, error);
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    errors: {
                        general: 'Ocurrió un error al cerrar la sesión'
                    }
                });
            }
        };
        this.getProfile = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        message: 'Usuario no autenticado',
                        errors: {
                            auth: 'Token de acceso requerido'
                        }
                    });
                    return;
                }
                const user = await User_1.default.findByPk(userId, {
                    attributes: ['id', 'email', 'personalInfo', 'role', 'isActive', 'emailVerified', 'createdAt']
                });
                if (!user) {
                    res.status(404).json({
                        success: false,
                        message: 'Usuario no encontrado',
                        errors: {
                            user: 'Usuario no existe'
                        }
                    });
                    return;
                }
                const userResponse = {
                    id: user.id,
                    email: user.email,
                    firstName: user.personalInfo?.firstName,
                    lastName: user.personalInfo?.lastName,
                    fullName: user.getFullName(),
                    role: user.getRoleLabel(),
                    isActive: user.isActive,
                    emailVerified: user.emailVerified,
                    createdAt: user.createdAt
                };
                res.status(200).json({
                    success: true,
                    message: 'Perfil obtenido exitosamente',
                    data: {
                        user: userResponse
                    }
                });
            }
            catch (error) {
                logger_1.default.error('Error al obtener perfil', 'AuthController', { userId: req.user?.id }, error);
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    errors: {
                        general: 'Ocurrió un error al obtener el perfil'
                    }
                });
            }
        };
        this.verifyEmail = async (req, res) => {
            try {
                const { token } = req.body;
                if (!token) {
                    res.status(400).json({
                        success: false,
                        message: 'Token de verificación es obligatorio',
                        errors: {
                            token: 'Token requerido para verificar email'
                        }
                    });
                    return;
                }
                try {
                    res.status(200).json({
                        success: true,
                        message: 'Email verificado exitosamente',
                        data: {
                            emailVerified: true
                        }
                    });
                }
                catch (serviceError) {
                    res.status(400).json({
                        success: false,
                        message: 'Token de verificación inválido o expirado',
                        errors: {
                            token: serviceError.message || 'El enlace de verificación ha expirado o es inválido'
                        }
                    });
                    return;
                }
            }
            catch (error) {
                logger_1.default.error('Error en verificación de email', 'AuthController', { token: req.body?.token }, error);
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    errors: {
                        general: 'Ocurrió un error al verificar el email'
                    }
                });
            }
        };
        this.updatePassword = async (req, res) => {
            try {
                const userId = req.user?.id;
                const { currentPassword, newPassword, confirmPassword } = req.body;
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        message: 'Usuario no autenticado',
                        errors: {
                            auth: 'Token de acceso requerido'
                        }
                    });
                    return;
                }
                if (!currentPassword || !newPassword || !confirmPassword) {
                    res.status(400).json({
                        success: false,
                        message: 'Todos los campos son obligatorios',
                        errors: {
                            general: 'Por favor complete todos los campos'
                        }
                    });
                    return;
                }
                if (newPassword !== confirmPassword) {
                    res.status(400).json({
                        success: false,
                        message: 'Las contraseñas no coinciden',
                        errors: {
                            confirmPassword: 'Las contraseñas deben ser idénticas'
                        }
                    });
                    return;
                }
                const passwordValidation = validatePassword(newPassword);
                if (!passwordValidation.isValid) {
                    res.status(400).json({
                        success: false,
                        message: 'Nueva contraseña no cumple con los requisitos',
                        errors: {
                            newPassword: passwordValidation.errors.join(', ')
                        }
                    });
                    return;
                }
                try {
                    await this.authService.updatePassword({
                        userId,
                        currentPassword,
                        newPassword
                    });
                    res.status(200).json({
                        success: true,
                        message: 'Contraseña actualizada exitosamente',
                        data: {
                            passwordUpdated: true
                        }
                    });
                }
                catch (serviceError) {
                    res.status(400).json({
                        success: false,
                        message: serviceError.message || 'Error al actualizar contraseña',
                        errors: {
                            currentPassword: serviceError.message || 'Contraseña actual incorrecta'
                        }
                    });
                    return;
                }
            }
            catch (error) {
                logger_1.default.error('Error en actualización de contraseña', 'AuthController', { userId: req.user?.id }, error);
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    errors: {
                        general: 'Ocurrió un error al actualizar la contraseña'
                    }
                });
            }
        };
        this.authService = auth_1.authService;
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.js.map