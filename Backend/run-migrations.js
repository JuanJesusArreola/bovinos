// Script para ejecutar migraciones
const { Sequelize } = require('sequelize');
const { createMigrationManager } = require('./dist/migrations/MigrationManager');

async function runMigrations() {
  try {
    console.log('🚀 Iniciando migraciones de autenticación...');
    
    // Configuración de la base de datos
    const sequelize = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'cattle_management',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      logging: false
    });

    // Crear instancia del migration manager
    const migrationManager = createMigrationManager(sequelize);

    // Verificar estado actual
    console.log('📊 Estado actual de las migraciones:');
    await migrationManager.getStatus();

    // Ejecutar migraciones
    console.log('\n🔄 Ejecutando migraciones...');
    const result = await migrationManager.runMigrations();

    if (result.success) {
      console.log('✅ Migraciones ejecutadas correctamente');
      console.log(`📊 Ejecutadas: ${result.executed.length}`);
      if (result.failed.length > 0) {
        console.log(`❌ Fallidas: ${result.failed.length}`);
        result.errors.forEach(error => console.log(`   - ${error}`));
      }
    } else {
      console.log('❌ Error ejecutando migraciones');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

runMigrations();






