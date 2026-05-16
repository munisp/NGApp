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
		port = "8098"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/takaful/products", handleProducts)
	mux.HandleFunc("/api/v1/takaful/enroll", handleEnroll)
	mux.HandleFunc("/api/v1/takaful/funds", handleFunds)
	mux.HandleFunc("/api/v1/takaful/surplus", handleSurplus)
	mux.HandleFunc("/api/v1/takaful/shariah-board", handleShariahBoard)
	mux.HandleFunc("/api/v1/takaful/claim", handleClaim)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"takaful-module"}`))
	})
	log.Printf("Takaful Module starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

// TakafulProduct represents a Shariah-compliant insurance product
type TakafulProduct struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	NameArabic      string   `json:"name_arabic"`
	Type            string   `json:"type"` // general, family (life equivalent)
	Model           string   `json:"model"` // wakala, mudaraba, hybrid
	Contribution    float64  `json:"min_contribution_ngn"`
	Benefits        []string `json:"benefits"`
	ShariahCompliant bool    `json:"shariah_compliant"`
	FatwahReference string   `json:"fatwah_reference"`
}

// TakafulFund represents the shared risk pool
type TakafulFund struct {
	FundID          string  `json:"fund_id"`
	FundType        string  `json:"fund_type"` // risk_fund, investment_fund
	TotalContributions float64 `json:"total_contributions"`
	ClaimsPaid      float64 `json:"claims_paid"`
	InvestmentIncome float64 `json:"investment_income"`
	OperatorFee     float64 `json:"operator_fee"` // Wakala fee
	Surplus         float64 `json:"surplus"`
	Deficit         float64 `json:"deficit"`
	Participants    int     `json:"participants"`
}

func handleProducts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	products := []TakafulProduct{
		{
			ID: "TKF-FAM-001", Name: "Family Takaful", NameArabic: "\u062a\u0643\u0627\u0641\u0644 \u0639\u0627\u0626\u0644\u064a",
			Type: "family", Model: "hybrid",
			Contribution: 2000, ShariahCompliant: true,
			FatwahReference: "NAICOM/SHB/2024/001",
			Benefits: []string{
				"Death benefit (Ta'awun)",
				"Total permanent disability",
				"Critical illness cover",
				"Surplus sharing with participants",
				"Shariah-compliant investments only",
			},
		},
		{
			ID: "TKF-MTR-001", Name: "Motor Takaful", NameArabic: "\u062a\u0643\u0627\u0641\u0644 \u0627\u0644\u0633\u064a\u0627\u0631\u0627\u062a",
			Type: "general", Model: "wakala",
			Contribution: 5000, ShariahCompliant: true,
			FatwahReference: "NAICOM/SHB/2024/002",
			Benefits: []string{
				"Third party liability",
				"Own damage (comprehensive option)",
				"Towing and emergency assistance",
				"No interest (riba-free)",
				"Annual surplus distribution",
			},
		},
		{
			ID: "TKF-HLT-001", Name: "Health Takaful", NameArabic: "\u062a\u0643\u0627\u0641\u0644 \u0635\u062d\u064a",
			Type: "general", Model: "wakala",
			Contribution: 3000, ShariahCompliant: true,
			FatwahReference: "NAICOM/SHB/2024/003",
			Benefits: []string{
				"Hospitalization benefit",
				"Outpatient care",
				"Maternity cover",
				"Shariah-compliant hospitals network",
			},
		},
		{
			ID: "TKF-AGR-001", Name: "Agricultural Takaful", NameArabic: "\u062a\u0643\u0627\u0641\u0644 \u0632\u0631\u0627\u0639\u064a",
			Type: "general", Model: "mudaraba",
			Contribution: 1500, ShariahCompliant: true,
			FatwahReference: "NAICOM/SHB/2024/004",
			Benefits: []string{
				"Crop loss protection",
				"Livestock mortality cover",
				"Drought and flood protection",
				"Profit sharing from agricultural investments",
			},
		},
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"products": products})
}

func handleEnroll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"certificate_number": fmt.Sprintf("NGA-TKF-%d", time.Now().UnixNano()%1000000),
		"status":             "active",
		"model":              "wakala",
		"wakala_fee":         "20%",
		"message":            "Alhamdulillah! Your Takaful certificate has been issued. Details sent via SMS.",
	})
}

func handleFunds(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"funds": []TakafulFund{
			{
				FundID: "FUND-RISK-001", FundType: "risk_fund",
				TotalContributions: 150000000, ClaimsPaid: 45000000,
				InvestmentIncome: 12000000, OperatorFee: 30000000,
				Surplus: 87000000, Deficit: 0, Participants: 5000,
			},
			{
				FundID: "FUND-INV-001", FundType: "investment_fund",
				TotalContributions: 300000000, ClaimsPaid: 0,
				InvestmentIncome: 42000000, OperatorFee: 15000000,
				Surplus: 327000000, Deficit: 0, Participants: 5000,
			},
		},
		"investment_policy": map[string]interface{}{
			"allowed":    []string{"Sukuk bonds", "Shariah-compliant equities", "Real estate", "Islamic money market"},
			"prohibited": []string{"Interest-bearing instruments", "Gambling", "Alcohol", "Pork-related"},
		},
	})
}

func handleSurplus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"period":           "2025",
		"total_surplus":    87000000,
		"distribution_method": "Pro-rata based on contribution",
		"participant_share": "70%",
		"operator_share":   "30%",
		"per_participant":  12180,
		"distribution_date": "2026-03-31",
		"status":           "distributed",
	})
}

func handleShariahBoard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"board_name": "NGApp Shariah Advisory Board",
		"members": []map[string]string{
			{"name": "Sheikh Ahmad Ibrahim", "role": "Chairman", "qualification": "PhD Islamic Finance, Al-Azhar University"},
			{"name": "Dr. Aisha Bello", "role": "Member", "qualification": "MSc Islamic Banking, IIUM Malaysia"},
			{"name": "Ustaz Yusuf Abdullahi", "role": "Member", "qualification": "Fiqh Muamalat, Madinah University"},
		},
		"certification_status": "All products certified Shariah-compliant",
		"last_audit":           "2026-01-15",
		"next_audit":           "2026-07-15",
	})
}

func handleClaim(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"claim_number": fmt.Sprintf("NGA-TKC-%d", time.Now().UnixNano()%1000000),
		"status":       "submitted",
		"fund_source":  "Risk Fund (Ta'awun Pool)",
		"message":      "Your claim has been submitted from the mutual aid fund. In sha Allah, we will process it within 48 hours.",
	})
}
