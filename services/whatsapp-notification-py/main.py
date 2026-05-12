import json, os
from fastapi import FastAPI

app = FastAPI(title="WhatsApp Notification Service")

SEED_DATA = json.loads("""[{"id": "WHA-001", "name": "WhatsApp Notification Service", "category": "channel_banking", "description": "Template-based notifications \u2014 transaction receipts, statement delivery, loan reminders, OTP, marketing via WhatsApp Business API", "status": "active", "region": "Nigeria"}, {"id": "WHA-002", "name": "WhatsApp Notification Service Config", "category": "configuration", "description": "Configuration for WhatsApp Notification Service", "status": "active", "region": "Nigeria"}]""")
MIDDLEWARE_STATUS = json.loads("""{
  "service": "whatsapp_notification",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "whatsapp_notification.events",
        "whatsapp_notification.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "whatsapp-notification",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "whatsapp_notification-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "whatsapp_notification-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "whatsapp-notification"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "whatsapp_notification"
    },
    "redis": {
      "status": "connected",
      "cluster": "channel-banking-cache",
      "db": 5
    },
    "mojaloop": {
      "status": "connected",
      "hub": "54bank-hub",
      "dfsp": "54bank-channels"
    },
    "opensearch": {
      "status": "connected",
      "index": "whatsapp_notification-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/whatsapp-notification",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "whatsapp_notification_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "whatsapp_notification"
    }
  }
}""")

@app.get("/healthz")
def healthz():
    return {"status": "healthy", "service": "WhatsApp Notification Service", "port": 8645, "description": "Template-based notifications — transaction receipts, statement delivery, loan reminders, OTP, marketing via WhatsApp Business API", "middleware": MIDDLEWARE_STATUS}

@app.get("/v1/whatsapp_notification/list")
def list_data():
    return {"data": SEED_DATA, "total": len(SEED_DATA), "service": "WhatsApp Notification Service"}
