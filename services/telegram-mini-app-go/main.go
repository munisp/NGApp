package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "TEL-001", "name": "Telegram Mini App Banking", "category": "channel_banking", "description": "Telegram Mini App for rich UI banking \u2014 account dashboard, fund transfer form, bill payment, statement download", "status": "active", "region": "Nigeria"}, {"id": "TEL-002", "name": "Telegram Mini App Banking Config", "category": "configuration", "description": "Configuration for Telegram Mini App Banking", "status": "active", "region": "Nigeria"}]`
var middlewareStatus = `{
  "service": "telegram_mini_app",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "telegram_mini_app.events",
        "telegram_mini_app.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "telegram-mini-app",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "telegram_mini_app-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "telegram_mini_app-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "telegram-mini-app"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "telegram_mini_app"
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
      "index": "telegram_mini_app-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/telegram-mini-app",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "telegram_mini_app_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "telegram_mini_app"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8640"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"Telegram Mini App Banking","port":%s,"description":"Telegram Mini App for rich UI banking — account dashboard, fund transfer form, bill payment, statement download","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/telegram_mini_app/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "Telegram Mini App Banking"})
	})
	fmt.Printf("Telegram Mini App Banking running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
