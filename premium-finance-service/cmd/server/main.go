package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8103"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/finance/plans", handlePlans)
	mux.HandleFunc("/api/v1/finance/create", handleCreate)
	mux.HandleFunc("/api/v1/finance/payment", handlePayment)
	mux.HandleFunc("/api/v1/finance/schedule/", handleSchedule)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"premium-finance-service"}`))
	})
	log.Printf("Premium Finance Service starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

type InstallmentPlan struct {
	PlanID       string    `json:"plan_id"`
	PolicyID     string    `json:"policy_id"`
	TotalPremium float64   `json:"total_premium"`
	DownPayment  float64   `json:"down_payment"`
	Installments int       `json:"installments"`
	MonthlyAmount float64  `json:"monthly_amount"`
	InterestRate float64   `json:"interest_rate"`
	TotalCost    float64   `json:"total_cost"`
	Status       string    `json:"status"`
	NextDue      time.Time `json:"next_due_date"`
}

func handlePlans(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"plans": []map[string]interface{}{
			{"type": "monthly_3", "installments": 3, "interest_rate": 0, "down_payment_pct": 0.40, "description": "3 months (interest-free)"},
			{"type": "monthly_6", "installments": 6, "interest_rate": 0.05, "down_payment_pct": 0.25, "description": "6 months (5% interest)"},
			{"type": "monthly_12", "installments": 12, "interest_rate": 0.10, "down_payment_pct": 0.15, "description": "12 months (10% interest)"},
			{"type": "pay_as_you_go", "installments": 0, "interest_rate": 0, "down_payment_pct": 0, "description": "Daily/weekly micro-payments"},
		},
	})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		PolicyID     string  `json:"policy_id"`
		TotalPremium float64 `json:"total_premium"`
		PlanType     string  `json:"plan_type"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	var installments int
	var interestRate, downPaymentPct float64
	switch req.PlanType {
	case "monthly_3":
		installments = 3; interestRate = 0; downPaymentPct = 0.40
	case "monthly_6":
		installments = 6; interestRate = 0.05; downPaymentPct = 0.25
	case "monthly_12":
		installments = 12; interestRate = 0.10; downPaymentPct = 0.15
	default:
		installments = 3; interestRate = 0; downPaymentPct = 0.40
	}

	downPayment := req.TotalPremium * downPaymentPct
	financedAmount := req.TotalPremium - downPayment
	totalInterest := financedAmount * interestRate
	monthlyAmount := math.Round((financedAmount+totalInterest)/float64(installments)*100) / 100
	totalCost := downPayment + monthlyAmount*float64(installments)

	planID := fmt.Sprintf("FIN-%d", time.Now().UnixNano()%1000000)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(InstallmentPlan{
		PlanID:        planID,
		PolicyID:      req.PolicyID,
		TotalPremium:  req.TotalPremium,
		DownPayment:   downPayment,
		Installments:  installments,
		MonthlyAmount: monthlyAmount,
		InterestRate:  interestRate,
		TotalCost:     math.Round(totalCost*100) / 100,
		Status:        "active",
		NextDue:       time.Now().AddDate(0, 1, 0),
	})
}

func handlePayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "payment_recorded",
		"remaining_installments": 2,
		"next_due": time.Now().AddDate(0, 1, 0).Format(time.RFC3339),
	})
}

func handleSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"schedule": []map[string]interface{}{
			{"installment": 1, "amount": 10000, "due_date": "2026-06-01", "status": "paid"},
			{"installment": 2, "amount": 10000, "due_date": "2026-07-01", "status": "upcoming"},
			{"installment": 3, "amount": 10000, "due_date": "2026-08-01", "status": "upcoming"},
		},
	})
}
