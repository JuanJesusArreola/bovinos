export enum RanchType {
  DAIRY = 'DAIRY',
  BEEF = 'BEEF',
  MIXED = 'MIXED',
  BREEDING = 'BREEDING',
  FEEDLOT = 'FEEDLOT',
  ORGANIC = 'ORGANIC',
  SUSTAINABLE = 'SUSTAINABLE',
  COMMERCIAL = 'COMMERCIAL',
  FAMILY_FARM = 'FAMILY_FARM',
  COOPERATIVE = 'COOPERATIVE',
  CORPORATE = 'CORPORATE',
  RESEARCH = 'RESEARCH',
  EDUCATIONAL = 'EDUCATIONAL',
}

export enum RanchStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  UNDER_CONSTRUCTION = 'UNDER_CONSTRUCTION',
  RENOVATION = 'RENOVATION',
  TEMPORARY_CLOSURE = 'TEMPORARY_CLOSURE',
  PERMANENT_CLOSURE = 'PERMANENT_CLOSURE',
  QUARANTINE = 'QUARANTINE',
  SUSPENDED = 'SUSPENDED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export enum LandTenure {
  OWNED = 'OWNED',
  LEASED = 'LEASED',
  SHARED = 'SHARED',
  EJIDAL = 'EJIDAL',
  COMMUNAL = 'COMMUNAL',
  CONCESSION = 'CONCESSION',
  COOPERATIVE = 'COOPERATIVE',
  MIXED_TENURE = 'MIXED_TENURE',
}

export enum ClimateZone {
  TROPICAL = 'TROPICAL',
  SUBTROPICAL = 'SUBTROPICAL',
  TEMPERATE = 'TEMPERATE',
  ARID = 'ARID',
  SEMI_ARID = 'SEMI_ARID',
  HUMID = 'HUMID',
  SEMI_HUMID = 'SEMI_HUMID',
  HIGHLAND = 'HIGHLAND',
  COASTAL = 'COASTAL',
}

export interface Ranch {
  id: string;
  ranchCode: string;
  name: string;
  description?: string;
  type: RanchType;
  status: RanchStatus;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  timezone: string;
  coordinates: { latitude: number; longitude: number };
  landTenure: LandTenure;
  climateZone: ClimateZone;
  elevation?: number;
  annualRainfall?: number;
  averageTemperature?: number;
  /** Radio operativo del rancho en km — legacy/fallback cuando no hay `boundary` configurado */
  boundaryRadius?: number;
  /**
   * Perímetro real del rancho (polígono/rectángulo/círculo/corredor).
   * Cuando está configurado, el backend valida POST/PUT /locations contra esta forma.
   * Reusa la misma estructura que Location.geofenceConfig.
   */
  boundary?: import('./location.types').GeofenceConfig | null;
  totalArea: number;
  grazingArea: number;
  maxCattleCapacity: number;
  currentCattleCount: number;
  isActive: boolean;
  isVerified: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RanchFormData {
  ranchCode: string;
  name: string;
  description?: string;
  type: RanchType;
  status?: RanchStatus;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  timezone: string;
  coordinates: { latitude: number; longitude: number };
  landTenure: LandTenure;
  climateZone: ClimateZone;
  elevation?: number;
  annualRainfall?: number;
  averageTemperature?: number;
  /** Radio operativo del rancho en km — legacy/fallback */
  boundaryRadius?: number;
  /** Real ranch boundary (Phase B). */
  boundary?: import('./location.types').GeofenceConfig | null;
  totalArea: number;
  grazingArea: number;
  maxCattleCapacity: number;
}

/**
 * Mirror of backend RanchCoreService.getRanchSummary().
 * Returned by GET /api/ranch/:id/summary.
 */
export interface RanchSummary {
  id: string;
  ranchCode: string;
  name: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  totalArea: number;
  grazingArea: number;
  maxCattleCapacity: number;
  currentCattleCount: number;
  /** Porcentaje 0-100 (currentCattleCount / maxCattleCapacity * 100) */
  occupancyRate: number;
  /** Animales por hectárea (currentCattleCount / totalArea) */
  cattleDensity: number;
  isAtCapacity: boolean;
  availableCapacity: number;
  coordinates?: any;
  /** Legacy circular fallback (kilometers). */
  boundaryRadius?: number;
  /** Real ranch perimeter (Phase B). Null when not configured. */
  boundary?: import('./location.types').GeofenceConfig | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mirror of backend RanchService.getRanchBoundary().
 * Returned by GET /api/ranches/:id/boundary.
 * Lighter payload than getById() — only the fields needed for geo-validation.
 */
export interface RanchBoundaryDto {
  ranchId: string;
  name: string;
  coordinates: { latitude: number; longitude: number };
  /** Legacy circular fallback (kilometers). */
  boundaryRadius?: number;
  /** Real perimeter, or null when not configured. */
  boundary: import('./location.types').GeofenceConfig | null;
}

// ─── Ranch Media ──────────────────────────────────────────────────────────

export enum MediaType {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  VIDEO = 'VIDEO',
  MAP = 'MAP',
  AUDIO = 'AUDIO',
  OTHER = 'OTHER',
}

export enum MediaCategory {
  LOGO = 'LOGO',
  AERIAL_PHOTO = 'AERIAL_PHOTO',
  SATELLITE_IMAGE = 'SATELLITE_IMAGE',
  PROPERTY_MAP = 'PROPERTY_MAP',
  FACILITY_PHOTO = 'FACILITY_PHOTO',
  LIVESTOCK_PHOTO = 'LIVESTOCK_PHOTO',
  CERTIFICATE = 'CERTIFICATE',
  LICENSE = 'LICENSE',
  CONTRACT = 'CONTRACT',
  REPORT = 'REPORT',
  PLAN = 'PLAN',
  LEGAL_DOCUMENT = 'LEGAL_DOCUMENT',
  FINANCIAL_DOCUMENT = 'FINANCIAL_DOCUMENT',
  OTHER = 'OTHER',
}

export enum MediaVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  SHARED = 'SHARED',
  ARCHIVED = 'ARCHIVED',
}

export interface RanchMedia {
  id: string;
  ranchId: string;
  type: MediaType;
  category: MediaCategory;
  title: string;
  description?: string;
  url: string;
  storagePath?: string;
  filename: string;
  filesize: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  uploadDate: string;
  takenDate?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  visibility: MediaVisibility;
  locationId?: string;
  bovineId?: string;
  metadata?: Record<string, unknown>;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}
