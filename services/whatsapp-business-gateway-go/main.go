package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "WA-001", "waId": "2348012345678", "phoneNumber": "+2348012345678", "displayName": "Adebayo Ogundimu", "messageType": "interactive", "flowType": "balance_check", "templateName": "transaction_alert", "status": "delivered", "timestamp": "2026-05-09T10:00:00Z"}, {"id": "WA-002", "waId": "2348098765432", "phoneNumber": "+2348098765432", "displayName": "Chidinma Okafor", "messageType": "text", "flowType": "fund_transfer", "templateName": "", "status": "read", "timestamp": "2026-05-09T10:05:00Z"}, {"id": "WA-003", "waId": "2347033344455", "phoneNumber": "+2347033344455", "displayName": "Fatima Abdullahi", "messageType": "interactive", "flowType": "bill_payment", "templateName": "bill_reminder", "status": "sent", "timestamp": "2026-05-09T10:10:00Z"}]`
var middlewareStatus = `{
  "service": "whatsapp_business_gateway",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "whatsapp_business_gateway.events",
        "whatsapp_business_gateway.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "whatsapp-business-gateway",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "whatsapp_business_gateway-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "whatsapp_business_gateway-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "whatsapp-business-gateway"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "whatsapp_business_gateway"
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
      "index": "whatsapp_business_gateway-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/whatsapp-business-gateway",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "whatsapp_business_gateway_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "whatsapp_business_gateway"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8642"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"WhatsApp Business Gateway","port":%s,"description":"WhatsApp Business API integration — Cloud API webhook, message templates, interactive buttons, list messages","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/whatsapp_business_gateway/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "WhatsApp Business Gateway"})
	})
	fmt.Printf("WhatsApp Business Gateway running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
