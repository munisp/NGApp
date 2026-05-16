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
		port = "8101"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/payouts/initiate", handleInitiatePayout)
	mux.HandleFunc("/api/v1/payouts/batch", handleBatchPayout)
	mux.HandleFunc("/api/v1/payouts/status/", handlePayoutStatus)
	mux.HandleFunc("/api/v1/payouts/channels", handlePayoutChannels)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"instant-payout-service"}`))
	})
	log.Printf("Instant Payout Service starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

type PayoutRequest struct {
	ClaimID      string  `json:"claim_id"`
	PolicyID     string  `json:"policy_id"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Recipient    string  `json:"recipient_name"`
	Channel      string  `json:"channel"` // mobile_money, bank_transfer, wallet
	AccountRef   string  `json:"account_ref"` // phone number or bank account
	Provider     string  `json:"provider,omitempty"`
	Reason       string  `json:"reason"`
}

type PayoutResponse struct {
	PayoutID     string    `json:"payout_id"`
	Status       string    `json:"status"`
	Amount       float64   `json:"amount"`
	Currency     string    `json:"currency"`
	Channel      string    `json:"channel"`
	Reference    string    `json:"reference"`
	EstimatedTime string   `json:"estimated_time"`
	CreatedAt    time.Time `json:"created_at"`
}

func handleInitiatePayout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req PayoutRequest
	json.NewDecoder(r.Body).Decode(&req)
	if req.Currency == "" {
		req.Currency = "NGN"
	}

	payoutID := fmt.Sprintf("PYT-%d", time.Now().UnixNano()%10000000)
	estimatedTime := "instant"
	switch req.Channel {
	case "mobile_money":
		estimatedTime = "< 30 seconds"
	case "bank_transfer":
		estimatedTime = "< 5 minutes (NIBSS Instant Payment)"
	case "wallet":
		estimatedTime = "instant"
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(PayoutResponse{
		PayoutID:      payoutID,
		Status:        "processing",
		Amount:        req.Amount,
		Currency:      req.Currency,
		Channel:       req.Channel,
		Reference:     fmt.Sprintf("NGA-PYT-%s", payoutID),
		EstimatedTime: estimatedTime,
		CreatedAt:     time.Now(),
	})
}

func handleBatchPayout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"batch_id":    fmt.Sprintf("BATCH-%d", time.Now().UnixNano()%1000000),
		"status":      "queued",
		"total_items": 0,
		"message":     "Batch payout queued for processing",
	})
}

func handlePayoutStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "completed",
		"completed_at": time.Now().Format(time.RFC3339),
	})
}

func handlePayoutChannels(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"channels": []map[string]interface{}{
			{"id": "mobile_money", "name": "Mobile Money", "providers": []string{"OPay", "PalmPay", "MTN MoMo", "Airtel Money"}, "speed": "instant", "limit": 5000000, "fee_pct": 0.5},
			{"id": "bank_transfer", "name": "Bank Transfer (NIBSS)", "providers": []string{"All Nigerian banks"}, "speed": "< 5 minutes", "limit": 50000000, "fee_pct": 0.25},
			{"id": "wallet", "name": "NGApp Wallet", "providers": []string{"NGApp"}, "speed": "instant", "limit": 10000000, "fee_pct": 0},
		},
	})
}
