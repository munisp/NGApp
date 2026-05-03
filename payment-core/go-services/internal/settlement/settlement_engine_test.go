package settlement

import (
	"testing"
	"time"
)

func TestNewSettlementEngine(t *testing.T) {
	engine := NewSettlementEngine()

	configs := engine.GetRailConfigs()
	if len(configs) != 9 {
		t.Fatalf("expected 9 rail configs, got %d", len(configs))
	}

	railIDs := make(map[string]bool)
	for _, c := range configs {
		railIDs[c.RailID] = true
	}

	expected := []string{"SWIFT", "PAPSS", "CIPS", "UPI", "SEPA", "MOBILE_MONEY", "MOJALOOP", "ACH", "FASTER_PAYMENTS"}
	for _, id := range expected {
		if !railIDs[id] {
			t.Errorf("missing rail config: %s", id)
		}
	}
}

func TestImmediateGrossSettlement(t *testing.T) {
	engine := NewSettlementEngine()

	transfer := Transfer{
		TransferRef:   "NOR-2026-00001",
		ParticipantID: "PAYAPP-001",
		Corridor:      "NG-IN",
		RailID:        "UPI",
		AmountNGN:     850000000, // 8.5M NGN
		AmountDest:    7150000,   // 71,500 INR
		DestCurrency:  "INR",
		FxRate:        0.0530,
		SwitchFee:     15000,
		CorridorFee:   34000,
		CreatedAt:     time.Now(),
	}

	batch, err := engine.SubmitTransfer(transfer)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if batch == nil {
		t.Fatal("expected immediate settlement batch, got nil")
	}
	if batch.Status != StatusSubmitted {
		t.Errorf("expected status SUBMITTED, got %s", batch.Status)
	}
	if batch.TransferCount != 1 {
		t.Errorf("expected 1 transfer, got %d", batch.TransferCount)
	}
	if batch.SubmittedAt == nil {
		t.Error("expected SubmittedAt to be set")
	}
}

func TestDeferredNetSettlement(t *testing.T) {
	engine := NewSettlementEngine()

	transfers := []Transfer{
		{
			TransferRef: "NOR-2026-00010", ParticipantID: "PAYAPP-001",
			Corridor: "NG-GH", RailID: "PAPSS",
			AmountNGN: 250000000, AmountDest: 2427200, DestCurrency: "GHS",
			CreatedAt: time.Now(),
		},
		{
			TransferRef: "NOR-2026-00011", ParticipantID: "OPAY-001",
			Corridor: "NG-GH", RailID: "PAPSS",
			AmountNGN: 500000000, AmountDest: 4854400, DestCurrency: "GHS",
			CreatedAt: time.Now(),
		},
		{
			TransferRef: "NOR-2026-00012", ParticipantID: "PAYAPP-001",
			Corridor: "NG-KE", RailID: "PAPSS",
			AmountNGN: 120000000, AmountDest: 978000, DestCurrency: "KES",
			CreatedAt: time.Now(),
		},
	}

	for _, tr := range transfers {
		batch, err := engine.SubmitTransfer(tr)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if batch != nil {
			t.Fatal("deferred net should not return immediate batch")
		}
	}

	sizes := engine.GetPendingQueueSize()
	if sizes["PAPSS"] != 3 {
		t.Errorf("expected 3 pending PAPSS transfers, got %d", sizes["PAPSS"])
	}

	batch, err := engine.CloseBatchWindow("PAPSS")
	if err != nil {
		t.Fatalf("unexpected error closing batch: %v", err)
	}
	if batch.TransferCount != 3 {
		t.Errorf("expected 3 transfers in batch, got %d", batch.TransferCount)
	}
	if batch.Status != StatusNetting {
		t.Errorf("expected status NETTING, got %s", batch.Status)
	}
	if len(batch.NetPositions) != 2 {
		t.Errorf("expected 2 net positions (PAYAPP + OPAY), got %d", len(batch.NetPositions))
	}
	if batch.AuditHash == "" {
		t.Error("expected non-empty audit hash")
	}

	// Confirm settlement
	err = engine.ConfirmSettlement(batch.BatchID)
	if err != nil {
		t.Fatalf("unexpected error confirming: %v", err)
	}
}

func TestReconciliation(t *testing.T) {
	engine := NewSettlementEngine()

	transfers := []Transfer{
		{TransferRef: "T-001", ParticipantID: "P-001", RailID: "PAPSS", AmountNGN: 100000, AmountDest: 970, DestCurrency: "GHS", CreatedAt: time.Now()},
		{TransferRef: "T-002", ParticipantID: "P-001", RailID: "PAPSS", AmountNGN: 200000, AmountDest: 1940, DestCurrency: "GHS", CreatedAt: time.Now()},
		{TransferRef: "T-003", ParticipantID: "P-002", RailID: "PAPSS", AmountNGN: 300000, AmountDest: 2910, DestCurrency: "GHS", CreatedAt: time.Now()},
	}
	for _, tr := range transfers {
		engine.SubmitTransfer(tr)
	}

	batch, _ := engine.CloseBatchWindow("PAPSS")

	confirmations := []ProviderConfirmation{
		{TransferRef: "T-001", Amount: 970, Currency: "GHS", Status: "settled"},
		{TransferRef: "T-002", Amount: 1940, Currency: "GHS", Status: "settled"},
		// T-003 missing (unmatched)
	}

	result, err := engine.Reconcile(batch.BatchID, confirmations)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.MatchedCount != 2 {
		t.Errorf("expected 2 matched, got %d", result.MatchedCount)
	}
	if result.UnmatchedCount != 1 {
		t.Errorf("expected 1 unmatched, got %d", result.UnmatchedCount)
	}
	if result.Status != "discrepancies_found" {
		t.Errorf("expected discrepancies_found, got %s", result.Status)
	}
}

