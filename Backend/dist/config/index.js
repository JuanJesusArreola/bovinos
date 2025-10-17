"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV_VARIABLES = exports.uploadErrorHandler = exports.getStorageStats = exports.getFileUrl = exports.deleteFile = exports.validateFile = exports.getUploadConfig = exports.createThumbnails = exports.processImage = exports.createUploadMiddleware = exports.uploadConfigs = exports.getCorsMiddleware = exports.corsConfig = exports.UserRole = exports.generateTokenResponse = exports.generateRandomString = exports.validateEmail = exports.validatePasswordStrength = exports.comparePassword = exports.hashPassword = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = exports.authConfig = exports.closeDatabase = exports.initializeDatabase = exports.getDatabaseManager = exports.sequelize = exports.gracefulShutdown = exports.getSystemInfo = exports.validateConfig = exports.initializeConfig = void 0;
const database_1 = __importStar(require("./database"));
exports.sequelize = database_1.default;
Object.defineProperty(exports, "getDatabaseManager", { enumerable: true, get: function () { return database_1.getDatabaseManager; } });
Object.defineProperty(exports, "initializeDatabase", { enumerable: true, get: function () { return database_1.initializeDatabase; } });
Object.defineProperty(exports, "closeDatabase", { enumerable: true, get: function () { return database_1.closeDatabase; } });
const auth_1 = __importStar(require("./auth"));
exports.authConfig = auth_1.default;
Object.defineProperty(exports, "generateAccessToken", { enumerable: true, get: function () { return auth_1.generateAccessToken; } });
Object.defineProperty(exports, "generateRefreshToken", { enumerable: true, get: function () { return auth_1.generateRefreshToken; } });
Object.defineProperty(exports, "verifyAccessToken", { enumerable: true, get: function () { return auth_1.verifyAccessToken; } });
Object.defineProperty(exports, "verifyRefreshToken", { enumerable: true, get: function () { return auth_1.verifyRefreshToken; } });
Object.defineProperty(exports, "hashPassword", { enumerable: true, get: function () { return auth_1.hashPassword; } });
Object.defineProperty(exports, "comparePassword", { enumerable: true, get: function () { return auth_1.comparePassword; } });
Object.defineProperty(exports, "validatePasswordStrength", { enumerable: true, get: function () { return auth_1.validatePasswordStrength; } });
Object.defineProperty(exports, "validateEmail", { enumerable: true, get: function () { return auth_1.validateEmail; } });
Object.defineProperty(exports, "generateRandomString", { enumerable: true, get: function () { return auth_1.generateRandomString; } });
Object.defineProperty(exports, "generateTokenResponse", { enumerable: true, get: function () { return auth_1.generateTokenResponse; } });
Object.defineProperty(exports, "UserRole", { enumerable: true, get: function () { return auth_1.UserRole; } });
const cors_1 = __importStar(require("./cors"));
exports.corsConfig = cors_1.default;
Object.defineProperty(exports, "getCorsMiddleware", { enumerable: true, get: function () { return cors_1.getCorsMiddleware; } });
const upload_1 = require("./upload");
Object.defineProperty(exports, "uploadConfigs", { enumerable: true, get: function () { return upload_1.uploadConfigs; } });
Object.defineProperty(exports, "createUploadMiddleware", { enumerable: true, get: function () { return upload_1.createUploadMiddleware; } });
Object.defineProperty(exports, "processImage", { enumerable: true, get: function () { return upload_1.processImage; } });
Object.defineProperty(exports, "createThumbnails", { enumerable: true, get: function () { return upload_1.createThumbnails; } });
Object.defineProperty(exports, "getUploadConfig", { enumerable: true, get: function () { return upload_1.getUploadConfig; } });
Object.defineProperty(exports, "validateFile", { enumerable: true, get: function () { return upload_1.validateFile; } });
Object.defineProperty(exports, "deleteFile", { enumerable: true, get: function () { return upload_1.deleteFile; } });
Object.defineProperty(exports, "getFileUrl", { enumerable: true, get: function () { return upload_1.getFileUrl; } });
Object.defineProperty(exports, "getStorageStats", { enumerable: true, get: function () { return upload_1.getStorageStats; } });
Object.defineProperty(exports, "uploadErrorHandler", { enumerable: true, get: function () { return upload_1.uploadErrorHandler; } });
const appConfig = {
    app: {
        name: process.env.APP_NAME || 'Cattle Management System',
        version: process.env.APP_VERSION || '1.0.0',
        description: 'Sistema de gestión integral para ganado bovino con geolocalización',
        environment: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '8000'),
        host: process.env.HOST || '0.0.0.0',
        baseUrl: process.env.BASE_URL || 'http://localhost:8000'
    },
    services: {
        database: (0, database_1.getDatabaseManager)().getConnectionInfo(),
        auth: auth_1.default,
        cors: cors_1.default,
        uploads: upload_1.uploadConfigs
    },
    integrations: {
        maps: {
            provider: process.env.MAPS_PROVIDER || 'leaflet',
            apiKey: process.env.MAPS_API_KEY
        },
        notifications: {
            enabled: process.env.NOTIFICATIONS_ENABLED === 'true',
            providers: (process.env.NOTIFICATION_PROVIDERS || 'email').split(',')
        },
        analytics: {
            enabled: process.env.ANALYTICS_ENABLED === 'true',
            provider: process.env.ANALYTICS_PROVIDER
        }
    }
};
const initializeConfig = async () => {
    try {
        console.log('🚀 Inicializando configuraciones del sistema...');
        const criticalEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER'];
        const missingVars = criticalEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            console.warn(`⚠️  Variables de entorno faltantes: ${missingVars.join(', ')}`);
        }
        const dbManager = (0, database_1.getDatabaseManager)();
        const dbConnected = await dbManager.testConnection();
        if (!dbConnected) {
            console.error('❌ No se pudo conectar a la base de datos');
            return false;
        }
        console.log('📋 Configuración cargada:');
        console.log(`   Aplicación: ${appConfig.app.name} v${appConfig.app.version}`);
        console.log(`   Entorno: ${appConfig.app.environment}`);
        console.log(`   Puerto: ${appConfig.app.port}`);
        console.log(`   Base URL: ${appConfig.app.baseUrl}`);
        console.log('✅ Configuraciones inicializadas correctamente');
        return true;
    }
    catch (error) {
        console.error('❌ Error inicializando configuraciones:', error);
        return false;
    }
};
exports.initializeConfig = initializeConfig;
const validateConfig = () => {
    const errors = [];
    const warnings = [];
    try {
        if (!appConfig.app.name) {
            errors.push('Nombre de la aplicación no configurado');
        }
        if (appConfig.app.port < 1000 || appConfig.app.port > 65535) {
            errors.push('Puerto de la aplicación fuera del rango válido');
        }
        const dbManager = (0, database_1.getDatabaseManager)();
        const dbInfo = dbManager.getConnectionInfo();
        if (!dbInfo.host || !dbInfo.database || !dbInfo.username) {
            errors.push('Configuración de base de datos incompleta');
        }
        if (auth_1.default.jwt.accessTokenSecret.length < 32) {
            warnings.push('Secret de JWT muy corto, se recomienda al menos 32 caracteres');
        }
        if (appConfig.app.environment === 'production') {
            if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.includes('default')) {
                errors.push('Secret de JWT por defecto en producción');
            }
            if (appConfig.app.baseUrl.includes('localhost')) {
                warnings.push('Base URL apunta a localhost en producción');
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        errors.push(`Error validando configuración: ${errorMessage}`);
        return { isValid: false, errors, warnings };
    }
};
exports.validateConfig = validateConfig;
const getSystemInfo = () => {
    return {
        application: {
            name: appConfig.app.name,
            version: appConfig.app.version,
            environment: appConfig.app.environment,
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform
        },
        database: (0, database_1.getDatabaseManager)().getConnectionInfo(),
        cors: { enabled: true, middleware: 'getCorsMiddleware' },
        storage: (0, upload_1.getStorageStats)(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
        }
    };
};
exports.getSystemInfo = getSystemInfo;
const gracefulShutdown = async () => {
    try {
        console.log('🔄 Iniciando cierre ordenado del sistema...');
        await (0, database_1.closeDatabase)();
        console.log('✅ Sistema cerrado correctamente');
    }
    catch (error) {
        console.error('❌ Error durante el cierre del sistema:', error);
        throw error;
    }
};
exports.gracefulShutdown = gracefulShutdown;
exports.default = appConfig;
exports.ENV_VARIABLES = {
    APP_NAME: 'Nombre de la aplicación',
    APP_VERSION: 'Versión de la aplicación',
    NODE_ENV: 'Entorno de ejecución (development, test, production)',
    PORT: 'Puerto del servidor',
    HOST: 'Host del servidor',
    BASE_URL: 'URL base de la aplicación',
    DB_HOST: 'Host de PostgreSQL',
    DB_PORT: 'Puerto de PostgreSQL',
    DB_NAME: 'Nombre de la base de datos',
    DB_USER: 'Usuario de la base de datos',
    DB_PASSWORD: 'Contraseña de la base de datos',
    TEST_DB_HOST: 'Host de PostgreSQL para pruebas',
    TEST_DB_PORT: 'Puerto de PostgreSQL para pruebas',
    TEST_DB_NAME: 'Nombre de la base de datos de pruebas',
    TEST_DB_USER: 'Usuario de la base de datos de pruebas',
    TEST_DB_PASSWORD: 'Contraseña de la base de datos de pruebas',
    PROD_DB_HOST: 'Host de PostgreSQL para producción',
    PROD_DB_PORT: 'Puerto de PostgreSQL para producción',
    PROD_DB_NAME: 'Nombre de la base de datos de producción',
    PROD_DB_USER: 'Usuario de la base de datos de producción',
    PROD_DB_PASSWORD: 'Contraseña de la base de datos de producción',
    JWT_ACCESS_SECRET: 'Secret para tokens de acceso',
    JWT_REFRESH_SECRET: 'Secret para tokens de actualización',
    JWT_ACCESS_EXPIRATION: 'Tiempo de expiración de tokens de acceso',
    JWT_REFRESH_EXPIRATION: 'Tiempo de expiración de tokens de actualización',
    JWT_ISSUER: 'Emisor de los tokens JWT',
    JWT_AUDIENCE: 'Audiencia de los tokens JWT',
    BCRYPT_SALT_ROUNDS: 'Rondas de salt para bcrypt',
    MAX_LOGIN_ATTEMPTS: 'Intentos máximos de login',
    LOCKOUT_DURATION: 'Duración del bloqueo en milisegundos',
    SESSION_TIMEOUT: 'Tiempo de expiración de sesión en milisegundos',
    FRONTEND_URL: 'URL del frontend',
    ADMIN_URL: 'URL del panel de administración',
    MOBILE_URL: 'URL de la aplicación móvil',
    ADDITIONAL_ORIGINS: 'Orígenes adicionales permitidos (separados por comas)',
    MAPS_PROVIDER: 'Proveedor de mapas (leaflet, google, etc.)',
    MAPS_API_KEY: 'API key para servicios de mapas',
    NOTIFICATIONS_ENABLED: 'Habilitar notificaciones (true/false)',
    NOTIFICATION_PROVIDERS: 'Proveedores de notificaciones (separados por comas)',
    ANALYTICS_ENABLED: 'Habilitar analytics (true/false)',
    ANALYTICS_PROVIDER: 'Proveedor de analytics'
};
//# sourceMappingURL=index.js.map