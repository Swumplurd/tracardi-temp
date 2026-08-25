const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TRACARDI_API = process.env.TRACARDI_API || 'http://localhost:8686';
const OFFERS_API = process.env.OFFERS_API || 'http://localhost:1337/api/offers';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/examples', express.static(path.join(__dirname, 'examples')));

// Helper for making requests to Tracardi API
function callTracardi(endpoint, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${TRACARDI_API}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
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

    req.on('error', (err) => resolve({ statusCode: 500, error: err.message }));
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

// Health status endpoint
app.get('/api/health', async (req, res) => {
  const tracardiHealth = await callTracardi('/healthcheck');
  res.json({
    status: 'ok',
    demoServer: 'running',
    port: PORT,
    tracardiApi: TRACARDI_API,
    offersApi: OFFERS_API,
    tracardiStatus: tracardiHealth.statusCode === 200 ? 'online' : 'offline',
    timestamp: new Date().toISOString()
  });
});

// Helper para obtener ofertas desde la API externa (ej: Strapi http://localhost:1337/api/offers)
async function fetchOffersData() {
  try {
    const url = new URL(OFFERS_API);
    if (!url.searchParams.has('pagination[pageSize]')) {
      url.searchParams.set('pagination[pageSize]', '100');
    }

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const rawOffers = Array.isArray(json.data)
      ? json.data
      : (Array.isArray(json) ? json : (json.ofertas || []));

    const normalizedOffers = rawOffers.map(item => {
      const id = item.id_offer || item.documentId || String(item.id);
      return {
        ...item,
        id: id,
        strapi_id: item.id,
        documentId: item.documentId,
        id_offer: item.id_offer || id,
        precio_original: typeof item.precio_original === 'number' ? item.precio_original : parseFloat(item.precio_original) || 0,
        precio_oferta: typeof item.precio_oferta === 'number' ? item.precio_oferta : parseFloat(item.precio_oferta) || 0,
        descuento_porcentaje: typeof item.descuento_porcentaje === 'number' ? item.descuento_porcentaje : parseInt(item.descuento_porcentaje) || 0
      };
    });

    const categorias = Array.from(new Set(normalizedOffers.map(o => o.categoria).filter(Boolean)));

    return {
      total_ofertas: normalizedOffers.length,
      categorias: categorias,
      ofertas: normalizedOffers
    };
  } catch (error) {
    console.error(`Error obteniendo ofertas desde ${OFFERS_API}:`, error.message);
    // Fallback a ofertas.json en caso de que la API esté temporalmente inaccesible
    try {
      const fallback = require('./ofertas.json');
      console.warn('⚠️ Usando ofertas.json como respaldo de contingencia.');
      return fallback;
    } catch (e) {
      return null;
    }
  }
}

// Endpoint para compatibilidad estática
app.get('/ofertas.json', async (req, res) => {
  const data = await fetchOffersData();
  if (data) {
    return res.json(data);
  }
  res.sendFile(path.join(__dirname, 'ofertas.json'));
});

// Endpoint para catálogo de ofertas con filtro opcional de categoría
app.get('/api/ofertas', async (req, res) => {
  const data = await fetchOffersData();
  if (!data || !data.ofertas) {
    return res.status(502).json({ error: 'Catálogo de ofertas no disponible desde la API' });
  }

  const { categoria } = req.query;
  let filtradas = data.ofertas || [];

  if (categoria && categoria !== 'all' && categoria !== 'todas') {
    filtradas = filtradas.filter(o => o.categoria && o.categoria.toLowerCase() === categoria.toLowerCase());
  }

  res.json({
    total: filtradas.length,
    total_catalogo: data.total_ofertas,
    categorias: data.categorias,
    ofertas: filtradas
  });
});

// Endpoint para detalle de oferta por ID
app.get('/api/ofertas/:id', async (req, res) => {
  const data = await fetchOffersData();
  if (!data || !data.ofertas) {
    return res.status(502).json({ error: 'Catálogo de ofertas no disponible desde la API' });
  }

  const searchId = req.params.id;
  const oferta = data.ofertas.find(o =>
    String(o.id) === String(searchId) ||
    String(o.id_offer) === String(searchId) ||
    String(o.documentId) === String(searchId) ||
    String(o.strapi_id) === String(searchId)
  );

  if (!oferta) {
    return res.status(404).json({ error: 'Oferta no encontrada' });
  }

  res.json(oferta);
});

// Example 1: Node.js Server-Side Tracking Endpoint
app.post('/api/track-backend', async (req, res) => {
  const { eventType, profileId, sessionId, properties } = req.body;

  const payload = {
    source: { id: 'demo-source' },
    session: { id: sessionId || `server-session-${Date.now()}` },
    profile: profileId ? { id: profileId } : null,
    events: [
      {
        type: eventType || 'backend-action',
        properties: properties || { server: 'Node.js Express', timestamp: new Date().toISOString() }
      }
    ]
  };

  const response = await callTracardi('/track', 'POST', payload);
  res.status(response.statusCode).json({
    sentPayload: payload,
    tracardiResponse: response.body
  });
});

// Example 2: Server-to-Server Webhook Tracking Endpoint (/collect)
app.post('/api/webhook-event', async (req, res) => {
  const { eventType, sessionId, properties } = req.body;
  const evType = eventType || 'payment-received';
  const sessId = sessionId || `webhook-sess-${Date.now()}`;

  const endpoint = `/collect/${encodeURIComponent(evType)}/demo-webhook-source/${encodeURIComponent(sessId)}`;
  const payload = {
    properties: properties || { gateway: 'stripe', status: 'succeeded', amount: 99.00 }
  };

  const response = await callTracardi(endpoint, 'POST', payload);
  res.status(response.statusCode).json({
    endpoint: endpoint,
    sentPayload: payload,
    tracardiResponse: response.body
  });
});

// Start Server
app.listen(PORT, () => {
  console.log('\n======================================================');
  console.log(`✨ TRACARDI DEMO APP CORRIENDO EN: http://localhost:${PORT}`);
  console.log(`🌐 Dashboard de Tracardi: http://localhost:8787`);
  console.log(`📡 Tracardi API Endpoint: ${TRACARDI_API}`);
  console.log(`🏷️ Offers API Endpoint:   ${OFFERS_API}`);
  console.log('======================================================\n');
});
