package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func middlewareConfig() map[string]interface{} {
	return map[string]interface{}{
		"kafka":       map[string]interface{}{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "mojaloop.settlement.windows,mojaloop.settlement.positions"},
		"redis":       map[string]interface{}{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "settlement-state,net-position-cache"},
		"postgres":    map[string]interface{}{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "settlement_windows,settlement_models,net_positions"},
		"tigerbeetle": map[string]interface{}{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "settlement-account-posting"},
		"dapr":        map[string]interface{}{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "settlement-events"},
		"temporal":    map[string]interface{}{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "SettlementWindowWorkflow"},
		"opensearch":  map[string]interface{}{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "settlement-*"},
		"keycloak":    map[string]interface{}{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
		"permify":     map[string]interface{}{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "settlement:manage"},
		"fluvio":      map[string]interface{}{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "settlement-stream"},
		"mojaloop":    map[string]interface{}{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "role": "settlement-manager"},
		"apisix":      map[string]interface{}{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/mojaloop/settlement/*"},
		"openappsec":  map[string]interface{}{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "settlement-protection"},
		"lakehouse":   map[string]interface{}{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "settlement_history,net_position_snapshots"},
	}
}

func main() {
	port := getEnv("PORT", "8268")
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "mojaloop-settlement-mgr-go", "port": port, "middleware": middlewareConfig()})
	})
	mux.HandleFunc("/v1/settlement/windows", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"items": []interface{}{}, "total": 0})
	})
	mux.HandleFunc("/v1/settlement/models", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"items": []interface{}{}, "total": 0})
	})
	log.Printf("Mojaloop Settlement Manager (Go) listening on :%s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
