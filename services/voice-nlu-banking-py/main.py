import json, os
from fastapi import FastAPI

app = FastAPI(title="Voice NLU Banking Intent")

SEED_DATA = json.loads("""[{"id": "NLU-001", "utterance": "I want to check my balance", "intent": "balance_inquiry", "confidence": 0.97, "entities": [{"type": "account_type", "value": "savings", "confidence": 0.85}], "language": "en-NG"}, {"id": "NLU-002", "utterance": "Transfer twenty thousand naira to Chidi", "intent": "fund_transfer", "confidence": 0.95, "entities": [{"type": "amount", "value": 20000}, {"type": "recipient", "value": "Chidi"}], "language": "en-NG"}, {"id": "NLU-003", "utterance": "Pay my DSTV subscription", "intent": "bill_payment", "confidence": 0.93, "entities": [{"type": "biller", "value": "DSTV"}, {"type": "bill_type", "value": "subscription"}], "language": "en-NG"}, {"id": "NLU-004", "utterance": "How much I dey owe for my loan", "intent": "loan_status", "confidence": 0.9, "entities": [{"type": "product", "value": "loan"}], "language": "pcm-NG"}]""")
MIDDLEWARE_STATUS = json.loads("""{
  "service": "voice_nlu_banking",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "voice_nlu_banking.events",
        "voice_nlu_banking.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "voice-nlu-banking",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "voice_nlu_banking-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "voice_nlu_banking-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "voice-nlu-banking"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "voice_nlu_banking"
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
      "index": "voice_nlu_banking-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/voice-nlu-banking",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "voice_nlu_banking_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "voice_nlu_banking"
    }
  }
}""")

@app.get("/healthz")
def healthz():
    return {"status": "healthy", "service": "Voice NLU Banking Intent", "port": 8632, "description": "Natural language understanding for banking intents — balance inquiry, transfer, bill payment, loan status, dispute filing", "middleware": MIDDLEWARE_STATUS}

@app.get("/v1/voice_nlu_banking/list")
def list_data():
    return {"data": SEED_DATA, "total": len(SEED_DATA), "service": "Voice NLU Banking Intent"}
