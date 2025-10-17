"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.info = exports.down = exports.up = void 0;
const sequelize_1 = require("sequelize");
const up = async (queryInterface) => {
    console.log('🚀 Ejecutando migración: email_verification_tokens');
    await queryInterface.createTable('email_verification_tokens', {
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
            comment: 'ID del usuario que solicita verificación'
        },
        email: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            comment: 'Email a verificar'
        },
        token: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            comment: 'Token único de verificación'
        },
        expires_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            comment: 'Fecha de expiración del token'
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
            comment: 'IP desde donde se solicitó la verificación'
        },
        user_agent: {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            comment: 'User agent del navegador'
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
    await queryInterface.addIndex('email_verification_tokens', ['user_id']);
    await queryInterface.addIndex('email_verification_tokens', ['email']);
    await queryInterface.addIndex('email_verification_tokens', ['token']);
    await queryInterface.addIndex('email_verification_tokens', ['expires_at']);
    await queryInterface.addIndex('email_verification_tokens', ['used']);
    await queryInterface.addIndex('email_verification_tokens', ['created_at']);
    console.log('✅ Migración email_verification_tokens ejecutada correctamente');
};
exports.up = up;
const down = async (queryInterface) => {
    console.log('🔄 Revirtiendo migración: email_verification_tokens');
    await queryInterface.dropTable('email_verification_tokens');
    console.log('✅ Migración email_verification_tokens revertida correctamente');
};
exports.down = down;
exports.info = {
    id: '20250115120000',
    name: 'email_verification_tokens',
    description: 'Crear tabla para tokens de verificación de email',
    author: 'Sistema de Migraciones',
    version: '1.0.0'
};
//# sourceMappingURL=20250115120000_email_verification_tokens.js.map