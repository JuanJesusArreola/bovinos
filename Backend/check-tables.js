const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'bovino_system_db',
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'Eminem1710',
  dialect: 'postgres',
  logging: console.log
});

async function checkTables() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa');
    
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tablas existentes:');
    console.log('====================');
    results.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    if (results.length === 0) {
      console.log('No hay tablas en la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkTables();






