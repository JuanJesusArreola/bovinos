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
exports.environments = exports.getEnvironmentInfo = exports.validateEnvironmentVariables = exports.getEnvironmentConfig = void 0;
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const baseDatabaseConfig = {
    dialect: 'postgres',
    timezone: '-06:00',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    define: {
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    },
    logging: false
};
const environments = {
    development: {
        database: {
            ...baseDatabaseConfig,
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'cattle_management_dev',
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            logging: console.log,
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            }
        },
        server: {
            port: parseInt(process.env.PORT || '3001'),
            host: process.env.HOST || 'localhost',
            cors: {
                origin: ['http://localhost:3000', 'http://localhost:5173'],
                credentials: true
            }
        },
        security: {
            jwt: {
                secret: process.env.JWT_SECRET || 'dev_secret_key_change_in_production',
                refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_key',
                expiresIn: process.env.JWT_EXPIRES_IN || '7d',
                refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
            },
            bcrypt: {
                saltRounds: 10
            },
            rateLimit: {
                windowMs: 15 * 60 * 1000,
                max: 100
            }
        },
        logging: {
            level: 'debug',
            enableConsole: true,
            enableFile: false
        },
        features: {
            enableSwagger: true,
            enableMetrics: true,
            enableBackup: false,
            enableMigrations: true
        },
        backup: {
            enabled: false,
            schedule: '0 2 * * *',
            retentionDays: 7,
            storagePath: './backups'
        }
    },
    test: {
        database: {
            ...baseDatabaseConfig,
            host: process.env.TEST_DB_HOST || 'localhost',
            port: parseInt(process.env.TEST_DB_PORT || '5432'),
            database: process.env.TEST_DB_NAME || 'cattle_management_test',
            username: process.env.TEST_DB_USER || 'postgres',
            password: process.env.TEST_DB_PASSWORD || 'password',
            logging: false,
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            }
        },
        server: {
            port: parseInt(process.env.TEST_PORT || '3002'),
            host: 'localhost',
            cors: {
                origin: ['http://localhost:3000'],
                credentials: true
            }
        },
        security: {
            jwt: {
                secret: 'test_secret_key',
                refreshSecret: 'test_refresh_secret_key',
                expiresIn: '1h',
                refreshExpiresIn: '24h'
            },
            bcrypt: {
                saltRounds: 4
            },
            rateLimit: {
                windowMs: 15 * 60 * 1000,
                max: 1000
            }
        },
        logging: {
            level: 'error',
            enableConsole: false,
            enableFile: false
        },
        features: {
            enableSwagger: false,
            enableMetrics: false,
            enableBackup: false,
            enableMigrations: true
        },
        backup: {
            enabled: false,
            schedule: '0 2 * * *',
            retentionDays: 1,
            storagePath: './test-backups'
        }
    },
    staging: {
        database: {
            ...baseDatabaseConfig,
            host: process.env.STAGING_DB_HOST || 'localhost',
            port: parseInt(process.env.STAGING_DB_PORT || '5432'),
            database: process.env.STAGING_DB_NAME || 'cattle_management_staging',
            username: process.env.STAGING_DB_USER || 'postgres',
            password: process.env.STAGING_DB_PASSWORD || '',
            logging: false,
            pool: {
                max: 10,
                min: 2,
                acquire: 60000,
                idle: 300000
            },
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                }
            }
        },
        server: {
            port: parseInt(process.env.STAGING_PORT || '3001'),
            host: process.env.STAGING_HOST || '0.0.0.0',
            cors: {
                origin: process.env.STAGING_CORS_ORIGINS?.split(',') || ['https://staging.ganaderia.mx'],
                credentials: true
            }
        },
        security: {
            jwt: {
                secret: process.env.STAGING_JWT_SECRET || '',
                refreshSecret: process.env.STAGING_JWT_REFRESH_SECRET || '',
                expiresIn: process.env.STAGING_JWT_EXPIRES_IN || '24h',
                refreshExpiresIn: process.env.STAGING_JWT_REFRESH_EXPIRES_IN || '7d'
            },
            bcrypt: {
                saltRounds: 12
            },
            rateLimit: {
                windowMs: 15 * 60 * 1000,
                max: 200
            }
        },
        logging: {
            level: 'info',
            enableConsole: true,
            enableFile: true,
            filePath: './logs/staging.log'
        },
        features: {
            enableSwagger: true,
            enableMetrics: true,
            enableBackup: true,
            enableMigrations: true
        },
        backup: {
            enabled: true,
            schedule: '0 2 * * *',
            retentionDays: 14,
            storagePath: './backups/staging'
        }
    },
    production: {
        database: {
            ...baseDatabaseConfig,
            host: process.env.PROD_DB_HOST || '',
            port: parseInt(process.env.PROD_DB_PORT || '5432'),
            database: process.env.PROD_DB_NAME || '',
            username: process.env.PROD_DB_USER || '',
            password: process.env.PROD_DB_PASSWORD || '',
            logging: false,
            pool: {
                max: 20,
                min: 5,
                acquire: 60000,
                idle: 300000
            },
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                }
            }
        },
        server: {
            port: parseInt(process.env.PORT || '3001'),
            host: process.env.HOST || '0.0.0.0',
            cors: {
                origin: process.env.PROD_CORS_ORIGINS?.split(',') || ['https://ganaderia.mx'],
                credentials: true
            }
        },
        security: {
            jwt: {
                secret: process.env.PROD_JWT_SECRET || '',
                refreshSecret: process.env.PROD_JWT_REFRESH_SECRET || '',
                expiresIn: process.env.PROD_JWT_EXPIRES_IN || '1h',
                refreshExpiresIn: process.env.PROD_JWT_REFRESH_EXPIRES_IN || '7d'
            },
            bcrypt: {
                saltRounds: 12
            },
            rateLimit: {
                windowMs: 15 * 60 * 1000,
                max: 100
            }
        },
        logging: {
            level: 'warn',
            enableConsole: false,
            enableFile: true,
            filePath: './logs/production.log'
        },
        features: {
            enableSwagger: false,
            enableMetrics: true,
            enableBackup: true,
            enableMigrations: false
        },
        backup: {
            enabled: true,
            schedule: '0 2 * * *',
            retentionDays: 30,
            storagePath: './backups/production'
        }
    }
};
exports.environments = environments;
function getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    if (!environments[env]) {
        throw new Error(`❌ Ambiente no válido: ${env}. Ambientes disponibles: ${Object.keys(environments).join(', ')}`);
    }
    return environments[env];
}
exports.getEnvironmentConfig = getEnvironmentConfig;
function validateEnvironmentVariables() {
    const config = getEnvironmentConfig();
    const missing = [];
    if (!config.database.host)
        missing.push('DB_HOST');
    if (!config.database.database)
        missing.push('DB_NAME');
    if (!config.database.username)
        missing.push('DB_USERNAME');
    if (!config.database.password)
        missing.push('DB_PASSWORD');
    if (!config.security.jwt.secret)
        missing.push('JWT_SECRET');
    if (!config.security.jwt.refreshSecret)
        missing.push('JWT_REFRESH_SECRET');
    return {
        isValid: missing.length === 0,
        missing
    };
}
exports.validateEnvironmentVariables = validateEnvironmentVariables;
function getEnvironmentInfo() {
    const env = process.env.NODE_ENV || 'development';
    const config = getEnvironmentConfig();
    return {
        environment: env,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        database: {
            host: config.database.host,
            port: config.database.port,
            database: config.database.database,
            username: config.database.username
        },
        server: {
            port: config.server.port,
            host: config.server.host
        },
        features: config.features
    };
}
exports.getEnvironmentInfo = getEnvironmentInfo;
exports.default = getEnvironmentConfig;
//# sourceMappingURL=environments.js.map