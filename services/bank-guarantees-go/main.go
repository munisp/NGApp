package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type Guarantee struct {
	ID               string  `json:"id"`
	GuaranteeType    string  `json:"guaranteeType"` // bid, performance, advance_payment, financial, standby_lc, counter
	ReferenceNumber  string  `json:"referenceNumber"`
	ApplicantID      string  `json:"applicantId"`
	ApplicantName    string  `json:"applicantName"`
	BeneficiaryID    string  `json:"beneficiaryId"`
	BeneficiaryName  string  `json:"beneficiaryName"`
	Currency         string  `json:"currency"`
	Amount           float64 `json:"amount"`
	IssueDate        string  `json:"issueDate"`
	ExpiryDate       string  `json:"expiryDate"`
	TenorDays        int     `json:"tenorDays"`
	CommissionRate   float64 `json:"commissionRate"`
	CommissionAmount float64 `json:"commissionAmount"`
	CollateralType   string  `json:"collateralType"`
	CollateralValue  float64 `json:"collateralValue"`
	MarginPct        float64 `json:"marginPct"`
	MarginHeld       float64 `json:"marginHeld"`
	Status           string  `json:"status"` // issued, amended, claimed, expired, cancelled
	Purpose          string  `json:"purpose"`
	UnderlyingContract string `json:"underlyingContract"`
	SwiftRef         string  `json:"swiftRef,omitempty"`
	ClaimHistory     []Claim `json:"claimHistory"`
}

type Claim struct {
	ClaimID     string  `json:"claimId"`
	ClaimDate   string  `json:"claimDate"`
	ClaimAmount float64 `json:"claimAmount"`
	Status      string  `json:"status"` // received, under_review, paid, rejected
	Reason      string  `json:"reason"`
}

type GuaranteeRequest struct {
	GuaranteeType   string  `json:"guaranteeType"`
	ApplicantName   string  `json:"applicantName"`
	BeneficiaryName string  `json:"beneficiaryName"`
	Amount          float64 `json:"amount"`
	TenorDays       int     `json:"tenorDays"`
	Purpose         string  `json:"purpose"`
	CollateralType  string  `json:"collateralType"`
	CollateralValue float64 `json:"collateralValue"`
	MarginPct       float64 `json:"marginPct"`
}

var (
	guarantees []Guarantee
	mu         sync.Mutex
)

