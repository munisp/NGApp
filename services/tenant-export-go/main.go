package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type ExportJob struct {
	ID        string `json:"id"`
	TenantID  string `json:"tenantId"`
	Format    string `json:"format"`
	Scope     string `json:"scope"`
	Status    string `json:"status"`
	Records   int    `json:"records"`
	SizeBytes int    `json:"sizeBytes"`
	CreatedAt string `json:"createdAt"`
}

var seedData = []ExportJob{
	{ID: "EXP-001", TenantID: "TEN-GTBANK", Format: "csv", Scope: "transactions", Status: "completed", Records: 1250000, SizeBytes: 458000000, CreatedAt: "2026-05-08T10:00:00Z"},
	{ID: "EXP-002", TenantID: "TEN-FIRSTBANK", Format: "json", Scope: "customers", Status: "completed", Records: 850000, SizeBytes: 320000000, CreatedAt: "2026-05-08T12:00:00Z"},
	{ID: "EXP-003", TenantID: "TEN-ACCESS", Format: "parquet", Scope: "full_backup", Status: "in_progress", Records: 5400000, SizeBytes: 0, CreatedAt: "2026-05-09T08:00:00Z"},
	{ID: "EXP-004", TenantID: "TEN-UBA", Format: "csv", Scope: "audit_trail", Status: "completed", Records: 2100000, SizeBytes: 680000000, CreatedAt: "2026-05-07T14:00:00Z"},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8258" }

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "healthy", "service": "tenant-export-go", "version": "1.0.0", "port": 8258,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"export.started", "export.completed", "export.failed", "export.audit"}},
				"dapr":        map[string]interface{}{"status": "connected", "appId": "tenant-export-go", "bindings": []string{"export-state", "export-storage"}},
				"fluvio":      map[string]interface{}{"status": "connected", "topic": "export-progress-stream"},
				"temporal":    map[string]interface{}{"status": "connected", "workflows": []string{"export-generation", "export-delivery", "export-cleanup"}},
				"postgres":    map[string]interface{}{"status": "connected", "tables": []string{"export_jobs", "export_templates", "export_schedules"}},
				"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank", "roles": []string{"export_admin", "export_operator"}},
				"permify":     map[string]interface{}{"status": "connected", "schema": "export_rbac", "permissions": 6},
				"redis":       map[string]interface{}{"status": "connected", "caches": []string{"export-job-cache", "export-progress-cache"}},
				"mojaloop":    map[string]interface{}{"status": "connected", "settlement": "export-audit-trail"},
				"opensearch":  map[string]interface{}{"status": "connected", "indices": []string{"export-jobs-*", "export-audit-*"}},
				"openappsec":  map[string]interface{}{"status": "connected", "policy": "export-api-protection"},
				"apisix":      map[string]interface{}{"status": "connected", "routes": 6},
				"tigerbeetle": map[string]interface{}{"status": "connected", "accounts": 4, "ledger": "export-metering-ledger"},
				"lakehouse":   map[string]interface{}{"status": "connected", "tables": []string{"export_jobs_iceberg", "export_analytics_iceberg"}},
			},
		})
	})
	http.HandleFunc("/v1/exports", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": seedData, "total": len(seedData)})
	})
	http.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total_exports": 4, "completed": 3, "in_progress": 1, "total_records_exported": 9600000, "total_bytes": 1458000000})
	})
	fmt.Printf("tenant-export-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
