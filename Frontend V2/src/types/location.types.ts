export enum LocationType {
  PASTURE = 'PASTURE',
  CORRAL = 'CORRAL',
  BARN = 'BARN',
  MILKING_PARLOR = 'MILKING_PARLOR',
  FEED_AREA = 'FEED_AREA',
  WATER_SOURCE = 'WATER_SOURCE',
  VETERINARY_CLINIC = 'VETERINARY_CLINIC',
  QUARANTINE_AREA = 'QUARANTINE_AREA',
  LOADING_AREA = 'LOADING_AREA',
  STORAGE = 'STORAGE',
  OFFICE = 'OFFICE',
  RESIDENTIAL = 'RESIDENTIAL',
  PROCESSING_PLANT = 'PROCESSING_PLANT',
  BREEDING_CENTER = 'BREEDING_CENTER',
  LABORATORY = 'LABORATORY',
  WASTE_MANAGEMENT = 'WASTE_MANAGEMENT',
  EQUIPMENT_SHED = 'EQUIPMENT_SHED',
  ENTRANCE_GATE = 'ENTRANCE_GATE',
  SECURITY_POST = 'SECURITY_POST',
  EMERGENCY_POINT = 'EMERGENCY_POINT',
  RESTRICTED_AREA = 'RESTRICTED_AREA',
  DANGER_ZONE = 'DANGER_ZONE',
  SAFE_ZONE = 'SAFE_ZONE',
  ROUTE = 'ROUTE',
  CHECKPOINT = 'CHECKPOINT',
  OTHER = 'OTHER',
}

export enum LocationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  UNDER_CONSTRUCTION = 'UNDER_CONSTRUCTION',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  QUARANTINED = 'QUARANTINED',
  FLOODED = 'FLOODED',
  DAMAGED = 'DAMAGED',
  CLOSED = 'CLOSED',
  RESTRICTED = 'RESTRICTED',
}

