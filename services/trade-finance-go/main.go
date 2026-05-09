package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ── Models ──

type LetterOfCredit struct {
	ID                string        `json:"id"`
	TenantID          string        `json:"tenantId"`
	LCType            string        `json:"lcType"`
	ApplicantID       string        `json:"applicantId"`
	ApplicantName     string        `json:"applicantName"`
	BeneficiaryName   string        `json:"beneficiaryName"`
	BeneficiaryBank   string        `json:"beneficiaryBank"`
	BeneficiaryCountry string       `json:"beneficiaryCountry"`
	IssuingBank       string        `json:"issuingBank"`
	AdvisingBank      string        `json:"advisingBank"`
	Amount            float64       `json:"amount"`
	Currency          string        `json:"currency"`
	Commodity         string        `json:"commodity"`
	Incoterm          string        `json:"incoterm"`
	PortOfLoading     string        `json:"portOfLoading"`
	PortOfDischarge   string        `json:"portOfDischarge"`
	LatestShipDate    string        `json:"latestShipDate"`
	ExpiryDate        string        `json:"expiryDate"`
	DocumentsRequired []string      `json:"documentsRequired"`
	Amendments        []LCAmendment `json:"amendments"`
	Status            string        `json:"status"`
	Middleware        []string      `json:"middleware"`
	CreatedAt         string        `json:"createdAt"`
	UpdatedAt         string        `json:"updatedAt"`
}

type LCAmendment struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	RequestedBy string `json:"requestedBy"`
	Status      string `json:"status"`
	CreatedAt   string `json:"createdAt"`
}

type WarehouseReceipt struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenantId"`
	DepositorID     string  `json:"depositorId"`
	DepositorName   string  `json:"depositorName"`
	WarehouseID     string  `json:"warehouseId"`
	WarehouseName   string  `json:"warehouseName"`
	Location        string  `json:"location"`
	Commodity       string  `json:"commodity"`
	Quantity        float64 `json:"quantity"`
	QuantityUnit    string  `json:"quantityUnit"`
	QualityGrade    string  `json:"qualityGrade"`
	StorageStartDate string `json:"storageStartDate"`
	ExpiryDate      string  `json:"expiryDate"`
	MarketValue     float64 `json:"marketValue"`
	Currency        string  `json:"currency"`
	PledgedAsCollateral bool   `json:"pledgedAsCollateral"`
	CollateralLoanID    *string `json:"collateralLoanId"`
	InsurancePolicyID   *string `json:"insurancePolicyId"`
	Status          string  `json:"status"`
	Middleware      []string `json:"middleware"`
	CreatedAt       string  `json:"createdAt"`
	UpdatedAt       string  `json:"updatedAt"`
}

type BankGuarantee struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenantId"`
	GuaranteeType   string  `json:"guaranteeType"`
	ApplicantID     string  `json:"applicantId"`
	ApplicantName   string  `json:"applicantName"`
	BeneficiaryName string  `json:"beneficiaryName"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	Purpose         string  `json:"purpose"`
	EffectiveDate   string  `json:"effectiveDate"`
	ExpiryDate      string  `json:"expiryDate"`
	ClaimDeadline   string  `json:"claimDeadline"`
	CommissionRate  float64 `json:"commissionRate"`
	CommissionAmount float64 `json:"commissionAmount"`
	Status          string  `json:"status"`
	Middleware      []string `json:"middleware"`
	CreatedAt       string  `json:"createdAt"`
	UpdatedAt       string  `json:"updatedAt"`
}

// ── Request types ──

type CreateLCRequest struct {
	LCType            string   `json:"lcType"`
	ApplicantID       string   `json:"applicantId"`
	ApplicantName     string   `json:"applicantName"`
	BeneficiaryName   string   `json:"beneficiaryName"`
	BeneficiaryBank   string   `json:"beneficiaryBank"`
	BeneficiaryCountry string  `json:"beneficiaryCountry"`
	Amount            float64  `json:"amount"`
	Currency          string   `json:"currency"`
	Commodity         string   `json:"commodity"`
	Incoterm          string   `json:"incoterm"`
	PortOfLoading     string   `json:"portOfLoading"`
	PortOfDischarge   string   `json:"portOfDischarge"`
	LatestShipDate    string   `json:"latestShipDate"`
	ExpiryDate        string   `json:"expiryDate"`
	DocumentsRequired []string `json:"documentsRequired"`
}

type CreateWarehouseReceiptRequest struct {
	DepositorID     string  `json:"depositorId"`
	DepositorName   string  `json:"depositorName"`
	WarehouseID     string  `json:"warehouseId"`
	WarehouseName   string  `json:"warehouseName"`
	Location        string  `json:"location"`
	Commodity       string  `json:"commodity"`
	Quantity        float64 `json:"quantity"`
	QuantityUnit    string  `json:"quantityUnit"`
	QualityGrade    string  `json:"qualityGrade"`
	ExpiryDate      string  `json:"expiryDate"`
	MarketValue     float64 `json:"marketValue"`
	Currency        string  `json:"currency"`
}

type CreateGuaranteeRequest struct {
	GuaranteeType   string  `json:"guaranteeType"`
	ApplicantID     string  `json:"applicantId"`
	ApplicantName   string  `json:"applicantName"`
	BeneficiaryName string  `json:"beneficiaryName"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	Purpose         string  `json:"purpose"`
	EffectiveDate   string  `json:"effectiveDate"`
	ExpiryDate      string  `json:"expiryDate"`
	CommissionRate  float64 `json:"commissionRate"`
}

