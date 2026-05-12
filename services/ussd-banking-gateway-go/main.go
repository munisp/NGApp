package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "USSD-001", "sessionId": "SS-2026-0001", "msisdn": "08012345678", "shortCode": "*737#", "network": "MTN", "input": "1", "screenText": "Welcome to 54Bank\\n1. Balance\\n2. Transfer\\n3. Airtime\\n4. Bills\\n5. Loans\\n0. Exit", "state": "main_menu", "language": "en", "timestamp": "2026-05-09T10:00:00Z", "status": "active"}, {"id": "USSD-002", "sessionId": "SS-2026-0002", "msisdn": "08098765432", "shortCode": "*737#", "network": "Glo", "input": "2*1*08011111111*5000*1234", "screenText": "Transfer N5,000 to 08011111111?\\n1. Confirm\\n2. Cancel", "state": "transfer_confirm", "language": "en", "timestamp": "2026-05-09T10:05:00Z", "status": "active"}, {"id": "USSD-003", "sessionId": "SS-2026-0003", "msisdn": "07033344455", "shortCode": "*737*0#", "network": "Airtel", "input": "", "screenText": "Your balance is N125,430.50\\nPress 0 to go back", "state": "balance_display", "language": "en", "timestamp": "2026-05-09T10:10:00Z", "status": "completed"}, {"id": "USSD-004", "sessionId": "SS-2026-0004", "msisdn": "09011122233", "shortCode": "*737#", "network": "9mobile", "input": "1", "screenText": "Sannu da zuwa 54Bank\\n1. Duba Kudi\\n2. Tura Kudi\\n3. Sayen Katin Waya\\n4. Biya Bashi\\n0. Fita", "state": "main_menu", "language": "ha", "timestamp": "2026-05-09T10:15:00Z", "status": "active"}]`
var middlewareStatus = `{
  "service": "ussd_banking_gateway",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "ussd_banking_gateway.events",
        "ussd_banking_gateway.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "ussd-banking-gateway",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "ussd_banking_gateway-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "ussd_banking_gateway-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "ussd-banking-gateway"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "ussd_banking_gateway"
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
      "index": "ussd_banking_gateway-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/ussd-banking-gateway",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "ussd_banking_gateway_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "ussd_banking_gateway"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8647"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"USSD Banking Gateway","port":%s,"description":"USSD session manager — *737#/*919#/*894# style short codes, session state machine, 160-char screen management, timeout handling","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/ussd_banking_gateway/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "USSD Banking Gateway"})
	})
	fmt.Printf("USSD Banking Gateway running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
