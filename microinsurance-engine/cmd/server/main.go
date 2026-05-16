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
		port = "8094"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/micro/products", handleProducts)
	mux.HandleFunc("/api/v1/micro/enroll", handleEnroll)
	mux.HandleFunc("/api/v1/micro/group-enroll", handleGroupEnroll)
	mux.HandleFunc("/api/v1/micro/quote", handleQuote)
	mux.HandleFunc("/api/v1/micro/claim", handleClaim)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"microinsurance-engine"}`))
	})
	log.Printf("Microinsurance Engine starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

// MicroProduct represents a microinsurance product template
type MicroProduct struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Type            string   `json:"type"`
	MinPremium      float64  `json:"min_premium_ngn"`
	MaxCoverage     float64  `json:"max_coverage_ngn"`
	PremiumFrequency string  `json:"premium_frequency"`
	EnrollmentTime  string   `json:"enrollment_time"`
	MinKYCLevel     string   `json:"min_kyc_level"` // basic, standard, full
	Features        []string `json:"features"`
	Exclusions      []string `json:"exclusions"`
	WaitingPeriod   int      `json:"waiting_period_days"`
}

type EnrollRequest struct {
	ProductID    string `json:"product_id"`
	CustomerName string `json:"customer_name"`
	Phone        string `json:"phone"`
	DateOfBirth  string `json:"date_of_birth,omitempty"`
	Gender       string `json:"gender,omitempty"`
	PaymentMethod string `json:"payment_method"`
	GroupID      string `json:"group_id,omitempty"`
}

type GroupEnrollRequest struct {
	ProductID   string          `json:"product_id"`
	GroupName   string          `json:"group_name"`
	GroupType   string          `json:"group_type"` // church, cooperative, association, employer
	LeaderName  string          `json:"leader_name"`
	LeaderPhone string          `json:"leader_phone"`
	Members     []GroupMember   `json:"members"`
}

type GroupMember struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
	Role  string `json:"role,omitempty"`
}

func handleProducts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	products := []MicroProduct{
		{
			ID: "MICRO-HC-001", Name: "Hospital Cash", Type: "health",
			MinPremium: 500, MaxCoverage: 5000, PremiumFrequency: "daily",
			EnrollmentTime: "< 2 minutes", MinKYCLevel: "basic",
			Features: []string{
				"N5,000 per day hospitalization benefit",
				"Up to 30 days per year",
				"No medical exam required",
				"Mobile money payment",
				"Instant activation",
			},
			Exclusions: []string{"Pre-existing conditions (first 90 days)", "Self-inflicted injuries"},
			WaitingPeriod: 30,
		},
		{
			ID: "MICRO-FN-001", Name: "Funeral Cover", Type: "funeral",
			MinPremium: 500, MaxCoverage: 500000, PremiumFrequency: "monthly",
			EnrollmentTime: "< 2 minutes", MinKYCLevel: "basic",
			Features: []string{
				"N500,000 funeral benefit",
				"Covers policyholder + 4 dependents",
				"24-hour claims processing",
				"Cash payout within 48 hours",
			},
			Exclusions: []string{"Suicide (first 12 months)"},
			WaitingPeriod: 30,
		},
		{
			ID: "MICRO-DV-001", Name: "Device Protect", Type: "device",
			MinPremium: 200, MaxCoverage: 300000, PremiumFrequency: "monthly",
			EnrollmentTime: "< 1 minute", MinKYCLevel: "basic",
			Features: []string{
				"Covers theft and accidental damage",
				"Replacement within 48 hours",
				"Embedded at point of sale",
			},
			Exclusions: []string{"Cosmetic damage", "Loss/misplacement"},
			WaitingPeriod: 0,
		},
		{
			ID: "MICRO-CL-001", Name: "Credit Life", Type: "credit_life",
			MinPremium: 100, MaxCoverage: 1000000, PremiumFrequency: "per_loan",
			EnrollmentTime: "automatic", MinKYCLevel: "basic",
			Features: []string{
				"Covers outstanding loan on death/disability",
				"Embedded in microfinance loans",
				"Premium included in loan repayment",
				"Automatic enrollment",
			},
			Exclusions: []string{"Loan default prior to event"},
			WaitingPeriod: 0,
		},
		{
			ID: "MICRO-CR-001", Name: "Crop Shield", Type: "crop",
			MinPremium: 1000, MaxCoverage: 500000, PremiumFrequency: "seasonal",
			EnrollmentTime: "< 5 minutes", MinKYCLevel: "standard",
			Features: []string{
				"Parametric (satellite rainfall trigger)",
				"Automatic payout - no claims process",
				"Covers drought and excess rainfall",
				"Seasonal coverage (planting to harvest)",
			},
			Exclusions: []string{"Pest damage (separate product)"},
			WaitingPeriod: 0,
		},
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"products": products})
}

func handleQuote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ProductID string  `json:"product_id"`
		Age       int     `json:"age,omitempty"`
		Amount    float64 `json:"coverage_amount,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	basePremium := 500.0
	switch req.ProductID {
	case "MICRO-HC-001":
		basePremium = 500 + float64(max(0, req.Age-30))*10
	case "MICRO-FN-001":
		basePremium = 500 + float64(max(0, req.Age-25))*15
	case "MICRO-DV-001":
		if req.Amount > 0 {
			basePremium = req.Amount * 0.005
		} else {
			basePremium = 200
		}
	case "MICRO-CL-001":
		if req.Amount > 0 {
			basePremium = req.Amount * 0.003
		} else {
			basePremium = 100
		}
	case "MICRO-CR-001":
		basePremium = 1000
	}
	basePremium = math.Round(basePremium*100) / 100

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"product_id":  req.ProductID,
		"premium":     basePremium,
		"currency":    "NGN",
		"valid_until": time.Now().Add(24 * time.Hour).Format(time.RFC3339),
	})
}

func handleEnroll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req EnrollRequest
	json.NewDecoder(r.Body).Decode(&req)

	policyNum := fmt.Sprintf("NGA-MIC-%d", time.Now().UnixNano()%1000000)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"policy_number": policyNum,
		"status":        "active",
		"product_id":    req.ProductID,
		"customer_name": req.CustomerName,
		"phone":         req.Phone,
		"enrolled_at":   time.Now().Format(time.RFC3339),
		"message":       "Welcome! Your microinsurance is now active. Details sent via SMS.",
	})
}

func handleGroupEnroll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req GroupEnrollRequest
	json.NewDecoder(r.Body).Decode(&req)

	groupID := fmt.Sprintf("GRP-%d", time.Now().UnixNano()%1000000)
	memberPolicies := make([]map[string]string, len(req.Members))
	for i, m := range req.Members {
		memberPolicies[i] = map[string]string{
			"name":          m.Name,
			"phone":         m.Phone,
			"policy_number": fmt.Sprintf("NGA-GRP-%s-%03d", groupID[4:], i+1),
			"status":        "active",
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group_id":        groupID,
		"group_name":      req.GroupName,
		"group_type":      req.GroupType,
		"member_count":    len(req.Members),
		"member_policies": memberPolicies,
		"status":          "active",
		"message":         fmt.Sprintf("Group '%s' enrolled with %d members", req.GroupName, len(req.Members)),
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
		"claim_number":      fmt.Sprintf("NGA-MCL-%d", time.Now().UnixNano()%1000000),
		"status":            "submitted",
		"expected_decision": "within 4 hours",
		"message":           "Claim submitted. For microinsurance claims under N50,000, expect auto-approval within 4 hours.",
	})
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
