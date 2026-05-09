package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// Account Opening Service — product selection, KYC tiers, account workflows
// Port: 8114
// Middleware: Kafka, Redis, Keycloak, Permify, Postgres

type AccountApplication struct {
	ID              string    `json:"id"`
	CustomerID      string    `json:"customerId"`
	ProductType     string    `json:"productType"` // savings, current, domiciliary, corporate, joint, minor
	Currency        string    `json:"currency"`
	Tier            string    `json:"tier"`    // tier1, tier2, tier3
	Status          string    `json:"status"`  // draft, kyc_pending, kyc_verified, approved, active, rejected
	BVN             string    `json:"bvn"`
	NIN             string    `json:"nin,omitempty"`
	FullName        string    `json:"fullName"`
	DateOfBirth     string    `json:"dateOfBirth"`
	PhoneNumber     string    `json:"phoneNumber"`
	Email           string    `json:"email"`
	Address         string    `json:"address"`
	EmployerName    string    `json:"employerName,omitempty"`
	MonthlyIncome   float64   `json:"monthlyIncome,omitempty"`
	AccountNumber   string    `json:"accountNumber,omitempty"`
	DailyLimit      float64   `json:"dailyLimit"`
	SingleTxnLimit  float64   `json:"singleTxnLimit"`
	MaxBalance      float64   `json:"maxBalance"`
	Documents       []KYCDoc  `json:"documents,omitempty"`
	RejectionReason string    `json:"rejectionReason,omitempty"`
	ApprovedBy      string    `json:"approvedBy,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type KYCDoc struct {
	Type       string `json:"type"` // id_card, utility_bill, passport, drivers_license, cac_cert
	Status     string `json:"status"` // uploaded, verified, rejected
	Reference  string `json:"reference"`
	UploadedAt string `json:"uploadedAt"`
}

type AccountProduct struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Type           string  `json:"type"`
	Currency       string  `json:"currency"`
	MinBalance     float64 `json:"minBalance"`
	InterestRate   float64 `json:"interestRate"`
	MaintenanceFee float64 `json:"maintenanceFee"`
	Features       []string `json:"features"`
	RequiredTier   string  `json:"requiredTier"`
}

var (
	appMu        sync.RWMutex
	applications []AccountApplication
	appCounter   int64

	products = []AccountProduct{
		{ID: "PRD-SAV-001", Name: "54Save Basic", Type: "savings", Currency: "NGN", MinBalance: 0, InterestRate: 1.5, MaintenanceFee: 0, Features: []string{"mobile_banking", "ussd", "card"}, RequiredTier: "tier1"},
		{ID: "PRD-SAV-002", Name: "54Save Premium", Type: "savings", Currency: "NGN", MinBalance: 50000, InterestRate: 4.5, MaintenanceFee: 100, Features: []string{"mobile_banking", "ussd", "card", "cheque_book", "internet_banking"}, RequiredTier: "tier2"},
		{ID: "PRD-CUR-001", Name: "54Current", Type: "current", Currency: "NGN", MinBalance: 10000, InterestRate: 0, MaintenanceFee: 500, Features: []string{"cheque_book", "overdraft", "internet_banking", "mobile_banking"}, RequiredTier: "tier2"},
		{ID: "PRD-DOM-001", Name: "54Dollar", Type: "domiciliary", Currency: "USD", MinBalance: 100, InterestRate: 0.5, MaintenanceFee: 5, Features: []string{"fx_transfer", "card", "internet_banking"}, RequiredTier: "tier3"},
		{ID: "PRD-DOM-002", Name: "54Euro", Type: "domiciliary", Currency: "EUR", MinBalance: 100, InterestRate: 0.25, MaintenanceFee: 5, Features: []string{"fx_transfer", "card", "internet_banking"}, RequiredTier: "tier3"},
		{ID: "PRD-DOM-003", Name: "54Pound", Type: "domiciliary", Currency: "GBP", MinBalance: 100, InterestRate: 0.25, MaintenanceFee: 5, Features: []string{"fx_transfer", "card", "internet_banking"}, RequiredTier: "tier3"},
		{ID: "PRD-COR-001", Name: "54Corporate", Type: "corporate", Currency: "NGN", MinBalance: 500000, InterestRate: 0, MaintenanceFee: 2500, Features: []string{"bulk_payments", "payroll", "fx", "trade_finance", "overdraft"}, RequiredTier: "tier3"},
		{ID: "PRD-JNT-001", Name: "54Joint", Type: "joint", Currency: "NGN", MinBalance: 10000, InterestRate: 2.0, MaintenanceFee: 200, Features: []string{"dual_signatory", "mobile_banking", "card"}, RequiredTier: "tier2"},
		{ID: "PRD-MIN-001", Name: "54Kids", Type: "minor", Currency: "NGN", MinBalance: 0, InterestRate: 5.0, MaintenanceFee: 0, Features: []string{"guardian_controls", "savings_goals", "education_lock"}, RequiredTier: "tier1"},
	}

	tierLimits = map[string]struct {
		Daily      float64
		SingleTxn  float64
		MaxBalance float64
	}{
		"tier1": {Daily: 50000, SingleTxn: 50000, MaxBalance: 300000},
		"tier2": {Daily: 200000, SingleTxn: 200000, MaxBalance: 5000000},
		"tier3": {Daily: 5000000, SingleTxn: 5000000, MaxBalance: 0}, // unlimited
	}
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8114"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "account-opening-go", "status": "ok", "timestamp": time.Now(),
			"middleware": []string{"Kafka", "Redis", "Keycloak", "Permify", "Postgres"},
			"products": len(products),
		})
	})
	mux.HandleFunc("/v1/accounts/products", handleProducts)
	mux.HandleFunc("/v1/accounts/applications", handleApplications)
	mux.HandleFunc("/v1/accounts/applications/approve", handleApproveApplication)
	mux.HandleFunc("/v1/accounts/applications/reject", handleRejectApplication)
	mux.HandleFunc("/v1/accounts/kyc/verify", handleKYCVerify)
	mux.HandleFunc("/v1/accounts/tier-limits", handleTierLimits)

	handler := corsMiddleware(mux)
	log.Printf("Account Opening Service starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func handleProducts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	productType := r.URL.Query().Get("type")
	currency := r.URL.Query().Get("currency")
	filtered := make([]AccountProduct, 0)
	for _, p := range products {
		if productType != "" && p.Type != productType { continue }
		if currency != "" && p.Currency != currency { continue }
		filtered = append(filtered, p)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"products": filtered, "total": len(filtered)})
}

func handleApplications(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "GET" {
		appMu.RLock()
		defer appMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"applications": applications, "total": len(applications)})
		return
	}
	if r.Method == "POST" {
		var app AccountApplication
		if err := json.NewDecoder(r.Body).Decode(&app); err != nil {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON"})
			return
		}
		if app.ProductType == "" {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "productType is required"})
			return
		}
		if app.BVN == "" {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "bvn is required for account opening"})
			return
		}
		if len(app.BVN) != 11 {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "BVN must be exactly 11 digits"})
			return
		}
		if app.FullName == "" {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "fullName is required"})
			return
		}

		if app.Tier == "" {
			app.Tier = "tier1"
		}
		limits := tierLimits[app.Tier]
		app.DailyLimit = limits.Daily
		app.SingleTxnLimit = limits.SingleTxn
		app.MaxBalance = limits.MaxBalance

		appMu.Lock()
		appCounter++
		app.ID = fmt.Sprintf("ACC-%d", appCounter)
		app.Status = "kyc_pending"
		app.AccountNumber = fmt.Sprintf("54%09d", appCounter)
		app.CreatedAt = time.Now()
		app.UpdatedAt = time.Now()
		applications = append(applications, app)
		appMu.Unlock()

		w.WriteHeader(201)
		json.NewEncoder(w).Encode(app)
		return
	}
	w.WriteHeader(405)
}

func handleApproveApplication(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	var body struct {
		ApplicationID string `json:"applicationId"`
		ApprovedBy    string `json:"approvedBy"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	appMu.Lock()
	defer appMu.Unlock()
	for i := range applications {
		if applications[i].ID == body.ApplicationID {
			if applications[i].Status != "kyc_verified" {
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(map[string]string{"error": "application must be KYC verified before approval"})
				return
			}
			applications[i].Status = "active"
			applications[i].ApprovedBy = body.ApprovedBy
			applications[i].UpdatedAt = time.Now()
			json.NewEncoder(w).Encode(applications[i])
			return
		}
	}
	w.WriteHeader(404)
	json.NewEncoder(w).Encode(map[string]string{"error": "application not found"})
}

