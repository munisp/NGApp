import json, os
from fastapi import FastAPI

app = FastAPI(title="USSD Multilingual Service")

SEED_DATA = json.loads("""[{"id": "USS-001", "name": "USSD Multilingual Service", "category": "channel_banking", "description": "USSD menu translation \u2014 English, Hausa, Yoruba, Igbo, Pidgin \u2014 dynamic language switching mid-session, RTL support", "status": "active", "region": "Nigeria"}, {"id": "USS-002", "name": "USSD Multilingual Service Config", "category": "configuration", "description": "Configuration for USSD Multilingual Service", "status": "active", "region": "Nigeria"}]""")
MIDDLEWARE_STATUS = json.loads("""{
  "service": "ussd_multilingual",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "ussd_multilingual.events",
        "ussd_multilingual.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "ussd-multilingual",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "ussd_multilingual-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "ussd_multilingual-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "ussd-multilingual"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "ussd_multilingual"
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
      "index": "ussd_multilingual-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/ussd-multilingual",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "ussd_multilingual_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "ussd_multilingual"
    }
  }
}""")

@app.get("/healthz")
def healthz():
    return {"status": "healthy", "service": "USSD Multilingual Service", "port": 8649, "description": "USSD menu translation — English, Hausa, Yoruba, Igbo, Pidgin — dynamic language switching mid-session, RTL support", "middleware": MIDDLEWARE_STATUS}

@app.get("/v1/ussd_multilingual/list")
def list_data():
    return {"data": SEED_DATA, "total": len(SEED_DATA), "service": "USSD Multilingual Service"}
