import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { Geometry } from 'geojson';

// Enums para tipos de ubicaciones
export enum LocationType {
  FARM = 'FARM',                         // Finca/Rancho
  PASTURE = 'PASTURE',                   // Pastizal
  CORRAL = 'CORRAL',                     // Corral
  BARN = 'BARN',                         // Establo
  MILKING_PARLOR = 'MILKING_PARLOR',     // Sala de ordeño
  FEED_AREA = 'FEED_AREA',               // Área de alimentación
  WATER_SOURCE = 'WATER_SOURCE',         // Fuente de agua
  VETERINARY_CLINIC = 'VETERINARY_CLINIC', // Clínica veterinaria
  QUARANTINE_AREA = 'QUARANTINE_AREA',   // Área de cuarentena
  LOADING_AREA = 'LOADING_AREA',         // Área de carga
  STORAGE = 'STORAGE',                   // Almacén
  OFFICE = 'OFFICE',                     // Oficina
  RESIDENTIAL = 'RESIDENTIAL',           // Área residencial
  PROCESSING_PLANT = 'PROCESSING_PLANT', // Planta de procesamiento
  MARKET = 'MARKET',                     // Mercado
  SLAUGHTERHOUSE = 'SLAUGHTERHOUSE',     // Rastro
  BREEDING_CENTER = 'BREEDING_CENTER',   // Centro de reproducción
  LABORATORY = 'LABORATORY',             // Laboratorio
  WASTE_MANAGEMENT = 'WASTE_MANAGEMENT', // Manejo de residuos
  EQUIPMENT_SHED = 'EQUIPMENT_SHED',     // Bodega de equipos
  REPAIR_SHOP = 'REPAIR_SHOP',           // Taller de reparaciones
  FUEL_STATION = 'FUEL_STATION',         // Estación de combustible
  ENTRANCE_GATE = 'ENTRANCE_GATE',       // Puerta de entrada
  SECURITY_POST = 'SECURITY_POST',       // Puesto de seguridad
  EMERGENCY_POINT = 'EMERGENCY_POINT',   // Punto de emergencia
  RESTRICTED_AREA = 'RESTRICTED_AREA',   // Área restringida
  DANGER_ZONE = 'DANGER_ZONE',           // Zona de peligro
  SAFE_ZONE = 'SAFE_ZONE',               // Zona segura
  ROUTE = 'ROUTE',                       // Ruta
  CHECKPOINT = 'CHECKPOINT',             // Punto de control
  OTHER = 'OTHER'                        // Otro
}

export enum GeofenceType {
  CIRCULAR = 'CIRCULAR',                 // Circular
  RECTANGULAR = 'RECTANGULAR',           // Rectangular
  POLYGON = 'POLYGON',                   // Polígono personalizado
  CORRIDOR = 'CORRIDOR'                  // Corredor (ruta)
}

export enum LocationStatus {
  ACTIVE = 'ACTIVE',                     // Activa
  INACTIVE = 'INACTIVE',                 // Inactiva
  UNDER_CONSTRUCTION = 'UNDER_CONSTRUCTION', // En construcción
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE', // En mantenimiento
  QUARANTINED = 'QUARANTINED',           // En cuarentena
  FLOODED = 'FLOODED',                   // Inundada
  DAMAGED = 'DAMAGED',                   // Dañada
  CLOSED = 'CLOSED',                     // Cerrada
  RESTRICTED = 'RESTRICTED'              // Restringida
}

export enum AlertTrigger {
  ENTRY = 'ENTRY',                       // Entrada a la zona
  EXIT = 'EXIT',                         // Salida de la zona
  BOTH = 'BOTH',                         // Entrada y salida
  DWELL_TIME = 'DWELL_TIME',             // Tiempo de permanencia
  SPEED_LIMIT = 'SPEED_LIMIT',           // Límite de velocidad
  TIME_RESTRICTION = 'TIME_RESTRICTION', // Restricción de horario
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS', // Acceso no autorizado
  EMERGENCY = 'EMERGENCY'                // Emergencia
}

