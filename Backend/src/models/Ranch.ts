import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { LocationData } from './Bovine';

// Enums para tipos de rancho
export enum RanchType {
  DAIRY = 'DAIRY',                             // Lechero
  BEEF = 'BEEF',                               // Carne
  MIXED = 'MIXED',                             // Mixto (leche y carne)
  BREEDING = 'BREEDING',                       // Reproducción/Cría
  FEEDLOT = 'FEEDLOT',                         // Engorda
  ORGANIC = 'ORGANIC',                         // Orgánico
  SUSTAINABLE = 'SUSTAINABLE',                 // Sostenible
  COMMERCIAL = 'COMMERCIAL',                   // Comercial
  FAMILY_FARM = 'FAMILY_FARM',                 // Familiar
  COOPERATIVE = 'COOPERATIVE',                 // Cooperativa
  CORPORATE = 'CORPORATE',                     // Corporativo
  RESEARCH = 'RESEARCH',                       // Investigación
  EDUCATIONAL = 'EDUCATIONAL'                  // Educativo
}

export enum RanchStatus {
  ACTIVE = 'ACTIVE',                           // Activo
  INACTIVE = 'INACTIVE',                       // Inactivo
  UNDER_CONSTRUCTION = 'UNDER_CONSTRUCTION',   // En construcción
  RENOVATION = 'RENOVATION',                   // En renovación
  TEMPORARY_CLOSURE = 'TEMPORARY_CLOSURE',     // Cierre temporal
  PERMANENT_CLOSURE = 'PERMANENT_CLOSURE',     // Cierre permanente
  QUARANTINE = 'QUARANTINE',                   // En cuarentena
  SUSPENDED = 'SUSPENDED',                     // Suspendido
  PENDING_APPROVAL = 'PENDING_APPROVAL'        // Pendiente de aprobación
}

export enum LandTenure {
  OWNED = 'OWNED',                             // Propio
  LEASED = 'LEASED',                           // Arrendado
  SHARED = 'SHARED',                           // Compartido
  EJIDAL = 'EJIDAL',                           // Ejidal
  COMMUNAL = 'COMMUNAL',                       // Comunal
  CONCESSION = 'CONCESSION',                   // Concesión
  COOPERATIVE = 'COOPERATIVE',                 // Cooperativo
  MIXED_TENURE = 'MIXED_TENURE'                // Tenencia mixta
}

export enum ClimateZone {
  TROPICAL = 'TROPICAL',                       // Tropical
  SUBTROPICAL = 'SUBTROPICAL',                 // Subtropical
  TEMPERATE = 'TEMPERATE',                     // Templado
  ARID = 'ARID',                               // Árido
  SEMI_ARID = 'SEMI_ARID',                     // Semiárido
  HUMID = 'HUMID',                             // Húmedo
  SEMI_HUMID = 'SEMI_HUMID',                   // Semihúmedo
  HIGHLAND = 'HIGHLAND',                       // Montañoso
  COASTAL = 'COASTAL'                          // Costero
}

export enum CertificationType {
  ORGANIC = 'ORGANIC',                         // Orgánico
  FAIR_TRADE = 'FAIR_TRADE',                   // Comercio justo
  ANIMAL_WELFARE = 'ANIMAL_WELFARE',           // Bienestar animal
  ENVIRONMENTAL = 'ENVIRONMENTAL',             // Ambiental
  QUALITY_ASSURANCE = 'QUALITY_ASSURANCE',     // Aseguramiento de calidad
  HALAL = 'HALAL',                            // Halal
  KOSHER = 'KOSHER',                          // Kosher
  NON_GMO = 'NON_GMO',                        // No transgénico
  SUSTAINABLE = 'SUSTAINABLE',                 // Sostenible
  CARBON_NEUTRAL = 'CARBON_NEUTRAL',           // Carbono neutral
  GRASS_FED = 'GRASS_FED',                     // Alimentado con pasto
  ANTIBIOTIC_FREE = 'ANTIBIOTIC_FREE'          // Libre de antibióticos
}

// Interface para información del propietario
export interface OwnershipInfo {
  ownerType: 'INDIVIDUAL' | 'FAMILY' | 'CORPORATION' | 'COOPERATIVE' | 'GOVERNMENT' | 'NGO';
  ownerName: string;                           // Nombre del propietario
  ownerTaxId?: string;                         // RFC o ID fiscal
  ownerContact: {                              // Contacto del propietario
    phone: string;
    email: string;
    address: string;
  };
  shareholders?: Array<{                       // Accionistas (si aplica)
    name: string;
    percentage: number;
    role: string;
  }>;
  legalRepresentative?: {                      // Representante legal
    name: string;
    position: string;
    contact: string;
  };
  foundationDate: Date;                        // Fecha de fundación
  businessLicense?: string;                    // Licencia comercial
  taxRegistration?: string;                    // Registro fiscal
}

