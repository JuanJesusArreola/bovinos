"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const User_1 = __importStar(require("../models/User"));
const Ranch_1 = __importDefault(require("../models/Ranch"));
const email_1 = require("./email");
const logger_1 = __importDefault(require("../utils/logger"));
class AuthService {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
        this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
        this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        this.BCRYPT_SALT_ROUNDS = 12;
        this.MAX_LOGIN_ATTEMPTS = 5;
        this.LOCK_TIME = 2 * 60 * 60 * 1000;
    }
    async register(registerData) {
        try {
            if (registerData.password !== registerData.confirmPassword) {
                throw new Error('Las contraseñas no coinciden');
            }
            const existingUser = await User_1.default.findOne({
                where: {
                    email: registerData.email.toLowerCase()
                }
            });
            if (existingUser) {
                throw new Error('El usuario ya existe con este email');
            }
            this.validatePasswordStrength(registerData.password);
            const hashedPassword = await User_1.default.hashPassword(registerData.password);
            const defaultPermissions = this.getDefaultPermissionsByRole(registerData.role);
            const newUser = await User_1.default.create({
                email: registerData.email.toLowerCase(),
                password: hashedPassword,
                username: this.generateUsername(registerData.firstName, registerData.lastName),
                role: registerData.role,
                status: User_1.UserStatus.PENDING_VERIFICATION,
                accessLevel: User_1.AccessLevel.BASIC,
                verificationStatus: User_1.VerificationStatus.UNVERIFIED,
                personalInfo: {
                    firstName: registerData.firstName,
                    lastName: registerData.lastName
                },
                contactInfo: {
                    primaryEmail: registerData.email.toLowerCase(),
                    primaryPhone: registerData.phone || '',
                    address: {
                        street: '',
                        city: '',
                        state: '',
                        country: 'México'
                    }
                },
                permissions: defaultPermissions,
                isActive: true,
                isVerified: false,
                emailVerified: false,
                phoneVerified: false,
                termsAccepted: true,
                privacyPolicyAccepted: true
            });
            const tokenPayload = {
                userId: newUser.id,
                email: newUser.email,
                role: newUser.role,
                permissions: newUser.permissions
            };
            const token = this.generateToken(tokenPayload);
            const refreshToken = this.generateRefreshToken(newUser.id);
            const userResponse = await this.formatUserResponse(newUser);
            await this.sendWelcomeEmail(newUser);
            logger_1.default.info(`Usuario registrado exitosamente: ${newUser.email}`, 'AuthService', undefined);
            return {
                user: userResponse,
                token,
                refreshToken,
                expiresIn: this.getTokenExpirationTime()
            };
        }
        catch (error) {
            logger_1.default.error('Error en el registro', 'AuthService', { email: registerData.email }, error);
            throw error;
        }
    }
    async login(credentials) {
        try {
            const user = await User_1.default.findOne({
                where: {
                    email: credentials.email.toLowerCase()
                }
            });
            if (!user) {
                throw new Error('Credenciales inválidas');
            }
            if (!user.isActive || user.status !== User_1.UserStatus.ACTIVE) {
                throw new Error('Cuenta desactivada. Contacta al administrador');
            }
            const isPasswordValid = await user.verifyPassword(credentials.password);
            if (!isPasswordValid) {
                throw new Error('Credenciales inválidas');
            }
            user.updateLastActivity();
            user.recordSuccessfulLogin('0.0.0.0', 'web');
            await user.save();
            const tokenPayload = {
                userId: user.id,
                email: user.email,
                role: user.role,
                permissions: user.permissions
            };
            const token = this.generateToken(tokenPayload, credentials.rememberMe);
            const refreshToken = this.generateRefreshToken(user.id);
            const userResponse = await this.formatUserResponse(user);
            logger_1.default.info(`Usuario autenticado exitosamente: ${user.email}`, 'AuthService', undefined);
            return {
                user: userResponse,
                token,
                refreshToken,
                expiresIn: this.getTokenExpirationTime(credentials.rememberMe)
            };
        }
        catch (error) {
            logger_1.default.error('Error en el login', 'AuthService', { email: credentials.email }, error);
            throw error;
        }
    }
    async logout(userId) {
        try {
            logger_1.default.info(`Usuario cerró sesión: ${userId}`, 'AuthService', undefined);
        }
        catch (error) {
            logger_1.default.error('Error en el logout', 'AuthService', { userId }, error);
            throw error;
        }
    }
    async refreshToken(refreshTokenData) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshTokenData.refreshToken, this.JWT_REFRESH_SECRET);
            const user = await User_1.default.findOne({
                where: {
                    id: decoded.userId,
                    isActive: true,
                    status: User_1.UserStatus.ACTIVE
                }
            });
            if (!user) {
                throw new Error('Token de refresco inválido');
            }
            const tokenPayload = {
                userId: user.id,
                email: user.email,
                role: user.role,
                permissions: user.permissions
            };
            const newToken = this.generateToken(tokenPayload);
            const newRefreshToken = this.generateRefreshToken(user.id);
            return {
                token: newToken,
                refreshToken: newRefreshToken,
                expiresIn: this.getTokenExpirationTime()
            };
        }
        catch (error) {
            logger_1.default.error('Error al refrescar token', 'AuthService', undefined, error);
            throw new Error('Token de refresco inválido o expirado');
        }
    }
    async forgotPassword(email) {
        try {
            const user = await User_1.default.findOne({
                where: {
                    email: email.toLowerCase()
                }
            });
            if (!user) {
                logger_1.default.warn(`Intento de recuperación de contraseña para email inexistente: ${email}`, 'AuthService', undefined);
                return;
            }
            const resetToken = crypto_1.default.randomBytes(32).toString('hex');
            const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
            await email_1.emailService.sendPasswordResetEmail(user.email, resetToken, user.personalInfo.firstName);
            logger_1.default.info(`Token de recuperación enviado para: ${user.email}`, 'AuthService', undefined);
        }
        catch (error) {
            logger_1.default.error('Error en forgot password', 'AuthService', { email }, error);
            throw error;
        }
    }
    async resetPassword(resetData) {
        try {
            if (resetData.newPassword !== resetData.confirmPassword) {
                throw new Error('Las contraseñas no coinciden');
            }
            this.validatePasswordStrength(resetData.newPassword);
            logger_1.default.info(`Contraseña restablecida exitosamente`, 'AuthService', undefined);
        }
        catch (error) {
            logger_1.default.error('Error en reset password', 'AuthService', undefined, error);
            throw error;
        }
    }
    async updatePassword(updateData) {
        try {
            const user = await User_1.default.findByPk(updateData.userId);
            if (!user) {
                throw new Error('Usuario no encontrado');
            }
            const isCurrentPasswordValid = await user.verifyPassword(updateData.currentPassword);
            if (!isCurrentPasswordValid) {
                throw new Error('Contraseña actual incorrecta');
            }
            this.validatePasswordStrength(updateData.newPassword);
            const hashedPassword = await User_1.default.hashPassword(updateData.newPassword);
            user.password = hashedPassword;
            await user.save();
            logger_1.default.info(`Contraseña actualizada para: ${user.email}`, 'AuthService', undefined);
        }
        catch (error) {
            logger_1.default.error('Error en update password', 'AuthService', { userId: updateData.userId }, error);
            throw error;
        }
    }
    async verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.JWT_SECRET);
            return decoded;
        }
        catch (error) {
            logger_1.default.error('Error al verificar token', 'AuthService', undefined, error);
            throw new Error('Token inválido o expirado');
        }
    }
    getDefaultPermissionsByRole(role) {
        const basePermissions = {
            modules: {
                bovines: 'NONE',
                health: 'NONE',
                reproduction: 'NONE',
                finance: 'NONE',
                inventory: 'NONE',
                production: 'NONE',
                locations: 'NONE',
                reports: 'NONE',
                users: 'NONE',
                settings: 'NONE'
            },
            actions: {
                canCreateRanch: false,
                canDeleteRecords: false,
                canExportData: false,
                canImportData: false,
                canAccessAnalytics: false,
                canManageUsers: false,
                canApproveTransactions: false,
                canPrescribeMedications: false,
                canPerformSurgery: false,
                canAccessFinancials: false
            },
            restrictions: {}
        };
        switch (role) {
            case User_1.UserRole.SUPER_ADMIN:
                return {
                    modules: {
                        bovines: 'ADMIN',
                        health: 'ADMIN',
                        reproduction: 'ADMIN',
                        finance: 'ADMIN',
                        inventory: 'ADMIN',
                        production: 'ADMIN',
                        locations: 'ADMIN',
                        reports: 'ADMIN',
                        users: 'ADMIN',
                        settings: 'ADMIN'
                    },
                    actions: {
                        canCreateRanch: true,
                        canDeleteRecords: true,
                        canExportData: true,
                        canImportData: true,
                        canAccessAnalytics: true,
                        canManageUsers: true,
                        canApproveTransactions: true,
                        canPrescribeMedications: true,
                        canPerformSurgery: true,
                        canAccessFinancials: true
                    },
                    restrictions: {}
                };
            case User_1.UserRole.VETERINARIAN:
                return {
                    ...basePermissions,
                    modules: {
                        ...basePermissions.modules,
                        bovines: 'READ',
                        health: 'ADMIN',
                        reproduction: 'WRITE',
                        inventory: 'WRITE',
                        reports: 'READ'
                    },
                    actions: {
                        ...basePermissions.actions,
                        canPrescribeMedications: true,
                        canPerformSurgery: true,
                        canExportData: true
                    }
                };
            case User_1.UserRole.RANCH_MANAGER:
                return {
                    ...basePermissions,
                    modules: {
                        ...basePermissions.modules,
                        bovines: 'ADMIN',
                        health: 'WRITE',
                        reproduction: 'ADMIN',
                        finance: 'READ',
                        inventory: 'ADMIN',
                        production: 'ADMIN',
                        locations: 'ADMIN',
                        reports: 'ADMIN'
                    },
                    actions: {
                        ...basePermissions.actions,
                        canCreateRanch: false,
                        canDeleteRecords: false,
                        canExportData: true,
                        canImportData: true,
                        canAccessAnalytics: true,
                        canAccessFinancials: true
                    }
                };
            default:
                return basePermissions;
        }
    }
    generateUsername(firstName, lastName) {
        const baseUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g, '');
        const timestamp = Date.now().toString().slice(-4);
        return `${baseUsername}${timestamp}`;
    }
    generateToken(payload, rememberMe = false) {
        const expiresIn = rememberMe ? '30d' : this.JWT_EXPIRES_IN;
        return jsonwebtoken_1.default.sign(payload, this.JWT_SECRET, {
            expiresIn,
            issuer: 'cattle-management-system',
            audience: 'cattle-app-users'
        });
    }
    generateRefreshToken(userId) {
        return jsonwebtoken_1.default.sign({ userId }, this.JWT_REFRESH_SECRET, {
            expiresIn: this.JWT_REFRESH_EXPIRES_IN,
            issuer: 'cattle-management-system'
        });
    }
    getTokenExpirationTime(rememberMe = false) {
        return rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    }
    validatePasswordStrength(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        if (password.length < minLength) {
            throw new Error(`La contraseña debe tener al menos ${minLength} caracteres`);
        }
        if (!hasUpperCase) {
            throw new Error('La contraseña debe contener al menos una letra mayúscula');
        }
        if (!hasLowerCase) {
            throw new Error('La contraseña debe contener al menos una letra minúscula');
        }
        if (!hasNumbers) {
            throw new Error('La contraseña debe contener al menos un número');
        }
        if (!hasSpecialChar) {
            throw new Error('La contraseña debe contener al menos un carácter especial');
        }
    }
    async formatUserResponse(user) {
        let ranch = null;
        if (user.ranchAccess && user.ranchAccess.length > 0) {
            const firstRanchAccess = user.ranchAccess[0];
            if (firstRanchAccess.isActive) {
                ranch = await Ranch_1.default.findByPk(firstRanchAccess.ranchId);
            }
        }
        return {
            id: user.id,
            email: user.email,
            firstName: user.personalInfo.firstName,
            lastName: user.personalInfo.lastName,
            role: user.getRoleLabel(),
            avatar: user.personalInfo.profilePhoto,
            phone: user.contactInfo.primaryPhone,
            farm: ranch ? {
                id: ranch.id,
                name: ranch.name,
                location: ranch.getFullAddress()
            } : undefined,
            permissions: user.permissions,
            lastLogin: user.lastLoginAt,
            isActive: user.isActive
        };
    }
    async sendWelcomeEmail(user) {
        try {
            await email_1.emailService.sendWelcomeEmail(user.email, user.personalInfo.firstName);
        }
        catch (error) {
            logger_1.default.error('Error enviando email de bienvenida', 'AuthService', { email: user.email }, error);
        }
    }
}
exports.authService = new AuthService();
//# sourceMappingURL=auth.js.map