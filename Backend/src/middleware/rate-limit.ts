import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';
import { logMessage, LogLevel } from './logging';

// Interface para configuración de límites
interface RateLimitConfig {
  windowMs: number;           // Ventana de tiempo en milisegundos
  maxRequests: number;        // Máximo número de requests en la ventana
  skipSuccessfulRequests?: boolean; // No contar requests exitosos
  skipFailedRequests?: boolean;     // No contar requests fallidos
  keyGenerator?: (req: Request) => string; // Función para generar clave única
  onLimitReached?: (req: Request, res: Response) => void; // Callback cuando se alcanza límite
}

// Interface para almacenar datos de rate limiting
interface RateLimitData {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// Tipos de endpoints con diferentes límites
export enum EndpointType {
  AUTH = 'auth',              // Autenticación
  CATTLE_READ = 'cattle_read', // Lectura de ganado
  CATTLE_WRITE = 'cattle_write', // Escritura de ganado
  HEALTH = 'health',          // Operaciones de salud
  VACCINATION = 'vaccination', // Vacunaciones
  REPORTS = 'reports',        // Generación de reportes
  MAPS = 'maps',             // Geolocalización
  FILES = 'files',           // Carga de archivos
  BULK_OPERATIONS = 'bulk',   // Operaciones masivas
  EXTERNAL_API = 'external'   // APIs externas
}

// Configuraciones de límites por tipo de endpoint y rol
const RATE_LIMIT_CONFIGS: Record<EndpointType, Record<UserRole, RateLimitConfig>> = {
  [EndpointType.AUTH]: {
    [UserRole.VIEWER]: { windowMs: 15 * 60 * 1000, maxRequests: 10 },      // 10 intentos/15min
    [UserRole.WORKER]: { windowMs: 15 * 60 * 1000, maxRequests: 15 },      // 15 intentos/15min
    [UserRole.VETERINARIAN]: { windowMs: 15 * 60 * 1000, maxRequests: 20 }, // 20 intentos/15min
    [UserRole.MANAGER]: { windowMs: 15 * 60 * 1000, maxRequests: 25 },     // 25 intentos/15min
    [UserRole.SUPER_ADMIN]: { windowMs: 15 * 60 * 1000, maxRequests: 50 },       // 50 intentos/15min
    [UserRole.OWNER]: { windowMs: 15 * 60 * 1000, maxRequests: 100 },       // 100 intentos/15min,
    [UserRole.RANCH_MANAGER]:{ windowMs: 60000, maxRequests: 45 },
  },
  [EndpointType.CATTLE_READ]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 30 },           // 30 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 60 },           // 60 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 100 },    // 100 req/min
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 150 },         // 150 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 300 },           // 300 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 500 },            // 500 req/min
    [UserRole.RANCH_MANAGER]:{ windowMs: 60 * 1000, maxRequests: 200},
  },
  [EndpointType.CATTLE_WRITE]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 0 },            // Sin acceso
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 20 },           // 20 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 40 },     // 40 req/min
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 80 },          // 80 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 150 },           // 150 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 300 },            // 300 req/min
    [UserRole.RANCH_MANAGER]:{ windowMs: 60 * 1000, maxRequests: 100 },
  },
  [EndpointType.HEALTH]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 10 },           // 10 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 15 },           // 15 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 60 },     // 60 req/min (prioritario)
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 40 },          // 40 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 80 },            // 80 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 120 },            // 120 req/min
    [UserRole.RANCH_MANAGER]:{ windowMs: 60 * 1000, maxRequests: 60 },
  },
  [EndpointType.VACCINATION]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 5 },            // 5 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 20 },           // 20 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 50 },     // 50 req/min (prioritario)
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 30 },          // 30 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 60 },            // 60 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 100 },            // 100 req/min
    [UserRole.RANCH_MANAGER]:{ windowMs: 60 * 1000, maxRequests: 50  },
  },
  [EndpointType.REPORTS]: {
    [UserRole.VIEWER]: { windowMs: 60 * 60 * 1000, maxRequests: 5 },       // 5 reportes/hora
    [UserRole.WORKER]: { windowMs: 60 * 60 * 1000, maxRequests: 10 },      // 10 reportes/hora
    [UserRole.VETERINARIAN]: { windowMs: 60 * 60 * 1000, maxRequests: 20 }, // 20 reportes/hora
    [UserRole.MANAGER]: { windowMs: 60 * 60 * 1000, maxRequests: 50 },     // 50 reportes/hora
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 60 * 1000, maxRequests: 100 },      // 100 reportes/hora
    [UserRole.OWNER]: { windowMs: 60 * 60 * 1000, maxRequests: 200 },       // 200 reportes/hora
    [UserRole.RANCH_MANAGER]:{ windowMs: 60 * 60 * 1000, maxRequests: 60 },
  },
  [EndpointType.MAPS]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 20 },           // 20 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 40 },           // 40 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 80 },     // 80 req/min
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 100 },         // 100 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 150 },           // 150 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 200 },            // 200 req/min
    [UserRole.RANCH_MANAGER]:{ windowMs: 60 * 1000, maxRequests: 100}
  },
  [EndpointType.FILES]: {
    [UserRole.VIEWER]: { windowMs: 60 * 60 * 1000, maxRequests: 2 },       // 2 uploads/hora
    [UserRole.WORKER]: { windowMs: 60 * 60 * 1000, maxRequests: 10 },      // 10 uploads/hora
    [UserRole.VETERINARIAN]: { windowMs: 60 * 60 * 1000, maxRequests: 25 }, // 25 uploads/hora
    [UserRole.MANAGER]: { windowMs: 60 * 60 * 1000, maxRequests: 50 },     // 50 uploads/hora
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 60 * 1000, maxRequests: 100 },      // 100 uploads/hora
    [UserRole.OWNER]: { windowMs: 60 * 60 * 1000, maxRequests: 200 },       // 200 uploads/hora
    [UserRole.RANCH_MANAGER]:{ windowMs: 60 * 60 * 1000, maxRequests: 50}
  },
  [EndpointType.BULK_OPERATIONS]: {
    [UserRole.VIEWER]: { windowMs: 60 * 60 * 1000, maxRequests: 0 },       // Sin acceso
    [UserRole.WORKER]: { windowMs: 60 * 60 * 1000, maxRequests: 2 },       // 2 operaciones/hora
    [UserRole.VETERINARIAN]: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 operaciones/hora
    [UserRole.MANAGER]: { windowMs: 60 * 60 * 1000, maxRequests: 10 },     // 10 operaciones/hora
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 60 * 1000, maxRequests: 20 },       // 20 operaciones/hora
    [UserRole.OWNER]: { windowMs: 60 * 60 * 1000, maxRequests: 50 },        // 50 operaciones/hora
    [UserRole.RANCH_MANAGER]:{ windowMs: 60 * 60 * 1000, maxRequests: 10}
  },
  [EndpointType.EXTERNAL_API]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 5 },            // 5 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 10 },           // 10 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 15 },     // 15 req/min
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 25 },          // 25 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 50 },            // 50 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 100 },            // 100 req/min
    [UserRole.RANCH_MANAGER]:{ windowMs: 60 * 1000, maxRequests: 25}
  }
};

