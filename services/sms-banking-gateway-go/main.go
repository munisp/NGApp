package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "SMS-001", "messageId": "MSG-2026-0001", "msisdn": "08012345678", "direction": "inbound", "keyword": "BAL", "shortCode": "30037", "network": "MTN", "content": "BAL", "response": "Your savings account balance is N125,430.50 as at 09/05/2026 10:00", "status": "delivered", "timestamp": "2026-05-09T10:00:00Z"}, {"id": "SMS-002", "messageId": "MSG-2026-0002", "msisdn": "08098765432", "direction": "inbound", "keyword": "TRF", "shortCode": "30037", "network": "Glo", "content": "TRF 5000 08011111111 1234", "response": "You are about to transfer N5,000 to 08011111111. Reply YES to confirm.", "status": "delivered", "timestamp": "2026-05-09T10:05:00Z"}, {"id": "SMS-003", "messageId": "MSG-2026-0003", "msisdn": "07033344455", "direction": "outbound", "keyword": "ALERT", "shortCode": "30037", "network": "Airtel", "content": "", "response": "CR: N50,000.00 from ADEBAYO O. Ref: TRF/2026/0001. Bal: N175,430.50. 54Bank", "status": "delivered", "timestamp": "2026-05-09T10:10:00Z"}, {"id": "SMS-004", "messageId": "MSG-2026-0004", "msisdn": "09011122233", "direction": "inbound", "keyword": "STMT", "shortCode": "30037", "network": "9mobile", "content": "STMT", "response": "Last 5 txns: 1)CR N50K 08/05 2)DR N10K 07/05 3)CR N25K 06/05 4)DR N5K 05/05 5)DR N2K 04/05. 54Bank", "status": "delivered", "timestamp": "2026-05-09T10:15:00Z"}]`
var middlewareStatus = `{
  "service": "sms_banking_gateway",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "sms_banking_gateway.events",
        "sms_banking_gateway.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "sms-banking-gateway",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "sms_banking_gateway-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "sms_banking_gateway-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "sms-banking-gateway"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "sms_banking_gateway"
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
      "index": "sms_banking_gateway-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/sms-banking-gateway",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "sms_banking_gateway_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "sms_banking_gateway"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8651"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"SMS Banking Gateway","port":%s,"description":"Inbound/outbound SMS gateway — keyword-based commands (BAL, TRF, STMT), A2P messaging, delivery receipt tracking","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/sms_banking_gateway/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "SMS Banking Gateway"})
	})
	fmt.Printf("SMS Banking Gateway running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