func TestSettlementFileGeneration(t *testing.T) {
	engine := NewSettlementEngine()

	// Test MT940 (SWIFT)
	engine.SubmitTransfer(Transfer{
		TransferRef: "T-SWIFT-001", ParticipantID: "P-001", RailID: "SWIFT",
		AmountNGN: 1500000000, AmountDest: 10000, DestCurrency: "USD",
		BeneficiaryRef: "John Smith", Corridor: "NG-US", CreatedAt: time.Now(),
	})
	batch, _ := engine.CloseBatchWindow("SWIFT")
	data, contentType, err := engine.GenerateSettlementFile(batch.BatchID)
	if err != nil {
		t.Fatalf("MT940 generation failed: %v", err)
	}
	if contentType != "text/plain" {
		t.Errorf("expected text/plain, got %s", contentType)
	}
	if len(data) == 0 {
		t.Error("expected non-empty MT940 file")
	}

	// Test ISO20022 (PAPSS)
	engine.SubmitTransfer(Transfer{
		TransferRef: "T-PAPSS-001", ParticipantID: "P-001", RailID: "PAPSS",
		AmountNGN: 250000000, AmountDest: 2427200, DestCurrency: "GHS",
		BeneficiaryRef: "Kwame Asante", Corridor: "NG-GH", CreatedAt: time.Now(),
	})
	batch2, _ := engine.CloseBatchWindow("PAPSS")
	data2, contentType2, _ := engine.GenerateSettlementFile(batch2.BatchID)
	if contentType2 != "application/xml" {
		t.Errorf("expected application/xml, got %s", contentType2)
	}
	if len(data2) == 0 {
		t.Error("expected non-empty ISO20022 file")
	}
}

func TestSettlementStats(t *testing.T) {
	engine := NewSettlementEngine()

	engine.SubmitTransfer(Transfer{TransferRef: "T-1", ParticipantID: "P-1", RailID: "PAPSS", AmountNGN: 100000, DestCurrency: "GHS", CreatedAt: time.Now()})
	engine.SubmitTransfer(Transfer{TransferRef: "T-2", ParticipantID: "P-1", RailID: "PAPSS", AmountNGN: 200000, DestCurrency: "GHS", CreatedAt: time.Now()})
	engine.SubmitTransfer(Transfer{TransferRef: "T-3", ParticipantID: "P-1", RailID: "UPI", AmountNGN: 500000, AmountDest: 4200, DestCurrency: "INR", CreatedAt: time.Now()})

	stats := engine.GetSettlementStats()

	papssStats := stats.RailStats["PAPSS"]
	if papssStats.PendingCount != 2 {
		t.Errorf("expected 2 pending PAPSS, got %d", papssStats.PendingCount)
	}

	if stats.TotalActiveBatches != 1 {
		t.Errorf("expected 1 active batch (UPI immediate), got %d", stats.TotalActiveBatches)
	}
}

func TestFailAndRetrySettlement(t *testing.T) {
	engine := NewSettlementEngine()

	engine.SubmitTransfer(Transfer{TransferRef: "T-R1", ParticipantID: "P-1", RailID: "SWIFT", AmountNGN: 100000, DestCurrency: "USD", CreatedAt: time.Now()})
	batch, _ := engine.CloseBatchWindow("SWIFT")

	// First failure - should retry
	err := engine.FailSettlement(batch.BatchID, "provider timeout")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	b := engine.activeBatches[batch.BatchID]
	if b.Status != StatusPending {
		t.Errorf("expected PENDING (retry), got %s", b.Status)
	}
	if b.RetryCount != 1 {
		t.Errorf("expected retryCount 1, got %d", b.RetryCount)
	}

	// Exhaust retries (SWIFT has 3 retries)
	engine.FailSettlement(batch.BatchID, "timeout")
	engine.FailSettlement(batch.BatchID, "timeout")

	b = engine.activeBatches[batch.BatchID]
	if b.RetryCount != 3 {
		t.Errorf("expected retryCount 3, got %d", b.RetryCount)
	}

	// Final failure - should mark as failed
	engine.FailSettlement(batch.BatchID, "final failure")
	b = engine.activeBatches[batch.BatchID]
	if b.Status != StatusFailed {
		t.Errorf("expected FAILED after exhausting retries, got %s", b.Status)
	}
}
