package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"
)

// Loan Calculator Service — amortization, EMI, repayment schedules for all loan products
// Port: 8119
// Middleware: Redis (caching), Postgres

type LoanCalculation struct {
	ID             string    `json:"id"`
	CustomerName   string    `json:"customerName,omitempty"`
	LoanType       string    `json:"loanType"`
	Principal      float64   `json:"principal"`
	AnnualRate     float64   `json:"annualRate"`
	TenorMonths    int       `json:"tenorMonths"`
	RepaymentType  string    `json:"repaymentType"`
	MonthlyPayment float64   `json:"monthlyPayment"`
	TotalInterest  float64   `json:"totalInterest"`
	TotalRepayment float64   `json:"totalRepayment"`
	EffectiveRate  float64   `json:"effectiveRate"`
	Status         string    `json:"status"`
	Schedule       []Installment `json:"schedule,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

type Installment struct {
	Month          int     `json:"month"`
	OpeningBalance float64 `json:"openingBalance"`
	EMI            float64 `json:"emi"`
	Principal      float64 `json:"principal"`
	Interest       float64 `json:"interest"`
	ClosingBalance float64 `json:"closingBalance"`
}

type ComparisonRequest struct {
	Principal   float64 `json:"principal"`
	TenorMonths int     `json:"tenorMonths"`
	Scenarios   []struct {
		LoanType      string  `json:"loanType"`
		AnnualRate    float64 `json:"annualRate"`
		RepaymentType string  `json:"repaymentType"`
	} `json:"scenarios"`
}

type AffordabilityRequest struct {
	MonthlyIncome  float64 `json:"monthlyIncome"`
	MonthlyExpense float64 `json:"monthlyExpense"`
	ExistingEMI    float64 `json:"existingEmi"`
	DesiredTenor   int     `json:"desiredTenor"`
	AnnualRate     float64 `json:"annualRate"`
	DTILimit       float64 `json:"dtiLimit"`
}

var (
	lcMu          sync.RWMutex
	calculations  []LoanCalculation
	lcCounter     int64
)

func calculateEMI(principal, annualRate float64, tenorMonths int, repaymentType string) (float64, float64, float64, []Installment) {
	monthlyRate := annualRate / 100.0 / 12.0
	var monthlyPayment, totalInterest, totalRepayment float64
	var schedule []Installment
	balance := principal

	switch repaymentType {
	case "equal_installment":
		if monthlyRate == 0 {
			monthlyPayment = principal / float64(tenorMonths)
		} else {
			monthlyPayment = principal * monthlyRate * math.Pow(1+monthlyRate, float64(tenorMonths)) /
				(math.Pow(1+monthlyRate, float64(tenorMonths)) - 1)
		}
		monthlyPayment = math.Round(monthlyPayment*100) / 100
		for m := 1; m <= tenorMonths; m++ {
			interest := math.Round(balance*monthlyRate*100) / 100
			princ := monthlyPayment - interest
			if m == tenorMonths {
				princ = balance
				monthlyPayment = princ + interest
			}
			closing := balance - princ
			if closing < 0.01 {
				closing = 0
			}
			schedule = append(schedule, Installment{
				Month: m, OpeningBalance: math.Round(balance*100) / 100,
				EMI: monthlyPayment, Principal: math.Round(princ*100) / 100,
				Interest: interest, ClosingBalance: math.Round(closing*100) / 100,
			})
			totalInterest += interest
			balance = closing
		}
		totalRepayment = principal + totalInterest

	case "reducing_balance":
		principalPart := principal / float64(tenorMonths)
		for m := 1; m <= tenorMonths; m++ {
			interest := math.Round(balance*monthlyRate*100) / 100
			emi := math.Round((principalPart+interest)*100) / 100
			closing := balance - principalPart
			if m == tenorMonths {
				closing = 0
			}
			schedule = append(schedule, Installment{
				Month: m, OpeningBalance: math.Round(balance*100) / 100,
				EMI: emi, Principal: math.Round(principalPart*100) / 100,
				Interest: interest, ClosingBalance: math.Round(closing*100) / 100,
			})
			totalInterest += interest
			balance = closing
		}
		totalRepayment = principal + totalInterest
		monthlyPayment = totalRepayment / float64(tenorMonths)

	case "bullet":
		totalInterest = principal * annualRate / 100.0 * float64(tenorMonths) / 12.0
		totalRepayment = principal + totalInterest
		monthlyPayment = 0
		for m := 1; m < tenorMonths; m++ {
			schedule = append(schedule, Installment{
				Month: m, OpeningBalance: principal, EMI: 0,
				Principal: 0, Interest: 0, ClosingBalance: principal,
			})
		}
		schedule = append(schedule, Installment{
			Month: tenorMonths, OpeningBalance: principal,
			EMI: totalRepayment, Principal: principal,
			Interest: totalInterest, ClosingBalance: 0,
		})

	case "balloon":
		balloonPct := 0.30
		amortizedPrincipal := principal * (1 - balloonPct)
		balloonAmount := principal * balloonPct
		if monthlyRate == 0 {
			monthlyPayment = amortizedPrincipal / float64(tenorMonths)
		} else {
			monthlyPayment = amortizedPrincipal * monthlyRate * math.Pow(1+monthlyRate, float64(tenorMonths)) /
				(math.Pow(1+monthlyRate, float64(tenorMonths)) - 1)
		}
		monthlyPayment = math.Round(monthlyPayment*100) / 100
		balance = amortizedPrincipal
		for m := 1; m <= tenorMonths; m++ {
			interest := math.Round(balance*monthlyRate*100) / 100
			princ := monthlyPayment - interest
			closing := balance - princ
			if m == tenorMonths {
				princ = balance
				closing = 0
				monthlyPayment = princ + interest + balloonAmount
			}
			schedule = append(schedule, Installment{
				Month: m, OpeningBalance: math.Round(balance*100) / 100,
				EMI: math.Round(monthlyPayment*100) / 100, Principal: math.Round(princ*100) / 100,
				Interest: interest, ClosingBalance: math.Round(closing*100) / 100,
			})
			totalInterest += interest
			balance = closing
		}
		totalRepayment = principal + totalInterest
		monthlyPayment = totalRepayment / float64(tenorMonths)
	}

	totalInterest = math.Round(totalInterest*100) / 100
	totalRepayment = math.Round(totalRepayment*100) / 100
	monthlyPayment = math.Round(monthlyPayment*100) / 100
	return monthlyPayment, totalInterest, totalRepayment, schedule
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8119"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/loan-calculator", handleCalculations)
	mux.HandleFunc("/v1/loan-calculator/schedule", handleSchedule)
	mux.HandleFunc("/v1/loan-calculator/compare", handleCompare)
	mux.HandleFunc("/v1/loan-calculator/affordability", handleAffordability)

	log.Printf("Loan Calculator Service starting on :%s", port)
	if err := http.ListenAndServe(":"+port, withCORS(mux)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":    "loan-calculator",
		"status":     "healthy",
		"port":       8119,
		"middleware": []string{"redis", "postgres"},
	})
}

func handleCalculations(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		lcMu.RLock()
		defer lcMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"items": calculations, "total": len(calculations)})
	case http.MethodPost:
		var req struct {
			CustomerName  string  `json:"customerName"`
			LoanType      string  `json:"loanType"`
			Principal     float64 `json:"principal"`
			AnnualRate    float64 `json:"annualRate"`
			TenorMonths   int     `json:"tenorMonths"`
			RepaymentType string  `json:"repaymentType"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON"}`, 400)
			return
		}
		if req.Principal <= 0 || req.AnnualRate < 0 || req.TenorMonths <= 0 {
			http.Error(w, `{"error":"principal, annualRate, and tenorMonths must be positive"}`, 400)
			return
		}
		validTypes := map[string]bool{"mortgage": true, "education": true, "agriculture": true, "personal": true, "auto": true, "murabaha": true, "ijara": true}
		if !validTypes[req.LoanType] {
			http.Error(w, `{"error":"invalid loanType"}`, 400)
			return
		}
		if req.RepaymentType == "" {
			req.RepaymentType = "equal_installment"
		}
		validRepay := map[string]bool{"equal_installment": true, "reducing_balance": true, "bullet": true, "balloon": true}
		if !validRepay[req.RepaymentType] {
			http.Error(w, `{"error":"invalid repaymentType"}`, 400)
			return
		}

		monthlyPay, totalInt, totalRepay, _ := calculateEMI(req.Principal, req.AnnualRate, req.TenorMonths, req.RepaymentType)
		effectiveRate := 0.0
		if req.Principal > 0 {
			effectiveRate = math.Round(totalInt/req.Principal*10000) / 100
		}

		lcMu.Lock()
		lcCounter++
		calc := LoanCalculation{
			ID: fmt.Sprintf("LC-%06d", lcCounter), CustomerName: req.CustomerName,
			LoanType: req.LoanType, Principal: req.Principal, AnnualRate: req.AnnualRate,
			TenorMonths: req.TenorMonths, RepaymentType: req.RepaymentType,
			MonthlyPayment: monthlyPay, TotalInterest: totalInt,
			TotalRepayment: totalRepay, EffectiveRate: effectiveRate,
			Status: "calculated", CreatedAt: time.Now().UTC(),
		}
		calculations = append(calculations, calc)
		lcMu.Unlock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(calc)
	default:
		http.Error(w, `{"error":"method not allowed"}`, 405)
	}
}

func handleSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		Principal     float64 `json:"principal"`
		AnnualRate    float64 `json:"annualRate"`
		TenorMonths   int     `json:"tenorMonths"`
		RepaymentType string  `json:"repaymentType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, 400)
		return
	}
	if req.RepaymentType == "" {
		req.RepaymentType = "equal_installment"
	}
	_, totalInt, totalRepay, schedule := calculateEMI(req.Principal, req.AnnualRate, req.TenorMonths, req.RepaymentType)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"principal": req.Principal, "annualRate": req.AnnualRate, "tenorMonths": req.TenorMonths,
		"repaymentType": req.RepaymentType, "totalInterest": totalInt, "totalRepayment": totalRepay,
		"installments": schedule,
	})
}

func handleCompare(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req ComparisonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, 400)
		return
	}
	if len(req.Scenarios) == 0 || len(req.Scenarios) > 10 {
		http.Error(w, `{"error":"provide 1-10 scenarios"}`, 400)
		return
	}
	type Result struct {
		LoanType       string  `json:"loanType"`
		AnnualRate     float64 `json:"annualRate"`
		RepaymentType  string  `json:"repaymentType"`
		MonthlyPayment float64 `json:"monthlyPayment"`
		TotalInterest  float64 `json:"totalInterest"`
		TotalRepayment float64 `json:"totalRepayment"`
		Savings        float64 `json:"savings"`
	}
	var results []Result
	var maxRepay float64
	for _, s := range req.Scenarios {
		rt := s.RepaymentType
		if rt == "" {
			rt = "equal_installment"
		}
		mp, ti, tr, _ := calculateEMI(req.Principal, s.AnnualRate, req.TenorMonths, rt)
		if tr > maxRepay {
			maxRepay = tr
		}
		results = append(results, Result{
			LoanType: s.LoanType, AnnualRate: s.AnnualRate, RepaymentType: rt,
			MonthlyPayment: mp, TotalInterest: ti, TotalRepayment: tr,
		})
	}
	for i := range results {
		results[i].Savings = math.Round((maxRepay-results[i].TotalRepayment)*100) / 100
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"principal": req.Principal, "tenorMonths": req.TenorMonths, "comparisons": results})
}

func handleAffordability(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req AffordabilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, 400)
		return
	}
	if req.MonthlyIncome <= 0 {
		http.Error(w, `{"error":"monthlyIncome must be positive"}`, 400)
		return
	}
	if req.DTILimit <= 0 {
		req.DTILimit = 40.0
	}
	maxDTIPayment := req.MonthlyIncome*req.DTILimit/100 - req.ExistingEMI
	if maxDTIPayment < 0 {
		maxDTIPayment = 0
	}
	disposableIncome := req.MonthlyIncome - req.MonthlyExpense - req.ExistingEMI
	if disposableIncome < 0 {
		disposableIncome = 0
	}
	maxEMI := math.Min(maxDTIPayment, disposableIncome*0.8)
	monthlyRate := req.AnnualRate / 100.0 / 12.0
	var maxPrincipal float64
	if maxEMI > 0 && req.DesiredTenor > 0 {
		if monthlyRate == 0 {
			maxPrincipal = maxEMI * float64(req.DesiredTenor)
		} else {
			maxPrincipal = maxEMI * (math.Pow(1+monthlyRate, float64(req.DesiredTenor)) - 1) /
				(monthlyRate * math.Pow(1+monthlyRate, float64(req.DesiredTenor)))
		}
	}
	currentDTI := 0.0
	if req.MonthlyIncome > 0 {
		currentDTI = math.Round(req.ExistingEMI/req.MonthlyIncome*10000) / 100
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"maxEMI": math.Round(maxEMI*100) / 100, "maxPrincipal": math.Round(maxPrincipal*100) / 100,
		"currentDTI": currentDTI, "dtiLimit": req.DTILimit,
		"disposableIncome": math.Round(disposableIncome*100) / 100,
		"eligible": maxEMI > 0,
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
