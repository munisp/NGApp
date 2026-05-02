package enhancements

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestWebSocketTracker(t *testing.T) {
	tracker := NewWebSocketTracker()

	// Subscribe
	subID, ch := tracker.Subscribe(1, "")
	defer tracker.Unsubscribe(subID)

	// Publish event
	event := TransferEvent{
		TransferRef:   "TXN-001",
		ParticipantID: 1,
		Step:          StepAdmission,
		Status:        "completed",
		Timestamp:     time.Now(),
	}
	tracker.PublishEvent(event)

	// Verify receipt
	select {
	case received := <-ch:
		if received.TransferRef != "TXN-001" {
			t.Errorf("expected TXN-001, got %s", received.TransferRef)
		}
	case <-time.After(time.Second):
		t.Error("timeout waiting for event")
	}

	// Verify participant filtering
	subID2, ch2 := tracker.Subscribe(2, "")
	defer tracker.Unsubscribe(subID2)

	tracker.PublishEvent(TransferEvent{
		TransferRef:   "TXN-002",
		ParticipantID: 1,
		Step:          StepCompliance,
		Status:        "completed",
		Timestamp:     time.Now(),
	})

	select {
	case <-ch2:
		t.Error("participant 2 should not receive participant 1's events")
	case <-time.After(100 * time.Millisecond):
		// Expected
	}
}

func TestTransferProgressTracker(t *testing.T) {
	tp := NewTransferProgressTracker()
	ctx := context.Background()

	tp.RecordStep(ctx, "TXN-001", 1, StepAdmission, "completed")
	tp.RecordStep(ctx, "TXN-001", 1, StepCompliance, "completed")

	prog, ok := tp.GetProgress("TXN-001")
	if !ok {
		t.Fatal("progress not found")
	}
	if prog.CurrentStep != StepCompliance {
		t.Errorf("expected Compliance, got %s", prog.CurrentStep)
	}
	if len(prog.StepHistory) != 2 {
		t.Errorf("expected 2 steps, got %d", len(prog.StepHistory))
	}
}

func TestNotificationService(t *testing.T) {
	ns := NewNotificationService()
	ctx := context.Background()

	err := ns.LowBalanceAlert(ctx, 1, 100_000_000, 200_000_000, "NGN")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	unread := ns.GetUnread(1)
	if len(unread) != 1 {
		t.Fatalf("expected 1 unread, got %d", len(unread))
	}
	if unread[0].Type != NotifyLowBalance {
		t.Errorf("expected low_balance, got %s", unread[0].Type)
	}

	// Mark read
	ns.MarkRead(unread[0].ID)
	unread = ns.GetUnread(1)
	if len(unread) != 0 {
		t.Errorf("expected 0 unread after marking read, got %d", len(unread))
	}
}

func TestAnomalyDetector(t *testing.T) {
	ad := NewAnomalyDetector()

	// Build baseline with natural variance
	for i := 0; i < 100; i++ {
		amount := 4_000_000 + float64(i%20)*200_000 // 4M-7.8M range
		ad.AnalyzeTransfer(TransferMetric{
			ParticipantID: 1,
			Corridor:      "NG-GH",
			AmountNGN:     amount,
			Beneficiary:   "John Doe",
			Timestamp:     time.Now(),
		})
	}

	// Test deviation detection — 500M is way outside the 4-8M range
	alerts := ad.AnalyzeTransfer(TransferMetric{
		ParticipantID: 1,
		Corridor:      "NG-GH",
		AmountNGN:     500_000_000, // ~100x normal
		Beneficiary:   "John Doe",
		Timestamp:     time.Now(),
	})

	if len(alerts) == 0 {
		t.Error("expected anomaly alert for extreme amount deviation")
	}
}

func TestSLAMonitor(t *testing.T) {
	sm := NewSLAMonitor()
	ctx := context.Background()

	// Normal latency - no breach
	breach := sm.RecordTransferLatency(ctx, "NG-GH", "TXN-001", 1, 10*time.Second, true)
	if breach != nil {
		t.Error("10s should not breach NG-GH SLA (30s)")
	}

	// Excessive latency - breach
	breach = sm.RecordTransferLatency(ctx, "NG-GH", "TXN-002", 1, 45*time.Second, false)
	if breach == nil {
		t.Error("45s should breach NG-GH SLA (30s)")
	}
	if breach.BreachType != "latency" {
		t.Errorf("expected latency breach, got %s", breach.BreachType)
	}

	// Check corridor health
	health := sm.GetCorridorHealth()
	ghHealth, ok := health["NG-GH"]
	if !ok {
		t.Fatal("NG-GH health not found")
	}
	if ghHealth.BreachCount24h != 1 {
		t.Errorf("expected 1 breach, got %d", ghHealth.BreachCount24h)
	}
}

