package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type Card struct {
	ID             string `json:"id"`
	CardNumber     string `json:"cardNumber"`
	MaskedPAN      string `json:"maskedPAN"`
	AccountNumber  string `json:"accountNumber"`
	CustomerName   string `json:"customerName"`
	CardType       string `json:"cardType"`
	Scheme         string `json:"scheme"`
	Status         string `json:"status"`
	ExpiryDate     string `json:"expiryDate"`
	IssuedAt       string `json:"issuedAt"`
	DailyLimit     float64 `json:"dailyLimit"`
	InternationalEnabled bool `json:"internationalEnabled"`
	ContactlessEnabled   bool `json:"contactlessEnabled"`
	TokenizedDevices     int  `json:"tokenizedDevices"`
}

type CardRequest struct {
	ID            string `json:"id"`
	AccountNumber string `json:"accountNumber"`
	CustomerName  string `json:"customerName"`
	CardType      string `json:"cardType"`
	Scheme        string `json:"scheme"`
	Status        string `json:"status"`
	RequestedAt   string `json:"requestedAt"`
	ProcessedAt   string `json:"processedAt,omitempty"`
	Reason        string `json:"reason,omitempty"`
}

var (
	mu       sync.RWMutex
	cards    []Card
	requests []CardRequest
)

func init() {
	cards = []Card{
		{ID: "CARD-001", CardNumber: "5199XXXXXXXX4567", MaskedPAN: "5199****4567", AccountNumber: "0012345678", CustomerName: "Fatima Abdullahi", CardType: "debit", Scheme: "mastercard", Status: "active", ExpiryDate: "2028-12", IssuedAt: "2025-12-15T10:00:00Z", DailyLimit: 500000, InternationalEnabled: true, ContactlessEnabled: true, TokenizedDevices: 2},
		{ID: "CARD-002", CardNumber: "4065XXXXXXXX8901", MaskedPAN: "4065****8901", AccountNumber: "3034567890", CustomerName: "Ibrahim Musa", CardType: "credit", Scheme: "visa", Status: "active", ExpiryDate: "2027-06", IssuedAt: "2025-06-01T09:00:00Z", DailyLimit: 1000000, InternationalEnabled: true, ContactlessEnabled: true, TokenizedDevices: 1},
		{ID: "CARD-003", CardNumber: "5061XXXXXXXX2345", MaskedPAN: "5061****2345", AccountNumber: "2098765432", CustomerName: "Chioma Okafor", CardType: "debit", Scheme: "verve", Status: "blocked", ExpiryDate: "2026-09", IssuedAt: "2024-09-20T14:00:00Z", DailyLimit: 200000, InternationalEnabled: false, ContactlessEnabled: false, TokenizedDevices: 0},
	}
	requests = []CardRequest{
		{ID: "REQ-001", AccountNumber: "0012345678", CustomerName: "Fatima Abdullahi", CardType: "prepaid", Scheme: "mastercard", Status: "pending", RequestedAt: "2026-04-01T11:00:00Z"},
	}
}

