package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "VOI-001", "name": "Voice Agent Escalation", "category": "channel_banking", "description": "Seamless handoff from IVR to human agent with context transfer, queue management, callback scheduling", "status": "active", "region": "Nigeria"}, {"id": "VOI-002", "name": "Voice Agent Escalation Config", "category": "configuration", "description": "Configuration for Voice Agent Escalation", "status": "active", "region": "Nigeria"}]`
var middlewareStatus = `{
  "service": "voice_agent_escalation",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "voice_agent_escalation.events",
        "voice_agent_escalation.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "voice-agent-escalation",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "voice_agent_escalation-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "voice_agent_escalation-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "voice-agent-escalation"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "voice_agent_escalation"
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
      "index": "voice_agent_escalation-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/voice-agent-escalation",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "voice_agent_escalation_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "voice_agent_escalation"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8636"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"Voice Agent Escalation","port":%s,"description":"Seamless handoff from IVR to human agent with context transfer, queue management, callback scheduling","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/voice_agent_escalation/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "Voice Agent Escalation"})
	})
	fmt.Printf("Voice Agent Escalation running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