func TestParticipantSandbox(t *testing.T) {
	ps := NewParticipantSandbox()
	ctx := context.Background()

	// No sandbox yet
	if ps.IsSandboxActive(1) {
		t.Error("sandbox should not be active before creation")
	}

	// Create sandbox
	config := ps.CreateSandbox(1, SandboxFull, 24)
	if config.ParticipantID != 1 {
		t.Errorf("expected participant 1, got %d", config.ParticipantID)
	}

	if !ps.IsSandboxActive(1) {
		t.Error("sandbox should be active after creation")
	}

	// Simulate transfer
	transfer, err := ps.SimulateTransfer(ctx, 1, "NG-GH", 5_000_000, "Test Beneficiary")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(transfer.Steps) == 0 {
		t.Error("expected lifecycle steps")
	}

	transfers := ps.GetSandboxTransfers(1)
	if len(transfers) != 1 {
		t.Errorf("expected 1 sandbox transfer, got %d", len(transfers))
	}
}

func TestWebhookReplayService(t *testing.T) {
	ws := NewWebhookReplayService()
	ctx := context.Background()

	// Register endpoint
	ws.RegisterEndpoint(WebhookEndpoint{
		ParticipantID: 1,
		URL:           "https://payapp.ng/webhooks/outbound",
		Secret:        "test-secret-key",
		Events:        []WebhookEventType{EventTransferCompleted},
		Active:        true,
	})

	// Emit event
	eventID := ws.EmitEvent(ctx, 1, EventTransferCompleted, map[string]interface{}{
		"transferRef": "TXN-001",
		"amount":      5000000,
	})

	if eventID == "" {
		t.Error("expected event ID")
	}

	// Check catalog
	catalog := ws.GetEventCatalog(1, nil, nil)
	if len(catalog) != 1 {
		t.Errorf("expected 1 event in catalog, got %d", len(catalog))
	}

	// Replay
	delivery, err := ws.ReplayEvent(ctx, eventID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if delivery.EventID != eventID {
		t.Errorf("expected replay of %s, got %s", eventID, delivery.EventID)
	}
}

func TestCapacityPlanning(t *testing.T) {
	cp := NewCapacityPlanningService()

	corridors := []string{"NG-GH", "NG-GB", "NG-US"}
	liquidity := map[string]float64{
		"NG-GH": 300_000_000,
		"NG-GB": 500_000_000,
		"NG-US": 700_000_000,
	}

	forecasts := cp.GenerateForecast(corridors, liquidity)
	if len(forecasts) != 90 { // 3 corridors × 30 days
		t.Errorf("expected 90 forecasts, got %d", len(forecasts))
	}

	// Verify liquidity alerts
	alerts := cp.GetLiquidityAlerts(7)
	// Some corridors should have gaps
	for _, alert := range alerts {
		if alert.LiquidityGap <= 0 {
			t.Error("alert should have positive liquidity gap")
		}
	}
}

func TestFIDO2ApprovalService(t *testing.T) {
	fs := NewFIDO2ApprovalService()

	// Below threshold - no FIDO2 needed
	if fs.RequiresHardwareKey("transfer", 10_000_000) {
		t.Error("₦10M should not require FIDO2")
	}

	// Above threshold
	if !fs.RequiresHardwareKey("transfer", 150_000_000) {
		t.Error("₦150M should require FIDO2")
	}

	// Critical action always requires FIDO2
	if !fs.RequiresHardwareKey("approve_sar", 0) {
		t.Error("SAR approval should always require FIDO2")
	}

	// Create and verify challenge
	approval := fs.CreateChallenge(101, "approve_sar", 50_000_000)
	if approval.Status != "pending" {
		t.Errorf("expected pending, got %s", approval.Status)
	}

	verified := fs.VerifyResponse(approval.ID, "credential-abc123")
	if !verified {
		t.Error("verification should succeed")
	}

	pending := fs.GetPendingApprovals(101)
	if len(pending) != 0 {
		t.Errorf("should have 0 pending after verification, got %d", len(pending))
	}
}

func TestRevenueReconciliation(t *testing.T) {
	rs := NewRevenueReconciliationService()

	// Set terms
	rs.SetRevenueShareTerms(ParticipantRevenueShare{
		ParticipantID:    1,
		Tier:             "growth",
		FXSpreadSharePct: 0.1,
		CorridorFeeShare: 0.05,
		TransactionFee:   500, // ₦500 per txn
		MonthlyMinimum:   500_000,
	})

	// Record revenue entries
	period := "2025-05"
	for i := 0; i < 10; i++ {
		rs.RecordRevenue(RevenueEntry{
			ID:            fmt.Sprintf("rev-%d", i),
			ParticipantID: 1,
			Category:      RevenueTransaction,
			AmountNGN:     500,
			Period:        period,
			Timestamp:     time.Now(),
			Source:        "tigerbeetle",
		})
	}

	// Run reconciliation
	records := rs.RunReconciliation(1, period)
	if len(records) == 0 {
		t.Error("expected reconciliation records")
	}

	// Check summary
	summary := rs.GetReconciliationSummary(1, period)
	if summary.ParticipantID != 1 {
		t.Errorf("expected participant 1, got %d", summary.ParticipantID)
	}
}