func handleRejectApplication(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	var body struct {
		ApplicationID string `json:"applicationId"`
		Reason        string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Reason == "" {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "rejection reason is required"})
		return
	}

	appMu.Lock()
	defer appMu.Unlock()
	for i := range applications {
		if applications[i].ID == body.ApplicationID {
			applications[i].Status = "rejected"
			applications[i].RejectionReason = body.Reason
			applications[i].UpdatedAt = time.Now()
			json.NewEncoder(w).Encode(applications[i])
			return
		}
	}
	w.WriteHeader(404)
	json.NewEncoder(w).Encode(map[string]string{"error": "application not found"})
}

func handleKYCVerify(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	var body struct {
		ApplicationID string `json:"applicationId"`
		DocumentType  string `json:"documentType"`
		DocumentRef   string `json:"documentRef"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	validDocs := map[string]bool{"id_card": true, "utility_bill": true, "passport": true, "drivers_license": true, "cac_cert": true}
	if !validDocs[body.DocumentType] {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid documentType. Use: id_card, utility_bill, passport, drivers_license, cac_cert"})
		return
	}

	appMu.Lock()
	defer appMu.Unlock()
	for i := range applications {
		if applications[i].ID == body.ApplicationID {
			doc := KYCDoc{Type: body.DocumentType, Status: "verified", Reference: body.DocumentRef, UploadedAt: time.Now().Format(time.RFC3339)}
			applications[i].Documents = append(applications[i].Documents, doc)
			applications[i].Status = "kyc_verified"
			applications[i].UpdatedAt = time.Now()
			json.NewEncoder(w).Encode(applications[i])
			return
		}
	}
	w.WriteHeader(404)
	json.NewEncoder(w).Encode(map[string]string{"error": "application not found"})
}

func handleTierLimits(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	result := map[string]interface{}{}
	for tier, limits := range tierLimits {
		result[tier] = map[string]interface{}{
			"dailyLimit": limits.Daily, "singleTxnLimit": limits.SingleTxn,
			"maxBalance": limits.MaxBalance,
		}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"tiers": result})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" { w.WriteHeader(204); return }
		next.ServeHTTP(w, r)
	})
}


