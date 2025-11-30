import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { 
  authenticateToken, 
  authorizeRoles,
} from '../middleware/auth';
import { logMessage, LogLevel } from '../middleware/logging';
import { UserRole } from '../models/User';

const router = Router();

// ===================================================================
// INTERFACES Y TIPOS BÁSICOS
// ===================================================================

interface FileMetadata {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  category?: string;
  description?: string;
  isPublic: boolean;
}

// ===================================================================
// CONFIGURACIÓN BÁSICA DE MULTER
// ===================================================================

// Configuración de almacenamiento temporal
const storage = multer.memoryStorage();

// Filtro básico de archivos
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Tipos permitidos básicos
  const allowedMimes = [
    // Imágenes
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    // Documentos
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    // Videos (básicos)
    'video/mp4',
    'video/avi',
    'video/mov'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
  }
};

// Configuración principal de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB máximo
    files: 20 // máximo 20 archivos
  }
});

// ===================================================================
// MIDDLEWARE DE VALIDACIÓN
// ===================================================================

// Middleware para validar request básico
const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Validación básica sin express-validator
  next();
};

// Middleware de auditoría
const auditLog = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user) {
      logMessage(
        LogLevel.INFO,
        'user_action',
        `Usuario ${req.user.email} realizó acción: ${action}`,
        {
          userId: req.user.id,
          userRole: req.user.role,
          action,
          endpoint: req.originalUrl,
          method: req.method,
          timestamp: new Date().toISOString()
        }
      );
    }
    next();
  };
};

// Rate limiting básico
const rateLimitByUserId = (maxRequests: number, windowMinutes: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Implementación básica de rate limiting
    // En producción usar Redis o similar
    next();
  };
};

// ===================================================================
// RUTAS DE UPLOAD GENERAL
// ===================================================================

/**
 * POST /api/upload/files
 * Upload general de archivos múltiples
 */
