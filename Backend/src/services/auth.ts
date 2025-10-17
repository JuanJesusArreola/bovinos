import bcrypt from 'bcryptjs';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import User, { UserRole, UserStatus, AccessLevel, UserPermissions, VerificationStatus } from '../models/User';
import Ranch from '../models/Ranch';
import { emailService } from './email';
import logger from '../utils/logger';

// Interfaces para el servicio de autenticación
interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  ranchId?: string;
}

interface TokenPayload extends JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions: UserPermissions;
}

interface AuthResponse {
  user: UserResponse;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string;
  phone?: string;
  farm?: {
    id: string;
    name: string;
    location: string;
  };
  permissions: UserPermissions;
  lastLogin?: Date;
  isActive: boolean;
}

interface ResetPasswordData {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

interface UpdatePasswordData {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

interface RefreshTokenData {
  refreshToken: string;
}

class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  private readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  private readonly BCRYPT_SALT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_TIME = 2 * 60 * 60 * 1000; // 2 horas en milisegundos

  /**
   * Registra un nuevo usuario en el sistema
   * @param registerData - Datos del usuario a registrar
   * @returns Promise con la respuesta de autenticación
   */
  async register(registerData: RegisterData): Promise<AuthResponse> {
    try {
      // Validar que las contraseñas coincidan
      if (registerData.password !== registerData.confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({
        where: { 
          email: registerData.email.toLowerCase() 
        }
      });

      if (existingUser) {
        throw new Error('El usuario ya existe con este email');
      }

      // Validar fortaleza de la contraseña
      this.validatePasswordStrength(registerData.password);

      // Hash de la contraseña
      const hashedPassword = await User.hashPassword(registerData.password);

      // Obtener permisos por defecto según el rol
      const defaultPermissions = this.getDefaultPermissionsByRole(registerData.role);

      // Crear el usuario con la estructura correcta del modelo
      const newUser = await User.create({
        email: registerData.email.toLowerCase(),
        password: hashedPassword,
        username: this.generateUsername(registerData.firstName, registerData.lastName),
        role: registerData.role,
        status: UserStatus.PENDING_VERIFICATION,
        accessLevel: AccessLevel.BASIC,
        verificationStatus: VerificationStatus.UNVERIFIED,
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

      // Generar tokens
      const tokenPayload: TokenPayload = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        permissions: newUser.permissions
      };

      const token = this.generateToken(tokenPayload);
      const refreshToken = this.generateRefreshToken(newUser.id);

      // Preparar respuesta del usuario
      const userResponse = await this.formatUserResponse(newUser);

      // Enviar email de bienvenida
      await this.sendWelcomeEmail(newUser);

      logger.info(`Usuario registrado exitosamente: ${newUser.email}`, 'AuthService', undefined );

      return {
        user: userResponse,
        token,
        refreshToken,
        expiresIn: this.getTokenExpirationTime()
      };

    } catch (error) {
      logger.error('Error en el registro', 'AuthService', { email: registerData.email }, error as Error);
      throw error;
    }
  }

  /**
   * Autentica un usuario existente
   * @param credentials - Credenciales de acceso
   * @returns Promise con la respuesta de autenticación
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Buscar usuario por email
      const user = await User.findOne({
        where: { 
          email: credentials.email.toLowerCase() 
        }
      });

      if (!user) {
        throw new Error('Credenciales inválidas');
      }

      // Verificar si la cuenta está activa
      if (!user.isActive || user.status !== UserStatus.ACTIVE) {
        throw new Error('Cuenta desactivada. Contacta al administrador');
      }

      // Verificar contraseña
      const isPasswordValid = await user.verifyPassword(credentials.password);

      if (!isPasswordValid) {
        throw new Error('Credenciales inválidas');
      }

      // Actualizar último login
      user.updateLastActivity();
      user.recordSuccessfulLogin('0.0.0.0', 'web'); // En producción obtener IP y device reales
      await user.save();

      // Generar tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      };

      const token = this.generateToken(tokenPayload, credentials.rememberMe);
      const refreshToken = this.generateRefreshToken(user.id);

      // Preparar respuesta del usuario
      const userResponse = await this.formatUserResponse(user);

      logger.info(`Usuario autenticado exitosamente: ${user.email}`, 'AuthService', undefined);

      return {
        user: userResponse,
        token,
        refreshToken,
        expiresIn: this.getTokenExpirationTime(credentials.rememberMe)
      };

    } catch (error) {
      logger.error('Error en el login', 'AuthService', { email: credentials.email }, error as Error);
      throw error;
    }
  }

  /**
   * Cierra la sesión del usuario
   * @param userId - ID del usuario
   * @returns Promise<void>
   */
  async logout(userId: string): Promise<void> {
    try {
      logger.info(`Usuario cerró sesión: ${userId}`, 'AuthService', undefined);
    } catch (error) {
      logger.error('Error en el logout', 'AuthService', { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Refresca el token de acceso
   * @param refreshTokenData - Token de refresco
   * @returns Promise con nuevos tokens
   */
  async refreshToken(refreshTokenData: RefreshTokenData): Promise<Pick<AuthResponse, 'token' | 'refreshToken' | 'expiresIn'>> {
    try {
      // Verificar el refresh token
      const decoded = jwt.verify(refreshTokenData.refreshToken, this.JWT_REFRESH_SECRET) as { userId: string };

      // Buscar usuario activo
      const user = await User.findOne({
        where: {
          id: decoded.userId,
          isActive: true,
          status: UserStatus.ACTIVE
        }
      });

      if (!user) {
        throw new Error('Token de refresco inválido');
      }

      // Generar nuevos tokens
      const tokenPayload: TokenPayload = {
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

    } catch (error) {
      logger.error('Error al refrescar token', 'AuthService', undefined, error as Error);
      throw new Error('Token de refresco inválido o expirado');
    }
  }

  /**
   * Inicia el proceso de recuperación de contraseña
   * @param email - Email del usuario
   * @returns Promise<void>
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const user = await User.findOne({
        where: { 
          email: email.toLowerCase() 
        }
      });

      if (!user) {
        // Por seguridad, no revelamos si el usuario existe o no
        logger.warn(`Intento de recuperación de contraseña para email inexistente: ${email}`, 'AuthService', undefined);
        return;
      }

      // Generar token de reset
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // Enviar email de recuperación
      await emailService.sendPasswordResetEmail(
        user.email, 
        resetToken, 
        user.personalInfo.firstName
      );

      logger.info(`Token de recuperación enviado para: ${user.email}`, 'AuthService', undefined, );

    } catch (error) {
      logger.error('Error en forgot password', 'AuthService', { email }, error as Error);
      throw error;
    }
  }

  /**
   * Restablece la contraseña del usuario
   * @param resetData - Datos de restablecimiento
   * @returns Promise<void>
   */
  async resetPassword(resetData: ResetPasswordData): Promise<void> {
    try {
      if (resetData.newPassword !== resetData.confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      // Validar fortaleza de la nueva contraseña
      this.validatePasswordStrength(resetData.newPassword);

      logger.info(`Contraseña restablecida exitosamente`, 'AuthService', undefined );

    } catch (error) {
      logger.error('Error en reset password', 'AuthService', undefined, error as Error);
      throw error;
    }
  }

  /**
   * Actualiza la contraseña del usuario autenticado
   * @param updateData - Datos de actualización
   * @returns Promise<void>
   */
  async updatePassword(updateData: UpdatePasswordData): Promise<void> {
    try {
      const user = await User.findByPk(updateData.userId);

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await user.verifyPassword(updateData.currentPassword);

      if (!isCurrentPasswordValid) {
        throw new Error('Contraseña actual incorrecta');
      }

      // Validar nueva contraseña
      this.validatePasswordStrength(updateData.newPassword);

      // Hash de la nueva contraseña
      const hashedPassword = await User.hashPassword(updateData.newPassword);
      user.password = hashedPassword;
      await user.save();

      logger.info(`Contraseña actualizada para: ${user.email}`, 'AuthService', undefined);

    } catch (error) {
      logger.error('Error en update password', 'AuthService', { userId: updateData.userId }, error as Error);
      throw error;
    }
  }

  /**
   * Verifica y decodifica un token JWT
   * @param token - Token a verificar
   * @returns Promise con el payload decodificado
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.error('Error al verificar token', 'AuthService', undefined, error as Error);
      throw new Error('Token inválido o expirado');
    }
  }

  /**
   * Obtiene los permisos por defecto según el rol
   * @param role - Rol del usuario
   * @returns UserPermissions
   */
  private getDefaultPermissionsByRole(role: UserRole): UserPermissions {
    const basePermissions: UserPermissions = {
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
      case UserRole.SUPER_ADMIN:
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
      
      case UserRole.VETERINARIAN:
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
      
      case UserRole.RANCH_MANAGER:
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

  /**
   * Genera un nombre de usuario único
   * @param firstName - Nombre
   * @param lastName - Apellido
   * @returns Username único
   */
  private generateUsername(firstName: string, lastName: string): string {
    const baseUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g, '');
    const timestamp = Date.now().toString().slice(-4);
    return `${baseUsername}${timestamp}`;
  }

  /**
   * Genera un token JWT de acceso
   * @param payload - Payload del token
   * @param rememberMe - Si debe recordar la sesión
   * @returns Token JWT
   */
  private generateToken(payload: TokenPayload, rememberMe = false): string {
    const expiresIn = rememberMe ? '30d' : this.JWT_EXPIRES_IN;
    
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn,
      issuer: 'cattle-management-system',
      audience: 'cattle-app-users'
    } as SignOptions);
  }

  /**
   * Genera un token de refresco
   * @param userId - ID del usuario
   * @returns Token de refresco
   */
  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRES_IN,
      issuer: 'cattle-management-system'
    } as SignOptions);
  }

  /**
   * Obtiene el tiempo de expiración del token en segundos
   * @param rememberMe - Si debe recordar la sesión
   * @returns Tiempo de expiración en segundos
   */
  private getTokenExpirationTime(rememberMe = false): number {
    return rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 días o 24 horas
  }

  /**
   * Valida la fortaleza de una contraseña
   * @param password - Contraseña a validar
   * @throws Error si la contraseña no cumple los requisitos
   */
  private validatePasswordStrength(password: string): void {
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

  /**
   * Formatea la respuesta del usuario para el frontend
   * @param user - Usuario de la base de datos
   * @returns Respuesta formateada del usuario
   */
  private async formatUserResponse(user: any): Promise<UserResponse> {
    // Buscar ranch si tiene acceso
    let ranch = null;
    if (user.ranchAccess && user.ranchAccess.length > 0) {
      const firstRanchAccess = user.ranchAccess[0];
      if (firstRanchAccess.isActive) {
        ranch = await Ranch.findByPk(firstRanchAccess.ranchId);
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

  /**
   * Envía email de bienvenida al nuevo usuario
   * @param user - Usuario registrado
   * @returns Promise<void>
   */
  private async sendWelcomeEmail(user: any): Promise<void> {
    try {
      await emailService.sendWelcomeEmail(user.email, user.personalInfo.firstName);
    } catch (error) {
      logger.error('Error enviando email de bienvenida', 'AuthService', { email: user.email }, error as Error);
      // No arrojar error para no afectar el registro
    }
  }
}

// Exportar instancia única del servicio
export const authService = new AuthService();