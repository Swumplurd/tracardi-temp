const http = require('http');

/**
 * Cliente simple de Tracardi para Node.js / Express / NestJS / Fastify
 */
class TracardiClient {
  constructor(options = {}) {
    this.apiHost = options.apiHost || 'http://localhost:8686';
    this.sourceId = options.sourceId || 'demo-source';
  }

  /**
   * Envia eventos vía REST /track
   */
  async track({ eventType, profileId, sessionId, properties = {} }) {
    const payload = {
      source: { id: this.sourceId },
      session: { id: sessionId || `node-sess-${Date.now()}` },
      profile: profileId ? { id: profileId } : null,
      events: [
        {
          type: eventType,
          properties: properties
        }
      ]
    };

    return this._post('/track', payload);
  }

  /**
   * Envia eventos de Webhook vía /collect (para fuentes de tipo webhook)
   */
  async collectWebhook({ eventType, sourceId = 'demo-webhook-source', sessionId, properties = {} }) {
    const sessId = sessionId || `wh-sess-${Date.now()}`;
    const path = `/collect/${encodeURIComponent(eventType)}/${encodeURIComponent(sourceId)}/${encodeURIComponent(sessId)}`;
    return this._post(path, { properties });
  }

  _post(path, bodyData) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.apiHost}${path}`);
      const dataStr = JSON.stringify(bodyData);

      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataStr)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        });
      });

      req.on('error', reject);
      req.write(dataStr);
      req.end();
    });
  }
}

// Ejemplo de Ejecución Directa
if (require.main === module) {
  const tracardi = new TracardiClient();
  
  console.log('📡 Enviando evento desde Node.js backend...');
  tracardi.track({
    eventType: 'user-registered',
    sessionId: 'sess-node-101',
    properties: {
      user_id: 'usr_888',
      email: 'carlos.backend@example.com',
      signup_method: 'Google OAuth',
      timestamp: new Date().toISOString()
    }
  }).then(response => {
    console.log('✅ Respuesta de Tracardi:', JSON.stringify(response, null, 2));
  }).catch(err => console.error('❌ Error:', err));
}

module.exports = TracardiClient;
