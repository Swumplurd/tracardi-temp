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
  loadOfertas();
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

// ==========================================
// SECCIÓN: DEMO OFERTAS & DETALLE DE OFERTA
// ==========================================

let ofertasList = [];
let activeOfertaCategory = 'all';

// Cargar catálogo de ofertas desde la API
async function loadOfertas() {
  const countBadge = document.getElementById('ofertas-count-badge');
  try {
    const res = await fetch('/api/ofertas');
    if (!res.ok) throw new Error(`HTTP ${res.status} al cargar /api/ofertas`);
    const data = await res.json();
    ofertasList = data.ofertas || [];
    renderOfertas();
  } catch (err) {
    console.warn('Fallo cargando /api/ofertas, intentando fallback /ofertas.json:', err);
    try {
      const fallbackRes = await fetch('/ofertas.json');
      if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status} al cargar /ofertas.json`);
      const fallbackData = await fallbackRes.json();
      ofertasList = fallbackData.ofertas || [];
      renderOfertas();
    } catch (e2) {
      console.error('Error total al cargar ofertas:', e2);
      if (countBadge) countBadge.textContent = 'Error cargando ofertas';
      showToast('❌ No se pudo cargar el catálogo de ofertas', 'error');
    }
  }
}

// Filtrar ofertas por categoría
function filterOfertas(category) {
  activeOfertaCategory = category;

  // Actualizar estado activo en botones de filtro
  document.querySelectorAll('.oferta-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-category') === category) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderOfertas();

  // Rastrear filtro en Tracardi
  trackOfertaEvent('category-filter', {
    category: category,
    filter_time: new Date().toISOString()
  }, false);
}

// Renderizar la lista de ofertas según el filtro activo
function renderOfertas() {
  const grid = document.getElementById('ofertas-grid');
  const countBadge = document.getElementById('ofertas-count-badge');
  if (!grid) return;

  const filtered = activeOfertaCategory === 'all'
    ? ofertasList
    : ofertasList.filter(o => o.categoria.toLowerCase() === activeOfertaCategory.toLowerCase());

  if (countBadge) {
    countBadge.textContent = `Mostrando ${filtered.length} ofertas`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem 1rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
        <h3>No se encontraron ofertas</h3>
        <p>No hay promociones disponibles en la categoría seleccionada.</p>
        <button class="btn btn-blue" style="margin-top: 1rem;" onclick="filterOfertas('all')">Ver todas las ofertas</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(oferta => {
    const icon = getCategoryIcon(oferta.categoria);
    const catUpper = oferta.categoria.toUpperCase();

    return `
      <div class="oferta-card" data-id="${escapeHtml(oferta.id)}">
        <div class="oferta-card-header">
          <span class="oferta-badge-cat cat-${escapeHtml(oferta.categoria)}">${icon} ${catUpper}</span>
          <span class="oferta-badge-discount">-${oferta.descuento_porcentaje}% OFF</span>
        </div>

        <h3 class="oferta-card-title">${escapeHtml(oferta.titulo)}</h3>

        <div class="oferta-store">
          <span class="store-icon">🏪</span>
          <span class="store-name">${escapeHtml(oferta.establecimiento)}</span>
        </div>

        <p class="oferta-summary">${escapeHtml(oferta.descripcion)}</p>

        <div class="oferta-card-footer">
          <div class="oferta-price-box">
            <span class="oferta-price-current">$${oferta.precio_oferta.toFixed(2)} <small>${escapeHtml(oferta.moneda)}</small></span>
            <span class="oferta-price-original">$${oferta.precio_original.toFixed(2)}</span>
          </div>
          <button class="btn btn-sm btn-blue btn-ver-detalle" onclick="viewOfferDetail('${escapeHtml(oferta.id)}')">
            Ver Detalle →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Ver detalle completo de una oferta seleccionada
function viewOfferDetail(offerId) {
  const oferta = ofertasList.find(o => o.id === offerId);
  if (!oferta) {
    showToast('Oferta no encontrada', 'error');
    return;
  }

  const catalogView = document.getElementById('ofertas-catalog-view');
  const detailView = document.getElementById('ofertas-detail-view');
  const detailCard = document.getElementById('oferta-detail-card');

  if (catalogView && detailView && detailCard) {
    catalogView.style.display = 'none';
    detailView.style.display = 'block';

    const icon = getCategoryIcon(oferta.categoria);
    const ahorro = (oferta.precio_original - oferta.precio_oferta).toFixed(2);

    detailCard.innerHTML = `
      <div class="detail-header-section">
        <div class="detail-top-badges">
          <span class="oferta-badge-cat cat-${escapeHtml(oferta.categoria)}">${icon} ${escapeHtml(oferta.categoria.toUpperCase())}</span>
          <span class="oferta-badge-discount">-${oferta.descuento_porcentaje}% DESCUENTO</span>
          <span class="badge badge-purple">ID: ${escapeHtml(oferta.id)}</span>
        </div>
        <h1 class="detail-title">${escapeHtml(oferta.titulo)}</h1>
        <div class="detail-store">
          <span class="store-icon">🏪</span>
          <span class="store-name">Establecimiento: <strong>${escapeHtml(oferta.establecimiento)}</strong></span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="detail-body-grid">
        <div class="detail-main-info">
          <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem; color: var(--text-main);">Descripción de la Promoción</h3>
          <p class="detail-description">${escapeHtml(oferta.descripcion)}</p>

          <div class="detail-meta-grid">
            <div class="meta-item">
              <span class="meta-label">🏷️ Tipo de Oferta</span>
              <span class="meta-value">${escapeHtml(oferta.tipo_oferta)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">📅 Fecha de Expiración</span>
              <span class="meta-value">${escapeHtml(oferta.fecha_expiracion)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">💳 Moneda</span>
              <span class="meta-value">${escapeHtml(oferta.moneda)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">📉 Ahorro Total</span>
              <span class="meta-value" style="color: var(--accent-green);">
                $${ahorro} (${oferta.descuento_porcentaje}%)
              </span>
            </div>
          </div>

          <!-- Cupón de descuento -->
          <div class="coupon-box">
            <div class="coupon-info">
              <span class="coupon-label">🎟️ CÓDIGO DE CUPÓN EXCLUSIVO</span>
              <div class="coupon-code" id="active-coupon-code">${escapeHtml(oferta.codigo_cupon)}</div>
            </div>
            <button class="btn btn-amber btn-copy-coupon" onclick="copyCouponCode('${escapeHtml(oferta.codigo_cupon)}')">
              📋 Copiar Cupón
            </button>
          </div>
        </div>

        <!-- Sidebar de Precios y Acción -->
        <div class="detail-price-sidebar">
          <div class="price-highlight-card">
            <div class="price-header-label">Precio Especial Demo</div>
            <div class="price-main-display">
              $${oferta.precio_oferta.toFixed(2)}
              <span class="price-currency">${escapeHtml(oferta.moneda)}</span>
            </div>
            <div class="price-original-display">
              Precio regular: <del>$${oferta.precio_original.toFixed(2)} ${escapeHtml(oferta.moneda)}</del>
            </div>
            <div class="price-savings-tag">
              ✨ ¡Ahorras $${ahorro} USD!
            </div>

            <div class="divider" style="margin: 1.2rem 0;"></div>

            <button class="btn btn-green btn-full-width" onclick="trackOfferInteraction('${escapeHtml(oferta.id)}', 'offer-redeem')">
              ⚡ Simular Canje de Oferta (Track)
            </button>
          </div>
        </div>
      </div>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trackear evento en Tracardi
    trackOfertaEvent('offer-view', {
      offer_id: oferta.id,
      title: oferta.titulo,
      category: oferta.categoria,
      store: oferta.establecimiento,
      price_original: oferta.precio_original,
      price_offer: oferta.precio_oferta,
      discount_percentage: oferta.descuento_porcentaje,
      coupon_code: oferta.codigo_cupon,
      expiration_date: oferta.fecha_expiracion,
      offer_type: oferta.tipo_oferta
    }, true);
  }
}

// Regresar al catálogo principal desde la vista de detalle
function backToCatalog() {
  const catalogView = document.getElementById('ofertas-catalog-view');
  const detailView = document.getElementById('ofertas-detail-view');
  if (catalogView && detailView) {
    detailView.style.display = 'none';
    catalogView.style.display = 'block';
  }
}

// Copiar código de cupón
function copyCouponCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast(`📋 Cupón '${code}' copiado al portapapeles!`, 'success');
  }).catch(() => {
    showToast(`Cupón: ${code}`);
  });
}

// Helper para enviar eventos de ofertas a Tracardi
async function trackOfertaEvent(eventType, properties = {}, showNotification = true) {
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

  const payloadBlock = document.getElementById('payload-json');
  if (payloadBlock) {
    payloadBlock.textContent = JSON.stringify(payload, null, 2);
  }

  try {
    const res = await fetch(`${TRACARDI_API}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.profile && result.profile.id) {
      currentProfileId = result.profile.id;
      localStorage.setItem('tracardi_profile_id', currentProfileId);
      const profInput = document.getElementById('profile-id');
      if (profInput) profInput.value = currentProfileId;
    }

    const respBlock = document.getElementById('response-json');
    if (respBlock) {
      respBlock.textContent = JSON.stringify(result, null, 2);
    }

    addLogHistory(eventType, result);

    if (showNotification) {
      showToast(`🎯 Evento '${eventType}' registrado en Tracardi!`, 'success');
    }
  } catch (err) {
    console.log(`Error enviando evento ${eventType} a Tracardi:`, err.message);
  }
}

// Simular interacción o canje de oferta
function trackOfferInteraction(offerId, actionType) {
  const oferta = ofertasList.find(o => o.id === offerId);
  if (!oferta) return;

  trackOfertaEvent(actionType || 'offer-redeem', {
    offer_id: oferta.id,
    title: oferta.titulo,
    category: oferta.categoria,
    store: oferta.establecimiento,
    price: oferta.precio_oferta,
    coupon: oferta.codigo_cupon,
    redeemed_at: new Date().toISOString()
  }, true);

  showToast(`🎉 ¡Oferta '${oferta.titulo}' canjeada en simulación!`, 'success');
}

// Helpers de utilidades
function getCategoryIcon(cat) {
  const icons = {
    comida: '🍔',
    electronica: '💻',
    cine: '🎬',
    ropa: '👕',
    online: '🌐'
  };
  return icons[cat ? cat.toLowerCase() : ''] || '🏷️';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
