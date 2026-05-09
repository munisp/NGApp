package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// F3: Card Management — Issuance, PIN, limits, controls, tokenization, virtual cards
// Language: Go (concurrent card operations, real-time limit enforcement)
// Port: 8109

type Card struct {
	ID              string    `json:"id"`
	CustomerID      string    `json:"customerId"`
	CardType        string    `json:"cardType"` // debit, credit, prepaid, virtual
	CardNumber      string    `json:"cardNumber"` // masked
	ExpiryDate      string    `json:"expiryDate"`
	Status          string    `json:"status"` // requested, approved, personalized, dispatched, active, blocked, expired
	NameOnCard      string    `json:"nameOnCard"`
	BIN             string    `json:"bin"`
	Network         string    `json:"network"` // visa, mastercard, verve
	DailyLimit      float64   `json:"dailyLimit"`
	WeeklyLimit     float64   `json:"weeklyLimit"`
	MonthlyLimit    float64   `json:"monthlyLimit"`
	DailySpent      float64   `json:"dailySpent"`
	OnlineEnabled   bool      `json:"onlineEnabled"`
	POSEnabled      bool      `json:"posEnabled"`
	ATMEnabled      bool      `json:"atmEnabled"`
	IntlEnabled     bool      `json:"intlEnabled"`
	ContactlessEnabled bool   `json:"contactlessEnabled"`
	GeoBlocking     []string  `json:"geoBlocking,omitempty"` // blocked countries
	MCCBlocking     []string  `json:"mccBlocking,omitempty"` // blocked merchant categories
	TokenID         string    `json:"tokenId,omitempty"` // Apple/Google Pay token
	PINSet          bool      `json:"pinSet"`
	CreatedAt       time.Time `json:"createdAt"`
}

type CardTransaction struct {
	ID        string    `json:"id"`
	CardID    string    `json:"cardId"`
	Type      string    `json:"type"` // purchase, withdrawal, refund, reversal
	Amount    float64   `json:"amount"`
	Currency  string    `json:"currency"`
	Merchant  string    `json:"merchant"`
	MCC       string    `json:"mcc"`
	Channel   string    `json:"channel"` // pos, atm, online, contactless
	Country   string    `json:"country"`
	Status    string    `json:"status"` // approved, declined, pending, reversed
	DeclineReason string `json:"declineReason,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

var (
	mu    sync.RWMutex
	cards []Card
	ctxns []CardTransaction
	seq   int
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "card-management", "status": "healthy", "port": 8109,
			"middleware": []string{"kafka", "redis", "keycloak", "permify", "opensearch", "postgres"},
		})
	})

	mux.HandleFunc("/v1/cards", handleCards)
	mux.HandleFunc("/v1/cards/virtual", handleVirtualCard)
	mux.HandleFunc("/v1/cards/pin", handlePIN)
	mux.HandleFunc("/v1/cards/limits", handleLimits)
	mux.HandleFunc("/v1/cards/controls", handleControls)
	mux.HandleFunc("/v1/cards/tokenize", handleTokenize)
	mux.HandleFunc("/v1/cards/authorize", handleAuthorize)
	mux.HandleFunc("/v1/cards/transactions", handleCardTxns)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8109"
	}
	log.Printf("[CardManagement] Starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func generateMaskedCard() string {
	return fmt.Sprintf("5399 **** **** %04d", time.Now().UnixNano()%10000)
}

func handleCards(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "POST" {
		var req Card
		json.NewDecoder(r.Body).Decode(&req)
		validTypes := map[string]bool{"debit": true, "credit": true, "prepaid": true, "virtual": true}
		if !validTypes[req.CardType] {
			http.Error(w, `{"error":"invalid card type"}`, 400)
			return
		}
		mu.Lock()
		seq++
		req.ID = fmt.Sprintf("CRD-%06d", seq)
		req.CardNumber = generateMaskedCard()
		req.ExpiryDate = time.Now().AddDate(3, 0, 0).Format("01/06")
		req.Status = "requested"
		req.BIN = "539983"
		req.Network = "mastercard"
		if req.DailyLimit == 0 { req.DailyLimit = 500000 }
		if req.WeeklyLimit == 0 { req.WeeklyLimit = 2000000 }
		if req.MonthlyLimit == 0 { req.MonthlyLimit = 5000000 }
		req.OnlineEnabled = true
		req.POSEnabled = true
		req.ATMEnabled = true
		req.ContactlessEnabled = true
		req.CreatedAt = time.Now()
		cards = append(cards, req)
		mu.Unlock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(req)
		return
	}
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(cards)
}

func handleVirtualCard(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		CustomerID string `json:"customerId"`
		Currency   string `json:"currency"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	mu.Lock()
	seq++
	card := Card{
		ID: fmt.Sprintf("VCR-%06d", seq), CustomerID: req.CustomerID,
		CardType: "virtual", CardNumber: generateMaskedCard(),
		ExpiryDate: time.Now().AddDate(1, 0, 0).Format("01/06"),
		Status: "active", Network: "visa", BIN: "408408",
		DailyLimit: 200000, WeeklyLimit: 1000000, MonthlyLimit: 3000000,
		OnlineEnabled: true, POSEnabled: false, ATMEnabled: false,
		ContactlessEnabled: false, CreatedAt: time.Now(),
	}
	cards = append(cards, card)
	mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(card)
}

