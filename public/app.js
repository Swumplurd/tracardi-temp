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
let currentGeoRegion = localStorage.getItem('tracardi_geo_region') || '';
let currentInterests = {};
try {
  const savedInterests = localStorage.getItem('tracardi_profile_interests');
  if (savedInterests) {
    currentInterests = JSON.parse(savedInterests);
  }
} catch (e) {
  currentInterests = {};
}

let eventHistory = [];

// Personas Predefinidas
const personas = {
  ana: { name: 'Ana Lopez', email: 'ana.lopez@ejemplo.com', role: 'Cliente SaaS' },
  carlos: { name: 'Carlos Gomez', email: 'carlos.gomez@ejemplo.com', role: 'Cliente VIP' },
  anon: { name: '', email: '', role: 'Anónimo' }
};

// DOM Initializer
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('session-id').value = currentSessionId;
  document.getElementById('profile-id').value = currentProfileId || 'Se generará al enviar el 1er evento';
  
  updateGeoRegionUI(currentGeoRegion);
  checkGeoConsentModal();
  initTabs();
  checkHealth();
  updateProfileInterests(currentInterests);
  loadOfertas();
  loadAndRenderMetricas();
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
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
      if (targetId === 'ofertas-tab') {
        renderOfertas();
      }
      if (targetId === 'metricas-tab') {
        loadAndRenderMetricas();
      }
    });
  });
}

// Control de visibilidad del modal de consentimiento según el estado regional del perfil (US-005)
function checkGeoConsentModal() {
  const modal = document.getElementById('geo-consent-modal');
  if (!modal) return;
  if (currentGeoRegion) {
    modal.classList.add('modal-hidden');
  } else {
    modal.classList.remove('modal-hidden');
  }
}

// Actualizar indicador y campo de ubicación regional en el formulario de perfil
function updateGeoRegionUI(regionCode) {
  const input = document.getElementById('user-geo-region');
  if (input) {
    input.value = regionCode || '';
    input.placeholder = regionCode ? regionCode : 'Sin ubicación registrada';
  }
}

// Persona Selector
function selectPersona(key) {
  document.querySelectorAll('.persona-chip').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');

  const p = personas[key] || { name: '', email: '' };
  document.getElementById('user-name').value = p.name;
  document.getElementById('user-email').value = p.email;
  
  currentSessionId = 'sess_' + key + '_' + Math.random().toString(36).substring(2, 7);
  localStorage.setItem('tracardi_session_id', currentSessionId);
  document.getElementById('session-id').value = currentSessionId;

  currentProfileId = '';
  localStorage.removeItem('tracardi_profile_id');
  document.getElementById('profile-id').value = 'Se generará al enviar el 1er evento';
  
  currentInterests = {};
  localStorage.removeItem('tracardi_profile_interests');
  updateProfileInterests({});

  currentGeoRegion = '';
  localStorage.removeItem('tracardi_geo_region');
  updateGeoRegionUI('');
  checkGeoConsentModal();
  renderOfertas();

  showToast(`Persona cargada: ${p.name || 'Anónimo'}`);
}

// Establecer o alternar manualmente la región geográfica (US-006)
function setManualGeoRegion(regionCode) {
  currentGeoRegion = regionCode || '';
  if (currentGeoRegion) {
    localStorage.setItem('tracardi_geo_region', currentGeoRegion);
    showToast(`📍 Ubicación regional establecida: ${currentGeoRegion}`, 'info');
  } else {
    localStorage.removeItem('tracardi_geo_region');
    showToast('🌐 Ubicación regional reiniciada (Mostrando todas las ofertas)', 'info');
  }
  updateGeoRegionUI(currentGeoRegion);
  checkGeoConsentModal();
  renderOfertas();
}

// Helper para obtener puntaje de interés normalizado por categoría
function getInterestScore(category) {
  if (!currentInterests || typeof currentInterests !== 'object') return 0;
  const cat = (category || '').toLowerCase().trim();
  for (const [key, val] of Object.entries(currentInterests)) {
    if (key.toLowerCase().trim() === cat) {
      const num = typeof val === 'number' ? val : parseFloat(val);
      return isNaN(num) ? 0 : num;
    }
  }
  return 0;
}

