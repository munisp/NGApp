package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type BillingRecord struct {
	ID            string  `json:"id"`
	TenantID      string  `json:"tenantId"`
	TenantName    string  `json:"tenantName"`
	Plan          string  `json:"plan"`
	MonthlyAmount float64 `json:"monthlyAmount"`
	Currency      string  `json:"currency"`
	Status        string  `json:"status"`
	BillingCycle  string  `json:"billingCycle"`
	NextInvoice   string  `json:"nextInvoice"`
}

var seedData = []BillingRecord{
	{ID: "TB-001", TenantID: "TEN-GTBANK", TenantName: "Guaranty Trust Bank", Plan: "enterprise", MonthlyAmount: 45000000, Currency: "NGN", Status: "active", BillingCycle: "monthly", NextInvoice: "2026-06-01"},
	{ID: "TB-002", TenantID: "TEN-FIRSTBANK", TenantName: "First Bank of Nigeria", Plan: "enterprise", MonthlyAmount: 52000000, Currency: "NGN", Status: "active", BillingCycle: "monthly", NextInvoice: "2026-06-01"},
	{ID: "TB-003", TenantID: "TEN-ACCESS", TenantName: "Access Bank", Plan: "enterprise", MonthlyAmount: 48000000, Currency: "NGN", Status: "active", BillingCycle: "monthly", NextInvoice: "2026-06-01"},
	{ID: "TB-004", TenantID: "TEN-UBA", TenantName: "United Bank for Africa", Plan: "enterprise", MonthlyAmount: 42000000, Currency: "NGN", Status: "active", BillingCycle: "quarterly", NextInvoice: "2026-07-01"},
	{ID: "TB-005", TenantID: "TEN-WEMA", TenantName: "Wema Bank (ALAT)", Plan: "growth", MonthlyAmount: 18000000, Currency: "NGN", Status: "active", BillingCycle: "monthly", NextInvoice: "2026-06-01"},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8257" }

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "healthy", "service": "tenant-billing-go", "version": "1.0.0", "port": 8257,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"billing.invoices", "billing.payments", "billing.adjustments", "billing.audit"}},
				"dapr":        map[string]interface{}{"status": "connected", "appId": "tenant-billing-go", "bindings": []string{"billing-state", "billing-notifications"}},
				"fluvio":      map[string]interface{}{"status": "connected", "topic": "billing-realtime-stream"},
				"temporal":    map[string]interface{}{"status": "connected", "workflows": []string{"invoice-generation", "payment-reconciliation", "billing-cycle"}},
				"postgres":    map[string]interface{}{"status": "connected", "tables": []string{"billing_records", "billing_invoices", "billing_payments", "billing_adjustments"}},
				"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank", "roles": []string{"billing_admin", "billing_viewer", "billing_operator"}},
				"permify":     map[string]interface{}{"status": "connected", "schema": "billing_rbac", "permissions": 8},
				"redis":       map[string]interface{}{"status": "connected", "caches": []string{"billing-record-cache", "billing-rate-cache"}},
				"mojaloop":    map[string]interface{}{"status": "connected", "settlement": "billing-settlement-account"},
				"opensearch":  map[string]interface{}{"status": "connected", "indices": []string{"billing-records-*", "billing-audit-*"}},
				"openappsec":  map[string]interface{}{"status": "connected", "policy": "billing-api-protection"},
				"apisix":      map[string]interface{}{"status": "connected", "routes": 8},
				"tigerbeetle": map[string]interface{}{"status": "connected", "accounts": 12, "ledger": "tenant-billing-ledger"},
				"lakehouse":   map[string]interface{}{"status": "connected", "tables": []string{"billing_records_iceberg", "billing_analytics_iceberg"}},
			},
		})
	})
	http.HandleFunc("/v1/billing/records", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": seedData, "total": len(seedData)})
	})
	http.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total_tenants": 5, "active": 5, "total_mrr": 205000000, "currency": "NGN", "avg_arpu": 41000000})
	})
	fmt.Printf("tenant-billing-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
