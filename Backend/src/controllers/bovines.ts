import { Request, Response } from 'express';
import { Op, fn, col } from 'sequelize';
import sequelize from '../config/database'; // Importación corregida como default
import Bovine, { 
  CattleType, 
  HealthStatus, 
  VaccinationStatus, 
  GenderType, 
  LocationData,
  PhysicalMetrics,
  ReproductiveInfo,
  TrackingConfig 
} from '../models/Bovine'; // Usando los tipos correctos del modelo
import Location from '../models/Location'; // Importación corregida
import { bovineService } from '../services/bovine'; // Importando la instancia del servicio


// Interfaces para requests - adaptadas al modelo real
interface CreateBovineRequest {
  earTag: string;
  name?: string;
  cattleType: CattleType; // Cambiado de 'type' a 'cattleType'
  breed: string;
  gender: GenderType; // Usando GenderType del modelo
  birthDate: Date;
  weight?: number;
  motherId?: string; // Cambiado de motherEarTag a motherId
  fatherId?: string; // Cambiado de fatherEarTag a fatherId
  location: LocationData; // Usando LocationData del modelo
  healthStatus?: HealthStatus;
  vaccinationStatus?: VaccinationStatus;
  physicalMetrics?: PhysicalMetrics;
  reproductiveInfo?: ReproductiveInfo;
  trackingConfig?: TrackingConfig;
  farmId?: string;
  ownerId?: string;
  notes?: string;
  images?: string[]; // Cambiado de 'photos' a 'images'
}

interface UpdateBovineRequest extends Partial<CreateBovineRequest> {
  id: string;
}

interface BovineSearchParams {
  searchTerm?: string;
  cattleType?: CattleType; // Cambiado de 'type' a 'cattleType'
  breed?: string;
  gender?: GenderType;
  healthStatus?: HealthStatus;
  vaccinationStatus?: VaccinationStatus;
  ageMin?: number;
  ageMax?: number;
  weightMin?: number;
  weightMax?: number;
  locationRadius?: number;
  centerLatitude?: number;
  centerLongitude?: number;
  hasVaccinations?: boolean;
  hasIllnesses?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  farmId?: string;
  ownerId?: string;
}

interface BulkOperationRequest {
  ids: string[];
  operation: 'update' | 'delete' | 'vaccinate' | 'move_location' | 'change_health_status';
  data?: any;
}

// Tipos temporales para mantener compatibilidad (hasta que tengas los modelos)
interface Vaccination {
  id: string;
  bovineId: string;
  vaccineType: string;
  applicationDate: Date;
  nextDueDate?: Date;
}

interface Illness {
  id: string;
  bovineId: string;
  diseaseName: string;
  diagnosisDate: Date;
  severity: string;
}