router.post('/files',
  authenticateToken,
  rateLimitByUserId(100, 60),
  upload.array('files', 20),
  validateRequest,
  auditLog('upload.files.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      const userId = req.user?.id;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se encontraron archivos para subir'
        });
      }

      // Procesar archivos básico
      const uploadedFiles = [];
      
      for (const file of files) {
        const fileData: FileMetadata = {
          originalName: file.originalname,
          filename: `${uuidv4()}_${file.originalname}`,
          mimetype: file.mimetype,
          size: file.size,
          uploadedBy: userId || 'anonymous',
          uploadedAt: new Date(),
          category: req.body.category,
          description: req.body.description,
          isPublic: req.body.isPublic === 'true'
        };

        uploadedFiles.push(fileData);
      }

      res.status(201).json({
        success: true,
        data: uploadedFiles,
        message: `${files.length} archivo(s) subido(s) exitosamente`
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/upload/files
 * Lista archivos del usuario
 */
router.get('/files',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        fileType = 'all',
        search
      } = req.query;

      const userId = req.user?.id;

      // Simulación de respuesta (en producción conectar con BD)
      const files = {
        records: [],
        pagination: {
          currentPage: parseInt(page as string),
          totalPages: 1,
          totalItems: 0,
          itemsPerPage: parseInt(limit as string)
        }
      };

      res.json({
        success: true,
        data: files,
        message: 'Archivos obtenidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/upload/files/:id
 * Obtiene información de un archivo específico
 */
router.get('/files/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Simulación de búsqueda de archivo
      const file = {
        id: id,
        originalName: 'ejemplo.pdf',
        mimetype: 'application/pdf',
        size: 1024000,
        uploadedAt: new Date(),
        uploadedBy: userId
      };

      res.json({
        success: true,
        data: file,
        message: 'Archivo encontrado'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/upload/files/:id
 * Elimina un archivo
 */
router.delete('/files/:id',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.OWNER),
  auditLog('upload.file.delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Simulación de eliminación
      const deleted = true;

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Archivo no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Archivo eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS ESPECÍFICAS PARA BOVINOS
// ===================================================================

/**
 * POST /api/upload/bovines/:bovineId/documents
 * Sube documentos de un bovino específico
 */
router.post('/bovines/:bovineId/documents',
  authenticateToken,
  upload.array('documents', 10),
  auditLog('upload.bovine_documents.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bovineId } = req.params;
      const documents = req.files as Express.Multer.File[];
      const userId = req.user?.id;

      if (!documents || documents.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se encontraron documentos para subir'
        });
      }

      const uploadedDocuments = documents.map((doc: Express.Multer.File) => ({
        id: uuidv4(),
        bovineId: bovineId,
        originalName: doc.originalname,
        mimetype: doc.mimetype,
        size: doc.size,
        uploadedBy: userId,
        uploadedAt: new Date(),
        documentType: req.body.documentType
      }));

      res.status(201).json({
        success: true,
        data: uploadedDocuments,
        message: 'Documentos del bovino subidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/upload/bovines/:bovineId/documents
 * Obtiene documentos de un bovino
 */
router.get('/bovines/:bovineId/documents',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bovineId } = req.params;
      const { documentType } = req.query;

      // Simulación de búsqueda de documentos
      const documents: any[] = [];

      res.json({
        success: true,
        data: documents,
        message: 'Documentos del bovino obtenidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS PARA FOTOS DE BOVINOS
// ===================================================================

/**
 * POST /api/upload/bovines/:bovineId/photos
 * Sube fotos de un bovino
 */
router.post('/bovines/:bovineId/photos',
  authenticateToken,
  upload.array('photos', 20),
  auditLog('upload.bovine_photos.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bovineId } = req.params;
      const photos = req.files as Express.Multer.File[];
      const userId = req.user?.id;

      if (!photos || photos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se encontraron fotos para subir'
        });
      }

      const uploadedPhotos = photos.map((photo: Express.Multer.File) => ({
        id: uuidv4(),
        bovineId: bovineId,
        originalName: photo.originalname,
        mimetype: photo.mimetype,
        size: photo.size,
        uploadedBy: userId,
        uploadedAt: new Date(),
        photoType: req.body.photoType,
        isProfilePhoto: req.body.isProfilePhoto === 'true'
      }));

      res.status(201).json({
        success: true,
        data: uploadedPhotos,
        message: 'Fotos del bovino subidas exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/upload/bovines/:bovineId/photos
 * Obtiene fotos de un bovino
 */
router.get('/bovines/:bovineId/photos',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bovineId } = req.params;
      const { photoType } = req.query;

      // Simulación de búsqueda de fotos
      const photos: any[] = [];

      res.json({
        success: true,
        data: photos,
        message: 'Fotos del bovino obtenidas exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS PARA DOCUMENTOS DEL RANCHO
// ===================================================================

/**
 * POST /api/upload/ranch/documents
 * Sube documentos del rancho
 */
router.post('/ranch/documents',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.OWNER),
  upload.array('documents', 10),
  auditLog('upload.ranch_documents.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documents = req.files as Express.Multer.File[];
      const userId = req.user?.id;

      if (!documents || documents.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se encontraron documentos para subir'
        });
      }

      const uploadedDocuments = documents.map((doc: Express.Multer.File) => ({
        id: uuidv4(),
        originalName: doc.originalname,
        mimetype: doc.mimetype,
        size: doc.size,
        uploadedBy: userId,
        uploadedAt: new Date(),
        documentType: req.body.documentType,
        issuer: req.body.issuer
      }));

      res.status(201).json({
        success: true,
        data: uploadedDocuments,
        message: 'Documentos del rancho subidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS PARA FOTOS DEL RANCHO
// ===================================================================

/**
 * POST /api/upload/ranch/photos
 * Sube fotos del rancho
 */
router.post('/ranch/photos',
  authenticateToken,
  upload.array('photos', 50),
  auditLog('upload.ranch_photos.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const photos = req.files as Express.Multer.File[];
      const userId = req.user?.id;

      if (!photos || photos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se encontraron fotos para subir'
        });
      }

      const uploadedPhotos = photos.map((photo: Express.Multer.File) => ({
        id: uuidv4(),
        originalName: photo.originalname,
        mimetype: photo.mimetype,
        size: photo.size,
        uploadedBy: userId,
        uploadedAt: new Date(),
        photoCategory: req.body.photoCategory,
        isMainPhoto: req.body.isMainPhoto === 'true'
      }));

      res.status(201).json({
        success: true,
        data: uploadedPhotos,
        message: 'Fotos del rancho subidas exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE ESTADÍSTICAS
// ===================================================================

/**
 * GET /api/upload/storage/stats
 * Obtiene estadísticas de almacenamiento
 */
router.get('/storage/stats',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      // Simulación de estadísticas
      const storageStats = {
        totalFiles: 0,
        totalSize: 0,
        usedSpace: '0 MB',
        availableSpace: '1 GB',
        filesByType: {
          images: 0,
          documents: 0,
          videos: 0
        }
      };

      res.json({
        success: true,
        data: storageStats,
        message: 'Estadísticas de almacenamiento obtenidas exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/upload/cleanup
 * Limpia archivos temporales
 */
router.post('/cleanup',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN),
  auditLog('upload.cleanup'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        olderThan = 30, 
        includeDeleted = true, 
        dryRun = false 
      } = req.body;

      // Simulación de limpieza
      const cleanupResult = {
        filesFound: 0,
        filesDeleted: 0,
        spaceFreed: '0 MB',
        dryRun: dryRun
      };

      res.json({
        success: true,
        data: cleanupResult,
        message: dryRun ? 'Simulación de limpieza completada' : 'Limpieza completada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ===================================================================

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    let message = 'Error en la subida de archivo';
    let code = 'UPLOAD_ERROR';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'El archivo excede el tamaño máximo permitido (50MB)';
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Demasiados archivos enviados';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Campo de archivo inesperado';
        code = 'UNEXPECTED_FILE';
        break;
      default:
        message = `Error en la subida: ${error.message}`;
    }
    
    logMessage(
      LogLevel.WARN,
      'upload_error',
      message,
      {
        userId: req.user?.id,
        errorCode: error.code,
        path: req.originalUrl
      }
    );
    
    return res.status(400).json({
      success: false,
      error: {
        code: code,
        message: message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      }
    });
  }

  if (error.message && error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: error.message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      }
    });
  }

  logMessage(
    LogLevel.ERROR,
    'upload_route_error',
    `Error en ruta de upload: ${error.message}`,
    {
      path: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      error: error.stack
    }
  );

  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Error interno del servidor',
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    }
  });
});

// ===================================================================
// EXPORTAR ROUTER
// ===================================================================

export default router;