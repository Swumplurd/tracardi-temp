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
      const entidadFederativa = item.entidad_federativa !== undefined
        ? item.entidad_federativa
        : (item.attributes && item.attributes.entidad_federativa !== undefined ? item.attributes.entidad_federativa : null);

      return {
        ...item,
        id: id,
        strapi_id: item.id,
        documentId: item.documentId,
        id_offer: item.id_offer || id,
        entidad_federativa: entidadFederativa || null,
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

// Endpoint para catálogo de ofertas con filtro opcional de categoría y región
app.get('/api/ofertas', async (req, res) => {
  const data = await fetchOffersData();
  if (!data || !data.ofertas) {
    return res.status(502).json({ error: 'Catálogo de ofertas no disponible desde la API' });
  }

  const { categoria, region, entidad_federativa } = req.query;
  let filtradas = data.ofertas || [];

  if (categoria && categoria !== 'all' && categoria !== 'todas') {
    filtradas = filtradas.filter(o => o.categoria && o.categoria.toLowerCase() === categoria.toLowerCase());
  }

  const geoRegion = region || entidad_federativa;
  if (geoRegion && geoRegion !== 'all' && geoRegion !== 'todas') {
    filtradas = filtradas.filter(o => !o.entidad_federativa || o.entidad_federativa.toUpperCase() === geoRegion.toUpperCase());
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

// =======================================================
// MÉTRICAS Y TRACKING DE RENDIMIENTO DE PROMOCIONES (US-007)
// =======================================================

// Métricas base para simulación realista y análisis de efectividad
const baselineOfferMetrics = {
  'COM-001': { clicks: 142, redemptions: 48 },
  'COM-002': { clicks: 95, redemptions: 26 },
  'COM-003': { clicks: 68, redemptions: 19 },
  'COM-004': { clicks: 110, redemptions: 42 },
  'COM-005': { clicks: 76, redemptions: 21 },
  'ELE-001': { clicks: 235, redemptions: 54 },
  'ELE-002': { clicks: 180, redemptions: 32 },
  'ELE-003': { clicks: 88, redemptions: 14 },
  'ELE-004': { clicks: 125, redemptions: 22 },
  'ELE-005': { clicks: 95, redemptions: 18 },
  'CIN-001': { clicks: 210, redemptions: 89 },
  'CIN-002': { clicks: 165, redemptions: 62 },
  'CIN-003': { clicks: 120, redemptions: 38 },
  'CIN-004': { clicks: 84, redemptions: 29 },
  'CIN-005': { clicks: 70, redemptions: 22 },
  'ROP-001': { clicks: 130, redemptions: 35 },
  'ROP-002': { clicks: 92, redemptions: 21 },
  'ROP-003': { clicks: 115, redemptions: 31 },
  'ROP-004': { clicks: 64, redemptions: 12 },
  'ROP-005': { clicks: 78, redemptions: 17 },
  'ONL-001': { clicks: 290, redemptions: 112 },
  'ONL-002': { clicks: 175, redemptions: 49 },
  'ONL-003': { clicks: 140, redemptions: 36 },
  'ONL-004': { clicks: 105, redemptions: 28 },
  'ONL-005': { clicks: 85, redemptions: 19 }
};

let offerMetrics = JSON.parse(JSON.stringify(baselineOfferMetrics));

function getOfferMetric(id) {
  if (!id) return { clicks: 0, redemptions: 0 };
  const key = String(id);
  if (!offerMetrics[key]) {
    offerMetrics[key] = { clicks: 0, redemptions: 0 };
  }
  return offerMetrics[key];
}

async function calculatePromotionMetrics() {
  const data = await fetchOffersData();
  const offers = (data && data.ofertas) ? data.ofertas : [];

  let totalClicks = 0;
  let totalRedemptions = 0;
  const categoryAgg = {};

  const enrichedOffers = offers.map(offer => {
    const metric = getOfferMetric(offer.id || offer.id_offer);
    const clicks = metric.clicks || 0;
    const redemptions = metric.redemptions || 0;
    const conversionRate = clicks > 0
      ? parseFloat(((redemptions / clicks) * 100).toFixed(2))
      : 0;

    totalClicks += clicks;
    totalRedemptions += redemptions;

    const cat = (offer.categoria || 'otras').toLowerCase();
    if (!categoryAgg[cat]) {
      categoryAgg[cat] = { categoria: cat, clicks: 0, redemptions: 0 };
    }
    categoryAgg[cat].clicks += clicks;
    categoryAgg[cat].redemptions += redemptions;

    return {
      ...offer,
      clicks,
      redemptions,
      conversionRate
    };
  });

  // Identificación de destacados e indicadores comparativos para decisiones de negocio
  let mostClicked = null;
  let mostRedeemed = null;
  let bestConversion = null;

  if (enrichedOffers.length > 0) {
    mostClicked = [...enrichedOffers].sort((a, b) => b.clicks - a.clicks)[0];
    mostRedeemed = [...enrichedOffers].sort((a, b) => b.redemptions - a.redemptions)[0];

    // Para la mejor tasa de conversión, considerar promociones con volumen representativo (clicks >= 5)
    const validCandidates = enrichedOffers.filter(o => o.clicks >= 5);
    const pool = validCandidates.length > 0 ? validCandidates : enrichedOffers;
    bestConversion = [...pool].sort((a, b) => b.conversionRate - a.conversionRate)[0];
  }

  const categoryStats = Object.values(categoryAgg).map(cat => ({
    ...cat,
    conversionRate: cat.clicks > 0
      ? parseFloat(((cat.redemptions / cat.clicks) * 100).toFixed(2))
      : 0
  })).sort((a, b) => b.redemptions - a.redemptions);

  const globalConversionRate = totalClicks > 0
    ? parseFloat(((totalRedemptions / totalClicks) * 100).toFixed(2))
    : 0;

  return {
    totales: {
      totalClicks,
      totalRedemptions,
      globalConversionRate,
      totalPromociones: enrichedOffers.length
    },
    destacadas: {
      mostClicked: mostClicked ? {
        id: mostClicked.id,
        titulo: mostClicked.titulo,
        categoria: mostClicked.categoria,
        establecimiento: mostClicked.establecimiento,
        clicks: mostClicked.clicks,
        redemptions: mostClicked.redemptions,
        conversionRate: mostClicked.conversionRate
      } : null,
      mostRedeemed: mostRedeemed ? {
        id: mostRedeemed.id,
        titulo: mostRedeemed.titulo,
        categoria: mostRedeemed.categoria,
        establecimiento: mostRedeemed.establecimiento,
        clicks: mostRedeemed.clicks,
        redemptions: mostRedeemed.redemptions,
        conversionRate: mostRedeemed.conversionRate
      } : null,
      bestConversion: bestConversion ? {
        id: bestConversion.id,
        titulo: bestConversion.titulo,
        categoria: bestConversion.categoria,
        establecimiento: bestConversion.establecimiento,
        clicks: bestConversion.clicks,
        redemptions: bestConversion.redemptions,
        conversionRate: bestConversion.conversionRate
      } : null
    },
    categorias: categoryStats,
    ofertas: enrichedOffers
  };
}

// Endpoint para consultar el panel de métricas consolidado de promociones (US-007)
app.get('/api/metricas-promociones', async (req, res) => {
  try {
    const metrics = await calculatePromotionMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Error calculando métricas de promociones: ' + err.message });
  }
});

// Endpoint para registrar dinámicamente interacciones (clic o redención) con una promoción (US-007)
app.post('/api/metricas-promociones/track', (req, res) => {
  const { offerId, action } = req.body;
  if (!offerId) {
    return res.status(400).json({ error: 'offerId es requerido' });
  }

  const metric = getOfferMetric(offerId);
  const normalizedAction = (action || '').toLowerCase();

  if (normalizedAction === 'click' || normalizedAction === 'offer-click' || normalizedAction === 'interaction') {
    metric.clicks = (metric.clicks || 0) + 1;
  } else if (normalizedAction === 'redeem' || normalizedAction === 'offer-redeem' || normalizedAction === 'canje') {
    metric.redemptions = (metric.redemptions || 0) + 1;
  } else {
    metric.clicks = (metric.clicks || 0) + 1;
  }

  const conversionRate = metric.clicks > 0
    ? parseFloat(((metric.redemptions / metric.clicks) * 100).toFixed(2))
    : 0;

  res.json({
    success: true,
    offerId,
    action: normalizedAction,
    clicks: metric.clicks,
    redemptions: metric.redemptions,
    conversionRate
  });
});

// Endpoint para reiniciar métricas al estado inicial (útil para pruebas demo)
app.post('/api/metricas-promociones/reset', (req, res) => {
  offerMetrics = JSON.parse(JSON.stringify(baselineOfferMetrics));
  res.json({ success: true, message: 'Métricas reiniciadas al valor base' });
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