export class BovinesController {
  /**
   * Crear nuevo bovino
   * POST /api/bovines
   */
  public createBovine = async (req: Request, res: Response): Promise<void> => {
    try {
      const bovineData: CreateBovineRequest = req.body;

      // Validaciones básicas
      if (!bovineData.earTag || !bovineData.cattleType || !bovineData.breed || !bovineData.gender) {
        res.status(400).json({
          success: false,
          message: 'Campos obligatorios faltantes',
          errors: {
            general: 'EarTag, tipo, raza y género son obligatorios'
          }
        });
        return;
      }

      // Validar que el earTag sea único
      const existingBovine = await Bovine.findOne({ 
        where: { earTag: bovineData.earTag } 
      });

      if (existingBovine) {
        res.status(409).json({
          success: false,
          message: 'El número de arete ya existe',
          errors: {
            earTag: 'Ya existe un bovino con este número de arete'
          }
        });
        return;
      }

      // Validar ubicación
      if (!bovineData.location || !bovineData.location.latitude || !bovineData.location.longitude) {
        res.status(400).json({
          success: false,
          message: 'Ubicación es obligatoria',
          errors: {
            location: 'Las coordenadas de latitud y longitud son obligatorias'
          }
        });
        return;
      }

      // Usar el servicio para crear el bovino
      const newBovine = await bovineService.createBovine({
        earTag: bovineData.earTag,
        name: bovineData.name,
        cattleType: bovineData.cattleType,
        breed: bovineData.breed,
        gender: bovineData.gender,
        birthDate: bovineData.birthDate,
        weight: bovineData.weight,
        location: bovineData.location,
        healthStatus: bovineData.healthStatus || HealthStatus.HEALTHY,
        vaccinationStatus: bovineData.vaccinationStatus || VaccinationStatus.NONE,
        physicalMetrics: bovineData.physicalMetrics,
        reproductiveInfo: bovineData.reproductiveInfo,
        trackingConfig: bovineData.trackingConfig,
        farmId: bovineData.farmId,
        ownerId: bovineData.ownerId,
        notes: bovineData.notes
      }, req.user?.id || 'system');

      res.status(201).json({
        success: true,
        message: 'Bovino creado exitosamente',
        data: {
          bovine: newBovine
        }
      });

    } catch (error) {
      console.error('Error al crear bovino:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: error instanceof Error ? error.message : 'Ocurrió un error inesperado al crear el bovino'
        }
      });
    }
  };

  /**
   * Obtener lista de bovinos con filtros
   * GET /api/bovines
   */
  public getBovines = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        searchTerm,
        cattleType, // Cambiado de 'type' a 'cattleType'
        breed,
        gender,
        healthStatus,
        vaccinationStatus,
        ageMin,
        ageMax,
        weightMin,
        weightMax,
        locationRadius,
        centerLatitude,
        centerLongitude,
        hasVaccinations,
        hasIllnesses,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        farmId,
        ownerId
      }: BovineSearchParams = req.query as any;

      // Construir filtros
      const filters = {
        searchTerm,
        cattleType,
        breed,
        gender,
        healthStatus,
        vaccinationStatus,
        farmId,
        ownerId,
        ...(ageMin !== undefined || ageMax !== undefined ? {
          ageRange: { min: Number(ageMin) || 0, max: Number(ageMax) || 999 }
        } : {}),
        ...(weightMin !== undefined || weightMax !== undefined ? {
          weightRange: { min: Number(weightMin) || 0, max: Number(weightMax) || 9999 }
        } : {}),
        ...(locationRadius && centerLatitude && centerLongitude ? {
          locationRadius: {
            center: { latitude: Number(centerLatitude), longitude: Number(centerLongitude) },
            radiusKm: Number(locationRadius)
          }
        } : {})
      };

      // Usar el servicio para obtener bovinos
      const result = await bovineService.getBovines(
        filters,
        {
          page: Number(page),
          limit: Math.min(Number(limit), 100),
          sortBy,
          sortOrder
        },
        req.user?.id || 'system'
      );

      res.status(200).json({
        success: true,
        message: 'Bovinos obtenidos exitosamente',
        data: result
      });

    } catch (error) {
      console.error('Error al obtener bovinos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al obtener los bovinos'
        }
      });
    }
  };

  /**
   * Obtener bovino específico por ID
   * GET /api/bovines/:id
   */
  public getBovineById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const bovine = await bovineService.getBovineById(id, req.user?.id || 'system');

      if (!bovine) {
        res.status(404).json({
          success: false,
          message: 'Bovino no encontrado',
          errors: {
            bovine: 'El bovino especificado no existe o ha sido eliminado'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Bovino obtenido exitosamente',
        data: {
          bovine: bovine
        }
      });

    } catch (error) {
      console.error('Error al obtener bovino:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: error instanceof Error ? error.message : 'Ocurrió un error al obtener el bovino'
        }
      });
    }
  };

  /**
   * Actualizar bovino
   * PUT /api/bovines/:id
   */
  public updateBovine = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData: UpdateBovineRequest = { ...req.body, id };

      const updatedBovine = await bovineService.updateBovine(updateData, req.user?.id || 'system');

      res.status(200).json({
        success: true,
        message: 'Bovino actualizado exitosamente',
        data: {
          bovine: updatedBovine
        }
      });

    } catch (error) {
      console.error('Error al actualizar bovino:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: error instanceof Error ? error.message : 'Ocurrió un error al actualizar el bovino'
        }
      });
    }
  };

  /**
   * Eliminar bovino (eliminación lógica)
   * DELETE /api/bovines/:id
   */
  public deleteBovine = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      await bovineService.deleteBovine(id, req.user?.id || 'system');

      res.status(200).json({
        success: true,
        message: 'Bovino eliminado exitosamente',
        data: {
          deleted: true
        }
      });

    } catch (error) {
      console.error('Error al eliminar bovino:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: error instanceof Error ? error.message : 'Ocurrió un error al eliminar el bovino'
        }
      });
    }
  };

  /**
   * Obtener estadísticas de bovinos
   * GET /api/bovines/stats
   */
  public getBovineStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { farmId } = req.query;
      
      const stats = await bovineService.getBovineStatistics(
        farmId as string,
        req.user?.id || 'system'
      );

      res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: {
          stats
        }
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error al obtener las estadísticas'
        }
      });
    }
  };

  /**
   * Actualizar ubicación de bovino
   * PUT /api/bovines/:id/location
   */
  public updateBovineLocation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { location, source, notes } = req.body;

      if (!location || !location.latitude || !location.longitude) {
        res.status(400).json({
          success: false,
          message: 'Datos de ubicación inválidos',
          errors: {
            location: 'Latitud y longitud son requeridas'
          }
        });
        return;
      }

      await bovineService.updateBovineLocation(
        {
          bovineId: id,
          location,
          source: source || 'MANUAL',
          notes,
          timestamp: new Date()
        },
        req.user?.id || 'system'
      );

      res.status(200).json({
        success: true,
        message: 'Ubicación actualizada exitosamente',
        data: {
          updated: true
        }
      });

    } catch (error) {
      console.error('Error al actualizar ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: error instanceof Error ? error.message : 'Ocurrió un error al actualizar la ubicación'
        }
      });
    }
  };

  /**
   * Buscar bovinos por ubicación
   * POST /api/bovines/search-by-location
   */
  public getBovinesByLocation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { centerLocation, radiusKm } = req.body;

      if (!centerLocation || !centerLocation.latitude || !centerLocation.longitude) {
        res.status(400).json({
          success: false,
          message: 'Ubicación central inválida',
          errors: {
            centerLocation: 'Latitud y longitud son requeridas'
          }
        });
        return;
      }

      if (!radiusKm || radiusKm <= 0) {
        res.status(400).json({
          success: false,
          message: 'Radio de búsqueda inválido',
          errors: {
            radiusKm: 'El radio debe ser mayor a 0'
          }
        });
        return;
      }

      const bovines = await bovineService.getBovinesByLocation(
        centerLocation,
        Number(radiusKm),
        req.user?.id || 'system'
      );

      res.status(200).json({
        success: true,
        message: 'Búsqueda por ubicación completada',
        data: {
          bovines,
          searchParams: {
            centerLocation,
            radiusKm: Number(radiusKm),
            totalFound: bovines.length
          }
        }
      });

    } catch (error) {
      console.error('Error en búsqueda por ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: error instanceof Error ? error.message : 'Ocurrió un error en la búsqueda por ubicación'
        }
      });
    }
  };

  /**
   * Operación en lote
   * POST /api/bovines/bulk
   */
  public bulkOperation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids, operation, data }: BulkOperationRequest = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          message: 'IDs de bovinos requeridos',
          errors: {
            ids: 'Debe proporcionar al menos un ID de bovino'
          }
        });
        return;
      }

      let result;
      
      switch (operation) {
        case 'update':
          result = await this.performBulkUpdate(ids, data);
          break;
        case 'delete':
          result = await this.performBulkDelete(ids);
          break;
        case 'change_health_status':
          result = await this.performBulkHealthStatusChange(ids, data.healthStatus);
          break;
        default:
          res.status(400).json({
            success: false,
            message: 'Operación no válida',
            errors: {
              operation: 'Operación no soportada'
            }
          });
          return;
      }

      res.status(200).json({
        success: true,
        message: `Operación ${operation} completada exitosamente`,
        data: result
      });

    } catch (error) {
      console.error('Error en operación en lote:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {
          general: 'Ocurrió un error en la operación en lote'
        }
      });
    }
  };

  // Métodos auxiliares privados
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  private formatCountStats(stats: any[]): Record<string, number> {
    const result: Record<string, number> = {};
    stats.forEach(stat => {
      const key = Object.keys(stat)[0];
      result[stat[key]] = parseInt(stat.count);
    });
    return result;
  }

  private async performBulkUpdate(ids: string[], updateData: any): Promise<any> {
    const [affectedCount] = await Bovine.update(
      {
        ...updateData,
        updatedAt: new Date()
      },
      {
        where: {
          id: { [Op.in]: ids },
          isActive: true
        }
      }
    );
    
    return {
      updatedCount: affectedCount,
      ids: ids
    };
  }

  private async performBulkDelete(ids: string[]): Promise<any> {
    // Usar soft delete del modelo Bovine
    const affectedCount = await Bovine.destroy({
      where: {
        id: { [Op.in]: ids }
      }
    });
    
    return {
      deletedCount: affectedCount,
      ids: ids
    };
  }

  private async performBulkHealthStatusChange(ids: string[], healthStatus: HealthStatus): Promise<any> {
    const [affectedCount] = await Bovine.update(
      {
        healthStatus: healthStatus,
        updatedAt: new Date()
      },
      {
        where: {
          id: { [Op.in]: ids },
          isActive: true
        }
      }
    );
    
    return {
      updatedCount: affectedCount,
      newHealthStatus: healthStatus,
      ids: ids
    };
  }
}