export enum PastureQuality {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

export interface WaterSource {
  type: 'WELL' | 'RIVER' | 'POND' | 'STREAM' | 'SPRING' | 'TANK';
  name: string;
  coordinates?: { latitude: number; longitude: number };
  capacity?: number;
  quality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

export interface GeofenceConfig {
  type: 'CIRCULAR' | 'RECTANGULAR' | 'POLYGON' | 'CORRIDOR';
  center?: { latitude: number; longitude: number };
  radius?: number;
  boundingBox?: { north: number; south: number; east: number; west: number };
  coordinates?: { latitude: number; longitude: number }[];
  alertTriggers?: string[];
  isActive?: boolean;
  priority?: string;
}

/**
 * Capacity inline returned by GET /locations and GET /locations/:id (eager-loaded).
 * `currentAnimals` is calculated on-the-fly from BovineLocationHistory by the backend.
 * If the location has no LocationCapacity record, the parent `capacity` field is `null`.
 */
export interface LocationCapacityInline {
  locationId: string;
  maxAnimals: number;
  currentAnimals: number;
  area: number | null;
  areaUnit: 'M2' | 'HA' | 'ACRE' | null;
  carryingCapacity: number | null;
  feedingStations: number;
  shelters: number;
  hasElectricity: boolean;
  hasWater: boolean;
  hasInternet: boolean;
  hasRoadAccess: boolean;
  securityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  lastUpdated: string;
  updatedBy: string;
}

export interface Location {
  id: string;
  locationCode: string;
  name: string;
  ranchId: string;
  type: LocationType;
  status: LocationStatus;
  coordinates?: { latitude: number; longitude: number };
  parentLocationId?: string;
  soilType?: string;
  elevation?: number;
  slope?: number;
  vegetation?: string[];
  waterSources?: WaterSource[];
  pastureQuality?: PastureQuality;
  geofenceConfig?: GeofenceConfig;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Eager-loaded relations from backend
  ranch?: { id: string; name: string; ranchCode: string };
  /**
   * Capacity inline (eager-loaded). `null` when the location has no LocationCapacity row.
   * `undefined` only if loaded from a legacy endpoint that does not include the join —
   * in that case the consumer should fall back to GET /locations/:id/capacity.
   */
  capacity?: LocationCapacityInline | null;
  // Compat fields (older code paths set these)
  center?: { lat: number; lng: number };
  description?: string;
}

export interface LocationFormData {
  locationCode: string;
  name: string;
  ranchId: string;
  type: LocationType;
  status?: LocationStatus;
  coordinates: { latitude: number; longitude: number };
  parentLocationId?: string;
  soilType?: string;
  elevation?: number;
  slope?: number;
  vegetation?: string[];
  waterSources?: WaterSource[];
  pastureQuality?: PastureQuality;
  geofenceConfig?: GeofenceConfig;
}

export interface LocationSummary {
  id: string;
  name: string;
  type: LocationType;
  status: LocationStatus;
  occupancy: number;
  capacity: number;
  bovineCount: number;
}

export type AreaUnit = 'M2' | 'HA' | 'ACRE';
export type SecurityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Mirrors the backend LocationCapacity model (1:1 with Location).
 * Does NOT live on Location — fetched via GET /locations/:id/capacity.
 * Returns null from the API client when the record doesn't exist yet.
 */
export interface LocationCapacity {
  locationId: string;
  maxAnimals: number;
  currentAnimals: number;
  area?: number;
  areaUnit?: AreaUnit;
  carryingCapacity?: number;
  waterSources?: number;
  feedingStations?: number;
  shelters?: number;
  hasElectricity?: boolean;
  hasWater?: boolean;
  hasInternet?: boolean;
  hasRoadAccess?: boolean;
  securityLevel?: SecurityLevel;
  lastUpdated?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── IoT Monitoring ───────────────────────────────────────────────────────────

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR' | 'UNKNOWN';

export interface SensorReading {
  type: 'TEMPERATURE' | 'HUMIDITY' | 'WIND_SPEED' | 'RAIN' | 'SOIL_MOISTURE' | 'OTHER';
  value: number;
  unit: string;
  timestamp: string;
  sensorId?: string;
}

export interface MonitoringAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  triggeredAt: string;
  resolvedAt?: string;
  isActive: boolean;
  acknowledgedBy?: string;
}

export interface MaintenanceRecord {
  id: string;
  type: string;
  description?: string;
  performedAt: string;
  performedBy?: string;
  nextDue?: string;
  cost?: number;
}

export interface LocationMonitoring {
  id: string;
  locationId: string;
  deviceStatus: DeviceStatus;
  batteryLevel?: number;
  signalStrength?: number;
  lastPing?: string;
  firmwareVersion?: string;
  deviceModel?: string;
  sensorReadings?: SensorReading[];
  activeAlerts?: MonitoringAlert[];
  maintenanceHistory?: MaintenanceRecord[];
  thresholds?: {
    temperatureMin?: number;
    temperatureMax?: number;
    humidityMin?: number;
    humidityMax?: number;
    [key: string]: number | undefined;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Location Relations ───────────────────────────────────────────────────────

export enum RelationType {
  ADJACENT = 'ADJACENT',
  CONNECTED = 'CONNECTED',
  CONTAINS = 'CONTAINS',
  ROUTE = 'ROUTE',
  OVERLAPS = 'OVERLAPS',
  NEAR = 'NEAR',
}

export interface LocationRelation {
  id: string;
  locationId: string;
  relatedLocationId: string;
  relationType: RelationType;
  isActive: boolean;
  distance?: number;
  notes?: string;
  createdAt: string;
  // Populated fields
  relatedLocation?: Pick<Location, 'id' | 'name' | 'locationCode' | 'type' | 'status'>;
}

export interface LocationRelationGroup {
  parents: LocationRelation[];
  children: LocationRelation[];
  adjacent: LocationRelation[];
  connected: LocationRelation[];
  other: LocationRelation[];
}

// ─── Monitoring stats (global endpoint) ──────────────────────────────────────

export interface MonitoringStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  devicesWithAlerts: number;
  lowBatteryDevices: number;
  pendingMaintenance: number;
}

/** A single move event: bovine entered/exited a location (potrero, corral, etc.) */
export interface LocationMovement {
  id: string;
  bovineId: string;
  locationId: string;
  locationName: string;
  locationCode?: string;
  locationType: LocationType;
  enteredAt: string;
  exitedAt?: string;
  /** Duration in days; backend may compute this */
  durationDays?: number;
  /** Reason for move: e.g. 'GRAZING', 'HEALTH', 'ROUTINE', 'SALE_PREP', 'QUARANTINE' */
  reason?: string;
  movementType?: string;
  movedBy?: string;
  movedByName?: string;
  notes?: string;
  coordinates?: { latitude: number; longitude: number };
}