func envOr(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
	"redis":       map[string]string{"url": envOr("REDIS_URL", "redis://localhost:6379")},
	"postgres":    map[string]string{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
	"opensearch":  map[string]string{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
	"keycloak":    map[string]string{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
	"permify":     map[string]string{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
	"dapr":        map[string]string{"url": envOr("DAPR_URL", "http://localhost:3500")},
	"fluvio":      map[string]string{"url": envOr("FLUVIO_URL", "localhost:9003")},
	"temporal":    map[string]string{"url": envOr("TEMPORAL_URL", "localhost:7233")},
	"mojaloop":    map[string]string{"url": envOr("MOJALOOP_URL", "http://localhost:3002")},
	"tigerbeetle": map[string]string{"url": envOr("TIGERBEETLE_URL", "localhost:3000")},
	"lakehouse":   map[string]string{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181")},
	"apisix":      map[string]string{"url": envOr("APISIX_URL", "http://localhost:9080")},
	"openappsec":  map[string]string{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000")},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8140"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "card-management", "port": port})
	})
	mux.HandleFunc("/v1/cards", handleCards)
	mux.HandleFunc("/v1/cards/requests", handleCardRequests)
	mux.HandleFunc("/v1/cards/block", handleBlock)
	mux.HandleFunc("/v1/cards/unblock", handleUnblock)
	mux.HandleFunc("/v1/cards/set-limit", handleSetLimit)
	mux.HandleFunc("/v1/cards/toggle-international", handleToggleInternational)
	mux.HandleFunc("/v1/cards/tokenize", handleTokenize)
	mux.HandleFunc("/v1/cards/replace", handleReplace)

	log.Printf("Card Management Service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleCards(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": cards, "total": len(cards)})
}

func handleCardRequests(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodGet {
		mu.RLock()
		defer mu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"items": requests, "total": len(requests)})
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST or GET required"}`, 405)
		return
	}
	var req struct {
		AccountNumber string `json:"accountNumber"`
		CustomerName  string `json:"customerName"`
		CardType      string `json:"cardType"`
		Scheme        string `json:"scheme"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	validTypes := map[string]bool{"debit": true, "credit": true, "prepaid": true}
	if !validTypes[req.CardType] {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": "invalid cardType", "valid": []string{"debit", "credit", "prepaid"}})
		return
	}
	validSchemes := map[string]bool{"visa": true, "mastercard": true, "verve": true}
	if !validSchemes[req.Scheme] {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": "invalid scheme", "valid": []string{"visa", "mastercard", "verve"}})
		return
	}

	mu.Lock()
	defer mu.Unlock()
	cr := CardRequest{
		ID:            "REQ-" + time.Now().Format("20060102150405"),
		AccountNumber: req.AccountNumber,
		CustomerName:  req.CustomerName,
		CardType:      req.CardType,
		Scheme:        req.Scheme,
		Status:        "pending",
		RequestedAt:   time.Now().Format(time.RFC3339),
	}
	requests = append(requests, cr)
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(cr)
}

func handleBlock(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		CardID string `json:"cardId"`
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			if cards[i].Status == "blocked" {
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(map[string]string{"error": "card already blocked"})
				return
			}
			cards[i].Status = "blocked"
			json.NewEncoder(w).Encode(map[string]interface{}{"card": cards[i], "blockedAt": time.Now().Format(time.RFC3339), "reason": req.Reason})
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func handleUnblock(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		CardID string `json:"cardId"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			if cards[i].Status != "blocked" {
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(map[string]string{"error": "card is not blocked"})
				return
			}
			cards[i].Status = "active"
			json.NewEncoder(w).Encode(map[string]interface{}{"card": cards[i], "unblockedAt": time.Now().Format(time.RFC3339)})
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func handleSetLimit(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		CardID     string  `json:"cardId"`
		DailyLimit float64 `json:"dailyLimit"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.DailyLimit <= 0 || req.DailyLimit > 10000000 {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "dailyLimit must be between 1 and 10,000,000"})
		return
	}
	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			old := cards[i].DailyLimit
			cards[i].DailyLimit = req.DailyLimit
			json.NewEncoder(w).Encode(map[string]interface{}{"card": cards[i], "previousLimit": old})
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func handleToggleInternational(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		CardID  string `json:"cardId"`
		Enabled bool   `json:"enabled"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			cards[i].InternationalEnabled = req.Enabled
			json.NewEncoder(w).Encode(map[string]interface{}{"card": cards[i]})
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func handleTokenize(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		CardID     string `json:"cardId"`
		DeviceName string `json:"deviceName"`
		DeviceType string `json:"deviceType"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			if cards[i].Status != "active" {
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(map[string]string{"error": "only active cards can be tokenized"})
				return
			}
			if cards[i].TokenizedDevices >= 5 {
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(map[string]string{"error": "maximum 5 tokenized devices reached"})
				return
			}
			cards[i].TokenizedDevices++
			json.NewEncoder(w).Encode(map[string]interface{}{
				"card":        cards[i],
				"tokenizedAt": time.Now().Format(time.RFC3339),
				"device":      req.DeviceName,
			})
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func handleReplace(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		CardID string `json:"cardId"`
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	validReasons := map[string]bool{"lost": true, "stolen": true, "damaged": true, "expired": true}
	if !validReasons[req.Reason] {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": "invalid reason", "valid": []string{"lost", "stolen", "damaged", "expired"}})
		return
	}
	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			cards[i].Status = "replaced"
			json.NewEncoder(w).Encode(map[string]interface{}{
				"oldCard":     cards[i],
				"replacedAt":  time.Now().Format(time.RFC3339),
				"reason":      req.Reason,
				"message":     "Replacement card will be issued within 5 business days",
			})
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}
