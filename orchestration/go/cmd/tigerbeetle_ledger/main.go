// NDSEP TigerBeetle Ledger Service (Go) - Double-entry accounting. Port 8240.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

var (
	logger  = log.New(os.Stdout, "[tigerbeetle] ", log.LstdFlags)
	mu      sync.RWMutex
	ledger  []map[string]interface{}
	summary = map[string]interface{}{
		"total_penalties_issued":  0.0,
		"total_penalties_paid":    0.0,
		"total_penalties_pending": 0.0,
		"total_escrow_held":       0.0,
		"total_distributed":       0.0,
		"entry_count":             0,
	}
)

func newID() string {
	return fmt.Sprintf("tb-%d-%d", time.Now().UnixNano(), rand.Intn(9999))
}

func health(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	count := len(ledger)
	mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "tigerbeetle-ledger", "status": "healthy",
		"entry_count": count, "timestamp": time.Now().UTC(),
	})
}

func issuePenalty(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OrgID       string  `json:"org_id"`
		ViolationID string  `json:"violation_id"`
		AmountUSD   float64 `json:"amount_usd"`
		Currency    string  `json:"currency"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	txID := newID()
	entry := map[string]interface{}{
		"id": txID, "tx_type": "penalty_issued",
		"debit_account": "penalty_receivable", "credit_account": "penalty_revenue",
		"amount_usd": req.AmountUSD, "currency": req.Currency,
		"org_id": req.OrgID, "violation_id": req.ViolationID,
		"status": "posted", "created_at": time.Now().UTC(),
	}
	mu.Lock()
	ledger = append(ledger, entry)
	summary["total_penalties_issued"] = summary["total_penalties_issued"].(float64) + req.AmountUSD
	summary["total_penalties_pending"] = summary["total_penalties_pending"].(float64) + req.AmountUSD
	summary["entry_count"] = summary["entry_count"].(int) + 1
	mu.Unlock()
	logger.Printf("PENALTY_ISSUED tx=%s org=%s amount=%.2f", txID, req.OrgID, req.AmountUSD)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "tx_id": txID, "status": "posted"})
}

func payPenalty(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PenaltyID  string  `json:"penalty_id"`
		OrgID      string  `json:"org_id"`
		AmountUSD  float64 `json:"amount_usd"`
		PaymentRef string  `json:"payment_ref"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	txID := newID()
	entry := map[string]interface{}{
		"id": txID, "tx_type": "penalty_paid",
		"debit_account": "penalty_revenue", "credit_account": "government_fund",
		"amount_usd": req.AmountUSD, "currency": "USD",
		"org_id": req.OrgID, "penalty_id": req.PenaltyID,
		"payment_ref": req.PaymentRef, "status": "settled", "created_at": time.Now().UTC(),
	}
	mu.Lock()
	ledger = append(ledger, entry)
	summary["total_penalties_paid"] = summary["total_penalties_paid"].(float64) + req.AmountUSD
	summary["total_penalties_pending"] = summary["total_penalties_pending"].(float64) - req.AmountUSD
	summary["entry_count"] = summary["entry_count"].(int) + 1
	mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "tx_id": txID, "status": "settled"})
}

func getSummary(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	s := make(map[string]interface{})
	for k, v := range summary { s[k] = v }
	s["last_updated"] = time.Now().UTC()
	mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func getEntries(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	entries := make([]map[string]interface{}, len(ledger))
	copy(entries, ledger)
	mu.RUnlock()
	if len(entries) > 50 { entries = entries[len(entries)-50:] }
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"entries": entries, "total": len(ledger)})
}

// ── Kafka publisher ────────────────────────────────────────────────────────────
func publishToKafka(topic string, payload interface{}) {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		return
	}
	proxyURL := os.Getenv("KAFKA_REST_PROXY_URL")
	if proxyURL == "" {
		proxyURL = "http://localhost:8082"
	}
	data, _ := json.Marshal(map[string]interface{}{
		"records": []map[string]interface{}{{"value": payload}},
	})
	client := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequest("POST", fmt.Sprintf("%s/topics/%s", proxyURL, topic), nil)
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/vnd.kafka.json.v2+json")
	_ = data
	_, _ = client.Do(req)
}

// ── Redis cache helper ─────────────────────────────────────────────────────────
func cacheSet(key string, value interface{}, ttlSeconds int) {
	webdisURL := os.Getenv("REDIS_WEBDIS_URL")
	if webdisURL == "" {
		webdisURL = "http://localhost:7379"
	}
	data, _ := json.Marshal(value)
	client := &http.Client{Timeout: 2 * time.Second}
	url := fmt.Sprintf("%s/SET/%s/%s/EX/%d", webdisURL, key, string(data), ttlSeconds)
	req, _ := http.NewRequest("GET", url, nil)
	_, _ = client.Do(req)
}

func toFloat(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	default:
		return 0
	}
}

// ── Balance endpoint with Redis caching ───────────────────────────────────────
func getBalance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	orgID := vars["org_id"]
	mu.RLock()
	var debits, credits float64
	for _, e := range ledger {
		if fmt.Sprintf("%v", e["org_id"]) == orgID {
			if e["entry_type"] == "debit" {
				debits += toFloat(e["amount_usd"])
			} else {
				credits += toFloat(e["amount_usd"])
			}
		}
	}
	mu.RUnlock()
	balance := map[string]interface{}{
		"org_id": orgID, "total_debits": debits, "total_credits": credits,
		"net_balance": debits - credits, "currency": "USD",
		"status": "ACTIVE", "timestamp": time.Now().UTC(),
	}
	cacheSet(fmt.Sprintf("tb:balance:%s", orgID), balance, 30)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(balance)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8240" }
	r := mux.NewRouter()
	r.HandleFunc("/health", health).Methods(http.MethodGet)
	r.HandleFunc("/ledger/penalty/issue", issuePenalty).Methods(http.MethodPost)
	r.HandleFunc("/ledger/penalty/pay", payPenalty).Methods(http.MethodPost)
	r.HandleFunc("/ledger/summary", getSummary).Methods(http.MethodGet)
	r.HandleFunc("/ledger/entries", getEntries).Methods(http.MethodGet)
	r.HandleFunc("/ledger/balance/{org_id}", getBalance).Methods(http.MethodGet)
	logger.Printf("NDSEP TigerBeetle Ledger starting on :%s (Kafka=%s)", port, os.Getenv("KAFKA_BROKERS"))
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), r); err != nil {
		logger.Fatalf("Server failed: %v", err)
	}
}
