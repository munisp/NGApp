import json, os
from fastapi import FastAPI

app = FastAPI(title="Voice Call Analytics")

SEED_DATA = json.loads("""[{"id": "VOI-001", "name": "Voice Call Analytics", "category": "channel_banking", "description": "Call duration, sentiment analysis, intent success rate, drop-off tracking, agent escalation metrics", "status": "active", "region": "Nigeria"}, {"id": "VOI-002", "name": "Voice Call Analytics Config", "category": "configuration", "description": "Configuration for Voice Call Analytics", "status": "active", "region": "Nigeria"}]""")
MIDDLEWARE_STATUS = json.loads("""{
  "service": "voice_call_analytics",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "voice_call_analytics.events",
        "voice_call_analytics.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "voice-call-analytics",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "voice_call_analytics-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "voice_call_analytics-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "voice-call-analytics"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "voice_call_analytics"
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
      "index": "voice_call_analytics-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/voice-call-analytics",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "voice_call_analytics_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "voice_call_analytics"
    }
  }
}""")

@app.get("/healthz")
def healthz():
    return {"status": "healthy", "service": "Voice Call Analytics", "port": 8635, "description": "Call duration, sentiment analysis, intent success rate, drop-off tracking, agent escalation metrics", "middleware": MIDDLEWARE_STATUS}

@app.get("/v1/voice_call_analytics/list")
def list_data():
    return {"data": SEED_DATA, "total": len(SEED_DATA), "service": "Voice Call Analytics"}
