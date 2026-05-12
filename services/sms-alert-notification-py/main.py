import json, os
from fastapi import FastAPI

app = FastAPI(title="SMS Alert Notification")

SEED_DATA = json.loads("""[{"id": "ALT-001", "alertType": "transaction", "msisdn": "08012345678", "template": "credit_alert", "variables": {"amount": "50000", "sender": "ADEBAYO O", "ref": "TRF/2026/0001", "balance": "175430.50"}, "network": "MTN", "priority": "high", "deliveryStatus": "delivered", "timestamp": "2026-05-09T10:00:00Z"}, {"id": "ALT-002", "alertType": "loan_reminder", "msisdn": "08098765432", "template": "loan_due", "variables": {"amount": "25000", "dueDate": "2026-05-15", "loanRef": "LN/2026/001"}, "network": "Glo", "priority": "medium", "deliveryStatus": "delivered", "timestamp": "2026-05-09T10:05:00Z"}, {"id": "ALT-003", "alertType": "fraud_alert", "msisdn": "07033344455", "template": "suspicious_activity", "variables": {"txnType": "POS", "amount": "150000", "location": "Lagos Island", "time": "09:45"}, "network": "Airtel", "priority": "critical", "deliveryStatus": "delivered", "timestamp": "2026-05-09T10:10:00Z"}]""")
MIDDLEWARE_STATUS = json.loads("""{
  "service": "sms_alert_notification",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "sms_alert_notification.events",
        "sms_alert_notification.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "sms-alert-notification",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "sms_alert_notification-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "sms_alert_notification-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "sms-alert-notification"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "sms_alert_notification"
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
      "index": "sms_alert_notification-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/sms-alert-notification",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "sms_alert_notification_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "sms_alert_notification"
    }
  }
}""")

@app.get("/healthz")
def healthz():
    return {"status": "healthy", "service": "SMS Alert Notification", "port": 8653, "description": "Transaction alerts, balance notifications, loan reminders, fraud alerts, marketing SMS — templated with personalization", "middleware": MIDDLEWARE_STATUS}

@app.get("/v1/sms_alert_notification/list")
def list_data():
    return {"data": SEED_DATA, "total": len(SEED_DATA), "service": "SMS Alert Notification"}
