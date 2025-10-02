// ============================================================================
// MIGRACIÓN: initial_schema
// ID: 20241220120000
// Fecha: 2024-12-20T12:00:00.000Z
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: initial_schema');
  
  // =============================================
  // CREAR TABLA DE USUARIOS
  // =============================================
  
  await queryInterface.createTable('users', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('ADMIN', 'OWNER', 'VETERINARIAN', 'WORKER', 'VIEWER'),
      allowNull: false,
      defaultValue: 'VIEWER'
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });

  // =============================================
  // CREAR TABLA DE RANCHOS
  // =============================================
  
  await queryInterface.createTable('ranches', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });

  // =============================================
  // CREAR TABLA DE BOVINOS
  // =============================================
  
  await queryInterface.createTable('bovines', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ear_tag: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    ranch_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    responsible_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    breed: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });

  // =============================================
  // CREAR FOREIGN KEYS
  // =============================================
  
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

  // =============================================
  // CREAR ÍNDICES
  // =============================================
  
  await queryInterface.addIndex('users', ['email']);
  await queryInterface.addIndex('users', ['role']);
  await queryInterface.addIndex('users', ['status']);
  await queryInterface.addIndex('bovines', ['ear_tag']);
  await queryInterface.addIndex('bovines', ['ranch_id']);
  await queryInterface.addIndex('ranches', ['owner_id']);

  console.log('✅ Migración initial_schema ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: initial_schema');
  
  // =============================================
  // ELIMINAR TABLAS EN ORDEN INVERSO
  // =============================================
  
  await queryInterface.dropTable('bovines');
  await queryInterface.dropTable('ranches');
  await queryInterface.dropTable('users');

  console.log('✅ Migración initial_schema revertida correctamente');
};

export const info = {
  id: '20241220120000',
  name: 'initial_schema',
  description: 'Crear esquema inicial con tablas de usuarios, ranchos y bovinos',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};