// Interface para capacidades e infraestructura
export interface RanchCapacity {
  totalArea: number;                           // Área total (hectáreas)
  grazingArea: number;                         // Área de pastoreo
  cropArea?: number;                           // Área de cultivos
  buildingArea?: number;                       // Área construida
  maxCattleCapacity: number;                   // Capacidad máxima de ganado
  currentCattleCount: number;                  // Número actual de ganado
  waterSources: Array<{                        // Fuentes de agua
    type: 'WELL' | 'RIVER' | 'POND' | 'TANK' | 'SPRING' | 'MUNICIPAL';
    name: string;
    capacity: number;                          // Capacidad en litros
    quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    coordinates: LocationData;
  }>;
  facilities: Array<{                          // Instalaciones
    type: string;
    name: string;
    capacity: number;
    condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    lastMaintenance?: Date;
    nextMaintenance?: Date;
  }>;
  equipmentInventory: Array<{                  // Inventario de equipos
    category: string;
    item: string;
    quantity: number;
    condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'NEEDS_REPAIR';
    lastService?: Date;
    nextService?: Date;
  }>;
  pastures: Array<{                            // Pastizales
    name: string;
    area: number;                              // Hectáreas
    grassType: string;
    condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'OVERGRAZING';
    carryingCapacity: number;                  // Animales por hectárea
    restPeriod?: number;                       // Período de descanso (días)
    lastRotation?: Date;
    soilType?: string;
    coordinates: LocationData;
  }>;
}

// Interface para métricas de producción
export interface ProductionMetrics {
  annualMilkProduction?: number;               // Producción anual de leche (litros)
  averageMilkPerCow?: number;                  // Promedio de leche por vaca (L/día)
  milkQualityAverage?: {                       // Calidad promedio de leche
    fatContent: number;
    proteinContent: number;
    somaticCellCount: number;
  };
  annualMeatProduction?: number;               // Producción anual de carne (kg)
  averageWeightGain?: number;                  // Ganancia de peso promedio (kg/día)
  calvingRate?: number;                        // Tasa de partos (%)
  calvingInterval?: number;                    // Intervalo entre partos (días)
  mortalityRate?: number;                      // Tasa de mortalidad (%)
  cullingRate?: number;                        // Tasa de descarte (%)
  feedConversionRatio?: number;                // Conversión alimenticia
  reproductiveEfficiency?: number;             // Eficiencia reproductiva (%)
  healthIncidenceRate?: number;                // Tasa de incidencia de enfermedades (%)
  vaccinationCoverage?: number;                // Cobertura de vacunación (%)
  antibiotic_usage?: number;                   // Uso de antibióticos (días/animal/año)
  organicMatterProduction?: number;            // Producción de materia orgánica (toneladas/año)
}

// Interface para información financiera
export interface FinancialInfo {
  annualRevenue?: number;                      // Ingresos anuales
  annualExpenses?: number;                     // Gastos anuales
  netProfit?: number;                          // Ganancia neta
  profitMargin?: number;                       // Margen de ganancia (%)
  roi?: number;                                // Retorno de inversión (%)
  totalAssets?: number;                        // Activos totales
  totalLiabilities?: number;                   // Pasivos totales
  equity?: number;                             // Patrimonio
  cashFlow?: number;                           // Flujo de caja
  debtToEquityRatio?: number;                  // Relación deuda/patrimonio
  operatingCosts: {                            // Costos operativos
    feed: number;
    labor: number;
    veterinary: number;
    utilities: number;
    maintenance: number;
    insurance: number;
    taxes: number;
    other: number;
  };
  revenueStreams: Array<{                      // Fuentes de ingresos
    source: string;
    percentage: number;
    amount: number;
  }>;
  budgetYear: number;                          // Año del presupuesto
  lastFinancialAudit?: Date;                   // Última auditoría financiera
}

// Interface para sostenibilidad y medio ambiente
export interface SustainabilityInfo {
  carbonFootprint?: number;                    // Huella de carbono (toneladas CO2/año)
  waterUsageEfficiency?: number;               // Eficiencia del uso de agua
  energyConsumption?: number;                  // Consumo de energía (kWh/año)
  renewableEnergyPercentage?: number;          // Porcentaje de energía renovable
  wasteManagement: {                           // Manejo de residuos
    manureManagement: 'COMPOSTING' | 'BIOGAS' | 'DIRECT_APPLICATION' | 'LAGOON';
    wasteReduction: number;                    // Reducción de residuos (%)
    recyclingRate: number;                     // Tasa de reciclaje (%)
  };
  biodiversityIndex?: number;                  // Índice de biodiversidad
  soilHealthScore?: number;                    // Puntuación de salud del suelo
  conservationPractices: string[];             // Prácticas de conservación
  environmentalCertifications: CertificationType[]; // Certificaciones ambientales
  sustainabilityGoals: Array<{                 // Metas de sostenibilidad
    goal: string;
    targetDate: Date;
    progress: number;                          // Progreso (%)
    metrics: string;
  }>;
  climateAdaptation: {                         // Adaptación al cambio climático
    risks: string[];                           // Riesgos identificados
    mitigation_measures: string[];             // Medidas de mitigación
    adaptation_strategies: string[];           // Estrategias de adaptación
  };
}

