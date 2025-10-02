import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';

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

export enum AccessLevel {
  PUBLIC = 'PUBLIC',                     // Público
  RESTRICTED = 'RESTRICTED',             // Restringido
  PRIVATE = 'PRIVATE',                   // Privado
  AUTHORIZED_ONLY = 'AUTHORIZED_ONLY',   // Solo autorizados
  EMERGENCY_ONLY = 'EMERGENCY_ONLY',     // Solo emergencias
  STAFF_ONLY = 'STAFF_ONLY',             // Solo personal
  VETERINARY_ONLY = 'VETERINARY_ONLY',   // Solo veterinarios
  OWNER_ONLY = 'OWNER_ONLY'              // Solo propietarios
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

// Interface para capacidad y características
export interface LocationCapacity {
  maxAnimals?: number;                   // Máximo número de animales
  currentAnimals?: number;               // Número actual de animales
  area?: number;                         // Área en metros cuadrados
  areaUnit?: 'M2' | 'HA' | 'ACRE';      // Unidad de área
  capacity?: number;                     // Capacidad general
  capacityUnit?: string;                 // Unidad de capacidad
  carryingCapacity?: number;             // Capacidad de carga (animales/ha)
  waterSources?: number;                 // Número de fuentes de agua
  feedingStations?: number;              // Número de estaciones de alimentación
  shelters?: number;                     // Número de refugios
  hasElectricity?: boolean;              // Si tiene electricidad
  hasWater?: boolean;                    // Si tiene agua
  hasInternet?: boolean;                 // Si tiene internet
  hasRoadAccess?: boolean;               // Si tiene acceso por carretera
  securityLevel?: 'LOW' | 'MEDIUM' | 'HIGH'; // Nivel de seguridad
}

// Interface para información de contacto de emergencia
export interface EmergencyInfo {
  emergencyContacts?: Array<{            // Contactos de emergencia
    name: string;
    phone: string;
    role: string;
    isAvailable24h: boolean;
  }>;
  nearestHospital?: {                    // Hospital más cercano
    name: string;
    address: string;
    phone: string;
    distance: number;                    // Distancia en km
  };
  nearestVeterinary?: {                  // Veterinaria más cercana
    name: string;
    address: string;
    phone: string;
    distance: number;
  };
  emergencyProcedures?: string[];        // Procedimientos de emergencia
  evacuationPlan?: string;               // Plan de evacuación
  assemblyPoint?: Coordinates;           // Punto de reunión
}

// Interface para servicios y facilidades
export interface LocationServices {
  services: string[];                    // Servicios disponibles
  facilities: string[];                 // Instalaciones disponibles
  equipment: string[];                   // Equipos disponibles
  operatingHours?: {                     // Horarios de operación
    monday?: { open: string; close: string; };
    tuesday?: { open: string; close: string; };
    wednesday?: { open: string; close: string; };
    thursday?: { open: string; close: string; };
    friday?: { open: string; close: string; };
    saturday?: { open: string; close: string; };
    sunday?: { open: string; close: string; };
  };
  maintenance?: {                        // Información de mantenimiento
    lastMaintenance?: Date;
    nextMaintenance?: Date;
    maintenanceSchedule?: string;
    responsiblePerson?: string;
  };
  costs?: {                             // Costos asociados
    rentCost?: number;
    maintenanceCost?: number;
    utilityCost?: number;
    securityCost?: number;
    currency?: string;
  };
}

// Atributos del modelo Location
export interface LocationAttributes {
  id: string;
  locationCode: string;                  // Código único de la ubicación
  name: string;                          // Nombre de la ubicación
  description?: string;                  // Descripción detallada
  type: LocationType;                    // Tipo de ubicación
  status: LocationStatus;                // Estado de la ubicación
  coordinates: Coordinates;              // Coordenadas geográficas principales
  address?: string;                      // Dirección física
  city?: string;                         // Ciudad
  state?: string;                        // Estado/Provincia
  country?: string;                      // País
  postalCode?: string;                   // Código postal
  timezone?: string;                     // Zona horaria
  geofenceConfig?: GeofenceConfig;       // Configuración de geofencing
  capacity?: LocationCapacity;           // Capacidad y características
  accessLevel: AccessLevel;              // Nivel de acceso
  parentLocationId?: string;             // ID de ubicación padre
  relatedLocations?: string[];           // IDs de ubicaciones relacionadas
  emergencyInfo?: EmergencyInfo;         // Información de emergencia
  services?: LocationServices;           // Servicios y facilidades
  weatherStationId?: string;             // ID de estación meteorológica
  soilType?: string;                     // Tipo de suelo
  elevation?: number;                    // Elevación en metros
  slope?: number;                        // Pendiente en grados
  vegetation?: string[];                 // Tipos de vegetación
  waterSources?: Array<{                 // Fuentes de agua
    type: 'WELL' | 'RIVER' | 'POND' | 'STREAM' | 'SPRING' | 'TANK';
    name: string;
    coordinates: Coordinates;
    capacity?: number;
    quality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  }>;
  pastureQuality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'; // Calidad del pastizal
  lastInspectionDate?: Date;             // Fecha de última inspección
  nextInspectionDate?: Date;             // Fecha de próxima inspección
  inspectionNotes?: string;              // Notas de inspección
  images?: string[];                     // URLs de imágenes
  documents?: string[];                  // URLs de documentos
  videos?: string[];                     // URLs de videos
  maps?: string[];                       // URLs de mapas
  tags?: string[];                       // Etiquetas para categorización
  notes?: string;                        // Notas adicionales
  isActive: boolean;                     // Si la ubicación está activa
  isMonitored: boolean;                  // Si está siendo monitoreada
  hasAlerts: boolean;                    // Si tiene alertas activas
  lastAlertDate?: Date;                  // Fecha de última alerta
  farmId?: string;                       // ID de la finca principal
  ownerId?: string;                      // ID del propietario
  managerId?: string;                    // ID del administrador
  createdBy: string;                     // ID del usuario que creó
  updatedBy?: string;                    // ID del usuario que actualizó
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Atributos opcionales al crear una nueva ubicación
export interface LocationCreationAttributes 
  extends Optional<LocationAttributes, 
    'id' | 'description' | 'address' | 'city' | 'state' | 'country' | 
    'postalCode' | 'timezone' | 'geofenceConfig' | 'capacity' | 
    'parentLocationId' | 'relatedLocations' | 'emergencyInfo' | 'services' | 
    'weatherStationId' | 'soilType' | 'elevation' | 'slope' | 'vegetation' | 
    'waterSources' | 'pastureQuality' | 'lastInspectionDate' | 
    'nextInspectionDate' | 'inspectionNotes' | 'images' | 'documents' | 
    'videos' | 'maps' | 'tags' | 'notes' | 'lastAlertDate' | 'farmId' | 
    'ownerId' | 'managerId' | 'updatedBy' | 'createdAt' | 'updatedAt' | 
    'deletedAt'
  > {}

// Clase del modelo Location
class Location extends Model<LocationAttributes, LocationCreationAttributes> 
  implements LocationAttributes {
  public id!: string;
  public locationCode!: string;
  public name!: string;
  public description?: string;
  public type!: LocationType;
  public status!: LocationStatus;
  public coordinates!: Coordinates;
  public address?: string;
  public city?: string;
  public state?: string;
  public country?: string;
  public postalCode?: string;
  public timezone?: string;
  public geofenceConfig?: GeofenceConfig;
  public capacity?: LocationCapacity;
  public accessLevel!: AccessLevel;
  public parentLocationId?: string;
  public relatedLocations?: string[];
  public emergencyInfo?: EmergencyInfo;
  public services?: LocationServices;
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
  public lastInspectionDate?: Date;
  public nextInspectionDate?: Date;
  public inspectionNotes?: string;
  public images?: string[];
  public documents?: string[];
  public videos?: string[];
  public maps?: string[];
  public tags?: string[];
  public notes?: string;
  public isActive!: boolean;
  public isMonitored!: boolean;
  public hasAlerts!: boolean;
  public lastAlertDate?: Date;
  public farmId?: string;
  public ownerId?: string;
  public managerId?: string;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
  static FARM: LocationType;
  bovine: null | undefined 

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
   * Verifica si la ubicación necesita inspección
   * @returns True si necesita inspección
   */
  public needsInspection(): boolean {
    if (!this.nextInspectionDate) return true;
    return new Date() >= new Date(this.nextInspectionDate);
  }

  /**
   * Obtiene la capacidad disponible de animales
   * @returns Capacidad disponible
   */
  public getAvailableCapacity(): number {
    if (!this.capacity?.maxAnimals) return 0;
    const current = this.capacity.currentAnimals || 0;
    return Math.max(0, this.capacity.maxAnimals - current);
  }

  /**
   * Verifica si la ubicación está en capacidad máxima
   * @returns True si está en capacidad máxima
   */
  public isAtCapacity(): boolean {
    return this.getAvailableCapacity() === 0;
  }

  /**
   * Calcula el porcentaje de ocupación
   * @returns Porcentaje de ocupación (0-100)
   */
  public getOccupancyPercentage(): number {
    if (!this.capacity?.maxAnimals) return 0;
    const current = this.capacity.currentAnimals || 0;
    return Math.min((current / this.capacity.maxAnimals) * 100, 100);
  }

  /**
   * Obtiene la dirección completa formateada
   * @returns Dirección completa
   */
  public getFullAddress(): string {
    const parts = [
      this.address,
      this.city,
      this.state,
      this.country,
      this.postalCode
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Verifica si la ubicación está operativa
   * @returns True si está operativa
   */
  public isOperational(): boolean {
    return this.isActive && 
           this.status === LocationStatus.ACTIVE &&
           !this.hasAlerts;
  }

  /**
   * Obtiene los contactos de emergencia disponibles
   * @returns Contactos de emergencia disponibles 24h
   */
  public getAvailableEmergencyContacts(): Array<{
    name: string;
    phone: string;
    role: string;
  }> {
    if (!this.emergencyInfo?.emergencyContacts) return [];
    
    return this.emergencyInfo.emergencyContacts
      .filter(contact => contact.isAvailable24h)
      .map(contact => ({
        name: contact.name,
        phone: contact.phone,
        role: contact.role
      }));
  }

  /**
   * Verifica si la ubicación está abierta en un horario específico
   * @param date Fecha a verificar
   * @returns True si está abierta
   */
  public isOpenAt(date: Date): boolean {
    if (!this.services?.operatingHours) return true; // Si no hay horarios definidos, asumimos que está abierta
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()] as keyof typeof this.services.operatingHours;
    const dayHours = this.services.operatingHours[dayName];
    
    if (!dayHours) return false;
    
    const currentTime = date.getHours() * 60 + date.getMinutes();
    const [openHour, openMinute] = dayHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = dayHours.close.split(':').map(Number);
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;
    
    return currentTime >= openTime && currentTime <= closeTime;
  }

  /**
   * Obtiene un resumen del estado de la ubicación
   * @returns Resumen del estado
   */
  public getLocationSummary(): {
    name: string;
    type: string;
    status: string;
    occupancy: number;
    needsInspection: boolean;
    hasAlerts: boolean;
    isOperational: boolean;
    emergencyContactsAvailable: number;
    distanceFromMain?: number;
  } {
    return {
      name: this.name,
      type: this.getLocationTypeLabel(),
      status: this.getStatusLabel(),
      occupancy: this.getOccupancyPercentage(),
      needsInspection: this.needsInspection(),
      hasAlerts: this.hasAlerts,
      isOperational: this.isOperational(),
      emergencyContactsAvailable: this.getAvailableEmergencyContacts().length
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción detallada de la ubicación'
    },
    type: {
      type: DataTypes.ENUM(...Object.values(LocationType)),
      allowNull: false,
      comment: 'Tipo de ubicación'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(LocationStatus)),
      allowNull: false,
      defaultValue: LocationStatus.ACTIVE,
      comment: 'Estado de la ubicación'
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
    address: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Dirección física'
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Ciudad'
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Estado o provincia'
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'México',
      comment: 'País'
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Código postal'
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'America/Mexico_City',
      comment: 'Zona horaria'
    },
    geofenceConfig: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de geofencing'
    },
    capacity: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Capacidad y características de la ubicación'
    },
    accessLevel: {
      type: DataTypes.ENUM(...Object.values(AccessLevel)),
      allowNull: false,
      defaultValue: AccessLevel.PRIVATE,
      comment: 'Nivel de acceso a la ubicación'
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
    relatedLocations: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      defaultValue: [],
      comment: 'IDs de ubicaciones relacionadas'
    },
    emergencyInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de emergencia'
    },
    services: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Servicios y facilidades disponibles'
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
      comment: 'Fuentes de agua disponibles'
    },
    pastureQuality: {
      type: DataTypes.ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR'),
      allowNull: true,
      comment: 'Calidad del pastizal'
    },
    lastInspectionDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de la última inspección'
    },
    nextInspectionDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de la próxima inspección'
    },
    inspectionNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas de la última inspección'
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de imágenes de la ubicación'
    },
    documents: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de documentos relacionados'
    },
    videos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de videos de la ubicación'
    },
    maps: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de mapas específicos'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Etiquetas para categorización'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales sobre la ubicación'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si la ubicación está activa'
    },
    isMonitored: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si la ubicación está siendo monitoreada'
    },
    hasAlerts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si tiene alertas activas'
    },
    lastAlertDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de la última alerta'
    },
    farmId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la finca principal'
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del propietario'
    },
    managerId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del administrador'
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
      // Índices para optimizar consultas
      {
        unique: true,
        fields: ['location_code']
      },
      {
        fields: ['type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['access_level']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_monitored']
      },
      {
        fields: ['has_alerts']
      },
      {
        fields: ['farm_id']
      },
      {
        fields: ['owner_id']
      },
      {
        fields: ['parent_location_id']
      },
      {
        fields: ['next_inspection_date']
      },
      {
        name: 'locations_coordinates_gin',
        fields: ['coordinates'],
        using: 'gin'
      },
      {
        name: 'locations_type_status',
        fields: ['type', 'status']
      },
      {
        name: 'locations_farm_type',
        fields: ['farm_id', 'type']
      }
    ],
    hooks: {
      // Hook para validaciones antes de guardar
      beforeSave: async (location: Location) => {
        // Validar que las fechas de inspección sean coherentes
        if (location.lastInspectionDate && location.nextInspectionDate) {
          if (location.nextInspectionDate <= location.lastInspectionDate) {
            throw new Error('La próxima inspección debe ser posterior a la última inspección');
          }
        }

        // Validar capacidad si está definida
        if (location.capacity?.maxAnimals && location.capacity?.currentAnimals) {
          if (location.capacity.currentAnimals > location.capacity.maxAnimals) {
            throw new Error('Los animales actuales no pueden exceder la capacidad máxima');
          }
        }

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