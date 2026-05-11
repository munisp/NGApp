package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type Migration struct {
	ID        string `json:"id"`
	Version   string `json:"version"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	AppliedAt string `json:"appliedAt"`
	Duration  int    `json:"durationMs"`
}

var seedData = []Migration{
	{ID: "MIG-001", Version: "001", Name: "create_customers_table", Status: "applied", AppliedAt: "2026-01-15T10:00:00Z", Duration: 120},
	{ID: "MIG-002", Version: "002", Name: "create_accounts_table", Status: "applied", AppliedAt: "2026-01-15T10:01:00Z", Duration: 85},
	{ID: "MIG-003", Version: "003", Name: "create_transactions_table", Status: "applied", AppliedAt: "2026-01-15T10:02:00Z", Duration: 200},
	{ID: "MIG-004", Version: "004", Name: "add_tenant_rls_policies", Status: "applied", AppliedAt: "2026-02-01T08:00:00Z", Duration: 350},
	{ID: "MIG-005", Version: "005", Name: "create_audit_trail_table", Status: "applied", AppliedAt: "2026-03-10T09:00:00Z", Duration: 95},
	{ID: "MIG-006", Version: "006", Name: "add_kyc_verification_columns", Status: "applied", AppliedAt: "2026-04-01T10:00:00Z", Duration: 150},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8261" }

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": "db-migrations", "port": 8261, "timestamp": time.Now().UTC().Format(time.RFC3339)})
	})
	http.HandleFunc("/v1/migrations", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": seedData, "total": len(seedData)})
	})
	http.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total_migrations": 6, "applied": 6, "pending": 0, "last_migration": "006", "last_applied": "2026-04-01T10:00:00Z"})
	})
	fmt.Printf("db-migrations listening on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
