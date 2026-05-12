package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "WHA-001", "name": "WhatsApp Payment Integration", "category": "channel_banking", "description": "WhatsApp Pay integration for peer-to-peer transfers, merchant payments, QR code payments within WhatsApp", "status": "active", "region": "Nigeria"}, {"id": "WHA-002", "name": "WhatsApp Payment Integration Config", "category": "configuration", "description": "Configuration for WhatsApp Payment Integration", "status": "active", "region": "Nigeria"}]`
var middlewareStatus = `{
  "service": "whatsapp_payment_integration",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "whatsapp_payment_integration.events",
        "whatsapp_payment_integration.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "whatsapp-payment-integration",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "whatsapp_payment_integration-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "whatsapp_payment_integration-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "whatsapp-payment-integration"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "whatsapp_payment_integration"
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
      "index": "whatsapp_payment_integration-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/whatsapp-payment-integration",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "whatsapp_payment_integration_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "whatsapp_payment_integration"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8644"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"WhatsApp Payment Integration","port":%s,"description":"WhatsApp Pay integration for peer-to-peer transfers, merchant payments, QR code payments within WhatsApp","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/whatsapp_payment_integration/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "WhatsApp Payment Integration"})
	})
	fmt.Printf("WhatsApp Payment Integration running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
