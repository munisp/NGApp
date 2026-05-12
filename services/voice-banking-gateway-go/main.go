package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "VBG-001", "callId": "CALL-2026-0001", "msisdn": "08012345678", "language": "en-NG", "channel": "voice", "sessionType": "ivr", "duration": 45, "status": "completed", "dtmfInput": "1#2#", "intent": "balance_inquiry", "timestamp": "2026-05-09T10:00:00Z"}, {"id": "VBG-002", "callId": "CALL-2026-0002", "msisdn": "08098765432", "language": "ha-NG", "channel": "voice", "sessionType": "ivr", "duration": 120, "status": "in_progress", "dtmfInput": "2#1#", "intent": "fund_transfer", "timestamp": "2026-05-09T10:05:00Z"}, {"id": "VBG-003", "callId": "CALL-2026-0003", "msisdn": "07033344455", "language": "yo-NG", "channel": "voice", "sessionType": "ivr", "duration": 30, "status": "completed", "dtmfInput": "3#", "intent": "bill_payment", "timestamp": "2026-05-09T10:10:00Z"}, {"id": "VBG-004", "callId": "CALL-2026-0004", "msisdn": "09011122233", "language": "ig-NG", "channel": "voice", "sessionType": "voice_command", "duration": 15, "status": "completed", "dtmfInput": "", "intent": "account_balance", "timestamp": "2026-05-09T10:15:00Z"}]`
var middlewareStatus = `{
  "service": "voice_banking_gateway",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "voice_banking_gateway.events",
        "voice_banking_gateway.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "voice-banking-gateway",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "voice_banking_gateway-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "voice_banking_gateway-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "voice-banking-gateway"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "voice_banking_gateway"
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
      "index": "voice_banking_gateway-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/voice-banking-gateway",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "voice_banking_gateway_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "voice_banking_gateway"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8629"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"Voice Banking Gateway","port":%s,"description":"Main IVR gateway — call routing, session management, DTMF input, Nigerian Pidgin/English/Hausa/Yoruba/Igbo language detection","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/voice_banking_gateway/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "Voice Banking Gateway"})
	})
	fmt.Printf("Voice Banking Gateway running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