// Renderizar intereses del perfil en la UI y sincronizar catálogo
function updateProfileInterests(interests) {
  currentInterests = (interests && typeof interests === 'object') ? interests : {};
  try {
    if (Object.keys(currentInterests).length > 0) {
      localStorage.setItem('tracardi_profile_interests', JSON.stringify(currentInterests));
    } else {
      localStorage.removeItem('tracardi_profile_interests');
    }
  } catch (e) {}

  const container = document.getElementById('profile-interests-container');
  if (container) {
    if (Object.keys(currentInterests).length === 0) {
      container.innerHTML = '<span class="interests-empty">Sin intereses registrados aún</span>';
    } else {
      const entries = Object.entries(currentInterests);
      container.innerHTML = entries.map(([key, val]) => {
        const icon = getCategoryIcon(key);
        const score = typeof val === 'number' ? val.toFixed(1) : escapeHtml(val);
        return `
          <span class="interest-tag" title="Interés: ${escapeHtml(key)} (${score})">
            <span>${icon} ${escapeHtml(key)}</span>
            <span class="interest-score">${score}</span>
          </span>
        `;
      }).join('');
    }
  }

  // Refrescar catálogo de ofertas para reflejar inmediatamente el nuevo orden y filtrado
  if (ofertasList && ofertasList.length > 0) {
    renderOfertas();
  }
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

    // Store Profile ID and Interests if returned
    if (result.profile) {
      if (result.profile.id) {
        currentProfileId = result.profile.id;
        localStorage.setItem('tracardi_profile_id', currentProfileId);
        document.getElementById('profile-id').value = currentProfileId;
      }
      if (result.profile.interests !== undefined) {
        updateProfileInterests(result.profile.interests);
      }
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
  if (data.tracardiResponse && data.tracardiResponse.profile) {
    if (data.tracardiResponse.profile.id) {
      currentProfileId = data.tracardiResponse.profile.id;
      localStorage.setItem('tracardi_profile_id', currentProfileId);
      const profInput = document.getElementById('profile-id');
      if (profInput) profInput.value = currentProfileId;
    }
    if (data.tracardiResponse.profile.interests !== undefined) {
      updateProfileInterests(data.tracardiResponse.profile.interests);
    }
  }
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

// Helper para verificar si una oferta coincide con la región geográfica activa (US-006)
function isOfferEligibleForRegion(oferta, userRegion) {
  // Si no hay región de usuario registrada / no hay consentimiento, todas las ofertas son elegibles
  if (!userRegion || typeof userRegion !== 'string' || userRegion.trim() === '') {
    return true;
  }
  // Si la oferta no tiene entidad federativa (null / undefined / vacía), es de cobertura nacional
  if (!oferta.entidad_federativa || (typeof oferta.entidad_federativa === 'string' && oferta.entidad_federativa.trim() === '')) {
    return true;
  }
  // Si tiene entidad federativa, debe coincidir exactamente (case-insensitive) con la región del usuario
  return String(oferta.entidad_federativa).trim().toUpperCase() === userRegion.trim().toUpperCase();
}

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
    console.warn('Fallo cargando /api/ofertas, intentando fallback directo a http://localhost:1337/api/offers:', err);
    try {
      const fallbackRes = await fetch('http://localhost:1337/api/offers?pagination[pageSize]=100');
      if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status} al cargar API directa de ofertas`);
      const fallbackData = await fallbackRes.json();
      const rawOffers = Array.isArray(fallbackData.data) ? fallbackData.data : (fallbackData.ofertas || []);
      ofertasList = rawOffers.map(item => {
        const entidadFederativa = item.entidad_federativa !== undefined
          ? item.entidad_federativa
          : (item.attributes && item.attributes.entidad_federativa !== undefined ? item.attributes.entidad_federativa : null);
        return {
          ...item,
          id: item.id_offer || item.documentId || String(item.id),
          strapi_id: item.id,
          documentId: item.documentId,
          id_offer: item.id_offer || item.id,
          entidad_federativa: entidadFederativa || null,
          precio_original: typeof item.precio_original === 'number' ? item.precio_original : parseFloat(item.precio_original) || 0,
          precio_oferta: typeof item.precio_oferta === 'number' ? item.precio_oferta : parseFloat(item.precio_oferta) || 0,
          descuento_porcentaje: typeof item.descuento_porcentaje === 'number' ? item.descuento_porcentaje : parseInt(item.descuento_porcentaje) || 0
        };
      });
      renderOfertas();
    } catch (e2) {
      console.error('Error total al cargar ofertas:', e2);
      if (countBadge) countBadge.textContent = 'Error cargando ofertas';
      showToast('❌ No se pudo cargar el catálogo de ofertas', 'error');
    }
  }
}

// Mapeo de categoría a evento de segmentación Tracardi
function getCategorySegmentationEvent(category) {
  const map = {
    comida: 'comida-seg',
    electronica: 'electronica-seg',
    cine: 'cine-seg',
    ropa: 'ropa-seg',
    online: 'online-seg'
  };
  return map[category ? category.toLowerCase() : ''] || null;
}

// Filtrar ofertas por categoría y despachar evento de segmentación
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

  // Rastrear evento de segmentación específico si corresponde a una categoría mapeada
  const segEvent = getCategorySegmentationEvent(category);
  if (segEvent) {
    trackOfertaEvent(segEvent, {
      category: category,
      action: 'category_filter',
      filter_time: new Date().toISOString()
    }, true);
  } else {
    trackOfertaEvent('category-filter', {
      category: category,
      filter_time: new Date().toISOString()
    }, false);
  }
}

// Renderizar la lista de ofertas según el filtro regional (US-006), categoría y afinidad de intereses (US-003)
function renderOfertas() {
  const grid = document.getElementById('ofertas-grid');
  const countBadge = document.getElementById('ofertas-count-badge');
  if (!grid) return;

  // 1. Filtrado Regional (US-006):
  // Si el usuario tiene ubicación regional registrada/compartida: mostrar solo las ofertas de su región y las nacionales (null).
  // Si no compartió ubicación o no hay región registrada: mostrar todas las ofertas disponibles sin exclusión regional.
  const regionEligibleOffers = ofertasList.filter(o => isOfferEligibleForRegion(o, currentGeoRegion));

  let filtered = [];

  if (activeOfertaCategory === 'all') {
    // En la vista general "Todas":
    // 1. Excluir ofertas cuya categoría tenga interés <= 1 o no figure en los intereses (US-003)
    // 2. Ordenar descendentemente según el peso de interés del usuario (mayor interés primero)
    filtered = regionEligibleOffers
      .filter(o => getInterestScore(o.categoria) > 1)
      .sort((a, b) => {
        const scoreA = getInterestScore(a.categoria);
        const scoreB = getInterestScore(b.categoria);
        return scoreB - scoreA;
      });

    if (countBadge) {
      countBadge.textContent = filtered.length > 0
        ? `Mostrando ${filtered.length} ofertas personalizadas${currentGeoRegion ? ` (📍 ${currentGeoRegion})` : ''}`
        : `0 ofertas personalizadas${currentGeoRegion ? ` (📍 ${currentGeoRegion})` : ''}`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state personalized-empty-state" style="grid-column: 1 / -1; padding: 3rem 1.5rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🎯</div>
          <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem; color: var(--text-main);">Sin recomendaciones personalizadas aún</h3>
          <p style="color: var(--text-muted); max-width: 550px; margin: 0 auto 1.5rem auto; line-height: 1.5;">
            En la vista general solo priorizamos ofertas según tus intereses registrados (afinidad &gt; 1.0)${currentGeoRegion ? ` y aplicables a tu región (${currentGeoRegion}) o de cobertura nacional` : ''}.
            Explora las categorías específicas o interactúa con ofertas para que Tracardi registre tus preferencias en tiempo real.
          </p>
          <div class="quick-category-suggestions" style="display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-sm btn-outline" onclick="filterOfertas('comida')">🍔 Comida</button>
            <button class="btn btn-sm btn-outline" onclick="filterOfertas('electronica')">💻 Electrónica</button>
            <button class="btn btn-sm btn-outline" onclick="filterOfertas('cine')">🎬 Cine</button>
            <button class="btn btn-sm btn-outline" onclick="filterOfertas('ropa')">👕 Ropa</button>
            <button class="btn btn-sm btn-outline" onclick="filterOfertas('online')">🌐 Online</button>
          </div>
        </div>
      `;
      return;
    }
  } else {
    // Al filtrar por una categoría específica: mostrar todas las ofertas de la categoría que cumplan con la región
    filtered = regionEligibleOffers.filter(o => o.categoria.toLowerCase() === activeOfertaCategory.toLowerCase());

    if (countBadge) {
      countBadge.textContent = `Mostrando ${filtered.length} ofertas${currentGeoRegion ? ` (📍 ${currentGeoRegion})` : ''}`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem 1rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <h3>No se encontraron ofertas</h3>
          <p>No hay promociones disponibles en la categoría seleccionada${currentGeoRegion ? ` para tu región (${currentGeoRegion})` : ''}.</p>
          <button class="btn btn-blue" style="margin-top: 1rem;" onclick="filterOfertas('all')">Ver todas las ofertas</button>
        </div>
      `;
      return;
    }
  }

  grid.innerHTML = filtered.map(oferta => {
    const icon = getCategoryIcon(oferta.categoria);
    const catUpper = oferta.categoria.toUpperCase();
    const score = getInterestScore(oferta.categoria);
    const regionBadge = oferta.entidad_federativa
      ? `<span class="badge-region" title="Oferta exclusiva para región ${escapeHtml(oferta.entidad_federativa)}">📍 ${escapeHtml(oferta.entidad_federativa)}</span>`
      : `<span class="badge-national" title="Oferta de cobertura nacional">🌐 Nacional</span>`;

    return `
      <div class="oferta-card" data-id="${escapeHtml(oferta.id)}" onclick="viewOfferDetail('${escapeHtml(oferta.id)}')">
        <div class="oferta-card-header">
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span class="oferta-badge-cat cat-${escapeHtml(oferta.categoria)}">${icon} ${catUpper}</span>
            ${regionBadge}
            ${score > 1 ? `<span class="interest-tag" style="padding: 0.15rem 0.5rem; font-size: 0.72rem;" title="Afinidad de interés: ${score.toFixed(1)}">🎯 ${score.toFixed(1)}</span>` : ''}
          </div>
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
          <button class="btn btn-sm btn-blue btn-ver-detalle" onclick="event.stopPropagation(); viewOfferDetail('${escapeHtml(oferta.id)}')">
            Ver Detalle →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Ver detalle completo de una oferta seleccionada
function viewOfferDetail(offerId) {
  const oferta = ofertasList.find(o =>
    String(o.id) === String(offerId) ||
    String(o.id_offer) === String(offerId) ||
    String(o.documentId) === String(offerId) ||
    String(o.strapi_id) === String(offerId)
  );
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
    const score = getInterestScore(oferta.categoria);
    const regionBadge = oferta.entidad_federativa
      ? `<span class="badge-region" title="Oferta exclusiva para región ${escapeHtml(oferta.entidad_federativa)}">📍 ${escapeHtml(oferta.entidad_federativa)}</span>`
      : `<span class="badge-national" title="Oferta de cobertura nacional">🌐 Cobertura Nacional</span>`;

    detailCard.innerHTML = `
      <div class="detail-header-section">
        <div class="detail-top-badges">
          <span class="oferta-badge-cat cat-${escapeHtml(oferta.categoria)}">${icon} ${escapeHtml(oferta.categoria.toUpperCase())}</span>
          ${regionBadge}
          ${score > 1 ? `<span class="interest-tag" style="padding: 0.2rem 0.6rem; font-size: 0.8rem;">🎯 Afinidad: ${score.toFixed(1)}</span>` : ''}
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
              <span class="meta-label">📍 Cobertura / Región</span>
              <span class="meta-value">${oferta.entidad_federativa ? escapeHtml(oferta.entidad_federativa) + ' (Regional)' : 'Nacional (Todo el país)'}</span>
            </div>
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

            <div id="redeem-feedback-container"></div>

            <button id="btn-redeem-offer" class="btn btn-green btn-full-width" onclick="openRedeemModal('${escapeHtml(oferta.id)}')">
              🎟️ Canjear Promoción (Redimir Cupón)
            </button>
          </div>
        </div>
      </div>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Datos de interacción con la oferta (US-007)
    const offerInteractionData = {
      id: oferta.id,
      offer_id: oferta.id,
      title: oferta.titulo,
      category: oferta.categoria,
      entidad_federativa: oferta.entidad_federativa || null,
      store: oferta.establecimiento,
      price_original: oferta.precio_original,
      price: oferta.precio_oferta,
      price_offer: oferta.precio_oferta,
      discount_percentage: oferta.descuento_porcentaje,
      coupon_code: oferta.codigo_cupon,
      expiration_date: oferta.fecha_expiracion,
      offer_type: oferta.tipo_oferta,
      action: 'offer_click'
    };

    // Emitir evento 'offer-click' hacia Tracardi CDP (US-007)
    trackOfertaEvent('offer-click', offerInteractionData, true);

    // Mantener sincronización con 'offer-view' para perfiles de interés (US-001/US-003)
    trackOfertaEvent('offer-view', offerInteractionData, false);

    // Registrar interacción de clic en métricas dinámicas de promociones (US-007)
    recordPromotionMetric(oferta.id, 'click');
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

    if (result.profile) {
      if (result.profile.id) {
        currentProfileId = result.profile.id;
        localStorage.setItem('tracardi_profile_id', currentProfileId);
        const profInput = document.getElementById('profile-id');
        if (profInput) profInput.value = currentProfileId;
      }
      if (result.profile.interests !== undefined) {
        updateProfileInterests(result.profile.interests);
      }
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

// ==========================================
// SECCIÓN: MÉTRICAS DE PROMOCIONES (US-007)
// ==========================================

let currentMetricsData = null;
let currentMetricsSort = 'redemptions';
let metricsSearchFilter = '';
let pendingRedeemOfferId = null;

// Modal de confirmación de canje (US-007)
function openRedeemModal(offerId) {
  const oferta = ofertasList.find(o =>
    String(o.id) === String(offerId) ||
    String(o.id_offer) === String(offerId) ||
    String(o.documentId) === String(offerId) ||
    String(o.strapi_id) === String(offerId)
  );
  if (!oferta) {
    showToast('Oferta no encontrada para canje', 'error');
    return;
  }

  pendingRedeemOfferId = oferta.id;

  const modal = document.getElementById('redeem-confirm-modal');
  const titleEl = document.getElementById('redeem-modal-promo-title');
  const storeEl = document.getElementById('redeem-modal-promo-store');
  const couponEl = document.getElementById('redeem-modal-promo-coupon');

  if (titleEl) titleEl.textContent = oferta.titulo;
  if (storeEl) storeEl.textContent = `🏪 ${oferta.establecimiento} • Descuento: -${oferta.descuento_porcentaje}% ($${oferta.precio_oferta.toFixed(2)} ${oferta.moneda})`;
  if (couponEl) couponEl.textContent = oferta.codigo_cupon;

  if (modal) {
    modal.classList.remove('modal-hidden');
  }
}

function closeRedeemModal() {
  const modal = document.getElementById('redeem-confirm-modal');
  if (modal) {
    modal.classList.add('modal-hidden');
  }
  pendingRedeemOfferId = null;
}

// Confirmar y procesar la redención de la oferta con emisión a Tracardi y feedback al usuario (US-007)
async function confirmRedeemAction() {
  if (!pendingRedeemOfferId) {
    closeRedeemModal();
    return;
  }

  const offerId = pendingRedeemOfferId;
  closeRedeemModal();

  const oferta = ofertasList.find(o =>
    String(o.id) === String(offerId) ||
    String(o.id_offer) === String(offerId) ||
    String(o.documentId) === String(offerId) ||
    String(o.strapi_id) === String(offerId)
  );

  if (!oferta) return;

  // 1. Emitir evento 'offer-redeem' a Tracardi con datos comerciales
  await trackOfertaEvent('offer-redeem', {
    id: oferta.id,
    offer_id: oferta.id,
    title: oferta.titulo,
    category: oferta.categoria,
    store: oferta.establecimiento,
    price: oferta.precio_oferta,
    price_original: oferta.precio_original,
    discount_percentage: oferta.descuento_porcentaje,
    coupon: oferta.codigo_cupon,
    coupon_code: oferta.codigo_cupon,
    entidad_federativa: oferta.entidad_federativa || null,
    action: 'offer_redeem',
    redeemed_at: new Date().toISOString()
  }, true);

  // 2. Registrar redención dinámicamente en el backend de métricas
  await recordPromotionMetric(oferta.id, 'redeem');

  // 3. Confirmación visual directa al usuario en la ficha de detalle (si está visible)
  const feedbackContainer = document.getElementById('redeem-feedback-container');
  if (feedbackContainer) {
    feedbackContainer.innerHTML = `
      <div class="redeem-success-box">
        <div class="redeem-success-header">
          <span>✅ ¡Canje Exitoso Confirmado!</span>
        </div>
        <p class="redeem-success-msg">
          Has redimido la promoción <strong>${escapeHtml(oferta.titulo)}</strong>.
          Presenta tu cupón <span class="redeem-coupon-highlight">${escapeHtml(oferta.codigo_cupon)}</span> en <strong>${escapeHtml(oferta.establecimiento)}</strong> para hacer válido tu ${oferta.descuento_porcentaje}% de descuento.
        </p>
        <small class="redeem-success-sub">Evento emitido a Tracardi CDP y métricas de conversión actualizadas en tiempo real.</small>
      </div>
    `;
  }

  // Actualizar botón para retroalimentación de estado
  const btnRedeem = document.getElementById('btn-redeem-offer');
  if (btnRedeem) {
    btnRedeem.classList.remove('btn-green');
    btnRedeem.classList.add('btn-outline');
    btnRedeem.innerHTML = '✨ ¡Promoción Canjeada! (Canjear de nuevo)';
  }

  showToast(`🎉 ¡Oferta '${oferta.titulo}' canjeada con éxito! Cupón: ${oferta.codigo_cupon}`, 'success');
}

// Simular interacción o canje de oferta (compatibilidad con llamadas legacy)
function trackOfferInteraction(offerId, actionType) {
  if (actionType === 'offer-redeem') {
    openRedeemModal(offerId);
  } else {
    viewOfferDetail(offerId);
  }
}

// Registrar métrica (clic o canje) en el backend y refrescar estado dinámico
async function recordPromotionMetric(offerId, action) {
  try {
    const res = await fetch('/api/metricas-promociones/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId, action })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} al registrar métrica`);
    const data = await res.json();

    // Actualizar datos locales en memoria para respuesta ultra rápida
    if (currentMetricsData && currentMetricsData.ofertas) {
      const match = currentMetricsData.ofertas.find(o => String(o.id) === String(offerId));
      if (match) {
        if (action === 'click') match.clicks = (match.clicks || 0) + 1;
        if (action === 'redeem') match.redemptions = (match.redemptions || 0) + 1;
        match.conversionRate = match.clicks > 0
          ? parseFloat(((match.redemptions / match.clicks) * 100).toFixed(2))
          : 0;
      }
    }

    // Si la pestaña de métricas está abierta, refrescar inmediatamente las cifras
    const metricasTab = document.getElementById('metricas-tab');
    if (metricasTab && metricasTab.classList.contains('active')) {
      loadAndRenderMetricas(false);
    }
    return data;
  } catch (err) {
    console.warn('Error registrando métrica en backend:', err.message);
    return null;
  }
}

