// Configuration
const TRACARDI_API = 'http://localhost:8686';
const SOURCE_ID = 'demo-source';

// Local State
let currentSessionId = localStorage.getItem('tracardi_session_id');
if (!currentSessionId) {
  currentSessionId = 'sess_' + Math.random().toString(36).substring(2, 10);
  localStorage.setItem('tracardi_session_id', currentSessionId);
}

let currentProfileId = localStorage.getItem('tracardi_profile_id') || '';
let eventHistory = [];

// Personas Predefinidas
const personas = {
  ana: { name: 'Ana Lopez', email: 'ana.lopez@ejemplo.com', role: 'Cliente SaaS' },
  carlos: { name: 'Carlos Gomez', email: 'carlos.gomez' }
};

// DOM Initializer
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('session-id').value = currentSessionId;
  document.getElementById('profile-id').value = currentProfileId || 'Se generará al enviar el 1er evento';
  
  initTabs();
  checkHealth();
});

// Check Server & Tracardi Health
async function checkHealth() {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');

  try {
    const res = await fetch('/api/health');
    const data = await res.json();

    if (data.tracardiStatus === 'online') {
      indicator.className = 'status-indicator online';
      statusText.textContent = 'Tracardi Activo (Puerto 8686)';
    } else {
      indicator.className = 'status-indicator warning';
      statusText.textContent = 'Tracardi Offline';
    }
  } catch (e) {
    indicator.className = 'status-indicator warning';
    statusText.textContent = 'Servidor Demo Offline';
  }
}

// Navigation Tabs Handler
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

// Persona Selector
function selectPersona(key) {
  document.querySelectorAll('.persona-chip').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');

  const p = personas[key];
  document.getElementById('user-name').value = p.name;
  document.getElementById('user-email').value = p.email;
  showToast(`Persona cargada: ${p.name || 'Anónimo'}`);
}

// Inspector View Tabs (Payload / Response / History)
function switchInspTab(tabName) {
  document.querySelectorAll('.insp-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.insp-view').forEach(v => v.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById(`insp-${tabName}-view`).classList.add('active');
}

// Main Function: Trigger Tracardi Event from Frontend
async function triggerEvent(eventType) {
  const userName = document.getElementById('user-name').value;
  const userEmail = document.getElementById('user-email').value;

  let properties = {};

  // Building Event Properties based on type
  switch (eventType) {
    case 'page-view':
      properties = {
        title: 'Demo Interactive Store & SaaS',
        url: window.location.href,
        path: window.location.pathname,
        referrer: 'https://google.com'
      };
      break;

    case 'user-identify':
      properties = {
        name: userName || 'Usuario Anónimo',
        email: userEmail || 'sin-email@ejemplo.com',
        identified_at: new Date().toISOString()
      };
      break;

    case 'add-to-cart':
      properties = {
        product_id: 'prod_macbook_pro',
        name: 'MacBook Pro M3 Max 16"',
        category: 'Laptops',
        price: 3499.00,
        currency: 'USD'
      };
      break;

    case 'purchase':
      properties = {
        order_id: 'ORD-' + Math.floor(Math.random() * 100000),
        total_amount: 3499.00,
        currency: 'USD',
        items_count: 1,
        payment_method: 'Credit Card'
      };
      break;

    case 'lead-signup':
      properties = {
        form_name: 'Boletín Semanal de Tecnología',
        email: userEmail || 'lead@ejemplo.com',
        source: 'Landing Demo'
      };
      break;

    case 'custom-event':
      properties = {
        action: 'theme_changed',
        theme: 'dark_neon',
        interaction_count: Math.floor(Math.random() * 50) + 1
      };
      break;
  }

  // Construct standard Tracardi REST Tracker Payload
  const payload = {
    source: { id: SOURCE_ID },
    session: { id: currentSessionId },
    profile: currentProfileId ? { id: currentProfileId } : null,
    events: [
      {
        type: eventType,
        properties: properties
      }
    ]
  };

  // Update Inspector Payload Tab immediately
  document.getElementById('payload-json').textContent = JSON.stringify(payload, null, 2);

  try {
    const res = await fetch(`${TRACARDI_API}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    // Store Profile ID if returned
    if (result.profile && result.profile.id) {
      currentProfileId = result.profile.id;
      localStorage.setItem('tracardi_profile_id', currentProfileId);
      document.getElementById('profile-id').value = currentProfileId;
    }

    // Update Inspector Response Tab
    document.getElementById('response-json').textContent = JSON.stringify(result, null, 2);

    // Add to History
    addLogHistory(eventType, result);

    showToast(`✅ Evento '${eventType}' registrado con éxito en Tracardi!`, 'success');
  } catch (err) {
    document.getElementById('response-json').textContent = `Error enviando evento: ${err.message}`;
    showToast(`❌ Error al conectar con Tracardi API`, 'error');
  }
}

// Log History
function addLogHistory(eventType, result) {
  eventHistory.unshift({
    type: eventType,
    time: new Date().toLocaleTimeString(),
    taskId: result.task || 'N/A',
    profileId: result.profile ? result.profile.id : 'N/A'
  });

  document.getElementById('event-count').textContent = eventHistory.length;

  const logList = document.getElementById('log-list');
  logList.innerHTML = eventHistory.map(item => `
    <div class="log-item success">
      <div>
        <strong>${item.type}</strong>
        <small style="display:block; color:#94a3b8;">Task: ${item.taskId.substring(0, 8)}... | Profile: ${item.profileId.substring(0, 8)}...</small>
      </div>
      <span class="time">${item.time}</span>
    </div>
  `).join('');
}

function clearLogs() {
  eventHistory = [];
  document.getElementById('event-count').textContent = '0';
  document.getElementById('log-list').innerHTML = '<div class="empty-state">No se han enviado eventos aún.</div>';
  showToast('Logs limpiados');
}

// Backend Tests
async function testBackendTrack() {
  showToast('Enviando evento desde Node.js Backend...');
  const res = await fetch('/api/track-backend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'server-subscription-update',
      sessionId: currentSessionId,
      profileId: currentProfileId,
      properties: {
        server_event: 'plan_upgraded',
        new_plan: 'Enterprise VIP',
        billing_cycle: 'yearly'
      }
    })
  });
  const data = await res.json();
  document.getElementById('backend-status-label').textContent = 'POST /api/track-backend -> Tracardi /track';
  document.getElementById('backend-response-json').textContent = JSON.stringify(data, null, 2);
  showToast('✅ Respuesta recibida del servidor Node.js', 'success');
}

async function testWebhookTrack() {
  showToast('Simulando Webhook de Pago...');
  const res = await fetch('/api/webhook-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'payment-succeeded',
      sessionId: currentSessionId,
      properties: {
        provider: 'Stripe Webhook',
        charge_id: 'ch_3Mv' + Math.floor(Math.random() * 10000),
        amount: 299.00,
        status: 'succeeded'
      }
    })
  });
  const data = await res.json();
  document.getElementById('backend-status-label').textContent = 'POST /api/webhook-event -> Tracardi /collect';
  document.getElementById('backend-response-json').textContent = JSON.stringify(data, null, 2);
  showToast('✅ Webhook procesado exitosamente por Tracardi', 'success');
}

// Code Snippets Tab Switcher
function switchSnippet(key) {
  document.querySelectorAll('.snip-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.snip-view').forEach(v => v.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById(`snip-${key}`).classList.add('active');
}

// Copy Code to Clipboard
function copyCode(elementId) {
  const text = document.getElementById(elementId).textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Código copiado al portapapeles!');
  });
}

// Toast Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}