// Interface para coordenadas geográficas
export interface Coordinates {
  latitude: number;                      // Latitud
  longitude: number;                     // Longitud
  altitude?: number;                     // Altitud (metros)
  accuracy?: number;                     // Precisión (metros)
}

// Interface para límites geográficos
export interface BoundingBox {
  north: number;                         // Límite norte (latitud)
  south: number;                         // Límite sur (latitud)
  east: number;                          // Límite este (longitud)
  west: number;                          // Límite oeste (longitud)
}

// Interface para configuración de geofencing
export interface GeofenceConfig {
  type: GeofenceType;                    // Tipo de geofence
  center?: Coordinates;                  // Centro (para circular)
  radius?: number;                       // Radio en metros (para circular)
  boundingBox?: BoundingBox;             // Caja delimitadora (para rectangular)
  coordinates?: Coordinates[];           // Coordenadas del polígono
  width?: number;                        // Ancho en metros (para corredor)
  alertTriggers: AlertTrigger[];         // Disparadores de alerta
  isActive: boolean;                     // Si está activo
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // Prioridad de alertas
  maxDwellTime?: number;                 // Tiempo máximo de permanencia (minutos)
  speedLimit?: number;                   // Límite de velocidad (km/h)
  timeRestrictions?: Array<{             // Restricciones de horario
    startTime: string;                   // Hora de inicio (HH:MM)
    endTime: string;                     // Hora de fin (HH:MM)
    daysOfWeek: number[];                // Días de la semana (0=domingo)
    action: 'ALLOW' | 'DENY';            // Acción (permitir/denegar)
  }>;
  alertRecipients?: string[];            // IDs de usuarios a notificar
}

// Atributos del modelo Location
export interface LocationAttributes {
  id: string;
  locationCode: string;                  // Código único de la ubicación
  name: string;                          // Nombre de la ubicación
  ranchId: string;           // FK a Ranch (OBLIGATORIO)
  type: LocationType;        // PASTURE, CORRAL, BARN, etc. (SIN FARM)

  parentLocationId?: string; // Auto-relación (sub-ubicaciones)

  geom: Geometry;
  coordinates: Coordinates;
  geofenceConfig?: GeofenceConfig;       // Configuración de geofencing

  soilType?: string;               // ✓ Tipo de suelo (no cambia)
  elevation?: number;              // ✓ Elevación (permanente)
  slope?: number;                  // ✓ Pendiente (permanente)
  vegetation?: string[];           // ✓ Vegetación predominante
  waterSources?: Array<{                 // Fuentes de agua
    type: 'WELL' | 'RIVER' | 'POND' | 'STREAM' | 'SPRING' | 'TANK';
    name: string;
    coordinates: Coordinates;
    capacity?: number;
    quality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  }>;
  pastureQuality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'; // Calidad del pastizal
  weatherStationId?: string;             // ID de estación meteorológica

  status: LocationStatus;          // ✓ ACTIVE, INACTIVE, MAINTENANCE
  isActive: boolean;                // ✓ Soft delete flag

  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

}

// Atributos opcionales al crear una nueva ubicación
export interface LocationCreationAttributes
  extends Optional<LocationAttributes,
    'id' | 'geofenceConfig' | 'parentLocationId' | 'weatherStationId'
    | 'soilType' | 'elevation' | 'slope' | 'vegetation' |
    'waterSources' | 'pastureQuality' | 'updatedBy' | 'createdAt' | 'updatedAt' |
    'deletedAt'
  > { }

