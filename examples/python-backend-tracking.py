#!/usr/bin/env python3
"""
Cliente de Tracardi para Python (Django, FastAPI, Flask, Celery, scripts)
"""
import json
import urllib.request
import time

class TracardiClient:
    def __init__(self, api_host="http://localhost:8686", source_id="demo-source"):
        self.api_host = api_host
        self.source_id = source_id

    def track(self, event_type, profile_id=None, session_id=None, properties=None):
        url = f"{self.api_host}/track"
        payload = {
            "source": {"id": self.source_id},
            "session": {"id": session_id or f"python-sess-{int(time.time())}"},
            "profile": {"id": profile_id} if profile_id else None,
            "events": [
                {
                    "type": event_type,
                    "properties": properties or {}
                }
            ]
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            return json.loads(res_body)

    def collect_webhook(self, event_type, source_id="demo-webhook-source", session_id=None, properties=None):
        sess_id = session_id or f"py-wh-sess-{int(time.time())}"
        url = f"{self.api_host}/collect/{event_type}/{source_id}/{sess_id}"
        payload = {"properties": properties or {}}

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            return json.loads(res_body)

if __name__ == "__main__":
    client = TracardiClient()
    print("🐍 Enviando evento desde Python...")
    res = client.track(
        event_type="subscription-renewed",
        session_id="sess-python-demo",
        properties={
            "plan": "Enterprise Annual",
            "amount": 499.00,
            "currency": "USD",
            "auto_renew": True
        }
      )
    print("✅ Respuesta Tracardi:")
    print(json.dumps(res, indent=2))
