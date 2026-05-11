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
		"kafka":       map[string]interface{}{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "mojaloop.admin.participants,mojaloop.admin.limits,mojaloop.admin.endpoints"},
		"redis":       map[string]interface{}{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "participant-cache,limit-tracking"},
		"postgres":    map[string]interface{}{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "mojaloop_participants,participant_limits,participant_endpoints"},
		"tigerbeetle": map[string]interface{}{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "participant-position-accounts"},
		"dapr":        map[string]interface{}{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "admin-events"},
		"temporal":    map[string]interface{}{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "ParticipantOnboardingWorkflow"},
		"opensearch":  map[string]interface{}{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "mojaloop-admin-*"},
		"keycloak":    map[string]interface{}{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
		"permify":     map[string]interface{}{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "mojaloop:admin"},
		"fluvio":      map[string]interface{}{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "mojaloop-admin-stream"},
		"mojaloop":    map[string]interface{}{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "role": "admin-api"},
		"apisix":      map[string]interface{}{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/mojaloop/admin/*"},
		"openappsec":  map[string]interface{}{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "mojaloop-admin-protection"},
		"lakehouse":   map[string]interface{}{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "participant_history,limit_audit"},
	}
}

func main() {
	port := getEnv("PORT", "8269")
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "mojaloop-admin-go", "port": port, "middleware": middlewareConfig()})
	})
	mux.HandleFunc("/v1/admin/participants", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"items": []interface{}{}, "total": 0})
	})
	mux.HandleFunc("/v1/admin/limits", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"items": []interface{}{}, "total": 0})
	})
	log.Printf("Mojaloop Admin API (Go) listening on :%s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