func init() {
	guarantees = []Guarantee{
		{
			ID: "BG-001", GuaranteeType: "bid", ReferenceNumber: "BG/2026/BID/001",
			ApplicantID: "CORP-001", ApplicantName: "Julius Berger Nigeria PLC",
			BeneficiaryID: "GOV-001", BeneficiaryName: "Federal Ministry of Works",
			Currency: "NGN", Amount: 5_000_000_000, IssueDate: "2026-04-01", ExpiryDate: "2026-07-01",
			TenorDays: 91, CommissionRate: 1.5, CommissionAmount: 18_958_333,
			CollateralType: "cash_deposit", CollateralValue: 2_500_000_000, MarginPct: 50.0, MarginHeld: 2_500_000_000,
			Status: "issued", Purpose: "Lagos-Calabar Coastal Road Project Phase 3 Bid",
			UnderlyingContract: "FMOW/2026/LCCR/003", SwiftRef: "MT760-54B-2026-001",
			ClaimHistory: nil,
		},
		{
			ID: "BG-002", GuaranteeType: "performance", ReferenceNumber: "BG/2026/PERF/001",
			ApplicantID: "CORP-002", ApplicantName: "Dangote Industries Ltd",
			BeneficiaryID: "CORP-010", BeneficiaryName: "NNPC Limited",
			Currency: "USD", Amount: 50_000_000, IssueDate: "2026-01-15", ExpiryDate: "2028-01-15",
			TenorDays: 730, CommissionRate: 2.0, CommissionAmount: 2_027_778,
			CollateralType: "property", CollateralValue: 30_000_000_000, MarginPct: 10.0, MarginHeld: 5_000_000,
			Status: "issued", Purpose: "Dangote Refinery Phase 2 - Pipeline Construction",
			UnderlyingContract: "NNPC/2026/REF/P2/001", SwiftRef: "MT760-54B-2026-002",
			ClaimHistory: nil,
		},
		{
			ID: "BG-003", GuaranteeType: "advance_payment", ReferenceNumber: "BG/2026/APG/001",
			ApplicantID: "CORP-003", ApplicantName: "Lafarge Africa PLC",
			BeneficiaryID: "GOV-002", BeneficiaryName: "Lagos State Government",
			Currency: "NGN", Amount: 8_000_000_000, IssueDate: "2026-03-01", ExpiryDate: "2027-03-01",
			TenorDays: 365, CommissionRate: 2.5, CommissionAmount: 202_739_726,
			CollateralType: "fixed_deposit", CollateralValue: 10_000_000_000, MarginPct: 100.0, MarginHeld: 8_000_000_000,
			Status: "issued", Purpose: "Blue Line Rail Extension - Advance Payment",
			UnderlyingContract: "LASG/2026/RAIL/BL/001", SwiftRef: "MT760-54B-2026-003",
			ClaimHistory: nil,
		},
		{
			ID: "BG-004", GuaranteeType: "financial", ReferenceNumber: "BG/2025/FIN/005",
			ApplicantID: "CORP-004", ApplicantName: "MTN Nigeria Communications",
			BeneficiaryID: "REG-001", BeneficiaryName: "Nigerian Communications Commission",
			Currency: "NGN", Amount: 15_000_000_000, IssueDate: "2025-08-01", ExpiryDate: "2026-02-01",
			TenorDays: 184, CommissionRate: 1.0, CommissionAmount: 76_712_329,
			CollateralType: "bank_guarantee_counter", CollateralValue: 15_000_000_000, MarginPct: 25.0, MarginHeld: 3_750_000_000,
			Status: "expired", Purpose: "5G Spectrum License Performance Bond",
			UnderlyingContract: "NCC/2025/5G/MTN/001",
			ClaimHistory: nil,
		},
		{
			ID: "BG-005", GuaranteeType: "standby_lc", ReferenceNumber: "BG/2026/SBLC/001",
			ApplicantID: "CORP-005", ApplicantName: "BUA Cement PLC",
			BeneficiaryID: "BANK-EXT", BeneficiaryName: "Standard Chartered Bank UK",
			Currency: "USD", Amount: 25_000_000, IssueDate: "2026-02-15", ExpiryDate: "2027-02-15",
			TenorDays: 365, CommissionRate: 2.0, CommissionAmount: 506_849,
			CollateralType: "mixed", CollateralValue: 20_000_000_000, MarginPct: 30.0, MarginHeld: 7_500_000,
			Status: "issued", Purpose: "Equipment Import - Cement Plant Expansion",
			UnderlyingContract: "BUA/2026/IMP/EQUIP/001", SwiftRef: "MT760-54B-2026-005",
			ClaimHistory: nil,
		},
		{
			ID: "BG-006", GuaranteeType: "performance", ReferenceNumber: "BG/2025/PERF/012",
			ApplicantID: "CORP-006", ApplicantName: "Oando PLC",
			BeneficiaryID: "CORP-011", BeneficiaryName: "Total Energies Nigeria",
			Currency: "USD", Amount: 10_000_000, IssueDate: "2025-06-01", ExpiryDate: "2026-06-01",
			TenorDays: 365, CommissionRate: 2.5, CommissionAmount: 253_425,
			CollateralType: "cash_deposit", CollateralValue: 10_000_000, MarginPct: 100.0, MarginHeld: 10_000_000,
			Status: "claimed", Purpose: "OML 42 Joint Venture Operations",
			UnderlyingContract: "TOTAL/2025/JV/OML42",
			ClaimHistory: []Claim{
				{"CLM-001", "2026-04-15", 3_000_000, "paid", "Failure to meet Q1 production targets"},
			},
		},
	}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"status": "ok", "service": "bank-guarantees",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"bg.issued", "bg.amended", "bg.claimed", "bg.expired"}},
				"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"bg:limits", "bg:counterparties", "bg:commissions"}},
				"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"guarantees", "guarantee_claims", "guarantee_amendments"}},
				"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"bg-guarantees", "bg-claims-audit"}},
				"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "bank-guarantees-service"},
				"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"guarantee", "guarantee_claim", "guarantee_amendment"}},
				"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "bank-guarantees", "pubsub": "bg-events"},
				"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"bg-swift-messages", "bg-expiry-alerts"}},
				"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"GuaranteeIssuanceWorkflow", "ClaimProcessingWorkflow", "ExpiryMonitoringWorkflow"}},
				"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "guarantee-margin-settlement"},
				"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"bg_contingent_liabilities", "bg_margin_accounts", "bg_commission_accruals"}},
				"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"bg_guarantees_history", "bg_claims_history"}},
				"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/api/guarantees/*"}},
				"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "bg-waf-rules"},
			},
		})
	})

	mux.HandleFunc("/v1/guarantees", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			mu.Lock()
			respondJSON(w, 200, map[string]interface{}{"items": guarantees, "total": len(guarantees)})
			mu.Unlock()
			return
		}
		if r.Method == http.MethodPost {
			var req GuaranteeRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, 400, map[string]string{"error": "invalid JSON"})
				return
			}
			validTypes := map[string]bool{"bid": true, "performance": true, "advance_payment": true, "financial": true, "standby_lc": true, "counter": true}
			if !validTypes[req.GuaranteeType] {
				respondJSON(w, 400, map[string]string{"error": "guaranteeType must be one of: bid, performance, advance_payment, financial, standby_lc, counter"})
				return
			}
			if req.Amount <= 0 {
				respondJSON(w, 400, map[string]string{"error": "amount must be positive"})
				return
			}
			if req.TenorDays <= 0 {
				respondJSON(w, 400, map[string]string{"error": "tenorDays must be positive"})
				return
			}
			if req.ApplicantName == "" || req.BeneficiaryName == "" {
				respondJSON(w, 400, map[string]string{"error": "applicantName and beneficiaryName are required"})
				return
			}
			commission := req.Amount * (req.MarginPct / 100.0) * float64(req.TenorDays) / 365.0
			mu.Lock()
			g := Guarantee{
				ID: fmt.Sprintf("BG-%03d", len(guarantees)+1),
				GuaranteeType: req.GuaranteeType,
				ReferenceNumber: fmt.Sprintf("BG/2026/%s/%03d", req.GuaranteeType, len(guarantees)+1),
				ApplicantName: req.ApplicantName, BeneficiaryName: req.BeneficiaryName,
				Currency: "NGN", Amount: req.Amount, IssueDate: "2026-05-10", ExpiryDate: "TBD",
				TenorDays: req.TenorDays, CommissionRate: req.MarginPct, CommissionAmount: commission,
				CollateralType: req.CollateralType, CollateralValue: req.CollateralValue,
				MarginPct: req.MarginPct, MarginHeld: req.Amount * req.MarginPct / 100.0,
				Status: "issued", Purpose: req.Purpose,
			}
			guarantees = append(guarantees, g)
			mu.Unlock()
			respondJSON(w, 201, g)
			return
		}
		respondJSON(w, 405, map[string]string{"error": "method not allowed"})
	})

	mux.HandleFunc("/v1/guarantees/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		totalExposure := 0.0
		totalMargin := 0.0
		totalClaims := 0.0
		active := 0
		for _, g := range guarantees {
			if g.Status == "issued" {
				totalExposure += g.Amount
				active++
			}
			totalMargin += g.MarginHeld
			for _, c := range g.ClaimHistory {
				if c.Status == "paid" {
					totalClaims += c.ClaimAmount
				}
			}
		}
		byType := map[string]int{}
		for _, g := range guarantees {
			byType[g.GuaranteeType]++
		}
		respondJSON(w, 200, map[string]interface{}{
			"totalGuarantees": len(guarantees), "activeGuarantees": active,
			"totalExposure": totalExposure, "totalMarginHeld": totalMargin,
			"totalClaimsPaid": totalClaims, "byType": byType,
		})
	})

	fmt.Println("Bank Guarantees service on :8160")
	http.ListenAndServe(":8160", mux)
}
