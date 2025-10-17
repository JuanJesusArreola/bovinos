"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.info = exports.down = exports.up = void 0;
const sequelize_1 = require("sequelize");
const up = async (queryInterface) => {
    console.log('🚀 Ejecutando migración: password_reset_tokens');
    await queryInterface.createTable('password_reset_tokens', {
        id: {
            type: sequelize_1.DataTypes.UUID,
            primaryKey: true,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            allowNull: false,
            comment: 'ID único del token'
        },
        user_id: {
            type: sequelize_1.DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
            comment: 'ID del usuario que solicita reset'
        },
        email: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            comment: 'Email del usuario'
        },
        token: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            comment: 'Token único de reset'
        },
        expires_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            comment: 'Fecha de expiración del token (1 hora)'
        },
        used: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Si el token ya fue usado'
        },
        used_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            comment: 'Fecha cuando se usó el token'
        },
        ip_address: {
            type: sequelize_1.DataTypes.STRING(45),
            allowNull: true,
            comment: 'IP desde donde se solicitó el reset'
        },
        user_agent: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            comment: 'User agent del navegador'
        },
        new_password_hash: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: true,
            comment: 'Hash de la nueva contraseña (temporal)'
        },
        created_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW,
            comment: 'Fecha de creación del token'
        },
        updated_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW,
            comment: 'Fecha de última actualización'
        }
    });
    await queryInterface.addIndex('password_reset_tokens', ['user_id']);
    await queryInterface.addIndex('password_reset_tokens', ['email']);
    await queryInterface.addIndex('password_reset_tokens', ['token']);
    await queryInterface.addIndex('password_reset_tokens', ['expires_at']);
    await queryInterface.addIndex('password_reset_tokens', ['used']);
    await queryInterface.addIndex('password_reset_tokens', ['created_at']);
    console.log('✅ Migración password_reset_tokens ejecutada correctamente');
};
exports.up = up;
const down = async (queryInterface) => {
    console.log('🔄 Revirtiendo migración: password_reset_tokens');
    await queryInterface.dropTable('password_reset_tokens');
    console.log('✅ Migración password_reset_tokens revertida correctamente');
};
exports.down = down;
exports.info = {
    id: '20250115120001',
    name: 'password_reset_tokens',
    description: 'Crear tabla para tokens de reset de contraseña',
    author: 'Sistema de Migraciones',
    version: '1.0.0'
};
//# sourceMappingURL=20250115120001_password_reset_tokens.js.map