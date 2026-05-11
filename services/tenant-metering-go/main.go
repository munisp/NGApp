package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// Tenant usage metering and billing: track API calls, storage, transactions,
// and compute per tenant for usage-based billing.

type UsageMeter struct {
	TenantID        string  `json:"tenantId"`
	Period          string  `json:"period"`
	APICallsCount   int64   `json:"apiCallsCount"`
	TransactionsCount int64 `json:"transactionsCount"`
	StorageMB       float64 `json:"storageMB"`
	KafkaMessagesCount int64 `json:"kafkaMessagesCount"`
	ActiveUsers     int     `json:"activeUsers"`
	BandwidthMB     float64 `json:"bandwidthMB"`
	ComputeMinutes  float64 `json:"computeMinutes"`
}

type BillingInvoice struct {
	ID          string  `json:"id"`
	TenantID    string  `json:"tenantId"`
	Period      string  `json:"period"`
	Status      string  `json:"status"`
	Subtotal    float64 `json:"subtotal"`
	Tax         float64 `json:"tax"`
	Total       float64 `json:"total"`
	Currency    string  `json:"currency"`
	DueDate     string  `json:"dueDate"`
	PaidAt      string  `json:"paidAt,omitempty"`
	LineItems   []LineItem `json:"lineItems"`
}

type LineItem struct {
	Description string  `json:"description"`
	Quantity    float64 `json:"quantity"`
	UnitPrice   float64 `json:"unitPrice"`
	Amount      float64 `json:"amount"`
}

var meters = []UsageMeter{
	{TenantID: "54bank-retail", Period: "2026-05", APICallsCount: 12450000, TransactionsCount: 284000, StorageMB: 2048.0, KafkaMessagesCount: 1560000, ActiveUsers: 45000, BandwidthMB: 8500.0, ComputeMinutes: 14400.0},
	{TenantID: "mutual-mfb", Period: "2026-05", APICallsCount: 2340000, TransactionsCount: 32400, StorageMB: 512.0, KafkaMessagesCount: 245000, ActiveUsers: 8500, BandwidthMB: 1200.0, ComputeMinutes: 4320.0},
	{TenantID: "xmts-agency", Period: "2026-05", APICallsCount: 1870000, TransactionsCount: 18700, StorageMB: 256.0, KafkaMessagesCount: 187000, ActiveUsers: 3200, BandwidthMB: 800.0, ComputeMinutes: 2880.0},
	{TenantID: "paystack-embed", Period: "2026-05", APICallsCount: 8760000, TransactionsCount: 87500, StorageMB: 1024.0, KafkaMessagesCount: 876000, ActiveUsers: 22000, BandwidthMB: 4500.0, ComputeMinutes: 8640.0},
}

var invoices = []BillingInvoice{
	{ID: "INV-001", TenantID: "mutual-mfb", Period: "2026-04", Status: "paid", Subtotal: 2450000, Tax: 183750, Total: 2633750, Currency: "NGN", DueDate: "2026-05-15", PaidAt: "2026-05-10T00:00:00Z", LineItems: []LineItem{
		{Description: "API Calls (2.1M)", Quantity: 2100000, UnitPrice: 0.5, Amount: 1050000},
		{Description: "Transactions (28K)", Quantity: 28000, UnitPrice: 25, Amount: 700000},
		{Description: "Storage (480MB)", Quantity: 480, UnitPrice: 500, Amount: 240000},
		{Description: "Active Users (7.5K)", Quantity: 7500, UnitPrice: 60, Amount: 450000},
	}},
	{ID: "INV-002", TenantID: "xmts-agency", Period: "2026-04", Status: "paid", Subtotal: 1680000, Tax: 126000, Total: 1806000, Currency: "NGN", DueDate: "2026-05-15", PaidAt: "2026-05-12T00:00:00Z", LineItems: []LineItem{
		{Description: "API Calls (1.6M)", Quantity: 1600000, UnitPrice: 0.5, Amount: 800000},
		{Description: "Transactions (16K)", Quantity: 16000, UnitPrice: 25, Amount: 400000},
		{Description: "Storage (230MB)", Quantity: 230, UnitPrice: 500, Amount: 115000},
		{Description: "Active Users (2.8K)", Quantity: 2800, UnitPrice: 60, Amount: 168000},
	}},
	{ID: "INV-003", TenantID: "paystack-embed", Period: "2026-04", Status: "overdue", Subtotal: 5890000, Tax: 441750, Total: 6331750, Currency: "NGN", DueDate: "2026-05-15", LineItems: []LineItem{
		{Description: "API Calls (7.8M)", Quantity: 7800000, UnitPrice: 0.5, Amount: 3900000},
		{Description: "Transactions (72K)", Quantity: 72000, UnitPrice: 15, Amount: 1080000},
		{Description: "Storage (950MB)", Quantity: 950, UnitPrice: 500, Amount: 475000},
		{Description: "Active Users (18K)", Quantity: 18000, UnitPrice: 25, Amount: 450000},
	}},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8237"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "healthy", "service": "tenant-metering-go", "port": port,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"middleware": []string{"kafka", "dapr", "fluvio", "temporal", "postgres", "keycloak", "permify", "redis", "mojaloop", "opensearch", "openappsec", "apisix", "tigerbeetle", "lakehouse"},
		})
	})

	mux.HandleFunc("/v1/meters", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": meters, "total": len(meters)})
	})

	mux.HandleFunc("/v1/invoices", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		paid := 0
		var totalRevenue float64
		for _, inv := range invoices {
			if inv.Status == "paid" {
				paid++
				totalRevenue += inv.Total
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"items": invoices, "total": len(invoices), "paid": paid, "totalRevenue": totalRevenue})
	})

	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var totalAPI, totalTxn int64
		for _, m := range meters {
			totalAPI += m.APICallsCount
			totalTxn += m.TransactionsCount
		}
		paid := 0
		var totalRevenue float64
		for _, inv := range invoices {
			if inv.Status == "paid" {
				paid++
				totalRevenue += inv.Total
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total_tenants": len(meters), "total_api_calls": totalAPI,
			"total_transactions": totalTxn, "total_invoices": len(invoices),
			"paid_invoices": paid, "overdue_invoices": len(invoices) - paid,
			"total_revenue": totalRevenue,
		})
	})

	log.Printf("tenant-metering-go listening on :%s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
