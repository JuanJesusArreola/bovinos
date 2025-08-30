const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testAuth() {
  console.log('🧪 PROBANDO RUTAS DE AUTENTICACIÓN');
  console.log('====================================');
  
  try {
    // 1. Test de conexión básica
    console.log('\n1️⃣ Probando conexión básica...');
    const health = await axios.get(`${API_BASE}/health`);
    console.log('✅ API responde:', health.status);
    
    // 2. Test de registro
    console.log('\n2️⃣ Probando registro de usuario...');
    const registerData = {
      firstName: 'Admin',
      lastName: 'Bovino',
      email: 'admin@bovino.com',
      password: 'admin123',
      confirmPassword: 'admin123',
      role: 'ADMIN'
    };
    
    const register = await axios.post(`${API_BASE}/auth/register`, registerData);
    console.log('✅ Usuario registrado:', register.status);
    console.log('   Respuesta:', register.data);
    
    // 3. Test de login
    console.log('\n3️⃣ Probando login...');
    const loginData = {
      email: 'admin@bovino.com',
      password: 'admin123'
    };
    
    const login = await axios.post(`${API_BASE}/auth/login`, loginData);
    console.log('✅ Login exitoso:', login.status);
    console.log('   Token:', login.data.data.accessToken);
    
    const token = login.data.data.accessToken;
    
    // 4. Test de endpoint protegido
    console.log('\n4️⃣ Probando endpoint protegido...');
    const bovines = await axios.get(`${API_BASE}/bovines`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Bovinos obtenidos:', bovines.status);
    
    console.log('\n🎉 ¡TODAS LAS PRUEBAS EXITOSAS!');
    
  } catch (error) {
    console.error('\n❌ ERROR durante las pruebas:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else {
      console.error('   Mensaje:', error.message);
    }
  }
}

// Ejecutar las pruebas
testAuth();
