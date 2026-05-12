import json, os
from fastapi import FastAPI

app = FastAPI(title="Telegram Notification Service")

SEED_DATA = json.loads("""[{"id": "TEL-001", "name": "Telegram Notification Service", "category": "channel_banking", "description": "Push notifications via Telegram \u2014 transaction alerts, OTP delivery, loan due reminders, fraud alerts, promotional messages", "status": "active", "region": "Nigeria"}, {"id": "TEL-002", "name": "Telegram Notification Service Config", "category": "configuration", "description": "Configuration for Telegram Notification Service", "status": "active", "region": "Nigeria"}]""")
MIDDLEWARE_STATUS = json.loads("""{
  "service": "telegram_notification",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "telegram_notification.events",
        "telegram_notification.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "telegram-notification",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "telegram_notification-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "telegram_notification-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "telegram-notification"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "telegram_notification"
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
      "index": "telegram_notification-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/telegram-notification",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "telegram_notification_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "telegram_notification"
    }
  }
}""")

@app.get("/healthz")
def healthz():
    return {"status": "healthy", "service": "Telegram Notification Service", "port": 8639, "description": "Push notifications via Telegram — transaction alerts, OTP delivery, loan due reminders, fraud alerts, promotional messages", "middleware": MIDDLEWARE_STATUS}

@app.get("/v1/telegram_notification/list")
def list_data():
    return {"data": SEED_DATA, "total": len(SEED_DATA), "service": "Telegram Notification Service"}