func handlePIN(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		CardID     string `json:"cardId"`
		EncryptedPIN string `json:"encryptedPin"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			cards[i].PINSet = true
			if cards[i].Status == "requested" {
				cards[i].Status = "active"
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"status": "pin_set", "cardId": req.CardID})
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func handleLimits(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PUT" && r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		CardID       string  `json:"cardId"`
		DailyLimit   float64 `json:"dailyLimit"`
		WeeklyLimit  float64 `json:"weeklyLimit"`
		MonthlyLimit float64 `json:"monthlyLimit"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			if req.DailyLimit > 0 { cards[i].DailyLimit = req.DailyLimit }
			if req.WeeklyLimit > 0 { cards[i].WeeklyLimit = req.WeeklyLimit }
			if req.MonthlyLimit > 0 { cards[i].MonthlyLimit = req.MonthlyLimit }
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(cards[i])
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func handleControls(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PUT" && r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		CardID             string   `json:"cardId"`
		OnlineEnabled      *bool    `json:"onlineEnabled,omitempty"`
		POSEnabled         *bool    `json:"posEnabled,omitempty"`
		ATMEnabled         *bool    `json:"atmEnabled,omitempty"`
		IntlEnabled        *bool    `json:"intlEnabled,omitempty"`
		ContactlessEnabled *bool    `json:"contactlessEnabled,omitempty"`
		GeoBlocking        []string `json:"geoBlocking,omitempty"`
		MCCBlocking        []string `json:"mccBlocking,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			if req.OnlineEnabled != nil { cards[i].OnlineEnabled = *req.OnlineEnabled }
			if req.POSEnabled != nil { cards[i].POSEnabled = *req.POSEnabled }
			if req.ATMEnabled != nil { cards[i].ATMEnabled = *req.ATMEnabled }
			if req.IntlEnabled != nil { cards[i].IntlEnabled = *req.IntlEnabled }
			if req.ContactlessEnabled != nil { cards[i].ContactlessEnabled = *req.ContactlessEnabled }
			if req.GeoBlocking != nil { cards[i].GeoBlocking = req.GeoBlocking }
			if req.MCCBlocking != nil { cards[i].MCCBlocking = req.MCCBlocking }
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(cards[i])
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func handleTokenize(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		CardID   string `json:"cardId"`
		Platform string `json:"platform"` // apple_pay, google_pay, samsung_pay
	}
	json.NewDecoder(r.Body).Decode(&req)

	mu.Lock()
	defer mu.Unlock()
	for i := range cards {
		if cards[i].ID == req.CardID {
			tokenBytes := make([]byte, 16)
			rand.Read(tokenBytes)
			cards[i].TokenID = fmt.Sprintf("tok_%s_%s", req.Platform, hex.EncodeToString(tokenBytes))
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"cardId": req.CardID, "tokenId": cards[i].TokenID,
				"platform": req.Platform, "status": "provisioned",
			})
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func handleAuthorize(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		CardID   string  `json:"cardId"`
		Amount   float64 `json:"amount"`
		Merchant string  `json:"merchant"`
		MCC      string  `json:"mcc"`
		Channel  string  `json:"channel"` // pos, atm, online, contactless
		Country  string  `json:"country"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	mu.Lock()
	defer mu.Unlock()

	for i := range cards {
		if cards[i].ID == req.CardID {
			// Check card status
			if cards[i].Status != "active" {
				txn := recordDecline(req, "card_not_active")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(txn)
				return
			}
			// Check channel controls
			if req.Channel == "online" && !cards[i].OnlineEnabled {
				txn := recordDecline(req, "online_disabled")
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(txn)
				return
			}
			if req.Channel == "atm" && !cards[i].ATMEnabled {
				txn := recordDecline(req, "atm_disabled")
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(txn)
				return
			}
			// Check daily limit
			if cards[i].DailySpent+req.Amount > cards[i].DailyLimit {
				txn := recordDecline(req, "daily_limit_exceeded")
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(txn)
				return
			}
			// Check geo blocking
			for _, blocked := range cards[i].GeoBlocking {
				if blocked == req.Country {
					txn := recordDecline(req, "geo_blocked")
					w.WriteHeader(400)
					json.NewEncoder(w).Encode(txn)
					return
				}
			}

			// Approve
			cards[i].DailySpent += req.Amount
			txn := CardTransaction{
				ID: fmt.Sprintf("CTX-%d", time.Now().UnixNano()),
				CardID: req.CardID, Type: "purchase", Amount: req.Amount,
				Currency: "NGN", Merchant: req.Merchant, MCC: req.MCC,
				Channel: req.Channel, Country: req.Country,
				Status: "approved", Timestamp: time.Now(),
			}
			ctxns = append(ctxns, txn)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(txn)
			return
		}
	}
	http.Error(w, `{"error":"card not found"}`, 404)
}

func recordDecline(req struct {
	CardID   string  `json:"cardId"`
	Amount   float64 `json:"amount"`
	Merchant string  `json:"merchant"`
	MCC      string  `json:"mcc"`
	Channel  string  `json:"channel"`
	Country  string  `json:"country"`
}, reason string) CardTransaction {
	txn := CardTransaction{
		ID: fmt.Sprintf("CTX-%d", time.Now().UnixNano()),
		CardID: req.CardID, Type: "purchase", Amount: req.Amount,
		Currency: "NGN", Merchant: req.Merchant, MCC: req.MCC,
		Channel: req.Channel, Country: req.Country,
		Status: "declined", DeclineReason: reason, Timestamp: time.Now(),
	}
	ctxns = append(ctxns, txn)
	return txn
}

func handleCardTxns(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(ctxns)
}
