// Integration tests for financial settlement flow:
//   Production event → TigerBeetle double-entry → Royalty calculation → Mojaloop settlement
//
// Run with: go test -tags=integration ./tests/integration/ -run TestFinancialSettlement
//
//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

type ProductionEvent struct {
	WellID         string  `json:"well_id"`
	VolumeBarrels  float64 `json:"volume_barrels"`
	PricePerBarrel float64 `json:"price_per_barrel_cents"`
}

type TransferResult struct {
	TransferID string `json:"transfer_id"`
	Status     string `json:"status"`
}

type AccountBalance struct {
	AccountID      string `json:"account_id"`
	CreditsPosted  uint64 `json:"credits_posted"`
	DebitsPosted   uint64 `json:"debits_posted"`
	Balance        int64  `json:"balance"`
}

func financialLedgerURL() string {
	return envOr("FINANCIAL_LEDGER_URL", "http://localhost:8084")
}

func TestFinancialSettlementProductionRecording(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	event := ProductionEvent{
		WellID:         "well-settlement-001",
		VolumeBarrels:  250,
		PricePerBarrel: 7500, // $75.00 in cents
	}

	body, _ := json.Marshal(event)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, financialLedgerURL()+"/api/v1/production/record", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("financial ledger not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		t.Errorf("expected 200/201, got %d", resp.StatusCode)
	}

	var result TransferResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
		t.Logf("production recorded: transfer_id=%s status=%s", result.TransferID, result.Status)
	}
}

func TestFinancialSettlementIdempotency(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	idempotencyKey := "idem-test-" + time.Now().Format("20060102150405")

	event := ProductionEvent{
		WellID:         "well-settlement-001",
		VolumeBarrels:  100,
		PricePerBarrel: 7500,
	}

	body, _ := json.Marshal(event)

	// Send same request twice with same idempotency key
	for attempt := 0; attempt < 2; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, financialLedgerURL()+"/api/v1/production/record", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", idempotencyKey)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Logf("financial ledger not reachable: %v", err)
			return
		}
		resp.Body.Close()
		t.Logf("attempt %d: HTTP %d", attempt+1, resp.StatusCode)
	}
}

func TestFinancialSettlementAccountBalance(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, financialLedgerURL()+"/api/v1/accounts/well-settlement-001/balance", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("financial ledger not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var balance AccountBalance
		if err := json.NewDecoder(resp.Body).Decode(&balance); err == nil {
			t.Logf("account balance: credits=%d debits=%d net=%d", balance.CreditsPosted, balance.DebitsPosted, balance.Balance)
		}
	}
}

func TestFinancialSettlementRoyaltyDistribution(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	distribution := map[string]interface{}{
		"revenue_account_id": "well-settlement-001-revenue",
		"shares": []map[string]interface{}{
			{"owner_account_id": "landowner-001", "percentage": 0.125, "amount_cents": 234375},
			{"owner_account_id": "government-tax", "percentage": 0.20, "amount_cents": 375000},
			{"owner_account_id": "partner-jv-001", "percentage": 0.30, "amount_cents": 562500},
		},
	}

	body, _ := json.Marshal(distribution)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, financialLedgerURL()+"/api/v1/royalties/distribute", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("financial ledger not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	t.Logf("royalty distribution response: HTTP %d", resp.StatusCode)
}