type AmendLCRequest struct {
	Description string `json:"description"`
	RequestedBy string `json:"requestedBy"`
}

// ── State ──

type AppState struct {
	mu         sync.RWMutex
	lcs        []LetterOfCredit
	receipts   []WarehouseReceipt
	guarantees []BankGuarantee
}

func newAppState() *AppState {
	return &AppState{
		lcs:        make([]LetterOfCredit, 0),
		receipts:   make([]WarehouseReceipt, 0),
		guarantees: make([]BankGuarantee, 0),
	}
}

func defaultTenant() string {
	if t := os.Getenv("TENANT_ID"); t != "" {
		return t
	}
	return "54bank-platform-prod"
}

func genID(prefix string) string {
	return fmt.Sprintf("%s-%08X", prefix, rand.Uint32())
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func main() {
	state := newAppState()
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":     "ok",
			"service":    "trade-finance-go",
			"timestamp":  nowISO(),
			"middleware": []string{"TigerBeetle", "Kafka", "Temporal", "Permify", "APISIX", "SWIFT-gateway"},
		})
	})

	// Letter of Credit CRUD
	mux.HandleFunc("/v1/trade-finance/letters-of-credit", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			state.mu.RLock()
			defer state.mu.RUnlock()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"asOf": nowISO(), "items": state.lcs, "total": len(state.lcs),
			})
		case http.MethodPost:
			var req CreateLCRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid payload"})
				return
			}
			if req.ApplicantID == "" || req.BeneficiaryName == "" || req.Amount <= 0 {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "applicantId, beneficiaryName, and amount (>0) required"})
				return
			}
			lcType := req.LCType
			if lcType == "" {
				lcType = "irrevocable"
			}
			docs := req.DocumentsRequired
			if len(docs) == 0 {
				docs = []string{"commercial_invoice", "bill_of_lading", "packing_list", "certificate_of_origin", "insurance_certificate"}
			}
			lc := LetterOfCredit{
				ID:                genID("LC"),
				TenantID:          defaultTenant(),
				LCType:            lcType,
				ApplicantID:       req.ApplicantID,
				ApplicantName:     req.ApplicantName,
				BeneficiaryName:   req.BeneficiaryName,
				BeneficiaryBank:   req.BeneficiaryBank,
				BeneficiaryCountry: req.BeneficiaryCountry,
				IssuingBank:       "54Bank",
				AdvisingBank:      req.BeneficiaryBank,
				Amount:            req.Amount,
				Currency:          orDefault(req.Currency, "USD"),
				Commodity:         req.Commodity,
				Incoterm:          orDefault(req.Incoterm, "CIF"),
				PortOfLoading:     req.PortOfLoading,
				PortOfDischarge:   req.PortOfDischarge,
				LatestShipDate:    req.LatestShipDate,
				ExpiryDate:        req.ExpiryDate,
				DocumentsRequired: docs,
				Amendments:        make([]LCAmendment, 0),
				Status:            "draft",
				Middleware:        []string{"TigerBeetle", "Kafka", "Temporal", "SWIFT-gateway", "compliance-service"},
				CreatedAt:         nowISO(),
				UpdatedAt:         nowISO(),
			}
			state.mu.Lock()
			state.lcs = append(state.lcs, lc)
			state.mu.Unlock()
			respondJSON(w, http.StatusCreated, lc)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// LC by ID + actions
	mux.HandleFunc("/v1/trade-finance/letters-of-credit/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/trade-finance/letters-of-credit/"), "/")
		id := parts[0]
		action := ""
		if len(parts) > 1 {
			action = parts[1]
		}

		state.mu.Lock()
		defer state.mu.Unlock()
		idx := -1
		for i, lc := range state.lcs {
			if lc.ID == id {
				idx = i
				break
			}
		}
		if idx == -1 {
			respondJSON(w, http.StatusNotFound, map[string]string{"message": "Letter of credit not found"})
			return
		}

		switch {
		case action == "" && r.Method == http.MethodGet:
			respondJSON(w, http.StatusOK, state.lcs[idx])

		case action == "issue" && r.Method == http.MethodPost:
			if state.lcs[idx].Status != "draft" {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "LC must be in draft status to issue"})
				return
			}
			state.lcs[idx].Status = "issued"
			state.lcs[idx].UpdatedAt = nowISO()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"lc": state.lcs[idx],
				"swiftMessage": map[string]string{
					"type": "MT700", "status": "queued",
					"description": "LC issuance SWIFT message queued for transmission",
				},
				"middleware": []string{"SWIFT-gateway", "Kafka", "TigerBeetle"},
			})

		case action == "amend" && r.Method == http.MethodPost:
			var req AmendLCRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid payload"})
				return
			}
			amendment := LCAmendment{
				ID:          genID("LCAMD"),
				Description: req.Description,
				RequestedBy: req.RequestedBy,
				Status:      "pending_approval",
				CreatedAt:   nowISO(),
			}
			state.lcs[idx].Amendments = append(state.lcs[idx].Amendments, amendment)
			state.lcs[idx].UpdatedAt = nowISO()
			respondJSON(w, http.StatusCreated, map[string]interface{}{
				"amendment": amendment,
				"lc":        state.lcs[idx],
			})

		case action == "present-documents" && r.Method == http.MethodPost:
			state.lcs[idx].Status = "documents_presented"
			state.lcs[idx].UpdatedAt = nowISO()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"lc":     state.lcs[idx],
				"review": map[string]string{"status": "under_examination", "examiner": "trade-finance-ops"},
			})

		case action == "settle" && r.Method == http.MethodPost:
			if state.lcs[idx].Status != "documents_presented" && state.lcs[idx].Status != "issued" {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "LC not ready for settlement"})
				return
			}
			state.lcs[idx].Status = "settled"
			state.lcs[idx].UpdatedAt = nowISO()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"lc": state.lcs[idx],
				"ledgerEntry": map[string]interface{}{
					"debit": "lc-liability", "credit": "beneficiary-nostro",
					"amount": state.lcs[idx].Amount, "currency": state.lcs[idx].Currency,
					"middleware": []string{"TigerBeetle", "Kafka", "SWIFT-gateway"},
				},
			})

		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Warehouse Receipts
	mux.HandleFunc("/v1/trade-finance/warehouse-receipts", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			state.mu.RLock()
			defer state.mu.RUnlock()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"asOf": nowISO(), "items": state.receipts, "total": len(state.receipts),
			})
		case http.MethodPost:
			var req CreateWarehouseReceiptRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid payload"})
				return
			}
			if req.DepositorID == "" || req.Commodity == "" || req.Quantity <= 0 {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "depositorId, commodity, and quantity (>0) required"})
				return
			}
			receipt := WarehouseReceipt{
				ID:              genID("WHR"),
				TenantID:        defaultTenant(),
				DepositorID:     req.DepositorID,
				DepositorName:   req.DepositorName,
				WarehouseID:     req.WarehouseID,
				WarehouseName:   req.WarehouseName,
				Location:        req.Location,
				Commodity:       req.Commodity,
				Quantity:        req.Quantity,
				QuantityUnit:    orDefault(req.QuantityUnit, "tonnes"),
				QualityGrade:    orDefault(req.QualityGrade, "Grade A"),
				StorageStartDate: nowISO()[:10],
				ExpiryDate:      req.ExpiryDate,
				MarketValue:     req.MarketValue,
				Currency:        orDefault(req.Currency, "NGN"),
				PledgedAsCollateral: false,
				CollateralLoanID:   nil,
				InsurancePolicyID:  nil,
				Status:          "active",
				Middleware:       []string{"Kafka", "Postgres", "warehouse-receipt-registry", "APISIX"},
				CreatedAt:        nowISO(),
				UpdatedAt:        nowISO(),
			}
			state.mu.Lock()
			state.receipts = append(state.receipts, receipt)
			state.mu.Unlock()
			respondJSON(w, http.StatusCreated, receipt)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/v1/trade-finance/warehouse-receipts/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/trade-finance/warehouse-receipts/"), "/")
		id := parts[0]
		action := ""
		if len(parts) > 1 {
			action = parts[1]
		}

		state.mu.Lock()
		defer state.mu.Unlock()
		idx := -1
		for i, rc := range state.receipts {
			if rc.ID == id {
				idx = i
				break
			}
		}
		if idx == -1 {
			respondJSON(w, http.StatusNotFound, map[string]string{"message": "Warehouse receipt not found"})
			return
		}

		switch {
		case action == "" && r.Method == http.MethodGet:
			respondJSON(w, http.StatusOK, state.receipts[idx])

		case action == "pledge" && r.Method == http.MethodPost:
			if state.receipts[idx].PledgedAsCollateral {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "Receipt already pledged"})
				return
			}
			var body struct {
				LoanID string `json:"loanId"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			state.receipts[idx].PledgedAsCollateral = true
			loanID := body.LoanID
			state.receipts[idx].CollateralLoanID = &loanID
			state.receipts[idx].UpdatedAt = nowISO()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"receipt": state.receipts[idx],
				"collateral": map[string]interface{}{
					"loanId": body.LoanID, "marketValue": state.receipts[idx].MarketValue,
					"middleware": []string{"Kafka", "Postgres", "Permify"},
				},
			})

		case action == "release" && r.Method == http.MethodPost:
			state.receipts[idx].PledgedAsCollateral = false
			state.receipts[idx].CollateralLoanID = nil
			state.receipts[idx].Status = "released"
			state.receipts[idx].UpdatedAt = nowISO()
			respondJSON(w, http.StatusOK, state.receipts[idx])

		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Bank Guarantees
	mux.HandleFunc("/v1/trade-finance/guarantees", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			state.mu.RLock()
			defer state.mu.RUnlock()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"asOf": nowISO(), "items": state.guarantees, "total": len(state.guarantees),
			})
		case http.MethodPost:
			var req CreateGuaranteeRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid payload"})
				return
			}
			if req.ApplicantID == "" || req.BeneficiaryName == "" || req.Amount <= 0 {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "applicantId, beneficiaryName, and amount (>0) required"})
				return
			}
			commission := req.Amount * req.CommissionRate / 100
			bg := BankGuarantee{
				ID:              genID("BG"),
				TenantID:        defaultTenant(),
				GuaranteeType:   orDefault(req.GuaranteeType, "performance"),
				ApplicantID:     req.ApplicantID,
				ApplicantName:   req.ApplicantName,
				BeneficiaryName: req.BeneficiaryName,
				Amount:          req.Amount,
				Currency:        orDefault(req.Currency, "USD"),
				Purpose:         req.Purpose,
				EffectiveDate:   req.EffectiveDate,
				ExpiryDate:      req.ExpiryDate,
				ClaimDeadline:   req.ExpiryDate,
				CommissionRate:  req.CommissionRate,
				CommissionAmount: commission,
				Status:          "active",
				Middleware:       []string{"TigerBeetle", "Kafka", "Temporal", "SWIFT-gateway", "Permify"},
				CreatedAt:        nowISO(),
				UpdatedAt:        nowISO(),
			}
			state.mu.Lock()
			state.guarantees = append(state.guarantees, bg)
			state.mu.Unlock()
			respondJSON(w, http.StatusCreated, map[string]interface{}{
				"guarantee": bg,
				"ledgerEntry": map[string]interface{}{
					"debit": "guarantee-commission-receivable", "credit": "fee-income",
					"amount": commission, "middleware": []string{"TigerBeetle", "Kafka"},
				},
			})
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8093"
	}
	log.Printf("trade-finance-go listening on %s", addr)
	log.Printf("middleware integrations: TigerBeetle, Kafka, Temporal, Permify, APISIX, SWIFT-gateway")
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func orDefault(val, def string) string {
	if val == "" {
		return def
	}
	return val
}
