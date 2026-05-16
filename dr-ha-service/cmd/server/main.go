package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8113"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/dr/status", handleDRStatus)
	mux.HandleFunc("/api/v1/dr/failover", handleFailover)
	mux.HandleFunc("/api/v1/dr/backup-status", handleBackupStatus)
	mux.HandleFunc("/api/v1/dr/rpo-rto", handleRPORTO)
	mux.HandleFunc("/api/v1/dr/regions", handleRegions)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"dr-ha-service"}`))
	})
	log.Printf("DR/HA Service starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

func handleDRStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"overall_status": "healthy",
		"primary_region": map[string]interface{}{
			"name": "Lagos (AWS af-south-1)", "status": "active", "uptime_pct": 99.97,
			"services_healthy": 42, "services_total": 42,
		},
		"secondary_region": map[string]interface{}{
			"name": "Nairobi (GCP africa-south1)", "status": "standby", "replication_lag_ms": 250,
			"last_sync": time.Now().Add(-1 * time.Minute).Format(time.RFC3339),
		},
		"last_failover_test": "2026-04-15T03:00:00Z",
		"last_failover_test_result": "success",
		"last_failover_test_duration_sec": 45,
	})
}

func handleFailover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"action":     "failover_initiated",
		"from":       "Lagos (af-south-1)",
		"to":         "Nairobi (africa-south1)",
		"estimated_time_sec": 30,
		"status":     "in_progress",
		"steps": []map[string]interface{}{
			{"step": 1, "action": "DNS failover", "status": "completed", "duration_ms": 2000},
			{"step": 2, "action": "Database promotion", "status": "in_progress", "duration_ms": 0},
			{"step": 3, "action": "Service health checks", "status": "pending"},
			{"step": 4, "action": "Traffic routing", "status": "pending"},
		},
	})
}

func handleBackupStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"backups": []map[string]interface{}{
			{"type": "database_full", "schedule": "daily 02:00 UTC", "last_backup": "2026-05-16T02:00:00Z", "size_gb": 45, "status": "completed", "retention_days": 30},
			{"type": "database_incremental", "schedule": "hourly", "last_backup": "2026-05-16T15:00:00Z", "size_gb": 2, "status": "completed", "retention_days": 7},
			{"type": "document_store", "schedule": "daily 03:00 UTC", "last_backup": "2026-05-16T03:00:00Z", "size_gb": 120, "status": "completed", "retention_days": 90},
			{"type": "config_snapshots", "schedule": "on_change", "last_backup": "2026-05-15T14:30:00Z", "size_gb": 0.1, "status": "completed", "retention_days": 365},
		},
		"total_backup_size_gb": 167.1,
		"monthly_storage_cost_usd": 85,
	})
}

func handleRPORTO(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sla": map[string]interface{}{
			"target_uptime":  "99.95%",
			"actual_uptime":  "99.97%",
			"target_rpo":     "1 hour",
			"actual_rpo":     "15 minutes",
			"target_rto":     "4 hours",
			"actual_rto":     "30 minutes",
		},
		"incidents_ytd": []map[string]interface{}{
			{"date": "2026-02-10", "duration_min": 12, "impact": "partial", "root_cause": "Database connection pool exhaustion", "resolved_by": "auto-scaling"},
			{"date": "2026-03-25", "duration_min": 5, "impact": "none", "root_cause": "Network blip af-south-1a", "resolved_by": "AZ failover"},
		},
	})
}

func handleRegions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"regions": []map[string]interface{}{
			{"name": "Lagos", "provider": "AWS", "region": "af-south-1", "role": "primary", "status": "active", "latency_ms": 5},
			{"name": "Nairobi", "provider": "GCP", "region": "africa-south1", "role": "secondary", "status": "standby", "latency_ms": 45},
			{"name": "Johannesburg", "provider": "Azure", "region": "southafricanorth", "role": "disaster_recovery", "status": "cold_standby", "latency_ms": 60},
		},
	})
}
