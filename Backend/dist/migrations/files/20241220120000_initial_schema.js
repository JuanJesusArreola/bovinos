"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.info = exports.down = exports.up = void 0;
const sequelize_1 = require("sequelize");
const up = async (queryInterface) => {
    console.log('🚀 Ejecutando migración: initial_schema');
    await queryInterface.createTable('users', {
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_code: {
            type: sequelize_1.DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        username: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: false,
            unique: true
        },
        email: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            unique: true
        },
        password: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false
        },
        role: {
            type: sequelize_1.DataTypes.ENUM('ADMIN', 'OWNER', 'VETERINARIAN', 'WORKER', 'VIEWER'),
            allowNull: false,
            defaultValue: 'VIEWER'
        },
        status: {
            type: sequelize_1.DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'),
            allowNull: false,
            defaultValue: 'PENDING'
        },
        is_active: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        is_verified: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        created_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW
        },
        updated_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW
        }
    });
    await queryInterface.createTable('ranches', {
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false
        },
        owner_id: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true
        },
        location: {
            type: sequelize_1.DataTypes.JSONB,
            allowNull: true
        },
        created_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW
        },
        updated_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW
        }
    });
    await queryInterface.createTable('bovines', {
        id: {
            type: sequelize_1.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        ear_tag: {
            type: sequelize_1.DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        ranch_id: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false
        },
        responsible_user_id: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true
        },
        breed: {
            type: sequelize_1.DataTypes.STRING(100),
            allowNull: true
        },
        is_active: {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        created_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW
        },
        updated_at: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW
        }
    });
    await queryInterface.addConstraint('ranches', {
        fields: ['owner_id'],
        type: 'foreign key',
        name: 'ranches_owner_id_fkey',
        references: {
            table: 'users',
            field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    });
    await queryInterface.addConstraint('bovines', {
        fields: ['ranch_id'],
        type: 'foreign key',
        name: 'bovines_ranch_id_fkey',
        references: {
            table: 'ranches',
            field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    });
    await queryInterface.addConstraint('bovines', {
        fields: ['responsible_user_id'],
        type: 'foreign key',
        name: 'bovines_responsible_user_id_fkey',
        references: {
            table: 'users',
            field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['role']);
    await queryInterface.addIndex('users', ['status']);
    await queryInterface.addIndex('bovines', ['ear_tag']);
    await queryInterface.addIndex('bovines', ['ranch_id']);
    await queryInterface.addIndex('ranches', ['owner_id']);
    console.log('✅ Migración initial_schema ejecutada correctamente');
};
exports.up = up;
const down = async (queryInterface) => {
    console.log('🔄 Revirtiendo migración: initial_schema');
    await queryInterface.dropTable('bovines');
    await queryInterface.dropTable('ranches');
    await queryInterface.dropTable('users');
    console.log('✅ Migración initial_schema revertida correctamente');
};
exports.down = down;
exports.info = {
    id: '20241220120000',
    name: 'initial_schema',
    description: 'Crear esquema inicial con tablas de usuarios, ranchos y bovinos',
    author: 'Sistema de Migraciones',
    version: '1.0.0'
};
//# sourceMappingURL=20241220120000_initial_schema.js.map