// Cargar datos de métricas y renderizar el panel completo (US-007)
async function loadAndRenderMetricas(notify = false) {
  try {
    const res = await fetch('/api/metricas-promociones');
    if (!res.ok) throw new Error(`HTTP ${res.status} al cargar métricas`);
    const data = await res.json();
    currentMetricsData = data;

    renderMetricasKPIs(data.totales || {});
    renderMetricasHighlights(data.destacadas || {});
    renderMetricasCategories(data.categorias || []);
    renderMetricsTable();

    if (notify) {
      showToast('🔄 Métricas de promociones actualizadas', 'success');
    }
  } catch (err) {
    console.error('Error cargando métricas de promociones:', err);
  }
}

// Renderizar tarjetas de KPIs globales
function renderMetricasKPIs(totales) {
  const clicksEl = document.getElementById('kpi-total-clicks');
  const redemptionsEl = document.getElementById('kpi-total-redemptions');
  const convEl = document.getElementById('kpi-global-conversion');
  const promosEl = document.getElementById('kpi-total-promos');

  if (clicksEl) clicksEl.textContent = (totales.totalClicks || 0).toLocaleString();
  if (redemptionsEl) redemptionsEl.textContent = (totales.totalRedemptions || 0).toLocaleString();
  if (convEl) convEl.textContent = `${(totales.globalConversionRate || 0).toFixed(1)}%`;
  if (promosEl) promosEl.textContent = (totales.totalPromociones || ofertasList.length || 0);
}

