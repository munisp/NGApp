package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "USS-001", "name": "USSD SIM Toolkit Integration", "category": "channel_banking", "description": "STK push integration for proactive banking \u2014 balance alerts, payment reminders, promotional menus via SIM toolkit", "status": "active", "region": "Nigeria"}, {"id": "USS-002", "name": "USSD SIM Toolkit Integration Config", "category": "configuration", "description": "Configuration for USSD SIM Toolkit Integration", "status": "active", "region": "Nigeria"}]`
var middlewareStatus = `{
  "service": "ussd_sim_toolkit",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "ussd_sim_toolkit.events",
        "ussd_sim_toolkit.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "ussd-sim-toolkit",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "ussd_sim_toolkit-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "ussd_sim_toolkit-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "ussd-sim-toolkit"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "ussd_sim_toolkit"
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
      "index": "ussd_sim_toolkit-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/ussd-sim-toolkit",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "ussd_sim_toolkit_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "ussd_sim_toolkit"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8650"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"USSD SIM Toolkit Integration","port":%s,"description":"STK push integration for proactive banking — balance alerts, payment reminders, promotional menus via SIM toolkit","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/ussd_sim_toolkit/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "USSD SIM Toolkit Integration"})
	})
	fmt.Printf("USSD SIM Toolkit Integration running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
