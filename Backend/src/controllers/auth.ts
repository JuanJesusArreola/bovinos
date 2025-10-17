import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User'; 
import { authService } from '../services/auth'; 
import logger from '../utils/logger';


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
      const { 
        firstName, 
        lastName, 
        email, 
        password, 
        confirmPassword 
      }: RegisterRequest = req.body;

      // Validación de datos básicos
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
          phone: '',
          role: 'RANCH_MANAGER' as any // Temporal, ajustar según necesidad
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
      logger.error('Error en registro', 'AuthController', { email: req.body?.email }, error as Error, );
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

      try {
        // Usar el servicio de auth para login
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
      logger.error('Error en login', 'AuthController', { email: req.body?.email }, error as Error );
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

      try {
        // Usar el servicio de auth para forgot password
        await this.authService.forgotPassword(email);

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
      logger.error('Error en forgot password', 'AuthController', { email: req.body?.email }, error as Error, );
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
        });

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
      logger.error('Error en reset password', 'AuthController', {}, error as Error, );
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
          refreshToken
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
      logger.error('Error en refresh token', 'AuthController', {}, error as Error, );
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

      if (userId) {
        try {
          // Usar el servicio de auth para logout
          await this.authService.logout(userId);
        } catch (serviceError: any) {
          // Log error but don't fail logout
          logger.error('Error en servicio de logout', 'AuthController', { userId }, serviceError as Error, );
        }
      }

      res.status(200).json({
        success: true,
        message: 'Sesión cerrada exitosamente',
        data: {
          logout: true
        }
      });

    } catch (error: any) {
      logger.error('Error en logout', 'AuthController', {}, error as Error, );
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
      logger.error('Error al obtener perfil', 'AuthController', { userId: (req as any).user?.id }, error as Error, );
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
  public verifyEmail = async (req: Request, res: Response): Promise<void> => {
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

      // Mock implementation - implementar cuando esté disponible en el servicio
      try {
        // const user = await this.authService.validateEmailVerificationToken(token);

        // Por ahora, mock response
        res.status(200).json({
          success: true,
          message: 'Email verificado exitosamente',
          data: {
            emailVerified: true
          }
        });

      } catch (serviceError: any) {
        res.status(400).json({
          success: false,
          message: 'Token de verificación inválido o expirado',
          errors: {
            token: serviceError.message || 'El enlace de verificación ha expirado o es inválido'
          }
        });
        return;
      }

    } catch (error: any) {
      logger.error('Error en verificación de email', 'AuthController', { token: req.body?.token }, error as Error, );
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al verificar el email'
        }
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
      logger.error('Error en actualización de contraseña', 'AuthController', { userId: (req as any).user?.id }, error as Error, );
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al actualizar la contraseña'
        }
      });
    }
  };
}

// Exportar instancia del controlador
export const authController = new AuthController();