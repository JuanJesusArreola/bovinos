"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.info = exports.down = exports.up = void 0;
const sequelize_1 = require("sequelize");
const up = async (queryInterface) => {
    console.log('🚀 Ejecutando migración: token_blacklist');
    await queryInterface.createTable('token_blacklist', {
        id: {
            type: sequelize_1.DataTypes.UUID,
            primaryKey: true,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            allowNull: false,
            comment: 'ID único del registro'
        },
        user_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
            comment: 'ID del usuario (opcional)'
        },
        token_type: {
            type: sequelize_1.DataTypes.ENUM('ACCESS', 'REFRESH'),
            allowNull: false,
            comment: 'Tipo de token (ACCESS o REFRESH)'
        },
        token_jti: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            comment: 'JWT ID del token'
        },
        token_hash: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            comment: 'Hash del token para búsqueda rápida'
        },
        expires_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            comment: 'Fecha de expiración del token'
        },
        reason: {
            type: sequelize_1.DataTypes.ENUM('LOGOUT', 'PASSWORD_CHANGE', 'ACCOUNT_LOCKED', 'ADMIN_REVOKE', 'SECURITY_BREACH'),
            allowNull: false,
            comment: 'Razón por la cual se revocó el token'
        },
        ip_address: {
            type: sequelize_1.DataTypes.STRING(45),
            allowNull: true,
            comment: 'IP desde donde se revocó el token'
        },
        user_agent: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            comment: 'User agent del navegador'
        },
        revoked_by: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
            comment: 'ID del usuario que revocó el token'
        },
        created_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW,
            comment: 'Fecha de creación del registro'
        },
        updated_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW,
            comment: 'Fecha de última actualización'
        }
    });
    await queryInterface.addIndex('token_blacklist', ['user_id']);
    await queryInterface.addIndex('token_blacklist', ['token_type']);
    await queryInterface.addIndex('token_blacklist', ['token_jti']);
    await queryInterface.addIndex('token_blacklist', ['token_hash']);
    await queryInterface.addIndex('token_blacklist', ['expires_at']);
    await queryInterface.addIndex('token_blacklist', ['reason']);
    await queryInterface.addIndex('token_blacklist', ['created_at']);
    await queryInterface.addIndex('token_blacklist', ['token_hash', 'expires_at'], {
        name: 'token_blacklist_lookup'
    });
    console.log('✅ Migración token_blacklist ejecutada correctamente');
};
exports.up = up;
const down = async (queryInterface) => {
    console.log('🔄 Revirtiendo migración: token_blacklist');
    await queryInterface.dropTable('token_blacklist');
    console.log('✅ Migración token_blacklist revertida correctamente');
};
exports.down = down;
exports.info = {
    id: '20250115120002',
    name: 'token_blacklist',
    description: 'Crear tabla para blacklist de tokens JWT revocados',
    author: 'Sistema de Migraciones',
    version: '1.0.0'
};
//# sourceMappingURL=20250115120002_token_blacklist.js.map