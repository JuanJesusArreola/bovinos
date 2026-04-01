// modules/bovine/dtos/bovine-response.dto.ts
import { CattleType, GenderType, HealthStatus, VaccinationStatus } from '../models/Bovine';

export interface BovineResponse {
    id: string;
    earTag: string;
    name?: string;
    cattleType: CattleType;
    cattleTypeLabel: string;
    breed: string;
    gender: GenderType;
    genderLabel: string;
    birthDate: Date;
    ageInMonths: number;
    ageInYears: number;
    ageDisplay: string;
    weight?: number;
    healthStatus: HealthStatus;
    healthStatusLabel: string;
    healthColor: string;
    vaccinationStatus: VaccinationStatus;
    vaccinationStatusLabel: string;
    location: any;
    qrCode: string;
    isAdult: boolean;
    ranch?: {
        id: string;
        name: string;
    };
    lastHealthCheck?: Date;
    isPregnant?: boolean;
    expectedCalvingDate?: Date;
    daysInOperation?: number;
}