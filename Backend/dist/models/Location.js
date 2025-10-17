"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessLevel = exports.AlertTrigger = exports.LocationStatus = exports.GeofenceType = exports.LocationType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var LocationType;
(function (LocationType) {
    LocationType["FARM"] = "FARM";
    LocationType["PASTURE"] = "PASTURE";
    LocationType["CORRAL"] = "CORRAL";
    LocationType["BARN"] = "BARN";
    LocationType["MILKING_PARLOR"] = "MILKING_PARLOR";
    LocationType["FEED_AREA"] = "FEED_AREA";
    LocationType["WATER_SOURCE"] = "WATER_SOURCE";
    LocationType["VETERINARY_CLINIC"] = "VETERINARY_CLINIC";
    LocationType["QUARANTINE_AREA"] = "QUARANTINE_AREA";
    LocationType["LOADING_AREA"] = "LOADING_AREA";
    LocationType["STORAGE"] = "STORAGE";
    LocationType["OFFICE"] = "OFFICE";
    LocationType["RESIDENTIAL"] = "RESIDENTIAL";
    LocationType["PROCESSING_PLANT"] = "PROCESSING_PLANT";
    LocationType["MARKET"] = "MARKET";
    LocationType["SLAUGHTERHOUSE"] = "SLAUGHTERHOUSE";
    LocationType["BREEDING_CENTER"] = "BREEDING_CENTER";
    LocationType["LABORATORY"] = "LABORATORY";
    LocationType["WASTE_MANAGEMENT"] = "WASTE_MANAGEMENT";
    LocationType["EQUIPMENT_SHED"] = "EQUIPMENT_SHED";
    LocationType["REPAIR_SHOP"] = "REPAIR_SHOP";
    LocationType["FUEL_STATION"] = "FUEL_STATION";
    LocationType["ENTRANCE_GATE"] = "ENTRANCE_GATE";
    LocationType["SECURITY_POST"] = "SECURITY_POST";
    LocationType["EMERGENCY_POINT"] = "EMERGENCY_POINT";
    LocationType["RESTRICTED_AREA"] = "RESTRICTED_AREA";
    LocationType["DANGER_ZONE"] = "DANGER_ZONE";
    LocationType["SAFE_ZONE"] = "SAFE_ZONE";
    LocationType["ROUTE"] = "ROUTE";
    LocationType["CHECKPOINT"] = "CHECKPOINT";
    LocationType["OTHER"] = "OTHER";
})(LocationType || (exports.LocationType = LocationType = {}));
var GeofenceType;
(function (GeofenceType) {
    GeofenceType["CIRCULAR"] = "CIRCULAR";
    GeofenceType["RECTANGULAR"] = "RECTANGULAR";
    GeofenceType["POLYGON"] = "POLYGON";
    GeofenceType["CORRIDOR"] = "CORRIDOR";
})(GeofenceType || (exports.GeofenceType = GeofenceType = {}));
var LocationStatus;
(function (LocationStatus) {
    LocationStatus["ACTIVE"] = "ACTIVE";
    LocationStatus["INACTIVE"] = "INACTIVE";
    LocationStatus["UNDER_CONSTRUCTION"] = "UNDER_CONSTRUCTION";
    LocationStatus["UNDER_MAINTENANCE"] = "UNDER_MAINTENANCE";
    LocationStatus["QUARANTINED"] = "QUARANTINED";
    LocationStatus["FLOODED"] = "FLOODED";
    LocationStatus["DAMAGED"] = "DAMAGED";
    LocationStatus["CLOSED"] = "CLOSED";
    LocationStatus["RESTRICTED"] = "RESTRICTED";
})(LocationStatus || (exports.LocationStatus = LocationStatus = {}));
var AlertTrigger;
(function (AlertTrigger) {
    AlertTrigger["ENTRY"] = "ENTRY";
    AlertTrigger["EXIT"] = "EXIT";
    AlertTrigger["BOTH"] = "BOTH";
    AlertTrigger["DWELL_TIME"] = "DWELL_TIME";
    AlertTrigger["SPEED_LIMIT"] = "SPEED_LIMIT";
    AlertTrigger["TIME_RESTRICTION"] = "TIME_RESTRICTION";
    AlertTrigger["UNAUTHORIZED_ACCESS"] = "UNAUTHORIZED_ACCESS";
    AlertTrigger["EMERGENCY"] = "EMERGENCY";
})(AlertTrigger || (exports.AlertTrigger = AlertTrigger = {}));
var AccessLevel;
(function (AccessLevel) {
    AccessLevel["PUBLIC"] = "PUBLIC";
    AccessLevel["RESTRICTED"] = "RESTRICTED";
    AccessLevel["PRIVATE"] = "PRIVATE";
    AccessLevel["AUTHORIZED_ONLY"] = "AUTHORIZED_ONLY";
    AccessLevel["EMERGENCY_ONLY"] = "EMERGENCY_ONLY";
    AccessLevel["STAFF_ONLY"] = "STAFF_ONLY";
    AccessLevel["VETERINARY_ONLY"] = "VETERINARY_ONLY";
    AccessLevel["OWNER_ONLY"] = "OWNER_ONLY";
})(AccessLevel || (exports.AccessLevel = AccessLevel = {}));
class Location extends sequelize_1.Model {
    getLocationTypeLabel() {
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
    getStatusLabel() {
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
    calculateDistanceTo(otherLocation) {
        const coords = 'coordinates' in otherLocation ? otherLocation.coordinates : otherLocation;
        const R = 6371;
        const dLat = this.toRadians(coords.latitude - this.coordinates.latitude);
        const dLon = this.toRadians(coords.longitude - this.coordinates.longitude);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(this.coordinates.latitude)) *
                Math.cos(this.toRadians(coords.latitude)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    isPointInsideGeofence(point) {
        if (!this.geofenceConfig || !this.geofenceConfig.isActive) {
            return false;
        }
        const { type, center, radius, boundingBox, coordinates: polyCoords } = this.geofenceConfig;
        switch (type) {
            case GeofenceType.CIRCULAR:
                if (!center || !radius)
                    return false;
                const distance = this.calculateDistanceTo(point) * 1000;
                return distance <= radius;
            case GeofenceType.RECTANGULAR:
                if (!boundingBox)
                    return false;
                return point.latitude >= boundingBox.south &&
                    point.latitude <= boundingBox.north &&
                    point.longitude >= boundingBox.west &&
                    point.longitude <= boundingBox.east;
            case GeofenceType.POLYGON:
                if (!polyCoords || polyCoords.length < 3)
                    return false;
                return this.isPointInPolygon(point, polyCoords);
            case GeofenceType.CORRIDOR:
                if (!polyCoords || polyCoords.length < 2)
                    return false;
                return false;
            default:
                return false;
        }
    }
    isPointInPolygon(point, polygon) {
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
    needsInspection() {
        if (!this.nextInspectionDate)
            return true;
        return new Date() >= new Date(this.nextInspectionDate);
    }
    getAvailableCapacity() {
        if (!this.capacity?.maxAnimals)
            return 0;
        const current = this.capacity.currentAnimals || 0;
        return Math.max(0, this.capacity.maxAnimals - current);
    }
    isAtCapacity() {
        return this.getAvailableCapacity() === 0;
    }
    getOccupancyPercentage() {
        if (!this.capacity?.maxAnimals)
            return 0;
        const current = this.capacity.currentAnimals || 0;
        return Math.min((current / this.capacity.maxAnimals) * 100, 100);
    }
    getFullAddress() {
        const parts = [
            this.address,
            this.city,
            this.state,
            this.country,
            this.postalCode
        ].filter(Boolean);
        return parts.join(', ');
    }
    isOperational() {
        return this.isActive &&
            this.status === LocationStatus.ACTIVE &&
            !this.hasAlerts;
    }
    getAvailableEmergencyContacts() {
        if (!this.emergencyInfo?.emergencyContacts)
            return [];
        return this.emergencyInfo.emergencyContacts
            .filter(contact => contact.isAvailable24h)
            .map(contact => ({
            name: contact.name,
            phone: contact.phone,
            role: contact.role
        }));
    }
    isOpenAt(date) {
        if (!this.services?.operatingHours)
            return true;
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[date.getDay()];
        const dayHours = this.services.operatingHours[dayName];
        if (!dayHours)
            return false;
        const currentTime = date.getHours() * 60 + date.getMinutes();
        const [openHour, openMinute] = dayHours.open.split(':').map(Number);
        const [closeHour, closeMinute] = dayHours.close.split(':').map(Number);
        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;
        return currentTime >= openTime && currentTime <= closeTime;
    }
    getLocationSummary() {
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
    getGeofenceCenter() {
        if (!this.geofenceConfig)
            return null;
        switch (this.geofenceConfig.type) {
            case GeofenceType.CIRCULAR:
                return this.geofenceConfig.center || null;
            case GeofenceType.RECTANGULAR:
                if (!this.geofenceConfig.boundingBox)
                    return null;
                const { north, south, east, west } = this.geofenceConfig.boundingBox;
                return {
                    latitude: (north + south) / 2,
                    longitude: (east + west) / 2
                };
            case GeofenceType.POLYGON:
                if (!this.geofenceConfig.coordinates || this.geofenceConfig.coordinates.length === 0)
                    return null;
                const coords = this.geofenceConfig.coordinates;
                const centerLat = coords.reduce((sum, coord) => sum + coord.latitude, 0) / coords.length;
                const centerLon = coords.reduce((sum, coord) => sum + coord.longitude, 0) / coords.length;
                return { latitude: centerLat, longitude: centerLon };
            default:
                return null;
        }
    }
}
Location.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único de la ubicación'
    },
    locationCode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [3, 50]
        },
        comment: 'Código único de la ubicación'
    },
    name: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 200]
        },
        comment: 'Nombre de la ubicación'
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción detallada de la ubicación'
    },
    type: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(LocationType)),
        allowNull: false,
        comment: 'Tipo de ubicación'
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(LocationStatus)),
        allowNull: false,
        defaultValue: LocationStatus.ACTIVE,
        comment: 'Estado de la ubicación'
    },
    coordinates: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            isValidCoordinates(value) {
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
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        comment: 'Dirección física'
    },
    city: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Ciudad'
    },
    state: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Estado o provincia'
    },
    country: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'México',
        comment: 'País'
    },
    postalCode: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: true,
        comment: 'Código postal'
    },
    timezone: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'America/Mexico_City',
        comment: 'Zona horaria'
    },
    geofenceConfig: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Configuración de geofencing'
    },
    capacity: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Capacidad y características de la ubicación'
    },
    accessLevel: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(AccessLevel)),
        allowNull: false,
        defaultValue: AccessLevel.PRIVATE,
        comment: 'Nivel de acceso a la ubicación'
    },
    parentLocationId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'locations',
            key: 'id'
        },
        comment: 'ID de la ubicación padre'
    },
    relatedLocations: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.UUID),
        allowNull: true,
        defaultValue: [],
        comment: 'IDs de ubicaciones relacionadas'
    },
    emergencyInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de emergencia'
    },
    services: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Servicios y facilidades disponibles'
    },
    weatherStationId: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        comment: 'ID de la estación meteorológica'
    },
    soilType: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Tipo de suelo'
    },
    elevation: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: true,
        comment: 'Elevación en metros sobre el nivel del mar'
    },
    slope: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 90
        },
        comment: 'Pendiente en grados'
    },
    vegetation: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Tipos de vegetación presentes'
    },
    waterSources: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Fuentes de agua disponibles'
    },
    pastureQuality: {
        type: sequelize_1.DataTypes.ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR'),
        allowNull: true,
        comment: 'Calidad del pastizal'
    },
    lastInspectionDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de la última inspección'
    },
    nextInspectionDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de la próxima inspección'
    },
    inspectionNotes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas de la última inspección'
    },
    images: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de imágenes de la ubicación'
    },
    documents: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de documentos relacionados'
    },
    videos: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de videos de la ubicación'
    },
    maps: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de mapas específicos'
    },
    tags: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Etiquetas para categorización'
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales sobre la ubicación'
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si la ubicación está activa'
    },
    isMonitored: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si la ubicación está siendo monitoreada'
    },
    hasAlerts: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si tiene alertas activas'
    },
    lastAlertDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de la última alerta'
    },
    farmId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID de la finca principal'
    },
    ownerId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del propietario'
    },
    managerId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del administrador'
    },
    createdBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        comment: 'ID del usuario que creó la ubicación'
    },
    updatedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que actualizó la ubicación'
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha de creación del registro'
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha de última actualización'
    },
    deletedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de eliminación (soft delete)'
    }
}, {
    sequelize: database_1.default,
    modelName: 'Location',
    tableName: 'locations',
    timestamps: true,
    paranoid: true,
    indexes: [
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
        beforeSave: async (location) => {
            if (location.lastInspectionDate && location.nextInspectionDate) {
                if (location.nextInspectionDate <= location.lastInspectionDate) {
                    throw new Error('La próxima inspección debe ser posterior a la última inspección');
                }
            }
            if (location.capacity?.maxAnimals && location.capacity?.currentAnimals) {
                if (location.capacity.currentAnimals > location.capacity.maxAnimals) {
                    throw new Error('Los animales actuales no pueden exceder la capacidad máxima');
                }
            }
            if (location.geofenceConfig?.type === GeofenceType.CIRCULAR) {
                if (!location.geofenceConfig.center || !location.geofenceConfig.radius) {
                    throw new Error('Geofence circular requiere centro y radio');
                }
            }
            if (location.geofenceConfig?.type === GeofenceType.RECTANGULAR) {
                if (!location.geofenceConfig.boundingBox) {
                    throw new Error('Geofence rectangular requiere caja delimitadora');
                }
            }
            if (location.geofenceConfig?.type === GeofenceType.POLYGON) {
                if (!location.geofenceConfig.coordinates || location.geofenceConfig.coordinates.length < 3) {
                    throw new Error('Geofence de polígono requiere al menos 3 coordenadas');
                }
            }
        }
    },
    comment: 'Tabla para el manejo de ubicaciones y geofencing en la operación ganadera'
});
exports.default = Location;
//# sourceMappingURL=Location.js.map