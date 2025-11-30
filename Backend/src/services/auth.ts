import bcrypt from 'bcryptjs';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import User, { UserRole, UserStatus, AccessLevel, UserPermissions, VerificationStatus } from '../models/User';
import Ranch from '../models/Ranch';
import { EmailVerificationToken } from '../models/EmailVerificationToken';
import { TokenBlacklist, RevocationReason, TokenType } from '../models/TokenBlacklist';
import { SecurityEvent, EventType, EventSeverity } from '../models/SecurityEvent';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { emailService } from './email';
import logger from '../utils/logger';
import sequelize from '../config/database';

// Interfaces para el servicio de autenticación
interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  ipAddress?: string;
  userAgent?: string;
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
  ipAddress?: string;
  userAgent?: string;
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
  ipAddress?: string;    // ✅ Opcional
  userAgent?: string;
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
      await this.sendEmailVerification(newUser.id, newUser.email);

      logger.info(`Usuario registrado exitosamente: ${newUser.email}`, 'AuthService', undefined);

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
      user.recordSuccessfulLogin(credentials.ipAddress || 'unknown', credentials.userAgent || 'unknown');

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
   
  async logout(userId: string): Promise<void> {
    try {
      logger.info(`Usuario cerró sesión: ${userId}`, 'AuthService', undefined);
    } catch (error) {
      logger.error('Error en el logout', 'AuthService', { userId }, error as Error);
      throw error;
    }
  }*/

  /**
   * Refresca el token de acceso
   * @param refreshTokenData - Token de refresco
   * @returns Promise con nuevos tokens
   */
  async refreshToken(refreshTokenData: RefreshTokenData): Promise<Pick<AuthResponse, 'token' | 'refreshToken' | 'expiresIn'>> {
    try {
      // Verificar el refresh token
      const decoded = jwt.verify(refreshTokenData.refreshToken, this.JWT_REFRESH_SECRET) as { userId: string, jti: string, exp: number, iat: number };

      // 1. Verificar si el token ya está en blacklist
      const isBlacklisted = await this.isTokenBlacklisted(refreshTokenData.refreshToken);

      if (isBlacklisted) {
        // ⚠️ TOKEN REUTILIZADO - Posible ataque de seguridad
        logger.warn(`Intento de reutilización de refresh token: ${decoded.jti}`, 'AuthService', {
          userId: decoded.userId,
          tokenJti: decoded.jti
        });

        // Registrar evento de seguridad crítico
        await this.recordSecurityEvent(
          decoded.userId,
          'REFRESH_TOKEN_REUSE_ATTEMPT',
          'HIGH',
          'Intento de reutilización de refresh token ya invalidado',
          refreshTokenData.ipAddress || 'unknown',
          refreshTokenData.userAgent || 'unknown'
        );

        throw new Error('Refresh Token inválido o ya utilizado');
      }

      // Calcular hash del refresh token anterior para almacenarlo en blacklist
      const oldRefreshTokenHash = crypto.createHash('sha256')
        .update(refreshTokenData.refreshToken)
        .digest('hex');

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

      // 1. Calcular fecha de expiración del token anterior
      const oldTokenExpiresAt = new Date(decoded.exp * 1000); // exp está en segundos, convertir a milisegundos

      // 2. Agregar el refresh token anterior a la blacklist
      try {
        await TokenBlacklist.addToBlacklist(
          user.id,                                    // userId
          TokenType.REFRESH,                          // tokenType: es un refresh token
          decoded.jti,                               // tokenJti: JWT ID del token anterior
          oldRefreshTokenHash,                        // tokenHash: hash del token anterior
          oldTokenExpiresAt,                         // expiresAt: fecha de expiración del token anterior
          'TOKEN_ROTATION' as RevocationReason,      // reason: nueva razón (necesitarás agregarla al enum)
          refreshTokenData.ipAddress || 'unknown',                                  // ipAddress: no disponible en refreshToken
          refreshTokenData.userAgent || 'unknown',                                  // userAgent: no disponible en refreshToken
          user.id                                     // revokedBy: el mismo usuario
        );

        logger.info(`Refresh token anterior invalidado: ${decoded.jti}`, 'AuthService', {
          userId: user.id,
          oldTokenJti: decoded.jti
        });

      } catch (error) {
        // Si falla la invalidación, registrar error pero continuar
        logger.error('Error invalidando refresh token anterior', 'AuthService', {
          userId: user.id,
          tokenJti: decoded.jti
        }, error as Error);

        await this.recordSecurityEvent(
          user.id,
          'REFRESH_TOKEN_INVALIDATION_FAILED',
          'MEDIUM',
          'Error al invalidar refresh token anterior durante rotación',
          refreshTokenData.ipAddress || 'unknown',
          refreshTokenData.userAgent || 'unknown'
        );
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
  async forgotPassword(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const user = await User.findOne({
        where: {
          email: email.toLowerCase(),
          isActive: true, // ✅ Solo usuarios activos
          status: UserStatus.ACTIVE // ✅ Solo cuentas activas
        }
      });

      if (!user) {
        // Por seguridad, no revelamos si el usuario existe o no
        logger.warn(`Intento de recuperación de contraseña para email inexistente: ${email}`, 'AuthService', undefined);
        return;
      }

      await PasswordResetToken.update(
        {
          used: true,
          used_at: new Date()
        },
        {
          where: {
            user_id: user.id,
            used: false, // Solo tokens no usados
            expires_at: {
              [Op.gt]: new Date() // Solo tokens no expirados
            }
          }
        }
      );

      // 3. ✅ AQUÍ: VERIFICAR LÍMITE DE SOLICITUDES (máximo 3 por hora)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentRequests = await PasswordResetToken.count({
        where: {
          user_id: user.id,
          created_at: {
            [Op.gte]: oneHourAgo
          }
        }
      });

      if (recentRequests >= 3) {
        // Registrar evento de seguridad por intento de abuso
        await this.recordSecurityEvent(
          user.id,
          'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
          'MEDIUM',
          `Intento de solicitar reset de contraseña excediendo límite (${recentRequests} solicitudes en la última hora)`,
          ipAddress,
          userAgent
        );

        logger.warn(`Límite de solicitudes de reset excedido para usuario ${user.id}`, 'AuthService', {
          userId: user.id,
          email: user.email,
          recentRequests,
          ipAddress,
          userAgent
        });

        throw new Error('Demasiadas solicitudes de reset. Intenta nuevamente en una hora.');
      }

      

      logger.info(`Tokens anteriores invalidados para usuario ${user.id}`, 'AuthService', {
        userId: user.id,
        email: user.email
      });

      // Generar token de reset
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      const passwordResetToken = await PasswordResetToken.createResetToken(
        user.id,
        user.email,
        resetToken,
        undefined,
        ipAddress,
        userAgent
      );

      logger.info(`Token de reset guardado en BD: ${passwordResetToken.id}`, 'AuthService', {
        userId: user.id,
        tokenId: passwordResetToken.id
      });

      // Enviar email de recuperación
      await emailService.sendPasswordResetEmail(
        user.email,
        resetToken,
        user.personalInfo.firstName
      );

      logger.info(`Token de recuperación enviado para: ${user.email}`, 'AuthService', undefined,);

      await this.recordSecurityEvent(
        user.id,
        'PASSWORD_RESET_REQUESTED',
        'MEDIUM',
        `Solicitud de reset de contraseña para ${user.email}`,
        ipAddress,    // ✅ IP capturada
        userAgent     // ✅ User Agent capturado
      );

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
  async resetPassword(resetData: ResetPasswordData, ipAddress?: string, userAgent?: string): Promise<void> {

    // Usar transacción para atomicidad
    const transaction = await sequelize.transaction();
    try {

      // 1. Buscar token de reset
      const passwordResetToken = await PasswordResetToken.findByToken(resetData.token);

      if (!passwordResetToken) {
        throw new Error('Token de reset inválido');
      }

      // 2. Validar token usando método del modelo
      if (!passwordResetToken.isValid()) {
        if (passwordResetToken.isExpired()) {
          throw new Error('Token de reset expirado');
        }
        if (passwordResetToken.used) {
          throw new Error('Token de reset ya utilizado');
        }
        throw new Error('Token de reset inválido');
      }

      // 3. Buscar usuario
      const searchedUser = await User.findByPk(passwordResetToken.user_id, { transaction });
      if (!searchedUser) {
        throw new Error('Usuario no encontrado');
      }

      // 4. Verificar que el email del token coincide con el usuario
      if (passwordResetToken.email.toLowerCase() !== searchedUser.email.toLowerCase()) {
        throw new Error('El token no corresponde al usuario');
      }

      // 5. Validar contraseñas
      if (resetData.newPassword !== resetData.confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      // 6. Validar fortaleza de la nueva contraseña
      this.validatePasswordStrength(resetData.newPassword);

      // 7. Verificar si la nueva contraseña es la misma que la contraseña actual
      const isDifferent = await User.isPasswordDifferent(resetData.newPassword, searchedUser.password);
      if (!isDifferent) {
        throw new Error('La nueva contraseña es la misma que la contraseña actual');
      }

      // 8. Invalidar TODOS los tokens anteriores del usuario (ANTES de actualizar)
      await PasswordResetToken.update(
        {
          used: true,
          used_at: new Date()
        },
        {
          where: {
            user_id: searchedUser.id,
            used: false,
            id: { [Op.ne]: passwordResetToken.id } // Excluir el token actual
          },
          transaction
        }
      );
      // 9. Hash de la nueva contraseña
      const hashedPassword = await User.hashPassword(resetData.newPassword);

      // 10. Actualizar nueva contraseña del usuario
      searchedUser.password = hashedPassword;

      // Actualizar securityInfo
      if (!searchedUser.securityInfo) {
        searchedUser.securityInfo = {
          passwordLastChanged: new Date()
        };
      } else {
        searchedUser.securityInfo.passwordLastChanged = new Date();
      }

      await searchedUser.save({ transaction });

      logger.info(
        `Todos los tokens JWT del usuario ${searchedUser.id} serán invalidados por cambio de contraseña`,
        'AuthService',
        {
          userId: searchedUser.id,
          passwordChangedAt: searchedUser.securityInfo?.passwordLastChanged
        }
      );


      // 11. Marcar el token como usado usando método del modelo
      passwordResetToken.markAsUsed();
      await passwordResetToken.save({ transaction });

      // 12. Registrar evento de seguridad con IP/UserAgent del request actual
      await this.recordSecurityEvent(
        searchedUser.id,
        'PASSWORD_RESET_SUCCESS',
        'MEDIUM', // Cambiar a MEDIUM por ser acción crítica
        `Contraseña restablecida exitosamente para ${searchedUser.email}`,
        ipAddress || passwordResetToken.ip_address || 'unknown',
        userAgent || passwordResetToken.user_agent || 'unknown'
      );

      // 13. Commit de la transacción
      await transaction.commit();

      logger.info(`Contraseña restablecida exitosamente para usuario ${searchedUser.id}`, 'AuthService', {
        userId: searchedUser.id,
        email: searchedUser.email,
        ipAddress,
        userAgent
      });

    } catch (error) {
      // Rollback en caso de error
      await transaction.rollback();
      logger.error('Error en reset password', 'AuthService', {
        token: resetData.token.substring(0, 8) + '...'
      }, error as Error);
      throw error;
    }
  }

  /**
   * Actualiza la contraseña del usuario autenticado
   * @param updateData - Datos de actualización
   * @returns Promise<void>
   */
  async updatePassword(updateData: UpdatePasswordData, ipAddress?: string, userAgent?: string): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(updateData.userId, { transaction });

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await user.verifyPassword(updateData.currentPassword);

      if (!isCurrentPasswordValid) {
        throw new Error('Contraseña actual incorrecta');
      }

      // Verificar que la nueva contraseña sea diferente de la actual
      const isDifferent = await User.isPasswordDifferent(updateData.newPassword, user.password);
      if (!isDifferent) {
        throw new Error('La nueva contraseña es la misma que la contraseña actual');
      }

      // Validar nueva contraseña
      this.validatePasswordStrength(updateData.newPassword);

      // Hash de la nueva contraseña
      const hashedPassword = await User.hashPassword(updateData.newPassword);
      user.password = hashedPassword;

      if (!user.securityInfo) {
        user.securityInfo = {
          passwordLastChanged: new Date()
        };

      } else {
        user.securityInfo.passwordLastChanged = new Date();
      }

      await user.save({ transaction });

      // Invalidar todos los tokens activos del usuario en la blacklist
      try {
        await TokenBlacklist.update(
          {
            reason: RevocationReason.PASSWORD_CHANGE, // O crear PASSWORD_CHANGE si prefieres
            revoked_by: user.id
          },
          {
            where: {
              user_id: user.id,
              expires_at: { [Op.gt]: new Date() } // Solo tokens no expirados
            },
            transaction
          }
        );

        logger.info(
          `Tokens invalidados en blacklist para usuario ${user.id}`,
          'AuthService',
          { userId: user.id }
        );
      } catch (error) {
        // No fallar si esto falla - passwordLastChanged ya invalida tokens
        logger.warn(
          'Error invalidando tokens en blacklist, pero passwordLastChanged se actualizó',
          'AuthService',
          { userId: user.id }
        );
      }

      logger.info(
        `Todos los tokens JWT del usuario ${user.id} serán invalidados por cambio de contraseña`,
        'AuthService',
        {
          userId: user.id,
          passwordChangedAt: user.securityInfo?.passwordLastChanged
        }
      );

      // 9. Registrar evento de seguridad
      await this.recordSecurityEvent(
        user.id,
        'PASSWORD_CHANGED',
        'MEDIUM',
        `Contraseña actualizada exitosamente para ${user.email}`,
        ipAddress,
        userAgent
      );


      logger.info(`Contraseña actualizada exitosamente para usuario ${user.id}`, 'AuthService', {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent
      });

      await transaction.commit();

    } catch (error) {
      // Rollback en caso de error
      await transaction.rollback();
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
 * Envía email de verificación al usuario
 * @param userId - ID del usuario
 * @param email - Email a verificar
 * @returns Promise<void>
 */
  async sendEmailVerification(userId: string, email: string): Promise<void> {
    try {
      // 1. Generar token de verificación
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      // 2. Invalidar tokens anteriores del usuario
      await EmailVerificationToken.update(
        { used: true },
        {
          where: {
            user_id: userId,
            used: false
          }
        }
      );

      // 3. Crear nuevo token de verificación
      await EmailVerificationToken.create({
        user_id: userId,
        email: email,
        token: verificationToken,
        expires_at: expiresAt,
        used: false,
      });

      // 4. Obtener información del usuario para el email
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // 5. Enviar email de verificación
      await emailService.sendEmailVerification(
        email,
        verificationToken,
        user.personalInfo.firstName
      );

      // 6. Registrar evento de seguridad
      await this.recordSecurityEvent(userId, 'EMAIL_VERIFICATION_SENT', 'MEDIUM',
        `Email de verificación enviado a ${email}`, undefined, undefined);

      logger.info(`Email de verificación enviado para usuario ${userId}`, 'AuthService', { userId, email });

    } catch (error) {
      logger.error('Error enviando email de verificación', 'AuthService', { userId, email }, error as Error);
      throw new Error('No se pudo enviar el email de verificación');
    }
  }

  /**
   * Verifica el email del usuario usando el token
   * @param token - Token de verificación
   * @returns Promise<boolean>
   */
  async verifyEmail(token: string): Promise<boolean> {
    try {
      // 1. Buscar token válido
      const verificationToken = await EmailVerificationToken.findOne({
        where: {
          token: token,
          used: false,
          expires_at: {
            [Op.gt]: new Date()
          }
        }
      });

      if (!verificationToken) {
        logger.warn('Token de verificación inválido o expirado', 'AuthService', { token: 'hidden' });
        return false;
      }

      // 2. Marcar token como usado
      verificationToken.markAsUsed();
      await verificationToken.save();

      // 3. Actualizar estado del usuario
      await User.update(
        {
          emailVerified: true,
          verificationStatus: VerificationStatus.EMAIL_VERIFIED,
          status: UserStatus.ACTIVE // Activar cuenta después de verificar email
        },
        {
          where: {
            id: verificationToken.user_id
          }
        }
      );

      // 4. Registrar evento de seguridad
      await this.recordSecurityEvent(
        verificationToken.user_id,
        'EMAIL_VERIFIED',
        'LOW',
        `Email verificado exitosamente: ${verificationToken.email}`,
        verificationToken.ip_address || 'unknown',
        verificationToken.user_agent || 'unknown'
      );

      logger.info(`Email verificado exitosamente para usuario ${verificationToken.user_id}`, 'AuthService', {
        userId: verificationToken.user_id,
        email: verificationToken.email
      });

      return true;

    } catch (error) {
      logger.error('Error verificando email', 'AuthService', { token: 'hidden' }, error as Error);
      return false;
    }
  }

  /**
   * Reenvía email de verificación
   * @param email - Email del usuario
   * @returns Promise<void>
   */
  async resendEmailVerification(email: string): Promise<void> {
    try {
      // 1. Buscar usuario por email
      const user = await User.findOne({
        where: {
          email: email.toLowerCase(),
          emailVerified: false // Solo usuarios no verificados
        }
      });

      if (!user) {
        // Por seguridad, no revelamos si el usuario existe
        logger.warn(`Intento de reenvío de verificación para email inexistente: ${email}`, 'AuthService');
        return;
      }

      // 2. Verificar límite de reenvíos (máximo 3 por hora)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentTokens = await EmailVerificationToken.count({
        where: {
          user_id: user.id,
          created_at: {
            [Op.gte]: oneHourAgo
          }
        }
      });

      if (recentTokens >= 3) {
        throw new Error('Demasiados intentos de verificación. Intenta nuevamente en una hora.');
      }

      // 3. Enviar nuevo email de verificación
      await this.sendEmailVerification(user.id, user.email);

      logger.info(`Email de verificación reenviado para ${email}`, 'AuthService', { email });

    } catch (error) {
      logger.error('Error reenviando email de verificación', 'AuthService', { email }, error as Error);
      throw error;
    }
  }

  /**
   * Registra un evento de seguridad
   * @param userId - ID del usuario
   * @param eventType - Tipo de evento
   * @param severity - Severidad del evento
   * @param description - Descripción del evento
   * @returns Promise<void>
   */
  private async recordSecurityEvent(
    userId: string,
    eventType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    description: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await SecurityEvent.create({
        user_id: userId,
        event_type: eventType as EventType,
        severity: severity as EventSeverity,
        description: description,
        ip_address: ipAddress || 'unknown',
        user_agent: userAgent || 'unknown',
        resolved: false
      });
    } catch (error) {
      logger.error('Error registrando evento de seguridad', 'AuthService', { userId, eventType }, error as Error);
      // No arrojar error para no afectar el flujo principal
    }
  }

  /**
 * Agrega un token a la blacklist
 * @param token - Token JWT a invalidar
 * @param userId - ID del usuario
 * @param reason - Razón de la invalidación (por defecto: 'LOGOUT')
 * @param ipAddress - Dirección IP desde donde se revocó el token (opcional)
 * @param userAgent - User agent del navegador (opcional)
 * @returns Promise<void>
 */
  async blacklistToken(
    token: string,
    userId: string,
    reason: string = 'LOGOUT',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      let decoded: any;
      let isRefreshToken = false;
      let tokenType: TokenType;

      // 1. Intentar decodificar como access token primero
      try {
        decoded = jwt.verify(token, this.JWT_SECRET) as any;
        tokenType = TokenType.ACCESS;
      } catch (error) {
        // 2. Si falla, intentar como refresh token
        try {
          decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as any;
          tokenType = TokenType.REFRESH;
          isRefreshToken = true;
        } catch (refreshError) {
          throw new Error('Token inválido. No es un access token ni un refresh token válido.');
        }
      }

      // 3. Verificar que el token tenga jti (JWT ID)
      if (!decoded.jti) {
        throw new Error('Token no tiene jti (JWT ID). No se puede agregar a blacklist.');
      }

      // 4. Calcular hash del token para almacenamiento seguro
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // 5. Usar el método estático del modelo para agregar a blacklist
      // Esto garantiza validaciones y consistencia de datos
      await TokenBlacklist.addToBlacklist(
        userId,
        tokenType, // ✅ TokenType correcto (ACCESS o REFRESH)
        decoded.jti, // ✅ JTI del token
        tokenHash,
        new Date(decoded.exp * 1000), // Fecha de expiración del token
        reason as RevocationReason, // ✅ Razón de revocación
        ipAddress || undefined, // ✅ IP real en lugar de hardcodeada
        userAgent || undefined, // ✅ User agent real en lugar de hardcodeado
        userId // Usuario que revocó el token
      );

      logger.info(`Token agregado a blacklist para usuario ${userId}`, 'AuthService', {
        userId,
        reason,
        tokenJti: decoded.jti,
        tokenType: tokenType,
        ipAddress,
        userAgent
      });

    } catch (error) {
      logger.error('Error agregando token a blacklist', 'AuthService', { userId }, error as Error);
      throw new Error('No se pudo invalidar el token');
    }
  }

  /**
   * Verifica si un token está en la blacklist
   * @param token - Token JWT a verificar (puede ser access token o refresh token)
   * @returns Promise<boolean>
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      let decoded: any;

      // 1. Intentar decodificar como access token primero
      try {
        decoded = jwt.verify(token, this.JWT_SECRET) as any;
      } catch (error) {
        // 2. Si falla, intentar como refresh token
        try {
          decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as any;
        } catch (refreshError) {
          // Si no se puede decodificar, no está en blacklist (pero tampoco es válido)
          return false;
        }
      }

      // 3. Calcular hash del token para búsqueda
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // 4. Buscar en la blacklist por jti o hash
      const blacklistedToken = await TokenBlacklist.findOne({
        where: {
          [Op.or]: [
            { token_jti: decoded.jti }, // Buscar por JWT ID (más rápido)
            { token_hash: tokenHash }  // Buscar por hash (fallback)
          ],
          expires_at: {
            [Op.gt]: new Date() // Solo tokens no expirados
          }
        }
      });

      return !!blacklistedToken;

    } catch (error) {
      logger.error('Error verificando blacklist', 'AuthService', undefined, error as Error);
      return true; // Si hay error, considerar como blacklisted por seguridad
    }
  }

  /**
   * Logout seguro con invalidación de token
   * @param token - Token JWT a invalidar
   * @param userId - ID del usuario
   * @param ipAddress - Dirección IP desde donde se hace el logout (opcional)
   * @param userAgent - User agent del navegador (opcional)
   * @returns Promise<void>
   */
  async logout(token: string, userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      // 1. Agregar token a la blacklist con información de IP y user agent
      await this.blacklistToken(token, userId, 'LOGOUT', ipAddress, userAgent);

      // 2. Registrar evento de seguridad
      await this.recordSecurityEvent(
        userId,
        'LOGOUT',
        'LOW',
        'Usuario cerró sesión exitosamente',
        ipAddress,
        userAgent
      );

      logger.info(`Usuario cerró sesión: ${userId}`, 'AuthService', { userId });

    } catch (error) {
      logger.error('Error en el logout', 'AuthService', { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Logout de todos los dispositivos del usuario
   * @param userId - ID del usuario
   * @returns Promise<void>
   */
  async logoutAllDevices(userId: string): Promise<void> {
    try {
      // 1. Marcar todos los tokens del usuario como revocados
      await TokenBlacklist.update(
        {
          reason: 'LOGOUT_ALL_DEVICES' as RevocationReason,
          revoked_by: userId
        },
        {
          where: {
            user_id: userId,
            reason: {
              [Op.notIn]: ['LOGOUT_ALL_DEVICES', 'ACCOUNT_SUSPENDED']
            }
          }
        }
      );

      // 2. Registrar evento de seguridad
      await this.recordSecurityEvent(
        userId,
        'LOGOUT_ALL_DEVICES',
        'MEDIUM',
        'Usuario cerró sesión en todos los dispositivos'
      );

      logger.info(`Logout de todos los dispositivos para usuario ${userId}`, 'AuthService', { userId });

    } catch (error) {
      logger.error('Error en logout de todos los dispositivos', 'AuthService', { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Revoca tokens por seguridad (cuando hay actividad sospechosa)
   * @param userId - ID del usuario
   * @param reason - Razón de la revocación
   * @returns Promise<void>
   */
  async revokeTokensForSecurity(userId: string, reason: string): Promise<void> {
    try {
      // 1. Marcar tokens como revocados por seguridad
      await TokenBlacklist.update(
        {
          reason: reason as RevocationReason,
          revoked_by: userId
        },
        {
          where: {
            user_id: userId,
            reason: {
              [Op.notIn]: ['ACCOUNT_SUSPENDED', 'ACCOUNT_DELETED']
            }
          }
        }
      );

      // 2. Registrar evento de seguridad crítico
      await this.recordSecurityEvent(
        userId,
        'TOKENS_REVOKED_SECURITY',
        'HIGH',
        `Tokens revocados por seguridad: ${reason}`,
      );

      logger.warn(`Tokens revocados por seguridad para usuario ${userId}`, 'AuthService', {
        userId,
        reason
      });

    } catch (error) {
      logger.error('Error revocando tokens por seguridad', 'AuthService', { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Limpia tokens expirados de la blacklist
   * @returns Promise<void>
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const deletedCount = await TokenBlacklist.destroy({
        where: {
          expires_at: {
            [Op.lt]: new Date()
          }
        }
      });

      logger.info(`${deletedCount} tokens expirados eliminados de la blacklist`, 'AuthService');

    } catch (error) {
      logger.error('Error limpiando tokens expirados', 'AuthService', undefined, error as Error);
      // No arrojar error para no afectar el funcionamiento normal
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

    // Generar JWT ID único (jti) para identificar este token específico
    // Esto es necesario para poder invalidar el token en la blacklist
    const jti = crypto.randomUUID();

    // Incluir el jti en el payload antes de firmar el token
    const payloadWithJti = {
      ...payload,
      jti: jti
    };

    return jwt.sign(payloadWithJti, this.JWT_SECRET, {
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
    // Generar JWT ID único (jti) para identificar este refresh token específico
    // Esto es necesario para poder invalidar el refresh token en la blacklist
    const jti = crypto.randomUUID();

    // Incluir el jti en el payload del refresh token
    return jwt.sign({
      userId,
      jti: jti
    }, this.JWT_REFRESH_SECRET, {
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

  public async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string }
  ) {
    const user = await User.findByPk(userId);
  
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
  
    await user.update({
      personalInfo: {
        ...user.personalInfo,
        firstName: data.firstName ?? user.personalInfo.firstName,
        lastName: data.lastName ?? user.personalInfo.lastName
      },
      contactInfo: {
        ...user.contactInfo,
        primaryPhone: data.phone ?? user.contactInfo.primaryPhone
      }
    });
  
    return {
      id: user.id,
      email: user.email,
      firstName: user.personalInfo.firstName,
      lastName: user.personalInfo.lastName,
      phone: user.contactInfo.primaryPhone
    };
  }

  public async deleteAccount(
    userId: string,
    password: string,
    confirmation: string
  ) {
    const user = await User.findByPk(userId);
  
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
  
    // Confirmación explícita: evita borrados accidentales
    if (confirmation !== 'DELETE') {
      throw new Error('INVALID_CONFIRMATION');
    }
  
    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('INVALID_PASSWORD');
    }
  
    // Soft delete
    await user.update({
      isActive: false,
      /*deletedAt: new Date()*/
    });
  
    // Invalidar todos los tokens del usuario
    await TokenBlacklist.create({
      user_id: userId,
      token_type: TokenType.ACCESS,
      token_jti: `ACCOUNT_DELETE_${userId}_${Date.now()}`,
      token_hash: 'ACCOUNT_DELETED',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
      reason: RevocationReason.ACCOUNT_DELETED
    });
  
    return true;
  }

  public async changePassword(
    userId: string,
    data: { currentPassword: string; newPassword: string; confirmPassword: string }
  ) {
    const { currentPassword, newPassword, confirmPassword } = data;
  
    // Validar confirmación
    if (newPassword !== confirmPassword) {
      throw new Error('PASSWORD_CONFIRMATION_DOES_NOT_MATCH');
    }
  
    const user = await User.findByPk(userId);
  
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }
  
    // Verificar contraseña actual
    const validPassword = await bcrypt.compare(currentPassword, user.password);
  
    if (!validPassword) {
      throw new Error('INVALID_CURRENT_PASSWORD');
    }
  
    // Hash de nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
  
    // Guardar nueva contraseña
    await user.update({
      password: hashedPassword,
      securityInfo: {
        ...user.securityInfo,
        passwordLastChanged: new Date()
      }
      
    });
  
    // Invalidar todos los tokens del usuario
    await TokenBlacklist.create({
      user_id: userId,
      token_type: TokenType.ACCESS,
      token_jti: `ACCOUNT_DELETE_${userId}_${Date.now()}`,
      token_hash: 'ACCOUNT_DELETED',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
      reason: RevocationReason.ACCOUNT_DELETED
    });
  
    return true;
  }
}

// Exportar instancia única del servicio
export const authService = new AuthService();