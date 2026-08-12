#!/bin/bash

# Script ejecutable de ejemplos cURL para Tracardi

TRACARDI_API="http://localhost:8686"

echo "========================================="
echo "1. Enviar Evento REST (/track)"
echo "========================================="
curl -X POST "$TRACARDI_API/track" \
  -H "Content-Type: application/json" \
  -d '{
    "source": { "id": "demo-source" },
    "session": { "id": "curl-session-001" },
    "profile": { "id": "curl-profile-001" },
    "events": [
      {
        "type": "button-click",
        "properties": {
          "button_id": "btn-signup-hero",
          "page": "landing-page"
        }
      }
    ]
  }'

echo -e "\n\n========================================="
echo "2. Enviar Webhook Servidor-a-Servidor (/collect)"
echo "========================================="
curl -X POST "$TRACARDI_API/collect/invoice-paid/demo-webhook-source/curl-session-001" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "invoice_id": "INV-2026-99",
      "amount": 150.00,
      "status": "PAID"
    }
  }'
echo -e "\n"
