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
  logging: false, // Desactivar logging para datos de prueba
  timezone: '-06:00'
};

async function insertTestData() {
  console.log('🔌 Conectando a la base de datos...');
  console.log(`🗄️  Base de datos: ${config.database}`);
  
  const sequelize = new Sequelize(config);
  
  try {
    // Probar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa');
    
    console.log('\n🌱 Insertando datos de prueba...');
    
    // =============================================
    // 1. INSERTAR USUARIOS DE PRUEBA
    // =============================================
    console.log('1️⃣  Insertando usuarios...');
    
    const users = await sequelize.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, email_verified) VALUES
      ('user_001', 'admin@ganaderia.mx', '$2b$10$hashed_password_123', 'Administrador', 'Sistema', 'ADMIN', true, true),
      ('user_002', 'veterinario@ganaderia.mx', '$2b$10$hashed_password_456', 'Dr. Carlos', 'Méndez', 'VETERINARIAN', true, true),
      ('user_003', 'operador@ganaderia.mx', '$2b$10$hashed_password_789', 'Juan', 'Pérez', 'OPERATOR', true, true),
      ('user_004', 'supervisor@ganaderia.mx', '$2b$10$hashed_password_012', 'María', 'García', 'SUPERVISOR', true, true)
      ON CONFLICT (id) DO NOTHING
      RETURNING id, email, first_name, last_name, role;
    `);
    
    console.log(`   ✅ ${users[0].length} usuarios insertados`);
    
    // =============================================
    // 2. INSERTAR RANCHOS DE PRUEBA
    // =============================================
    console.log('2️⃣  Insertando ranchos...');
    
    const ranches = await sequelize.query(`
      INSERT INTO ranches (id, name, description, address, city, state, country, total_area, area_unit, owner_id, status) VALUES
      ('ranch_001', 'Rancho El Paraíso', 'Rancho principal de la empresa', 'Km 15 Carretera Villahermosa-Cárdenas', 'Villahermosa', 'Tabasco', 'México', 150.5, 'hectáreas', 'user_001', 'ACTIVE'),
      ('ranch_002', 'Rancho La Esperanza', 'Rancho de cría y engorda', 'Km 8 Carretera a Cunduacán', 'Cunduacán', 'Tabasco', 'México', 75.2, 'hectáreas', 'user_001', 'ACTIVE'),
      ('ranch_003', 'Rancho San José', 'Rancho de reproducción', 'Ejido San José', 'Centro', 'Tabasco', 'México', 45.8, 'hectáreas', 'user_001', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, name, city;
    `);
    
    console.log(`   ✅ ${ranches[0].length} ranchos insertados`);
    
    // =============================================
    // 3. INSERTAR UBICACIONES DE PRUEBA
    // =============================================
    console.log('3️⃣  Insertando ubicaciones...');
    
    const locations = await sequelize.query(`
      INSERT INTO locations (id, name, description, location_type, latitude, longitude, address, city, ranch_id, is_active) VALUES
      ('loc_001', 'Corral Principal', 'Corral principal para bovinos adultos', 'CORRAL', 17.9892, -92.9281, 'Rancho El Paraíso', 'Villahermosa', 'ranch_001', true),
      ('loc_002', 'Corral de Crías', 'Corral especializado para terneros', 'CORRAL', 17.9892, -92.9281, 'Rancho El Paraíso', 'Villahermosa', 'ranch_001', true),
      ('loc_003', 'Aislamiento Sanitario', 'Área de cuarentena y tratamientos', 'ISOLATION', 17.9892, -92.9281, 'Rancho El Paraíso', 'Villahermosa', 'ranch_001', true),
      ('loc_004', 'Pastizal Norte', 'Área de pastoreo principal', 'PASTURE', 17.9892, -92.9281, 'Rancho El Paraíso', 'Villahermosa', 'ranch_001', true)
      ON CONFLICT (id) DO NOTHING
      RETURNING id, name, location_type;
    `);
    
    console.log(`   ✅ ${locations[0].length} ubicaciones insertadas`);
    
    // =============================================
    // 4. INSERTAR BOVINOS DE PRUEBA
    // =============================================
    console.log('4️⃣  Insertando bovinos...');
    
    const bovines = await sequelize.query(`
      INSERT INTO bovines (id, ear_tag, name, breed, cattle_type, gender, birth_date, weight, health_status, vaccination_status, ranch_id, owner_id) VALUES
      ('bovine_001', 'B001', 'Luna', 'Brahman', 'COW', 'FEMALE', '2020-03-15', 450.5, 'HEALTHY', 'UP_TO_DATE', 'ranch_001', 'user_001'),
      ('bovine_002', 'B002', 'Toro', 'Brahman', 'BULL', 'MALE', '2019-07-22', 650.0, 'HEALTHY', 'UP_TO_DATE', 'ranch_001', 'user_001'),
      ('bovine_003', 'B003', 'Estrella', 'Brahman', 'COW', 'FEMALE', '2021-01-10', 380.2, 'HEALTHY', 'UP_TO_DATE', 'ranch_001', 'user_001'),
      ('bovine_004', 'B004', 'Sol', 'Brahman', 'CALF', 'MALE', '2023-11-05', 120.8, 'HEALTHY', 'PENDING', 'ranch_001', 'user_001'),
      ('bovine_005', 'B005', 'Nube', 'Brahman', 'COW', 'FEMALE', '2020-09-18', 420.3, 'HEALTHY', 'UP_TO_DATE', 'ranch_001', 'user_001')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, ear_tag, name, breed, cattle_type;
    `);
    
    console.log(`   ✅ ${bovines[0].length} bovinos insertados`);
    
    // =============================================
    // 5. INSERTAR MEDICAMENTOS DE PRUEBA
    // =============================================
    console.log('5️⃣  Insertando medicamentos...');
    
    const medications = await sequelize.query(`
      INSERT INTO medications (id, name, generic_name, brand_name, active_ingredient, dosage_form, strength, manufacturer, category, is_active) VALUES
      ('med_001', 'Penicilina G', 'Penicilina G Potásica', 'Penivet', 'Penicilina G', 'INJECTABLE', '300,000 UI/ml', 'VetPharma', 'ANTIBIÓTICO', true),
      ('med_002', 'Vitaminas AD3E', 'Complejo vitamínico', 'Vitavet', 'Vitaminas A, D3, E', 'INJECTABLE', '5 ml', 'VetPharma', 'VITAMINAS', true),
      ('med_003', 'Ivermectina', 'Ivermectina', 'Ivomec', 'Ivermectina', 'INJECTABLE', '1%', 'Merial', 'ANTIPARASITARIO', true),
      ('med_004', 'Oxitetraciclina', 'Oxitetraciclina', 'Terramicina', 'Oxitetraciclina', 'INJECTABLE', '200 mg/ml', 'Pfizer', 'ANTIBIÓTICO', true)
      ON CONFLICT (id) DO NOTHING
      RETURNING id, name, category;
    `);
    
    console.log(`   ✅ ${medications[0].length} medicamentos insertados`);
    
    // =============================================
    // 6. INSERTAR EVENTOS DE PRUEBA
    // =============================================
    console.log('6️⃣  Insertando eventos...');
    
    const events = await sequelize.query(`
      INSERT INTO events (id, title, description, event_type, event_status, priority, start_date, end_date, location, bovine_id, created_by) VALUES
      ('event_001', 'Vacunación Triple Viral', 'Vacunación anual obligatoria', 'VACCINATION', 'COMPLETED', 'HIGH', '2024-01-15 09:00:00', '2024-01-15 11:00:00', 'Corral Principal', 'bovine_001', 'user_002'),
      ('event_002', 'Chequeo de Salud', 'Revisión general de salud', 'HEALTH_CHECK', 'COMPLETED', 'MEDIUM', '2024-01-20 14:00:00', '2024-01-20 15:00:00', 'Corral Principal', 'bovine_002', 'user_002'),
      ('event_003', 'Pesaje Mensual', 'Control de peso mensual', 'WEIGHING', 'SCHEDULED', 'LOW', '2024-02-01 08:00:00', '2024-02-01 10:00:00', 'Corral Principal', 'bovine_003', 'user_003'),
      ('event_004', 'Tratamiento Antiparasitario', 'Desparasitación con Ivermectina', 'TREATMENT', 'IN_PROGRESS', 'MEDIUM', '2024-01-25 10:00:00', '2024-01-25 12:00:00', 'Aislamiento Sanitario', 'bovine_004', 'user_002')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, title, event_type, event_status;
    `);
    
    console.log(`   ✅ ${events[0].length} eventos insertados`);
    
    // =============================================
    // 7. INSERTAR REGISTROS DE SALUD DE PRUEBA
    // =============================================
    console.log('7️⃣  Insertando registros de salud...');
    
    const healthRecords = await sequelize.query(`
      INSERT INTO health_records (id, bovine_id, record_type, diagnosis, treatment, veterinarian, cost, created_by) VALUES
      ('health_001', 'bovine_001', 'VACCINATION', 'Vacunación rutinaria', 'Aplicación de vacuna triple viral', 'Dr. Carlos Méndez', 150.00, 'user_002'),
      ('health_002', 'bovine_002', 'HEALTH_CHECK', 'Revisión general', 'Examen físico completo', 'Dr. Carlos Méndez', 200.00, 'user_002'),
      ('health_003', 'bovine_004', 'TREATMENT', 'Parásitos internos', 'Tratamiento con Ivermectina', 'Dr. Carlos Méndez', 300.00, 'user_002')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, bovine_id, record_type, diagnosis;
    `);
    
    console.log(`   ✅ ${healthRecords[0].length} registros de salud insertados`);
    
    // =============================================
    // 8. INSERTAR RELACIONES SALUD-MEDICAMENTOS
    // =============================================
    console.log('8️⃣  Insertando relaciones salud-medicamentos...');
    
    const healthMedications = await sequelize.query(`
      INSERT INTO health_medication (id, health_record_id, medication_id, dosage, dosage_unit, frequency, duration, duration_unit, administration_route) VALUES
      ('hm_001', 'health_001', 'med_002', 5, 'ml', 'Una vez', 1, 'días', 'INTRAMUSCULAR'),
      ('hm_002', 'health_003', 'med_003', 1, 'ml', 'Una vez', 1, 'días', 'SUBCUTÁNEA')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, health_record_id, medication_id;
    `);
    
    console.log(`   ✅ ${healthMedications[0].length} relaciones salud-medicamentos insertadas`);
    
    // =============================================
    // 9. INSERTAR FINANZAS DE PRUEBA
    // =============================================
    console.log('9️⃣  Insertando finanzas...');
    
    const finances = await sequelize.query(`
      INSERT INTO finances (id, transaction_type, amount, description, category, date, created_by) VALUES
      ('fin_001', 'EXPENSE', 150.00, 'Vacunación bovino B001', 'VETERINARY', '2024-01-15', 'user_002'),
      ('fin_002', 'EXPENSE', 200.00, 'Chequeo de salud bovino B002', 'VETERINARY', '2024-01-20', 'user_002'),
      ('fin_003', 'EXPENSE', 300.00, 'Tratamiento antiparasitario bovino B004', 'VETERINARY', '2024-01-25', 'user_002'),
      ('fin_004', 'INCOME', 5000.00, 'Venta de ternero', 'LIVESTOCK_SALES', '2024-01-10', 'user_001'),
      ('fin_005', 'EXPENSE', 1200.00, 'Compra de alimento', 'FEED', '2024-01-05', 'user_003')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, transaction_type, amount, category;
    `);
    
    console.log(`   ✅ ${finances[0].length} transacciones financieras insertadas`);
    
    // =============================================
    // 10. INSERTAR INVENTARIO DE PRUEBA
    // =============================================
    console.log('🔟 Insertando inventario...');
    
    const inventory = await sequelize.query(`
      INSERT INTO inventory (id, item_name, description, category, subcategory, item_type, brand, quantity, unit, unit_cost, total_value, supplier, location_id, ranch_id, status) VALUES
      ('inv_001', 'Jeringa 10ml', 'Jeringas desechables para inyecciones', 'MEDICAL', 'INJECTION', 'SUPPLIES', 'Becton Dickinson', 100, 'unidades', 2.50, 250.00, 'MedSupply', 'loc_003', 'ranch_001', 'ACTIVE'),
      ('inv_002', 'Agujas 18G', 'Agujas para inyecciones intramusculares', 'MEDICAL', 'INJECTION', 'SUPPLIES', 'Becton Dickinson', 200, 'unidades', 1.00, 200.00, 'MedSupply', 'loc_003', 'ranch_001', 'ACTIVE'),
      ('inv_003', 'Báscula Digital', 'Báscula para pesar bovinos', 'EQUIPMENT', 'MEASUREMENT', 'EQUIPMENT', 'Tru-Test', 2, 'unidades', 1500.00, 3000.00, 'AgroEquip', 'loc_001', 'ranch_001', 'ACTIVE'),
      ('inv_004', 'Cepillo para Bovinos', 'Cepillo para limpieza de bovinos', 'TOOLS', 'GROOMING', 'TOOLS', 'RanchPro', 5, 'unidades', 45.00, 225.00, 'AgroTools', 'loc_001', 'ranch_001', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, item_name, category, quantity;
    `);
    
    console.log(`   ✅ ${inventory[0].length} items de inventario insertados`);
    
    // =============================================
    // 11. INSERTAR PRODUCCIÓN DE PRUEBA
    // =============================================
    console.log('1️⃣1️⃣ Insertando producción...');
    
    const production = await sequelize.query(`
      INSERT INTO production (id, bovine_id, production_type, production_date, quantity, unit, quality_grade, notes, cost, revenue, profit, created_by) VALUES
      ('prod_001', 'bovine_001', 'MILK', '2024-01-20', 15.5, 'litros', 'EXCELLENT', 'Producción diaria de leche', 0.00, 155.00, 155.00, 'user_003'),
      ('prod_002', 'bovine_003', 'MILK', '2024-01-20', 12.8, 'litros', 'GOOD', 'Producción diaria de leche', 0.00, 128.00, 128.00, 'user_003'),
      ('prod_003', 'bovine_005', 'MILK', '2024-01-20', 14.2, 'litros', 'EXCELLENT', 'Producción diaria de leche', 0.00, 142.00, 142.00, 'user_003')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, bovine_id, production_type, quantity, unit;
    `);
    
    console.log(`   ✅ ${production[0].length} registros de producción insertados`);
    
    // =============================================
    // 12. INSERTAR REPRODUCCIÓN DE PRUEBA
    // =============================================
    console.log('1️⃣2️⃣ Insertando reproducción...');
    
    const reproduction = await sequelize.query(`
      INSERT INTO reproduction (id, bovine_id, reproduction_type, event_date, sire_id, method, success, pregnancy_confirmed, pregnancy_date, expected_calving_date, cost, created_by) VALUES
      ('rep_001', 'bovine_001', 'INSEMINATION', '2023-12-01', 'bovine_002', 'ARTIFICIAL_INSEMINATION', true, true, '2023-12-15', '2024-09-15', 500.00, 'user_002'),
      ('rep_002', 'bovine_003', 'INSEMINATION', '2023-12-10', 'bovine_002', 'ARTIFICIAL_INSEMINATION', true, true, '2023-12-25', '2024-09-25', 500.00, 'user_002'),
      ('rep_003', 'bovine_005', 'INSEMINATION', '2023-12-05', 'bovine_002', 'ARTIFICIAL_INSEMINATION', true, true, '2023-12-20', '2024-09-20', 500.00, 'user_002')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, bovine_id, reproduction_type, event_date, success;
    `);
    
    console.log(`   ✅ ${reproduction[0].length} registros de reproducción insertados`);
    
    // =============================================
    // VERIFICAR DATOS INSERTADOS
    // =============================================
    console.log('\n📊 Verificando datos insertados...');
    
    const counts = await sequelize.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM ranches) as ranches_count,
        (SELECT COUNT(*) FROM locations) as locations_count,
        (SELECT COUNT(*) FROM bovines) as bovines_count,
        (SELECT COUNT(*) FROM medications) as medications_count,
        (SELECT COUNT(*) FROM events) as events_count,
        (SELECT COUNT(*) FROM health_records) as health_count,
        (SELECT COUNT(*) FROM health_medication) as health_med_count,
        (SELECT COUNT(*) FROM finances) as finances_count,
        (SELECT COUNT(*) FROM inventory) as inventory_count,
        (SELECT COUNT(*) FROM production) as production_count,
        (SELECT COUNT(*) FROM reproduction) as reproduction_count;
    `);
    
    const stats = counts[0][0];
    console.log('📈 Estadísticas de datos insertados:');
    console.log(`   👥 Usuarios: ${stats.users_count}`);
    console.log(`   🏡 Ranchos: ${stats.ranches_count}`);
    console.log(`   📍 Ubicaciones: ${stats.locations_count}`);
    console.log(`   🐄 Bovinos: ${stats.bovines_count}`);
    console.log(`   💊 Medicamentos: ${stats.medications_count}`);
    console.log(`   📅 Eventos: ${stats.events_count}`);
    console.log(`   🏥 Registros de salud: ${stats.health_count}`);
    console.log(`   💉 Relaciones salud-medicamentos: ${stats.health_med_count}`);
    console.log(`   💰 Transacciones financieras: ${stats.finances_count}`);
    console.log(`   📦 Items de inventario: ${stats.inventory_count}`);
    console.log(`   🥛 Registros de producción: ${stats.production_count}`);
    console.log(`   🐣 Registros de reproducción: ${stats.reproduction_count}`);
    
    console.log('\n🎉 ¡Datos de prueba insertados exitosamente!');
    console.log('📝 Próximos pasos:');
    console.log('   1. Verificar que todos los datos se insertaron correctamente');
    console.log('   2. Probar la API con datos reales');
    console.log('   3. Verificar consultas y relaciones entre tablas');
    console.log('   4. Comenzar desarrollo de funcionalidades');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

// Ejecutar la función
insertTestData();