// Clase del modelo Location
class Location extends Model<LocationAttributes, LocationCreationAttributes>
  implements LocationAttributes {
  public id!: string;
  public locationCode!: string;
  public name!: string;
  public ranchId!: string;
  public type!: LocationType;
  public geom!: Geometry;
  public status!: LocationStatus;
  public coordinates!: Coordinates;

  public geofenceConfig?: GeofenceConfig;
  public parentLocationId?: string;
  public weatherStationId?: string;
  public soilType?: string;
  public elevation?: number;
  public slope?: number;
  public vegetation?: string[];
  public waterSources?: Array<{
    type: 'WELL' | 'RIVER' | 'POND' | 'STREAM' | 'SPRING' | 'TANK';
    name: string;
    coordinates: Coordinates;
    capacity?: number;
    quality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  }>;
  public pastureQuality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';


  public isActive!: boolean;

  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;


  // Métodos de instancia

  /**
   * Obtiene el tipo de ubicación en español
   * @returns Tipo de ubicación traducido
   */
  public getLocationTypeLabel(): string {
    const labels = {
      [LocationType.FARM]: 'Finca/Rancho',
      [LocationType.PASTURE]: 'Pastizal',
      [LocationType.CORRAL]: 'Corral',
      [LocationType.BARN]: 'Establo',
      [LocationType.MILKING_PARLOR]: 'Sala de Ordeño',
      [LocationType.FEED_AREA]: 'Área de Alimentación',
      [LocationType.WATER_SOURCE]: 'Fuente de Agua',
      [LocationType.VETERINARY_CLINIC]: 'Clínica Veterinaria',
      [LocationType.QUARANTINE_AREA]: 'Área de Cuarentena',
      [LocationType.LOADING_AREA]: 'Área de Carga',
      [LocationType.STORAGE]: 'Almacén',
      [LocationType.OFFICE]: 'Oficina',
      [LocationType.RESIDENTIAL]: 'Área Residencial',
      [LocationType.PROCESSING_PLANT]: 'Planta de Procesamiento',
      [LocationType.MARKET]: 'Mercado',
      [LocationType.SLAUGHTERHOUSE]: 'Rastro',
      [LocationType.BREEDING_CENTER]: 'Centro de Reproducción',
      [LocationType.LABORATORY]: 'Laboratorio',
      [LocationType.WASTE_MANAGEMENT]: 'Manejo de Residuos',
      [LocationType.EQUIPMENT_SHED]: 'Bodega de Equipos',
      [LocationType.REPAIR_SHOP]: 'Taller de Reparaciones',
      [LocationType.FUEL_STATION]: 'Estación de Combustible',
      [LocationType.ENTRANCE_GATE]: 'Puerta de Entrada',
      [LocationType.SECURITY_POST]: 'Puesto de Seguridad',
      [LocationType.EMERGENCY_POINT]: 'Punto de Emergencia',
      [LocationType.RESTRICTED_AREA]: 'Área Restringida',
      [LocationType.DANGER_ZONE]: 'Zona de Peligro',
      [LocationType.SAFE_ZONE]: 'Zona Segura',
      [LocationType.ROUTE]: 'Ruta',
      [LocationType.CHECKPOINT]: 'Punto de Control',
      [LocationType.OTHER]: 'Otro'
    };
    return labels[this.type];
  }

  /**
   * Obtiene el estado de la ubicación en español
   * @returns Estado traducido
   */
  public getStatusLabel(): string {
    const labels = {
      [LocationStatus.ACTIVE]: 'Activa',
      [LocationStatus.INACTIVE]: 'Inactiva',
      [LocationStatus.UNDER_CONSTRUCTION]: 'En Construcción',
      [LocationStatus.UNDER_MAINTENANCE]: 'En Mantenimiento',
      [LocationStatus.QUARANTINED]: 'En Cuarentena',
      [LocationStatus.FLOODED]: 'Inundada',
      [LocationStatus.DAMAGED]: 'Dañada',
      [LocationStatus.CLOSED]: 'Cerrada',
      [LocationStatus.RESTRICTED]: 'Restringida'
    };
    return labels[this.status];
  }

  /**
   * Calcula la distancia a otra ubicación usando la fórmula de Haversine
   * @param otherLocation Otra ubicación o coordenadas
   * @returns Distancia en kilómetros
   */
  public calculateDistanceTo(otherLocation: Coordinates | Location): number {
    const coords = 'coordinates' in otherLocation ? otherLocation.coordinates : otherLocation;

    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRadians(coords.latitude - this.coordinates.latitude);
    const dLon = this.toRadians(coords.longitude - this.coordinates.longitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(this.coordinates.latitude)) *
      Math.cos(this.toRadians(coords.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convierte grados a radianes
   * @param degrees Grados
   * @returns Radianes
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Verifica si un punto está dentro del geofence
   * @param point Coordenadas del punto
   * @returns True si está dentro del geofence
   */
  public isPointInsideGeofence(point: Coordinates): boolean {
    if (!this.geofenceConfig || !this.geofenceConfig.isActive) {
      return false;
    }

    const { type, center, radius, boundingBox, coordinates: polyCoords } = this.geofenceConfig;

    switch (type) {
      case GeofenceType.CIRCULAR:
        if (!center || !radius) return false;
        const distance = this.calculateDistanceTo(point) * 1000; // Convertir a metros
        return distance <= radius;

      case GeofenceType.RECTANGULAR:
        if (!boundingBox) return false;
        return point.latitude >= boundingBox.south &&
          point.latitude <= boundingBox.north &&
          point.longitude >= boundingBox.west &&
          point.longitude <= boundingBox.east;

      case GeofenceType.POLYGON:
        if (!polyCoords || polyCoords.length < 3) return false;
        return this.isPointInPolygon(point, polyCoords);

      case GeofenceType.CORRIDOR:
        // Implementación simplificada para corredor
        if (!polyCoords || polyCoords.length < 2) return false;
        // Aquí se implementaría la lógica para verificar si está dentro del corredor
        return false;

      default:
        return false;
    }
  }

  /**
   * Verifica si un punto está dentro de un polígono usando el algoritmo Ray Casting
   * @param point Punto a verificar
   * @param polygon Coordenadas del polígono
   * @returns True si está dentro del polígono
   */
  private isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].latitude > point.latitude) !== (polygon[j].latitude > point.latitude)) &&
        (point.longitude < (polygon[j].longitude - polygon[i].longitude) *
          (point.latitude - polygon[i].latitude) /
          (polygon[j].latitude - polygon[i].latitude) + polygon[i].longitude)) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Obtiene un resumen del estado de la ubicación
   * @returns Resumen del estado
   */
  public getLocationSummary(): {
    name: string;
    type: string;
    status: string;
    locationCode: string;
    coordinates: Coordinates;
    geofenceActive: boolean;
  } {
    return {
      name: this.name,
      type: this.getLocationTypeLabel(),
      status: this.getStatusLabel(),
      locationCode: this.locationCode,
      coordinates: this.coordinates,
      geofenceActive: this.geofenceConfig?.isActive || false
    };
  }

  /**
   * Genera coordenadas del centro del geofence
   * @returns Coordenadas del centro
   */
  public getGeofenceCenter(): Coordinates | null {
    if (!this.geofenceConfig) return null;

    switch (this.geofenceConfig.type) {
      case GeofenceType.CIRCULAR:
        return this.geofenceConfig.center || null;

      case GeofenceType.RECTANGULAR:
        if (!this.geofenceConfig.boundingBox) return null;
        const { north, south, east, west } = this.geofenceConfig.boundingBox;
        return {
          latitude: (north + south) / 2,
          longitude: (east + west) / 2
        };

      case GeofenceType.POLYGON:
        if (!this.geofenceConfig.coordinates || this.geofenceConfig.coordinates.length === 0) return null;
        const coords = this.geofenceConfig.coordinates;
        const centerLat = coords.reduce((sum, coord) => sum + coord.latitude, 0) / coords.length;
        const centerLon = coords.reduce((sum, coord) => sum + coord.longitude, 0) / coords.length;
        return { latitude: centerLat, longitude: centerLon };

      default:
        return null;
    }
  }
}