// Interface para tecnología e innovación
export interface TechnologyInfo {
  automationLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'FULLY_AUTOMATED'; // Nivel de automatización
  digitalSolutions: Array<{                    // Soluciones digitales
    type: string;
    provider: string;
    implementation_date: Date;
    status: 'ACTIVE' | 'INACTIVE' | 'TESTING';
  }>;
  precisionAgriculture?: {                     // Agricultura de precisión
    gpsGuidedEquipment: boolean;
    soilMapping: boolean;
    variableRateApplication: boolean;
    droneSurveillance: boolean;
    satelliteMonitoring: boolean;
  };
  iotDevices?: Array<{                         // Dispositivos IoT
    type: string;
    brand: string;
    quantity: number;
    purpose: string;
    lastUpdate: Date;
  }>;
  dataManagement: {                            // Manejo de datos
    dataCollection: string[];
    dataStorage: 'LOCAL' | 'CLOUD' | 'HYBRID';
    analytics_tools: string[];
    reporting_frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  };
  innovation_projects?: Array<{                // Proyectos de innovación
    name: string;
    description: string;
    status: 'PLANNING' | 'IMPLEMENTATION' | 'COMPLETED';
    budget: number;
    expectedBenefits: string;
  }>;
}

// Interface para recursos humanos
export interface HumanResourcesInfo {
  totalEmployees: number;                      // Total de empleados
  permanentStaff: number;                      // Personal permanente
  temporaryStaff: number;                      // Personal temporal
  managementStaff: number;                     // Personal gerencial
  skillLevels: {                               // Niveles de habilidad
    beginner: number;
    intermediate: number;
    advanced: number;
    expert: number;
  };
  trainingPrograms: Array<{                    // Programas de capacitación
    name: string;
    type: string;
    frequency: string;
    participants: number;
    lastSession: Date;
    nextSession?: Date;
  }>;
  safetyMetrics: {                             // Métricas de seguridad
    accidentRate: number;                      // Tasa de accidentes
    trainingHours: number;                     // Horas de capacitación
    safetyEquipmentUsage: number;              // Uso de equipo de seguridad (%)
    lastSafetyAudit: Date;
  };
  laborCosts: {                                // Costos laborales
    averageWage: number;
    benefits: number;
    training_costs: number;
    totalAnnualCost: number;
  };
  turnoverRate?: number;                       // Tasa de rotación (%)
  satisfactionScore?: number;                  // Puntuación de satisfacción
}

