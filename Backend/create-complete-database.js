const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configuración de la base de datos
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'bovino_system_db',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Eminem1710',
  dialect: 'postgres',
  logging: console.log,
  timezone: '-06:00',
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
};

async function createCompleteDatabase() {
  console.log('🚀 INICIANDO CREACIÓN COMPLETA DE BASE DE DATOS');
  console.log('================================================');
  console.log(`📍 Host: ${config.host}`);
  console.log(`🔌 Puerto: ${config.port}`);
  console.log(`🗄️  Base de datos: ${config.database}`);
  console.log(`👤 Usuario: ${config.username}`);
  
  const sequelize = new Sequelize(config);
  
  try {
    // 1. PROBAR CONEXIÓN
    console.log('\n1️⃣  Probando conexión...');
    await sequelize.authenticate();
    console.log('   ✅ Conexión exitosa a PostgreSQL');
    
    // 2. VERIFICAR SI LA BASE DE DATOS EXISTE
    console.log('\n2️⃣  Verificando base de datos...');
    const [dbResult] = await sequelize.query(`
      SELECT 1 FROM pg_database WHERE datname = '${config.database}'
    `);
    
    if (dbResult.length === 0) {
      console.log('   ⚠️  Base de datos no existe, creando...');
      await sequelize.query(`CREATE DATABASE ${config.database}`);
      console.log('   ✅ Base de datos creada');
    } else {
      console.log('   ✅ Base de datos ya existe');
    }
    
    // 3. CONECTAR A LA BASE DE DATOS ESPECÍFICA
    await sequelize.close();
    const dbSequelize = new Sequelize({
      ...config,
      database: config.database
    });
    
    await dbSequelize.authenticate();
    console.log('   ✅ Conectado a la base de datos específica');
    
    // 4. VERIFICAR TABLAS EXISTENTES
    console.log('\n3️⃣  Verificando tablas existentes...');
    const [tablesResult] = await dbSequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tablesResult.length > 0) {
      console.log(`   ⚠️  Se encontraron ${tablesResult.length} tablas existentes`);
      console.log('   📋 Tablas existentes:');
      tablesResult.forEach(row => console.log(`      - ${row.table_name}`));
      
      const response = await new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        rl.question('\n   ¿Desea eliminar todas las tablas y crear desde cero? (s/n): ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'si');
        });
      });
      
      if (response) {
        console.log('   🗑️  Eliminando tablas existentes...');
        for (const table of tablesResult) {
          await dbSequelize.query(`DROP TABLE IF EXISTS "${table.table_name}" CASCADE`);
        }
        console.log('   ✅ Todas las tablas eliminadas');
      } else {
        console.log('   ⚠️  Operación cancelada por el usuario');
        await dbSequelize.close();
        return;
      }
    } else {
      console.log('   ✅ No hay tablas existentes, procediendo con la creación');
    }
    
    // 5. CREAR TODAS LAS TABLAS
    console.log('\n4️⃣  Creando todas las tablas...');
    
    // =============================================
    // TABLA: users (Usuarios)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'USER',
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        phone VARCHAR(20),
        profile_picture VARCHAR(255),
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla users creada');
    
    // =============================================
    // TABLA: ranches (Ranchos)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE ranches (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'México',
        postal_code VARCHAR(20),
        phone VARCHAR(50),
        email VARCHAR(255),
        website VARCHAR(255),
        total_area DECIMAL(12,2),
        area_unit VARCHAR(20) DEFAULT 'hectáreas',
        owner_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        manager_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        established_date DATE,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla ranches creada');
    
    // =============================================
    // TABLA: locations (Ubicaciones)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE locations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        location_type VARCHAR(100),
        coordinates POINT,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        altitude DECIMAL(8,2),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'México',
        postal_code VARCHAR(20),
        ranch_id VARCHAR(255) REFERENCES ranches(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla locations creada');
    
    // =============================================
    // TABLA: bovines (Bovinos)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE bovines (
        id VARCHAR(255) PRIMARY KEY,
        ear_tag VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100),
        breed VARCHAR(100),
        cattle_type VARCHAR(50),
        gender VARCHAR(20),
        birth_date DATE,
        weight DECIMAL(8,2),
        health_status VARCHAR(50) DEFAULT 'HEALTHY',
        vaccination_status VARCHAR(50) DEFAULT 'PENDING',
        ranch_id VARCHAR(255) REFERENCES ranches(id) ON DELETE SET NULL,
        owner_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        location_id VARCHAR(255) REFERENCES locations(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla bovines creada');
    
    // =============================================
    // TABLA: medications (Medicamentos)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE medications (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        generic_name VARCHAR(255),
        brand_name VARCHAR(255),
        active_ingredient VARCHAR(255),
        dosage_form VARCHAR(100),
        strength VARCHAR(100),
        manufacturer VARCHAR(255),
        batch_number VARCHAR(100),
        expiration_date DATE,
        storage_conditions TEXT,
        prescription_required BOOLEAN DEFAULT false,
        withdrawal_period INTEGER,
        withdrawal_period_unit VARCHAR(20) DEFAULT 'días',
        category VARCHAR(100),
        description TEXT,
        side_effects TEXT,
        contraindications TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla medications creada');
    
    // =============================================
    // TABLA: events (Eventos)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE events (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_type VARCHAR(100),
        event_status VARCHAR(50) DEFAULT 'SCHEDULED',
        priority VARCHAR(20) DEFAULT 'MEDIUM',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        location VARCHAR(255),
        bovine_id VARCHAR(255) REFERENCES bovines(id) ON DELETE SET NULL,
        created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla events creada');
    
    // =============================================
    // TABLA: health_records (Registros de Salud)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE health_records (
        id VARCHAR(255) PRIMARY KEY,
        bovine_id VARCHAR(255) NOT NULL REFERENCES bovines(id) ON DELETE CASCADE,
        record_type VARCHAR(100) NOT NULL,
        diagnosis TEXT,
        treatment TEXT,
        veterinarian VARCHAR(255),
        cost DECIMAL(10,2),
        created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla health_records creada');
    
    // =============================================
    // TABLA: health_medication (Relación Salud-Medicamentos)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE health_medication (
        id VARCHAR(255) PRIMARY KEY,
        health_record_id VARCHAR(255) NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
        medication_id VARCHAR(255) NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        dosage DECIMAL(8,2),
        dosage_unit VARCHAR(50),
        frequency VARCHAR(100),
        duration INTEGER,
        duration_unit VARCHAR(20) DEFAULT 'días',
        administration_route VARCHAR(100),
        start_date DATE,
        end_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(health_record_id, medication_id)
      )
    `);
    console.log('   ✅ Tabla health_medication creada');
    
    // =============================================
    // TABLA: finances (Finanzas)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE finances (
        id VARCHAR(255) PRIMARY KEY,
        transaction_type VARCHAR(50) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        date DATE NOT NULL,
        created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla finances creada');
    
    // =============================================
    // TABLA: inventory (Inventario)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE inventory (
        id VARCHAR(255) PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        subcategory VARCHAR(100),
        item_type VARCHAR(100),
        brand VARCHAR(255),
        model VARCHAR(255),
        serial_number VARCHAR(255),
        quantity INTEGER DEFAULT 0,
        unit VARCHAR(50),
        min_quantity INTEGER DEFAULT 0,
        max_quantity INTEGER,
        unit_cost DECIMAL(10,2),
        total_value DECIMAL(12,2),
        supplier VARCHAR(255),
        supplier_contact VARCHAR(255),
        purchase_date DATE,
        warranty_expiry DATE,
        location_id VARCHAR(255) REFERENCES locations(id) ON DELETE SET NULL,
        ranch_id VARCHAR(255) REFERENCES ranches(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        condition VARCHAR(50) DEFAULT 'GOOD',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla inventory creada');
    
    // =============================================
    // TABLA: production (Producción)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE production (
        id VARCHAR(255) PRIMARY KEY,
        bovine_id VARCHAR(255) NOT NULL REFERENCES bovines(id) ON DELETE CASCADE,
        production_type VARCHAR(100) NOT NULL,
        production_date DATE NOT NULL,
        quantity DECIMAL(10,2),
        unit VARCHAR(50),
        quality_grade VARCHAR(50),
        notes TEXT,
        cost DECIMAL(10,2),
        revenue DECIMAL(10,2),
        profit DECIMAL(10,2),
        created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla production creada');
    
    // =============================================
    // TABLA: reproduction (Reproducción)
    // =============================================
    await dbSequelize.query(`
      CREATE TABLE reproduction (
        id VARCHAR(255) PRIMARY KEY,
        bovine_id VARCHAR(255) NOT NULL REFERENCES bovines(id) ON DELETE CASCADE,
        reproduction_type VARCHAR(100) NOT NULL,
        event_date DATE NOT NULL,
        sire_id VARCHAR(255) REFERENCES bovines(id) ON DELETE SET NULL,
        method VARCHAR(100),
        success BOOLEAN,
        pregnancy_confirmed BOOLEAN,
        pregnancy_date DATE,
        expected_calving_date DATE,
        actual_calving_date DATE,
        offspring_id VARCHAR(255) REFERENCES bovines(id) ON DELETE SET NULL,
        notes TEXT,
        cost DECIMAL(10,2),
        created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla reproduction creada');
    
    // 6. CREAR ÍNDICES PARA OPTIMIZACIÓN
    console.log('\n5️⃣  Creando índices para optimización...');
    
    // Índices para users
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
    `);
    
    // Índices para ranches
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_ranches_owner ON ranches(owner_id);
      CREATE INDEX IF NOT EXISTS idx_ranches_status ON ranches(status);
      CREATE INDEX IF NOT EXISTS idx_ranches_city ON ranches(city);
    `);
    
    // Índices para locations
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_locations_ranch ON locations(ranch_id);
      CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type);
      CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);
    `);
    
    // Índices para bovines
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_bovines_ear_tag ON bovines(ear_tag);
      CREATE INDEX IF NOT EXISTS idx_bovines_breed ON bovines(breed);
      CREATE INDEX IF NOT EXISTS idx_bovines_ranch ON bovines(ranch_id);
      CREATE INDEX IF NOT EXISTS idx_bovines_health_status ON bovines(health_status);
      CREATE INDEX IF NOT EXISTS idx_bovines_gender ON bovines(gender);
    `);
    
    // Índices para medications
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_medications_category ON medications(category);
      CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(is_active);
      CREATE INDEX IF NOT EXISTS idx_medications_expiration ON medications(expiration_date);
    `);
    
    // Índices para events
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_status ON events(event_status);
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date);
      CREATE INDEX IF NOT EXISTS idx_events_bovine ON events(bovine_id);
      CREATE INDEX IF NOT EXISTS idx_events_priority ON events(priority);
    `);
    
    // Índices para health_records
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_health_bovine ON health_records(bovine_id);
      CREATE INDEX IF NOT EXISTS idx_health_type ON health_records(record_type);
      CREATE INDEX IF NOT EXISTS idx_health_date ON health_records(created_at);
    `);
    
    // Índices para finances
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_finances_type ON finances(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_finances_date ON finances(date);
      CREATE INDEX IF NOT EXISTS idx_finances_category ON finances(category);
      CREATE INDEX IF NOT EXISTS idx_finances_amount ON finances(amount);
    `);
    
    // Índices para inventory
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
      CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
      CREATE INDEX IF NOT EXISTS idx_inventory_ranch ON inventory(ranch_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);
    `);
    
    // Índices para production
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_production_bovine ON production(bovine_id);
      CREATE INDEX IF NOT EXISTS idx_production_type ON production(production_type);
      CREATE INDEX IF NOT EXISTS idx_production_date ON production(production_date);
    `);
    
    // Índices para reproduction
    await dbSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_reproduction_bovine ON reproduction(bovine_id);
      CREATE INDEX IF NOT EXISTS idx_reproduction_type ON reproduction(reproduction_type);
      CREATE INDEX IF NOT EXISTS idx_reproduction_date ON reproduction(event_date);
      CREATE INDEX IF NOT EXISTS idx_reproduction_sire ON reproduction(sire_id);
    `);
    
    console.log('   ✅ Todos los índices creados');
    
    // 7. VERIFICAR TODAS LAS TABLAS CREADAS
    console.log('\n6️⃣  Verificando todas las tablas...');
    const [allTablesResult] = await dbSequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`   📊 Total de tablas creadas: ${allTablesResult.length}`);
    console.log('   📋 Lista de tablas:');
    allTablesResult.forEach((row, index) => {
      console.log(`      ${index + 1}. ${row.table_name}`);
    });
    
    // 8. VERIFICAR RELACIONES Y CONSTRAINTS
    console.log('\n7️⃣  Verificando relaciones y constraints...');
    const [constraintsResult] = await dbSequelize.query(`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type
    `);
    
    console.log(`   🔗 Total de constraints: ${constraintsResult.length}`);
    
    // 9. RESUMEN FINAL
    console.log('\n🎉 ¡BASE DE DATOS COMPLETAMENTE CREADA!');
    console.log('==========================================');
    console.log('✅ 12 tablas principales creadas');
    console.log('✅ Relaciones y foreign keys configuradas');
    console.log('✅ Índices de optimización creados');
    console.log('✅ Timestamps automáticos configurados');
    console.log('✅ Constraints de integridad aplicados');
    
    console.log('\n📝 PRÓXIMOS PASOS RECOMENDADOS:');
    console.log('   1. Ejecutar: node insert-test-data.js');
    console.log('   2. Verificar que todas las tablas funcionen');
    console.log('   3. Probar la API con datos reales');
    console.log('   4. Verificar consultas y relaciones');
    console.log('   5. Comenzar desarrollo de funcionalidades');
    
    console.log('\n🗄️  INFORMACIÓN DE LA BASE DE DATOS:');
    console.log(`   Nombre: ${config.database}`);
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Usuario: ${config.username}`);
    console.log(`   Total de tablas: ${allTablesResult.length}`);
    
  } catch (error) {
    console.error('\n❌ ERROR durante la creación:');
    console.error('   Mensaje:', error.message);
    console.error('   Stack:', error.stack);
    
    if (error.code === '23505') {
      console.error('\n💡 SUGERENCIA: Error de duplicado, verifica que no haya datos existentes');
    } else if (error.code === '42P01') {
      console.error('\n💡 SUGERENCIA: Error de tabla no encontrada, verifica la conexión');
    }
  } finally {
    try {
      await dbSequelize?.close();
      console.log('\n🔌 Conexión cerrada');
    } catch (closeError) {
      console.log('\n⚠️  Error al cerrar conexión:', closeError.message);
    }
  }
}

// Ejecutar la función principal
createCompleteDatabase();


