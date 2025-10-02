"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationPreference = exports.Specialization = exports.VerificationStatus = exports.AccessLevel = exports.UserStatus = exports.UserRole = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const bcrypt = {
    async hash(password, saltRounds) {
        return `hashed_${password}_salt_${saltRounds}`;
    },
    async compare(password, hash) {
        return hash === `hashed_${password}_salt_12`;
    }
};
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["RANCH_MANAGER"] = "RANCH_MANAGER";
    UserRole["VETERINARIAN"] = "VETERINARIAN";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "ACTIVE";
    UserStatus["INACTIVE"] = "INACTIVE";
    UserStatus["SUSPENDED"] = "SUSPENDED";
    UserStatus["PENDING_VERIFICATION"] = "PENDING_VERIFICATION";
    UserStatus["BLOCKED"] = "BLOCKED";
    UserStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var AccessLevel;
(function (AccessLevel) {
    AccessLevel["BASIC"] = "BASIC";
    AccessLevel["STANDARD"] = "STANDARD";
    AccessLevel["PREMIUM"] = "PREMIUM";
    AccessLevel["ENTERPRISE"] = "ENTERPRISE";
    AccessLevel["CUSTOM"] = "CUSTOM";
})(AccessLevel || (exports.AccessLevel = AccessLevel = {}));
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["UNVERIFIED"] = "UNVERIFIED";
    VerificationStatus["EMAIL_VERIFIED"] = "EMAIL_VERIFIED";
    VerificationStatus["PHONE_VERIFIED"] = "PHONE_VERIFIED";
    VerificationStatus["IDENTITY_VERIFIED"] = "IDENTITY_VERIFIED";
    VerificationStatus["PROFESSIONAL_VERIFIED"] = "PROFESSIONAL_VERIFIED";
    VerificationStatus["FULLY_VERIFIED"] = "FULLY_VERIFIED";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