// Atributos del modelo Ranch
export interface RanchAttributes {
  id: string;
  ranchCode: string;                           // Código único del rancho
  name: string;                                // Nombre del rancho
  description?: string;                        // Descripción del rancho
  type: RanchType;                             // Tipo de rancho
  status: RanchStatus;                         // Estado del rancho
  coordinates: LocationData;                   // Coordenadas principales
  address: string;                             // Dirección física
  city: string;                                // Ciudad
  state: string;                               // Estado/Provincia
  country: string;                             // País
  postalCode?: string;                         // Código postal
  timezone: string;                            // Zona horaria
  landTenure: LandTenure;                      // Tipo de tenencia
  climateZone: ClimateZone;                    // Zona climática
  elevation?: number;                          // Elevación (metros)
  annualRainfall?: number;                     // Precipitación anual (mm)
  averageTemperature?: number;                 // Temperatura promedio (°C)
  ownershipInfo: OwnershipInfo;                // Información del propietario
  capacity: RanchCapacity;                     // Capacidades e infraestructura
  productionMetrics?: ProductionMetrics;       // Métricas de producción
  financialInfo?: FinancialInfo;               // Información financiera
  sustainabilityInfo?: SustainabilityInfo;     // Información de sostenibilidad
  technologyInfo?: TechnologyInfo;             // Información de tecnología
  hrInfo?: HumanResourcesInfo;                 // Información de recursos humanos
  certifications?: Array<{                     // Certificaciones
    type: CertificationType;
    certifyingBody: string;
    certificateNumber: string;
    issueDate: Date;
    expirationDate: Date;
    status: 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'PENDING';
    documents?: string[];
  }>;
  licenses?: Array<{                           // Licencias y permisos
    type: string;
    authority: string;
    licenseNumber: string;
    issueDate: Date;
    expirationDate: Date;
    status: 'VALID' | 'EXPIRED' | 'SUSPENDED';
  }>;
  insurance?: Array<{                          // Seguros
    type: string;
    provider: string;
    policyNumber: string;
    coverage: number;
    premium: number;
    startDate: Date;
    endDate: Date;
    beneficiaries?: string[];
  }>;
  emergencyPlan?: {                            // Plan de emergencias
    contacts: Array<{
      name: string;
      role: string;
      phone: string;
      email?: string;
    }>;
    procedures: string[];
    evacuationRoutes: string[];
    assemblyPoints: LocationData[];
    emergencySupplies: string[];
    lastDrillDate?: Date;
    nextDrillDate?: Date;
  };
  qualityStandards?: {                         // Estándares de calidad
    standards: string[];                       // Estándares aplicados
    lastAudit: Date;                          // Última auditoría
    nextAudit: Date;                          // Próxima auditoría
    auditResults: string;                      // Resultados de auditoría
    corrective_actions?: string[];             // Acciones correctivas
  };
  marketPosition?: {                           // Posición en el mercado
    primaryMarkets: string[];                  // Mercados principales
    competitors: string[];                     // Competidores
    marketShare?: number;                      // Participación de mercado (%)
    brand_recognition?: number;                // Reconocimiento de marca
    customer_satisfaction?: number;            // Satisfacción del cliente
  };
  images?: string[];                           // URLs de imágenes
  documents?: string[];                        // URLs de documentos
  maps?: string[];                             // URLs de mapas
  videos?: string[];                           // URLs de videos
  website?: string;                            // Sitio web
  socialMedia?: {                              // Redes sociales
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  tags?: string[];                             // Etiquetas
  notes?: string;                              // Notas adicionales
  isActive: boolean;                           // Si el rancho está activo
  isVerified: boolean;                         // Si está verificado
  verifiedBy?: string;                         // ID del usuario que verificó
  verifiedDate?: Date;                         // Fecha de verificación
  lastInspectionDate?: Date;                   // Fecha de última inspección
  nextInspectionDate?: Date;                   // Fecha de próxima inspección
  complianceScore?: number;                    // Puntuación de cumplimiento
  createdBy: string;                           // ID del usuario que creó
  updatedBy?: string;                          // ID del usuario que actualizó
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Atributos opcionales al crear un nuevo rancho
export interface RanchCreationAttributes 
  extends Optional<RanchAttributes, 
    'id' | 'description' | 'postalCode' | 'elevation' | 'annualRainfall' | 
    'averageTemperature' | 'productionMetrics' | 'financialInfo' | 
    'sustainabilityInfo' | 'technologyInfo' | 'hrInfo' | 'certifications' | 
    'licenses' | 'insurance' | 'emergencyPlan' | 'qualityStandards' | 
    'marketPosition' | 'images' | 'documents' | 'maps' | 'videos' | 
    'website' | 'socialMedia' | 'tags' | 'notes' | 'verifiedBy' | 
    'verifiedDate' | 'lastInspectionDate' | 'nextInspectionDate' | 
    'complianceScore' | 'updatedBy' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > {}

// Clase del modelo Ranch
class Ranch extends Model<RanchAttributes, RanchCreationAttributes> 
  implements RanchAttributes {
  public id!: string;
  public ranchCode!: string;
  public name!: string;
  public description?: string;
  public type!: RanchType;
  public status!: RanchStatus;
  public coordinates!: LocationData;
  public address!: string;
  public city!: string;
  public state!: string;
  public country!: string;
  public postalCode?: string;
  public timezone!: string;
  public landTenure!: LandTenure;
  public climateZone!: ClimateZone;
  public elevation?: number;
  public annualRainfall?: number;
  public averageTemperature?: number;
  public ownershipInfo!: OwnershipInfo;
  public capacity!: RanchCapacity;
  public productionMetrics?: ProductionMetrics;
  public financialInfo?: FinancialInfo;
  public sustainabilityInfo?: SustainabilityInfo;
  public technologyInfo?: TechnologyInfo;
  public hrInfo?: HumanResourcesInfo;
  public certifications?: Array<{
    type: CertificationType;
    certifyingBody: string;
    certificateNumber: string;
    issueDate: Date;
    expirationDate: Date;
    status: 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'PENDING';
    documents?: string[];
  }>;
  public licenses?: Array<{
    type: string;
    authority: string;
    licenseNumber: string;
    issueDate: Date;
    expirationDate: Date;
    status: 'VALID' | 'EXPIRED' | 'SUSPENDED';
  }>;
  public insurance?: Array<{
    type: string;
    provider: string;
    policyNumber: string;
    coverage: number;
    premium: number;
    startDate: Date;
    endDate: Date;
    beneficiaries?: string[];
  }>;
  public emergencyPlan?: {
    contacts: Array<{
      name: string;
      role: string;
      phone: string;
      email?: string;
    }>;
    procedures: string[];
    evacuationRoutes: string[];
    assemblyPoints: LocationData[];
    emergencySupplies: string[];
    lastDrillDate?: Date;
    nextDrillDate?: Date;
  };
  public qualityStandards?: {
    standards: string[];
    lastAudit: Date;
    nextAudit: Date;
    auditResults: string;
    corrective_actions?: string[];
  };
  public marketPosition?: {
    primaryMarkets: string[];
    competitors: string[];
    marketShare?: number;
    brand_recognition?: number;
    customer_satisfaction?: number;
  };
  public images?: string[];
  public documents?: string[];
  public maps?: string[];
  public videos?: string[];
  public website?: string;
  public socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  public tags?: string[];
  public notes?: string;
  public isActive!: boolean;
  public isVerified!: boolean;
  public verifiedBy?: string;
  public verifiedDate?: Date;
  public lastInspectionDate?: Date;
  public nextInspectionDate?: Date;
  public complianceScore?: number;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // Métodos de instancia

  /**
   * Obtiene el tipo de rancho en español
   * @returns Tipo de rancho traducido
   */
  public getRanchTypeLabel(): string {
    const labels = {
      [RanchType.DAIRY]: 'Lechero',
      [RanchType.BEEF]: 'Carne',
      [RanchType.MIXED]: 'Mixto',
      [RanchType.BREEDING]: 'Reproducción/Cría',
      [RanchType.FEEDLOT]: 'Engorda',
      [RanchType.ORGANIC]: 'Orgánico',
      [RanchType.SUSTAINABLE]: 'Sostenible',
      [RanchType.COMMERCIAL]: 'Comercial',
      [RanchType.FAMILY_FARM]: 'Familiar',
      [RanchType.COOPERATIVE]: 'Cooperativa',
      [RanchType.CORPORATE]: 'Corporativo',
      [RanchType.RESEARCH]: 'Investigación',
      [RanchType.EDUCATIONAL]: 'Educativo'
    };
    return labels[this.type];
  }

  /**
   * Obtiene el estado del rancho en español
   * @returns Estado traducido
   */
  public getStatusLabel(): string {
    const labels = {
      [RanchStatus.ACTIVE]: 'Activo',
      [RanchStatus.INACTIVE]: 'Inactivo',
      [RanchStatus.UNDER_CONSTRUCTION]: 'En Construcción',
      [RanchStatus.RENOVATION]: 'En Renovación',
      [RanchStatus.TEMPORARY_CLOSURE]: 'Cierre Temporal',
      [RanchStatus.PERMANENT_CLOSURE]: 'Cierre Permanente',
      [RanchStatus.QUARANTINE]: 'En Cuarentena',
      [RanchStatus.SUSPENDED]: 'Suspendido',
      [RanchStatus.PENDING_APPROVAL]: 'Pendiente de Aprobación'
    };
    return labels[this.status];
  }

  /**
   * Calcula la capacidad de ocupación actual
   * @returns Porcentaje de ocupación
   */
  public getOccupancyRate(): number {
    if (this.capacity.maxCattleCapacity === 0) return 0;
    return (this.capacity.currentCattleCount / this.capacity.maxCattleCapacity) * 100;
  }

  /**
   * Obtiene la capacidad disponible
   * @returns Número de animales que se pueden agregar
   */
  public getAvailableCapacity(): number {
    return Math.max(0, this.capacity.maxCattleCapacity - this.capacity.currentCattleCount);
  }

  /**
   * Verifica si el rancho está en capacidad máxima
   * @returns True si está en capacidad máxima
   */
  public isAtCapacity(): boolean {
    return this.capacity.currentCattleCount >= this.capacity.maxCattleCapacity;
  }

  /**
   * Calcula la densidad de ganado por hectárea
   * @returns Animales por hectárea
   */
  public getCattleDensity(): number {
    if (this.capacity.grazingArea === 0) return 0;
    return this.capacity.currentCattleCount / this.capacity.grazingArea;
  }

  /**
   * Obtiene las certificaciones vigentes
   * @returns Array de certificaciones válidas
   */
  public getValidCertifications(): Array<{
    type: string;
    certifyingBody: string;
    expirationDate: Date;
    daysToExpiration: number;
  }> {
    if (!this.certifications) return [];
    
    const now = new Date();
    return this.certifications
      .filter(cert => cert.status === 'VALID' && cert.expirationDate > now)
      .map(cert => ({
        type: cert.type,
        certifyingBody: cert.certifyingBody,
        expirationDate: cert.expirationDate,
        daysToExpiration: Math.ceil((cert.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      }));
  }

  /**
   * Obtiene las licencias vigentes
   * @returns Array de licencias válidas
   */
  public getValidLicenses(): Array<{
    type: string;
    authority: string;
    expirationDate: Date;
    daysToExpiration: number;
  }> {
    if (!this.licenses) return [];
    
    const now = new Date();
    return this.licenses
      .filter(license => license.status === 'VALID' && license.expirationDate > now)
      .map(license => ({
        type: license.type,
        authority: license.authority,
        expirationDate: license.expirationDate,
        daysToExpiration: Math.ceil((license.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      }));
  }

  /**
   * Calcula la puntuación de sostenibilidad
   * @returns Puntuación de sostenibilidad (0-100)
   */
  public getSustainabilityScore(): {
    score: number;
    category: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
    breakdown: {
      carbon: number;
      water: number;
      energy: number;
      waste: number;
      biodiversity: number;
    };
  } {
    if (!this.sustainabilityInfo) {
      return {
        score: 0,
        category: 'POOR',
        breakdown: { carbon: 0, water: 0, energy: 0, waste: 0, biodiversity: 0 }
      };
    }
    
    const breakdown = {
      carbon: this.sustainabilityInfo.carbonFootprint ? Math.max(0, 100 - (this.sustainabilityInfo.carbonFootprint / 10)) : 50,
      water: this.sustainabilityInfo.waterUsageEfficiency ? this.sustainabilityInfo.waterUsageEfficiency : 50,
      energy: this.sustainabilityInfo.renewableEnergyPercentage || 0,
      waste: this.sustainabilityInfo.wasteManagement.recyclingRate || 0,
      biodiversity: this.sustainabilityInfo.biodiversityIndex ? this.sustainabilityInfo.biodiversityIndex * 10 : 50
    };
    
    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0) / 5;
    
    let category: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
    if (score >= 80) category = 'EXCELLENT';
    else if (score >= 60) category = 'GOOD';
    else if (score >= 40) category = 'FAIR';
    else category = 'POOR';
    
    return { score: Math.round(score), category, breakdown };
  }

  /**
   * Calcula la eficiencia económica
   * @returns Métricas de eficiencia económica
   */
  public getEconomicEfficiency(): {
    profitability: number;
    efficiency: number;
    category: 'LOW' | 'MEDIUM' | 'HIGH';
  } | null {
    if (!this.financialInfo || !this.productionMetrics) return null;
    
    const profitability = this.financialInfo.profitMargin || 0;
    const revenuePerAnimal = this.financialInfo.annualRevenue ? 
      this.financialInfo.annualRevenue / this.capacity.currentCattleCount : 0;
    
    const efficiency = (profitability + (revenuePerAnimal / 1000)) / 2; // Normalizado
    
    let category: 'LOW' | 'MEDIUM' | 'HIGH';
    if (efficiency >= 70) category = 'HIGH';
    else if (efficiency >= 40) category = 'MEDIUM';
    else category = 'LOW';
    
    return {
      profitability: Math.round(profitability),
      efficiency: Math.round(efficiency),
      category
    };
  }

  /**
   * Verifica si necesita inspección
   * @returns True si necesita inspección
   */
  public needsInspection(): boolean {
    if (!this.nextInspectionDate) return true;
    return new Date() >= new Date(this.nextInspectionDate);
  }

  /**
   * Obtiene alertas activas del rancho
   * @returns Array de alertas
   */
  public getActiveAlerts(): Array<{
    type: 'WARNING' | 'CRITICAL' | 'INFO';
    category: string;
    message: string;
    priority: number;
  }> {
    const alerts: Array<{
      type: 'WARNING' | 'CRITICAL' | 'INFO';
      category: string;
      message: string;
      priority: number;
    }> = [];
    
    // Verificar capacidad
    const occupancy = this.getOccupancyRate();
    if (occupancy >= 95) {
      alerts.push({
        type: 'CRITICAL',
        category: 'Capacidad',
        message: 'Rancho en capacidad máxima',
        priority: 1
      });
    } else if (occupancy >= 85) {
      alerts.push({
        type: 'WARNING',
        category: 'Capacidad',
        message: 'Capacidad del rancho alta',
        priority: 2
      });
    }
    
    // Verificar certificaciones próximas a vencer
    const validCertifications = this.getValidCertifications();
    validCertifications.forEach(cert => {
      if (cert.daysToExpiration <= 30) {
        alerts.push({
          type: cert.daysToExpiration <= 7 ? 'CRITICAL' : 'WARNING',
          category: 'Certificación',
          message: `Certificación ${cert.type} vence en ${cert.daysToExpiration} días`,
          priority: cert.daysToExpiration <= 7 ? 1 : 2
        });
      }
    });
    
    // Verificar licencias próximas a vencer
    const validLicenses = this.getValidLicenses();
    validLicenses.forEach(license => {
      if (license.daysToExpiration <= 30) {
        alerts.push({
          type: license.daysToExpiration <= 7 ? 'CRITICAL' : 'WARNING',
          category: 'Licencia',
          message: `Licencia ${license.type} vence en ${license.daysToExpiration} días`,
          priority: license.daysToExpiration <= 7 ? 1 : 2
        });
      }
    });
    
    // Verificar inspección
    if (this.needsInspection()) {
      alerts.push({
        type: 'WARNING',
        category: 'Inspección',
        message: 'Inspección vencida o programada',
        priority: 2
      });
    }
    
    // Verificar puntuación de cumplimiento
    if (this.complianceScore !== undefined && this.complianceScore < 70) {
      alerts.push({
        type: this.complianceScore < 50 ? 'CRITICAL' : 'WARNING',
        category: 'Cumplimiento',
        message: `Puntuación de cumplimiento baja: ${this.complianceScore}%`,
        priority: this.complianceScore < 50 ? 1 : 2
      });
    }
    
    return alerts.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Genera un resumen completo del rancho
   * @returns Resumen detallado
   */
  public getRanchSummary(): {
    basic: {
      name: string;
      type: string;
      status: string;
      area: number;
      location: string;
    };
    capacity: {
      current: number;
      maximum: number;
      occupancyRate: number;
      available: number;
      density: number;
    };
    compliance: {
      isVerified: boolean;
      certifications: number;
      licenses: number;
      complianceScore?: number;
      needsInspection: boolean;
    };
    sustainability: {
      score: number;
      category: string;
    };
    economic?: {
      profitability: number;
      efficiency: number;
      category: string;
    };
    alerts: Array<{
      type: string;
      category: string;
      message: string;
      priority: number;
    }>;
  } {
    const sustainability = this.getSustainabilityScore();
    const economic = this.getEconomicEfficiency();
    const alerts = this.getActiveAlerts();
    
    return {
      basic: {
        name: this.name,
        type: this.getRanchTypeLabel(),
        status: this.getStatusLabel(),
        area: this.capacity.totalArea,
        location: `${this.city}, ${this.state}, ${this.country}`
      },
      capacity: {
        current: this.capacity.currentCattleCount,
        maximum: this.capacity.maxCattleCapacity,
        occupancyRate: Math.round(this.getOccupancyRate()),
        available: this.getAvailableCapacity(),
        density: Math.round(this.getCattleDensity() * 100) / 100
      },
      compliance: {
        isVerified: this.isVerified,
        certifications: this.getValidCertifications().length,
        licenses: this.getValidLicenses().length,
        complianceScore: this.complianceScore,
        needsInspection: this.needsInspection()
      },
      sustainability: {
        score: sustainability.score,
        category: sustainability.category
      },
      economic: economic ? {
        profitability: economic.profitability,
        efficiency: economic.efficiency,
        category: economic.category
      } : undefined,
      alerts
    };
  }

  /**
   * Calcula la dirección completa
   * @returns Dirección formateada
   */
  public getFullAddress(): string {
    const parts = [this.address, this.city, this.state, this.country];
    if (this.postalCode) parts.splice(-1, 0, this.postalCode);
    return parts.join(', ');
  }

  /**
   * Verifica si el rancho está operativo
   * @returns True si está operativo
   */
  public isOperational(): boolean {
    return this.isActive && 
           this.status === RanchStatus.ACTIVE &&
           this.isVerified;
  }
}

// Definición del modelo en Sequelize
Ranch.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del rancho'
    },
    ranchCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [3, 50]
      },
      comment: 'Código único del rancho'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 200]
      },
      comment: 'Nombre del rancho'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción del rancho'
    },
    type: {
      type: DataTypes.ENUM(...Object.values(RanchType)),
      allowNull: false,
      comment: 'Tipo de rancho'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(RanchStatus)),
      allowNull: false,
      defaultValue: RanchStatus.ACTIVE,
      comment: 'Estado del rancho'
    },
    coordinates: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidCoordinates(value: LocationData) {
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
      comment: 'Coordenadas geográficas principales del rancho'
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: 'Dirección física del rancho'
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: 'Ciudad donde se ubica el rancho'
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: 'Estado o provincia del rancho'
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'México',
      comment: 'País donde se ubica el rancho'
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Código postal'
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'America/Mexico_City',
      comment: 'Zona horaria del rancho'
    },
    landTenure: {
      type: DataTypes.ENUM(...Object.values(LandTenure)),
      allowNull: false,
      comment: 'Tipo de tenencia de la tierra'
    },
    climateZone: {
      type: DataTypes.ENUM(...Object.values(ClimateZone)),
      allowNull: false,
      comment: 'Zona climática del rancho'
    },
    elevation: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: 'Elevación sobre el nivel del mar (metros)'
    },
    annualRainfall: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Precipitación anual promedio (mm)'
    },
    averageTemperature: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Temperatura promedio anual (°C)'
    },
    ownershipInfo: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidOwnership(value: OwnershipInfo) {
          if (!value.ownerName || !value.ownerContact) {
            throw new Error('Información del propietario es requerida');
          }
        }
      },
      comment: 'Información del propietario y estructura legal'
    },
    capacity: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidCapacity(value: RanchCapacity) {
          if (value.totalArea <= 0 || value.maxCattleCapacity <= 0) {
            throw new Error('Área total y capacidad máxima deben ser mayores a cero');
          }
          if (value.currentCattleCount > value.maxCattleCapacity) {
            throw new Error('El ganado actual no puede exceder la capacidad máxima');
          }
        }
      },
      comment: 'Capacidades e infraestructura del rancho'
    },
    productionMetrics: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Métricas de producción del rancho'
    },
    financialInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información financiera del rancho'
    },
    sustainabilityInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de sostenibilidad y medio ambiente'
    },
    technologyInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de tecnología e innovación'
    },
    hrInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de recursos humanos'
    },
    certifications: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Certificaciones del rancho'
    },
    licenses: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Licencias y permisos del rancho'
    },
    insurance: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de seguros'
    },
    emergencyPlan: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Plan de emergencias del rancho'
    },
    qualityStandards: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Estándares de calidad aplicados'
    },
    marketPosition: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Posición en el mercado'
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de imágenes del rancho'
    },
    documents: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de documentos relacionados'
    },
    maps: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de mapas del rancho'
    },
    videos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de videos del rancho'
    },
    website: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      },
      comment: 'Sitio web del rancho'
    },
    socialMedia: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Perfiles de redes sociales'
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
      comment: 'Notas adicionales del rancho'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el rancho está activo'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el rancho está verificado'
    },
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que verificó'
    },
    verifiedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de verificación'
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
    complianceScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      },
      comment: 'Puntuación de cumplimiento (0-100)'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó el rancho'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó el rancho'
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
    modelName: 'Ranch',
    tableName: 'ranches',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para optimizar consultas
      {
        unique: true,
        fields: ['ranch_code']
      },
      {
        fields: ['name']
      },
      {
        fields: ['type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['land_tenure']
      },
      {
        fields: ['climate_zone']
      },
      {
        fields: ['city']
      },
      {
        fields: ['state']
      },
      {
        fields: ['country']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_verified']
      },
      {
        fields: ['next_inspection_date']
      },
      {
        fields: ['compliance_score']
      },
      {
        name: 'ranches_coordinates_gin',
        fields: ['coordinates'],
        using: 'gin'
      },
      {
        name: 'ranches_type_status',
        fields: ['type', 'status']
      },
      {
        name: 'ranches_location_search',
        fields: ['city', 'state', 'country']
      },
      {
        name: 'ranches_capacity_search',
        fields: ['type', 'is_active'],
        where: {
          is_active: true
        }
      }
    ],
    hooks: {
      // Hook para validaciones complejas antes de guardar
      beforeSave: async (ranch: Ranch) => {
        // Validar fechas de inspección
        if (ranch.lastInspectionDate && ranch.nextInspectionDate) {
          if (ranch.nextInspectionDate <= ranch.lastInspectionDate) {
            throw new Error('La próxima inspección debe ser posterior a la última');
          }
        }

        // Validar que el rancho verificado tenga información completa
        if (ranch.isVerified) {
          if (!ranch.verifiedBy || !ranch.verifiedDate) {
            throw new Error('Rancho verificado debe tener información de verificación');
          }
        }

        // Validar coherencia en información financiera
        if (ranch.financialInfo) {
          const fi = ranch.financialInfo;
          if (fi.annualRevenue && fi.annualExpenses && fi.netProfit) {
            const calculatedProfit = fi.annualRevenue - fi.annualExpenses;
            if (Math.abs(calculatedProfit - fi.netProfit) > 1000) { // Tolerancia de $1000
              throw new Error('Ganancia neta no coincide con ingresos menos gastos');
            }
          }
        }

        // Validar área de pastoreo no mayor al área total
        if (ranch.capacity.grazingArea > ranch.capacity.totalArea) {
          throw new Error('Área de pastoreo no puede ser mayor al área total');
        }

        // Validar coordenadas dentro de México si el país es México
        if (ranch.country === 'México') {
          const { latitude, longitude } = ranch.coordinates;
          if (latitude < 14.5 || latitude > 32.7 || longitude < -118.4 || longitude > -86.7) {
            throw new Error('Coordenadas fuera del territorio mexicano');
          }
        }
      }
    },
    comment: 'Tabla principal para el manejo de ranchos/fincas ganaderas'
  }
);

export default Ranch;