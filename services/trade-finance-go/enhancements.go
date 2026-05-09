package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// B3: Trade Finance Enhancements
// SWIFT MT messaging, syndicated LCs, trade insurance, documentary collections

type SWIFTMessage struct {
	ID          string    `json:"id"`
	MessageType string    `json:"messageType"` // MT700, MT710, MT720, MT799
	Sender      string    `json:"senderBIC"`
	Receiver    string    `json:"receiverBIC"`
	Reference   string    `json:"reference"`
	Content     string    `json:"content"`
	Status      string    `json:"status"` // draft, sent, acknowledged, rejected
	CreatedAt   time.Time `json:"createdAt"`
}

type SyndicatedLC struct {
	ID              string  `json:"id"`
	LeadBankBIC     string  `json:"leadBankBIC"`
	Participants    []ParticipantBank `json:"participants"`
	TotalAmount     float64 `json:"totalAmount"`
	Currency        string  `json:"currency"`
	BeneficiaryName string  `json:"beneficiaryName"`
	ExpiryDate      string  `json:"expiryDate"`
	Status          string  `json:"status"`
}

type ParticipantBank struct {
	BIC        string  `json:"bic"`
	SharePct   float64 `json:"sharePercent"`
	Amount     float64 `json:"amount"`
	Confirmed  bool    `json:"confirmed"`
}

type TradeInsurance struct {
	ID           string  `json:"id"`
	PolicyNumber string  `json:"policyNumber"`
	LcID         string  `json:"lcId"`
	Insurer      string  `json:"insurer"`
	CoverageType string  `json:"coverageType"` // political, commercial, marine, cargo
	CoverageAmt  float64 `json:"coverageAmount"`
	Premium      float64 `json:"premium"`
	Status       string  `json:"status"`
}

type DocumentaryCollection struct {
	ID            string  `json:"id"`
	ExporterID    string  `json:"exporterId"`
	ImporterID    string  `json:"importerId"`
	CollectionType string `json:"collectionType"` // D/P (documents against payment), D/A (documents against acceptance)
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Documents     []string `json:"documents"`
	Status        string  `json:"status"` // presented, accepted, paid, refused
}

type BankGuarantee struct {
	ID              string    `json:"id"`
	GuaranteeType   string    `json:"guaranteeType"` // performance, financial, advance_payment, bid_bond
	ApplicantName   string    `json:"applicantName"`
	BeneficiaryName string    `json:"beneficiaryName"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	IssuedDate      string    `json:"issuedDate"`
	ExpiryDate      string    `json:"expiryDate"`
	Status          string    `json:"status"` // draft, issued, amended, claimed, expired, cancelled
	ClaimAmount     float64   `json:"claimAmount,omitempty"`
	ClaimDate       string    `json:"claimDate,omitempty"`
	ClaimReason     string    `json:"claimReason,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
}

var (
	tfEnhMu        sync.RWMutex
	swiftMsgs      []SWIFTMessage
	syndLCs        []SyndicatedLC
	tradeIns       []TradeInsurance
	docCollections []DocumentaryCollection
	bankGuarantees []BankGuarantee
)

