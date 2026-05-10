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

// Loan Origination Engine — application intake, credit scoring, approval workflow, disbursement

type LoanApplication struct {
	ID              string    `json:"id"`
	CustomerID      string    `json:"customerId"`
	CustomerName    string    `json:"customerName"`
	ProductType     string    `json:"productType"`
	RequestedAmount float64   `json:"requestedAmount"`
	ApprovedAmount  float64   `json:"approvedAmount"`
	Currency        string    `json:"currency"`
	TenorMonths     int       `json:"tenorMonths"`
	InterestRate    float64   `json:"interestRate"`
	MonthlyPayment  float64   `json:"monthlyPayment"`
	Purpose         string    `json:"purpose"`
	Status          string    `json:"status"`
	CreditScore     int       `json:"creditScore"`
	CreditGrade     string    `json:"creditGrade"`
	DTIRatio        float64   `json:"dtiRatio"`
	CollateralValue float64   `json:"collateralValue"`
	CollateralType  string    `json:"collateralType"`
	ApprovalLevels  []Approval `json:"approvalLevels"`
	Conditions      []string  `json:"conditions"`
	DisbursedAt     *string   `json:"disbursedAt"`
	MaturityDate    *string   `json:"maturityDate"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type Approval struct {
	Level     string  `json:"level"`
	Approver  string  `json:"approver"`
	Decision  string  `json:"decision"`
	Timestamp string  `json:"timestamp"`
	Notes     string  `json:"notes"`
}

type CreditScoreResult struct {
	Score       int     `json:"score"`
	Grade       string  `json:"grade"`
	DTIRatio    float64 `json:"dtiRatio"`
	MaxLoan     float64 `json:"maxLoan"`
	Factors     []CreditFactor `json:"factors"`
}

type CreditFactor struct {
	Factor string `json:"factor"`
	Impact string `json:"impact"`
	Score  int    `json:"score"`
}

var (
	mu           sync.RWMutex
	applications []LoanApplication
)

func init() {
	now := time.Now()
	mat := "2028-01-15"
	disb := "2026-01-15T10:00:00Z"
	applications = []LoanApplication{
		{ID: "LN-001", CustomerID: "CUST-001", CustomerName: "Fatima Abdullahi", ProductType: "personal_loan", RequestedAmount: 5000000, ApprovedAmount: 5000000, Currency: "NGN", TenorMonths: 24, InterestRate: 22.5, MonthlyPayment: 258264.10, Purpose: "Business Expansion", Status: "disbursed", CreditScore: 720, CreditGrade: "A", DTIRatio: 28.5, CollateralValue: 8000000, CollateralType: "property", ApprovalLevels: []Approval{{Level: "officer", Approver: "OFC-001", Decision: "approved", Timestamp: "2026-01-10T09:00:00Z"}, {Level: "manager", Approver: "MGR-001", Decision: "approved", Timestamp: "2026-01-12T14:00:00Z"}}, Conditions: []string{"Salary domiciliation required"}, DisbursedAt: &disb, MaturityDate: &mat, CreatedAt: now, UpdatedAt: now},
		{ID: "LN-002", CustomerID: "CUST-002", CustomerName: "Ibrahim Musa", ProductType: "sme_loan", RequestedAmount: 25000000, ApprovedAmount: 0, Currency: "NGN", TenorMonths: 36, InterestRate: 25.0, MonthlyPayment: 0, Purpose: "Equipment Purchase", Status: "pending_credit_check", CreditScore: 0, CreditGrade: "", DTIRatio: 0, CollateralValue: 30000000, CollateralType: "equipment", ApprovalLevels: nil, Conditions: nil, DisbursedAt: nil, MaturityDate: nil, CreatedAt: now, UpdatedAt: now},
		{ID: "LN-003", CustomerID: "CUST-003", CustomerName: "Chioma Okafor", ProductType: "mortgage", RequestedAmount: 50000000, ApprovedAmount: 45000000, Currency: "NGN", TenorMonths: 240, InterestRate: 18.0, MonthlyPayment: 693513.37, Purpose: "Home Purchase", Status: "approved", CreditScore: 680, CreditGrade: "B", DTIRatio: 35.2, CollateralValue: 75000000, CollateralType: "property", ApprovalLevels: []Approval{{Level: "officer", Approver: "OFC-002", Decision: "approved", Timestamp: "2026-02-01T10:00:00Z"}, {Level: "manager", Approver: "MGR-001", Decision: "approved", Timestamp: "2026-02-03T11:00:00Z"}, {Level: "credit_committee", Approver: "CC-001", Decision: "approved", Timestamp: "2026-02-05T15:00:00Z", Notes: "Approved with 10% haircut"}}, Conditions: []string{"Property insurance required", "Salary domiciliation", "Life insurance assignment"}, DisbursedAt: nil, MaturityDate: nil, CreatedAt: now, UpdatedAt: now},
	}
}

// ── Business Logic ──

func computeCreditScore(income, expenses, existingDebt float64, yearsEmployed int, hasCollateral bool) CreditScoreResult {
	score := 300 // Base
	var factors []CreditFactor

	// Income factor (max +200)
	incomeScore := int(math.Min(float64(income)/50000, 200))
	score += incomeScore
	factors = append(factors, CreditFactor{"Monthly Income", "positive", incomeScore})

	// DTI ratio
	dti := 0.0
	if income > 0 {
		dti = math.Round((expenses+existingDebt)/income*10000) / 100
	}
	if dti < 30 {
		score += 100
		factors = append(factors, CreditFactor{"Low DTI Ratio", "positive", 100})
	} else if dti < 50 {
		score += 50
		factors = append(factors, CreditFactor{"Moderate DTI Ratio", "neutral", 50})
	} else {
		score -= 50
		factors = append(factors, CreditFactor{"High DTI Ratio", "negative", -50})
	}

	// Employment stability
	empScore := int(math.Min(float64(yearsEmployed)*20, 100))
	score += empScore
	factors = append(factors, CreditFactor{"Employment Stability", "positive", empScore})

	// Collateral
	if hasCollateral {
		score += 50
		factors = append(factors, CreditFactor{"Collateral Available", "positive", 50})
	}

	score = int(math.Max(300, math.Min(850, float64(score))))

	grade := "F"
	switch {
	case score >= 750:
		grade = "A"
	case score >= 700:
		grade = "B"
	case score >= 650:
		grade = "C"
	case score >= 600:
		grade = "D"
	case score >= 500:
		grade = "E"
	}

	maxLoan := income * 36 // 3 years of income
	if dti > 50 {
		maxLoan = income * 12
	}

	return CreditScoreResult{Score: score, Grade: grade, DTIRatio: dti, MaxLoan: maxLoan, Factors: factors}
}

func computeMonthlyPayment(principal, annualRate float64, tenorMonths int) float64 {
	if annualRate == 0 || tenorMonths == 0 {
		return 0
	}
	r := annualRate / 100 / 12
	n := float64(tenorMonths)
	payment := principal * r * math.Pow(1+r, n) / (math.Pow(1+r, n) - 1)
	return math.Round(payment*100) / 100
}

func requiredApprovalLevels(amount float64) []string {
	if amount <= 5000000 {
		return []string{"officer"}
	}
	if amount <= 25000000 {
		return []string{"officer", "manager"}
	}
	return []string{"officer", "manager", "credit_committee"}
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
		port = "8137"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "loan-origination", "port": port})
	})
	mux.HandleFunc("/v1/loans/applications", handleApplications)
	mux.HandleFunc("/v1/loans/credit-score", handleCreditScore)
	mux.HandleFunc("/v1/loans/approve", handleApprove)
	mux.HandleFunc("/v1/loans/reject", handleReject)
	mux.HandleFunc("/v1/loans/disburse", handleDisburse)
	mux.HandleFunc("/v1/loans/amortization", handleAmortization)

	log.Printf("Loan Origination Engine listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleApplications(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		var req struct {
			CustomerID   string  `json:"customerId"`
			CustomerName string  `json:"customerName"`
			ProductType  string  `json:"productType"`
			Amount       float64 `json:"amount"`
			TenorMonths  int     `json:"tenorMonths"`
			Purpose      string  `json:"purpose"`
			InterestRate float64 `json:"interestRate"`
			Collateral   float64 `json:"collateralValue"`
			CollatType   string  `json:"collateralType"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid body"}`, 400)
			return
		}
		if req.Amount <= 0 || req.TenorMonths <= 0 {
			http.Error(w, `{"error":"amount and tenorMonths must be positive"}`, 400)
			return
		}
		validProducts := map[string]bool{"personal_loan": true, "sme_loan": true, "mortgage": true, "auto_loan": true, "education_loan": true}
		if !validProducts[req.ProductType] {
			http.Error(w, `{"error":"invalid productType","valid":["personal_loan","sme_loan","mortgage","auto_loan","education_loan"]}`, 400)
			return
		}
		if req.InterestRate == 0 {
			req.InterestRate = 22.5
		}
		monthly := computeMonthlyPayment(req.Amount, req.InterestRate, req.TenorMonths)
		levels := requiredApprovalLevels(req.Amount)

		mu.Lock()
		app := LoanApplication{
			ID:              fmt.Sprintf("LN-%03d", len(applications)+1),
			CustomerID:      req.CustomerID,
			CustomerName:    req.CustomerName,
			ProductType:     req.ProductType,
			RequestedAmount: req.Amount,
			Currency:        "NGN",
			TenorMonths:     req.TenorMonths,
			InterestRate:    req.InterestRate,
			MonthlyPayment:  monthly,
			Purpose:         req.Purpose,
			Status:          "pending_credit_check",
			CollateralValue: req.Collateral,
			CollateralType:  req.CollatType,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		applications = append(applications, app)
		mu.Unlock()

		w.WriteHeader(201)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"application":       app,
			"requiredApprovals": levels,
			"estimatedMonthly":  monthly,
		})
		return
	}
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": applications, "total": len(applications)})
}

