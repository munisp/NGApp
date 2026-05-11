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
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": "tenant-billing-go", "port": 8257, "timestamp": time.Now().UTC().Format(time.RFC3339)})
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
