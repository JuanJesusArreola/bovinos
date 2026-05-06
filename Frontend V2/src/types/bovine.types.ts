export enum BovineStatus {
  ACTIVE = 'ACTIVE',
  SOLD = 'SOLD',
  DECEASED = 'DECEASED',
  QUARANTINED = 'QUARANTINED',
  TRANSFERRED = 'TRANSFERRED',
}

export enum BovineSex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

// Backend CattleType enum (model uses uppercase)
export enum CattleType {
  CATTLE = 'CATTLE',
  BULL = 'BULL',
  COW = 'COW',
  CALF = 'CALF',
}

// Keep BovineType for compatibility but note backend uses CattleType
export enum BovineType {
  DAIRY = 'DAIRY',
  BEEF = 'BEEF',
  DUAL_PURPOSE = 'DUAL_PURPOSE',
  BREEDING = 'BREEDING',
}

// Response from backend formatBovineResponse
export interface Bovine {
  id: string;
  earTag: string;
  name?: string;
  breed: string;
  // Backend returns these fields
  cattleType: string;
  cattleTypeLabel?: string;
  gender: string;
  genderLabel?: string;
  birthDate: string;
  ageInMonths?: number;
  ageInYears?: number;
  ageDisplay?: string;
  weight?: number;
  healthStatus: string;
  healthStatusLabel?: string;
  healthColor?: string;
  vaccinationStatus?: string;
  vaccinationStatusLabel?: string;
  location?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    address?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
  qrCode?: string;
  isAdult?: boolean;
  ranch?: { id: string; name: string };
  lastHealthCheck?: string;
  isPregnant?: boolean;
  expectedCalvingDate?: string;
  daysInOperation?: number;
  notes?: string;
  ranchId?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Genealogy — populated by backend when available
  motherId?: string;
  fatherId?: string;
  mother?: Pick<Bovine, 'id' | 'earTag' | 'name' | 'breed' | 'healthStatus' | 'ageDisplay' | 'gender'>;
  father?: Pick<Bovine, 'id' | 'earTag' | 'name' | 'breed' | 'healthStatus' | 'ageDisplay' | 'gender'>;
}

export interface BovineFilters {
  cattleType?: string;
  gender?: string;
  breed?: string;
  healthStatus?: string;
  vaccinationStatus?: string;
  ranchId?: string;
  search?: string;
  [key: string]: string | number | undefined;
}

export interface BovineStatistics {
  total: number;
  active: number;
  sold: number;
  deceased: number;
  quarantined: number;
  byType: Record<string, number>;
  bySex: Record<string, number>;
  byBreed: Record<string, number>;
  averageAge: number;
  averageWeight: number;
}

// Payload for creating/updating bovines — matches backend CreateBovineData
export interface BovineFormData {
  earTag: string;
  name?: string;
  cattleType: string;
  breed: string;
  gender: string;
  birthDate: string;
  weight?: number;
  notes?: string;
  ranchId?: string;
  /** GPS coordinates — optional. Omit the field entirely when the user has not set them. */
  location?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
  };
  ownerId?: string;
  healthStatus?: string;
  vaccinationStatus?: string;
  motherId?: string;
  fatherId?: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
}
