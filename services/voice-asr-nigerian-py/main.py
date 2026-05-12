import json, os
from fastapi import FastAPI

app = FastAPI(title="Nigerian Voice ASR Engine")

SEED_DATA = json.loads("""[{"id": "ASR-001", "audioId": "AUD-001", "language": "en-NG", "dialect": "nigerian_english", "transcript": "I want to check my account balance", "confidence": 0.94, "durationMs": 2100, "noiseLevel": "low", "speakerId": "SPK-001"}, {"id": "ASR-002", "audioId": "AUD-002", "language": "pcm-NG", "dialect": "pidgin", "transcript": "I wan send money give my broda", "confidence": 0.89, "durationMs": 1800, "noiseLevel": "medium", "speakerId": "SPK-002"}, {"id": "ASR-003", "audioId": "AUD-003", "language": "ha-NG", "dialect": "hausa", "transcript": "Ina son duba kudin da ke cikin asusuna", "confidence": 0.91, "durationMs": 2400, "noiseLevel": "low", "speakerId": "SPK-003"}, {"id": "ASR-004", "audioId": "AUD-004", "language": "yo-NG", "dialect": "yoruba", "transcript": "Mo fe wo iye owo ti o wa ninu account mi", "confidence": 0.88, "durationMs": 2200, "noiseLevel": "high", "speakerId": "SPK-004"}]""")
MIDDLEWARE_STATUS = json.loads("""{
  "service": "voice_asr_nigerian",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "voice_asr_nigerian.events",
        "voice_asr_nigerian.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "voice-asr-nigerian",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "voice_asr_nigerian-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "voice_asr_nigerian-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "voice-asr-nigerian"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "voice_asr_nigerian"
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
      "index": "voice_asr_nigerian-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/voice-asr-nigerian",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "voice_asr_nigerian_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "voice_asr_nigerian"
    }
  }
}""")

@app.get("/healthz")
def healthz():
    return {"status": "healthy", "service": "Nigerian Voice ASR Engine", "port": 8631, "description": "Automatic speech recognition for Nigerian English, Pidgin, Hausa, Yoruba, Igbo — noise-robust for market/rural environments", "middleware": MIDDLEWARE_STATUS}

@app.get("/v1/voice_asr_nigerian/list")
def list_data():
    return {"data": SEED_DATA, "total": len(SEED_DATA), "service": "Nigerian Voice ASR Engine"}
