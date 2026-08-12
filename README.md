# 🚀 Tracardi CDP - Demo e Guía de Integración Práctica

Esta carpeta contiene un proyecto **demo completo e interactivo** diseñado para comprender cómo utilizar e integrar **Tracardi (Customer Data Platform - CDP)** en cualquier proyecto web (Frontend), servidor backend (Node.js, Python, PHP) o mediante Webhooks.

---

## 📌 Estado de los Servicios Locales

| Servicio | URL / Puerto | Descripción | Credenciales / Datos |
| :--- | :--- | :--- | :--- |
| **App Demo Interactiva** | [http://localhost:3000](http://localhost:3000) | Dashboard de pruebas & Inspector Tracardi en vivo | Creado en este repositorio |
| **Tracardi GUI (Dashboard)** | [http://localhost:8787](http://localhost:8787) | Panel oficial de administración de Tracardi | `swumplurd@gmail.com` / `123456` |
| **Tracardi API Engine** | [http://localhost:8686](http://localhost:8686) | Endpoint REST & recolector de eventos (`/track`, `/collect`) | - |

---

## ⚡ Inicio Rápido (Quickstart)

El servidor de la demo está configurado para auto-inicializar las fuentes de eventos en Tracardi al arrancar:

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar la demo (Auto-configura Tracardi e inicia el servidor en el puerto 3000)
npm start
```

Una vez ejecutado, abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🧠 ¿Qué es Tracardi y cómo funciona?

Tracardi es una plataforma de datos de clientes (CDP - Customer Data Platform) en tiempo real. Su función principal es **recopilar eventos**, **unificar identidades de usuarios** y **ejecutar flujos automatizados** (workflows).

### Conceptos Clave:

1. **Event Source (Fuente de Datos)**: Define de dónde provienen los eventos.
   - `demo-source` (REST/JavaScript Bridge): Para aplicaciones web y móviles.
   - `demo-webhook-source` (Webhook Bridge): Para integración servidor a servidor (ej: pagos de Stripe/MercadoPago).
2. **Profile (Perfil)**: Identidad única del usuario. Tracardi unifica eventos anónimos y registrados bajo un mismo perfil.
3. **Session (Sesión)**: Período de actividad continua del usuario (navegación).
4. **Events (Eventos)**: Acciones realizadas por el usuario (`page-view`, `add-to-cart`, `purchase`, `user-identify`).
5. **Workflows & Rules (Flujos y Reglas)**: Reglas en el Dashboard (8787) que reaccionan a los eventos en tiempo real (ej: enviar correo si abandona el carrito).

---

## 💎 Comparativa: Versión Gratuita (Open Source) vs. Versión de Pago (Commercial / Enterprise)

Tracardi está disponible en dos modalidades principales: la **versión Open Source (Comunitaria / Gratuita)** —utilizada en esta demo— y la **versión Comercial / Enterprise (De Pago)** pensada para grandes volúmenes de tráfico e infraestructura crítica.

### 📊 Tabla Comparativa Rápida

| Característica | 🟢 Versión Gratuita (Open Source) | 🔴 Versión de Pago (Enterprise / Pro) |
| :--- | :--- | :--- |
| **Modelo de Licencia** | Código abierto (Free / AGPL) | Comercial (Suscripción Enterprise) |
| **Procesamiento de Eventos** | Secuencial (adecuado para PyMEs y tráfico medio) | **Paralelo** (optimizado para millones de req/sec) |
| **Rendimiento / Latencia** | Procesamiento estándar | **Caché de Metadatos** ultra rápida |
| **Fuentes de Ingesta (Collectors)** | Web (JS Bridge), REST API, Webhooks | Web, REST, Webhooks + **Kafka, RabbitMQ, MQTT, IMAP, Pulsar** |
| **Fusión de Perfiles** | Basada en reglas y nodos de flujos | **Fusión Inteligente Automatizada** pre-flujo |
| **Workflows Temporales** | Automatización básica y eventos inmediatos | **Workflows con retardos temporales avanzados** (ej: esperar X horas) |
| **Despacho de Eventos** | Unipunto por flujo | **Despacho paralelo y remapeo dinámico de esquemas** |
| **Infraestructura Support** | Elasticsearch / OpenSearch básico | Soporte optimizado para **Redis, Valkey** y Clústeres Enterprise |
| **Plugins de Acción** | Colección estándar (HTTP, Emails, Atributos) | Colección extendida (Geofencing, Rate Limiting, Agregadores) |
| **Soporte Técnico** | Comunidad (GitHub, Slack) | **SLA dedicado, soporte 24/7 y arquitectura** |

---

### 🟢 ¿Qué incluye la Versión Gratuita (Open Source)?

La versión gratuita incluye **todas las funcionalidades esenciales** para implementar una CDP completa en proyectos pequeños, medianos o en fase de crecimiento:

- **Ingesta de Eventos en Tiempo Real**: Endpoints `/track` y `/collect` para recibir datos desde cualquier app web o servidor.
- **Gestión de Perfiles y Sesiones**: Unificación automática de identidades de usuarios (anónimos a identificados).
- **Editor Visual de Flujos (Flows)**: Creación de diagramas de automatización drag-and-drop en el Dashboard (puerto 8787).
- **Bridges Estándar**: Soporte para aplicaciones Web (JS Bridge), APIs REST y Webhooks (pasarelas de pago como Stripe/MercadoPago).
- **Plugins de Acción Estándar**:
  - Envíos de correos electrónicos.
  - Modificación de atributos del perfil.
  - Llamadas a APIs externas (nodos HTTP POST/GET).
  - Segmentación lógica y condicionales (`if/else`).
- **Dashboard GUI Oficial**: Interfaz gráfica para visualizar eventos, consultar perfiles y monitorear actividad.

---

### 🔴 ¿Qué añade la Versión de Pago (Commercial / Enterprise)?

La versión comercial está diseñada para empresas de gran escala con requisitos de **alta disponibilidad, ultra bajo retardo y volúmenes masivos de datos**:

- **Procesamiento Paralelo de Alto Rendimiento**: Procesa múltiples eventos en paralelo por segundo sin cuellos de botella secuenciales.
- **Metadata Caching**: Mantiene en memoria caché los metadatos de configuración para responder en milisegundos bajo cargas extremas.
- **Colectores Enterprise**: Ingesta nativa directa desde sistemas de mensajería empresarial como **Apache Kafka, RabbitMQ, MQTT, IMAP, Apache Pulsar**, etc.
- **Fusión Inteligente de Perfiles**: Unifica identidades de clientes automáticamente antes de evaluar los flujos de trabajo.
- **Acciones Temporales Complejas**: Capacidad de pausar flujos y ejecutarlos automáticamente X minutos, horas o días después.
- **Remapeo Dinámico y Despacho Paralelo**: Transforma la estructura de los eventos en caliente y los reenvía en paralelo a múltiples destinos (ej. CRM + Data Lake simultáneamente).
- **Plugins Enterprise Adicionales**: Plugins avanzados de Geofencing, agregación masiva de datos y control de tasa (Rate Limiting).
- **Soporte y Garantías SLAs**: Asistencia directa del equipo de Tracardi, revisiones de arquitectura y parches prioritarios.

---

### 💡 ¿Cuál deberías elegir?

- **Usa la Versión Gratuita si**: Estás desarrollando una startup, una PyME, una demo/PoC, o si tu volumen de eventos no requiere procesamiento paralelo masivo ni integración nativa con Kafka/RabbitMQ.
- **Considera la Versión de Pago si**: Administras una plataforma e-commerce con tráfico masivo, necesitas automatizaciones con retrasos de tiempo complejos, ingesta masiva vía colas (Kafka/RabbitMQ) o soporte técnico crítico con SLA.

---

## 📁 Estructura del Proyecto Demo

```
tacardi-demo/
├── public/                     # Frontend interactivo de la Demo (Port 3000)
│   ├── index.html              # UI con pestañas, selector de usuario e Inspector
│   ├── style.css               # Diseño moderno, modo oscuro y glassmorphism
│   └── app.js                  # Lógica de rastreo en tiempo real y comunicación con Tracardi
├── examples/                   # Ejemplos de integración listos para copiar/pegar
│   ├── vanilla-js-snippet.html # Integración directa en HTML / JS puro
│   ├── react-integration.jsx   # Custom Hook de React (`useTracardi`) y componente
│   ├── node-backend-tracking.js# Clase cliente para Node.js / Express
│   ├── python-backend-tracking.py # Módulo para Python (Django / FastAPI / Flask)
│   └── curl-examples.sh        # Script ejecutable de cURL para pruebas por consola
├── setup.js                    # Script que se conecta a Tracardi (8686) y crea las fuentes
├── server.js                   # Servidor Express de la demo y proxy de endpoints backend
└── package.json                # Configuración y scripts del proyecto
```

---

## 💻 Cómo Integrar Tracardi en Otros Proyectos

### 1. Integración en Frontend (Vanilla JS / HTML)
Envía peticiones `POST` al endpoint `/track` de Tracardi (puerto 8686):

```javascript
async function sendTracardiEvent(eventType, properties = {}) {
  const payload = {
    source: { id: "demo-source" },
    session: { id: localStorage.getItem("tracardi_session_id") || "sess_001" },
    profile: localStorage.getItem("tracardi_profile_id") ? { id: localStorage.getItem("tracardi_profile_id") } : null,
    events: [
      {
        type: eventType,
        properties: properties
      }
    ]
  };

  const response = await fetch("http://localhost:8686/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  
  // Guardar Profile ID retornado por Tracardi
  if (result.profile && result.profile.id) {
    localStorage.setItem("tracardi_profile_id", result.profile.id);
  }
  return result;
}

// Ejemplo de uso:
sendTracardiEvent("page-view", { url: window.location.href, title: document.title });
```

---

### 2. Integración en React / Next.js
Revisa [`examples/react-integration.jsx`](file:///home/swumplurd/Documentos/devsarrollo/proyectos/tacardi-demo/examples/react-integration.jsx):

```jsx
import { useTracardi } from './examples/react-integration';

function MiComponente() {
  const { track } = useTracardi({ sourceId: 'demo-source' });

  const handleCompra = () => {
    track('purchase', { item: 'Curso Tracardi', price: 49.99 });
  };

  return <button onClick={handleCompra}>Comprar</button>;
}
```

---

### 3. Integración en Backend (Node.js / Express)
Revisa [`examples/node-backend-tracking.js`](file:///home/swumplurd/Documentos/devsarrollo/proyectos/tacardi-demo/examples/node-backend-tracking.js):

```javascript
const TracardiClient = require('./examples/node-backend-tracking');
const tracardi = new TracardiClient({ apiHost: 'http://localhost:8686', sourceId: 'demo-source' });

// Enviar evento desde una ruta o controlador de Express
app.post('/checkout', async (req, res) => {
  await tracardi.track({
    eventType: 'purchase-completed',
    sessionId: req.sessionID,
    properties: { order_id: 'ORD-999', total: 150.00 }
  });
  res.json({ success: true });
});
```

---

### 4. Integración Servidor a Servidor (Webhooks / `/collect`)
Para webhooks de pasarelas de pago o servicios externos donde no tienes sesión del cliente:

```bash
curl -X POST "http://localhost:8686/collect/payment-succeeded/demo-webhook-source/session-stripe-001" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "charge_id": "ch_12345",
      "amount": 99.00,
      "status": "paid"
    }
  }'
```

---

## 📊 Visualización de Datos en Tracardi GUI (Dashboard)

1. Abre **[http://localhost:8787](http://localhost:8787)**.
2. Inicia sesión con `swumplurd@gmail.com` / `123456`.
3. Ve a **Events** en el menú de navegación para ver en tiempo real cada evento enviado desde la demo app o la consola.
4. Ve a **Profiles** para inspeccionar las identidades unificadas, atributos del usuario y su historial de interacciones.
5. Diseña automatizaciones en la sección **Flows**.

---

## 🛠️ Comandos de Utilidad

```bash
# Probar ejemplos cURL en consola
bash examples/curl-examples.sh

# Ejecutar test de backend Python
python3 examples/python-backend-tracking.py

# Verificar salud de los servicios
curl http://localhost:3000/api/health
```