func handleCreditScore(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		Income        float64 `json:"monthlyIncome"`
		Expenses      float64 `json:"monthlyExpenses"`
		ExistingDebt  float64 `json:"existingDebt"`
		YearsEmployed int     `json:"yearsEmployed"`
		HasCollateral bool    `json:"hasCollateral"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	result := computeCreditScore(req.Income, req.Expenses, req.ExistingDebt, req.YearsEmployed, req.HasCollateral)
	json.NewEncoder(w).Encode(result)
}

func handleApprove(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		ApplicationID string  `json:"applicationId"`
		Level         string  `json:"level"`
		ApproverID    string  `json:"approverId"`
		ApprovedAmt   float64 `json:"approvedAmount"`
		Notes         string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	for i, app := range applications {
		if app.ID == req.ApplicationID {
			if app.Status == "disbursed" || app.Status == "rejected" {
				http.Error(w, fmt.Sprintf(`{"error":"application is '%s', cannot approve"}`, app.Status), 400)
				return
			}
			approval := Approval{
				Level:     req.Level,
				Approver:  req.ApproverID,
				Decision:  "approved",
				Timestamp: time.Now().Format(time.RFC3339),
				Notes:     req.Notes,
			}
			applications[i].ApprovalLevels = append(applications[i].ApprovalLevels, approval)
			if req.ApprovedAmt > 0 {
				applications[i].ApprovedAmount = req.ApprovedAmt
			} else {
				applications[i].ApprovedAmount = app.RequestedAmount
			}
			applications[i].MonthlyPayment = computeMonthlyPayment(applications[i].ApprovedAmount, app.InterestRate, app.TenorMonths)

			levels := requiredApprovalLevels(applications[i].ApprovedAmount)
			allApproved := true
			for _, lvl := range levels {
				found := false
				for _, a := range applications[i].ApprovalLevels {
					if a.Level == lvl && a.Decision == "approved" {
						found = true
						break
					}
				}
				if !found {
					allApproved = false
					break
				}
			}
			if allApproved {
				applications[i].Status = "approved"
			} else {
				applications[i].Status = "pending_approval"
			}
			applications[i].UpdatedAt = time.Now()
			json.NewEncoder(w).Encode(applications[i])
			return
		}
	}
	http.Error(w, `{"error":"application not found"}`, 404)
}

func handleReject(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		ApplicationID string `json:"applicationId"`
		Reason        string `json:"reason"`
		RejectedBy    string `json:"rejectedBy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	for i, app := range applications {
		if app.ID == req.ApplicationID {
			if app.Status == "disbursed" {
				http.Error(w, `{"error":"cannot reject disbursed loan"}`, 400)
				return
			}
			applications[i].Status = "rejected"
			applications[i].Conditions = append(applications[i].Conditions, "Rejected: "+req.Reason)
			applications[i].UpdatedAt = time.Now()
			json.NewEncoder(w).Encode(applications[i])
			return
		}
	}
	http.Error(w, `{"error":"application not found"}`, 404)
}

