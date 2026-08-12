const http = require('http');

const TRACARDI_API = process.env.TRACARDI_API || 'http://localhost:8686';
const ADMIN_USER = process.env.TRACARDI_USER || 'swumplurd@gmail.com';
const ADMIN_PASS = process.env.TRACARDI_PASS || '123456';

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ statusCode: res.statusCode, body: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function setup() {
  console.log('\n======================================================');
  console.log('🚀 TRACARDI DEMO - INICIALIZADOR DE FUENTES DE DATOS');
  console.log('======================================================\n');

  console.log(`📡 Verificando conexión con Tracardi API en ${TRACARDI_API}...`);
  try {
    const health = await request(`${TRACARDI_API}/healthcheck`);
    console.log(`✅ Tracardi API activo (Status: ${health.statusCode})`);
  } catch (err) {
    console.error(`❌ No se pudo conectar a Tracardi en ${TRACARDI_API}. Asegúrate de que los contenedores estén corriendo.`);
    process.exit(1);
  }

  console.log(`🔑 Autenticando con usuario admin (${ADMIN_USER})...`);
  let token = '';
  try {
    const formData = `username=${encodeURIComponent(ADMIN_USER)}&password=${encodeURIComponent(ADMIN_PASS)}`;
    const loginRes = await request(`${TRACARDI_API}/user/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, formData);

    if (loginRes.statusCode === 200 && loginRes.body.access_token) {
      token = loginRes.body.access_token;
      console.log('✅ Autenticación exitosa en Tracardi.');
    } else {
      console.warn('⚠️ No se pudo autenticar con las credenciales por defecto. Error:', loginRes.body);
    }
  } catch (err) {
    console.warn('⚠️ Error al autenticar:', err.message);
  }

  if (token) {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Check existing sources
    const sourcesRes = await request(`${TRACARDI_API}/event-sources`, { headers });
    let existingSources = [];
    if (sourcesRes.statusCode === 200 && sourcesRes.body.grouped) {
      const groups = sourcesRes.body.grouped;
      for (const key in groups) {
        existingSources.push(...groups[key]);
      }
    }

    const hasDemoSource = existingSources.some(s => s.id === 'demo-source');
    const hasWebhookSource = existingSources.some(s => s.id === 'demo-webhook-source');

    if (!hasDemoSource) {
      console.log('➕ Creando Event Source REST: "demo-source"...');
      await request(`${TRACARDI_API}/event-source`, { method: 'POST', headers }, {
        id: 'demo-source',
        name: 'Demo Web App',
        description: 'Fuente de eventos REST / JS para la demo local',
        type: ['rest'],
        bridge: { id: 'e72f3216-aa4e-2a56-c172-9fe1f34d7fde', name: 'REST API Bridge' },
        timestamp: new Date().toISOString(),
        enabled: true,
        tags: ['demo', 'web', 'rest'],
        groups: [],
        config: {}
      });
      console.log('✅ Event Source "demo-source" creado exitosamente.');
    } else {
      console.log('✅ Event Source "demo-source" ya existe.');
    }

    if (!hasWebhookSource) {
      console.log('➕ Creando Event Source Webhook: "demo-webhook-source"...');
      await request(`${TRACARDI_API}/event-source`, { method: 'POST', headers }, {
        id: 'demo-webhook-source',
        name: 'Demo Webhook Collector',
        description: 'Fuente de eventos Webhook para recolección directa servidor a servidor',
        type: ['webhook'],
        bridge: { id: 'd69b1c05-74d7-22fe-dbef-92a1f831e975', name: 'Webhook API Bridge' },
        timestamp: new Date().toISOString(),
        enabled: true,
        tags: ['demo', 'webhook'],
        groups: [],
        config: {}
      });
      console.log('✅ Event Source "demo-webhook-source" creado exitosamente.');
    } else {
      console.log('✅ Event Source "demo-webhook-source" ya existe.');
    }
  }

  console.log('\n------------------------------------------------------');
  console.log('🎯 Configuración inicial completada.');
  console.log('------------------------------------------------------\n');
}

setup();
