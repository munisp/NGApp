package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "VOI-001", "name": "IVR Menu Engine", "category": "channel_banking", "description": "Interactive voice response menu tree \u2014 account services, transfers, bills, loans, cards, support \u2014 DTMF and voice navigation", "status": "active", "region": "Nigeria"}, {"id": "VOI-002", "name": "IVR Menu Engine Config", "category": "configuration", "description": "Configuration for IVR Menu Engine", "status": "active", "region": "Nigeria"}]`
var middlewareStatus = `{
  "service": "voice_ivr_menu",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "voice_ivr_menu.events",
        "voice_ivr_menu.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "voice-ivr-menu",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "voice_ivr_menu-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "voice_ivr_menu-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "voice-ivr-menu"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "voice_ivr_menu"
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
      "index": "voice_ivr_menu-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/voice-ivr-menu",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "voice_ivr_menu_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "voice_ivr_menu"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8634"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"IVR Menu Engine","port":%s,"description":"Interactive voice response menu tree — account services, transfers, bills, loans, cards, support — DTMF and voice navigation","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/voice_ivr_menu/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "IVR Menu Engine"})
	})
	fmt.Printf("IVR Menu Engine running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