// Renderizar las promociones destacadas (Mayor clic, Mayor redención, Mayor conversión)
function renderMetricasHighlights(destacadas) {
  // 1. Más Clickeada
  const mc = destacadas.mostClicked;
  const mcTitle = document.getElementById('highlight-most-clicks-title');
  const mcVal = document.getElementById('highlight-most-clicks-val');
  const mcStore = document.getElementById('highlight-most-clicks-store');
  const mcCat = document.getElementById('highlight-most-clicks-cat');
  const mcRate = document.getElementById('highlight-most-clicks-rate');
  const mcBtn = document.getElementById('btn-view-most-clicks');

  if (mc) {
    if (mcTitle) mcTitle.textContent = mc.titulo;
    if (mcVal) mcVal.textContent = `${(mc.clicks || 0).toLocaleString()} clics`;
    if (mcStore) mcStore.textContent = mc.establecimiento;
    if (mcCat) mcCat.textContent = (mc.categoria || '').toUpperCase();
    if (mcRate) mcRate.textContent = `${(mc.conversionRate || 0).toFixed(1)}%`;
    if (mcBtn) mcBtn.onclick = () => goToOfferFromMetrics(mc.id);
  }

  // 2. Más Redimida
  const mr = destacadas.mostRedeemed;
  const mrTitle = document.getElementById('highlight-most-redeemed-title');
  const mrVal = document.getElementById('highlight-most-redeemed-val');
  const mrStore = document.getElementById('highlight-most-redeemed-store');
  const mrCat = document.getElementById('highlight-most-redeemed-cat');
  const mrRate = document.getElementById('highlight-most-redeemed-rate');
  const mrBtn = document.getElementById('btn-view-most-redeemed');

  if (mr) {
    if (mrTitle) mrTitle.textContent = mr.titulo;
    if (mrVal) mrVal.textContent = `${(mr.redemptions || 0).toLocaleString()} canjes`;
    if (mrStore) mrStore.textContent = mr.establecimiento;
    if (mrCat) mrCat.textContent = (mr.categoria || '').toUpperCase();
    if (mrRate) mrRate.textContent = `${(mr.conversionRate || 0).toFixed(1)}%`;
    if (mrBtn) mrBtn.onclick = () => goToOfferFromMetrics(mr.id);
  }

  // 3. Mayor Conversión / Efectividad
  const bc = destacadas.bestConversion;
  const bcTitle = document.getElementById('highlight-best-conv-title');
  const bcVal = document.getElementById('highlight-best-conv-val');
  const bcStore = document.getElementById('highlight-best-conv-store');
  const bcCat = document.getElementById('highlight-best-conv-cat');
  const bcRed = document.getElementById('highlight-best-conv-redemptions');
  const bcBtn = document.getElementById('btn-view-best-conv');

  if (bc) {
    if (bcTitle) bcTitle.textContent = bc.titulo;
    if (bcVal) bcVal.textContent = `${(bc.conversionRate || 0).toFixed(1)}% tasa`;
    if (bcStore) bcStore.textContent = bc.establecimiento;
    if (bcCat) bcCat.textContent = (bc.categoria || '').toUpperCase();
    if (bcRed) bcRed.textContent = `${bc.redemptions} canjes (${bc.clicks} clics)`;
    if (bcBtn) bcBtn.onclick = () => goToOfferFromMetrics(bc.id);
  }
}

