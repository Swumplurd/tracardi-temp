const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TRACARDI_API = process.env.TRACARDI_API || 'http://localhost:8686';

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
    tracardiStatus: tracardiHealth.statusCode === 200 ? 'online' : 'offline',
    timestamp: new Date().toISOString()
  });
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
  console.log(`📡 Tracardi API Endpoint: http://localhost:8686`);
  console.log('======================================================\n');
});
