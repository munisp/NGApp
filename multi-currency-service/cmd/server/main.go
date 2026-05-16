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
		port = "8102"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/currency/rates", handleRates)
	mux.HandleFunc("/api/v1/currency/convert", handleConvert)
	mux.HandleFunc("/api/v1/currency/supported", handleSupported)
	mux.HandleFunc("/api/v1/currency/settlement", handleSettlement)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"multi-currency-service"}`))
	})
	log.Printf("Multi-Currency Service starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

type ExchangeRate struct {
	Base      string    `json:"base"`
	Target    string    `json:"target"`
	Rate      float64   `json:"rate"`
	BuyRate   float64   `json:"buy_rate"`
	SellRate  float64   `json:"sell_rate"`
	UpdatedAt time.Time `json:"updated_at"`
}

func handleRates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"base": "NGN",
		"updated_at": time.Now().Format(time.RFC3339),
		"rates": []ExchangeRate{
			{Base: "NGN", Target: "KES", Rate: 0.088, BuyRate: 0.086, SellRate: 0.090, UpdatedAt: time.Now()},
			{Base: "NGN", Target: "GHS", Rate: 0.0088, BuyRate: 0.0086, SellRate: 0.0090, UpdatedAt: time.Now()},
			{Base: "NGN", Target: "ZAR", Rate: 0.012, BuyRate: 0.0118, SellRate: 0.0122, UpdatedAt: time.Now()},
			{Base: "NGN", Target: "XOF", Rate: 0.40, BuyRate: 0.39, SellRate: 0.41, UpdatedAt: time.Now()},
			{Base: "NGN", Target: "USD", Rate: 0.00065, BuyRate: 0.00063, SellRate: 0.00067, UpdatedAt: time.Now()},
			{Base: "NGN", Target: "GBP", Rate: 0.00052, BuyRate: 0.00050, SellRate: 0.00054, UpdatedAt: time.Now()},
		},
	})
}

func handleConvert(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		From   string  `json:"from"`
		To     string  `json:"to"`
		Amount float64 `json:"amount"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Simplified conversion
	rate := 0.088 // NGN to KES default
	convertedAmount := req.Amount * rate

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"from":             req.From,
		"to":               req.To,
		"original_amount":  req.Amount,
		"converted_amount": convertedAmount,
		"rate":             rate,
		"fee":              req.Amount * 0.005,
		"total_debit":      req.Amount * 1.005,
	})
}

func handleSupported(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"currencies": []map[string]string{
			{"code": "NGN", "name": "Nigerian Naira", "country": "Nigeria", "symbol": "\u20a6"},
			{"code": "KES", "name": "Kenyan Shilling", "country": "Kenya", "symbol": "KSh"},
			{"code": "GHS", "name": "Ghanaian Cedi", "country": "Ghana", "symbol": "GH\u20b5"},
			{"code": "ZAR", "name": "South African Rand", "country": "South Africa", "symbol": "R"},
			{"code": "XOF", "name": "West African CFA Franc", "country": "WAEMU", "symbol": "CFA"},
			{"code": "XAF", "name": "Central African CFA Franc", "country": "CEMAC", "symbol": "FCFA"},
			{"code": "TZS", "name": "Tanzanian Shilling", "country": "Tanzania", "symbol": "TSh"},
			{"code": "UGX", "name": "Ugandan Shilling", "country": "Uganda", "symbol": "USh"},
			{"code": "RWF", "name": "Rwandan Franc", "country": "Rwanda", "symbol": "FRw"},
			{"code": "USD", "name": "US Dollar", "country": "International", "symbol": "$"},
			{"code": "GBP", "name": "British Pound", "country": "International", "symbol": "\u00a3"},
		},
	})
}

func handleSettlement(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"settlement_id": fmt.Sprintf("STL-%d", time.Now().UnixNano()%1000000),
		"status":        "initiated",
		"message":       "Cross-border settlement initiated",
	})
}