// Renderizar comparativa por categoría
function renderMetricasCategories(categories) {
  const container = document.getElementById('metrics-category-grid');
  if (!container) return;

  if (!categories || categories.length === 0) {
    container.innerHTML = '<div class="empty-state">Sin datos de categorías</div>';
    return;
  }

  container.innerHTML = categories.map(cat => {
    const icon = getCategoryIcon(cat.categoria);
    const catName = (cat.categoria || '').toUpperCase();
    const rate = (cat.conversionRate || 0).toFixed(1);
    return `
      <div class="metric-category-card">
        <div class="metric-category-header">
          <span class="metric-cat-name">${icon} ${catName}</span>
          <span class="metric-cat-rate">${rate}% conv.</span>
        </div>
        <div class="metric-cat-stats">
          <div><small>Clics:</small> <strong>${(cat.clicks || 0).toLocaleString()}</strong></div>
          <div><small>Canjes:</small> <strong>${(cat.redemptions || 0).toLocaleString()}</strong></div>
        </div>
        <div class="conversion-progress-track">
          <div class="conversion-progress-fill" style="width: ${Math.min(parseFloat(rate) * 2, 100)}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar tabla detallada de promociones con ordenamiento y búsqueda (US-007)
function renderMetricsTable() {
  const tbody = document.getElementById('metrics-table-body');
  if (!tbody || !currentMetricsData || !currentMetricsData.ofertas) return;

  let offers = [...currentMetricsData.ofertas];

  // Filtro de búsqueda
  if (metricsSearchFilter) {
    const q = metricsSearchFilter.toLowerCase();
    offers = offers.filter(o =>
      (o.titulo && o.titulo.toLowerCase().includes(q)) ||
      (o.establecimiento && o.establecimiento.toLowerCase().includes(q)) ||
      (o.categoria && o.categoria.toLowerCase().includes(q)) ||
      (o.id && o.id.toLowerCase().includes(q))
    );
  }

  // Ordenamiento
  offers.sort((a, b) => {
    if (currentMetricsSort === 'redemptions') {
      return (b.redemptions || 0) - (a.redemptions || 0);
    }
    if (currentMetricsSort === 'conversion') {
      return (b.conversionRate || 0) - (a.conversionRate || 0);
    }
    if (currentMetricsSort === 'clicks') {
      return (b.clicks || 0) - (a.clicks || 0);
    }
    if (currentMetricsSort === 'category') {
      return (a.categoria || '').localeCompare(b.categoria || '');
    }
    return 0;
  });

  if (offers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No se encontraron promociones que coincidan con el criterio de búsqueda.
        </td>
      </tr>
    `;
    return;
  }

  // Identificar máximos para destacar badges
  const maxRedemptions = Math.max(...offers.map(o => o.redemptions || 0));
  const maxClicks = Math.max(...offers.map(o => o.clicks || 0));
  const maxConversion = Math.max(...offers.map(o => o.conversionRate || 0));

  tbody.innerHTML = offers.map(oferta => {
    const icon = getCategoryIcon(oferta.categoria);
    const convRate = (oferta.conversionRate || 0).toFixed(1);
    
    // Badges de destaque comercial
    let badgeHtml = '<span class="badge-neutral">Regular</span>';
    if (oferta.redemptions === maxRedemptions && maxRedemptions > 0) {
      badgeHtml = '<span class="badge-highlight-gold">🏆 Top Canjes</span>';
    } else if (oferta.conversionRate === maxConversion && maxConversion > 0) {
      badgeHtml = '<span class="badge-highlight-purple">⚡ Top Conversión</span>';
    } else if (oferta.clicks === maxClicks && maxClicks > 0) {
      badgeHtml = '<span class="badge-highlight-blue">👁️ Más Clics</span>';
    } else if (oferta.conversionRate >= 35) {
      badgeHtml = '<span class="badge-highlight-green">🔥 Alta Conversión</span>';
    }

    const convColor = oferta.conversionRate >= 35
      ? 'var(--accent-green)'
      : (oferta.conversionRate >= 20 ? 'var(--accent-blue)' : 'var(--accent-amber)');

    return `
      <tr class="metric-row">
        <td>
          <div class="promo-cell">
            <strong>${escapeHtml(oferta.titulo)}</strong>
            <small class="text-muted">🏪 ${escapeHtml(oferta.establecimiento)} <span class="promo-id-tag">${escapeHtml(oferta.id)}</span></small>
          </div>
        </td>
        <td style="text-align: center;">
          <span class="oferta-badge-cat cat-${escapeHtml(oferta.categoria)}" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">
            ${icon} ${escapeHtml(oferta.categoria.toUpperCase())}
          </span>
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 600;">$${oferta.precio_oferta.toFixed(2)}</div>
          <code style="font-size: 0.75rem; color: var(--accent-amber);">${escapeHtml(oferta.codigo_cupon)}</code>
        </td>
        <td style="text-align: right; font-weight: 700; font-family: var(--font-mono); color: #93c5fd;">
          ${(oferta.clicks || 0).toLocaleString()}
        </td>
        <td style="text-align: right; font-weight: 700; font-family: var(--font-mono); color: #6ee7b7;">
          ${(oferta.redemptions || 0).toLocaleString()}
        </td>
        <td style="text-align: center;">
          <div class="conversion-cell">
            <span class="conversion-pill" style="color: ${convColor}; border-color: ${convColor};">
              ${convRate}%
            </span>
            <div class="mini-progress-bar">
              <div class="mini-progress-fill" style="width: ${Math.min(parseFloat(convRate) * 2, 100)}%; background-color: ${convColor};"></div>
            </div>
          </div>
        </td>
        <td style="text-align: center;">
          ${badgeHtml}
        </td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 0.35rem; justify-content: center;">
            <button class="btn btn-xs btn-outline" onclick="goToOfferFromMetrics('${escapeHtml(oferta.id)}')" title="Ver detalle de la oferta">
              👁️ Ver
            </button>
            <button class="btn btn-xs btn-green" onclick="openRedeemModal('${escapeHtml(oferta.id)}')" title="Canjear oferta">
              🎟️ Canjear
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Manejar ordenamiento de la tabla
function sortMetricsTable(sortKey) {
  currentMetricsSort = sortKey;
  document.querySelectorAll('.metric-sort-btn').forEach(btn => {
    if (btn.getAttribute('data-sort') === sortKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderMetricsTable();
}

// Manejar búsqueda en la tabla
function handleMetricsSearch(value) {
  metricsSearchFilter = value;
  renderMetricsTable();
}

// Refrescar métricas manualmente
function refreshPromotionMetrics() {
  loadAndRenderMetricas(true);
}

// Restablecer métricas a los valores base
async function resetPromotionMetrics() {
  try {
    await fetch('/api/metricas-promociones/reset', { method: 'POST' });
    await loadAndRenderMetricas(false);
    showToast('↺ Métricas restablecidas al valor inicial demo', 'info');
  } catch (err) {
    showToast('Error restableciendo métricas', 'error');
  }
}

// Navegar directamente a la oferta desde la tabla de métricas
function goToOfferFromMetrics(offerId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const ofertasTabBtn = document.querySelector('.tab-btn[data-tab="ofertas-tab"]');
  const ofertasTabContent = document.getElementById('ofertas-tab');

  if (ofertasTabBtn) ofertasTabBtn.classList.add('active');
  if (ofertasTabContent) ofertasTabContent.classList.add('active');

  viewOfferDetail(offerId);
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

// Geocodificación Inversa con Nominatim de OpenStreetMap (US-005)
async function reverseGeocode(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} en geocodificación inversa`);
  }

  const data = await response.json();
  const address = data.address || {};
  
  // Extraer código ISO3166-2 (preferentemente lvl4 para estado/región, o fallback a lvl3/lvl6)
  const isoRegion = address['ISO3166-2-lvl4'] || address['ISO3166-2-lvl3'] || address['ISO3166-2-lvl6'] || null;

  return {
    isoRegion: isoRegion,
    country: address.country || '',
    countryCode: address.country_code || '',
    state: address.state || address.county || address.region || '',
    rawAddress: address
  };
}

// Asociar la ubicación regional a Tracardi sin persistir coordenadas directas (latitud/longitud)
async function trackGeoLocation(isoRegion, details = {}) {
  // ATENCIÓN: Por requerimiento estricto de privacidad, NO se envían latitude ni longitude a Tracardi
  const properties = {
    iso_region: isoRegion,
    'ISO3166-2-lvl4': isoRegion,
    country: details.country || '',
    country_code: details.countryCode || '',
    state: details.state || '',
    action: 'geo_consent_granted',
    consented_at: new Date().toISOString()
  };

  const payload = {
    source: { id: SOURCE_ID },
    session: { id: currentSessionId },
    profile: currentProfileId ? { id: currentProfileId } : null,
    events: [
      {
        type: 'geo-location',
        properties: properties
      }
    ]
  };

  // Actualizar tab de payload en el inspector
  const payloadJson = document.getElementById('payload-json');
  if (payloadJson) {
    payloadJson.textContent = JSON.stringify(payload, null, 2);
  }

  try {
    const res = await fetch(`${TRACARDI_API}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.profile) {
      if (result.profile.id) {
        currentProfileId = result.profile.id;
        localStorage.setItem('tracardi_profile_id', currentProfileId);
        const profInput = document.getElementById('profile-id');
        if (profInput) profInput.value = currentProfileId;
      }
      if (result.profile.interests !== undefined) {
        updateProfileInterests(result.profile.interests);
      }
    }

    const respJson = document.getElementById('response-json');
    if (respJson) {
      respJson.textContent = JSON.stringify(result, null, 2);
    }

    addLogHistory('geo-location', result);
  } catch (err) {
    console.error('Error al registrar evento geo-location en Tracardi:', err.message);
  }
}

// Manejador del Modal de Consentimiento de Geolocalización (US-004 & US-005)
function handleGeoConsent(accepted) {
  const modal = document.getElementById('geo-consent-modal');
  if (modal) {
    modal.classList.add('modal-hidden');
  }

  if (accepted) {
    if ('geolocation' in navigator) {
      const onSuccess = async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        console.log('Geolocalización obtenida del navegador (uso en memoria para geocodificación):', {
          latitude: latitude,
          longitude: longitude,
          accuracy: accuracy
        });
        console.log(`Latitud: ${latitude}, Longitud: ${longitude}`);

        try {
          showToast('🔍 Resolviendo código de región geográfica...', 'info');
          const geoData = await reverseGeocode(latitude, longitude);

          if (geoData.isoRegion) {
            currentGeoRegion = geoData.isoRegion;
            localStorage.setItem('tracardi_geo_region', currentGeoRegion);
            updateGeoRegionUI(currentGeoRegion);

            // Guardar y asociar en el perfil de Tracardi sin coordenadas directas
            await trackGeoLocation(currentGeoRegion, geoData);

            // Sincronizar catálogo de ofertas con la nueva región asignada
            renderOfertas();

            showToast(`📍 Ubicación regional asignada: ${currentGeoRegion}`, 'success');
          } else {
            console.warn('El servicio de geocodificación inversa no retornó un código regional ISO3166-2 válido:', geoData);
            showToast('⚠️ No se identificó el código de región geográfica para las coordenadas obtenidas', 'warning');
          }
        } catch (geoErr) {
          console.error('Error al resolver la geocodificación inversa con Nominatim:', geoErr.message);
          showToast('⚠️ No se pudo determinar la ubicación regional (servicio no disponible)', 'warning');
        }
      };

      const onError = (error) => {
        console.warn('Error al obtener la geolocalización:', error.message);
        showToast('⚠️ No se pudo obtener la ubicación: ' + error.message, 'warning');
      };

      // Estrategia resiliente: enableHighAccuracy: false, timeout holgado y maximumAge para evitar timeouts en Linux/Desktop
      const geoOptions = {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 300000
      };

      navigator.geolocation.getCurrentPosition(onSuccess, onError, geoOptions);
    } else {
      console.warn('La API de geolocalización no está soportada en este navegador.');
      showToast('⚠️ Geolocalización no soportada en este navegador', 'warning');
    }
  } else {
    console.log('Consentimiento de geolocalización rechazado por el usuario.');
    currentGeoRegion = '';
    localStorage.removeItem('tracardi_geo_region');
    updateGeoRegionUI('');
    renderOfertas();
  }
}

