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

    // 1. Fetch Bridges dynamically to get proper IDs across Tracardi versions (0.8.x, 1.x)
    let restBridgeId = '778ded05-4ff3-4e08-9a86-72c0195fa95d';
    let webhookBridgeId = '3d8bb87e-28d1-4a38-b19c-d0c1fbb71e22';

    try {
      const bridgesRes = await request(`${TRACARDI_API}/bridges`, { headers });
      if (bridgesRes.statusCode === 200 && bridgesRes.body.result) {
        const bridges = bridgesRes.body.result;
        const foundRest = bridges.find(b => b.type === 'rest');
        const foundWebhook = bridges.find(b => b.type === 'webhook');
        if (foundRest) restBridgeId = foundRest.id;
        if (foundWebhook) webhookBridgeId = foundWebhook.id;
      }
    } catch (e) {
      console.warn('⚠️ No se pudieron consultar los bridges automáticamente, usando IDs estándar.');
    }

    // 2. Check existing event sources
    let existingSources = [];
    const sourcesRes = await request(`${TRACARDI_API}/event-sources/by_type`, { headers });
    if (sourcesRes.statusCode === 200 && sourcesRes.body.grouped) {
      const groups = sourcesRes.body.grouped;
      for (const key in groups) {
        existingSources.push(...groups[key]);
      }
    } else {
      // Fallback for other versions
      const fallbackRes = await request(`${TRACARDI_API}/event-sources`, { headers });
      if (fallbackRes.statusCode === 200 && fallbackRes.body.grouped) {
        for (const key in fallbackRes.body.grouped) {
          existingSources.push(...fallbackRes.body.grouped[key]);
        }
      }
    }

    const hasDemoSource = existingSources.some(s => s.id === 'demo-source');
    const hasWebhookSource = existingSources.some(s => s.id === 'demo-webhook-source');

    if (!hasDemoSource) {
      console.log('➕ Creando Event Source REST: "demo-source"...');
      const createRes = await request(`${TRACARDI_API}/event-source`, { method: 'POST', headers }, {
        id: 'demo-source',
        name: 'Demo Web App',
        description: 'Fuente de eventos REST / JS para la demo local',
        type: ['rest'],
        bridge: { id: restBridgeId, name: 'REST API Bridge' },
        timestamp: new Date().toISOString(),
        enabled: true,
        channel: 'Web',
        transitional: false,
        tags: ['demo', 'web', 'rest'],
        groups: ['Web'],
        returns_profile: true,
        permanent_profile_id: true,
        requires_consent: false,
        manual: null,
        locked: false,
        synchronize_profiles: true,
        config: {}
      });
      if (createRes.statusCode === 200) {
        console.log('✅ Event Source "demo-source" creado exitosamente.');
      } else {
        console.warn('⚠️ Error al crear "demo-source":', createRes.body);
      }
    } else {
      console.log('✅ Event Source "demo-source" ya existe y está activo.');
    }

    if (!hasWebhookSource) {
      console.log('➕ Creando Event Source Webhook: "demo-webhook-source"...');
      const createRes = await request(`${TRACARDI_API}/event-source`, { method: 'POST', headers }, {
        id: 'demo-webhook-source',
        name: 'Demo Webhook Collector',
        description: 'Fuente de eventos Webhook para recolección directa servidor a servidor',
        type: ['webhook'],
        bridge: { id: webhookBridgeId, name: 'Webhook API Bridge' },
        timestamp: new Date().toISOString(),
        enabled: true,
        channel: 'Webhook',
        transitional: false,
        tags: ['demo', 'webhook'],
        groups: ['Webhook'],
        returns_profile: true,
        permanent_profile_id: true,
        requires_consent: false,
        manual: null,
        locked: false,
        synchronize_profiles: true,
        config: {}
      });
      if (createRes.statusCode === 200) {
        console.log('✅ Event Source "demo-webhook-source" creado exitosamente.');
      } else {
        console.warn('⚠️ Error al crear "demo-webhook-source":', createRes.body);
      }
    } else {
      console.log('✅ Event Source "demo-webhook-source" ya existe y está activo.');
    }
  }

  console.log('\n------------------------------------------------------');
  console.log('🎯 Configuración inicial completada.');
  console.log('------------------------------------------------------\n');
}

setup();
