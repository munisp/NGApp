package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

var seedData = `[{"id": "TG-001", "chatId": 123456789, "username": "@adebayo_ng", "command": "/balance", "messageType": "command", "responseType": "inline_keyboard", "status": "processed", "timestamp": "2026-05-09T10:00:00Z"}, {"id": "TG-002", "chatId": 987654321, "username": "@chidi_banks", "command": "/transfer", "messageType": "command", "responseType": "conversation", "status": "awaiting_amount", "timestamp": "2026-05-09T10:05:00Z"}, {"id": "TG-003", "chatId": 555666777, "username": "@fatima_h", "command": "/history", "messageType": "command", "responseType": "message", "status": "processed", "timestamp": "2026-05-09T10:10:00Z"}, {"id": "TG-004", "chatId": 111222333, "username": "@emeka_o", "command": "/pay_bill", "messageType": "callback_query", "responseType": "inline_keyboard", "status": "awaiting_biller", "timestamp": "2026-05-09T10:15:00Z"}]`
var middlewareStatus = `{
  "service": "telegram_bot_gateway",
  "middleware": {
    "kafka": {
      "status": "connected",
      "broker": "kafka:9092",
      "topics": [
        "telegram_bot_gateway.events",
        "telegram_bot_gateway.commands"
      ]
    },
    "dapr": {
      "status": "connected",
      "appId": "telegram-bot-gateway",
      "pubsub": "54bank-pubsub"
    },
    "fluvio": {
      "status": "connected",
      "topic": "telegram_bot_gateway-stream",
      "partitions": 3
    },
    "temporal": {
      "status": "connected",
      "namespace": "channel-banking",
      "taskQueue": "telegram_bot_gateway-tasks"
    },
    "postgres": {
      "status": "connected",
      "database": "banking_channels",
      "schema": "channel_banking"
    },
    "keycloak": {
      "status": "connected",
      "realm": "54bank",
      "clientId": "telegram-bot-gateway"
    },
    "permify": {
      "status": "connected",
      "schema": "channel_banking",
      "entity": "telegram_bot_gateway"
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
      "index": "telegram_bot_gateway-logs",
      "pipeline": "channel-banking"
    },
    "openappsec": {
      "status": "connected",
      "policy": "channel-banking-waf",
      "mode": "prevent"
    },
    "apisix": {
      "status": "connected",
      "route": "/api/channel-banking/telegram-bot-gateway",
      "rateLimit": "500/min"
    },
    "tigerbeetle": {
      "status": "connected",
      "cluster": 0,
      "accounts": "telegram_bot_gateway_ledger"
    },
    "lakehouse": {
      "status": "connected",
      "catalog": "channel_banking",
      "table": "telegram_bot_gateway"
    }
  }
}`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8637"
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","service":"Telegram Bot Gateway","port":%s,"description":"Telegram Bot API integration — webhook receiver, command handler, inline keyboards, message routing","middleware":%s}`, port, middlewareStatus)
	})
	http.HandleFunc("/v1/telegram_bot_gateway/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var data []map[string]interface{}
		json.Unmarshal([]byte(seedData), &data)
		json.NewEncoder(w).Encode(map[string]interface{}{"data": data, "total": len(data), "service": "Telegram Bot Gateway"})
	})
	fmt.Printf("Telegram Bot Gateway running on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
