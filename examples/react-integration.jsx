import React, { useState, useEffect, useCallback } from 'react';

/**
 * Custom Hook: useTracardi
 * Permite enviar eventos a Tracardi fácilmente desde cualquier componente React.
 */
export function useTracardi({ apiHost = 'http://localhost:8686', sourceId = 'demo-source' } = {}) {
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem('tracardi_session_id');
    if (!sid) {
      sid = `react-sess-${Math.random().toString(36).substring(2, 10)}`;
      sessionStorage.setItem('tracardi_session_id', sid);
    }
    return sid;
  });

  const [profileId, setProfileId] = useState(() => localStorage.getItem('tracardi_profile_id'));

  const track = useCallback(async (eventType, properties = {}) => {
    const payload = {
      source: { id: sourceId },
      session: { id: sessionId },
      profile: profileId ? { id: profileId } : null,
      events: [
        {
          type: eventType,
          properties: properties
        }
      ]
    };

    try {
      const res = await fetch(`${apiHost}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.profile?.id) {
        setProfileId(data.profile.id);
        localStorage.setItem('tracardi_profile_id', data.profile.id);
      }
      return data;
    } catch (err) {
      console.error('Error tracking Tracardi event:', err);
      throw err;
    }
  }, [apiHost, sourceId, sessionId, profileId]);

  return { track, sessionId, profileId };
}

/**
 * Componente de Ejemplo React
 */
export function TracardiDemoComponent() {
  const { track, sessionId, profileId } = useTracardi();
  const [lastResponse, setLastResponse] = useState(null);

  useEffect(() => {
    // Registrar vista de página al cargar el componente
    track('page-view', { page: 'React Dashboard', path: '/dashboard' });
  }, [track]);

  const handlePurchase = async () => {
    const res = await track('purchase', {
      orderId: 'ORD-' + Math.floor(Math.random() * 10000),
      total: 89.90,
      itemsCount: 2
    });
    setLastResponse(res);
  };

  return (
    <div style={{ padding: '20px', background: '#1e293b', color: '#fff', borderRadius: '8px' }}>
      <h2>⚛️ Componente React con Tracardi</h2>
      <p>Session ID: <code>{sessionId}</code></p>
      <p>Profile ID: <code>{profileId || 'Anónimo'}</code></p>

      <button onClick={handlePurchase} style={{ padding: '10px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        🛒 Simular Compra en React
      </button>

      {lastResponse && (
        <pre style={{ marginTop: '15px', background: '#0f172a', padding: '10px', borderRadius: '4px' }}>
          {JSON.stringify(lastResponse, null, 2)}
        </pre>
      )}
    </div>
  );
}
