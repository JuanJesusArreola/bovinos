const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configuración de la base de datos
const sequelize = new Sequelize(
  process.env.DB_NAME || 'bovino_system_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // Desactivar logs de SQL
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

async function verifyData() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    console.log(`🗄️  Base de datos: ${sequelize.getDatabaseName()}`);
    
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa\n');

    console.log('🔍 Verificando datos insertados...\n');

    // 1. Verificar usuarios
    console.log('👥 USUARIOS:');
    const users = await sequelize.query(`
      SELECT usercode, username, email, role, status, access_level, 
             personal_info->>'firstName' as first_name,
             personal_info->>'lastName' as last_name
      FROM users 
      ORDER BY usercode
    `, { type: Sequelize.QueryTypes.SELECT });
    
    users.forEach(user => {
      console.log(`   ${user.usercode} - ${user.first_name} ${user.last_name} (${user.role}) - ${user.status}`);
    });
    console.log(`   Total: ${users.length} usuarios\n`);

    // 2. Verificar ranchos
    console.log('🏡 RANCHOS:');
    const ranches = await sequelize.query(`
      SELECT ranch_code, name, type, status, 
             ownership_info->>'ownerName' as owner_name,
             capacity->>'maxCapacity' as max_capacity
      FROM ranches 
      ORDER BY ranch_code
    `, { type: Sequelize.QueryTypes.SELECT });
    
    ranches.forEach(ranch => {
      console.log(`   ${ranch.ranch_code} - ${ranch.name} (${ranch.type}) - Capacidad: ${ranch.max_capacity}`);
    });
    console.log(`   Total: ${ranches.length} ranchos\n`);

    // 3. Verificar bovinos
    console.log('🐄 BOVINOS:');
    const bovines = await sequelize.query(`
      SELECT ear_tag, name, breed, cattle_type, gender, 
             birth_date, weight, health_status, vaccination_status
      FROM bovines 
      ORDER BY ear_tag
    `, { type: Sequelize.QueryTypes.SELECT });
    
    bovines.forEach(bovine => {
      console.log(`   ${bovine.ear_tag} - ${bovine.name} (${bovine.breed} ${bovine.cattle_type}) - ${bovine.health_status}`);
    });
    console.log(`   Total: ${bovines.length} bovinos\n`);

    // 4. Verificar medicamentos
    console.log('💊 MEDICAMENTOS:');
    const medications = await sequelize.query(`
      SELECT medication_code, generic_name, brand_name, type, 
             active_ingredients->0->>'name' as active_ingredient,
             dosage_form, is_antibiotic, is_vaccine
      FROM medications 
      ORDER BY medication_code
    `, { type: Sequelize.QueryTypes.SELECT });
    
    medications.forEach(med => {
      const type = med.is_antibiotic ? 'Antibiótico' : med.is_vaccine ? 'Vacuna' : 'Otro';
      console.log(`   ${med.medication_code} - ${med.generic_name} (${med.brand_name}) - ${type}`);
    });
    console.log(`   Total: ${medications.length} medicamentos\n`);

    // 5. Verificar eventos
    console.log('📅 EVENTOS:');
    const events = await sequelize.query(`
      SELECT e.id, e.title, e.event_type, e.status, e.priority,
             b.ear_tag, b.name as bovine_name
      FROM events e
      JOIN bovines b ON e.bovine_id = b.id
      ORDER BY e.created_at DESC
    `, { type: Sequelize.QueryTypes.SELECT });
    
    events.forEach(event => {
      console.log(`   ${event.event_type} - ${event.title} (${event.bovine_name}) - ${event.status}`);
    });
    console.log(`   Total: ${events.length} eventos\n`);

    // 6. Verificar registros de salud
    console.log('🏥 REGISTROS DE SALUD:');
    const healthRecords = await sequelize.query(`
      SELECT hr.id, hr.record_type, hr.overall_health_status, hr.record_date,
             b.ear_tag, b.name as bovine_name
      FROM health_records hr
      JOIN bovines b ON hr.bovine_id = b.id
      ORDER BY hr.record_date DESC
    `, { type: Sequelize.QueryTypes.SELECT });
    
    healthRecords.forEach(record => {
      console.log(`   ${record.record_type} - ${record.bovine_name} - ${record.overall_health_status} (${record.record_date})`);
    });
    console.log(`   Total: ${healthRecords.length} registros de salud\n`);

    // 7. Verificar finanzas
    console.log('💰 TRANSACCIONES FINANCIERAS:');
    const finances = await sequelize.query(`
      SELECT transaction_type, category, title, amount, currency, status, transaction_date
      FROM finances 
      ORDER BY transaction_date DESC
    `, { type: Sequelize.QueryTypes.SELECT });
    
    finances.forEach(finance => {
      console.log(`   ${finance.transaction_type} - ${finance.title} - $${finance.amount} ${finance.currency} (${finance.status})`);
    });
    console.log(`   Total: ${finances.length} transacciones\n`);

    // 8. Verificar inventario
    console.log('📦 INVENTARIO:');
    const inventory = await sequelize.query(`
      SELECT item_code, item_name, category, current_stock, unit_of_measure, 
             unit_cost, total_value, status
      FROM inventory 
      ORDER BY item_code
    `, { type: Sequelize.QueryTypes.SELECT });
    
    inventory.forEach(item => {
      console.log(`   ${item.item_code} - ${item.item_name} (${item.category}) - Stock: ${item.current_stock} ${item.unit_of_measure}`);
    });
    console.log(`   Total: ${inventory.length} items\n`);

    // 9. Verificar producción
    console.log('🥛 PRODUCCIÓN:');
    const production = await sequelize.query(`
      SELECT p.production_code, p.production_type, p.quantity, p.unit, p.status,
             b.ear_tag, b.name as bovine_name
      FROM production p
      JOIN bovines b ON p.bovine_id = b.id
      ORDER BY p.production_date DESC
    `, { type: Sequelize.QueryTypes.SELECT });
    
    production.forEach(prod => {
      console.log(`   ${prod.production_type} - ${prod.bovine_name} - ${prod.quantity} ${prod.unit} (${prod.status})`);
    });
    console.log(`   Total: ${production.length} registros de producción\n`);

    // 10. Verificar reproducción
    console.log('🐣 REPRODUCCIÓN:');
    const reproduction = await sequelize.query(`
      SELECT r.reproduction_code, r.reproduction_type, r.status,
             b.ear_tag, b.name as bovine_name,
             r.sire_info->>'sireName' as sire_name
      FROM reproduction r
      JOIN bovines b ON r.dam_id = b.id
      ORDER BY r.created_at DESC
    `, { type: Sequelize.QueryTypes.SELECT });
    
    reproduction.forEach(rep => {
      console.log(`   ${rep.reproduction_type} - ${rep.bovine_name} x ${rep.sire_name} - ${rep.status}`);
    });
    console.log(`   Total: ${reproduction.length} registros de reproducción\n`);

    // 11. Consultas de ejemplo
    console.log('📊 CONSULTAS DE EJEMPLO:\n');

    // Bovinos por estado de salud
    console.log('🐄 Bovinos por estado de salud:');
    const healthStats = await sequelize.query(`
      SELECT health_status, COUNT(*) as count
      FROM bovines 
      GROUP BY health_status
      ORDER BY count DESC
    `, { type: Sequelize.QueryTypes.SELECT });
    
    healthStats.forEach(stat => {
      console.log(`   ${stat.health_status}: ${stat.count} bovinos`);
    });
    console.log('');

    // Eventos por tipo
    console.log('📅 Eventos por tipo:');
    const eventStats = await sequelize.query(`
      SELECT event_type, COUNT(*) as count
      FROM events 
      GROUP BY event_type
      ORDER BY count DESC
    `, { type: Sequelize.QueryTypes.SELECT });
    
    eventStats.forEach(stat => {
      console.log(`   ${stat.event_type}: ${stat.count} eventos`);
    });
    console.log('');

    // Resumen financiero
    console.log('💰 Resumen financiero:');
    const financeSummary = await sequelize.query(`
      SELECT 
        transaction_type,
        COUNT(*) as transactions,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM finances 
      GROUP BY transaction_type
      ORDER BY total_amount DESC
    `, { type: Sequelize.QueryTypes.SELECT });
    
    financeSummary.forEach(summary => {
      console.log(`   ${summary.transaction_type}: ${summary.transactions} transacciones, Total: $${summary.total_amount}, Promedio: $${summary.avg_amount}`);
    });
    console.log('');

    console.log('🎉 ¡Verificación completada exitosamente!');
    console.log('📝 Los datos están listos para usar en el sistema.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

// Ejecutar verificación
verifyData();
