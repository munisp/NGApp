package main
import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)
func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8316" }
	versions := map[string]interface{}{
		"current_version": "v2", "supported_versions": []string{"v1", "v2"},
		"deprecated_versions": []string{"v1"}, "sunset_v1": "2027-01-01",
		"version_strategy": "url_prefix", "header_fallback": "X-API-Version",
		"version_routes": []map[string]interface{}{
			{"version": "v2", "base": "/api/v2", "routes": 805, "status": "current", "released": "2026-05-01"},
			{"version": "v1", "base": "/api/v1", "routes": 340, "status": "deprecated", "released": "2025-09-01",
				"breaking_changes": []string{"pagination_format", "error_response_schema", "date_format_iso8601"}},
		},
		"migration_guide": map[string]interface{}{
			"v1_to_v2": []string{
				"Pagination: offset/limit → cursor-based", "Errors: {error: string} → {code, message, details}",
				"Dates: mixed → ISO 8601 everywhere", "Auth: API key → JWT Bearer + API key",
				"Rate limits: 1000/min → tiered by plan",
			},
		},
	}
	mw := map[string]interface{}{
		"kafka": map[string]interface{}{"topics": []string{"api.version.requests", "api.deprecation.warnings"}},
		"dapr": map[string]interface{}{"stateStore": "versioning-state"}, "fluvio": map[string]interface{}{"topics": []string{"versioning-events"}},
		"temporal": map[string]interface{}{"workflows": []string{"version-migration"}},
		"postgres": map[string]interface{}{"tables": []string{"api_versions", "api_deprecations"}},
		"keycloak": map[string]interface{}{"roles": []string{"api-admin"}},
		"permify": map[string]interface{}{"relations": []string{"api:can_manage_versions"}},
		"redis": map[string]interface{}{"keys": []string{"api:version:routing"}},
		"mojaloop": map[string]interface{}{"oracle": "api-version-oracle"},
		"opensearch": map[string]interface{}{"indices": []string{"api-version-analytics"}},
		"openappsec": map[string]interface{}{"policy": "api-version-protection"},
		"apisix": map[string]interface{}{"route": "/api/api-versioning/*"},
		"tigerbeetle": map[string]interface{}{"accounts": []string{}},
		"lakehouse": map[string]interface{}{"tables": []string{"api_version_analytics"}},
	}
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": "api-versioning-go", "port": port})
	})
	http.HandleFunc("/api/api-versioning/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(versions)
	})
	http.HandleFunc("/api/api-versioning/middleware", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(mw)
	})
	fmt.Printf("API Versioning Gateway on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
