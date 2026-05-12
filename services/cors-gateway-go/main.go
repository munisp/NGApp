package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8313" }

	corsPolicy := map[string]interface{}{
		"allowed_origins": []string{"https://app.54bank.app", "https://admin.54bank.app", "https://api.54bank.app", "https://partner.54bank.app"},
		"allowed_methods": []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		"allowed_headers": []string{"Authorization", "Content-Type", "X-Correlation-ID", "X-Request-ID", "X-Tenant-ID", "X-API-Version", "Accept", "Origin"},
		"exposed_headers": []string{"X-Request-ID", "X-Correlation-ID", "X-RateLimit-Remaining", "X-RateLimit-Reset"},
		"max_age_seconds": 3600, "allow_credentials": true,
		"preflight_cache":  true, "vary_header":       true,
		"enforcement": map[string]interface{}{
			"mode": "strict", "block_null_origin": true, "block_wildcard": true,
			"log_violations": true, "violations_24h": 847,
		},
		"origin_whitelist": []map[string]interface{}{
			{"origin": "https://app.54bank.app", "description": "Customer PWA", "added": "2026-01-15", "tier": "production"},
			{"origin": "https://admin.54bank.app", "description": "Admin Dashboard", "added": "2026-01-15", "tier": "production"},
			{"origin": "https://api.54bank.app", "description": "API Portal", "added": "2026-02-01", "tier": "production"},
			{"origin": "https://partner.54bank.app", "description": "Partner Portal", "added": "2026-03-01", "tier": "production"},
			{"origin": "https://sandbox.54bank.app", "description": "Sandbox", "added": "2026-04-01", "tier": "staging"},
			{"origin": "http://localhost:3000", "description": "Local Dev", "added": "2026-01-01", "tier": "development"},
		},
	}

	mw := map[string]interface{}{
		"kafka": map[string]interface{}{"topics": []string{"cors.violations", "cors.policy.changes"}},
		"dapr": map[string]interface{}{"stateStore": "cors-state"}, "fluvio": map[string]interface{}{"topics": []string{"cors-events"}},
		"temporal": map[string]interface{}{"workflows": []string{"cors-policy-update"}},
		"postgres": map[string]interface{}{"tables": []string{"cors_policies", "cors_violations"}},
		"keycloak": map[string]interface{}{"roles": []string{"cors-admin"}},
		"permify": map[string]interface{}{"relations": []string{"cors:can_manage"}},
		"redis": map[string]interface{}{"keys": []string{"cors:policy:cache", "cors:origin:whitelist"}},
		"mojaloop": map[string]interface{}{"oracle": "cors-gateway"},
		"opensearch": map[string]interface{}{"indices": []string{"cors-violations"}},
		"openappsec": map[string]interface{}{"policy": "cors-protection"},
		"apisix": map[string]interface{}{"route": "/api/cors-gateway/*"},
		"tigerbeetle": map[string]interface{}{"accounts": []string{}},
		"lakehouse": map[string]interface{}{"tables": []string{"cors_analytics"}},
	}

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": "cors-gateway-go", "port": port})
	})
	http.HandleFunc("/api/cors-gateway/policy", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(corsPolicy)
	})
	http.HandleFunc("/api/cors-gateway/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(mw)
	})
	fmt.Printf("CORS Gateway on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