func handleDisburse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		ApplicationID string `json:"applicationId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	for i, app := range applications {
		if app.ID == req.ApplicationID {
			if app.Status != "approved" {
				http.Error(w, fmt.Sprintf(`{"error":"application status is '%s', must be 'approved' for disbursement"}`, app.Status), 400)
				return
			}
			now := time.Now().Format(time.RFC3339)
			mat := time.Now().AddDate(0, app.TenorMonths, 0).Format("2006-01-02")
			applications[i].Status = "disbursed"
			applications[i].DisbursedAt = &now
			applications[i].MaturityDate = &mat
			applications[i].UpdatedAt = time.Now()
			json.NewEncoder(w).Encode(applications[i])
			return
		}
	}
	http.Error(w, `{"error":"application not found"}`, 404)
}

func handleAmortization(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		Principal   float64 `json:"principal"`
		AnnualRate  float64 `json:"annualRate"`
		TenorMonths int     `json:"tenorMonths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	if req.Principal <= 0 || req.AnnualRate <= 0 || req.TenorMonths <= 0 {
		http.Error(w, `{"error":"principal, annualRate, and tenorMonths must be positive"}`, 400)
		return
	}

	monthlyRate := req.AnnualRate / 100 / 12
	payment := computeMonthlyPayment(req.Principal, req.AnnualRate, req.TenorMonths)
	balance := req.Principal
	totalInterest := 0.0

	type Row struct {
		Month     int     `json:"month"`
		Payment   float64 `json:"payment"`
		Principal float64 `json:"principal"`
		Interest  float64 `json:"interest"`
		Balance   float64 `json:"balance"`
	}
	var schedule []Row

	for m := 1; m <= req.TenorMonths; m++ {
		interest := math.Round(balance*monthlyRate*100) / 100
		princ := math.Round((payment-interest)*100) / 100
		if m == req.TenorMonths {
			princ = math.Round(balance*100) / 100
			interest = math.Round((payment-princ)*100) / 100
		}
		balance -= princ
		if balance < 0 {
			balance = 0
		}
		totalInterest += interest
		schedule = append(schedule, Row{m, payment, princ, interest, math.Round(balance*100) / 100})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"principal":     req.Principal,
		"annualRate":    req.AnnualRate,
		"tenorMonths":   req.TenorMonths,
		"monthlyPayment": payment,
		"totalInterest": math.Round(totalInterest*100) / 100,
		"totalPayment":  math.Round((req.Principal+totalInterest)*100) / 100,
		"schedule":      schedule,
	})
}
