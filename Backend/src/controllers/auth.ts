import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authService } from '../services/auth';
import logger from '../utils/logger';
import { UserRole } from '@/config';


const bcrypt = {
  async hash(password: string, saltRounds: number): Promise<string> {
    return `hashed_${password}_salt_${saltRounds}`;
  },
  async compare(password: string, hash: string): Promise<boolean> {
    return hash === `hashed_${password}_salt_12`;
  }
};

const validateEmail = (email: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

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

const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

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

  // Verificar complejidad
  let complexity = 0;

  if (/[a-z]/.test(password)) complexity++;      // Minúsculas
  if (/[A-Z]/.test(password)) complexity++;      // Mayúsculas
  if (/[0-9]/.test(password)) complexity++;      // Números
  if (/[^a-zA-Z0-9]/.test(password)) complexity++; // Caracteres especiales

  if (complexity < 3) {
    errors.push('La contraseña debe contener al menos 3 de los siguientes: minúsculas, mayúsculas, números, caracteres especiales');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Funciones helper temporales - Mover a utils/helpers cuando existan
const generateAccessToken = (user: any): string => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const generateRefreshToken = (user: any): string => {
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
  return jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

const verifyRefreshToken = (token: string): { userId: string } | null => {
  try {
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
};

// Interfaces para tipos de datos de autenticación
interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface ForgotPasswordRequest {
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

export class AuthController {
  private authService: typeof authService;

  constructor() {
    this.authService = authService;
  }

  /**
   * Registro de nuevo usuario
   * POST /api/auth/register
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const {firstName, lastName, email, password, confirmPassword, phone, role } = req.body;
  

      // Validación de datos básicos
      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        res.status(400).json({
          success: false,
          message: 'Todos los campos son obligatorios',
          errors: {
            general: 'Por favor complete todos los campos requeridos'
          }
        });
        return;
      }

      // Validación de confirmación de contraseña
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

      // Validación de formato de email
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

      // Validación de fortaleza de contraseña
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

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({
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

      // Usar el servicio de auth para registrar
      try {
        const authResponse = await this.authService.register({
          
          email,
          password,
          confirmPassword,
          firstName,
          lastName,
          phone,
          role
        });

        res.status(201).json({
          success: true,
          message: 'Usuario registrado exitosamente',
          data: authResponse
        });

      } catch (serviceError: any) {
        res.status(400).json({
          success: false,
          message: serviceError.message || 'Error en el registro',
          errors: {
            general: serviceError.message || 'Error inesperado en el registro'
          }
        });
        return;
      }

    } catch (error: any) {
      logger.error('Error en registro', 'AuthController', { email: req.body?.email }, error as Error,);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error inesperado. Por favor intente nuevamente.'
        }
      });
    }
  };

  /**
   * Inicio de sesión
   * POST /api/auth/login
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password }: LoginRequest = req.body;

      // Validación de datos básicos
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

      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      try {
        // Usar el servicio de auth para login
        const authResponse = await this.authService.login({
          email,
          password,
          rememberMe: false,
          ipAddress,
          userAgent
        });

        res.status(200).json({
          success: true,
          message: 'Inicio de sesión exitoso',
          data: authResponse
        });

      } catch (serviceError: any) {
        res.status(401).json({
          success: false,
          message: 'Credenciales inválidas',
          errors: {
            general: serviceError.message || 'Email o contraseña incorrectos'
          }
        });
        return;
      }

    } catch (error: any) {
      logger.error('Error en login', 'AuthController', { email: req.body?.email }, error as Error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error inesperado. Por favor intente nuevamente.'
        }
      });
    }
  };

  /**
   * Solicitud de recuperación de contraseña
   * POST /api/auth/forgot-password
   */
  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email }: ForgotPasswordRequest = req.body;

      // Validación de email
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
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      try {
        // Usar el servicio de auth para forgot password
        await this.authService.forgotPassword(email, ipAddress, userAgent);
        res.status(200).json({
          success: true,
          message: 'Se ha enviado un email con instrucciones para recuperar tu contraseña',
          data: {
            emailSent: true
          }
        });

      } catch (serviceError: any) {
        // Por seguridad, siempre respondemos exitosamente
        res.status(200).json({
          success: true,
          message: 'Si el email existe en nuestro sistema, recibirás instrucciones para recuperar tu contraseña',
          data: {
            emailSent: true
          }
        });
      }

    } catch (error: any) {
      logger.error('Error en forgot password', 'AuthController', { email: req.body?.email }, error as Error,);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al procesar la solicitud. Por favor intente nuevamente.'
        }
      });
    }
  };

  /**
   * Restablecimiento de contraseña
   * POST /api/auth/reset-password
   */
  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const { token, password, confirmPassword }: ResetPasswordRequest = req.body;

      // Validación de datos básicos
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

      // Validación de confirmación de contraseña
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

      // Validación de fortaleza de contraseña
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
        // Usar el servicio de auth para reset password
        await this.authService.resetPassword({
          token,
          newPassword: password,
          confirmPassword
        }, ipAddress, userAgent);

        res.status(200).json({
          success: true,
          message: 'Contraseña restablecida exitosamente',
          data: {
            passwordReset: true
          }
        });

      } catch (serviceError: any) {
        res.status(400).json({
          success: false,
          message: 'Token inválido o expirado',
          errors: {
            token: serviceError.message || 'El enlace de recuperación ha expirado o es inválido'
          }
        });
        return;
      }

    } catch (error: any) {
      logger.error('Error en reset password', 'AuthController', {}, error as Error,);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al restablecer la contraseña. Por favor intente nuevamente.'
        }
      });
    }
  };

  /**
   * Renovación de token de acceso
   * POST /api/auth/refresh-token
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const { refreshToken }: RefreshTokenRequest = req.body;

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
        // Usar el servicio de auth para refresh token
        const tokenResponse = await this.authService.refreshToken({
          refreshToken, 
          ipAddress,
          userAgent
        });

        res.status(200).json({
          success: true,
          message: 'Tokens renovados exitosamente',
          data: tokenResponse
        });

      } catch (serviceError: any) {
        res.status(401).json({
          success: false,
          message: 'Refresh token inválido',
          errors: {
            refreshToken: serviceError.message || 'Token de renovación inválido o expirado'
          }
        });
        return;
      }

    } catch (error: any) {
      logger.error('Error en refresh token', 'AuthController', {}, error as Error,);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al renovar el token. Por favor inicie sesión nuevamente.'
        }
      });
    }
  };

  /**
   * Cerrar sesión
   * POST /api/auth/logout
   */
  public logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // Obtener usuario del middleware de autenticación
      const userId = (req as any).user?.id;

      // Extraer el token del header Authorization para invalidarlo
      // Formato: "Bearer <token>"
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      // Extraer IP y user agent de la request para auditoría
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

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

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Token no encontrado en la solicitud',
          errors: {
            token: 'No se pudo extraer el token del header Authorization'
          }
        });
        return;
      }

      try {
        // Usar el servicio de auth para logout con token, userId, IP y user agent
        await this.authService.logout(token, userId, ipAddress, userAgent);
      } catch (serviceError: any) {
        // Log error but don't fail logout
        logger.error('Error en servicio de logout', 'AuthController', { userId }, serviceError as Error,);
      }

      res.status(200).json({
        success: true,
        message: 'Sesión cerrada exitosamente',
        data: {
          logout: true
        }
      });

    } catch (error: any) {
      logger.error('Error en logout', 'AuthController', {}, error as Error,);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al cerrar la sesión'
        }
      });
    }
  };

  /**
   * Obtener perfil del usuario autenticado
   * GET /api/auth/profile
   */
  public getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;

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

      const user = await User.findByPk(userId, {
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

      // Formatear respuesta del usuario
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

    } catch (error: any) {
      logger.error('Error al obtener perfil', 'AuthController', { userId: (req as any).user?.id }, error as Error,);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al obtener el perfil'
        }
      });
    }
  };

  /**
 * Verificar email del usuario
 * POST /api/auth/verify-email
 */
  public verifyEmail = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { token } = req.body;
  
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token de verificación es obligatorio',
          errors: { token: 'Token requerido' }
        });
      }
  
      const isVerified = await this.authService.verifyEmail(token);
  
      if (!isVerified) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido o expirado',
          errors: { token: 'El enlace de verificación no es válido o expiró' }
        });
      }
  
      return res.status(200).json({
        success: true,
        message: 'Email verificado exitosamente',
        data: { emailVerified: true }
      });
  
    } catch (error) {
      logger.error('Error en verificación de email', 'AuthController', { token: req.body?.token }, error as Error);
  
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: { general: 'Ocurrió un error al verificar el email' }
      });
    }
  };


  /**
   * Actualizar contraseña del usuario autenticado
   * POST /api/auth/update-password
   */
  public updatePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
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

      // Validación de datos básicos
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

      // Validación de confirmación de contraseña
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

      // Validación de fortaleza de contraseña
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
        // Usar el servicio de auth para actualizar contraseña
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

      } catch (serviceError: any) {
        res.status(400).json({
          success: false,
          message: serviceError.message || 'Error al actualizar contraseña',
          errors: {
            currentPassword: serviceError.message || 'Contraseña actual incorrecta'
          }
        });
        return;
      }

    } catch (error: any) {
      logger.error('Error en actualización de contraseña', 'AuthController', { userId: (req as any).user?.id }, error as Error,);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al actualizar la contraseña'
        }
      });
    }
  };

  public updateProfile = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as any).user?.id; // viene del middleware authenticateToken
      const { firstName, lastName, phone } = req.body;
  
      const updatedUser = await authService.updateProfile(userId, {
        firstName,
        lastName,
        phone
      });
  
      return res.status(200).json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: updatedUser
      });
  
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Error al actualizar tu perfil',
        error: error.message || 'PROFILE_UPDATE_FAILED'
      });
    }
  };

  public deleteAccount = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as any).user?.id; 
      const { password, confirmation } = req.body;
  
      await authService.deleteAccount(userId, password, confirmation);
  
      return res.status(200).json({
        success: true,
        message: 'Cuenta eliminada exitosamente'
      });
  
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Error al eliminar la cuenta',
        error: error.message || 'ACCOUNT_DELETION_FAILED'
      });
    }
  };

  public changePassword = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = (req as any).user?.id;  // colocado por authenticateToken
      const { currentPassword, newPassword, confirmPassword } = req.body;
  
      await authService.changePassword(userId, {
        currentPassword,
        newPassword,
        confirmPassword
      });
  
      return res.status(200).json({
        success: true,
        message: 'Contraseña cambiada exitosamente'
      });
  
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Error al cambiar la contraseña',
        error: error.message || 'PASSWORD_CHANGE_FAILED'
      });
    }
  };
}

// Exportar instancia del controlador
export const authController = new AuthController();