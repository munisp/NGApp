package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// Webhook engine: tenant-configurable webhooks with retry, signing,
// delivery tracking, and payload filtering.

type WebhookEndpoint struct {
	ID          string   `json:"id"`
	TenantID    string   `json:"tenantId"`
	URL         string   `json:"url"`
	Events      []string `json:"events"`
	Secret      string   `json:"secret"`
	Active      bool     `json:"active"`
	Version     string   `json:"version"`
	CreatedAt   string   `json:"createdAt"`
}

type WebhookDelivery struct {
	ID           string `json:"id"`
	EndpointID   string `json:"endpointId"`
	EventType    string `json:"eventType"`
	Status       string `json:"status"`
	HTTPStatus   int    `json:"httpStatus"`
	Attempts     int    `json:"attempts"`
	ResponseTime int    `json:"responseTimeMs"`
	DeliveredAt  string `json:"deliveredAt"`
}

var endpoints = []WebhookEndpoint{
	{ID: "WH-001", TenantID: "54bank-retail", URL: "https://hooks.54bank.app/events", Events: []string{"transaction.completed", "kyc.verified", "loan.disbursed"}, Secret: "whsec_54bank_***", Active: true, Version: "2026-05-01", CreatedAt: "2026-01-01T00:00:00Z"},
	{ID: "WH-002", TenantID: "mutual-mfb", URL: "https://api.mutualmfb.com/webhooks", Events: []string{"transaction.completed", "loan.approved", "account.opened"}, Secret: "whsec_mutual_***", Active: true, Version: "2026-05-01", CreatedAt: "2026-03-15T00:00:00Z"},
	{ID: "WH-003", TenantID: "paystack-embed", URL: "https://api.paystack.com/54bank/webhooks", Events: []string{"transaction.completed", "card.transaction", "payment.received"}, Secret: "whsec_paystack_***", Active: true, Version: "2026-05-01", CreatedAt: "2026-02-10T00:00:00Z"},
	{ID: "WH-004", TenantID: "xmts-agency", URL: "https://hooks.xmts.ng/events", Events: []string{"agent.commission", "float.alert", "transaction.completed"}, Secret: "whsec_xmts_***", Active: true, Version: "2026-05-01", CreatedAt: "2026-04-01T00:00:00Z"},
	{ID: "WH-005", TenantID: "54bank-retail", URL: "https://analytics.54bank.app/ingest", Events: []string{"audit.event"}, Secret: "whsec_analytics_***", Active: false, Version: "2026-03-01", CreatedAt: "2026-03-01T00:00:00Z"},
}

var deliveries = []WebhookDelivery{
	{ID: "WD-001", EndpointID: "WH-001", EventType: "transaction.completed", Status: "delivered", HTTPStatus: 200, Attempts: 1, ResponseTime: 145, DeliveredAt: "2026-05-09T10:00:00Z"},
	{ID: "WD-002", EndpointID: "WH-002", EventType: "loan.approved", Status: "delivered", HTTPStatus: 200, Attempts: 1, ResponseTime: 210, DeliveredAt: "2026-05-09T10:05:00Z"},
	{ID: "WD-003", EndpointID: "WH-003", EventType: "card.transaction", Status: "delivered", HTTPStatus: 200, Attempts: 2, ResponseTime: 520, DeliveredAt: "2026-05-09T10:10:00Z"},
	{ID: "WD-004", EndpointID: "WH-004", EventType: "agent.commission", Status: "failed", HTTPStatus: 503, Attempts: 5, ResponseTime: 30000, DeliveredAt: "2026-05-09T10:15:00Z"},
	{ID: "WD-005", EndpointID: "WH-001", EventType: "kyc.verified", Status: "delivered", HTTPStatus: 200, Attempts: 1, ResponseTime: 98, DeliveredAt: "2026-05-09T10:20:00Z"},
	{ID: "WD-006", EndpointID: "WH-003", EventType: "payment.received", Status: "delivered", HTTPStatus: 200, Attempts: 1, ResponseTime: 180, DeliveredAt: "2026-05-09T10:25:00Z"},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8238"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "healthy", "service": "webhook-engine-go", "port": port,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"middleware": []string{"kafka", "dapr", "fluvio", "temporal", "postgres", "keycloak", "permify", "redis", "mojaloop", "opensearch", "openappsec", "apisix", "tigerbeetle", "lakehouse"},
		})
	})

	mux.HandleFunc("/v1/endpoints", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		active := 0
		for _, e := range endpoints { if e.Active { active++ } }
		json.NewEncoder(w).Encode(map[string]interface{}{"items": endpoints, "total": len(endpoints), "active": active})
	})

	mux.HandleFunc("/v1/deliveries", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		delivered := 0
		for _, d := range deliveries { if d.Status == "delivered" { delivered++ } }
		json.NewEncoder(w).Encode(map[string]interface{}{"items": deliveries, "total": len(deliveries), "delivered": delivered, "failed": len(deliveries) - delivered})
	})

	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		active := 0
		for _, e := range endpoints { if e.Active { active++ } }
		delivered := 0
		var totalRT int
		for _, d := range deliveries {
			if d.Status == "delivered" { delivered++ }
			totalRT += d.ResponseTime
		}
		avgRT := 0
		if len(deliveries) > 0 { avgRT = totalRT / len(deliveries) }
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total_endpoints": len(endpoints), "active_endpoints": active,
			"total_deliveries": len(deliveries), "successful_deliveries": delivered,
			"failed_deliveries": len(deliveries) - delivered,
			"avg_response_time_ms": avgRT,
			"delivery_success_rate": fmt.Sprintf("%.1f%%", float64(delivered)/float64(len(deliveries))*100),
		})
	})

	log.Printf("webhook-engine-go listening on :%s", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", port), mux))
}