var Specialization;
(function (Specialization) {
    Specialization["DAIRY_CATTLE"] = "DAIRY_CATTLE";
    Specialization["BEEF_CATTLE"] = "BEEF_CATTLE";
    Specialization["REPRODUCTION"] = "REPRODUCTION";
    Specialization["NUTRITION"] = "NUTRITION";
    Specialization["HERD_HEALTH"] = "HERD_HEALTH";
    Specialization["GENETICS"] = "GENETICS";
    Specialization["SURGERY"] = "SURGERY";
    Specialization["PATHOLOGY"] = "PATHOLOGY";
    Specialization["EPIDEMIOLOGY"] = "EPIDEMIOLOGY";
    Specialization["FARM_MANAGEMENT"] = "FARM_MANAGEMENT";
    Specialization["QUALITY_ASSURANCE"] = "QUALITY_ASSURANCE";
    Specialization["SUSTAINABLE_PRACTICES"] = "SUSTAINABLE_PRACTICES";
    Specialization["TECHNOLOGY"] = "TECHNOLOGY";
    Specialization["ECONOMICS"] = "ECONOMICS";
    Specialization["RESEARCH"] = "RESEARCH";
})(Specialization || (exports.Specialization = Specialization = {}));
var NotificationPreference;
(function (NotificationPreference) {
    NotificationPreference["ALL"] = "ALL";
    NotificationPreference["IMPORTANT_ONLY"] = "IMPORTANT_ONLY";
    NotificationPreference["EMERGENCY_ONLY"] = "EMERGENCY_ONLY";
    NotificationPreference["NONE"] = "NONE";
})(NotificationPreference || (exports.NotificationPreference = NotificationPreference = {}));
class User extends sequelize_1.Model {
    getRoleLabel() {
        const labels = {
            [UserRole.SUPER_ADMIN]: 'Super Administrador',
            [UserRole.RANCH_MANAGER]: 'Gerente de Rancho',
            [UserRole.VETERINARIAN]: 'Veterinario',
        };
        return labels[this.role];
    }
    getFullName() {
        const { firstName, lastName, middleName } = this.personalInfo;
        return [firstName, middleName, lastName].filter(Boolean).join(' ');
    }
    async verifyPassword(password) {
        return bcrypt.compare(password, this.password);
    }
    static async hashPassword(password) {
        const saltRounds = 12;
        return bcrypt.hash(password, saltRounds);
    }
    hasRanchAccess(ranchId) {
        if (!this.ranchAccess)
            return false;
        return this.ranchAccess.some(access => access.ranchId === ranchId &&
            access.isActive &&
            (!access.expirationDate || new Date() < access.expirationDate));
    }
    getRanchAccessLevel(ranchId) {
        if (!this.ranchAccess)
            return null;
        const access = this.ranchAccess.find(access => access.ranchId === ranchId &&
            access.isActive &&
            (!access.expirationDate || new Date() < access.expirationDate));
        return access?.accessLevel || null;
    }
    hasPermission(module, action) {
        const modulePermission = this.permissions.modules[module];
        switch (action) {
            case 'READ':
                return modulePermission !== 'NONE';
            case 'WRITE':
                return modulePermission === 'WRITE' || modulePermission === 'ADMIN';
            case 'ADMIN':
                return modulePermission === 'ADMIN';
            default:
                return false;
        }
    }
    canPerformAction(action) {
        return this.permissions.actions[action] || false;
    }
    getValidCertifications() {
        if (!this.professionalInfo?.certifications)
            return [];
        const now = new Date();
        return this.professionalInfo.certifications
            .filter(cert => cert.status === 'VALID' && (!cert.expirationDate || cert.expirationDate > now))
            .map(cert => ({
            name: cert.name,
            issuingOrganization: cert.issuingOrganization,
            expirationDate: cert.expirationDate,
            daysToExpiration: cert.expirationDate ?
                Math.ceil((cert.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) :
                undefined
        }));
    }
    isAnimalHealthProfessional() {
        return [
            UserRole.VETERINARIAN,
        ].includes(this.role);
    }
    getVerificationScore() {
        let score = 0;
        if (this.emailVerified)
            score += 20;
        if (this.phoneVerified)
            score += 20;
        if (this.verificationStatus === VerificationStatus.IDENTITY_VERIFIED)
            score += 20;
        if (this.verificationStatus === VerificationStatus.PROFESSIONAL_VERIFIED)
            score += 20;
        if (this.getValidCertifications().length > 0)
            score += 10;
        if (this.professionalInfo?.licenses && this.professionalInfo.licenses.length > 0)
            score += 10;
        return Math.min(score, 100);
    }
    needsCertificationRenewal(days = 30) {
        const validCertifications = this.getValidCertifications();
        return validCertifications.some(cert => cert.daysToExpiration !== undefined && cert.daysToExpiration <= days);
    }
    getUserAlerts() {
        const alerts = [];
        if (!this.emailVerified) {
            alerts.push({
                type: 'WARNING',
                category: 'Verificación',
                message: 'Email no verificado',
                priority: 2
            });
        }
        if (!this.phoneVerified) {
            alerts.push({
                type: 'WARNING',
                category: 'Verificación',
                message: 'Teléfono no verificado',
                priority: 2
            });
        }
        if (this.needsCertificationRenewal(30)) {
            const expiringSoon = this.getValidCertifications().filter(cert => cert.daysToExpiration !== undefined && cert.daysToExpiration <= 30);
            expiringSoon.forEach(cert => {
                alerts.push({
                    type: cert.daysToExpiration <= 7 ? 'CRITICAL' : 'WARNING',
                    category: 'Certificación',
                    message: `Certificación ${cert.name} vence en ${cert.daysToExpiration} días`,
                    priority: cert.daysToExpiration <= 7 ? 1 : 2
                });
            });
        }
        if (this.subscriptionInfo?.status === 'EXPIRED') {
            alerts.push({
                type: 'CRITICAL',
                category: 'Suscripción',
                message: 'Suscripción expirada',
                priority: 1
            });
        }
        if (this.securityInfo?.passwordLastChanged) {
            const daysSincePasswordChange = Math.floor((new Date().getTime() - this.securityInfo.passwordLastChanged.getTime()) /
                (1000 * 60 * 60 * 24));
            if (daysSincePasswordChange > 90) {
                alerts.push({
                    type: 'WARNING',
                    category: 'Seguridad',
                    message: 'Contraseña no cambiada en más de 90 días',
                    priority: 2
                });
            }
        }
        if (this.ranchAccess) {
            const expiredAccess = this.ranchAccess.filter(access => access.expirationDate && new Date() > access.expirationDate && access.isActive);
            if (expiredAccess.length > 0) {
                alerts.push({
                    type: 'WARNING',
                    category: 'Acceso',
                    message: `Acceso expirado a ${expiredAccess.length} rancho(s)`,
                    priority: 2
                });
            }
        }
        return alerts.sort((a, b) => a.priority - b.priority);
    }
    updateLastActivity() {
        this.lastActiveAt = new Date();
        if (!this.activity) {
            this.activity = {};
        }
        this.activity.lastActivity = new Date();
    }
    recordSuccessfulLogin(ipAddress, device) {
        this.lastLoginAt = new Date();
        if (!this.activity) {
            this.activity = {};
        }
        this.activity.lastLogin = new Date();
        this.activity.loginCount = (this.activity.loginCount || 0) + 1;
        if (!this.activity.loginHistory) {
            this.activity.loginHistory = [];
        }
        this.activity.loginHistory.unshift({
            timestamp: new Date(),
            ipAddress,
            device,
            success: true
        });
        this.activity.loginHistory = this.activity.loginHistory.slice(0, 50);
    }
    getProfileSummary() {
        const alerts = this.getUserAlerts();
        const isOnline = this.lastActiveAt ?
            (new Date().getTime() - this.lastActiveAt.getTime()) < (15 * 60 * 1000) :
            false;
        return {
            basic: {
                name: this.getFullName(),
                role: this.getRoleLabel(),
                status: this.status,
                email: this.email,
                phone: this.contactInfo.primaryPhone
            },
            verification: {
                score: this.getVerificationScore(),
                emailVerified: this.emailVerified,
                phoneVerified: this.phoneVerified,
                professionalVerified: this.verificationStatus === VerificationStatus.PROFESSIONAL_VERIFIED ||
                    this.verificationStatus === VerificationStatus.FULLY_VERIFIED
            },
            professional: this.professionalInfo ? {
                title: this.professionalInfo.title,
                organization: this.professionalInfo.organization,
                experience: this.professionalInfo.experience,
                specializations: this.professionalInfo.specializations,
                certifications: this.getValidCertifications().length
            } : undefined,
            access: {
                ranchesAccess: this.ranchAccess?.filter(access => access.isActive).length || 0,
                permissions: Object.entries(this.permissions.modules)
                    .filter(([_, permission]) => permission !== 'NONE')
                    .map(([module, permission]) => `${module}: ${permission}`),
                restrictions: this.permissions.restrictions
            },
            activity: {
                lastLogin: this.lastLoginAt,
                loginCount: this.activity?.loginCount || 0,
                isOnline
            },
            alerts
        };
    }
    canAccessFeature(feature) {
        if (this.status !== UserStatus.ACTIVE)
            return false;
        if (this.subscriptionInfo?.status !== 'ACTIVE')
            return false;
        if (this.subscriptionInfo?.features && !this.subscriptionInfo.features.includes(feature)) {
            return false;
        }
        return true;
    }
}
User.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del usuario'
    },
    userCode: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        comment: 'Código único del usuario',
        field: 'user_code'
    },
    username: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [3, 50],
            isAlphanumeric: true
        },
        comment: 'Nombre de usuario único'
    },
    email: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
            notEmpty: true
        },
        comment: 'Email único del usuario'
    },
    password: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [8, 255]
        },
        comment: 'Contraseña hasheada'
    },
    role: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(UserRole)),
        allowNull: false,
        comment: 'Rol del usuario en el sistema'
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(UserStatus)),
        allowNull: false,
        defaultValue: UserStatus.PENDING_VERIFICATION,
        comment: 'Estado actual del usuario'
    },
    accessLevel: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(AccessLevel)),
        allowNull: false,
        defaultValue: AccessLevel.BASIC,
        comment: 'Nivel de acceso del usuario'
    },
    verificationStatus: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(VerificationStatus)),
        allowNull: false,
        defaultValue: VerificationStatus.UNVERIFIED,
        comment: 'Estado de verificación del usuario'
    },
    personalInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidPersonalInfo(value) {
                if (!value.firstName || !value.lastName) {
                    throw new Error('Nombre y apellido son requeridos');
                }
            }
        },
        comment: 'Información personal del usuario'
    },
    contactInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidContactInfo(value) {
                if (!value.primaryEmail || !value.primaryPhone) {
                    throw new Error('Email y teléfono principales son requeridos');
                }
            }
        },
        comment: 'Información de contacto del usuario'
    },
    professionalInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información profesional del usuario'
    },
    systemSettings: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Configuraciones del sistema del usuario'
    },
    permissions: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        comment: 'Permisos específicos del usuario'
    },
    activity: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Actividad y estadísticas del usuario'
    },
    performanceMetrics: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Métricas de desempeño del usuario'
    },
    ranchAccess: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Acceso a ranchos específicos'
    },
    subscriptionInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de suscripción del usuario'
    },
    apiAccess: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Configuración de acceso a API'
    },
    securityInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de seguridad del usuario'
    },
    complianceInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de cumplimiento y privacidad'
    },
    integrations: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Integraciones externas del usuario'
    },
    tags: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Etiquetas del usuario'
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas administrativas del usuario'
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el usuario está activo'
    },
    isVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el usuario está verificado'
    },
    emailVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el email está verificado'
    },
    phoneVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el teléfono está verificado'
    },
    termsAccepted: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si aceptó los términos y condiciones'
    },
    termsAcceptedDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de aceptación de términos'
    },
    privacyPolicyAccepted: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si aceptó la política de privacidad'
    },
    privacyPolicyAcceptedDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de aceptación de política de privacidad'
    },
    lastLoginAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del último login'
    },
    lastActiveAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de última actividad'
    },
    createdBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que lo creó'
    },
    updatedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que lo actualizó'
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha de creación del usuario'
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
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    paranoid: true,
    indexes: [
        {
            unique: true,
            fields: ['userCode']
        },
        {
            unique: true,
            fields: ['username']
        },
        {
            unique: true,
            fields: ['email']
        },
        {
            fields: ['role']
        },
        {
            fields: ['status']
        },
        {
            fields: ['accessLevel']
        },
        {
            fields: ['verificationStatus']
        },
        {
            fields: ['isActive']
        },
        {
            fields: ['isVerified']
        },
        {
            fields: ['emailVerified']
        },
        {
            fields: ['lastLoginAt']
        },
        {
            fields: ['lastActiveAt']
        },
        {
            name: 'users_role_status',
            fields: ['role', 'status']
        },
        {
            name: 'users_active_verified',
            fields: ['isActive', 'isVerified']
        },
        {
            name: 'users_search_text',
            fields: ['personalInfo'],
            using: 'gin'
        },
        {
            name: 'users_contact_search',
            fields: ['contactInfo'],
            using: 'gin'
        },
        {
            name: 'users_ranch_access',
            fields: ['ranchAccess'],
            using: 'gin'
        }
    ],
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await User.hashPassword(user.password);
            }
            if (!user.userCode) {
                const timestamp = Date.now().toString().slice(-6);
                const rolePrefix = user.role.substring(0, 2).toUpperCase();
                user.userCode = `${rolePrefix}${timestamp}`;
            }
            if (!user.systemSettings) {
                user.systemSettings = {
                    theme: 'LIGHT',
                    language: 'es',
                    timezone: 'America/Mexico_City',
                    dateFormat: 'DD/MM/YYYY',
                    timeFormat: '24H',
                    currency: 'MXN',
                    units: 'METRIC',
                    notifications: {
                        email: NotificationPreference.ALL,
                        sms: NotificationPreference.IMPORTANT_ONLY,
                        push: NotificationPreference.ALL,
                        whatsapp: NotificationPreference.IMPORTANT_ONLY
                    },
                    privacy: {
                        profileVisibility: 'PRIVATE',
                        showOnlineStatus: true,
                        allowMessages: 'CONTACTS_ONLY',
                        shareLocation: false
                    },
                    security: {
                        twoFactorEnabled: false,
                        sessionTimeout: 480,
                        loginNotifications: true,
                        deviceTracking: true
                    }
                };
            }
            if (!user.securityInfo) {
                user.securityInfo = {
                    passwordLastChanged: new Date()
                };
            }
            if (!user.complianceInfo) {
                user.complianceInfo = {
                    dataProcessingConsent: user.termsAccepted,
                    marketingConsent: false,
                    consentDate: new Date(),
                    gdprCompliant: true,
                    dataRetentionPeriod: 365 * 7
                };
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                user.password = await User.hashPassword(user.password);
                if (!user.securityInfo) {
                    user.securityInfo = {
                        passwordLastChanged: new Date()
                    };
                }
                else {
                    user.securityInfo.passwordLastChanged = new Date();
                }
            }
            if (user.emailVerified && user.phoneVerified &&
                user.verificationStatus === VerificationStatus.UNVERIFIED) {
                user.verificationStatus = VerificationStatus.EMAIL_VERIFIED;
            }
            if (user.changed('contactInfo') || user.changed('email')) {
                if (user.contactInfo.primaryEmail !== user.email) {
                    user.email = user.contactInfo.primaryEmail;
                    user.emailVerified = false;
                }
            }
        },
        beforeSave: async (user) => {
            const professionalRoles = [
                UserRole.VETERINARIAN,
            ];
            if (professionalRoles.includes(user.role) && !user.professionalInfo) {
                throw new Error('Los roles profesionales requieren información profesional');
            }
            if (user.role === UserRole.VETERINARIAN &&
                user.verificationStatus === VerificationStatus.PROFESSIONAL_VERIFIED) {
                if (!user.professionalInfo?.certifications ||
                    user.professionalInfo.certifications.length === 0) {
                    throw new Error('Los veterinarios verificados requieren al menos una certificación');
                }
            }
            if (user.status === UserStatus.ACTIVE && !user.termsAccepted) {
                throw new Error('Los usuarios activos deben aceptar los términos y condiciones');
            }
            if (user.verificationStatus === VerificationStatus.FULLY_VERIFIED && !user.emailVerified) {
                throw new Error('Los usuarios completamente verificados deben tener email verificado');
            }
        }
    },
    comment: 'Tabla para el manejo completo de usuarios del sistema'
});
exports.default = User;
//# sourceMappingURL=User.js.map