// Almacén en memoria para rate limiting (en producción usar Redis)
const rateLimitStore = new Map<string, RateLimitData>();

// Límites especiales por IP para requests sin autenticación
const IP_RATE_LIMITS = {
  windowMs: 15 * 60 * 1000,   // 15 minutos
  maxRequests: 100            // 100 requests por IP
};

/**
 * Clase principal para manejo de rate limiting
 */
class RateLimiter {
  private static instance: RateLimiter;

  private constructor() {}

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Verificar si el request excede los límites
   */
  public checkLimit(key: string, config: RateLimitConfig): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalHits: number;
  } {
    const now = Date.now();
    const data = rateLimitStore.get(key);

    // Si no hay datos previos o la ventana ha expirado
    if (!data || now > data.resetTime) {
      const newData: RateLimitData = {
        count: 1,
        resetTime: now + config.windowMs,
        firstRequest: now
      };
      rateLimitStore.set(key, newData);

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: newData.resetTime,
        totalHits: 1
      };
    }

    // Incrementar contador
    data.count++;
    rateLimitStore.set(key, data);

    const allowed = data.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - data.count);

    return {
      allowed,
      remaining,
      resetTime: data.resetTime,
      totalHits: data.count
    };
  }

  /**
   * Limpiar entradas expiradas del store
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
      if (now > data.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Obtener estadísticas del rate limiter
   */
  public getStats(): {
    totalKeys: number;
    activeWindows: number;
    topConsumers: Array<{ key: string; hits: number; resetTime: number }>;
  } {
    const now = Date.now();
    const activeWindows = Array.from(rateLimitStore.entries())
      .filter(([, data]) => now <= data.resetTime);

    const topConsumers = activeWindows
      .map(([key, data]) => ({ key, hits: data.count, resetTime: data.resetTime }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return {
      totalKeys: rateLimitStore.size,
      activeWindows: activeWindows.length,
      topConsumers
    };
  }

  /**
   * Resetear límites para una clave específica
   */
  public resetKey(key: string): void {
    rateLimitStore.delete(key);
  }
}

const rateLimiter = RateLimiter.getInstance();

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);