// Definición del modelo en Sequelize
Location.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la ubicación'
    },
    locationCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [3, 50]
      },
      comment: 'Código único de la ubicación'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 200]
      },
      comment: 'Nombre de la ubicación'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ranches',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM(...Object.values(LocationType)),
      allowNull: false,
      comment: 'Tipo de ubicación'
    },
    coordinates: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidCoordinates(value: Coordinates) {
          if (!value.latitude || !value.longitude) {
            throw new Error('Latitud y longitud son requeridas');
          }
          if (value.latitude < -90 || value.latitude > 90) {
            throw new Error('Latitud debe estar entre -90 y 90');
          }
          if (value.longitude < -180 || value.longitude > 180) {
            throw new Error('Longitud debe estar entre -180 y 180');
          }
        }
      },
      comment: 'Coordenadas geográficas principales'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(LocationStatus)),
      allowNull: false,
      defaultValue: LocationStatus.ACTIVE,
      comment: 'Estado de la ubicación'
    },
    geofenceConfig: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de geofencing'
    },
    geom: {
      type: DataTypes.GEOMETRY,
      allowNull: false,
      comment: 'Geometría'
    },
    parentLocationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'locations',
        key: 'id'
      },
      comment: 'ID de la ubicación padre'
    },
    weatherStationId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'ID de la estación meteorológica'
    },
    soilType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Tipo de suelo'
    },
    elevation: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: 'Elevación en metros sobre el nivel del mar'
    },
    slope: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 90
      },
      comment: 'Pendiente en grados'
    },
    vegetation: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Tipos de vegetación presentes'
    },
    waterSources: {
  type: DataTypes.JSONB,
  allowNull: true,
  validate: {
    isValidWaterSources(value: any) {
      if (value !== undefined && value !== null) {
        if (!Array.isArray(value)) {
          throw new Error('waterSources debe ser un array');
        }
        // Validar estructura de cada fuente
        value.forEach((source, index) => {
          if (!source.type || !source.name || !source.coordinates) {
            throw new Error(`Fuente de agua en índice ${index} incompleta`);
              }
            });
          }
        }
      }
    },
    pastureQuality: {
      type: DataTypes.ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR'),
      allowNull: true,
      comment: 'Calidad del pastizal'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si la ubicación está activa'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó la ubicación'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó la ubicación'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de creación del registro'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de última actualización'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'Location',
    tableName: 'locations',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      {
        unique: true,
        fields: ['location_code']
      },
      {
        fields: ['ranch_id']
      },
      {
        fields: ['type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['parent_location_id']
      },
      {
        name: 'locations_ranch_type',
        fields: ['ranch_id', 'type']
      },
      {
        name: 'locations_geom_gist',
        fields: ['geom'],
        using: 'gist'
      }
    ],
    hooks: {
      // Hook para validaciones antes de guardar
      beforeSave: async (location: Location) => {
        

        // Validar geofence circular
        if (location.geofenceConfig?.type === GeofenceType.CIRCULAR) {
          if (!location.geofenceConfig.center || !location.geofenceConfig.radius) {
            throw new Error('Geofence circular requiere centro y radio');
          }
        }

        // Validar geofence rectangular
        if (location.geofenceConfig?.type === GeofenceType.RECTANGULAR) {
          if (!location.geofenceConfig.boundingBox) {
            throw new Error('Geofence rectangular requiere caja delimitadora');
          }
        }

        // Validar geofence de polígono
        if (location.geofenceConfig?.type === GeofenceType.POLYGON) {
          if (!location.geofenceConfig.coordinates || location.geofenceConfig.coordinates.length < 3) {
            throw new Error('Geofence de polígono requiere al menos 3 coordenadas');
          }
        }
      }
    },
    comment: 'Tabla para el manejo de ubicaciones y geofencing en la operación ganadera'
  }
);

export default Location;