func RegisterTradeEnhancements(mux *http.ServeMux) {
	mux.HandleFunc("/v1/trade/swift", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var msg SWIFTMessage
			json.NewDecoder(r.Body).Decode(&msg)
			msg.ID = fmt.Sprintf("SW-%d", time.Now().UnixNano())
			msg.Status = "draft"
			msg.CreatedAt = time.Now()
			if msg.MessageType == "" {
				http.Error(w, `{"error":"messageType is required (MT700, MT710, MT720, MT799)"}`, 400)
				return
			}
			tfEnhMu.Lock()
			swiftMsgs = append(swiftMsgs, msg)
			tfEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(msg)
			return
		}
		tfEnhMu.RLock()
		defer tfEnhMu.RUnlock()
		json.NewEncoder(w).Encode(swiftMsgs)
	})

	mux.HandleFunc("/v1/trade/syndicated-lc", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var lc SyndicatedLC
			json.NewDecoder(r.Body).Decode(&lc)
			lc.ID = fmt.Sprintf("SLC-%d", time.Now().UnixNano())
			lc.Status = "syndication"
			// Calculate participant amounts
			for i := range lc.Participants {
				lc.Participants[i].Amount = lc.TotalAmount * (lc.Participants[i].SharePct / 100)
			}
			tfEnhMu.Lock()
			syndLCs = append(syndLCs, lc)
			tfEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(lc)
			return
		}
		tfEnhMu.RLock()
		defer tfEnhMu.RUnlock()
		json.NewEncoder(w).Encode(syndLCs)
	})

	mux.HandleFunc("/v1/trade/insurance", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var ins TradeInsurance
			json.NewDecoder(r.Body).Decode(&ins)
			ins.ID = fmt.Sprintf("TI-%d", time.Now().UnixNano())
			ins.Status = "active"
			ins.Premium = ins.CoverageAmt * 0.015 // 1.5% premium rate
			tfEnhMu.Lock()
			tradeIns = append(tradeIns, ins)
			tfEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(ins)
			return
		}
		tfEnhMu.RLock()
		defer tfEnhMu.RUnlock()
		json.NewEncoder(w).Encode(tradeIns)
	})

	mux.HandleFunc("/v1/trade/documentary-collection", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var dc DocumentaryCollection
			json.NewDecoder(r.Body).Decode(&dc)
			dc.ID = fmt.Sprintf("DC-%d", time.Now().UnixNano())
			dc.Status = "presented"
			if dc.CollectionType != "D/P" && dc.CollectionType != "D/A" {
				http.Error(w, `{"error":"collectionType must be D/P or D/A"}`, 400)
				return
			}
			tfEnhMu.Lock()
			docCollections = append(docCollections, dc)
			tfEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(dc)
			return
		}
		tfEnhMu.RLock()
		defer tfEnhMu.RUnlock()
		json.NewEncoder(w).Encode(docCollections)
	})

	// Bank Guarantee Lifecycle
	mux.HandleFunc("/v1/trade/bank-guarantees", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var bg BankGuarantee
			json.NewDecoder(r.Body).Decode(&bg)
			validTypes := map[string]bool{"performance": true, "financial": true, "advance_payment": true, "bid_bond": true}
			if !validTypes[bg.GuaranteeType] {
				http.Error(w, `{"error":"guaranteeType must be performance, financial, advance_payment, or bid_bond"}`, 400)
				return
			}
			if bg.Amount <= 0 {
				http.Error(w, `{"error":"amount must be greater than 0"}`, 400)
				return
			}
			if bg.ApplicantName == "" || bg.BeneficiaryName == "" {
				http.Error(w, `{"error":"applicantName and beneficiaryName are required"}`, 400)
				return
			}
			bg.ID = fmt.Sprintf("BG-%d", time.Now().UnixNano())
			bg.Status = "draft"
			bg.CreatedAt = time.Now()
			if bg.Currency == "" {
				bg.Currency = "NGN"
			}
			tfEnhMu.Lock()
			bankGuarantees = append(bankGuarantees, bg)
			tfEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(bg)
			return
		}
		tfEnhMu.RLock()
		defer tfEnhMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"guarantees": bankGuarantees, "total": len(bankGuarantees)})
	})

	// Bank Guarantee Claim
	mux.HandleFunc("/v1/trade/bank-guarantees/claim", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != "POST" {
			w.WriteHeader(405)
			return
		}
		var body struct {
			GuaranteeID string  `json:"guaranteeId"`
			ClaimAmount float64 `json:"claimAmount"`
			Reason      string  `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		if body.Reason == "" {
			http.Error(w, `{"error":"claim reason is required"}`, 400)
			return
		}
		tfEnhMu.Lock()
		defer tfEnhMu.Unlock()
		for i := range bankGuarantees {
			if bankGuarantees[i].ID == body.GuaranteeID {
				if bankGuarantees[i].Status != "issued" {
					http.Error(w, `{"error":"can only claim issued guarantees"}`, 400)
					return
				}
				if body.ClaimAmount > bankGuarantees[i].Amount {
					http.Error(w, `{"error":"claim amount exceeds guarantee amount"}`, 400)
					return
				}
				bankGuarantees[i].Status = "claimed"
				bankGuarantees[i].ClaimAmount = body.ClaimAmount
				bankGuarantees[i].ClaimDate = time.Now().Format(time.RFC3339)
				bankGuarantees[i].ClaimReason = body.Reason
				json.NewEncoder(w).Encode(bankGuarantees[i])
				return
			}
		}
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]string{"error": "guarantee not found"})
	})
}