/**
 * Generar clave única para rate limiting
 */
function generateRateLimitKey(req: Request, endpointType: EndpointType): string {
  const userId = req.userId || 'anonymous';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (userId === 'anonymous') {
    return `ip:${ip}:${endpointType}`;
  }
  
  return `user:${userId}:${endpointType}`;
}

/**
 * Middleware principal de rate limiting
 */
export const createRateLimit = (endpointType: EndpointType) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Determinar configuración según el rol del usuario
      let config: RateLimitConfig;
      
      if (!req.user || !req.userRole) {
        // Usuario no autenticado - usar límites de IP
        config = IP_RATE_LIMITS;
      } else {
        const userRole = req.userRole as UserRole;
        config = RATE_LIMIT_CONFIGS[endpointType][userRole];
      }

      // Generar clave única
      const key = generateRateLimitKey(req, endpointType);

      // Verificar límites
      const result = rateLimiter.checkLimit(key, config);

      // Agregar headers de rate limiting
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        'X-RateLimit-Window': config.windowMs.toString()
      });

      // Si se excede el límite
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        
        res.set({
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Hit': result.totalHits.toString()
        });

        // Log del evento
        logMessage(
          LogLevel.WARN,
          'rate_limit_exceeded',
          `Rate limit excedido para ${req.userRole || 'usuario anónimo'} en endpoint ${endpointType}`,
          {
            userId: req.userId,
            userEmail: req.user?.email,
            userRole: req.userRole,
            endpointType,
            ip: req.ip,
            path: req.originalUrl,
            totalHits: result.totalHits,
            limit: config.maxRequests,
            resetTime: new Date(result.resetTime).toISOString()
          }
        );

        // Respuesta de error
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Demasiadas solicitudes. Por favor, intente más tarde.',
            details: {
              limit: config.maxRequests,
              windowMs: config.windowMs,
              retryAfter: retryAfter,
              resetTime: new Date(result.resetTime).toISOString()
            },
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            method: req.method
          }
        });

        return;
      }

      // Log para monitoreo cuando se está cerca del límite (80%)
      if (result.remaining <= config.maxRequests * 0.2) {
        logMessage(
          LogLevel.INFO,
          'rate_limit_warning',
          `Usuario cerca del límite de rate limit: ${result.totalHits}/${config.maxRequests}`,
          {
            userId: req.userId,
            userEmail: req.user?.email,
            userRole: req.userRole,
            endpointType,
            remaining: result.remaining,
            totalHits: result.totalHits
          }
        );
      }

      next();

    } catch (error) {
      // En caso de error en rate limiting, permitir el request pero logear el error
      logMessage(
        LogLevel.ERROR,
        'rate_limit_error',
        `Error en rate limiting: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        {
          userId: req.userId,
          endpointType,
          path: req.originalUrl,
          error: error instanceof Error ? error.stack : error
        }
      );

      next();
    }
  };
};

/**
 * Middleware de rate limiting adaptativo basado en la carga del sistema
 */
export const adaptiveRateLimit = (endpointType: EndpointType, loadFactor: number = 1.0) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const baseMiddleware = createRateLimit(endpointType);
    
    // Ajustar límites según la carga del sistema
    if (req.user && req.userRole) {
      const userRole = req.userRole as UserRole;
      const originalConfig = RATE_LIMIT_CONFIGS[endpointType][userRole];
      const adjustedConfig = {
        ...originalConfig,
        maxRequests: Math.floor(originalConfig.maxRequests * loadFactor)
      };
      
      // Aplicar configuración ajustada temporalmente
      RATE_LIMIT_CONFIGS[endpointType][userRole] = adjustedConfig;
      
      baseMiddleware(req, res, (error) => {
        // Restaurar configuración original
        RATE_LIMIT_CONFIGS[endpointType][userRole] = originalConfig;
        next(error);
      });
    } else {
      baseMiddleware(req, res, next);
    }
  };
};

/**
 * Middleware especial para operaciones críticas veterinarias
 */
export const veterinaryPriorityLimit = (req: Request, res: Response, next: NextFunction): void => {
  // Veterinarios tienen prioridad en operaciones críticas
  if (req.userRole === UserRole.VETERINARIAN) {
    // Límites más permisivos para veterinarios
    const priorityConfig: RateLimitConfig = {
      windowMs: 60 * 1000,
      maxRequests: 200  // Límite muy alto para emergencias
    };
    
    const key = `priority:${req.userId}:veterinary`;
    const result = rateLimiter.checkLimit(key, priorityConfig);
    
    if (!result.allowed) {
      res.status(429).json({
        success: false,
        error: {
          code: 'VETERINARY_RATE_LIMIT_EXCEEDED',
          message: 'Límite de operaciones veterinarias excedido',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
  }
  
  next();
};

/**
 * Función para obtener estadísticas de rate limiting
 */
export const getRateLimitStats = (): {
  totalKeys: number;
  activeWindows: number;
  topConsumers: Array<{ key: string; hits: number; resetTime: number }>;
} => {
  return rateLimiter.getStats();
};

/**
 * Función para resetear límites de un usuario específico
 */
export const resetUserRateLimit = (userId: string, endpointType?: EndpointType): void => {
  if (endpointType) {
    const key = `user:${userId}:${endpointType}`;
    rateLimiter.resetKey(key);
  } else {
    // Resetear todos los límites del usuario
    Object.values(EndpointType).forEach(type => {
      const key = `user:${userId}:${type}`;
      rateLimiter.resetKey(key);
    });
  }
};

/**
 * Middleware para bypass de rate limiting en casos de emergencia
 */
export const emergencyBypass = (req: Request, res: Response, next: NextFunction): void => {
  // Verificar si hay un header de emergencia válido
  const emergencyToken = req.headers['x-emergency-token'] as string;
  const validEmergencyToken = process.env.EMERGENCY_BYPASS_TOKEN;
  
  if (emergencyToken && validEmergencyToken && emergencyToken === validEmergencyToken) {
    logMessage(
      LogLevel.WARN,
      'emergency_bypass_used',
      'Rate limit bypass usado en emergencia',
      {
        userId: req.userId,
        userEmail: req.user?.email,
        path: req.originalUrl,
        ip: req.ip
      }
    );
    
    // Agregar header indicando bypass
    res.set('X-Rate-Limit-Bypassed', 'emergency');
    
    return next();
  }
  
  next();
};